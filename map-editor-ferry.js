// map-editor-ferry.js
// 渡口·借鉴 SGGameEditor TabFerryEdit·ComputeAndSaveFerries·DrawFerryLineAndPoints
//
// schema·添到 map·
//   map.ferries = [{ id, name, p1, p2, areaA, areaB, capacity, period, source, notes }]
//
// 同步·每 ferry 自动建/更 areaLinks 中 linkType='ferry' 的 link
//
// 工具 'ferry'·click 1·定 P1·click 2·定 P2·自动归属 area·ENT 提交
// 自动检测·对距 ≤ D 但非陆邻的 div 对·建议 ferry 候选 (modal)
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[ferry] core not loaded'); return; }

  var DEFAULT_AUTO_DIST = 80;     // 世界 px·两 div centroid 距 ≤ 此·候选
  var SNAP_PX = 14;                // 屏幕 px·hover/select 半径
  var DRAG_THRESHOLD = 3;

  // ─── factory ─────────────────────────────────────────────

  function nextId(map){
    map._ferrySeq = (map._ferrySeq || 0) + 1;
    return 'fy_' + map._ferrySeq.toString(36);
  }

  function create(opts){
    opts = opts || {};
    return {
      id: opts.id || null,
      name: opts.name || '渡口',
      p1: opts.p1 || [0, 0],
      p2: opts.p2 || [0, 0],
      areaA: opts.areaA || null,
      areaB: opts.areaB || null,
      capacity: opts.capacity || 0,
      period: opts.period || '',
      source: opts.source || '',
      notes: opts.notes || ''
    };
  }

  function add(map, f){
    if (!f.id) f.id = nextId(map);
    map.ferries = map.ferries || [];
    map.ferries.push(f);
    syncToAreaLinks(map, f);
    return f;
  }

  function remove(map, id){
    if (!map.ferries) return false;
    var i = map.ferries.findIndex(function(f){ return f.id === id; });
    if (i < 0) return false;
    var f = map.ferries[i];
    map.ferries.splice(i, 1);
    // 同步·若此 link 仅由此 ferry 支撑·改 link 回 land 或删
    if (f.areaA && f.areaB){
      var stillAny = (map.ferries || []).some(function(other){
        return (other.areaA === f.areaA && other.areaB === f.areaB) ||
               (other.areaA === f.areaB && other.areaB === f.areaA);
      });
      if (!stillAny && TM.MapEditor.arealinks){
        TM.MapEditor.arealinks.setLinkType(map, f.areaA, f.areaB, 'land');
      }
    }
    return true;
  }

  function findById(map, id){
    return (map.ferries || []).find(function(f){ return f.id === id; }) || null;
  }

  function syncToAreaLinks(map, f){
    if (!f.areaA || !f.areaB) return;
    if (!TM.MapEditor.arealinks) return;
    var AL = TM.MapEditor.arealinks;
    var existing = AL.findLink(map, f.areaA, f.areaB);
    if (existing){
      existing.linkType = 'ferry';
    } else {
      AL.addLink(map, f.areaA, f.areaB, 'ferry');
    }
  }

  // ─── 归属·点 → division (含飞地) ────────────────────────

  function attributeToArea(map, x, y){
    var divs = map.divisions;
    for (var i = 0; i < divs.length; i++){
      var d = divs[i];
      if (ME.pointInDivision && ME.pointInDivision(d, x, y)) return d.id;
    }
    // 无 hit·按最近 centroid (回退)
    var bestId = null, bestD2 = Infinity;
    divs.forEach(function(d){
      if (!d.centroid) return;
      var dx = d.centroid[0] - x, dy = d.centroid[1] - y;
      var d2 = dx*dx + dy*dy;
      if (d2 < bestD2){ bestD2 = d2; bestId = d.id; }
    });
    return bestId;
  }

  // ─── tool callbacks ──────────────────────────────────────

  function onMouseDown(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'ferry') return false;
    if (e.button !== 0) return false;

    // 检 click 中现 ferry·选/拖
    var hit = findFerryAt(EDITOR.map, wx, wy);
    if (hit){
      EDITOR.selectedFeature = { kind: 'ferry', id: hit.id };
      ME.fire('feature-select', EDITOR.selectedFeature);
      EDITOR._ferryDrag = { id: hit.id, end: hit.end, startX: wx, startY: wy, moved: false };
      ME.requestRender();
      return true;
    }

    // pen·若 _ferryPen 存·此 = P2·提交
    if (EDITOR._ferryPen){
      var p1 = EDITOR._ferryPen;
      var p2 = [wx, wy];
      var areaA = attributeToArea(EDITOR.map, p1[0], p1[1]);
      var areaB = attributeToArea(EDITOR.map, p2[0], p2[1]);
      if (areaA === areaB){
        if (!confirm('两端归同一 division·确认建渡口? (通常异 div)')){
          EDITOR._ferryPen = null;
          ME.requestRender();
          return true;
        }
      }
      var newF;
      ME.commitMutation('渡口·新建', function(){
        newF = create({ p1: p1, p2: p2, areaA: areaA, areaB: areaB });
        add(EDITOR.map, newF);
      });
      EDITOR._ferryPen = null;
      EDITOR.selectedFeature = { kind: 'ferry', id: newF.id };
      ME.fire('feature-select', EDITOR.selectedFeature);
      var statusEl = document.getElementById('status-tip');
      if (statusEl) statusEl.textContent = '新渡口·' + newF.name + '·' + (areaA||'?') + ' ↔ ' + (areaB||'?');
      ME.requestRender();
      return true;
    }

    // 第一点
    EDITOR._ferryPen = [wx, wy];
    EDITOR.selectedFeature = null;
    ME.fire('feature-select', null);
    var statusEl2 = document.getElementById('status-tip');
    if (statusEl2) statusEl2.textContent = '渡口·P1 已定·click 第二点定 P2';
    ME.requestRender();
    return true;
  }

  function onMouseMove(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'ferry') return false;
    EDITOR.mouse.worldX = wx; EDITOR.mouse.worldY = wy;
    if (EDITOR._ferryDrag){
      var d = EDITOR._ferryDrag;
      var f = findById(EDITOR.map, d.id);
      if (!f) return false;
      var dx = wx - d.startX, dy = wy - d.startY;
      var thresh = DRAG_THRESHOLD / (EDITOR.camera.zoom || 1);
      if (!d.moved && dx*dx + dy*dy < thresh*thresh) return false;
      d.moved = true;
      if (d.end === 1){ f.p1 = [wx, wy]; }
      else if (d.end === 2){ f.p2 = [wx, wy]; }
      EDITOR.dirty = true;
      ME.requestRender();
      return true;
    }
    if (EDITOR._ferryPen) ME.requestRender();
    return false;
  }

  function onMouseUp(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'ferry') return false;
    if (EDITOR._ferryDrag){
      var d = EDITOR._ferryDrag;
      var f = findById(EDITOR.map, d.id);
      if (f && d.moved){
        // 端点移动后·重 attribute area
        f.areaA = attributeToArea(EDITOR.map, f.p1[0], f.p1[1]);
        f.areaB = attributeToArea(EDITOR.map, f.p2[0], f.p2[1]);
        syncToAreaLinks(EDITOR.map, f);
        ME.fire('mutation', { label: '渡口·移端' });
      }
      EDITOR._ferryDrag = null;
      return true;
    }
    return false;
  }

  function onKeyDown(e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'ferry') return false;
    if (e.key === 'Escape'){
      if (EDITOR._ferryPen){ EDITOR._ferryPen = null; ME.requestRender(); return true; }
      if (EDITOR.selectedFeature){ EDITOR.selectedFeature = null; ME.fire('feature-select', null); ME.requestRender(); return true; }
    }
    if (e.key === 'Delete' || e.key === 'Backspace'){
      if (EDITOR.selectedFeature && EDITOR.selectedFeature.kind === 'ferry'){
        if (confirm('删此渡口?')){
          var id = EDITOR.selectedFeature.id;
          ME.commitMutation('渡口·删', function(){ remove(EDITOR.map, id); });
          EDITOR.selectedFeature = null;
          ME.fire('feature-select', null);
          ME.requestRender();
          return true;
        }
      }
    }
    return false;
  }

  // ─── 找 ferry / 端点 hit ────────────────────────────────

  function findFerryAt(map, wx, wy){
    var snapW = SNAP_PX / (ME.EDITOR.camera.zoom || 1);
    var s2 = snapW * snapW;
    var best = null;
    (map.ferries || []).forEach(function(f){
      var d1 = (f.p1[0]-wx)*(f.p1[0]-wx) + (f.p1[1]-wy)*(f.p1[1]-wy);
      var d2 = (f.p2[0]-wx)*(f.p2[0]-wx) + (f.p2[1]-wy)*(f.p2[1]-wy);
      if (d1 < s2 && (!best || d1 < best._d)){ best = { id: f.id, end: 1, _d: d1 }; }
      if (d2 < s2 && (!best || d2 < best._d)){ best = { id: f.id, end: 2, _d: d2 }; }
    });
    return best;
  }

  // ─── 自动检测·候选 ferry ──────────────────────────────

  // 对 div 对·centroid 距 ≤ dist + 当前不是陆邻·建议
  // 选址·两 centroid 间中点·不一定准·user 后调
  function suggestCandidates(opts){
    opts = opts || {};
    var dist = opts.distance != null ? opts.distance : DEFAULT_AUTO_DIST;
    var map = ME.EDITOR.map;
    var d2max = dist * dist;
    var AL = TM.MapEditor.arealinks;
    var divs = map.divisions;

    var candidates = [];
    for (var i = 0; i < divs.length; i++){
      for (var j = i + 1; j < divs.length; j++){
        var a = divs[i], b = divs[j];
        if (!a.centroid || !b.centroid) continue;
        var dx = a.centroid[0] - b.centroid[0], dy = a.centroid[1] - b.centroid[1];
        var d2 = dx*dx + dy*dy;
        if (d2 > d2max) continue;
        // 已陆邻·跳
        var existing = AL ? AL.findLink(map, a.id, b.id) : null;
        if (existing && existing.linkType === 'land') continue;
        // 已 ferry·跳
        var hasFerry = (map.ferries || []).some(function(f){
          return (f.areaA === a.id && f.areaB === b.id) ||
                 (f.areaA === b.id && f.areaB === a.id);
        });
        if (hasFerry) continue;
        candidates.push({
          areaA: a.id, areaB: b.id,
          aName: a.name, bName: b.name,
          midX: (a.centroid[0] + b.centroid[0]) / 2,
          midY: (a.centroid[1] + b.centroid[1]) / 2,
          dist: Math.sqrt(d2),
          // 端点·从 a centroid 推 30% 朝 b·b centroid 推 30% 朝 a (近端)
          p1: [a.centroid[0] + (b.centroid[0] - a.centroid[0]) * 0.3,
               a.centroid[1] + (b.centroid[1] - a.centroid[1]) * 0.3],
          p2: [b.centroid[0] + (a.centroid[0] - b.centroid[0]) * 0.3,
               b.centroid[1] + (a.centroid[1] - b.centroid[1]) * 0.3]
        });
      }
    }
    candidates.sort(function(x, y){ return x.dist - y.dist; });
    return candidates;
  }

  function applyAllCandidates(candidates){
    var map = ME.EDITOR.map;
    var added = 0;
    ME.commitMutation('渡口·批量自动·' + candidates.length + ' 候选', function(){
      candidates.forEach(function(c){
        add(map, create({
          name: c.aName + '↔' + c.bName + '·渡',
          p1: c.p1, p2: c.p2,
          areaA: c.areaA, areaB: c.areaB
        }));
        added++;
      });
    });
    return added;
  }

  // ─── render ─────────────────────────────────────────────

  function renderLayer(ctx, camera){
    var EDITOR = ME.EDITOR;
    var map = EDITOR.map;
    if (!EDITOR.layers.ferries && EDITOR.activeTool !== 'ferry') return;
    if (!map.ferries || !map.ferries.length){
      // pen preview·无 ferries 也得画
      if (EDITOR._ferryPen) renderPenPreview(ctx, camera);
      return;
    }
    var z = camera.zoom;

    map.ferries.forEach(function(f){
      // 主线·dashed
      ctx.beginPath();
      ctx.moveTo(f.p1[0], f.p1[1]);
      ctx.lineTo(f.p2[0], f.p2[1]);
      ctx.lineWidth = 2 / z;
      ctx.strokeStyle = '#7ab8d8';
      ctx.setLineDash([8 / z, 4 / z]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 两端 anchor
      [f.p1, f.p2].forEach(function(p){
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5 / z, 0, Math.PI * 2);
        ctx.fillStyle = '#5a8aae';
        ctx.fill();
        ctx.lineWidth = 1.5 / z;
        ctx.strokeStyle = '#1a1a1f';
        ctx.stroke();
      });

      // 选中·高亮
      var sel = EDITOR.selectedFeature;
      if (sel && sel.kind === 'ferry' && sel.id === f.id){
        ctx.lineWidth = 4 / z;
        ctx.strokeStyle = 'rgba(217,181,102,0.5)';
        ctx.beginPath();
        ctx.moveTo(f.p1[0], f.p1[1]);
        ctx.lineTo(f.p2[0], f.p2[1]);
        ctx.stroke();
      }

      // 名·中点
      if (EDITOR.layers.label && f.name){
        var mx = (f.p1[0] + f.p2[0]) / 2;
        var my = (f.p1[1] + f.p2[1]) / 2;
        ctx.font = (10 / z) + 'px "Noto Serif SC",serif';
        ctx.fillStyle = '#7ab8d8';
        ctx.strokeStyle = '#0f0f12';
        ctx.lineWidth = 3 / z;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(f.name, mx, my - 8 / z);
        ctx.fillText(f.name, mx, my - 8 / z);
      }
    });

    // pen preview·若画到第二点
    if (EDITOR._ferryPen) renderPenPreview(ctx, camera);
  }

  function renderPenPreview(ctx, camera){
    var EDITOR = ME.EDITOR;
    var pen = EDITOR._ferryPen;
    if (!pen) return;
    var z = camera.zoom;
    var mx = EDITOR.mouse.worldX, my = EDITOR.mouse.worldY;
    if (mx == null) mx = pen[0] + 30, my = pen[1];

    ctx.beginPath();
    ctx.moveTo(pen[0], pen[1]);
    ctx.lineTo(mx, my);
    ctx.lineWidth = 2 / z;
    ctx.strokeStyle = 'rgba(122,184,216,0.6)';
    ctx.setLineDash([4 / z, 4 / z]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(pen[0], pen[1], 5 / z, 0, Math.PI * 2);
    ctx.fillStyle = '#7ab8d8';
    ctx.fill();
  }

  // ─── modal·自动检测候选 ───────────────────────────────

  var _modal = null;
  function openAutoModal(){
    if (!_modal){
      _modal = document.createElement('div');
      _modal.style.cssText = 'position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:9999; background:#1a1a1f; border:1px solid #3a3530; border-radius:6px; padding:14px 18px; min-width:420px; max-height:70vh; overflow:auto; color:#e8ddc8; font-family:inherit; box-shadow:0 8px 30px rgba(0,0,0,0.6); display:none;';
      document.body.appendChild(_modal);
    }
    refresh();
    _modal.style.display = 'block';

    function refresh(){
      var distance = Number((_modal.querySelector('#fr-dist') || {}).value) || DEFAULT_AUTO_DIST;
      var cands = suggestCandidates({ distance: distance });
      _modal.innerHTML =
        '<div style="font-size:14px; color:#c9a96e; margin-bottom:10px;">渡口候选·自动检测</div>' +
        '<div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">' +
          '<span style="font-size:11px; color:#6a6560;">距离阈 (px)</span>' +
          '<input id="fr-dist" type="number" value="' + distance + '" style="background:#26262d; border:1px solid #3a3530; color:#e8ddc8; padding:4px 8px; border-radius:3px; font-family:inherit;" />' +
          '<button class="me-btn" id="fr-refresh">刷新</button>' +
        '</div>' +
        '<div style="font-size:11px; color:#6a6560; margin-bottom:8px;">候选·' + cands.length + ' 对·按距升</div>' +
        (cands.length === 0 ? '<div style="color:#a8a098; padding:10px;">无候选·扩大距离阈或检 div</div>' :
          '<div style="max-height:40vh; overflow:auto; border:1px solid #3a3530; border-radius:3px;">' +
          cands.slice(0, 200).map(function(c, i){
            return '<div style="padding:6px 10px; border-bottom:1px solid #2a2a30; display:flex; justify-content:space-between; align-items:center; font-size:11px;">' +
              '<span>' + c.aName + ' ↔ ' + c.bName + ' <span style="color:#6a6560;">(' + c.dist.toFixed(0) + 'px)</span></span>' +
              '<button class="me-btn" data-i="' + i + '" style="font-size:10px;">建</button>' +
              '</div>';
          }).join('') +
          '</div>'
        ) +
        '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px;">' +
          '<button class="me-btn" id="fr-close">关闭</button>' +
          (cands.length > 0 ? '<button class="me-btn me-btn-warn" id="fr-all">全建 (' + cands.length + ')</button>' : '') +
        '</div>';

      _modal.querySelector('#fr-close').onclick = function(){ _modal.style.display = 'none'; };
      var refreshBtn = _modal.querySelector('#fr-refresh');
      if (refreshBtn) refreshBtn.onclick = refresh;
      var allBtn = _modal.querySelector('#fr-all');
      if (allBtn) allBtn.onclick = function(){
        if (!confirm('批量建 ' + cands.length + ' 渡口·端点近 centroid·后期可手调·确认?')) return;
        applyAllCandidates(cands);
        var statusEl = document.getElementById('status-tip');
        if (statusEl) statusEl.textContent = '渡口·批量建 ' + cands.length;
        refresh();
        ME.requestRender();
      };
      _modal.querySelectorAll('button[data-i]').forEach(function(b){
        b.onclick = function(){
          var i = Number(b.getAttribute('data-i'));
          var c = cands[i];
          if (!c) return;
          ME.commitMutation('渡口·' + c.aName + '↔' + c.bName, function(){
            add(ME.EDITOR.map, create({
              name: c.aName + '↔' + c.bName + '·渡',
              p1: c.p1, p2: c.p2,
              areaA: c.areaA, areaB: c.areaB
            }));
          });
          refresh();
          ME.requestRender();
        };
      });
    }
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.ferry = {
    create: create,
    add: add,
    remove: remove,
    findById: findById,
    findFerryAt: findFerryAt,
    suggestCandidates: suggestCandidates,
    applyAllCandidates: applyAllCandidates,
    onMouseDown: onMouseDown,
    onMouseMove: onMouseMove,
    onMouseUp: onMouseUp,
    onKeyDown: onKeyDown,
    renderLayer: renderLayer,
    openAutoModal: openAutoModal
  };

})(typeof window !== 'undefined' ? window : this);
