// 地图标签防重叠 + 屏上字号 LOD 布局器 · tm-map-label-collide.js (P1·2026-07-05)
// ============================================================
// 跨朝代通用·渲染层 DOM helper(不含任何朝代专名/游戏状态·由调用方传 stage/scale/band)。
// 读每个标签 <g> 的 data-fs/lw/lh/ax/ay/pr → 当前波段可见层贪心占位：
//   · LOD 门：fontSize×scale < minPx 屏上过小 → 直接隐
//   · 贪心：按优先级(pr·字号=面积proxy·高者先)逐个放·屏上 bbox 相交则隐
//   · 隐藏 = 加 .tmf-collide-hidden(CSS opacity:0)·每次重算先全清
// 盒/位皆×scale·同波段缩放去重叠为主·跨波段靠层级链换 region 集。
// realm→势力名层 / region·prefecture→地名层。opts.noCollide 只走 LOD 门(调试)。
// ============================================================
(function(){
  'use strict';
  function perfCount(name, delta) {
    var perf = typeof window !== 'undefined' && window.TM && window.TM.perf;
    if (perf && typeof perf.count === 'function') perf.count(name, delta == null ? 1 : delta);
  }

  function perfSpan(name, fn, metadata) {
    var perf = typeof window !== 'undefined' && window.TM && window.TM.perf;
    if (perf && typeof perf.withSpan === 'function') return perf.withSpan(name, fn, metadata);
    return fn();
  }
  function resolve(stage, scale, band, opts){
    opts = opts || {};
    if (!stage || !stage.querySelector) return;
    var svg = stage.querySelector('#tmf-map-labels') || stage.querySelector('#tmf-formal-map');
    if (!svg) return;
    scale = Number(scale) || 1;
    var matrix = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
    var multiplier = svg.getAttribute('data-tmf-composited') === '1' ? 1 : scale;
    var sx = multiplier * (matrix ? Math.hypot(matrix.a, matrix.b) || 1 : 1), sy = multiplier * (matrix ? Math.hypot(matrix.c, matrix.d) || 1 : 1);
    var sel = (band === 'realm') ? '.tmf-faction-label' : '.tmf-region-label';
    var nodes = svg.querySelectorAll(sel);
    var desired = new Map(), all = svg.querySelectorAll('.tmf-faction-label,.tmf-region-label');
    for (var p = 0; p < all.length; p++) desired.set(all[p], true);
    var MIN_PX = (opts.minPx != null) ? opts.minPx : 8.5;
    var PAD = (opts.pad != null) ? opts.pad : 1.5;
    var items = [];
    for (var i = 0; i < nodes.length; i++) {
      var g = nodes[i];
      var fs = parseFloat(g.getAttribute('data-fs')) || 12;
      if (fs * Math.min(sx, sy) * (parseFloat(g.getAttribute('data-ink-scale')) || 1) < MIN_PX) continue;
      desired.set(g, false);
      var lw = (parseFloat(g.getAttribute('data-lw')) || fs) * sx;
      var lh = (parseFloat(g.getAttribute('data-lh')) || fs) * sy;
      var obb = String(g.getAttribute('data-obb') || '').split(',').map(Number);
      items.push({
        g: g,
        pr: parseFloat(g.getAttribute('data-pr')) || fs,
        hw: lw / 2 + PAD, hh: lh / 2 + PAD,
        obb: obb.length === 3 && obb.every(Number.isFinite) ? { hw: obb[0] * sx / 2 + PAD, hh: obb[1] * sy / 2 + PAD, angle: obb[2] } : null,
        cx: (parseFloat(g.getAttribute('data-ax')) || 0) * sx,
        cy: (parseFloat(g.getAttribute('data-ay')) || 0) * sy
      });
    }
    // 纯几何贪心占位(可离线复算验证)：高优先级先占·后来者与已放置相交则隐。
    items.forEach(function(item, index) { item._tmLabelOrder = index; });
    items.sort(function(a, b){ return (b.pr - a.pr) || (a._tmLabelOrder - b._tmLabelOrder); });
    var hidden = opts.noCollide ? [] : placeGreedy(items);
    for (var h = 0; h < items.length; h++) if (hidden[h]) desired.set(items[h].g, true);
    desired.forEach(function(hide, node){
      if (node.classList.contains('tmf-collide-hidden') !== hide) node.classList.toggle('tmf-collide-hidden', hide);
      if (node.getAttribute('aria-hidden') !== String(hide)) node.setAttribute('aria-hidden', String(hide));
      if (node.getAttribute('role') === 'button' && node.getAttribute('tabindex') !== (hide ? '-1' : '0')) node.setAttribute('tabindex', hide ? '-1' : '0');
    });
  }

  // 纯函数：items 已按 pr 降序·返回等长布尔数组(true=被挡该隐)。无 DOM 依赖·供单测/离线复算。
  function placeGreedy(items, options){
    options = options || {};
    var cellSize = Number(options.cellSize);
    if (!isFinite(cellSize) || cellSize <= 0) cellSize = 64;
    return perfSpan('map.labelCollision', function() {
      var out = new Array(items.length);
      var placed = [];
      var grid = Object.create(null);
      function cellsFor(item) {
        var minX = Math.floor((item.cx - item.hw) / cellSize);
        var maxX = Math.floor((item.cx + item.hw) / cellSize);
        var minY = Math.floor((item.cy - item.hh) / cellSize);
        var maxY = Math.floor((item.cy + item.hh) / cellSize);
        var cells = [];
        for (var gx = minX; gx <= maxX; gx++) {
          for (var gy = minY; gy <= maxY; gy++) cells.push(gx + ':' + gy);
        }
        return cells;
      }
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var hit = false;
        var cells = cellsFor(it);
        var candidateIds = Object.create(null);
        var candidates = [];
        for (var c = 0; c < cells.length; c++) {
          perfCount('map.labelGridLookups', 1);
          var bucket = grid[cells[c]] || [];
          for (var b = 0; b < bucket.length; b++) {
            var candidateId = bucket[b];
            if (candidateIds[candidateId]) continue;
            candidateIds[candidateId] = true;
            candidates.push(candidateId);
          }
        }
        candidates.sort(function(a, b) { return a - b; });
        for (var m = 0; m < candidates.length; m++) {
          var q = placed[candidates[m]];
          perfCount('map.labelPairChecks', 1);
          if (Math.abs(it.cx - q.cx) < (it.hw + q.hw) && Math.abs(it.cy - q.cy) < (it.hh + q.hh) && orientedOverlap(it, q)) { hit = true; break; }
        }
        out[k] = hit;
        if (!hit) {
          var placedIndex = placed.length;
          placed.push(it);
          for (var insert = 0; insert < cells.length; insert++) {
            if (!grid[cells[insert]]) grid[cells[insert]] = [];
            grid[cells[insert]].push(placedIndex);
          }
        }
      }
      return out;
    }, { itemCount: items.length, cellSize: cellSize });
  }

  // Rotated country names can have overlapping AABBs without overlapping ink.
  // Refine broad-phase hits with the separating axes of the two text rectangles.
  function orientedOverlap(a, b){
    if (!a.obb && !b.obb) return true;
    function shape(item){ var r = item.obb || { hw: item.hw, hh: item.hh, angle: 0 }, t = r.angle * Math.PI / 180; return { hw: r.hw, hh: r.hh, x: [Math.cos(t), Math.sin(t)], y: [-Math.sin(t), Math.cos(t)] }; }
    var p = shape(a), q = shape(b), dx = a.cx - b.cx, dy = a.cy - b.cy;
    return [p.x, p.y, q.x, q.y].every(function(axis){ var dot = function(v){ return Math.abs(v[0] * axis[0] + v[1] * axis[1]); }; return Math.abs(dx * axis[0] + dy * axis[1]) < p.hw * dot(p.x) + p.hh * dot(p.y) + q.hw * dot(q.x) + q.hh * dot(q.y); });
  }
  var api = { resolve: resolve, placeGreedy: placeGreedy, orientedOverlap: orientedOverlap };
  if (typeof window !== 'undefined') window.TMMapLabelCollide = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
