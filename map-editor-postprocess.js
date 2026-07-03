// map-editor-postprocess.js
// 几何后处理·借鉴 SGGameEditor
//   DrawProvinceRemoveEnclavesAndIrregular
//   ProvinceEnclaveMaxOrthoComponentPixels
//   ProvinceIrregularBoundaryChance
//   DrawProvinceIrregularBoundary
//   IsAxisAlignedStraightProvinceEdge
//
// 1. cleanupSmallExtras·清飞地·按 area threshold
// 2. cleanupSmallHoles·清小洞·同上
// 3. irregularizeBorders·subdivide + 概率扰直边
// 4. detectAxisAlignedEdges·标 axis-aligned 边·便 user audit
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[postprocess] core not loaded'); return; }

  // ─── ① 飞地清理·按 area ─────────────────────────────────

  function polyArea(poly){
    if (!poly || poly.length < 3) return 0;
    var a = 0;
    for (var i = 0; i < poly.length; i++){
      var j = (i + 1) % poly.length;
      a += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
    }
    return Math.abs(a) / 2;
  }

  // opts: { extraThreshold, holeThreshold, divIds (限选区·null=全部) }
  function cleanupSmallExtras(opts){
    opts = opts || {};
    var extraThr = opts.extraThreshold != null ? opts.extraThreshold : 200;  // px²
    var holeThr  = opts.holeThreshold  != null ? opts.holeThreshold  : 100;
    var map = ME.EDITOR.map;
    var divIds = opts.divIds;
    var TP = global.TM && TM.MapEditor.topology;
    var topoOn = TP && TP.isEnabled();

    var cleaned = { extras: 0, holes: 0, divs: 0 };
    ME.commitMutation('清小飞地·' + extraThr + ' / 洞·' + holeThr, function(){
      map.divisions.forEach(function(d){
        if (divIds && divIds.indexOf(d.id) < 0) return;
        var hadChange = false;

        // extraPolygons
        if (d.extraPolygons && d.extraPolygons.length){
          var keepIdx = [];
          d.extraPolygons.forEach(function(p, i){
            if (polyArea(p) >= extraThr) keepIdx.push(i);
            else { cleaned.extras++; hadChange = true; }
          });
          d.extraPolygons = keepIdx.map(function(i){ return d.extraPolygons[i]; });
          if (d.extraPolygonsVids){
            d.extraPolygonsVids = keepIdx.map(function(i){ return d.extraPolygonsVids[i]; });
          }
        }

        // holes
        if (d.holes && d.holes.length){
          var keepH = [];
          d.holes.forEach(function(h, i){
            if (polyArea(h) >= holeThr) keepH.push(i);
            else { cleaned.holes++; hadChange = true; }
          });
          d.holes = keepH.map(function(i){ return d.holes[i]; });
          if (d.holesVids){
            d.holesVids = keepH.map(function(i){ return d.holesVids[i]; });
          }
        }

        if (hadChange){
          ME.recomputeDerived(d);
          if (topoOn){
            TP.removeDivisionFromTopology(d.id);
            TP.syncDivisionToTopology(map, d);
          }
          cleaned.divs++;
        }
      });
    });
    return cleaned;
  }

  // ─── ② IrregularBoundary·subdivide + 扰 ─────────────────

  // axis-aligned·两顶点 dx·dy 之一接近 0·或 |dx-dy|/sum < tol
  function isAxisAligned(a, b, tol){
    tol = tol == null ? 0.05 : tol;
    var dx = Math.abs(b[0] - a[0]);
    var dy = Math.abs(b[1] - a[1]);
    if (dx + dy < 1e-6) return false;
    return Math.min(dx, dy) / (dx + dy) < tol;
  }

  function detectAxisAlignedEdges(opts){
    opts = opts || {};
    var tol = opts.tol != null ? opts.tol : 0.05;
    var map = ME.EDITOR.map;
    var totalEdges = 0, axisCount = 0;
    map.divisions.forEach(function(d){
      var poly = d.polygon || [];
      for (var i = 0; i < poly.length; i++){
        totalEdges++;
        var a = poly[i], b = poly[(i + 1) % poly.length];
        if (isAxisAligned(a, b, tol)) axisCount++;
      }
    });
    return { totalEdges: totalEdges, axisCount: axisCount, ratio: totalEdges ? axisCount / totalEdges : 0 };
  }

  // 沿 a→b·插 n 个 mid·orthogonal 扰 ±maxOffset·只动 axis-aligned 或 chance 选中边
  function perturbEdge(a, b, n, maxOffset, rng){
    var ax = a[0], ay = a[1], bx = b[0], by = b[1];
    var dx = bx - ax, dy = by - ay;
    var len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1e-6) return [];
    // 单位法向 (左手·正交)
    var nx = -dy / len, ny = dx / len;
    var mids = [];
    for (var i = 1; i <= n; i++){
      var t = i / (n + 1);
      var mx = ax + dx * t, my = ay + dy * t;
      var off = (rng() * 2 - 1) * maxOffset;
      mids.push([mx + nx * off, my + ny * off]);
    }
    return mids;
  }

  // opts: { chance (0-1·每边扰概率), subdivisions (每边插点数 1-3), maxOffset (世界 px),
  //         onlyAxisAligned·限 axis 直边·divIds·限范围 }
  function irregularizeBorders(opts){
    opts = opts || {};
    var chance = opts.chance != null ? opts.chance : 0.4;
    var subdiv = opts.subdivisions != null ? opts.subdivisions : 1;
    var maxOffset = opts.maxOffset != null ? opts.maxOffset : 6;
    var onlyAxis = !!opts.onlyAxisAligned;
    var divIds = opts.divIds;
    var seed = opts.seed != null ? opts.seed : Date.now();

    var rng = mulberry32(seed);
    var map = ME.EDITOR.map;
    var TP = global.TM && TM.MapEditor.topology;
    var topoOn = TP && TP.isEnabled();
    if (topoOn){
      // 拓扑模式·共享 vertex 直接动会破坏·改·先 disable·扰·再 migrate
      // 简化·建议 user 先手动退出 topology·此处直接 abort 提示
      if (!confirm('当前 topology 模式启用·扰边将破坏共享顶点·建议先退出 topology·继续?')) return null;
    }

    var stat = { divs: 0, edges: 0, perturbed: 0, vertsAdded: 0 };
    ME.commitMutation('irregularize·扰 ' + Math.round(chance*100) + '% 边', function(){
      map.divisions.forEach(function(d){
        if (divIds && divIds.indexOf(d.id) < 0) return;
        var changed = false;
        d.polygon = perturbRing(d.polygon);
        if (d.extraPolygons){
          d.extraPolygons = d.extraPolygons.map(perturbRing);
        }
        // hole 不扰·避免破洞
        if (changed){
          ME.recomputeDerived(d);
          if (topoOn){
            TP.removeDivisionFromTopology(d.id);
            TP.syncDivisionToTopology(map, d);
          }
          stat.divs++;
        }
      });

      function perturbRing(ring){
        if (!ring || ring.length < 3) return ring;
        var newRing = [];
        for (var i = 0; i < ring.length; i++){
          var a = ring[i], b = ring[(i + 1) % ring.length];
          newRing.push([a[0], a[1]]);
          stat.edges++;
          if (onlyAxis && !isAxisAligned(a, b)) continue;
          if (rng() > chance) continue;
          var mids = perturbEdge(a, b, subdiv, maxOffset, rng);
          if (mids.length){
            for (var k = 0; k < mids.length; k++) newRing.push(mids[k]);
            stat.perturbed++;
            stat.vertsAdded += mids.length;
            changed = true;
          }
        }
        return newRing;
      }
    });
    return stat;
  }

  // ─── seedable RNG·避免每次结果不同 ──────────────────────

  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ════════════════════════════════════════════════════════════════
  // ② phase 20.1·fractal 扰边·mid-point displacement·多 octave
  // ════════════════════════════════════════════════════════════════
  //
  // 真自然海岸·替简 random·multi-octave·每 level 衰减
  //   octaves=3·每边 7 中点·octaves=4·15 中点
  //   roughness 0.5·H=1·standard brownian·更平滑用 0.6+
  //
  // 单边·a→b·递归 mid-point displace·返回 a/b 之间的中点串
  function fractalSubdivideEdge(a, b, octaves, initialOffset, roughness, rng){
    if (octaves <= 0) return [];
    var pts = [a.slice(), b.slice()];
    var off = initialOffset;
    for (var lvl = 0; lvl < octaves; lvl++){
      var newPts = [pts[0]];
      for (var i = 0; i < pts.length - 1; i++){
        var p = pts[i], q = pts[i + 1];
        var dx = q[0] - p[0], dy = q[1] - p[1];
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5){
          newPts.push(q);
          continue;
        }
        var nx = -dy / len, ny = dx / len;
        var mx = (p[0] + q[0]) / 2;
        var my = (p[1] + q[1]) / 2;
        var disp = (rng() * 2 - 1) * off;
        newPts.push([mx + nx * disp, my + ny * disp]);
        newPts.push(q);
      }
      pts = newPts;
      off *= roughness;
    }
    return pts.slice(1, -1);
  }

  // opts: { octaves (default 3), initialOffset (px·default 8), roughness (default 0.55),
  //         minEdgeLen (default 6·短边跳过), divIds, seed }
  function fractalIrregularize(opts){
    opts = opts || {};
    var octaves = opts.octaves != null ? opts.octaves : 3;
    var initOff = opts.initialOffset != null ? opts.initialOffset : 8;
    var roughness = opts.roughness != null ? opts.roughness : 0.55;
    var minLen = opts.minEdgeLen != null ? opts.minEdgeLen : 6;
    var divIds = opts.divIds;
    var seed = opts.seed != null ? opts.seed : Date.now();

    var rng = mulberry32(seed);
    var map = ME.EDITOR.map;
    var TP = global.TM && TM.MapEditor.topology;
    var topoOn = TP && TP.isEnabled();
    if (topoOn){
      if (!confirm('当前 topology 模式启用·fractal 扰边将破坏共享顶点·建议先退出·继续?')) return null;
    }

    var stat = { divs: 0, edges: 0, perturbed: 0, vertsAdded: 0 };

    function fractalRing(ring){
      if (!ring || ring.length < 3) return ring;
      var newRing = [];
      for (var i = 0; i < ring.length; i++){
        var a = ring[i], b = ring[(i + 1) % ring.length];
        newRing.push([a[0], a[1]]);
        stat.edges++;
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < minLen) continue;
        // 初始 offset 随边长 scale·短边小扰·长边大扰
        var off = Math.min(initOff, len * 0.25);
        var mids = fractalSubdivideEdge(a, b, octaves, off, roughness, rng);
        if (mids.length){
          for (var k = 0; k < mids.length; k++) newRing.push(mids[k]);
          stat.perturbed++;
          stat.vertsAdded += mids.length;
        }
      }
      return newRing;
    }

    ME.commitMutation('fractal 扰边·' + octaves + ' octave', function(){
      map.divisions.forEach(function(d){
        if (divIds && divIds.indexOf(d.id) < 0) return;
        d.polygon = fractalRing(d.polygon);
        if (d.extraPolygons){
          d.extraPolygons = d.extraPolygons.map(fractalRing);
        }
        // hole 不扰
        ME.recomputeDerived(d);
        if (topoOn){
          TP.removeDivisionFromTopology(d.id);
          TP.syncDivisionToTopology(map, d);
        }
        stat.divs++;
      });
    });
    return stat;
  }

  // ─── ③ modal ───────────────────────────────────────────

  var _modal = null;
  function openModal(){
    if (!_modal){
      _modal = document.createElement('div');
      _modal.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:9999; background:#1a1a1f; border:1px solid #3a3530; border-radius:6px; padding:14px 18px; min-width:380px; color:#e8ddc8; font-family:inherit; box-shadow:0 8px 30px rgba(0,0,0,0.6); display:none;';
      document.body.appendChild(_modal);
    }

    var stat = detectAxisAlignedEdges();
    _modal.innerHTML = '\
      <div style="font-size:14px; color:#c9a96e; margin-bottom:10px;">几何后处理·SG 风</div>\
      <div style="font-size:11px; color:#6a6560; margin-bottom:14px;">\
        当前·' + stat.totalEdges + ' 边·其中 axis-aligned ' + stat.axisCount +
        ' (' + Math.round(stat.ratio * 100) + '%)\
      </div>\
      \
      <div style="border:1px solid #3a3530; border-radius:4px; padding:10px; margin-bottom:10px;">\
        <div style="color:#c9a96e; margin-bottom:6px;">飞地/小洞 清理</div>\
        <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px; align-items:center; font-size:11px;">\
          <span>飞地阈 (px²)</span><input id="pp-extraThr" type="number" value="200" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;" />\
          <span>圈阈 (px²)</span><input id="pp-holeThr" type="number" value="100" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;" />\
        </div>\
        <button class="me-btn" id="pp-cleanup" style="margin-top:8px;">清</button>\
      </div>\
      \
      <div style="border:1px solid #3a3530; border-radius:4px; padding:10px; margin-bottom:10px;">\
        <div style="color:#c9a96e; margin-bottom:6px;">扰直边 (irregularize)</div>\
        <div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px; align-items:center; font-size:11px;">\
          <span>每边概率</span><input id="pp-chance" type="range" min="0" max="100" value="40" style="accent-color:#d9b566;" />\
          <span>每边插点</span><select id="pp-subdiv" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select>\
          <span>最大扰幅 (px)</span><input id="pp-maxOff" type="number" value="6" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;" />\
          <span>仅 axis-aligned</span><input id="pp-onlyAxis" type="checkbox" />\
        </div>\
        <button class="me-btn" id="pp-irreg" style="margin-top:8px;">扰</button>\
      </div>\
      \
      <div style="display:flex; justify-content:flex-end;">\
        <button class="me-btn" id="pp-close">关闭</button>\
      </div>\
    ';
    _modal.style.display = 'block';

    document.getElementById('pp-close').onclick = function(){ _modal.style.display = 'none'; };
    document.getElementById('pp-cleanup').onclick = function(){
      var ex = Number(document.getElementById('pp-extraThr').value) || 0;
      var ho = Number(document.getElementById('pp-holeThr').value) || 0;
      var r = cleanupSmallExtras({ extraThreshold: ex, holeThreshold: ho });
      var statusEl = document.getElementById('status-tip');
      if (statusEl) statusEl.textContent = '清·' + r.divs + ' div·飞地 ' + r.extras + '·圈 ' + r.holes;
      ME.requestRender();
    };
    document.getElementById('pp-irreg').onclick = function(){
      var chance = Number(document.getElementById('pp-chance').value) / 100;
      var sd = Number(document.getElementById('pp-subdiv').value);
      var off = Number(document.getElementById('pp-maxOff').value);
      var onlyAxis = document.getElementById('pp-onlyAxis').checked;
      var r = irregularizeBorders({ chance: chance, subdivisions: sd, maxOffset: off, onlyAxisAligned: onlyAxis });
      if (!r) return;
      var statusEl = document.getElementById('status-tip');
      if (statusEl) statusEl.textContent = '扰·' + r.divs + ' div·边 ' + r.edges + '·扰 ' + r.perturbed + '·添 ' + r.vertsAdded + ' 顶';
      ME.requestRender();
    };
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.postprocess = {
    polyArea: polyArea,
    cleanupSmallExtras: cleanupSmallExtras,
    irregularizeBorders: irregularizeBorders,
    fractalIrregularize: fractalIrregularize,
    fractalSubdivideEdge: fractalSubdivideEdge,
    detectAxisAlignedEdges: detectAxisAlignedEdges,
    isAxisAligned: isAxisAligned,
    openModal: openModal
  };

})(typeof window !== 'undefined' ? window : this);
