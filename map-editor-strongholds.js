// map-editor-strongholds.js
// 要塞点·关/堡/城/烽火/港/寺·tier 1-3·defenseValue
// 工具 'stronghold'·click 空地 → 放新点·click 现 → 选中·drag 移动·Delete 删
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[strongholds] core not loaded'); return; }

  var SNAP_PX = 14;       // 屏幕 px·hover/select 半径
  var DRAG_THRESHOLD = 3; // 屏幕 px·拖拽起阈

  // type → { label, color, glyph (单 unicode·当 icon)·tierBase·tierStep }
  var TYPES = {
    pass:       { label: '关',   color: '#d4a017', glyph: '关' },
    fortress:   { label: '堡',   color: '#a87850', glyph: '堡' },
    walledCity: { label: '城',   color: '#9a3a30', glyph: '城' },
    beacon:     { label: '烽',   color: '#dc4f3a', glyph: '烽' },
    port:       { label: '港',   color: '#5a8aae', glyph: '港' },
    temple:     { label: '寺',   color: '#6a7a3a', glyph: '寺' }
  };

  function pxToWorld(px){ return px / (ME.EDITOR.camera.zoom || 1); }

  function nextId(map){
    map._strongSeq = (map._strongSeq || 0) + 1;
    return 's_' + map._strongSeq.toString(36);
  }

  function createStronghold(opts){
    opts = opts || {};
    return {
      id: opts.id || null,
      name: opts.name || '未名要塞',
      x: opts.x || 0,
      y: opts.y || 0,
      type: opts.type || 'fortress',
      tier: opts.tier || 1,             // 1·小  2·中  3·大
      defenseValue: opts.defenseValue || 100,
      garrisonInit: opts.garrisonInit || 0,
      period: opts.period || '',
      source: opts.source || '',
      notes: opts.notes || ''
    };
  }

  function add(map, s){
    if (!s.id) s.id = nextId(map);
    map.strongholds = map.strongholds || [];
    map.strongholds.push(s);
    return s;
  }
  function remove(map, id){
    if (!map.strongholds) return false;
    var i = map.strongholds.findIndex(function(s){ return s.id === id; });
    if (i < 0) return false;
    map.strongholds.splice(i, 1);
    return true;
  }
  function findById(map, id){
    return (map.strongholds || []).find(function(s){ return s.id === id; }) || null;
  }

  function findAt(map, wx, wy, snapPx){
    snapPx = snapPx == null ? SNAP_PX : snapPx;
    var dW = pxToWorld(snapPx);
    var bestId = null, bestD = dW * dW;
    (map.strongholds || []).forEach(function(s){
      var dx = s.x - wx, dy = s.y - wy;
      var d2 = dx*dx + dy*dy;
      if (d2 < bestD){ bestD = d2; bestId = s.id; }
    });
    return bestId;
  }

  function move(map, id, x, y){
    var s = findById(map, id);
    if (!s) return false;
    s.x = x; s.y = y;
    return true;
  }

  // ─── tool callbacks ──────────────────────────────────────

  function onMouseDown(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'stronghold') return false;
    if (e.button !== 0) return false;

    var hitId = findAt(EDITOR.map, wx, wy);
    if (hitId){
      EDITOR.selectedFeature = { kind: 'stronghold', id: hitId };
      ME.fire('feature-select', EDITOR.selectedFeature);
      EDITOR._strongDrag = { id: hitId, startX: wx, startY: wy, moved: false };
      ME.requestRender();
      return true;
    }

    // 空地·放新点
    var defaultType = EDITOR._strongDefaultType || 'fortress';
    var newS;
    ME.commitMutation('要塞·放点', function(){
      newS = createStronghold({ x: wx, y: wy, type: defaultType });
      add(EDITOR.map, newS);
    });
    EDITOR.selectedFeature = { kind: 'stronghold', id: newS.id };
    ME.fire('feature-select', EDITOR.selectedFeature);
    var statusEl = document.getElementById('status-tip');
    if (statusEl) statusEl.textContent = '已放·' + (TYPES[defaultType] || {}).label + '·' + newS.name;
    ME.requestRender();
    return true;
  }

  function onMouseMove(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'stronghold') return false;
    if (EDITOR._strongDrag){
      var d = EDITOR._strongDrag;
      var dx = wx - d.startX, dy = wy - d.startY;
      var dThresh = pxToWorld(DRAG_THRESHOLD);
      if (!d.moved && dx*dx + dy*dy < dThresh*dThresh) return false;
      d.moved = true;
      move(EDITOR.map, d.id, wx, wy);
      EDITOR.dirty = true;
      ME.requestRender();
      return true;
    }
    return false;
  }

  function onMouseUp(wx, wy, e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'stronghold') return false;
    if (EDITOR._strongDrag){
      if (EDITOR._strongDrag.moved){
        ME.fire('mutation', { label: '要塞·move' });
      }
      EDITOR._strongDrag = null;
      return true;
    }
    return false;
  }

  function onKeyDown(e){
    var EDITOR = ME.EDITOR;
    if (EDITOR.activeTool !== 'stronghold') return false;
    if (e.key === 'Escape'){
      if (EDITOR.selectedFeature){
        EDITOR.selectedFeature = null;
        ME.fire('feature-select', null);
        ME.requestRender();
        return true;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace'){
      if (EDITOR.selectedFeature && EDITOR.selectedFeature.kind === 'stronghold'){
        if (confirm('删此要塞?')){
          var id = EDITOR.selectedFeature.id;
          ME.commitMutation('要塞·删', function(){ remove(EDITOR.map, id); });
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
    if (!ME.EDITOR.layers.strongholds) return;
    if (!map.strongholds || !map.strongholds.length) return;
    var z = camera.zoom;

    map.strongholds.forEach(function(s){
      var t = TYPES[s.type] || TYPES.fortress;
      var r = (10 + s.tier * 3) / z;  // 半径 (世界单位)·tier 1=13 2=16 3=19 px@zoom1

      // 阴影
      ctx.beginPath();
      ctx.arc(s.x + 1 / z, s.y + 2 / z, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // 主圆
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.lineWidth = 1.5 / z;
      ctx.strokeStyle = '#1a1a1f';
      ctx.stroke();

      // tier ring·tier ≥ 2 加外环·≥ 3 加内环
      if (s.tier >= 2){
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + 2 / z, 0, Math.PI * 2);
        ctx.lineWidth = 1.5 / z;
        ctx.strokeStyle = '#d9b566';
        ctx.stroke();
      }
      if (s.tier >= 3){
        ctx.beginPath();
        ctx.arc(s.x, s.y, r - 3 / z, 0, Math.PI * 2);
        ctx.lineWidth = 1 / z;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.stroke();
      }

      // glyph 字
      var fontSize = (12 + s.tier * 1.5) / z;
      ctx.font = fontSize + 'px "Noto Serif SC",serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.glyph, s.x, s.y);

      // 选中·金圈
      var sel = ME.EDITOR.selectedFeature;
      if (sel && sel.kind === 'stronghold' && sel.id === s.id){
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + 5 / z, 0, Math.PI * 2);
        ctx.lineWidth = 2 / z;
        ctx.strokeStyle = '#d9b566';
        ctx.stroke();
      }

      // 名·下方·若 label 层开
      if (ME.EDITOR.layers.label && s.name){
        var ny = s.y + r + 8 / z;
        ctx.font = (10 / z) + 'px "Noto Serif SC",serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#0f0f12';
        ctx.lineWidth = 3 / z;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.strokeText(s.name, s.x, ny);
        ctx.fillText(s.name, s.x, ny);
      }
    });
  }

  // ─── expose ─────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.strongholds = {
    TYPES: TYPES,
    create: createStronghold,
    add: add,
    remove: remove,
    findById: findById,
    findAt: findAt,
    move: move,
    onMouseDown: onMouseDown,
    onMouseMove: onMouseMove,
    onMouseUp: onMouseUp,
    onKeyDown: onKeyDown,
    renderLayer: renderLayer,
    setDefaultType: function(t){ ME.EDITOR._strongDefaultType = t; }
  };

})(typeof window !== 'undefined' ? window : this);
