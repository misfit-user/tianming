// map-editor-voronoi.js
// Voronoi 网格生成·半平面裁剪 (Sutherland-Hodgman)·Lloyd 松弛
// 种子点 → 自动 cells → 转 division
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[voronoi] core not loaded'); return; }

  var EPS = 1e-9;

  // ─── geometry helpers ────────────────────────────────────

  function boundsToPolygon(b){
    return [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x + b.w, b.y + b.h],
      [b.x, b.y + b.h]
    ];
  }

  // 半平面裁剪·Sutherland-Hodgman
  // 切线·过 mid·法向 n·n 指外 (远 seed 一侧)·保留 seed 一侧
  // 即·  对 polygon 中每点 p·若 (p - mid)·n ≤ 0 → 保留
  function clipPolygonByHalfplane(poly, mid, n){
    if (poly.length === 0) return [];
    var result = [];
    for (var i = 0; i < poly.length; i++){
      var curr = poly[i];
      var next = poly[(i + 1) % poly.length];
      var currDot = (curr[0] - mid[0]) * n[0] + (curr[1] - mid[1]) * n[1];
      var nextDot = (next[0] - mid[0]) * n[0] + (next[1] - mid[1]) * n[1];
      var currInside = currDot <= 0;
      var nextInside = nextDot <= 0;

      if (currInside) result.push([curr[0], curr[1]]);
      if (currInside !== nextInside){
        var dx = next[0] - curr[0];
        var dy = next[1] - curr[1];
        var denom = dx * n[0] + dy * n[1];
        if (Math.abs(denom) < EPS) continue;
        var t = -currDot / denom;
        result.push([curr[0] + t * dx, curr[1] + t * dy]);
      }
    }
    return result;
  }

  // ─── Voronoi cells (O(n²) 半平面裁剪) ─────────────────────

  function computeCells(seeds, bounds){
    return seeds.map(function(seed, i){
      var cell = boundsToPolygon(bounds);
      for (var j = 0; j < seeds.length; j++){
        if (i === j) continue;
        var other = seeds[j];
        var mid = [(seed[0] + other[0]) / 2, (seed[1] + other[1]) / 2];
        // n 指向 other (远 seed)·保留 seed 一侧
        var n = [other[0] - seed[0], other[1] - seed[1]];
        cell = clipPolygonByHalfplane(cell, mid, n);
        if (cell.length === 0) break;
      }
      return cell;
    });
  }

  // ─── Lloyd's relaxation ─────────────────────────────────

  function lloydsRelaxation(seeds, bounds, iterations){
    iterations = iterations || 5;
    var current = seeds.slice();
    for (var it = 0; it < iterations; it++){
      var cells = computeCells(current, bounds);
      current = cells.map(function(c, i){
        if (c.length < 3) return current[i];
        var centroid = ME.polygonCentroid(c);
        return centroid || current[i];
      });
    }
    return current;
  }

  // ─── seed generators ────────────────────────────────────

  function randomSeeds(n, bounds, seedFn){
    var rnd = seedFn || Math.random;
    var pad = 0.05;
    var seeds = [];
    for (var i = 0; i < n; i++){
      seeds.push([
        bounds.x + bounds.w * (pad + rnd() * (1 - 2 * pad)),
        bounds.y + bounds.h * (pad + rnd() * (1 - 2 * pad))
      ]);
    }
    return seeds;
  }

  // 泊松抽样·avoid clustering
  function poissonSeeds(n, bounds, minDist){
    minDist = minDist || Math.sqrt(bounds.w * bounds.h / n) * 0.65;
    var seeds = [];
    var maxTries = n * 50;
    var tries = 0;
    while (seeds.length < n && tries < maxTries){
      tries++;
      var p = [
        bounds.x + Math.random() * bounds.w,
        bounds.y + Math.random() * bounds.h
      ];
      var ok = true;
      for (var i = 0; i < seeds.length; i++){
        var dx = p[0] - seeds[i][0];
        var dy = p[1] - seeds[i][1];
        if (dx*dx + dy*dy < minDist * minDist){
          ok = false; break;
        }
      }
      if (ok) seeds.push(p);
    }
    return seeds;
  }

  // ─── interactive seeding state ──────────────────────────

  // EDITOR.voronoiState = { seeds: [], active: bool }
  function startInteractive(){
    if (!ME.EDITOR.voronoiState) ME.EDITOR.voronoiState = { seeds: [], active: false };
    ME.EDITOR.voronoiState.active = true;
    ME.EDITOR.voronoiState.seeds = [];
    ME.requestRender();
  }

  function addSeed(x, y){
    if (!ME.EDITOR.voronoiState || !ME.EDITOR.voronoiState.active) return;
    ME.EDITOR.voronoiState.seeds.push([x, y]);
    ME.requestRender();
  }

  function clearSeeds(){
    if (ME.EDITOR.voronoiState){
      ME.EDITOR.voronoiState.seeds = [];
      ME.requestRender();
    }
  }

  function exitInteractive(){
    if (ME.EDITOR.voronoiState){
      ME.EDITOR.voronoiState.active = false;
      ME.requestRender();
    }
  }

  function generateFromSeeds(opts){
    opts = opts || {};
    var seeds = opts.seeds || (ME.EDITOR.voronoiState ? ME.EDITOR.voronoiState.seeds.slice() : []);
    if (seeds.length < 2){
      meAlert('Voronoi 需 ≥ 2 种子点');
      return false;
    }

    var bounds = opts.bounds || {
      x: 0, y: 0,
      w: ME.EDITOR.map.bitmapWidth || 1280,
      h: ME.EDITOR.map.bitmapHeight || 800
    };

    var iterations = opts.lloyd != null ? opts.lloyd : 0;
    if (iterations > 0){
      seeds = lloydsRelaxation(seeds, bounds, iterations);
    }

    var cells = computeCells(seeds, bounds);
    var validCells = cells.filter(function(c){ return c.length >= 3; });

    if (validCells.length === 0){
      meAlert('Voronoi 失败·无有效 cell');
      return false;
    }

    var strategy = opts.strategy || 'add';
    var nameBase = opts.nameBase || 'V';
    var dyn = TM.MapEditor.dynasty.get(ME.EDITOR.map.dynasty);
    var defaultAut = dyn.defaultAutonomy === 'mixed' ? 'zhixia' : (dyn.defaultAutonomy || 'zhixia');

    var newDivs = validCells.map(function(c, i){
      var d = ME.createDivision({
        name: nameBase + (i + 1),
        level: 'province',
        regionType: 'normal',
        terrain: dyn.defaultTerrain,
        polygon: c,
        autonomy: { type: defaultAut, subtype: '', holder: '', suzerain: '', loyalty: 80, tributeRate: 0 },
        byEthnicity: dyn.ethnicityDefault ? Object.assign({}, dyn.ethnicityDefault) : null,
        byFaith: dyn.faithDefault ? Object.assign({}, dyn.faithDefault) : null,
        description: 'Voronoi 生成·' + iterations + ' Lloyd iter'
      });
      ME.recomputeDerived(d);
      return d;
    });

    ME.commitMutation('Voronoi gen ' + newDivs.length, function(){
      if (strategy === 'replace'){
        // 清 topology 旧 div usage
        if (global.TM && TM.MapEditor.topology && TM.MapEditor.topology.isEnabled()){
          ME.EDITOR.map.divisions.forEach(function(D){
            TM.MapEditor.topology.removeDivisionFromTopology(D.id);
          });
        }
        ME.EDITOR.map.divisions = newDivs;
      } else {
        ME.EDITOR.map.divisions = ME.EDITOR.map.divisions.concat(newDivs);
      }
      // sync to topology if enabled
      if (global.TM && TM.MapEditor.topology && TM.MapEditor.topology.isEnabled()){
        newDivs.forEach(function(d){
          TM.MapEditor.topology.syncDivisionToTopology(ME.EDITOR.map, d);
        });
      }
    });

    if (ME.EDITOR.voronoiState){
      ME.EDITOR.voronoiState.active = false;
      ME.EDITOR.voronoiState.seeds = [];
    }

    var statusEl = document.getElementById('status-tip');
    if (statusEl) statusEl.textContent = 'Voronoi 生成·' + newDivs.length + ' cell·Lloyd ' + iterations + ' iter';
    return true;
  }

  // ─── render preview·canvas hook ─────────────────────────

  function renderPreview(ctx, camera){
    var s = ME.EDITOR.voronoiState;
    if (!s || !s.active) return;
    var seeds = s.seeds;
    if (seeds.length === 0) return;

    // 半透明显 cells
    if (seeds.length >= 2){
      var bounds = {
        x: 0, y: 0,
        w: ME.EDITOR.map.bitmapWidth || 1280,
        h: ME.EDITOR.map.bitmapHeight || 800
      };
      var cells = computeCells(seeds, bounds);
      cells.forEach(function(c, i){
        if (c.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(c[0][0], c[0][1]);
        for (var k = 1; k < c.length; k++) ctx.lineTo(c[k][0], c[k][1]);
        ctx.closePath();
        var hue = (i * 137) % 360;
        ctx.fillStyle = 'hsla(' + hue + ',45%,40%,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(217,181,102,0.4)';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.stroke();
      });
    }

    // 显种子点 + 序号
    seeds.forEach(function(s, i){
      ctx.beginPath();
      ctx.arc(s[0], s[1], 5 / camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#dc4f3a';
      ctx.fill();
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.strokeStyle = '#d9b566';
      ctx.stroke();
      ctx.font = (10 / camera.zoom) + 'px Menlo, monospace';
      ctx.fillStyle = '#d9b566';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), s[0], s[1] + 6 / camera.zoom);
    });
  }

  // ─── modal·设置 + 触发 ──────────────────────────────────

  var _modal = null;
  function openModal(){
    if (!_modal){
      _modal = document.createElement('div');
      _modal.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:9999; background:#1a1a1f; border:1px solid #3a3530; border-radius:6px; padding:14px 18px; min-width:380px; color:#e8ddc8; font-family:inherit; box-shadow:0 8px 30px rgba(0,0,0,0.6); display:none;';
      document.body.appendChild(_modal);
    }

    var hasInteractive = ME.EDITOR.voronoiState && ME.EDITOR.voronoiState.active;
    var nSeeds = hasInteractive ? ME.EDITOR.voronoiState.seeds.length : 0;

    _modal.innerHTML = '\
      <div style="font-size:14px; color:#c9a96e; margin-bottom:10px;">Voronoi 网格生成</div>\
      <div style="font-size:11px; color:#6a6560; margin-bottom:14px;">点种子点 → 自动 Voronoi tessellation·每 cell = 一省</div>\
      \
      <div style="display:grid; gap:8px; margin-bottom:14px;">\
        <button class="me-btn me-btn-warn" id="vor-interactive">' + (hasInteractive ? '继续·已 ' + nSeeds + ' 种子' : '交互模式·点 canvas 加种子') + '</button>\
        <button class="me-btn" id="vor-random-30">随机 30 种 (泊松)</button>\
        <button class="me-btn" id="vor-random-50">随机 50 种</button>\
        <button class="me-btn" id="vor-random-100">随机 100 种</button>\
        <button class="me-btn" id="vor-random-custom">随机 N···</button>\
      </div>\
      \
      <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px; margin-bottom:14px; align-items:center;">\
        <span style="font-size:11px; color:#6a6560;">Lloyd 松弛</span>\
        <input type="range" id="vor-lloyd" min="0" max="20" step="1" value="5" style="accent-color:#d9b566;" />\
        <span style="font-size:11px; color:#6a6560;">·</span>\
        <span style="font-size:10px; color:#a8a098;"><b id="vor-lloyd-val">5</b> iter·0=无松·5 中等·20=极均</span>\
        <span style="font-size:11px; color:#6a6560;">导入策略</span>\
        <select id="vor-strategy" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;">\
          <option value="add">追加</option>\
          <option value="replace">替换·清空现 div</option>\
        </select>\
        <span style="font-size:11px; color:#6a6560;">命名前缀</span>\
        <input type="text" id="vor-prefix" value="V" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;" />\
      </div>\
      \
      <div style="display:flex; gap:8px; justify-content:flex-end;">\
        <button class="me-btn" id="vor-clear-seeds">清种子</button>\
        <button class="me-btn" id="vor-cancel">取消</button>\
        ' + (hasInteractive && nSeeds >= 2 ? '<button class="me-btn me-btn-warn" id="vor-go">生成 ' + nSeeds + ' cell</button>' : '') + '\
      </div>\
    ';
    _modal.style.display = 'block';

    document.getElementById('vor-cancel').onclick = function(){ _modal.style.display = 'none'; };

    var lloydSlider = document.getElementById('vor-lloyd');
    var lloydLabel = document.getElementById('vor-lloyd-val');
    lloydSlider.oninput = function(){ lloydLabel.textContent = lloydSlider.value; };

    document.getElementById('vor-clear-seeds').onclick = function(){
      clearSeeds();
      _modal.style.display = 'none';
      openModal();
    };

    document.getElementById('vor-interactive').onclick = function(){
      _modal.style.display = 'none';
      ME.setTool('voronoi');
      startInteractive();
      var statusEl = document.getElementById('status-tip');
      if (statusEl) statusEl.textContent = 'Voronoi 交互·click canvas 加种子·V 工具退出·或再开此 modal 触发';
    };

    var goRandom = function(n){
      var bounds = {
        x: 0, y: 0,
        w: ME.EDITOR.map.bitmapWidth || 1280,
        h: ME.EDITOR.map.bitmapHeight || 800
      };
      var seeds = poissonSeeds(n, bounds);
      if (seeds.length < n){
        // fallback to random
        seeds = randomSeeds(n, bounds);
      }
      var lloyd = Number(lloydSlider.value);
      var strategy = document.getElementById('vor-strategy').value;
      var prefix = document.getElementById('vor-prefix').value || 'V';
      _modal.style.display = 'none';
      generateFromSeeds({ seeds: seeds, lloyd: lloyd, strategy: strategy, nameBase: prefix });
    };
    document.getElementById('vor-random-30').onclick = function(){ goRandom(30); };
    document.getElementById('vor-random-50').onclick = function(){ goRandom(50); };
    document.getElementById('vor-random-100').onclick = function(){ goRandom(100); };
    document.getElementById('vor-random-custom').onclick = function(){
      var n = Number(prompt('随机种子数·N', '50'));
      if (!n || isNaN(n)) return;
      goRandom(Math.max(2, Math.min(2000, n)));
    };

    var goBtn = document.getElementById('vor-go');
    if (goBtn) goBtn.onclick = function(){
      var lloyd = Number(lloydSlider.value);
      var strategy = document.getElementById('vor-strategy').value;
      var prefix = document.getElementById('vor-prefix').value || 'V';
      _modal.style.display = 'none';
      generateFromSeeds({ lloyd: lloyd, strategy: strategy, nameBase: prefix });
    };
  }

  // expose
  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.voronoi = {
    EPS: EPS,
    boundsToPolygon: boundsToPolygon,
    clipPolygonByHalfplane: clipPolygonByHalfplane,
    computeCells: computeCells,
    lloydsRelaxation: lloydsRelaxation,
    randomSeeds: randomSeeds,
    poissonSeeds: poissonSeeds,
    startInteractive: startInteractive,
    addSeed: addSeed,
    clearSeeds: clearSeeds,
    exitInteractive: exitInteractive,
    generateFromSeeds: generateFromSeeds,
    renderPreview: renderPreview,
    openModal: openModal
  };

})(typeof window !== 'undefined' ? window : this);
