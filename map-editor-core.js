// map-editor-core.js
// 主 state model·canvas render loop·camera·event hub
// 加载顺序·dynasty.js → undo.js → core.js → tools.js → panel.js → io.js
// 2026-05-06

(function(global){
  'use strict';

  // ─── state model ────────────────────────────────────────────

  function createDivision(opts){
    opts = opts || {};
    var now = Date.now();
    return {
      // identity
      id: opts.id || ('div_' + now + '_' + Math.floor(Math.random()*9999)),
      name: opts.name || '未命名',
      level: opts.level || 'province',
      description: opts.description || '',
      officialPosition: opts.officialPosition || '',
      governor: opts.governor || '',
      dejureOwner: opts.dejureOwner || '',
      capitalChildId: opts.capitalChildId || '',
      regionType: opts.regionType || 'normal',
      sources: opts.sources || [],  // 历史考据·{title, author, juan, page, note, year?}
      crossDynastyId: opts.crossDynastyId || '',  // 跨朝代地点链接·atlas 同地异朝

      // geometry
      polygon: opts.polygon || [],     // [[x,y],...] in world coord·主 polygon (mainland) outer ring
      holes: opts.holes || [],         // 主 polygon 内的洞 (主圈)·array of polygons (inner rings)·非此省领土
      extraPolygons: opts.extraPolygons || [],  // 飞地·exclaves·array of outer rings
      // topology mode·shared vertex registry (phase 9)·若 map.topology.enabled·则下面 vid arrays 有效
      polygonVids: opts.polygonVids || null,
      extraPolygonsVids: opts.extraPolygonsVids || null,
      holesVids: opts.holesVids || null,
      centroid: opts.centroid || null,
      area: opts.area || 0,
      neighbors: opts.neighbors || [],
      bbox: opts.bbox || null,
      bitmap_color: opts.bitmap_color || '',
      colorKey: typeof opts.colorKey === 'number' ? opts.colorKey : null,  // phase 13·packed BGR·唯一·assignColorKeys 填
      z_order: opts.z_order || 0,
      treats_as: opts.treats_as || '实控',
      treaty_year: opts.treaty_year || null,

      // population (~12 sub fields)
      population: opts.population || 0,
      populationDetail: opts.populationDetail || {
        households: 0, mouths: 0, ding: 0, fugitives: 0, hiddenCount: 0
      },
      byAge: opts.byAge || null,
      byGender: opts.byGender || null,
      bySettlement: opts.bySettlement || null,
      byEthnicity: opts.byEthnicity || null,
      byFaith: opts.byFaith || null,
      baojia: opts.baojia || null,

      // economy & fiscal
      prosperity: typeof opts.prosperity === 'number' ? opts.prosperity : 50,
      taxLevel: opts.taxLevel || '中',   // 取值·'轻' | '中' | '重'·runtime tm-endturn-province.js:1186
      terrain: opts.terrain || '平原',
      specialResources: opts.specialResources || '',
      carryingCapacity: opts.carryingCapacity || null,
      fiscalDetail: opts.fiscalDetail || null,
      publicTreasuryInit: opts.publicTreasuryInit || null,

      // 区域属性 flag·runtime _peRenderTagBadges 读·门控 economyBase 多字段
      tags: opts.tags || {
        hasPort: false,         // 沿海港·gate maritimeTradeVolume / 市舶税
        saltRegion: false,      // 产盐·gate saltProduction / 盐课
        mineralRegion: false,   // 产矿·gate mineralProduction / 矿税
        horseRegion: false,     // 草场·gate horseProduction / 马征
        fishingRegion: false,   // 渔区·gate fishingProduction / 渔课
        imperialDomain: false   // 皇室直辖·解锁皇庄 / 织造 / 矿场 / 御窑
      },

      // 经济基础·runtime _peRenderEconomyBase / _peRenderRevenueBreakdown 读
      economyBase: opts.economyBase || {
        farmland: 0,                    // 在编田亩 (亩)
        commerceCoefficient: 1.0,       // 商业系数 1.0-2.0
        commerceVolume: 0,              // 商业体量 (两)
        maritimeTradeVolume: 0,         // 海贸量 (两)
        saltProduction: 0,              // 盐产 (斤/年)
        mineralProduction: 0,           // 矿产 (两/年)
        horseProduction: 0,             // 年产马匹
        fishingProduction: 0,           // 渔产 (两/年)
        imperialFarmland: 0,            // 皇庄亩数 (imperialDomain 才显示)
        imperialAssets: { zhizao: 0, kuangchang: 0, yuyao: 0 },  // 织造局 / 矿场 / 御窑·处数
        postRelays: 0,                  // 驿站数·驿递站银 = N × 200
        kejuQuota: 0,                   // 科举解额·教育常费 = N × 50
        roadQuality: 50,                // 道路质量 0-100·商旅/军调成本
        landsAnnexed: 0,                // 兼并田 (亩)
        landsReclaimed: 0,              // 开垦田 (亩)
        landsSurveyed: 0,               // 清丈结果 (亩)
        disasterRecord: []              // [{type:'drought|flood|plague|locust|earthquake|cold', severity:1-3, startTurn, note}]
      },

      // governance & autonomy
      minxinLocal: typeof opts.minxinLocal === 'number' ? opts.minxinLocal : 60,
      corruptionLocal: typeof opts.corruptionLocal === 'number' ? opts.corruptionLocal : 30,
      autonomy: opts.autonomy || { type: 'zhixia', subtype: '', holder: '', suzerain: '', loyalty: 80, tributeRate: 0 },
      permissions: opts.permissions || null,
      // Phase 25·势力归属·指 factions[].id·空时 fallback autonomy.type 上色
      factionId: opts.factionId || null,

      // history
      timeline: opts.timeline || [],
      establishedYear: opts.establishedYear || null,
      abolishedYear: opts.abolishedYear || null,
      renamedFrom: opts.renamedFrom || '',
      renamedTo: opts.renamedTo || '',

      // flags
      isCapital: !!opts.isCapital,
      isFrontier: !!opts.isFrontier,
      isDeposit: !!opts.isDeposit,
      isJunDi: !!opts.isJunDi,
      isTunTian: !!opts.isTunTian,
      isPiao: !!opts.isPiao,
      isTradePort: !!opts.isTradePort,
      isPilgrim: !!opts.isPilgrim,
      isHistoric: !!opts.isHistoric
    };
  }

  function createMapState(opts){
    opts = opts || {};
    var dynasty = opts.dynasty || (global.TM && TM.MapEditor.dynasty.DEFAULT_DYNASTY) || 'ming';
    return {
      version: 1,
      dynasty: dynasty,
      era: opts.era || '',
      title: opts.title || '未命名地图',
      bitmapUrl: opts.bitmapUrl || '',
      bitmapWidth: opts.bitmapWidth || 1280,
      bitmapHeight: opts.bitmapHeight || 800,
      // 底图变换·X 工具下可拖动 + 缩放·polygon 不受影响·{x,y} = 像素偏移·scale = 缩放系数
      bitmapTransform: opts.bitmapTransform || { x: 0, y: 0, scale: 1, rot: 0 },
      divisions: opts.divisions || [],
      annotations: opts.annotations || [],
      // topology·shared vertex registry (phase 9·default off)
      topology: opts.topology || { enabled: false, vertices: {}, usage: {}, nextVid: 1 },
      // 地理层 (phase 12)·非领土 overlay
      rivers: opts.rivers || [],
      roads: opts.roads || [],
      strongholds: opts.strongholds || [],
      // 邻接图持久化 (phase 13.1)·借鉴 SGGameEditor AreaLinkEntity
      areaLinks: opts.areaLinks || [],
      // raster 层 (phase 13.3)·heightMap·terrainMap·借鉴 SGGameEditor HeightMapEntity
      heightMap: opts.heightMap || null,
      terrainMap: opts.terrainMap || null,
      // 渡口 (phase 13.5)·借鉴 SGGameEditor FerryLink
      ferries: opts.ferries || [],
      // Phase 25·势力 (faction) 注册·[{id,name,color,...}]
      factions: opts.factions || [],
      meta: opts.meta || { author: '', notes: '', createdAt: Date.now() }
    };
  }

  // ─── editor state (runtime·非保存) ─────────────────────────

  var EDITOR = {
    // map data (will be cloned/restored by undo)
    map: createMapState(),

    // bitmap image element (loaded from bitmapUrl)
    bitmapImage: null,

    // canvas refs
    canvas: null,
    ctx: null,
    overlayCanvas: null,  // 用于工具 preview·不参与主 paint
    overlayCtx: null,

    // camera (world ↔ screen)
    camera: { x: 0, y: 0, zoom: 1, minZoom: 0.1, maxZoom: 10 },

    // tools
    activeTool: 'select',  // V/P/E/M/S/T/H/Z/A
    penPoints: [],          // 当前 pen 在画的顶点
    childDrawParentId: null, // 非空=子绘制模式·正在此父(省/路)地块内手动画下级(府/县)
    draggingVertex: null,   // { divId, vertexIdx } when E tool
    draggingMap: false,
    dragStart: null,        // { x, y, camX, camY }

    // selection
    selectedIds: [],        // 多选支持
    hoverId: null,

    // layers
    layers: { bitmap: true, polygon: true, label: true, heat: 'none', border: true, centroid: false, history: false, topology: false, rivers: true, roads: true, strongholds: true, areaLinks: false, heightMap: false, terrainMap: false, heightMapStyle: 'heatmap', ferries: true },

    // phase 12·选中的 feature·只能 1 类 1 个·与 division selectedIds 平行
    selectedFeature: null,  // { kind: 'river'|'road'|'stronghold', id }
    // 当前 feature pen 路径 (rivers/roads 工具用·点序列)
    featurePenPoints: [],

    // mouse
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0, buttons: 0 },

    // undo stack
    undo: null,             // 由 undo module init

    // dirty
    dirty: false,
    lastSavedAt: null,

    // settings
    snapToVertex: true,     // pen 时邻近顶点吸附
    snapDistance: 8,        // pixel
    minVerticesToClose: 3,  // pen 闭合最少顶点
    closingDistance: 12,    // pen click 第一点距离 ≤ 此则闭合

    // time / diff (phase 3)
    viewYear: null,         // 当前查看年份·null = no time mode
    diffMode: null,         // { yearA, yearB, report } when in diff mode

    // event listeners (bound·便于 detach)
    _listeners: []
  };

  // ─── coord conversion ──────────────────────────────────────

  function screenToWorld(sx, sy){
    return {
      x: (sx - EDITOR.camera.x) / EDITOR.camera.zoom,
      y: (sy - EDITOR.camera.y) / EDITOR.camera.zoom
    };
  }
  function worldToScreen(wx, wy){
    return {
      x: wx * EDITOR.camera.zoom + EDITOR.camera.x,
      y: wy * EDITOR.camera.zoom + EDITOR.camera.y
    };
  }

  // ─── geometry utility ──────────────────────────────────────

  function pointInPolygon(px, py, poly){
    var n = poly.length;
    if (n < 3) return false;
    var inside = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = poly[i][0], yi = poly[i][1];
      var xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 0.0001) + xi)){
        inside = !inside;
      }
    }
    return inside;
  }

  function polygonCentroid(poly){
    if (poly.length === 0) return null;
    var sx = 0, sy = 0, n = poly.length;
    for (var i = 0; i < n; i++){
      sx += poly[i][0];
      sy += poly[i][1];
    }
    return [sx / n, sy / n];
  }

  function polygonArea(poly){
    var n = poly.length;
    if (n < 3) return 0;
    var s = 0;
    for (var i = 0; i < n; i++){
      var j = (i + 1) % n;
      s += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
    }
    return Math.abs(s) / 2;
  }

  function polygonBBox(poly){
    if (poly.length === 0) return null;
    var minX = poly[0][0], minY = poly[0][1], maxX = minX, maxY = minY;
    for (var i = 1; i < poly.length; i++){
      var p = poly[i];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function recomputeDerived(div){
    // 主 polygon 优先·若有 extraPolygons·聚合 area / bbox·centroid 取主
    var allPolys = getAllPolygons(div);
    if (allPolys.length === 0){
      div.centroid = null;
      div.area = 0;
      div.bbox = null;
      return div;
    }
    // area·subtract holes
    var holeArea = 0;
    if (div.holes && div.holes.length){
      div.holes.forEach(function(h){
        if (h && h.length >= 3) holeArea += polygonArea(h);
      });
    }

    if (allPolys.length === 1){
      div.centroid = polygonCentroid(div.polygon);
      div.area = polygonArea(div.polygon) - holeArea;
      div.bbox = polygonBBox(div.polygon);
    } else {
      // multi-polygon·聚合 (holes 仅扣主)
      var totalArea = 0;
      var sumCx = 0, sumCy = 0;
      var unionBbox = null;
      allPolys.forEach(function(p, idx){
        if (p.length < 3) return;
        var a = polygonArea(p);
        if (idx === 0) a -= holeArea;  // 主 polygon 扣 hole area
        var c = polygonCentroid(p);
        var b = polygonBBox(p);
        totalArea += a;
        if (c){
          sumCx += c[0] * a;
          sumCy += c[1] * a;
        }
        if (b){
          if (!unionBbox){
            unionBbox = { x: b.x, y: b.y, w: b.w, h: b.h };
          } else {
            var x0 = Math.min(unionBbox.x, b.x);
            var y0 = Math.min(unionBbox.y, b.y);
            var x1 = Math.max(unionBbox.x + unionBbox.w, b.x + b.w);
            var y1 = Math.max(unionBbox.y + unionBbox.h, b.y + b.h);
            unionBbox.x = x0; unionBbox.y = y0;
            unionBbox.w = x1 - x0; unionBbox.h = y1 - y0;
          }
        }
      });
      div.area = totalArea;
      div.centroid = totalArea > 0 ? [sumCx / totalArea, sumCy / totalArea] : polygonCentroid(div.polygon);
      div.bbox = unionBbox;
    }
    return div;
  }

  // 返回 division 全部 polygons·主 + extra (不含 holes)
  function getAllPolygons(div){
    var arr = [];
    if (div.polygon && div.polygon.length >= 3) arr.push(div.polygon);
    if (div.extraPolygons && div.extraPolygons.length){
      div.extraPolygons.forEach(function(p){
        if (p && p.length >= 3) arr.push(p);
      });
    }
    return arr;
  }

  // 返回 division 全部 ring·outer + holes·E 工具用·拖任 ring 顶点
  // ring shape·{ kind: 'main'/'extra'/'hole', polyIdx, points }
  function getAllRings(div){
    var rings = [];
    if (div.polygon && div.polygon.length >= 3){
      rings.push({ kind: 'main', polyIdx: 0, points: div.polygon });
    }
    if (div.holes && div.holes.length){
      div.holes.forEach(function(h, i){
        if (h && h.length >= 3) rings.push({ kind: 'hole', polyIdx: i, points: h });
      });
    }
    if (div.extraPolygons && div.extraPolygons.length){
      div.extraPolygons.forEach(function(p, i){
        if (p && p.length >= 3) rings.push({ kind: 'extra', polyIdx: i, points: p });
      });
    }
    return rings;
  }

  // 点是否在 division 领土内·主 polygon 内 AND 不在任 hole 内·或在飞地内
  function pointInDivision(d, wx, wy){
    // bbox 预筛·点在包围盒外直接跳过 pointInPolygon(大地图 hover/拾取提速·bbox 由 recomputeDerived 算·含飞地)
    var _bb = d.bbox;
    if (_bb && (wx < _bb.x || wy < _bb.y || wx > _bb.x + _bb.w || wy > _bb.y + _bb.h)) return false;
    if (d.polygon && pointInPolygon(wx, wy, d.polygon)){
      // 检查 hole·若在 hole 内·不算领土
      if (d.holes && d.holes.length){
        for (var i = 0; i < d.holes.length; i++){
          if (pointInPolygon(wx, wy, d.holes[i])) return false;
        }
      }
      return true;
    }
    if (d.extraPolygons && d.extraPolygons.length){
      for (var j = 0; j < d.extraPolygons.length; j++){
        if (pointInPolygon(wx, wy, d.extraPolygons[j])) return true;
      }
    }
    return false;
  }

  // ─── division helpers ──────────────────────────────────────

  function findDivisionAt(wx, wy){
    // 优先用可见列表 (timeline-aware)·hover 不命中 hidden div
    var visible = EDITOR._visibleCache;
    if (visible){
      for (var i = visible.length - 1; i >= 0; i--){
        var v = visible[i];
        if (pointInDivision(v.base, wx, wy)) return v.base;
      }
      return null;
    }
    // fallback (renderer 还没跑过)
    var divs = EDITOR.map.divisions;
    for (var j = divs.length - 1; j >= 0; j--){
      var d = divs[j];
      if (pointInDivision(d, wx, wy)) return d;
    }
    return null;
  }

  function getSelected(){
    var arr = [];
    var ids = EDITOR.selectedIds;
    for (var i = 0; i < ids.length; i++){
      var d = EDITOR.map.divisions.find(function(D){ return D.id === ids[i]; });
      if (d) arr.push(d);
    }
    return arr;
  }

  function selectOne(id){
    EDITOR.selectedIds = id ? [id] : [];
    fire('selection-change');
  }

  function selectAdd(id){
    if (!id) return;
    if (EDITOR.selectedIds.indexOf(id) === -1){
      EDITOR.selectedIds.push(id);
      fire('selection-change');
    }
  }

  function selectClear(){
    if (EDITOR.selectedIds.length){
      EDITOR.selectedIds = [];
      fire('selection-change');
    }
  }

  // ─── mutation·都过此处·便于 snapshot ──────────────────────

  function commitMutation(label, fn){
    if (EDITOR.undo){
      TM.MapEditor.undo.snapshot(EDITOR.undo, EDITOR.map, label || 'edit');
    }
    fn();
    EDITOR.dirty = true;
    requestRender();
    fire('mutation', { label: label });
  }

  function addDivision(d){
    commitMutation('add division', function(){
      EDITOR.map.divisions.push(d);
      // topology·若启用·sync 此 new div 到 vertex registry
      if (global.TM && TM.MapEditor.topology && TM.MapEditor.topology.isEnabled()){
        TM.MapEditor.topology.syncDivisionToTopology(EDITOR.map, d);
      }
      // phase 13.1·若 colorKey 缺·分配
      if (global.TM && TM.MapEditor.arealinks && (typeof d.colorKey !== 'number')){
        TM.MapEditor.arealinks.assignColorKeys(EDITOR.map);
        TM.MapEditor.arealinks.buildColorKeyIndex(EDITOR.map);
      }
    });
  }

  function removeDivision(id){
    commitMutation('remove division', function(){
      // topology·清此 div 在 vertex registry 的 usage·GC orphan vertices
      if (global.TM && TM.MapEditor.topology && TM.MapEditor.topology.isEnabled()){
        TM.MapEditor.topology.removeDivisionFromTopology(id);
      }
      EDITOR.map.divisions = EDITOR.map.divisions.filter(function(D){ return D.id !== id; });
      EDITOR.selectedIds = EDITOR.selectedIds.filter(function(I){ return I !== id; });
      // phase 13.1·清此 div 涉及的 areaLinks
      if (EDITOR.map.areaLinks){
        EDITOR.map.areaLinks = EDITOR.map.areaLinks.filter(function(l){
          return l.areaA !== id && l.areaB !== id;
        });
      }
      if (global.TM && TM.MapEditor.arealinks){
        TM.MapEditor.arealinks.buildColorKeyIndex(EDITOR.map);
      }
      fire('division-removed', { id: id });
    });
  }

  function updateDivision(id, patch, label){
    commitMutation(label || 'update', function(){
      var d = EDITOR.map.divisions.find(function(D){ return D.id === id; });
      if (!d) return;
      Object.keys(patch).forEach(function(k){ d[k] = patch[k]; });
      if (patch.polygon) recomputeDerived(d);
    });
  }

  // ─── undo / redo ──────────────────────────────────────────

  function doUndo(){
    if (!EDITOR.undo) return;
    var prev = TM.MapEditor.undo.undo(EDITOR.undo, EDITOR.map);
    if (prev){
      EDITOR.map = prev;
      EDITOR.dirty = true;
      selectClear();
      requestRender();
      fire('mutation', { label: 'undo' });
    }
  }
  function doRedo(){
    if (!EDITOR.undo) return;
    var nxt = TM.MapEditor.undo.redo(EDITOR.undo, EDITOR.map);
    if (nxt){
      EDITOR.map = nxt;
      EDITOR.dirty = true;
      selectClear();
      requestRender();
      fire('mutation', { label: 'redo' });
    }
  }

  // ─── camera ───────────────────────────────────────────────

  function setZoom(z, anchor){
    z = Math.max(EDITOR.camera.minZoom, Math.min(EDITOR.camera.maxZoom, z));
    if (anchor){
      // keep anchor under cursor
      var w = screenToWorld(anchor.x, anchor.y);
      EDITOR.camera.zoom = z;
      var s = worldToScreen(w.x, w.y);
      EDITOR.camera.x += anchor.x - s.x;
      EDITOR.camera.y += anchor.y - s.y;
    } else {
      EDITOR.camera.zoom = z;
    }
    requestRender();
  }

  function panBy(dx, dy){
    EDITOR.camera.x += dx;
    EDITOR.camera.y += dy;
    requestRender();
  }

  function fitToContent(){
    var c = EDITOR.canvas;
    if (!c) return;
    var bbox = null;
    if (EDITOR.bitmapImage){
      bbox = { x: 0, y: 0, w: EDITOR.map.bitmapWidth, h: EDITOR.map.bitmapHeight };
    } else if (EDITOR.map.divisions.length){
      // union of all bboxes
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      EDITOR.map.divisions.forEach(function(d){
        if (!d.bbox) return;
        if (d.bbox.x < minX) minX = d.bbox.x;
        if (d.bbox.y < minY) minY = d.bbox.y;
        if (d.bbox.x + d.bbox.w > maxX) maxX = d.bbox.x + d.bbox.w;
        if (d.bbox.y + d.bbox.h > maxY) maxY = d.bbox.y + d.bbox.h;
      });
      if (isFinite(minX)){
        bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
    }
    if (!bbox){
      EDITOR.camera = { x: 0, y: 0, zoom: 1, minZoom: 0.1, maxZoom: 10 };
      requestRender();
      return;
    }
    var pad = 40;
    var zoom = Math.min(
      (c.width - pad * 2) / Math.max(bbox.w, 1),
      (c.height - pad * 2) / Math.max(bbox.h, 1)
    );
    zoom = Math.max(EDITOR.camera.minZoom, Math.min(EDITOR.camera.maxZoom, zoom));
    EDITOR.camera.zoom = zoom;
    EDITOR.camera.x = (c.width - bbox.w * zoom) / 2 - bbox.x * zoom;
    EDITOR.camera.y = (c.height - bbox.h * zoom) / 2 - bbox.y * zoom;
    requestRender();
  }

  // ─── render ───────────────────────────────────────────────

  var _renderRequested = false;
  function requestRender(){
    if (_renderRequested) return;
    _renderRequested = true;
    requestAnimationFrame(function(){
      _renderRequested = false;
      render();
    });
  }

  // 计算当前可见 division 列表 (timeline-aware)
  // 返回·[{ base, state, poly, centroid }]
  // state 可能 = base (无 timeline) 或 timeline 解析结果
  function computeVisibleList(){
    var inDiff = !!EDITOR.diffMode;
    var TL = global.TM && TM.MapEditor.timeline;
    var list = [];
    // 视口裁剪:算 world 视口矩形·屏外地块跳过(大地图性能·flag viewportCull 默认开·hover 不受影响因鼠标必在视口内)
    var _vp = null;
    if (EDITOR.viewportCull !== false && EDITOR.canvas){
      var _vtl = screenToWorld(0, 0), _vbr = screenToWorld(EDITOR.canvas.width, EDITOR.canvas.height);
      var _vpad = 40 / (EDITOR.camera.zoom || 1);
      _vp = { minX: Math.min(_vtl.x, _vbr.x) - _vpad, minY: Math.min(_vtl.y, _vbr.y) - _vpad, maxX: Math.max(_vtl.x, _vbr.x) + _vpad, maxY: Math.max(_vtl.y, _vbr.y) + _vpad };
    }
    EDITOR.map.divisions.forEach(function(d){
      // 视口裁剪:bbox 完全在视口外 → 跳过(部分相交/包住视口仍画)
      if (_vp && d.bbox && (d.bbox.x > _vp.maxX || d.bbox.x + d.bbox.w < _vp.minX || d.bbox.y > _vp.maxY || d.bbox.y + d.bbox.h < _vp.minY)) return;
      var state = d;
      if (!inDiff && EDITOR.viewYear != null && TL){
        var s = TL.getStateAt(d, EDITOR.viewYear);
        if (!s) return;
        state = s;
      }
      var poly = state.polygon || d.polygon;
      if (!poly || poly.length < 3) return;
      // 飞地·全部 polygon (主 + extra)·timeline patch 暂无 polygons 字段·fall back base
      var allPolys = getAllPolygons(state.polygon ? state : d);
      if (state.polygon && d.extraPolygons && state !== d){
        // timeline 改了 polygon·使用 state.polygon + base extraPolygons
        allPolys = [state.polygon].concat(d.extraPolygons || []);
      }
      var centroid = state.centroid || d.centroid;
      list.push({ base: d, state: state, poly: poly, allPolys: allPolys, centroid: centroid });
    });
    return list;
  }

  // ─── render helpers (refactor·替原 ~100 行嵌套) ─────────

  // polygon → ctx 当前 path·beginPath / lineTo / closePath
  function tracePolyPath(ctx, poly){
    if (!poly || poly.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (var i = 1; i < poly.length; i++){
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();
    return true;
  }

  // append polygon as sub-path (不 beginPath·用于 evenodd multi-ring)
  function appendPolySubPath(ctx, poly){
    if (!poly || poly.length < 3) return;
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (var i = 1; i < poly.length; i++){
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();
  }

  // 计 div 一次的 fill 色 (heat / diff / autonomy)
  function computeDivFillColor(v, isSelected, isHover, ctxFlags){
    var renderState = v.state;
    var d = v.base;
    if (ctxFlags.inDiff && ctxFlags.DF){
      var c = ctxFlags.DF.getDiffColor(d.id);
      if (!c) return 'rgba(60,60,60,0.35)';
      if (isSelected) return boostAlpha(c, 0.95);
      if (isHover)    return boostAlpha(c, 0.85);
      return c;
    }
    if (ctxFlags.heatMode !== 'none' && ctxFlags.heatCtx && TM.MapEditor.layers){
      var hc = TM.MapEditor.layers.getHeatColor(renderState, ctxFlags.heatMode, ctxFlags.heatCtx);
      if (!hc) return colorForDivision(renderState, isSelected, isHover);
      if (isSelected) return boostAlpha(hc, 0.95);
      if (isHover)    return boostAlpha(hc, 0.85);
      return hc;
    }
    return colorForDivision(renderState, isSelected, isHover);
  }

  // 主 polygon + holes 一 path·evenodd fill
  function fillMainWithHoles(ctx, mainPoly, holes, fillColor){
    if (!mainPoly || mainPoly.length < 3) return;
    ctx.beginPath();
    appendPolySubPath(ctx, mainPoly);
    for (var i = 0; i < holes.length; i++) appendPolySubPath(ctx, holes[i]);
    ctx.fillStyle = fillColor;
    ctx.fill('evenodd');
  }

  // 单 polygon stroke·zoom-scaled lineWidth·可选 dash
  function strokePolygon(ctx, poly, w, color, dashArr){
    if (!tracePolyPath(ctx, poly)) return;
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    if (dashArr) ctx.setLineDash(dashArr);
    ctx.stroke();
    if (dashArr) ctx.setLineDash([]);
  }

  // polygon layer 主入口·替原 ~100 行嵌套
  function renderPolygonLayer(ctx, visible, inDiff, DF){
    var heatMode = EDITOR.layers.heat || 'none';
    var heatCtx  = (heatMode !== 'none' && global.TM && TM.MapEditor.layers)
      ? TM.MapEditor.layers.prepareContext(heatMode) : null;
    // ink-realm + borders 都启 → core 跳 stroke·让 borders.js 唯一管线
    var skipStroke = global.TM
      && TM.MapEditor.inkRealm && TM.MapEditor.inkRealm.isEnabled()
      && TM.MapEditor.borders && TM.MapEditor.borders.isEnabled();
    var z = EDITOR.camera.zoom;
    var ctxFlags = { inDiff: inDiff, DF: DF, heatMode: heatMode, heatCtx: heatCtx };

    for (var idx = 0; idx < visible.length; idx++){
      var v = visible[idx];
      var d = v.base;
      var isSelected = EDITOR.selectedIds.indexOf(d.id) !== -1;
      var isHover    = EDITOR.hoverId === d.id;
      var fillColor  = computeDivFillColor(v, isSelected, isHover, ctxFlags);

      // 主 polygon + holes
      var mainPoly = v.allPolys[0];
      var holes = (d.holes || []).filter(function(h){ return h && h.length >= 3; });
      fillMainWithHoles(ctx, mainPoly, holes, fillColor);

      var mainW   = (isSelected ? 2.5 : 1.2) / z;
      var mainCol = isSelected ? '#d9b566' : (isHover ? '#efdfb2' : '#3a3530');
      var holeW   = 1.5 / z;
      var holeCol = isSelected ? '#dc4f3a' : '#5a3a30';
      var holeDash = [2 / z, 2 / z];

      if (!skipStroke && mainPoly){
        strokePolygon(ctx, mainPoly, mainW, mainCol);
      }
      // hole 描边总是要 (区别飞地)
      for (var hi = 0; hi < holes.length; hi++){
        strokePolygon(ctx, holes[hi], holeW, holeCol, holeDash);
      }

      // 飞地·extraPolygons (allPolys[1..])·dashed
      for (var px = 1; px < v.allPolys.length; px++){
        var ep = v.allPolys[px];
        if (!ep || ep.length < 3) continue;
        if (tracePolyPath(ctx, ep)){
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
        if (!skipStroke){
          strokePolygon(ctx, ep, mainW, mainCol, [3 / z, 3 / z]);
        }
      }
    }
  }

  // 渲染钩·调可选 overlay 模块·若模块未载或未启·安静跳过
  function runOverlay(modName, ctx){
    var mod = global.TM && TM.MapEditor && TM.MapEditor[modName];
    if (!mod || !mod.render) return;
    if (mod.isEnabled && !mod.isEnabled()) return;
    if (modName === 'cultureRaster' && mod.getMode && mod.getMode() === 'off') return;
    try { mod.render(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
  }

  function render(){
    var c = EDITOR.canvas, ctx = EDITOR.ctx;
    if (!c || !ctx) return;

    // clear
    ctx.save();
    ctx.fillStyle = '#1a1a1f';
    ctx.fillRect(0, 0, c.width, c.height);

    // apply camera
    ctx.translate(EDITOR.camera.x, EDITOR.camera.y);
    ctx.scale(EDITOR.camera.zoom, EDITOR.camera.zoom);

    // bitmap layer·应用 bitmapTransform (拖动 / 缩放 / 旋转)
    if (EDITOR.layers.bitmap && EDITOR.bitmapImage){
      try {
        var bt = EDITOR.map.bitmapTransform || { x: 0, y: 0, scale: 1, rot: 0 };
        var btScale = bt.scale || 1;
        var btRot = bt.rot || 0;
        var bw = EDITOR.map.bitmapWidth * btScale;
        var bh = EDITOR.map.bitmapHeight * btScale;
        var bcx = (bt.x || 0) + bw / 2;
        var bcy = (bt.y || 0) + bh / 2;
        ctx.globalAlpha = 0.85;
        if (btRot){
          ctx.save();
          ctx.translate(bcx, bcy);
          ctx.rotate(btRot);
          ctx.drawImage(EDITOR.bitmapImage, -bw/2, -bh/2, bw, bh);
          ctx.restore();
        } else {
          ctx.drawImage(EDITOR.bitmapImage, bt.x || 0, bt.y || 0, bw, bh);
        }
        ctx.globalAlpha = 1;
        // 当 X 工具激活·画底图选中虚框 + 旋转手柄 (拖动可旋)
        if (EDITOR.activeTool === 'bitmapXform'){
          var ss = 1 / EDITOR.camera.zoom;
          ctx.save();
          ctx.translate(bcx, bcy);
          if (btRot) ctx.rotate(btRot);
          // 虚框
          ctx.strokeStyle = 'rgba(216,184,99,0.85)';
          ctx.lineWidth = 1.5 * ss;
          ctx.setLineDash([6 * ss, 4 * ss]);
          ctx.strokeRect(-bw/2, -bh/2, bw, bh);
          ctx.setLineDash([]);
          // 中心点
          ctx.fillStyle = 'rgba(216,184,99,0.9)';
          ctx.beginPath(); ctx.arc(0, 0, 4 * ss, 0, Math.PI * 2); ctx.fill();
          // 旋转手柄·从顶端中点伸出·杆 + 圆球
          var handleOffset = 36 * ss;  // 距虚框顶端的杆长 (screen px)
          var handleR = 9 * ss;  // 圆球半径 (screen px)
          ctx.strokeStyle = 'rgba(216,184,99,0.95)';
          ctx.lineWidth = 2 * ss;
          ctx.beginPath();
          ctx.moveTo(0, -bh/2);
          ctx.lineTo(0, -bh/2 - handleOffset);
          ctx.stroke();
          // 球身·hover 时高亮·_bitmapRotate / hover 状态由 tools 设
          var isHot = EDITOR._bitmapRotateHover || EDITOR._bitmapRotate;
          ctx.fillStyle = isHot ? 'rgba(255,200,80,1)' : 'rgba(216,184,99,0.95)';
          ctx.beginPath(); ctx.arc(0, -bh/2 - handleOffset, handleR, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(40,30,15,0.85)';
          ctx.lineWidth = 1.2 * ss;
          ctx.stroke();
          // 球心箭符 ↻
          ctx.fillStyle = 'rgba(40,30,15,0.95)';
          ctx.font = (10 * ss) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↻', 0, -bh/2 - handleOffset);
          ctx.restore();
          // 旋转中显示当前角度·屏幕空间
          if (EDITOR._bitmapRotate){
            var deg = Math.round(btRot * 180 / Math.PI * 10) / 10;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            var lblX = EDITOR._bitmapRotate.lastScreenX || 0;
            var lblY = EDITOR._bitmapRotate.lastScreenY || 0;
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(lblX + 14, lblY - 10, 60, 20);
            ctx.fillStyle = '#ffd966';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(deg + '°', lblX + 18, lblY);
            ctx.restore();
          }
        }
      } catch(e){ /* ignore */ }
    }

    // raster 层 (phase 13.3)·heightMap·terrainMap·bitmap 之后·polygon 之前
    if (global.TM && TM.MapEditor.rastermaps){
      if (EDITOR.layers.heightMap){
        try { TM.MapEditor.rastermaps.renderLayer(ctx, EDITOR.camera, 'heightMap', { alpha: 0.55, style: EDITOR.layers.heightMapStyle }); } catch(e){ /* ignore */ }
      }
      if (EDITOR.layers.terrainMap){
        try { TM.MapEditor.rastermaps.renderLayer(ctx, EDITOR.camera, 'terrainMap', { alpha: 0.5 }); } catch(e){ /* ignore */ }
      }
    }

    // 一次计算可见列表·全 layer 共用
    var visible = computeVisibleList();
    EDITOR._visibleCache = visible;  // 给 hover 检测复用

    var inDiff = !!EDITOR.diffMode;
    var DF = global.TM && TM.MapEditor.diff;

    // polygon layer (fill + stroke)·遍历 allPolys + holes (主 polygon 用 evenodd 扣洞)
    if (EDITOR.layers.polygon){
      renderPolygonLayer(ctx, visible, inDiff, DF);
    }

    // ★ 水墨势力 wash·polygon 后·径向晕 + 边羽化·势力归属动态着色
    runOverlay('inkRealm', ctx);
    // 气候 overlay
    runOverlay('climate', ctx);
    // 季节 tint
    runOverlay('season', ctx);

    // 文化 / 信仰 raster
    runOverlay('cultureRaster', ctx);
    // impassable 楔区 (灰斜纹·border 前)
    runOverlay('impassable', ctx);
    // 边界
    runOverlay('borders', ctx);
    // hover glow + 脉冲·border 之后·label 之前
    runOverlay('hoverGlow', ctx);

    // border layer (autonomy color line)·timeline-aware·遍历 allPolys
    if (EDITOR.layers.border){
      visible.forEach(function(v){
        var typ = (v.state.autonomy && v.state.autonomy.type) || 'zhixia';
        var color = autonomyBorderColor(typ);
        if (!color) return;
        v.allPolys.forEach(function(poly){
          if (!poly || poly.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(poly[0][0], poly[0][1]);
          for (var i = 1; i < poly.length; i++){
            ctx.lineTo(poly[i][0], poly[i][1]);
          }
          ctx.closePath();
          ctx.lineWidth = 2 / EDITOR.camera.zoom;
          ctx.strokeStyle = color;
          ctx.setLineDash([6 / EDITOR.camera.zoom, 4 / EDITOR.camera.zoom]);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      });
    }

    // edit handles (E tool·选中省的所有 ring 顶点·主 + 飞地 + 圈)
    if (EDITOR.activeTool === 'edit'){
      var sel = getSelected();
      var z = EDITOR.camera.zoom;
      var hoverPos = (EDITOR._hoverVertex && EDITOR._hoverVertex.point) || null;
      sel.forEach(function(d){
        var rings = getAllRings(d);
        rings.forEach(function(ring){
          var color = ring.kind === 'main' ? '#d9b566' :
                      ring.kind === 'extra' ? '#e08020' :
                      '#dc4f3a';  // hole
          for (var i = 0; i < ring.points.length; i++){
            var p = ring.points[i];
            var isHover = hoverPos && p === hoverPos;
            var r = isHover ? 9 / z : 7 / z;
            // halo (阴影外圈)
            ctx.beginPath();
            ctx.arc(p[0], p[1], r + 2 / z, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fill();
            // 主圆
            ctx.beginPath();
            ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2 / z;
            ctx.strokeStyle = '#1a1a1f';
            ctx.stroke();
            // inner highlight·gem effect
            ctx.beginPath();
            ctx.arc(p[0] - r * 0.32, p[1] - r * 0.32, r * 0.32, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();
            // hover·额外金光环
            if (isHover){
              ctx.beginPath();
              ctx.arc(p[0], p[1], r + 4 / z, 0, Math.PI * 2);
              ctx.lineWidth = 1.5 / z;
              ctx.strokeStyle = 'rgba(217,181,102,0.7)';
              ctx.stroke();
            }
          }
        });
      });
    }

    // split preview·画切线 (point1 → mouse)
    if (EDITOR.activeTool === 'split' && EDITOR.splitState && EDITOR.splitState.point1){
      var p1 = EDITOR.splitState.point1;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(EDITOR.mouse.worldX, EDITOR.mouse.worldY);
      ctx.lineWidth = 2 / EDITOR.camera.zoom;
      ctx.strokeStyle = '#dc4f3a';
      ctx.setLineDash([10 / EDITOR.camera.zoom, 5 / EDITOR.camera.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      // dot
      ctx.beginPath();
      ctx.arc(p1[0], p1[1], 5 / EDITOR.camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#dc4f3a';
      ctx.fill();
    }

    // 子绘制模式·高亮父地块(金描边+发光+淡填充·提示在此父内画下级·配合 mode-banner)
    if (EDITOR.childDrawParentId){
      var _pd = null, _pds = EDITOR.map.divisions;
      for (var _pi = 0; _pi < _pds.length; _pi++){ if (_pds[_pi].id === EDITOR.childDrawParentId){ _pd = _pds[_pi]; break; } }
      if (_pd && _pd.polygon && _pd.polygon.length >= 3){
        var _pz = EDITOR.camera.zoom;
        var _prings = [_pd.polygon].concat(_pd.extraPolygons || []);
        ctx.save();
        _prings.forEach(function(_rg){
          if (!_rg || _rg.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(_rg[0][0], _rg[0][1]);
          for (var _k = 1; _k < _rg.length; _k++){ ctx.lineTo(_rg[_k][0], _rg[_k][1]); }
          ctx.closePath();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(217,181,102,0.07)';
          ctx.fill();
          ctx.lineWidth = 3 / _pz;
          ctx.strokeStyle = 'rgba(217,181,102,0.95)';
          ctx.shadowColor = 'rgba(217,181,102,0.85)';
          ctx.shadowBlur = 12 / _pz;
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    // pen preview·支持 pen / addPoly / addHole·色码区分
    if ((EDITOR.activeTool === 'pen' || EDITOR.activeTool === 'addPoly' || EDITOR.activeTool === 'addHole')
        && EDITOR.penPoints.length){
      var penColor = EDITOR.activeTool === 'addHole' ? '#dc4f3a'
                    : EDITOR.activeTool === 'addPoly' ? '#e08020'
                    : '#ff9d3b';
      ctx.beginPath();
      ctx.moveTo(EDITOR.penPoints[0][0], EDITOR.penPoints[0][1]);
      for (var i = 1; i < EDITOR.penPoints.length; i++){
        ctx.lineTo(EDITOR.penPoints[i][0], EDITOR.penPoints[i][1]);
      }
      ctx.lineTo(EDITOR.mouse.worldX, EDITOR.mouse.worldY);
      ctx.lineWidth = 1.5 / EDITOR.camera.zoom;
      ctx.strokeStyle = penColor;
      ctx.stroke();
      EDITOR.penPoints.forEach(function(p, idx){
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4 / EDITOR.camera.zoom, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#ff5630' : penColor;
        ctx.fill();
      });
      // 乙:吸附命中高亮(顶点=蓝圈·边=青圈)
      var _ph = EDITOR._penSnapHint;
      if (_ph && _ph.point){
        ctx.beginPath();
        ctx.arc(_ph.point[0], _ph.point[1], 7 / EDITOR.camera.zoom, 0, Math.PI * 2);
        ctx.lineWidth = 2 / EDITOR.camera.zoom;
        ctx.strokeStyle = _ph.kind === 'edge' ? '#3bd6c6' : '#3b9dff';
        ctx.stroke();
      }
      // 丙:近首点可闭合 → 首点白圈高亮
      if (EDITOR.penPoints.length >= (EDITOR.minVerticesToClose || 3)){
        var _f0 = EDITOR.penPoints[0];
        var _cW = (EDITOR.closingDistance || 12) / EDITOR.camera.zoom;
        var _ddx = EDITOR.mouse.worldX - _f0[0], _ddy = EDITOR.mouse.worldY - _f0[1];
        if (_ddx * _ddx + _ddy * _ddy <= _cW * _cW){
          ctx.beginPath();
          ctx.arc(_f0[0], _f0[1], 9 / EDITOR.camera.zoom, 0, Math.PI * 2);
          ctx.lineWidth = 2.5 / EDITOR.camera.zoom;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        }
      }
    }

    // label layer·timeline-aware
    // iconlets·label 之前画
    runOverlay('iconlets', ctx);

    if (EDITOR.layers.label){
      // smart labels·分级 + 避让·若启
      var SL = global.TM && TM.MapEditor.smartLabels;
      if (SL && SL.isEnabled && SL.isEnabled()){
        try { SL.render(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
      } else {
        ctx.font = (12 / EDITOR.camera.zoom) + 'px "Noto Serif SC", "STKaiti", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var _z = EDITOR.camera.zoom;
        var _off = 1 / _z;
        // LOD·屏幕尺寸过小的地块跳过标签(大地图全图视角性能·缩放后自动显现)·可调 EDITOR.labelMinScreenPx·0=全画
        var _lblMin = (EDITOR.labelMinScreenPx != null) ? EDITOR.labelMinScreenPx : 26;
        visible.forEach(function(v){
          if (!v.centroid) return;
          var _bb = v.base.bbox;
          if (_lblMin > 0 && _bb && Math.max(_bb.w, _bb.h) * _z < _lblMin) return;
          var name = v.state.name || v.base.name;
          ctx.fillStyle = 'rgba(20,15,10,0.85)';
          ctx.fillText(name, v.centroid[0] + _off, v.centroid[1] + _off);
          ctx.fillStyle = '#f5e8c8';
          ctx.fillText(name, v.centroid[0], v.centroid[1]);
        });
      }
    }

    // centroid markers·timeline-aware
    if (EDITOR.layers.centroid){
      visible.forEach(function(v){
        if (!v.centroid) return;
        ctx.beginPath();
        ctx.arc(v.centroid[0], v.centroid[1], 3 / EDITOR.camera.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5630';
        ctx.fill();
      });
    }

    // text annotations layer (phase 7)
    if (global.TM && TM.MapEditor.text){
      try { TM.MapEditor.text.renderLayer(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // 地理层 (phase 12)·rivers/roads/strongholds·polygon 之上·label 之前
    if (global.TM && TM.MapEditor.rivers){
      try { TM.MapEditor.rivers.renderLayer(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
      try { TM.MapEditor.rivers.renderPenPreview(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }
    if (global.TM && TM.MapEditor.roads){
      try { TM.MapEditor.roads.renderLayer(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
      try { TM.MapEditor.roads.renderPenPreview(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }
    if (global.TM && TM.MapEditor.strongholds){
      try { TM.MapEditor.strongholds.renderLayer(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // 渡口 (phase 13.5)
    if (global.TM && TM.MapEditor.ferry){
      try { TM.MapEditor.ferry.renderLayer(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // fog 预览·最末端·dim 全 visible 内容 (含 label / icon / 河等)
    runOverlay('fog', ctx);

    // zoom-blend HUD·屏角小标·screen-space
    runOverlay('zoomBlend', ctx);

    // 邻接图 debug 渲染 (phase 13.1)·areaLinks layer
    if (global.TM && TM.MapEditor.arealinks){
      try { TM.MapEditor.arealinks.renderLinks(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // voronoi preview (phase 10)
    if (global.TM && TM.MapEditor.voronoi){
      try { TM.MapEditor.voronoi.renderPreview(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // brush overlay (phase 10)
    if (global.TM && TM.MapEditor.brush){
      try { TM.MapEditor.brush.renderOverlay(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // marquee preview (phase 16.1)
    if (global.TM && TM.MapEditor.marquee){
      try { TM.MapEditor.marquee.renderPreview(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // ghost preview·split halves / merge hull (phase 18.5)
    if (global.TM && TM.MapEditor.ghost){
      try { TM.MapEditor.ghost.renderPreview(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    // topology vertex hint (phase 11)·edit 工具下显共享顶点
    if (global.TM && TM.MapEditor.topology && TM.MapEditor.topology.isEnabled() &&
        (EDITOR.activeTool === 'edit' || EDITOR.layers.topology)){
      try { renderTopologyHints(ctx, EDITOR.camera); } catch(e){ /* ignore */ }
    }

    ctx.restore();
  }

  function renderTopologyHints(ctx, camera){
    var t = EDITOR.map.topology;
    if (!t || !t.enabled) return;
    var verts = t.vertices, usage = t.usage;
    var z = camera.zoom;
    // 视口裁·只画屏内 vertex
    var c = EDITOR.canvas;
    var minX = -camera.x / z, minY = -camera.y / z;
    var maxX = minX + c.width / z, maxY = minY + c.height / z;
    var pad = 20 / z;

    Object.keys(verts).forEach(function(vid){
      var v = verts[vid];
      if (!v) return;
      if (v[0] < minX - pad || v[0] > maxX + pad) return;
      if (v[1] < minY - pad || v[1] > maxY + pad) return;
      var n = (usage[vid] || []).length;
      if (n === 0) return;
      var r, fill, stroke;
      if (n === 1){
        r = 2.5 / z; fill = '#6a6560'; stroke = '#1a1a1f';
      } else if (n === 2){
        r = 4 / z; fill = '#c9a96e'; stroke = '#1a1a1f';
      } else {
        r = 5.5 / z; fill = '#d9b566'; stroke = '#3a2f10';
      }
      ctx.beginPath();
      ctx.arc(v[0], v[1], r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    });
  }

  function colorForDivision(d, isSelected, isHover){
    // base by autonomy
    var base = '#5a5048';
    var typ = (d.autonomy && d.autonomy.type) || 'zhixia';
    if (typ === 'zhixia')   base = '#3d4f6a';
    if (typ === 'fanguo')   base = '#8a3a2e';
    if (typ === 'fanzhen')  base = '#b65a30';
    if (typ === 'jimi')     base = '#6a8a3a';
    if (typ === 'chaogong') base = '#7a6a3a';

    var alpha = 0.55;
    if (isSelected) alpha = 0.75;
    else if (isHover) alpha = 0.65;
    return rgba(base, alpha);

    function rgba(hex, a){
      // hex #rrggbb
      var r = parseInt(hex.slice(1,3),16);
      var g = parseInt(hex.slice(3,5),16);
      var b = parseInt(hex.slice(5,7),16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }
  }

  function boostAlpha(rgbaStr, newA){
    // rgba(r,g,b,a) → rgba(r,g,b,newA)
    var m = /rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/.exec(rgbaStr);
    if (!m) return rgbaStr;
    return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + newA + ')';
  }

  function autonomyBorderColor(typ){
    if (typ === 'jimi')     return 'rgba(190,200,90,0.7)';
    if (typ === 'fanguo')   return 'rgba(220,90,60,0.7)';
    if (typ === 'fanzhen')  return 'rgba(255,150,40,0.7)';
    if (typ === 'chaogong') return 'rgba(190,170,80,0.55)';
    return null;  // zhixia·不画边线·只用 polygon stroke
  }

  // ─── canvas resize ────────────────────────────────────────

  function resizeCanvas(){
    var c = EDITOR.canvas;
    if (!c) return;
    var parent = c.parentElement;
    if (!parent) return;
    var dpr = window.devicePixelRatio || 1;
    var w = parent.clientWidth;
    var h = parent.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    EDITOR.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    requestRender();
  }

  // ─── event hub ────────────────────────────────────────────

  var _handlers = {};
  function on(evt, fn){
    if (!_handlers[evt]) _handlers[evt] = [];
    _handlers[evt].push(fn);
  }
  function fire(evt, payload){
    var arr = _handlers[evt];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++){
      try { arr[i](payload); } catch(e){ console.error('[map-editor]', evt, e); }
    }
  }

  // ─── init ─────────────────────────────────────────────────

  function init(canvasId){
    var c = document.getElementById(canvasId);
    if (!c){ console.error('[map-editor] canvas not found:', canvasId); return false; }
    EDITOR.canvas = c;
    EDITOR.ctx = c.getContext('2d');
    EDITOR.undo = TM.MapEditor.undo.create();
    TM.MapEditor.undo.setBaseline(EDITOR.undo, EDITOR.map);

    // canvas mouse·delegated to tools.js (attach 见 tools.js bindCanvas)
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // first render
    requestRender();
    fire('init');
    return true;
  }

  // ─── new map / load map ──────────────────────────────────

  function newMap(dynastyId){
    var d = TM.MapEditor.dynasty.get(dynastyId);
    EDITOR.map = createMapState({ dynasty: d.id, era: d.sampleEra, title: d.label + '·空地图' });
    EDITOR.bitmapImage = null;
    selectClear();
    if (EDITOR.undo){
      TM.MapEditor.undo.clear(EDITOR.undo);
      TM.MapEditor.undo.setBaseline(EDITOR.undo, EDITOR.map);
    }
    EDITOR.dirty = false;
    if (global.TM && TM.MapEditor.arealinks){
      TM.MapEditor.arealinks.buildColorKeyIndex(EDITOR.map);
    }
    fitToContent();
    fire('map-loaded');
  }

  function loadMap(mapData){
    if (!mapData || !mapData.divisions){
      console.error('[map-editor] invalid map data');
      return;
    }
    // ensure each division has expected fields (sanitize via createDivision)
    var divs = mapData.divisions.map(function(d){
      var nd = createDivision(d);
      recomputeDerived(nd);
      return nd;
    });
    EDITOR.map = createMapState({
      dynasty: mapData.dynasty,
      era: mapData.era,
      title: mapData.title,
      bitmapUrl: mapData.bitmapUrl,
      bitmapWidth: mapData.bitmapWidth || 1280,
      bitmapHeight: mapData.bitmapHeight || 800,
      divisions: divs,
      meta: mapData.meta,
      topology: mapData.topology,
      rivers: mapData.rivers,
      roads: mapData.roads,
      strongholds: mapData.strongholds,
      areaLinks: mapData.areaLinks,
      heightMap: mapData.heightMap,
      terrainMap: mapData.terrainMap,
      ferries: mapData.ferries,
      // Phase 25·势力注册表
      factions: mapData.factions || []
    });

    // phase 13.3·若 heightMap/terrainMap 存·懒 init runtime canvas (会自动 decode dataB64)
    if (global.TM && TM.MapEditor.rastermaps){
      if (EDITOR.map.heightMap) TM.MapEditor.rastermaps.ensureLayer('heightMap');
      if (EDITOR.map.terrainMap) TM.MapEditor.rastermaps.ensureLayer('terrainMap');
    }

    // phase 13.1·载图后·补 colorKey + 重建 colorKeyIndex
    if (global.TM && TM.MapEditor.arealinks){
      TM.MapEditor.arealinks.assignColorKeys(EDITOR.map);
      TM.MapEditor.arealinks.buildColorKeyIndex(EDITOR.map);
    }

    // topology·若 JSON 中已 enabled·重建 spatial grid (非持久化) + 重算 div 坐标
    if (EDITOR.map.topology && EDITOR.map.topology.enabled &&
        global.TM && TM.MapEditor.topology){
      TM.MapEditor.topology.gridRebuild(EDITOR.map);
      // div.polygon 坐标信任 JSON·若缺则按 polygonVids 重算
      EDITOR.map.divisions.forEach(function(d){
        if (d.polygonVids && (!d.polygon || d.polygon.length === 0)){
          TM.MapEditor.topology.rebuildDivisionCoords(EDITOR.map, d);
        }
        recomputeDerived(d);
      });
    }

    EDITOR.bitmapImage = null;
    selectClear();
    if (EDITOR.undo){
      TM.MapEditor.undo.clear(EDITOR.undo);
      TM.MapEditor.undo.setBaseline(EDITOR.undo, EDITOR.map);
    }
    EDITOR.dirty = false;
    fitToContent();
    fire('map-loaded');

    if (mapData.bitmapUrl){
      loadBitmap(mapData.bitmapUrl);
    }
  }

  function loadBitmap(url){
    var img = new Image();
    img.onload = function(){
      EDITOR.bitmapImage = img;
      // auto-set bitmap size
      EDITOR.map.bitmapWidth = img.naturalWidth;
      EDITOR.map.bitmapHeight = img.naturalHeight;
      // 重置变换·新载图从 identity 开始
      EDITOR.map.bitmapTransform = { x: 0, y: 0, scale: 1, rot: 0 };
      fitToContent();
      requestRender();
      fire('bitmap-loaded');
    };
    img.onerror = function(){
      console.error('[map-editor] bitmap load failed:', url);
      fire('bitmap-error', { url: url });
    };
    img.src = url;
    EDITOR.map.bitmapUrl = url;
  }

  // 清空底图·polygons / 字注 / 等保留·只移除参考底图
  function clearBitmap(){
    if (!EDITOR.bitmapImage && !EDITOR.map.bitmapUrl){
      if (global.meToast) global.meToast('已无底图', 'info', 1200);
      return;
    }
    commitMutation('clear bitmap', function(){
      EDITOR.bitmapImage = null;
      EDITOR.map.bitmapUrl = '';
      // bitmapWidth/Height·polygon 锚定坐标·保留
      // bitmapTransform·留待下次载图重置
    });
    fire('bitmap-cleared');
    if (global.meToast) global.meToast('底图已清空·polygon 保留', 'info', 1500);
  }

  // 重置底图变换 (位置/缩放/旋转回 identity)
  function resetBitmapTransform(){
    if (!EDITOR.bitmapImage) return;
    commitMutation('reset bitmap transform', function(){
      EDITOR.map.bitmapTransform = { x: 0, y: 0, scale: 1, rot: 0 };
    });
  }

  // 旋转底图·绕 bitmap 中心·delta·弧度·正 = 顺时针
  function rotateBitmapBy(deltaRad){
    if (!EDITOR.bitmapImage) return;
    var bt = EDITOR.map.bitmapTransform || { x: 0, y: 0, scale: 1, rot: 0 };
    var newRot = (bt.rot || 0) + deltaRad;
    // 归一化到 [-PI, PI]
    while (newRot > Math.PI) newRot -= Math.PI * 2;
    while (newRot < -Math.PI) newRot += Math.PI * 2;
    commitMutation('rotate bitmap', function(){
      EDITOR.map.bitmapTransform = Object.assign({}, EDITOR.map.bitmapTransform || {}, { rot: newRot });
    });
  }

  // 设旋角·绝对值 (弧度)
  function setBitmapRotation(rad){
    if (!EDITOR.bitmapImage) return;
    var r = +rad || 0;
    while (r > Math.PI) r -= Math.PI * 2;
    while (r < -Math.PI) r += Math.PI * 2;
    commitMutation('set bitmap rotation', function(){
      EDITOR.map.bitmapTransform = Object.assign({}, EDITOR.map.bitmapTransform || { x: 0, y: 0, scale: 1 }, { rot: r });
    });
  }

  // ─── tool switch ─────────────────────────────────────────

  function setTool(t){
    if (EDITOR.activeTool === t) return;
    EDITOR.activeTool = t;
    EDITOR.penPoints = [];
    EDITOR.draggingVertex = null;
    requestRender();
    fire('tool-change', { tool: t });
  }

  // ─── 子绘制模式（层级绘制）·在选中父地块(省/路)内手动画下级(府/县) ───────
  //   复用 createDivision + hierarchicalGen.nextLevel(级别链) + polyUtils.polygonBoolean(robust 交集·裁到父内)。
  //   跨朝代中立：级别名走 dynasty 级别链·不写死省/府。

  function _polyArea(poly){
    var s = 0;
    for (var i = 0; i < poly.length; i++){ var a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }

  function _findDivisionById(id){
    var ds = EDITOR.map.divisions;
    for (var i = 0; i < ds.length; i++){ if (ds[i].id === id) return ds[i]; }
    return null;
  }

  function enterChildDraw(parentId){
    var p = _findDivisionById(parentId);
    if (!p) return;
    var HG = global.TM && TM.MapEditor.hierarchicalGen;
    var nl = HG ? HG.nextLevel(EDITOR.map.dynasty, p.level) : null;
    if (!nl){ if (global.meToast) meToast((p.name || p.level) + ' 已是最末级·无下级可画', 'warn', 2400); return; }
    EDITOR.childDrawParentId = parentId;
    EDITOR.penPoints = [];
    setTool('pen');
    if (global.meToast) meToast('在【' + (p.name || '?') + '】内画下级（' + nl + '）·闭合成块·自动裁到父内·Esc 退出', 'info', 3600);
    requestRender();
  }

  function exitChildDraw(){
    if (!EDITOR.childDrawParentId) return;
    EDITOR.childDrawParentId = null;
    EDITOR.penPoints = [];
    if (global.meToast) meToast('已退出子绘制模式', 'info', 1500);
    requestRender();
  }

  // pen 闭合时若处于子绘制模式则调用：把手画多边形裁到父内·建为下级 division。返回子 div 或 null。
  function createChildDivision(poly){
    var parent = EDITOR.childDrawParentId ? _findDivisionById(EDITOR.childDrawParentId) : null;
    if (!parent || !parent.polygon || parent.polygon.length < 3){
      if (global.meToast) meToast('父地块异常·已退出子绘制', 'error');
      EDITOR.childDrawParentId = null;
      return null;
    }
    var HG = global.TM && TM.MapEditor.hierarchicalGen;
    var PU = global.TM && TM.MapEditor.polyUtils;
    var nl = HG ? HG.nextLevel(EDITOR.map.dynasty, parent.level) : null;
    if (!nl){ if (global.meToast) meToast(parent.level + ' 无下级·无法建子', 'warn'); return null; }
    // robust 交集裁到父内（凹父也对）·余环作飞地（exclave）
    var rings = (PU ? PU.polygonBoolean(poly, parent.polygon, 'int') : [])
      .map(function(r){ return r && r.outer ? r.outer : r; })
      .filter(function(r){ return r && r.length >= 3; });
    if (!rings.length){
      if (global.meToast) meToast('所画区域在【' + (parent.name || '父') + '】之外·请画在父地块范围内', 'warn', 2800);
      return null;
    }
    rings.sort(function(a, b){ return _polyArea(b) - _polyArea(a); });
    var siblings = EDITOR.map.divisions.filter(function(d){ return d.parentId === parent.id; }).length;
    var child = createDivision({
      name: (parent.name || '') + '·下辖' + (siblings + 1),
      level: nl,
      regionType: parent.regionType,
      polygon: rings[0],
      extraPolygons: rings.slice(1)
    });
    child.parentId = parent.id;
    child.region = parent.region || parent.regionType;
    if (parent.autonomy) child.autonomy = Object.assign({}, parent.autonomy);
    if (parent.factionId) child.factionId = parent.factionId;
    recomputeDerived(child);
    addDivision(child);
    selectOne(child.id);
    return child;
  }

  // ─── layer toggle ────────────────────────────────────────

  function toggleLayer(key){
    if (typeof EDITOR.layers[key] === 'boolean'){
      EDITOR.layers[key] = !EDITOR.layers[key];
    }
    requestRender();
    fire('layer-change', { key: key });
  }

  // ─── expose ──────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  Object.assign(global.TM.MapEditor, {
    EDITOR: EDITOR,
    init: init,
    newMap: newMap,
    loadMap: loadMap,
    loadBitmap: loadBitmap,
    clearBitmap: clearBitmap,
    resetBitmapTransform: resetBitmapTransform,
    rotateBitmapBy: rotateBitmapBy,
    setBitmapRotation: setBitmapRotation,
    setTool: setTool,
    enterChildDraw: enterChildDraw,
    exitChildDraw: exitChildDraw,
    createChildDivision: createChildDivision,
    toggleLayer: toggleLayer,
    requestRender: requestRender,
    resizeCanvas: resizeCanvas,
    fitToContent: fitToContent,
    setZoom: setZoom,
    panBy: panBy,
    screenToWorld: screenToWorld,
    worldToScreen: worldToScreen,

    // division ops
    createDivision: createDivision,
    getAllPolygons: getAllPolygons,
    getAllRings: getAllRings,
    pointInDivision: pointInDivision,
    findDivisionAt: findDivisionAt,
    getSelected: getSelected,
    selectOne: selectOne,
    selectAdd: selectAdd,
    selectClear: selectClear,
    addDivision: addDivision,
    removeDivision: removeDivision,
    updateDivision: updateDivision,
    commitMutation: commitMutation,
    recomputeDerived: recomputeDerived,

    // geometry
    pointInPolygon: pointInPolygon,
    polygonCentroid: polygonCentroid,
    polygonArea: polygonArea,
    polygonBBox: polygonBBox,

    // undo
    doUndo: doUndo,
    doRedo: doRedo,

    // events
    on: on,
    fire: fire
  });

})(typeof window !== 'undefined' ? window : this);
