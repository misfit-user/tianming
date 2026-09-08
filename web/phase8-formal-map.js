// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   御案·中央地图（renderFormalMap·region/faction dossier·alerts·basemap·tile·121 函数·Wave 6 从 bridge 拆出）
//   §1 alias 块       cross-closure helpers from bridge._xxx
//   §2 late-bound     wrappers（into bridge / window）
//   §3 module body    迁入主体（body 0 改动）：bindRuntimeMapState / 地图渲染
//   §4 签注          hover 小笺按视图给核心读数 + 判语（2026-06-11）
//   §5 四视图计分     2026-06-11 重构 + 活账因果签（字段牵动链）
//   §6 卡片          营造志卡 / 地块方志 / 势力谱牒 · openDivisionDetail
//   §7 attach         public API + re-attach bridge 导出
// ─────────────────────────────────────────────
// phase8-formal-map.js·中央地图 (renderFormalMap·region dossier·faction dossier·alerts·basemap·tile rendering·121 functions)
// split from phase8-formal-bridge.js·2026-05-26·Wave 6
// paradigm·head alias 块·body 0 改动·跨闭包 helper 通过 bridge._xxx + late-bound wrapper

(function(){
  'use strict';

  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-map] TMPhase8FormalBridge not init·bridge.js 必须先 load');
    return;
  }

  var state = bridge._state || window.TM_PHASE8_FORMAL;

  // ── alias 块 (cross-closure helpers from bridge._xxx) ──────────────
  var esc = bridge._esc;
  var attr = bridge._attr;
  var asset = bridge._asset;
  var miniRows = bridge._miniRows;
  var actionButton = bridge._actionButton;
  // 2026-05-27·CRITICAL fix·删 3 个 shadow alias (ownerKey / ownerName / findFaction)
  // 这 3 个在 map.js L566+ 有本地 function 声明·alias 指向 bridge.js wrapper (会 callback 到 bridge.map.X)
  // var assignment 会 OVERWRITE hoisted function·导致本地调用变 wrapper·wrapper 调 bridge.map.X (= 同 wrapper)·**无限递归 RangeError**
  // 已 ship 自 Wave 6 拆分 2026-05-26·之前没炸是因为 map render 路径没真触发 (因为 syncFormalShellVisibility / showHome 等 alias 没补·更早 throw 阻断)
  // 1.2.7.7 补全 alias 后 map render 真跑通·这 3 个 shadow recursion 立刻暴露
  var findPerson = bridge._findPerson;
  var personKey = bridge._personKey;
  var getPeople = bridge._getPeople;
  var getParties = bridge._getParties;
  var getClasses = bridge._getClasses;
  var collectRecentEvents = bridge._collectRecentEvents;
  var getTurnText = bridge._getTurnText;
  var firstArray = bridge._firstArray;
  var compactText = bridge._compactText;
  var getMemorials = bridge._getMemorials;
  var getIssues = bridge._getIssues;
  var getActiveScenario = bridge._getActiveScenario;
  var getArmies = bridge._getArmies;
  var issueIsResolved = bridge._issueIsResolved;
  var toast = bridge._toast;
  var cssEscape = bridge._cssEscape;
  var renderEventFeed = bridge._renderEventFeed;
  var syncFormalShellVisibility = bridge._syncFormalShellVisibility;
  var hasRegionMap = bridge._hasRegionMap;
  var getScenarioMapData = bridge._getScenarioMapData;
  var activeScenarioId = bridge._activeScenarioId;
  var mapIdentity = bridge._mapIdentity;
  var isGameVisible = bridge._isGameVisible;
  var showHome = bridge._showHome;

  // ── late-bound wrappers (orchestration into bridge / window) ───────
  function openPanel(slot){ return bridge.openPanel(slot); }
  function openModule(kind, options){ return bridge.openModule(kind, options); }
  function openGuoku(){ return bridge.openGuoku(); }
  function closeModule(){ return bridge._closeModule && bridge._closeModule(); }
  function moduleShell(kind, title, sub, left, main, right){ return bridge._moduleShell ? bridge._moduleShell(kind, title, sub, left, main, right) : ''; }

  // ── module body (P3 Wave 6 迁入·2606 行·body 0 改动) ─────────────

  function mapStage(){
    return document.getElementById('ming-map-layer') || document.getElementById('tmf-map-stage');
  }

  function ensureMainShell(){
    if (!syncFormalShellVisibility()) return null;
    var gc = document.getElementById('gc');
    if (!gc) return null;
    var shell = document.getElementById('tm-phase8-main-shell');
    if (!shell) {
      shell = document.createElement('section');
      shell.id = 'tm-phase8-main-shell';
      shell.setAttribute('aria-label', '天命 Phase 8 主界面');
      shell.innerHTML =
        '<div id="mapwrap" class="tmf-mapwrap" data-map-mode="' + esc(state.mapMode) + '" data-map-scale="' + esc(state.mapScale) + '">' +
          '<div class="map-bg"></div><div class="map-board-corner c1"></div><div class="map-board-corner c2"></div><div class="map-board-corner c3"></div><div class="map-board-corner c4"></div>' +
          '<div class="desk-prop paperweight"></div><div class="desk-prop counter"></div><div class="desk-prop seal"></div>' +
          '<div id="ming-map-layer" class="ming-map-layer tmf-map-stage" aria-label="天下舆图"></div>' +
          '<div class="map-zoom-tools" aria-label="舆图缩放"><button type="button" class="mz-btn" data-map-zoom="1.22" title="放大">+</button><button type="button" class="mz-btn reset" data-map-reset="1" title="复位">◎</button><button type="button" class="mz-btn" data-map-zoom="0.82" title="缩小">−</button></div>' +
          '<div class="ming-map-wash"></div>' +
          '<button type="button" class="renwu-tuzhi-entry" data-tmf-action="renwu" title="人物图志"><img class="renwu-tuzhi-img" src="' + esc(asset('renwu-tuzhi-card-ui.png')) + '" alt="人物图志"></button>' +
          '<div class="map-tools-dock open" id="map-tools-dock"><button type="button" class="map-tools-toggle" id="map-tools-toggle" data-map-tools-toggle="1" aria-expanded="true"><span>舆图工具</span><span class="map-tools-mode" id="map-tools-mode">势力</span><span class="map-tools-caret">▾</span></button><div class="map-tools-pop" id="map-tools-pop"><div class="map-layer-bar"><button class="map-layer" data-map-mode="mood">民情</button><button class="map-layer" data-map-mode="classPressure">阶层</button><button class="map-layer" data-map-mode="tax">财赋</button><button class="map-layer" data-map-mode="army">军务</button><button class="map-layer" data-map-mode="office">官守</button><button class="map-layer" data-map-mode="yizheng">役政</button><button class="map-layer on" data-map-mode="owner">势力</button></div><div class="map-nav-panel"><div class="map-search-row"><span class="map-search-label">检索</span><input id="map-search" class="map-search" list="map-region-list" autocomplete="off" placeholder="地名 / 势力 / 主官"><datalist id="map-region-list"></datalist></div><div id="map-search-results" class="map-search-results"></div></div></div></div>' +
          '<div class="map-scale-strip" aria-label="舆图层级"><button type="button" class="map-scale" data-map-scale="realm" aria-pressed="false">天下</button><button type="button" class="map-scale" data-map-scale="region" aria-pressed="true">省道</button><button type="button" class="map-scale" data-map-scale="prefecture" aria-pressed="false">府州</button></div>' +
          '<div class="map-alert-strip"><button type="button" class="map-alert hot" onclick="TMPhase8FormalBridge.openAction(\'memorial\')">待批奏疏</button><button type="button" class="map-alert" onclick="TMPhase8FormalBridge.openPanel(\'issue\')">朝议待核</button><button type="button" class="map-alert ok" onclick="TMPhase8FormalBridge.openPanel(\'finance\')">财赋入库</button></div>' +
          '<div id="tmf-map-legend" class="map-legend tmf-map-legend"></div>' +
          '<div class="map-hint" id="tmf-map-hint">滚轮缩放，拖拽移图，点击地块查看档案。</div>' +
          '<div id="tmf-map-tip" class="map-tooltip tmf-map-tip"></div>' +
        '</div>';
      gc.insertBefore(shell, gc.firstChild);
    }
    var legacyStage = document.getElementById('tmf-map-stage');
    if (legacyStage && !document.getElementById('ming-map-layer')) legacyStage.id = 'ming-map-layer';
    var back = document.getElementById('tm-phase8-home-return');
    if (!back) {
      back = document.createElement('button');
      back.type = 'button';
      back.id = 'tm-phase8-home-return';
      back.textContent = '返回舆图';
      back.onclick = showHome;
      document.getElementById('G').appendChild(back);
    }
    if (state.mainShellBound !== gc) {
      state.mainShellBound = gc;
      gc.addEventListener('click', function(e){
        var toggle = e.target && e.target.closest ? e.target.closest('[data-map-tools-toggle]') : null;
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          var dock = document.getElementById('map-tools-dock');
          if (dock) dock.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(!!(dock && dock.classList.contains('open'))));
          return;
        }
        var zoom = e.target && e.target.closest ? e.target.closest('[data-map-zoom]') : null;
        if (zoom) {
          e.preventDefault();
          e.stopPropagation();
          zoomMap(Number(zoom.dataset.mapZoom || 1));
          return;
        }
        var reset = e.target && e.target.closest ? e.target.closest('[data-map-reset]') : null;
        if (reset) {
          e.preventDefault();
          e.stopPropagation();
          resetMapView();
          return;
        }
        var mode = e.target && e.target.closest ? e.target.closest('.map-layer[data-map-mode]') : null;
        if (mode) {
          e.preventDefault();
          e.stopPropagation();
          state.mapMode = mode.dataset.mapMode || 'owner';
          state.mapPanelTab = state.mapMode;
          updateMapChrome();
          renderFormalMap();
          refreshMapPpop();
          return;
        }
        var scale = e.target && e.target.closest ? e.target.closest('.map-scale[data-map-scale]') : null;
        if (scale) {
          e.preventDefault();
          e.stopPropagation();
          state.mapScale = scale.dataset.mapScale || 'region';
          // 联动:按钮切层 → 缩放到该层 band(层级与缩放一致·CK3)·_syncScaleLevelFromZoom 见同 band 不会切回
          state.mapView = state.mapView || { scale: 1, tx: 0, ty: 0 };
          // 以视口中心为锚重算平移(2026-07-03)：原先只改 scale 留 tx/ty 残余→切档后画面甩向左上/漂出纸面
          var _s1 = Number(state.mapView.scale) || 1;
          var _s2 = bandToScale(state.mapScale);
          var _cw = (Number(state._mapVBW) || 1200) / 2, _ch = (Number(state._mapVBH) || 720) / 2;
          state.mapView.tx = _cw - (_cw - (Number(state.mapView.tx) || 0)) * (_s2 / _s1);
          state.mapView.ty = _ch - (_ch - (Number(state.mapView.ty) || 0)) * (_s2 / _s1);
          state.mapView.scale = _s2;
          applyMapTransform();
          updateMapChrome();
          renderFormalMap();
          refreshMapPpop();
          return;
        }
      });
      gc.addEventListener('input', function(e){
        if (e.target && e.target.id === 'map-search') renderMapSearchResults(e.target.value || '');
      });
      gc.addEventListener('keydown', function(e){
        if (!(e.target && e.target.id === 'map-search') || e.key !== 'Enter') return;
        var first = document.querySelector('#map-search-results [data-region-id]');
        if (first) {
          e.preventDefault();
          focusRegion(first.dataset.regionId, true);
        }
      });
    }
    installMapInteraction();
    return shell;
  }

  function ensureMapDataScript(){
    return null;
  }

  function cloneMapForFormal(map){
    if (!map) return map;
    if (typeof window.deepClone === 'function') {
      try { return window.deepClone(map); } catch(_) {}
    }
    try { return JSON.parse(JSON.stringify(map)); } catch(_) { return map; }
  }

  function bindFormalMapState(sourceMap){
    if (!hasRegionMap(sourceMap)) return null;
    if (typeof window.bindRuntimeMapState === 'function') {
      try {
        var bound = window.bindRuntimeMapState(sourceMap);
        if (hasRegionMap(bound)) {
          return syncLiveMapRefs(bound);
        }
      } catch(_) {}
    }
    var live = cloneMapForFormal(sourceMap);
    return syncLiveMapRefs(live);
  }

  function syncLiveMapRefs(live){
    if (!hasRegionMap(live)) return null;
    if (window.GM) {
      window.GM.mapData = live;
      window.GM._useAIGeo = false;
    }
    if (window.P) {
      window.P.map = live;
      window.P.mapData = live;
    }
    return live;
  }

  function getMapData(){
    if (window.TMMapRuntime && typeof TMMapRuntime.getMap === 'function') {
      try {
        var live = TMMapRuntime.getMap();
        if (hasRegionMap(live)) return syncLiveMapRefs(live) || live;
      } catch(_) {}
    }
    var gm = window.GM && GM.mapData;
    if (hasRegionMap(gm)) return syncLiveMapRefs(gm) || gm;
    var pMap = window.P && P.map;
    if (hasRegionMap(pMap) && pMap.enabled !== false) return bindFormalMapState(pMap) || pMap;
    var pMapData = window.P && P.mapData;
    if (hasRegionMap(pMapData)) return bindFormalMapState(pMapData) || pMapData;
    var sm = getScenarioMapData();
    if (hasRegionMap(sm)) return bindFormalMapState(sm) || sm;
    if (Array.isArray(window.MING_MAP_REGIONS) && window.MING_MAP_REGIONS.length) {
      var sourceMeta = window.MING_MAP_SOURCE_META || window.MING_MAP_SOURCE || {};
      var sourceId = String(sourceMeta.id || sourceMeta.mapId || 'tianqi-ming2');
      // activeScenarioId is a scenario id, not a map id. Empty scenario map metadata
      // must not block the bundled Ming map fallback used by Tianqi/Chongzhen saves.
      return {
        id: sourceId,
        width: window.MING_MAP_WIDTH || 1200,
        height: window.MING_MAP_HEIGHT || 720,
        regions: window.MING_MAP_REGIONS,
        oceans: window.MING_MAP_OCEANS || [],
        factions: window.MING_MAP_FACTIONS || window.MING_OWNER_POWERS || {}
      };
    }
    ensureMapDataScript();
    return null;
  }

  function resolveBasemap(map){
    if (useGeneratedBasemap(map)) return '';
    var assets = map && map.assets;
    var source = map && map.source;
    var src = map && (map.basemap || map.baseMap || map.backgroundImage || map.background || map.previewImage);
    if (!src && assets) src = assets.basemap || assets.baseMap || assets.backgroundImage || assets.background || assets.image;
    if (!src && source) src = source.basemap || source.baseMap || source.backgroundImage || source.background || source.image;
    if (src && typeof src === 'object') src = src.src || src.url || src.path || src.href;
    if (src) return String(src);
    return '';
  }

  function useGeneratedBasemap(map){
    var base = window.EAST_ASIA_BASEMAP;
    if (!base || typeof base !== 'object' || Array.isArray(base)) return false;
    var id = String(mapIdentity(map) || '').toLowerCase();
    var source = (map && map.source) || {};
    var meta = (map && map.meta) || {};
    var name = [
      id,
      source.id,
      source.mapId,
      source.name,
      meta.id,
      meta.name,
      map && map.name
    ].filter(Boolean).join(' ').toLowerCase();
    if (name.indexOf('tianqi-ming2') >= 0 || name.indexOf('ming') >= 0) return true;
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    return regions.length > 10 && regions.slice(0, 12).every(function(r){
      return /^ming[-_]/i.test(String((r && (r.id || r.sourceId || r.mapRegionId)) || ''));
    });
  }

  function generatedBasemapLayer(map, basemapSrc){
    var width = Number((map && map.width) || 1200);
    var height = Number((map && map.height) || 720);
    if (useGeneratedBasemap(map)) {
      var base = window.EAST_ASIA_BASEMAP || {};
      var landPaths = Array.isArray(base.landPaths) ? base.landPaths : [];
      var lakePaths = Array.isArray(base.lakePaths) ? base.lakePaths : [];
      var riverPaths = Array.isArray(base.riverPaths) ? base.riverPaths : [];
      var geoLabels = Array.isArray(base.geoLabels) ? base.geoLabels : [];
      var baseImage = base.imageHref ? '<image class="generated-basemap" href="' + attr(base.imageHref) + '" x="0" y="0" width="' + attr(width) + '" height="' + attr(height) + '" preserveAspectRatio="none"></image>' : '';
      var basePaths = landPaths.map(function(d){
        return '<path class="east-base-region" d="' + attr(d) + '" fill-rule="evenodd"></path>';
      }).join('');
      var coastPaths = landPaths.map(function(d){
        return '<path class="east-coastline" d="' + attr(d) + '"></path>';
      }).join('');
      var lakes = lakePaths.map(function(d){
        return '<path class="east-lake" d="' + attr(d) + '"></path>';
      }).join('');
      var rivers = riverPaths.map(function(r){
        var d = typeof r === 'string' ? r : (r && r.d);
        if (!d) return '';
        return '<path class="east-river ' + attr(r && r.major ? 'major' : '') + '" d="' + attr(d) + '"></path>';
      }).join('');
      var grid = [260,420,580,740,900,1060].map(function(x){
        return '<path class="east-geo-grid" d="M' + x + ' 72 L' + x + ' 650"></path>';
      }).join('') + [150,285,420,555].map(function(y){
        return '<path class="east-geo-grid" d="M72 ' + y + ' L1128 ' + y + '"></path>';
      }).join('');
      var labels = geoLabels.map(function(r){
        return '<text class="east-base-label ' + attr(r && r.kind || '') + '" x="' + attr(r && r.x) + '" y="' + attr(r && r.y) + '">' + esc(r && r.text) + '</text>';
      }).join('');
      return '<g class="tmf-generated-basemap">' +
        '<g class="basemap-art">' + baseImage + '</g>' +
        '<ellipse class="ming-map-paper" cx="600" cy="370" rx="631" ry="384"></ellipse>' +
        '<ellipse class="east-sea-wash" cx="632" cy="405" rx="638" ry="380"></ellipse>' +
        '<g class="east-grid">' + grid + '</g>' +
        '<g class="east-base">' + basePaths + '</g>' +
        '<g class="east-lakes">' + lakes + '</g>' +
        '<g class="east-rivers">' + rivers + '</g>' +
        '<g class="east-coast">' + coastPaths + '</g>' +
        '<g class="terrain-under">' +
          '<path class="terrain-ridge" d="M136 390 C188 360 244 360 296 383 C344 404 394 397 440 368"></path>' +
          '<path class="terrain-ridge" d="M452 176 C520 150 586 151 651 174 C708 195 763 188 824 165"></path>' +
          '<path class="terrain-ridge" d="M455 465 C500 438 553 440 602 463 C645 482 690 476 736 452"></path>' +
          '<path class="terrain-hill" d="M290 488 C344 470 405 476 454 507"></path>' +
          '<path class="terrain-hill" d="M790 176 C840 156 897 161 945 191"></path>' +
          '<path class="terrain-shore" d="M912 248 C955 280 973 333 948 381 C923 430 945 481 1005 518"></path>' +
          '<path class="terrain-shore" d="M724 520 C778 552 840 552 890 524"></path>' +
        '</g>' +
        '<g class="east-base-labels">' + labels + '</g>' +
      '</g>';
    }
    if (!basemapSrc) return '';
    return '<image class="tmf-map-basemap" href="' + attr(basemapSrc) + '" x="0" y="0" width="' + attr(width) + '" height="' + attr(height) + '" preserveAspectRatio="none"></image>';
  }

  function pathForRegion(r){
    if (!r) return '';
    if (r.d) return r.d;
    if (r.path) return r.path;
    var pts = [];
    if (Array.isArray(r.points)) pts = r.points.map(function(p){ return Array.isArray(p) ? {x:p[0], y:p[1]} : p; });
    else if (Array.isArray(r.polygon)) pts = r.polygon;
    else if (Array.isArray(r.coords)) {
      for (var i = 0; i < r.coords.length - 1; i += 2) pts.push({ x: r.coords[i], y: r.coords[i + 1] });
    }
    pts = pts.filter(function(p){ return p && isFinite(p.x) && isFinite(p.y); });
    if (!pts.length) return '';
    return 'M' + pts.map(function(p){ return Number(p.x).toFixed(1) + ' ' + Number(p.y).toFixed(1); }).join(' L') + ' Z';
  }

  function centerForRegion(r){
    if (!r) return { x: 0, y: 0 };
    if (Array.isArray(r.center)) return { x: Number(r.center[0]) || 0, y: Number(r.center[1]) || 0 };
    if (r.centroid) return { x: Number(r.centroid.x) || 0, y: Number(r.centroid.y) || 0 };
    var pts = [];
    if (Array.isArray(r.points)) pts = r.points.map(function(p){ return Array.isArray(p) ? {x:p[0], y:p[1]} : p; });
    else if (Array.isArray(r.polygon)) pts = r.polygon;
    else if (Array.isArray(r.coords)) {
      for (var i = 0; i < r.coords.length - 1; i += 2) pts.push({ x: r.coords[i], y: r.coords[i + 1] });
    }
    pts = pts.filter(function(p){ return p && isFinite(p.x) && isFinite(p.y); });
    if (!pts.length) return { x: 0, y: 0 };
    return pts.reduce(function(acc, p){ acc.x += Number(p.x); acc.y += Number(p.y); return acc; }, { x: 0, y: 0, n: pts.length });
  }

  function pointsForRegion(r){
    var pts = [];
    if (!r) return pts;
    if (Array.isArray(r.points)) pts = r.points.map(function(p){ return Array.isArray(p) ? {x:p[0], y:p[1]} : p; });
    else if (Array.isArray(r.polygon)) pts = r.polygon;
    else if (Array.isArray(r.coords)) {
      for (var i = 0; i < r.coords.length - 1; i += 2) pts.push({ x: r.coords[i], y: r.coords[i + 1] });
    } else {
      var d = String(r.d || r.path || '');
      var nums = d.match(/-?\d+(?:\.\d+)?/g) || [];
      for (var j = 0; j < nums.length - 1; j += 2) pts.push({ x: Number(nums[j]), y: Number(nums[j + 1]) });
    }
    return pts.filter(function(p){ return p && isFinite(p.x) && isFinite(p.y); }).map(function(p){ return { x: Number(p.x), y: Number(p.y) }; });
  }

  function regionExtent(r){
    var pts = pointsForRegion(r);
    if (!pts.length) {
      var c = actualCenter(r);
      return { minX: c.x, maxX: c.x, minY: c.y, maxY: c.y, w: 0, h: 0, area: 0 };
    }
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function(p){
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    var w = Math.max(0, maxX - minX);
    var h = Math.max(0, maxY - minY);
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: w, h: h, area: w * h };
  }

  function actualCenter(r){
    var c = centerForRegion(r);
    if (c.n) return { x: c.x / c.n, y: c.y / c.n };
    return c;
  }

  // ── 地图标签几何：委托纯几何/字号/配色引擎 tm-map-label-geo.js（跨朝代通用·零游戏依赖·独立单测）──
  //   本文件只留「region 适配层」：pointsForRegion 取环 + WeakMap 按几何签名缓存(几何静态·frozen 剧本对象亦安全)。
  //   引擎未加载时全部安全回落(面积→bbox·锚点→actualCenter·字号→min·亮色→null)·不崩。
  function getTMGeo(){ return (typeof window !== 'undefined' && window.TMMapLabelGeo) || null; }
  function _tmGeoSig(pts){ return pts.length + (pts.length ? (':' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1)) : ''); }
  var _tmAreaCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  var _tmAnchorCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  function invalidateMapLabelGeometryCaches(){
    _tmAreaCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
    _tmAnchorCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  }
  // region 真面积(缓存·shoelace)·引擎缺失或无点→回落 bbox 面积。
  function regionTrueArea(r){
    if (!r) return 0;
    var pts = pointsForRegion(r), sig = _tmGeoSig(pts);
    var geo = getTMGeo();
    if (geo && _tmAreaCache) { var hit = _tmAreaCache.get(r); if (hit && hit.sig === sig) return hit.area; }
    var area = geo ? Math.abs(geo.polyAreaSigned(pts)) : 0;
    if (!(area > 0)) { var ext = regionExtent(r); area = ext.area || 0; }
    if (geo && _tmAreaCache) { try { _tmAreaCache.set(r, { sig: sig, area: area }); } catch (_) {} }
    return area;
  }
  // region 标签锚点(缓存·polylabel 内接圆心)·引擎缺失/无点→回落 actualCenter。
  function labelAnchor(r){
    if (!r) return { x: 0, y: 0 };
    var pts = pointsForRegion(r), sig = _tmGeoSig(pts);
    var geo = getTMGeo();
    if (geo && _tmAnchorCache) { var hit = _tmAnchorCache.get(r); if (hit && hit.sig === sig) return hit.anchor; }
    var a = (geo && pts.length >= 3) ? geo.polylabel(pts) : null;
    if (!a || !isFinite(a.x) || !isFinite(a.y)) a = actualCenter(r);
    if (geo && _tmAnchorCache) { try { _tmAnchorCache.set(r, { sig: sig, anchor: a }); } catch (_) {} }
    return a;
  }
  // 面积→字号 平滑幂律(委托引擎·缺失回落 min)。
  function _tmAreaFont(area, ref, base, k, min, max){ var geo = getTMGeo(); return geo ? geo.areaFont(area, ref, base, k, min, max) : min; }
  // 势力色亮化(委托引擎·缺失回落 null → CSS fallback 金)。
  function _tmBrightenLabelColor(color){ var geo = getTMGeo(); return geo ? geo.brightenLabelColor(color) : null; }

  // perf round6 (2026-06-10): 归一化结果 memo·载档/回合末地图刷新对同一批字符串
  // 反复 trim+regex+lower 数百万次·见 _admIdxCache 注释
  var _rknCache = new Map();
  function regionKeyNorm(v){
    var s = String(v === undefined || v === null ? '' : v);
    var hit = _rknCache.get(s);
    if (hit !== undefined) return hit;
    var out = s.trim().replace(/\s+/g, '').toLowerCase();
    if (_rknCache.size > 20000) _rknCache.clear();
    _rknCache.set(s, out);
    return out;
  }

  function pushUniqueValue(list, value){
    if (value === undefined || value === null || value === '') return;
    var text = String(value);
    if (list.indexOf(text) < 0) list.push(text);
  }

  function regionNameKeys(r){
    var data = Object.assign({}, (r && r.admin) || {}, (r && r.data) || {});
    var out = [];
    [
      r && r.id,
      r && r.name,
      r && r.title,
      r && r.officialName,
      r && r.sourceId,
      r && r.mapRegionId,
      r && r.adminBinding,
      data.id,
      data.name,
      data.title,
      data.officialName,
      data.province,
      data.provinceName,
      data.adminName,
      data.regionName
    ].forEach(function(v){ pushUniqueValue(out, v); });
    return out;
  }

  function plainObject(v){
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function hasValue(v){
    return v !== undefined && v !== null && v !== '';
  }

  function assignKnown(target){
    for (var i = 1; i < arguments.length; i += 1) {
      var src = arguments[i];
      if (!src || typeof src !== 'object') continue;
      Object.keys(src).forEach(function(k){
        if (hasValue(src[k])) target[k] = src[k];
      });
    }
    return target;
  }

  function regionMatchFields(node, objectKey){
    if (!node || typeof node !== 'object') return [objectKey];
    return [
      objectKey,
      node.id,
      node.sid,
      node.key,
      node.name,
      node.title,
      node.officialName,
      node.province,
      node.provinceName,
      node.adminName,
      node.regionName,
      node.mapRegionId,
      node.sourceId,
      node.adminBinding
    ];
  }

  // perf round7 (2026-06-10): 原版每个地块全扫 GM.provinceStats(每行 regionMatchFields+regionKeyNorm)·
  // 真档逐省 walk = renderFormalMap 主峰之一(实测 176ms)。同 round6 admin 索引法:
  // Phase2(字段扫)一次建 normKey->{行键,seq} 索引·查询取 seq 最小(=原「scan 序首个 fields∩wanted 的行」语义)·
  // Phase1(r 键直命 stats 对象键·原始键非归一化)仍 O(1) 现读·仅缓存「键映射」·值经 stats[key] 现读
  //(回合内值变仍可见)·按 (stats 引用, 回合) 失效(同 round6·回合内新增省到下回合才入索引)。
  var _provStatsIdxCache = { ref: null, turn: -1, map: null };
  function _provStatsIndex(stats){
    var turn = (window.GM && GM.turn) || 0;
    if (_provStatsIdxCache.map && _provStatsIdxCache.ref === stats && _provStatsIdxCache.turn === turn) return _provStatsIdxCache.map;
    var m = new Map();
    var seq = 0;
    function regRow(rowKey, value){
      if (value && typeof value === 'object') {
        var fields = regionMatchFields(value, rowKey).map(regionKeyNorm);
        for (var i = 0; i < fields.length; i += 1) {
          var f = fields[i];
          if (f && !m.has(f)) m.set(f, { seq: seq, key: rowKey });
        }
      }
      seq += 1;
    }
    if (Array.isArray(stats)) {
      for (var j = 0; j < stats.length; j += 1) regRow('', stats[j]);
    } else if (stats && typeof stats === 'object') {
      Object.keys(stats).forEach(function(k){ regRow(k, stats[k]); });
    }
    _provStatsIdxCache.ref = stats; _provStatsIdxCache.turn = turn; _provStatsIdxCache.map = m;
    return m;
  }
  function findLiveProvinceStats(r){
    var stats = window.GM && GM.provinceStats;
    if (!stats) return null;
    var keys = regionNameKeys(r);
    var wanted = keys.map(regionKeyNorm).filter(Boolean);
    if (!wanted.length) return null;
    if (!Array.isArray(stats) && typeof stats === 'object') {
      for (var i = 0; i < keys.length; i += 1) {
        if (stats[keys[i]] && typeof stats[keys[i]] === 'object') return Object.assign({ _provinceKey: keys[i] }, stats[keys[i]]);
      }
    }
    var idx = _provStatsIndex(stats);
    var best = null;
    for (var w = 0; w < wanted.length; w += 1) {
      var hit = idx.get(wanted[w]);
      if (hit && (best === null || hit.seq < best.seq)) best = hit;
    }
    if (!best) return null;
    var value = Array.isArray(stats) ? stats[best.seq] : stats[best.key];
    if (!value || typeof value !== 'object') return null;
    return Object.assign({ _provinceKey: best.key }, value);
  }

  // perf round6 (2026-06-10): 原版对每个地块全树深走两棵 adminHierarchy
  // (seen 还是数组 indexOf=节点级 O(n²)·每节点 14 字段 regex 归一化)·
  // 大档实测 = 载档后单个 12s 长任务(walk 6.4s + regionKeyNorm 3.2s)。
  // 改为同一遍历序一次建 normKey→{node,seq} 索引·查询取 seq 最小者
  // (= 原版「walk 序第一个命中任一 wanted 键的节点」语义)·
  // 按 (GM根引用, P根引用, 回合) 失效·回合内字段级变更经引用仍可见。
  var _admIdxCache = { gmRoot: null, pRoot: null, turn: -1, map: null };
  function _buildAdminIndex(gmRoot, pRoot){
    var map = new Map();
    var seen = new Set();
    var seq = 0;
    function reg(key, kind, node, objectKey){
      if (!key) return;
      if (!map.has(key)) map.set(key, { kind: kind, node: node, objectKey: objectKey, seq: seq++ });
      else seq++;
    }
    function walk(node, objectKey){
      if (!node || typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        node.forEach(function(item){ walk(item, objectKey); });
        return;
      }
      if (node.id) reg(regionKeyNorm(node.id), 'id', node, objectKey);  // id 精确登记·防同名/别名歧义
      var fields = regionMatchFields(node, objectKey);
      for (var i = 0; i < fields.length; i += 1) {
        reg(regionKeyNorm(fields[i]), 'field', node, objectKey);
      }
      Object.keys(node).forEach(function(k){
        var child = node[k];
        if (!child || typeof child !== 'object') return;
        reg(regionKeyNorm(k), 'key', child, k);
        walk(child, k);
      });
    }
    if (gmRoot) walk(gmRoot, '');
    if (pRoot) walk(pRoot, '');
    return map;
  }
  function findLiveAdminDivision(r){
    var wanted = regionNameKeys(r).map(regionKeyNorm).filter(Boolean);
    var idKey = (r && r.id) ? regionKeyNorm(r.id) : '';
    if (!wanted.length && !idKey) return null;
    var gmRoot = (window.GM && GM.adminHierarchy) || null;
    var pRoot = (window.P && P.adminHierarchy) || null;
    if (!gmRoot && !pRoot) return null;
    var turn = (window.GM && GM.turn) || 0;
    if (_admIdxCache.map === null || _admIdxCache.gmRoot !== gmRoot || _admIdxCache.pRoot !== pRoot || _admIdxCache.turn !== turn) {
      _admIdxCache.gmRoot = gmRoot;
      _admIdxCache.pRoot = pRoot;
      _admIdxCache.turn = turn;
      _admIdxCache.map = _buildAdminIndex(gmRoot, pRoot);
    }
    // id 精确匹配优先(region.id ↔ admin node.id)·命中即返回·防同名/别名走偏
    if (idKey) {
      var idHit = _admIdxCache.map.get(idKey);
      if (idHit && idHit.kind === 'id') return idHit.node;
    }
    var best = null;
    for (var i = 0; i < wanted.length; i += 1) {
      var hit = _admIdxCache.map.get(wanted[i]);
      if (hit && (best === null || hit.seq < best.seq)) best = hit;
    }
    if (!best) return null;
    if (best.kind === 'key') return Object.assign({ name: best.objectKey }, best.node);
    return best.objectKey && !best.node.name ? Object.assign({ name: best.objectKey }, best.node) : best.node;
  }

  // 活态地块要素（2026-06-13 死字段修）：地块真实民心/吏治/繁荣/民变 = 活区划「叶子」的人口加权聚合。
  // 病根钉死：minxin/corruption/prosperity 引擎(tm-minxin-hard-links / fiscal / region-status)只逐回合更新
  // 叶子(顺天府…)，省级节点与地图 r.data 是另一对象、开局后从不回滚——故视图/册页读 r.data.minxinLocal /
  // 省节点 .minxin 恒显开局死值。此处一次聚合活叶供 regionBundle 覆盖静态字段。按(回合)失效·与本文件其余索引同策。
  var _liveVitalsCache = { turn: -1, byRegion: {} };
  function liveRegionVitals(r, liveDivision){
    var turn = (window.GM && GM.turn) || 0;
    if (_liveVitalsCache.turn !== turn) _liveVitalsCache = { turn: turn, byRegion: {} };
    var rid = String((r && (r.id || r.name)) || '');
    if (rid && _liveVitalsCache.byRegion[rid]) return _liveVitalsCache.byRegion[rid];
    var root = liveDivision || findLiveAdminDivision(r);
    var mxW = 0, mxWsum = 0, corrW = 0, corrWsum = 0, prosW = 0, prosWsum = 0, unrestMax = NaN, leaves = 0;
    var popSum = 0, farmlandSum = 0, commerceSum = 0;  // 子地块「求和」聚到父(人口/田亩/商业·量纲可加)·区别于民心等「加权平均」
    var fcClaimed = 0, fcActual = 0, fcRemit = 0, fcRetain = 0, fiscalLeaves = 0;  // P0-2(2026-06-20): 子叶 fiscalDetail 四账求和(省=Σ府)
    function leafPop(d){
      return (d.population && typeof d.population === 'object') ? (Number(d.population.mouths) || 0)
           : (typeof d.population === 'number' ? d.population : 0);
    }
    function leafWeight(d){ var p = leafPop(d); return p > 0 ? p : 1; }
    (function walk(d){
      if (!d || typeof d !== 'object') return;
      var kids = d.children || d.divisions;
      if (kids && kids.length) { for (var i = 0; i < kids.length; i += 1) walk(kids[i]); return; }
      leaves += 1;
      var w = leafWeight(d);
      if (typeof d.minxin === 'number' && isFinite(d.minxin)) { mxW += d.minxin * w; mxWsum += w; }
      if (typeof d.corruption === 'number' && isFinite(d.corruption)) { corrW += d.corruption * w; corrWsum += w; }
      if (typeof d.prosperity === 'number' && isFinite(d.prosperity)) { prosW += d.prosperity * w; prosWsum += w; }
      var u = Number(d.unrest); if (isFinite(u)) unrestMax = isFinite(unrestMax) ? Math.max(unrestMax, u) : u;
      popSum += leafPop(d);
      var eb = d.economyBase || {};
      farmlandSum += Number(eb.farmland) || 0;
      commerceSum += Number(eb.commerceVolume) || 0;
      var lfd = d.fiscalDetail;  // P0-2: 求和叶级 minxin 四账(与叶面板同源)
      if (lfd && (typeof lfd.actualRevenue === 'number' || typeof lfd.claimedRevenue === 'number')) {
        fcClaimed += Number(lfd.claimedRevenue) || 0;
        fcActual += Number(lfd.actualRevenue) || 0;
        fcRemit += Number(lfd.remittedToCenter) || 0;
        fcRetain += Number(lfd.retainedBudget) || 0;
        fiscalLeaves += 1;
      }
    })(root);
    var out = {
      minxin: mxWsum ? Math.round((mxW / mxWsum) * 10) / 10 : null,
      corruption: corrWsum ? Math.round((corrW / corrWsum) * 10) / 10 : null,
      prosperity: prosWsum ? Math.round((prosW / prosWsum) * 10) / 10 : null,
      unrest: isFinite(unrestMax) ? unrestMax : null,
      population: popSum,           // 子地块人口总和(府县→省·求和)
      farmland: farmlandSum,        // 子地块田亩总和
      commerceVolume: commerceSum,  // 子地块商业总和
      fiscal: fiscalLeaves ? { claimedRevenue: fcClaimed, actualRevenue: fcActual, remittedToCenter: fcRemit, retainedBudget: fcRetain, leaves: fiscalLeaves } : null,  // P0-2: 子叶四账求和
      leaves: leaves
    };
    if (rid) _liveVitalsCache.byRegion[rid] = out;
    return out;
  }

  // region 几何级父子索引(按 region.parentId)·阶段2分级渲染用:省 region→其府县 children regions·
  //   省级显示 merge 府县轮廓 / 点省聚焦下辖府县。按 map 引用失效。
  var _regionChildIdxCache = { ref: null, byParent: null, byId: null };
  function regionChildIndex(map){
    if (_regionChildIdxCache.ref === map && _regionChildIdxCache.byParent) return _regionChildIdxCache;
    var byParent = {}, byId = {};
    var regions = (map && map.regions) || [];
    regions.forEach(function(r){
      if (!r) return;
      var rid = r.id || r.name;
      if (rid) byId[rid] = r;
      if (r.parentId){ (byParent[r.parentId] = byParent[r.parentId] || []).push(r); }
    });
    _regionChildIdxCache = { ref: map, byParent: byParent, byId: byId };
    return _regionChildIdxCache;
  }
  function regionChildren(map, parentRegion){
    if (!parentRegion) return [];
    var pid = parentRegion.id || parentRegion.name;
    return (pid && regionChildIndex(map).byParent[pid]) || [];
  }
  function regionParent(map, childRegion){
    if (!childRegion || !childRegion.parentId) return null;
    return regionChildIndex(map).byId[childRegion.parentId] || null;
  }

  // perf round7: 原版每地块全扫 GM._provinceToFaction 的 Object.keys·逐省 = renderFormalMap 主峰之一(111ms)。
  // 同法:Phase2 一次建 normKey->{key,seq} 索引(首现胜)·取 seq 最小(=Object.keys 序首个 normKey∈wanted 的键)·
  // 值 map[key] 现读(回合内归属变可见)·按 (map 引用, 回合) 失效。
  var _provFacIdxCache = { ref: null, turn: -1, map: null };
  function _provFacIndex(map){
    var turn = (window.GM && GM.turn) || 0;
    if (_provFacIdxCache.map && _provFacIdxCache.ref === map && _provFacIdxCache.turn === turn) return _provFacIdxCache.map;
    var m = new Map();
    var seq = 0;
    Object.keys(map).forEach(function(k){
      var nk = regionKeyNorm(k);
      if (nk && !m.has(nk)) m.set(nk, { key: k, seq: seq });
      seq += 1;
    });
    _provFacIdxCache.ref = map; _provFacIdxCache.turn = turn; _provFacIdxCache.map = m;
    return m;
  }
  function liveOwnerFromProvinceMap(r){
    var map = window.GM && GM._provinceToFaction;
    if (!map || typeof map !== 'object') return '';
    var keys = regionNameKeys(r);
    for (var i = 0; i < keys.length; i += 1) {
      if (hasValue(map[keys[i]])) return map[keys[i]];
    }
    var wanted = keys.map(regionKeyNorm).filter(Boolean);
    if (!wanted.length) return '';
    var idx = _provFacIndex(map);
    var best = null;
    for (var w = 0; w < wanted.length; w += 1) {
      var hit = idx.get(wanted[w]);
      if (hit && (best === null || hit.seq < best.seq)) best = hit;
    }
    if (!best) return '';
    return hasValue(map[best.key]) ? map[best.key] : '';
  }

  function ownerFromRecord(record){
    if (!record || typeof record !== 'object') return '';
    return firstValue(
      record.currentOwner,
      record.currentOwnerName,
      record.controller,
      record.controllerName,
      record.owner,
      record.ownerName,
      record.currentOwnerKey,
      record.controllerKey,
      record.ownerKey,
      record.factionId,
      record.factionKey,
      record.factionName,
      record.currentFactionName,
      record.power,
      record.realm
    );
  }

  function liveRegionOwner(r, liveStats, liveDivision){
    return firstValue(
      liveOwnerFromProvinceMap(r),
      ownerFromRecord(liveStats || findLiveProvinceStats(r)),
      ownerFromRecord(liveDivision || findLiveAdminDivision(r))
    );
  }

  // ★地方主官绑定官职持有人:剧本里 division.governor 是死字段(初始设定·任命/赴任/死亡都不更新)。
  // 按区划治理官职 officialPosition 在 GM.chars 找在世持有人——char.title 常为净官职(如「顺天巡抚」与
  // officialPosition 精确等值)·officialTitle 含兼衔(如「顺天巡抚·都察院右副都御史」)故以起头/包含匹配。
  function liveRegionGovernor(officePosition){
    if (!officePosition || typeof window === 'undefined' || !window.GM || !Array.isArray(GM.chars)) return null;
    var op = String(officePosition).trim();
    if (!op) return null;
    // ★唯一匹配才派生(朝代中立·不硬编泛称表):专称如「顺天巡抚」全场唯一→派生;泛称如「知府」多人匹配→歧义→null→保静态。
    var hit = null;
    for (var i = 0; i < GM.chars.length; i += 1) {
      var c = GM.chars[i];
      if (!c || c.alive === false || c.dead === true) continue;
      var title = String(c.title || '').trim();
      var ot = String(c.officialTitle || '').trim();
      if (title === op || (ot && (ot === op || ot.split('·')[0].trim() === op || ot.indexOf(op) === 0))) {
        if (hit) return null;   // 第二个匹配=泛称歧义·不派生
        hit = c;
      }
    }
    return hit;
  }

  function ownerKey(r){
    if (!r) return '';
    var liveOwner = liveRegionOwner(r);
    if (liveOwner) return String(liveOwner);
    var data = Object.assign({}, r.admin || {}, r.data || {});
    return String(r.currentOwner || r.controller || r.owner || r.currentOwnerKey || r.controllerKey || r.ownerKey || r.factionId || data.factionId || data.groupKey || '');
  }

  function ownerName(r){
    if (!r) return '';
    var key = ownerKey(r);
    // 2026-06-12: 无任何归属线索时直接返回空——findFaction('') 会误回首个势力，
    // 致无主地块显示「隶 明朝廷」（旧版同病·随册页重构一并修）。
    if (!key && !r.factionName && !r.ownerName) return '';
    var f = findFaction(key, r.factionName || r.ownerName);
    return (f && (f.label || f.name || f.scenarioFactionName)) || r.factionName || r.ownerName || key || '';
  }

  function canonicalOwnerKey(r){
    var raw = ownerKey(r);
    var f = findFaction(raw, r && (r.factionName || r.ownerName));
    return (f && (f.stableOwnerKey || f.mapFactionId || f.id)) || raw;
  }

  function factionsMap(){
    var map = getMapData() || {};
    return map.factions || map.factionColors || {};
  }

  function normKey(v){
    return String(v === undefined || v === null ? '' : v).trim().toLowerCase();
  }

  function factionTokens(f, key, name){
    var out = [key, name];
    if (f) {
      out.push(f.id, f.sid, f.key, f.scenarioFactionId, f.runtimeFactionId, f.mapFactionId);
      out.push(f.name, f.label, f.short, f.scenarioFactionName, f.ownerKey, f.stableOwnerKey);
    }
    return out.filter(function(x){ return x !== undefined && x !== null && x !== ''; }).map(normKey);
  }

  function liveFactionList(){
    var lists = [];
    var gm = window.GM || {};
    var p = window.P || {};
    var sc = getActiveScenario();
    if (Array.isArray(gm.facs)) lists.push(gm.facs);
    if (Array.isArray(gm.factions)) lists.push(gm.factions);
    if (Array.isArray(p.factions)) lists.push(p.factions);
    if (sc && Array.isArray(sc.factions)) lists.push(sc.factions);
    var sid = activeScenarioId();
    var seen = {};
    var out = [];
    lists.forEach(function(list){
      list.forEach(function(f, i){
        if (!f || typeof f !== 'object') return;
        if (sid && f.sid && String(f.sid) !== sid) return;
        var key = String(f.id || f.sid || f.key || f.name || f.label || ('live-' + i));
        if (seen[key]) return;
        seen[key] = true;
        out.push(f);
      });
    });
    return out;
  }

  function bestLiveFaction(mapFaction, key, name){
    var want = factionTokens(mapFaction, key, name);
    var live = liveFactionList();
    var best = null;
    var bestScore = 0;
    live.forEach(function(f){
      var tokens = factionTokens(f);
      var score = 0;
      tokens.forEach(function(t){
        if (!t) return;
        if (want.indexOf(t) >= 0) score += 10;
        want.forEach(function(w){
          if (!w || w === t) return;
          if (w.length >= 2 && t.length >= 2 && (w.indexOf(t) >= 0 || t.indexOf(w) >= 0)) score += 2;
        });
      });
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    });
    return bestScore > 0 ? best : null;
  }

  function mergeFactionData(mapFaction, liveFaction, stableKey){
    var merged = Object.assign({}, mapFaction || {}, liveFaction || {});
    var mapId = mapFaction && (mapFaction.id || mapFaction.key || stableKey);
    var liveId = liveFaction && (liveFaction.id || liveFaction.sid || liveFaction.key);
    merged.id = stableKey || mapId || liveId || merged.id || '';
    merged.mapFactionId = mapId || '';
    merged.runtimeFactionId = liveId || '';
    merged.stableOwnerKey = stableKey || mapId || merged.ownerKey || '';
    merged.label = firstValue(liveFaction && liveFaction.label, liveFaction && liveFaction.name, mapFaction && mapFaction.label, merged.label, merged.name);
    merged.name = firstValue(liveFaction && liveFaction.name, liveFaction && liveFaction.label, mapFaction && mapFaction.name, mapFaction && mapFaction.label, merged.name, merged.label);
    merged.short = firstValue(liveFaction && liveFaction.short, mapFaction && mapFaction.short, merged.short, merged.label, merged.name);
    merged.color = firstValue(liveFaction && liveFaction.color, mapFaction && mapFaction.color, mapFaction && mapFaction.line, merged.color);
    merged.line = firstValue(liveFaction && liveFaction.line, mapFaction && mapFaction.line, mapFaction && mapFaction.color, merged.line);
    merged._mapFaction = mapFaction || null;
    merged._runtimeFaction = liveFaction || null;
    return merged;
  }

  function findFaction(key, name){
    var fmap = factionsMap();
    var mapHit = null;
    var stableKey = key || '';
    if (key && fmap[key]) mapHit = Object.assign({ id: key }, fmap[key]);
    var vals = Object.keys(fmap).map(function(k){ return Object.assign({ id: k }, fmap[k]); });
    if (!mapHit) {
      mapHit = vals.find(function(f){
        return normKey(f.scenarioFactionId) === normKey(key) ||
          normKey(f.id) === normKey(key) ||
          normKey(f.label || f.name || f.scenarioFactionName) === normKey(name || key);
      }) || null;
      if (mapHit) stableKey = mapHit.id || stableKey;
    }
    var liveHit = bestLiveFaction(mapHit, stableKey || key, name || (mapHit && (mapHit.label || mapHit.name)));
    if (mapHit || liveHit) return mergeFactionData(mapHit, liveHit, stableKey || (mapHit && mapHit.id) || key || '');
    return null;
  }

  // heatColor 三档插值已删（2026-06-11）——着色统一走 GRADE_BANDS 五档（gradeOf）。

  function classPressureForRegion(r){
    var gm = window.GM || {};
    var wanted = regionNameKeys(r).map(regionKeyNorm).filter(Boolean);
    var rows = [];
    function regionHit(item){
      var raw = item && (item.region || item.name || item.id || item);
      var key = regionKeyNorm(raw);
      return !!(key && wanted.some(function(w){ return key === w || key.indexOf(w) >= 0 || w.indexOf(key) >= 0; }));
    }
    (Array.isArray(gm._classMinxinBridgeLedger) ? gm._classMinxinBridgeLedger : []).forEach(function(row){
      if (!row) return;
      var applied = Array.isArray(row.appliedRegions) ? row.appliedRegions : [];
      var weighted = Array.isArray(row.regionWeights) ? row.regionWeights : [];
      if (!applied.some(regionHit) && !weighted.some(regionHit)) return;
      rows.push(row);
    });
    var score = 0;
    var classNames = [];
    var reasons = [];
    rows.slice(-8).forEach(function(row){
      var delta = Number(row.delta);
      var satDelta = Number(row.satisfactionDelta);
      var localScore = Math.abs(isFinite(delta) ? delta : 0) * 34 + Math.abs(isFinite(satDelta) && satDelta < 0 ? satDelta : 0) * 2.2;
      score = Math.max(score, localScore);
      if (row.className && classNames.indexOf(row.className) < 0) classNames.push(row.className);
      if (row.reason) reasons.push(row.reason);
    });
    try {
      if (window.TM && TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge.snapshot === 'function') {
        var snap = TM.ClassMinxinBridge.snapshot(gm, { limit: 12 });
        Object.keys(snap.byClass || {}).forEach(function(k){
          var row = snap.byClass[k] || {};
          var last = row.lastPressure || {};
          if (!Array.isArray(last.appliedRegions) || !last.appliedRegions.some(regionHit)) return;
          var truth = Number(row.true != null ? row.true : row.index);
          if (isFinite(truth) && truth < 45) score = Math.max(score, (45 - truth) * 2.1);
          if (row.className && classNames.indexOf(row.className) < 0) classNames.push(row.className);
          if (last.reason) reasons.push(last.reason);
        });
      }
    } catch(_) {}
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      count: rows.length,
      classNames: classNames.slice(0, 3),
      reason: reasons.slice(-1)[0] || ''
    };
  }

  function regionColor(r){
    // 2026-06-11: 数据视图改五档色板（modeScore 动态结算→gradeOf 查档）·旧 heatColor 三档插值
    // 按绝对量着色（实征 0-300 万/驻军 0-25 万）富省恒绿穷省恒红·看不出「该收的收没收上来」。
    var mode = state.mapMode;
    if (mode === 'tax' || mode === 'mood' || mode === 'army' || mode === 'office' || mode === 'classPressure' || mode === 'yizheng') {
      var g = gradeOf(mode, modeScore(r, mode));
      if (g) return g.color;
    }
    var f = findFaction(ownerKey(r), r.factionName || r.ownerName);
    return (f && (f.color || f.line)) || r.factionColor || r.color || '#b7914f';
  }

  function ownerGroups(map){
    var legacy = (typeof window !== 'undefined' && window.__TM_LABEL_LEGACY);
    var groups = {};
    (map && map.regions || []).forEach(function(r){
      var key = canonicalOwnerKey(r);
      if (!key) return;
      var c = actualCenter(r);
      if (!isFinite(c.x) || !isFinite(c.y)) return;
      if (!groups[key]) {
        var f = findFaction(key, r.factionName || r.ownerName);   // 势力本色(mode 无关·数据视图下也用势力色标名)
        var fc = (f && (f.color || f.line)) || r.factionColor || r.color || regionColor(r);
        groups[key] = { key: key, name: ownerName(r), color: regionColor(r), factionColor: fc, x: 0, y: 0, n: 0, area: 0, minX: c.x, maxX: c.x, minY: c.y, maxY: c.y, _biggest: null, _bigArea: -1, _wx: 0, _wy: 0, _wsum: 0, _regs: [] };
      }
      var g = groups[key];
      var ext = regionExtent(r);
      var ta = legacy ? Math.max(1, ext.area || 0) : Math.max(1, regionTrueArea(r));   // 势力大小=领土真面积之和
      g.x += c.x;
      g.y += c.y;
      g.n += 1;
      g.area += ta;
      g._wx += c.x * ta; g._wy += c.y * ta; g._wsum += ta;         // 面积加权质心(全领土居中的中心)
      g._regs.push(r);
      if (ta > g._bigArea) { g._bigArea = ta; g._biggest = r; }
      g.minX = Math.min(g.minX, ext.minX, c.x);
      g.maxX = Math.max(g.maxX, ext.maxX, c.x);
      g.minY = Math.min(g.minY, ext.minY, c.y);
      g.maxY = Math.max(g.maxY, ext.maxY, c.y);
    });
    return Object.keys(groups).map(function(k){
      var g = groups[k];
      var avgx = g.x / Math.max(1, g.n), avgy = g.y / Math.max(1, g.n);
      // 势力名锚点：全领土居中(面积加权质心·落域内则用之)·否则吸附最近本势力地块内接圆心(保证在领土内)
      if (legacy) { g.x = avgx; g.y = avgy; }
      else { var a = _factionLabelAnchor(g, avgx, avgy); g.x = a.x; g.y = a.y; }
      g.span = Math.sqrt(Math.pow(Math.max(0, g.maxX - g.minX), 2) + Math.pow(Math.max(0, g.maxY - g.minY), 2));
      g._regs = null;
      return g;
    }).sort(function(a, b){ return b.n - a.n; });
  }

  // 势力名锚点：全领土面积加权质心 → 落在本势力任一地块内则用之(居中)·否则吸附到内接圆心离质心最近的本势力地块(既近中心又在领土内)。
  function _factionLabelAnchor(g, avgx, avgy){
    var cx = g._wsum > 0 ? g._wx / g._wsum : avgx, cy = g._wsum > 0 ? g._wy / g._wsum : avgy;
    var regs = g._regs || [];
    var geo = getTMGeo();
    if (geo && regs.length) {
      for (var i = 0; i < regs.length; i++) {                     // 质心是否落在本势力某地块内
        var pts = pointsForRegion(regs[i]);
        if (pts.length >= 3 && geo.pointToPolyDist(cx, cy, pts) > 0) return { x: cx, y: cy };
      }
      var best = null, bestD = Infinity;                          // 落缝隙/飞地外→吸附最近本势力地块内接圆心
      for (var j = 0; j < regs.length; j++) {
        var an = labelAnchor(regs[j]);
        if (!an || !isFinite(an.x)) continue;
        var d = (an.x - cx) * (an.x - cx) + (an.y - cy) * (an.y - cy);
        if (d < bestD) { bestD = d; best = an; }
      }
      if (best) return { x: best.x, y: best.y };
    }
    if (g._biggest) { var lb = labelAnchor(g._biggest); if (lb && isFinite(lb.x)) return lb; }   // 引擎缺失兜底
    return { x: avgx, y: avgy };
  }

  function factionLabelLayer(map){
    var legacy = (typeof window !== 'undefined' && window.__TM_LABEL_LEGACY);
    var groups = ownerGroups(map);
    var maxArea = Math.max.apply(null, groups.map(function(g){ return Number(g.area || 0); }).concat([1]));
    var maxN = Math.max.apply(null, groups.map(function(g){ return Number(g.n || 0); }).concat([1]));
    var maxSpan = Math.max.apply(null, groups.map(function(g){ return Number(g.span || 0); }).concat([1]));
    var geo = getTMGeo();
    // 势力名字号按疆域「真面积」铺满区间：最小势力→MINF、最大→MAXF·中间 area^K 平滑铺开(owner: 大够大/小够小/均匀按面积)
    var facAreas = groups.map(function(g){ return Number(g.area || 0); }).filter(function(a){ return a > 0; });
    var minA = facAreas.length ? Math.min.apply(null, facAreas) : 1;
    var maxA = facAreas.length ? Math.max.apply(null, facAreas) : 1;
    return groups.map(function(g){
      var name = realmFactionName(g), nlen = String(name).length || 1;
      var size = (legacy && geo) ? geo.legacyFactionSize(Number(g.area||0), maxArea, Number(g.n||0), maxN, Number(g.span||0), maxSpan, nlen) : realmLabelSize(Number(g.area||0), minA, maxA);
      var rotate = realmLabelRotation(g.key || name);
      var lw = Math.max(size * 1.05, nlen * size * 1.12), lh = size * 1.25;   // 纯文字盒(无框·含 .34em 字距)·供防重叠
      var style = '--realm-label-size:' + size + 'px';
      if (!legacy) { var bc = _tmBrightenLabelColor(g.factionColor); if (bc) style += ';--realm-label-color:' + bc; }
      return '<g class="tmf-faction-label" data-faction-key="' + attr(g.key) + '" data-fs="' + attr(size) + '" data-lw="' + attr(Math.round(lw)) + '" data-lh="' + attr(Math.round(lh)) + '" data-ax="' + attr(Math.round(g.x)) + '" data-ay="' + attr(Math.round(g.y)) + '" data-pr="' + attr(size) + '" style="' + style + '" transform="translate(' + attr(g.x) + ' ' + attr(g.y) + ') rotate(' + attr(rotate) + ')" onclick="TMPhase8FormalBridge.openFactionByKey(\'' + attr(g.key) + '\')">' +
        '<text class="main" x="0" y="0" text-anchor="middle">' + esc(name) + '</text>' +
      '</g>';
    }).join('');
  }

  // 势力名 ∝ 领土真面积·平滑幂律 k=0.38(≈按边长·比旧 sqrt 三项混合更贴「面积」且不失衡)·长名收敛·单块封顶
  // 势力名字号：把[最小势力面积,最大势力面积]映射到[MINF,MAXF]·中间按 area^K 平滑铺开——
  // 最大势力恒得 MAXF、最小恒得 MINF·无长度惩罚·无单块封顶(纯按面积·大够大/小够小)。K 越大越拉开顶部。
  function realmLabelSize(area, minA, maxA){
    var MINF = 13, MAXF = 82, K = 0.62;
    if (!(area > 0)) return MINF;
    var lo = Math.pow(Math.max(1, minA), K), hi = Math.pow(Math.max(1, maxA), K), v = Math.pow(area, K);
    var t = (hi > lo) ? (v - lo) / (hi - lo) : 0.5;
    t = Math.max(0, Math.min(1, t));
    return Math.round(MINF + t * (MAXF - MINF));
  }

  function realmFactionName(g){
    var raw = (g && (g.name || g.key)) || '';
    var name = cleanDisplayValue(raw);
    if (!name || name === '已记录') name = String(raw || '未记势力');
    return name.replace(/朝廷$/g, '').replace(/^大明帝国$/g, '大明');
  }

  function realmLabelRotation(seed){
    var s = String(seed || '');
    var n = 0;
    for (var i = 0; i < s.length; i += 1) n = (n + s.charCodeAt(i) * (i + 3)) % 997;
    return (n % 13) - 6;
  }

  // 哨牌层（2026-06-11）：数据视图下每地块中心下方一枚圆牌显示 modeScore 数值/档字。
  // 色不孤行——着色五档之外哨牌给精确读数，色弱玩家亦可读。owner 视图返回空（无哨牌）。
  function sentinelLayer(map){
    var mode = state.mapMode;
    if (!mode || mode === 'owner' || !GRADE_BANDS[mode]) return '';
    return (map.regions || []).map(function(r){
      var score = modeScore(r, mode);
      var grade = gradeOf(mode, score);
      if (!grade) return '';
      var c = actualCenter(r);
      var label = (mode === 'army') ? grade.mark : (score === '' || score === null ? grade.mark : String(score));
      return '<g class="tmf-sentinel' + (gradeIsWarn(mode, grade) ? ' warn' : '') + '" transform="translate(' + attr(c.x) + ' ' + attr(c.y + 17) + ')"><circle r="11"></circle><text>' + esc(label) + '</text></g>';
    }).join('');
  }

  function renderFormalMapSoon(){
    clearTimeout(state.mapRenderTimer);
    state.mapRenderTimer = setTimeout(renderFormalMap, 0);
  }

  var _labelFeatureRequested = false;
  function requestMapLabelFeature(){
    if (_labelFeatureRequested || !window.TM || !TM.Features || typeof TM.Features.ensure !== 'function') return;
    _labelFeatureRequested = true;
    var load = typeof TM.Features.ensureRecoverable === 'function'
      ? TM.Features.ensureRecoverable('formalMapLabels', { retryLoadError: true, retryInitError: true })
      : TM.Features.ensure('formalMapLabels');
    load.catch(function(error){
      if (window.console && typeof window.console.warn === 'function') window.console.warn('[phase8-formal-map] 标签 feature 加载失败', error);
    });
  }

  // ── 阶段3·zoom 联动(CK3)：缩放跨阈值自动切 mapScale 层级·按钮切层亦带动缩放·单一真相=mapView.scale ──
  function scaleToBand(sc){
    sc = Number(sc) || 1;
    return sc >= 2.3 ? 'prefecture' : (sc >= 1.3 ? 'region' : 'realm');
  }
  function bandToScale(band){
    return band === 'prefecture' ? 3.0 : (band === 'realm' ? 1.0 : 1.7);
  }
  function _syncScaleLevelFromZoom(){
    if (state._zoomLevelLinkOff) return;  // 逃生阀:置真则关 zoom 联动(纯按钮切层)
    var sc = (state.mapView && state.mapView.scale) || 1;
    var band = scaleToBand(sc);
    if (band !== state.mapScale){
      state.mapScale = band;
      updateMapChrome();
      renderFormalMapSoon();  // 异步重渲(画新层级·避免 applyMapTransform 内同步递归)
    }
  }

  function zoomMap(factor){
    var v = state.mapView || { scale: 1, tx: 0, ty: 0 };
    v.scale = Math.max(0.72, Math.min(4.2, Number(v.scale || 1) * (factor || 1)));
    state.mapView = v;
    applyMapTransform();
  }

  function resetMapView(){
    state.mapView = { scale: 1, tx: 0, ty: 0 };
    applyMapTransform();
  }

  function updateMapChrome(){
    var wrap = document.getElementById('mapwrap');
    if (wrap) {
      wrap.dataset.mapMode = state.mapMode || 'owner';
      wrap.dataset.mapScale = state.mapScale || 'region';
    }
    document.querySelectorAll('.map-layer').forEach(function(btn){
      var on = btn.dataset.mapMode === state.mapMode;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-map-scale]').forEach(function(btn){
      if (btn.id === 'mapwrap') return;
      var on = btn.dataset.mapScale === state.mapScale;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    var mode = document.getElementById('map-tools-mode');
    if (mode) mode.textContent = mapModeTitle();
    var hint = document.getElementById('tmf-map-hint');
    if (hint) hint.textContent = mapScaleNote() + ' · ' + mapModeNote();
  }

  function mapScaleNote(){
    return ({ realm:'天下视域', region:'行省视域', prefecture:'府县视域' })[state.mapScale || 'region'] || '行省视域';
  }

  function mapModeNote(){
    if (state.mapMode === 'classPressure') return '按阶层民心桥接账本着色';
    return ({
      owner:'按势力归属着色',
      tax:'按财赋压力着色',
      mood:'按民情冷暖着色',
      army:'按军务态势着色',
      office:'按官守治理着色',
      yizheng:'按役政轻重着色（役负率·抛荒）'
    })[state.mapMode || 'owner'] || '按势力归属着色';
  }

  // perf round7: 地图 dirty 签名·捕捉所有影响 SVG 输出的运行时输入(mapId/模式/比例 + 逐区
  // 归属键 canonicalOwnerKey + 填色 regionColor)。几何/标签运行时不变故不入签名。供 renderFormalMap
  // 守卫与等价性脚本(__formalMapSignature)共用。
  function formalMapSignature(map){
    map = map || getMapData();
    if (!map || !Array.isArray(map.regions)) return '';
    // 2026-06-11: 哨牌文本并入签名——同档异分(民心 46→48 同「忧」色不变)时哨牌数值也要跟上，
    // 否则地图色对、牌上数字 stale。owner 视图无哨牌、贡献空串、签名与旧版等价。
    var _sentinelMode = (state.mapMode && state.mapMode !== 'owner' && GRADE_BANDS[state.mapMode]) ? state.mapMode : '';
    return mapIdentity(map) + '|' + (state.mapMode || '') + '|' + (state.mapScale || '') + '|' + map.regions.map(function(r){
      return (r.id || r.name || '') + ':' + canonicalOwnerKey(r) + ':' + regionColor(r) + (_sentinelMode ? ':' + modeScore(r, _sentinelMode) : '');
    }).join(',');
  }

  // ── 阶段2·分级显示：按 mapScale(天下/行省/府县)过滤 region 层级 ──
  //   region.level 走朝代级别链(province/prefecture/county/district)。老剧本无 level→全量(向后兼容)；
  //   某级无地块(如剧本只画到省·府县视域空)→回落全量不空屏。realm 暂用势力着色全量(势力 merge 轮廓留后续 slice)。
  function regionTier(r){
    return String((r && (r.level || (r.data && r.data.level))) || '');
  }
  function levelsForScale(scale){
    if (scale === 'prefecture') return ['prefecture', 'county', 'district'];
    if (scale === 'region') return ['province'];
    if (scale === 'realm') return ['country', 'power', 'empire', 'kingdom'];
    return null;
  }
  function visibleRegionsForScale(map, scale){
    var regions = (map && map.regions) || [];
    if (!regions.length) return regions;
    var want = levelsForScale(scale);
    if (!want) return regions;
    if (!regions.some(function(r){ return regionTier(r); })) return regions;  // 老剧本无层级数据→全量
    var filtered = regions.filter(function(r){ return want.indexOf(regionTier(r)) >= 0; });
    if (!filtered.length) return regions;  // 该级无地块→回落全量(不空屏)
    // 稀疏回落(2026-07-03)：该级只有零星几块(如天启图府州层仅个别碎块)时，只画它们=近空图。
    // 回落全量做底·稀疏层排到末尾后画在上——不空屏也不丢局部细节。
    if (filtered.length < Math.max(4, regions.length * 0.25)) {
      return regions.filter(function(r){ return want.indexOf(regionTier(r)) < 0; }).concat(filtered);
    }
    return filtered;
  }
  function renderFormalMap(){
    var shell = document.getElementById('tm-phase8-main-shell');
    var stage = mapStage();
    if (!shell || !stage || !isGameVisible()) {
      // 2026-05-27 diag·一次性输出·让 player 看到为何不渲染
      if (!state._mapDiagShellMissing) {
        state._mapDiagShellMissing = true;
        console.warn('[map-render-skip] shell=' + !!shell + ' stage=' + !!stage + ' visible=' + isGameVisible());
      }
      return;
    }
    requestMapLabelFeature();
    var map = getMapData();
    if (!map || !Array.isArray(map.regions) || !map.regions.length) {
      stage.innerHTML = '<div class="tmf-map-loading">舆图数据尚未载入</div>';
      state.mapLoadRetry = (state.mapLoadRetry || 0) + 1;
      // 2026-05-27 diag·每 20 retry 输出一次·让 player 看到 retry 在卡哪
      if (state.mapLoadRetry % 20 === 1 || state.mapLoadRetry === 80) {
        var gm = window.GM || {};
        var p = window.P || {};
        var diag = {
          retry: state.mapLoadRetry,
          mapDataExists: !!(map),
          regionsLen: map && map.regions ? map.regions.length : 0,
          gmMapData: !!gm.mapData,
          gmMapRegions: gm.mapData && gm.mapData.regions ? gm.mapData.regions.length : 0,
          pMap: !!p.map,
          pMapData: !!p.mapData,
          tmMapRt: !!window.TMMapRuntime,
          mingRegions: Array.isArray(window.MING_MAP_REGIONS) ? window.MING_MAP_REGIONS.length : 0
        };
        console.warn('[map-data-missing] retry ' + state.mapLoadRetry + ':', diag);
      }
      if (state.mapLoadRetry <= 80) setTimeout(renderFormalMapSoon, state.mapLoadRetry < 12 ? 250 : 700);
      return;
    }
    state.mapLoadRetry = 0;
    var width = Number(map.width || 1200);
    var height = Number(map.height || 720);
    state._mapVBW = width; state._mapVBH = height; /* clampMapView 用·viewBox 尺寸单一来源 */
    var oceans = Array.isArray(map.oceans) ? map.oceans : [];
    var mapId = mapIdentity(map);
    var basemap = resolveBasemap(map);
    var basemapLayer = generatedBasemapLayer(map, basemap);
    // perf round7 (2026-06-10): dirty-guard·原版每次 stage.innerHTML 全量重建整张地图 SVG
    // (逐区 ×3 算 path·解析+布局+绘制)·实测每次 ~300ms。但运行时几何/标签不变·只
    // regionColor/canonicalOwnerKey/mapMode/mapScale 影响输出。addEB/问对开关/多数
    // renderGameState 不改地图却触发本函数(经 scheduleFormalRuntimeRefresh→showHome)。
    // owner 函数已 round7 索引故签名廉价·与上次相同则只刷廉价 chrome(图例/警示/检索/transform)·
    // 跳过昂贵 SVG 重建。归属/数值/模式一变签名即变→正常重建。编辑器走独立渲染路径不受影响·
    // 载新图/换剧本 mapId 变或首渲无签名→必重建。bridge.map.invalidateFormalMap() 为强制逃生阀。
    var _fmSig = formalMapSignature(map);
    if (state._lastFormalMapSig === _fmSig && stage.querySelector('#tmf-formal-map')) {
      applyMapTransform();
      updateMapChrome();
      renderLegend(map);
      renderMapAlerts(map);
      syncMapSearch(map);
      return;
    }
    state._lastFormalMapSig = _fmSig;
    var visibleRegions = visibleRegionsForScale(map, state.mapScale);  // 阶段2·按层级(天下/行省/府县)过滤
    // Only this render owns the cache: duplicate IDs cannot alias, and later
    // renders re-read geometry even when points are mutated in place.
    var renderPaths = new Map();
    function renderedPath(r) {
      if (!renderPaths.has(r)) renderPaths.set(r, pathForRegion(r));
      return renderPaths.get(r);
    }
    var regionWashes = visibleRegions.map(function(r){
      var d = renderedPath(r);
      if (!d) return '';
      return '<path class="tmf-region-wash ming-region-wash" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill="' + attr(regionColor(r)) + '" fill-rule="evenodd"></path>';
    }).join('');
    var regionHalos = visibleRegions.map(function(r){
      var d = renderedPath(r);
      if (!d) return '';
      return '<path class="tmf-region-halo ming-region-halo" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '"></path>';
    }).join('');
    // ① 地名动态字号：面积参考取可见地块真面积的 ~55 百分位(≈「典型省」·base 对齐它)·预排一次
    var _labelLegacy = (typeof window !== 'undefined' && window.__TM_LABEL_LEGACY);
    var _regAreas = _labelLegacy ? [] : visibleRegions.map(regionTrueArea).filter(function(a){ return a > 0; }).sort(function(a, b){ return a - b; });
    var _regRef = _regAreas.length ? _regAreas[Math.floor(_regAreas.length * 0.55)] : 0;
    var regionPaths = visibleRegions.map(function(r){
      var d = renderedPath(r);
      if (!d) return '';
      var labelText = String(r.title || r.name || r.officialName || '');
      var facePath = '<path class="tmf-region ming-region" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill="' + attr(regionColor(r)) + '" fill-rule="evenodd"></path>';
      if (_labelLegacy) {
        var c0 = actualCenter(r);
        var lw0 = Math.max(34, Math.min(96, labelText.length * 13 + 18));
        return facePath + '<g class="tmf-region-label ming-label" transform="translate(' + attr(c0.x) + ' ' + attr(c0.y) + ')"><rect x="' + attr(-lw0 / 2) + '" y="-10" width="' + attr(lw0) + '" height="20"></rect><text x="0" y="0">' + esc(labelText) + '</text></g>';
      }
      // 地名 ∝ 地块面积(平滑幂律 k=0.32) + polylabel 内接圆心锚点(凹/沿海不落域外) + 牌匾随字号缩放
      var raw = _tmAreaFont(regionTrueArea(r), _regRef, 15, 0.32, 4, 24);
      if (!labelText || raw < 9) return facePath;             // <~9px 直接不画(极小地块让位·可读性下限)
      var fs = Math.round(raw * 10) / 10;
      var a = labelAnchor(r);
      var chars = labelText.length || 1;
      var rw = Math.max(fs + 12, Math.round(chars * fs * 0.62 + fs * 0.9));
      var rh = Math.round(fs + 8);
      return facePath +
        '<g class="tmf-region-label ming-label" data-region-id="' + attr(r.id || r.name || '') + '" data-fs="' + fs + '" data-lw="' + rw + '" data-lh="' + rh + '" data-ax="' + attr(Math.round(a.x)) + '" data-ay="' + attr(Math.round(a.y)) + '" data-pr="' + fs + '" transform="translate(' + attr(a.x) + ' ' + attr(a.y) + ')">' +
          '<text x="0" y="0" style="font-size:' + fs + 'px">' + esc(labelText) + '</text>' +
        '</g>';
    }).join('');
    var oceanPaths = oceans.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      var c = actualCenter(r);
      return '<path class="tmf-ocean ming-ocean ming-ocean-region" data-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill-rule="evenodd"></path>' +
        '<text class="tmf-ocean-label ming-ocean-label" x="' + attr(c.x) + '" y="' + attr(c.y) + '">' + esc(r.title || r.name || '') + '</text>';
    }).join('');
    stage.innerHTML =
      '<div class="ming-map-camera">' +
      '<svg id="tmf-formal-map" class="ming-map-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img">' +
        '<defs>' +
          '<filter id="tmfPaperNoise"><feTurbulence type="fractalNoise" baseFrequency=".92" numOctaves="2" result="n"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .07"/></feComponentTransfer></filter>' +
          '<radialGradient id="tmf-ming-paper" cx="52%" cy="46%" r="66%"><stop offset="0" stop-color="#e1be73" stop-opacity=".18"/><stop offset=".72" stop-color="#8b632f" stop-opacity=".06"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>' +
          '<radialGradient id="tmf-east-sea" cx="62%" cy="52%" r="75%"><stop offset="0" stop-color="#617c6f" stop-opacity=".18"/><stop offset=".62" stop-color="#466a61" stop-opacity=".08"/><stop offset="1" stop-color="#1c2b2c" stop-opacity="0"/></radialGradient>' +
        '</defs>' +
        '<g id="tmf-map-world" class="tmf-map-world ming-map-world">' +
          '<rect class="tmf-map-paper-fill" x="0" y="0" width="' + width + '" height="' + height + '"></rect>' +
          basemapLayer +
          oceanPaths +
          '<g class="tmf-region-washes">' + regionWashes + '</g>' +
          '<g class="tmf-region-halos">' + regionHalos + '</g>' +
          '<g class="tmf-region-layer ming-admin-layer">' + regionPaths + '</g>' +
          '<g class="tmf-faction-label-layer">' + factionLabelLayer(map) + '</g>' +
          '<g class="tmf-sentinel-layer">' + sentinelLayer(map) + '</g>' +
          '<rect class="tmf-map-grain" x="0" y="0" width="' + width + '" height="' + height + '"></rect>' +
        '</g>' +
      '</svg></div>';
    stage.dataset.width = String(width);
    stage.dataset.height = String(height);
    stage.dataset.mapId = mapId;
    applyMapTransform();
    updateMapChrome();
    renderLegend(map);
    renderMapAlerts(map);
    syncMapSearch(map);
    bindRegionPathEvents(map);
    scheduleLabelLayout();      // P1·首渲后算标签防重叠+LOD
  }

  function renderLegend(map){
    var host = document.getElementById('tmf-map-legend');
    if (!host) return;
    var regions = (map && map.regions) || [];
    var seen = {};
    var entries = [];
    regions.forEach(function(r){
      var key = canonicalOwnerKey(r);
      if (!key || seen[key]) return;
      seen[key] = true;
      entries.push({ key: key, name: ownerName(r), color: regionColor(r) });
    });
    if (state.mapMode !== 'owner') {
      // 2026-06-11: 数据视图图例改五档真色板（与 gradeOf 同源）+ 档字刻度——旧版「低中高」三字与实际着色无对应。
      var gb = GRADE_BANDS[state.mapMode];
      var bandsHtml = gb
        ? '<div class="map-legend-main"><div class="map-legend-bar tmf-grade-bar">' + gb.bands.map(function(bd){
            return '<i style="background:' + attr(bd[2]) + '"></i>';
          }).join('') + '</div><div class="map-legend-scale tmf-grade-scale">' + gb.bands.map(function(bd){
            return '<span>' + esc(bd[3]) + '</span>';
          }).join('') + '</div></div>'
        : '<div class="map-legend-main"><div class="map-legend-bar"></div><div class="map-legend-scale"><span>低</span><span>中</span><span>高</span></div></div>';
      host.innerHTML = '<div class="map-legend-title"><span class="map-legend-mode"><i class="map-legend-mark"></i><span class="map-legend-name">' + esc(mapModeTitle()) + '</span></span><span class="map-legend-sub">' + esc(mapScaleNote()) + '</span></div>' +
        bandsHtml +
        '<div class="map-legend-detail"><p class="map-legend-note">' + esc(mapModeNote()) + '。地块圆牌为本视图读数，颜色随运行账目即时重绘。</p></div>';
      return;
    }
    host.innerHTML = '<div class="map-legend-title"><span class="map-legend-mode"><i class="map-legend-mark"></i><span class="map-legend-name">势力版图</span></span><span class="map-legend-sub">' + esc(entries.length) + ' 方</span></div>' +
      '<div class="map-legend-main"><div class="map-owner-row">' + entries.slice(0, 3).map(function(e){
        return '<span class="map-owner-swatch"><i style="background:' + attr(e.color) + '"></i>' + esc(e.name) + '</span>';
      }).join('') + '</div></div>' +
      '<div class="map-legend-detail"><p class="map-legend-note">点击色块查看势力档案，右键任一地块打开所属势力。</p><div class="tmf-legend-list">' + entries.slice(0, 10).map(function(e){
        return '<button type="button" onclick="TMPhase8FormalBridge.openFactionByKey(\'' + attr(e.key) + '\')"><span style="background:' + attr(e.color) + '"></span>' + esc(e.name) + '</button>';
      }).join('') + '</div></div>';
  }

  function regionSearchText(r){
    return [r && (r.title || r.name || r.officialName), r && ownerName(r), r && (r.governor || r.official || r.office || r.capital || r.note)].filter(Boolean).join(' ');
  }

  function syncMapSearch(map){
    var list = document.getElementById('map-region-list');
    if (list && map && Array.isArray(map.regions)) {
      list.innerHTML = map.regions.map(function(r){ return '<option value="' + attr(r.title || r.name || r.officialName || '') + '"></option>'; }).join('');
    }
    var input = document.getElementById('map-search');
    if (input) renderMapSearchResults(input.value || '');
  }

  function renderMapSearchResults(q){
    var host = document.getElementById('map-search-results');
    if (!host) return;
    var map = getMapData();
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    var query = String(q || '').trim().toLowerCase();
    // 2026-07-04 主界面收纳：空检索不再列头 6 省（任意序无信息量·撑高工具坞盖地图）·走原有空态提示
    var rows = !query ? [] : regions.filter(function(r){
      return regionSearchText(r).toLowerCase().indexOf(query) >= 0;
    }).slice(0, 6);
    host.innerHTML = rows.length ? rows.map(function(r){
      return '<button type="button" data-region-id="' + attr(r.id || r.name || r.title || '') + '" onclick="TMPhase8FormalBridge.focusRegion(\'' + attr(r.id || r.name || r.title || '') + '\')"><b>' + esc(r.title || r.name || r.officialName || '未名地块') + '</b><span>' + esc(ownerName(r)) + '</span></button>';
    }).join('') : '<div class="tmf-map-search-empty" style="padding:8px 10px;color:#9c8b6b;font-size:12.5px">' + (query ? '无匹配地块' : '输入地名以检索') + '</div>';
  }

  function focusRegion(id, open){
    var r = findRegion(id);
    if (!r) return;
    var map = getMapData();
    var c = actualCenter(r);
    if (map && c) {
      state.mapView.scale = Math.max(state.mapView.scale || 1, 1.45);
      state.mapView.tx = Number(map.width || 1200) * .52 - c.x * state.mapView.scale;
      state.mapView.ty = Number(map.height || 720) * .48 - c.y * state.mapView.scale;
      applyMapTransform();
    }
    var el = document.querySelector('.tmf-region[data-region-id="' + cssEscape(id) + '"]');
    document.querySelectorAll('.tmf-region.selected').forEach(function(x){ x.classList.remove('selected'); });
    if (el) el.classList.add('selected');
    if (open !== false) openRegionDossier(r);
  }

  function mapModeTitle(){
    if (state.mapMode === 'classPressure') return '阶层';
    return ({ owner:'势力', tax:'财赋', mood:'民情', army:'军务', office:'官守', yizheng:'役政' })[state.mapMode] || '势力';
  }

  // 视口夹取（2026-07-03·治「府州往返后地图漂去左上」）：切档只改 scale 不动 tx/ty·又无越界夹取，
  // 残留平移在低倍下把画面甩出纸面。单点收口在 applyMapTransform：所有路径(切档/滚轮/拖拽)同受益。
  function clampMapView(v){
    var W = Number(state._mapVBW) || 1200, H = Number(state._mapVBH) || 720;
    var s = Number(v.scale) || 1;
    if (s >= 1) {
      v.tx = Math.min(0, Math.max(W * (1 - s), Number(v.tx) || 0));
      v.ty = Math.min(0, Math.max(H * (1 - s), Number(v.ty) || 0));
    } else {
      v.tx = W * (1 - s) / 2; v.ty = H * (1 - s) / 2; /* 图小于窗→居中 */
    }
    return v;
  }
  function applyMapTransform(){
    var world = document.getElementById('tmf-map-world');
    if (!world) return;
    var v = clampMapView(state.mapView || { scale: 1, tx: 0, ty: 0 });
    world.setAttribute('transform', 'translate(' + v.tx.toFixed(2) + ' ' + v.ty.toFixed(2) + ') scale(' + v.scale.toFixed(4) + ')');
    var stage = mapStage();
    if (stage) stage.classList.toggle('zoomed', v.scale > 1.35);
    _syncScaleLevelFromZoom();  // 阶段3·缩放跨阈值自动切层级(CK3)
    scheduleLabelLayout();      // P1·缩放/平移结束后防抖重算标签防重叠+LOD
  }

  // 拖拽性能（治拖拽卡顿）：把 applyMapTransform（含 DOM 写 + _syncScaleLevelFromZoom）rAF 节流·
  // 一帧多次 pointermove 合并为一次 transform 应用·避免每次指针事件都 setAttribute+跨阈值检查。
  var _mapTransformRaf = 0;
  function scheduleMapTransform(){
    if (_mapTransformRaf) return;
    _mapTransformRaf = (window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); })(function(){
      _mapTransformRaf = 0;
      applyMapTransform();
    });
  }

  // ── 标签防重叠 + 屏上字号 LOD（P1）：委托 tm-map-label-collide.js（渲染层 DOM helper·跨朝代通用）──
  //   只在缩放/平移结束 + 重渲后防抖重算(非每帧)。__TM_LABEL_LEGACY→整体跳过(还原改前全显)·
  //   __TM_LABEL_NOCOLLIDE→仅走 LOD 门跳碰撞(调试)。引擎未加载则安全跳过(标签全显·不崩)。
  var _labelLayoutTimer = 0;
  function scheduleLabelLayout(){
    clearTimeout(_labelLayoutTimer);
    _labelLayoutTimer = setTimeout(resolveLabelLayout, 90);
  }
  function resolveLabelLayout(){
    if (typeof window !== 'undefined' && window.__TM_LABEL_LEGACY) return;
    var C = (typeof window !== 'undefined') && window.TMMapLabelCollide;
    if (!C || !C.resolve) return;
    C.resolve(mapStage(), (state.mapView && state.mapView.scale) || 1, state.mapScale || 'region',
      { noCollide: (typeof window !== 'undefined' && window.__TM_LABEL_NOCOLLIDE) });
  }

  function regionPathFromPoint(e){
    if (!e) return null;
    var direct = e.target && e.target.closest ? e.target.closest('.tmf-region,.ming-region') : null;
    if (direct) return direct;
    var stack = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [document.elementFromPoint(e.clientX, e.clientY)];
    return (stack || []).find(function(el){
      return el && el.classList && (el.classList.contains('tmf-region') || el.classList.contains('ming-region'));
    }) || null;
  }

  function bindRegionPathEvents(map){
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    document.querySelectorAll('#tmf-formal-map .tmf-region').forEach(function(el){
      if (el.__phase8RegionBound) return;
      el.__phase8RegionBound = true;
      el.addEventListener('click', function(e){
        if (state.dragSuppressClick) return;
        e.stopPropagation();
        var r = findRegion(el.dataset.regionId || el.dataset.id);
        if (r) openRegionDossier(r);
      });
      el.addEventListener('contextmenu', function(e){
        e.preventDefault();
        e.stopPropagation();
        var r = findRegion(el.dataset.regionId || el.dataset.id);
        if (r) openFactionDossier(ownerKey(r), r);
      });
    });
    if (!regions.length) return;
  }

  // ── 签注内容（2026-06-11）：hover 小笺按视图给核心读数 + 判语 ──────────
  function _tipRow(k, v, tone){
    if (!hasDisplayValue(v)) return '';
    return '<div class="tip-row"><span class="tip-k">' + esc(k) + '</span><span class="tip-v ' + (tone || '') + '">' + esc(ppValue(v)) + '</span></div>';
  }
  // 「机动兵力」兜底——地块无逐块驻军实体、但所属势力有军力时，显势力机动军力，免得游牧/无常驻势力图上显 0/空。
  // 跨朝代通用：游牧（部落/游牧）显「机动兵力」，其余有军力无驻军的抽象/海外势力显「势力军力」。地块归地块、势力归势力，驻军栏本身不动。
  function _mobileForceRow(r, b){
    if (!r) return '';
    var data = (b && b.data) || {};
    var localGarrison = firstValue(data.garrison, b && b.army && b.army.troops, r && r.troops);
    if (Number(localGarrison) > 0) return '';   // 本地有真驻军(>0)才让位；0/空=无常驻实体，游牧仍显机动兵力（察哈尔 troops 显式为 0）
    var f = findFaction(ownerKey(r), r.factionName || r.ownerName);
    var ms = f && Number(firstValue(f.militaryStrength, f.military));
    if (!f || !isFinite(ms) || ms <= 0) return '';
    var nomad = /部落|游牧|游猎/.test(String(f.type || '') + String((f.traits || []).join('')));
    return _tipRow(nomad ? '机动兵力' : '势力军力', ms);
  }
  function mapTipVerdict(mode, r, b, score){
    var data = b.data || {};
    var n = Number(score);
    if (mode === 'mood') {
      var fug = hasDisplayValue(b.pop.fugitives) ? '，逃户 ' + ppValue(b.pop.fugitives) : '';
      if (!isFinite(n)) return ['民情无册可稽。', ''];
      if (n < 35) return ['民心 ' + n + '——已成干柴' + fug + '，一火即燃。', 'wei'];
      if (n < 50) return ['民心 ' + n + '——民力已竭' + fug + '，有生变之虞。', 'wei'];
      if (n < 65) return ['民心 ' + n + '——尚可支吾，不宜再加赋扰役。', ''];
      return ['民心 ' + n + '——黎庶安业，可为根本之地。', 'an'];
    }
    if (mode === 'army') {
      var note = firstValue(data.armyPressure, data.borderRisk, data.warRisk, data.threats);
      var noteTxt = hasDisplayValue(note) ? '（' + ppValue(note) + '）' : '';
      if (n >= 80) return ['边警之地' + noteTxt + '——宜厚饷固防，不可抽兵。', 'wei'];
      if (n >= 60) return ['有警之地' + noteTxt + '——守备勿弛。', 'wei'];
      if (n >= 40) return ['守备之地' + noteTxt + '。', ''];
      return ['腹里安靖——可酌减冗兵以纾饷。', 'an'];
    }
    if (mode === 'office') {
      var vac = Number(firstValue(data.officeVacancy, data.vacancy));
      var vacTxt = isFinite(vac) && vac > 0 ? '，官缺 ' + vac + ' 员' : '';
      if (n >= 80) return ['吏治已蠹' + vacTxt + '——非大狱不能清。', 'wei'];
      if (n >= 60) return ['吏治浑浊' + vacTxt + '——赋税多漏，政令多阻。', 'wei'];
      if (n >= 40) return ['吏治平平' + vacTxt + '——犹可整饬。', ''];
      return ['吏治清明——可为他省式范。', 'an'];
    }
    if (mode === 'tax') {
      if (score === '' || score === null || !isFinite(n)) return ['此地免科或未设税制——不入岁入之算。', ''];
      var skim = ratio01(b.fiscal.skimmingRate);
      var skimTxt = skim !== null && skim > 0 ? '，截留 ' + Math.round(skim * 100) + '%' : '';
      if (n < 50) return ['实征不及应征之半' + skimTxt + '——欠征之地。', 'wei'];
      if (n < 70) return ['足额率 ' + n + '%' + skimTxt + '——征解有漏。', ''];
      if (n < 85) return ['足额率 ' + n + '%' + skimTxt + '——大体可观。', ''];
      return ['足额率 ' + n + '%——足额上仓之地。', 'an'];
    }
    if (mode === 'classPressure') {
      var cp = classPressureForRegion(r);
      if (cp.count <= 0 && !(Number(cp.score) > 0)) return ['阶层账本于此地无近压。', 'an'];
      return ['阶层压力 ' + ppValue(cp.score) + (cp.classNames.length ? '——牵动 ' + cp.classNames.join('、') : '') + '。', Number(cp.score) >= 50 ? 'wei' : ''];
    }
    if (mode === 'yizheng') {
      if (!isFinite(n)) return ['役政无册可稽（未行人力之政）。', ''];
      if (n >= 55) return ['役负 ' + n + '——苛役之地，丁多逃隐，田将抛荒。', 'wei'];
      if (n >= 35) return ['役负 ' + n + '——徭役偏重，宜蠲减或募役折银。', 'wei'];
      if (n >= 20) return ['役负 ' + n + '——尚在可支之间。', ''];
      return ['役负 ' + n + '——轻徭薄赋，民得安耕。', 'an'];
    }
    return ['', ''];
  }
  function mapTipHtml(r){
    var b = regionBundle(r);
    var data = b.data || {};
    var mode = (state.mapMode && state.mapMode !== 'owner' && GRADE_BANDS[state.mapMode]) ? state.mapMode : 'owner';
    var rows = '';
    if (mode === 'owner') {
      rows = _tipRow('归属', ownerName(r)) +
        _tipRow('主官', firstValue(data.governor, data.official)) +
        _tipRow('驻军', firstValue(data.garrison, b.army.troops, r && r.troops)) +
        _mobileForceRow(r, b) +
        _tipRow('民心', mapReported('minxin', r, firstValue(data.minxinLocal, r && r.mood), 'good'));
      return '<b>' + esc(regionTitle(r)) + '</b><span class="tip-owner">' + esc(ownerName(r) || '') + '</span>' +
        '<div class="tip-body">' + rows + '</div>' +
        '<div class="tip-foot"><em>左键 翻方志</em><em>右键 展势力</em></div>';
    }
    var score = modeScore(r, mode);
    var grade = gradeOf(mode, score);
    var verdict = mapTipVerdict(mode, r, b, score);
    if (mode === 'mood') {
      rows = _tipRow('民心', score, gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('逃户', b.pop.fugitives, 'zhu') +
        _tipRow('灾异', firstValue(data.recentDisasters, (data.economyBase || {}).disasterRecord)) +
        _tipRow('不稳', data.unrest);
    } else if (mode === 'army') {
      rows = _tipRow('军压', grade ? grade.mark + ' · ' + ppValue(score) : score, gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('驻军', firstValue(data.garrison, b.army.troops, r && r.troops)) +
        _mobileForceRow(r, b) +
        _tipRow('城防', firstValue(data.fortification, b.army.fortification)) +
        _tipRow('边警', firstValue(data.borderRisk, data.warRisk, data.threats), 'zhu');
    } else if (mode === 'office') {
      rows = _tipRow('贪腐', firstValue(data.corruptionLocal, data.corruption), gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('主官', firstValue(data.governor, data.official)) +
        _tipRow('官缺', firstValue(data.officeVacancy, data.vacancy)) +
        _tipRow('执行', firstValue(data.policyExecution, data.execution));
    } else if (mode === 'tax') {
      rows = _tipRow('应征', b.fiscal.claimedRevenue) +
        _tipRow('实征', b.fiscal.actualRevenue) +
        _tipRow('合规', hasDisplayValue(b.fiscal.compliance) ? pctValue(b.fiscal.compliance) : '') +
        _tipRow('截留', hasDisplayValue(b.fiscal.skimmingRate) ? pctValue(b.fiscal.skimmingRate) : '', 'zhu');
    } else if (mode === 'classPressure') {
      var cp = classPressureForRegion(r);
      rows = _tipRow('压力', cp.score, Number(cp.score) >= 50 ? 'zhu' : '') +
        _tipRow('牵动', cp.classNames.join('、')) +
        _tipRow('近因', cp.reason);
    } else if (mode === 'yizheng') {
      var GMv = (typeof GM !== 'undefined' && GM) ? GM : ((typeof window !== 'undefined' && window.GM) ? window.GM : null);
      var rgv = (GMv && GMv.renli && GMv.renli.byRegion) ? (GMv.renli.byRegion[(r && (r.id || r.regionId || r.name)) || ''] || (r && r.name ? GMv.renli.byRegion[r.name] : null)) : null;
      rows = _tipRow('役负', grade ? grade.mark + ' · ' + (isFinite(Number(score)) ? Number(score) + '%' : '—') : score, gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('抛荒', rgv && hasDisplayValue(rgv.fallowLand) && Number(rgv.fallowLand) > 0 ? ppValue(rgv.fallowLand) + ' 亩' : '') +
        _tipRow('逃户', b.pop.fugitives, 'zhu') +
        _tipRow('地力', rgv && hasDisplayValue(rgv.soil) ? ppValue(rgv.soil) : '');
    }
    return '<b>' + esc(regionTitle(r)) + '</b><span class="tip-owner">' + esc(ownerName(r) || '') + '</span>' +
      '<div class="tip-body">' + rows + '</div>' +
      (verdict[0] ? '<div class="tip-verdict ' + verdict[1] + '">' + esc(verdict[0]) + '</div>' : '') +
      '<div class="tip-foot"><em>左键 翻方志</em><em>右键 展势力</em></div>';
  }

  function installMapInteraction(){
    var stage = mapStage();
    if (!stage || stage.__phase8MapBound) return;
    stage.__phase8MapBound = true;
    function clearMapSelection(){
      try {
        var sel = window.getSelection && window.getSelection();
        if (sel && typeof sel.removeAllRanges === 'function') sel.removeAllRanges();
      } catch(_) {}
    }
    function preventMapSelection(e){
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      clearMapSelection();
    }
    stage.addEventListener('selectstart', preventMapSelection, { passive: false });
    stage.addEventListener('dragstart', preventMapSelection, { passive: false });
    stage.addEventListener('wheel', function(e){
      e.preventDefault();
      var map = getMapData();
      if (!map) return;
      var rect = stage.getBoundingClientRect();
      var width = Number(map.width || stage.dataset.width || 1200);
      var height = Number(map.height || stage.dataset.height || 720);
      var x = (e.clientX - rect.left) / rect.width * width;
      var y = (e.clientY - rect.top) / rect.height * height;
      var old = state.mapView.scale || 1;
      var next = Math.max(.85, Math.min(3.4, old * (e.deltaY < 0 ? 1.14 : .88)));
      state.mapView.tx = x - (x - (state.mapView.tx || 0)) * (next / old);
      state.mapView.ty = y - (y - (state.mapView.ty || 0)) * (next / old);
      state.mapView.scale = next;
      applyMapTransform();
    }, { passive: false });
    stage.addEventListener('pointerdown', function(e){
      if (e.button !== 0) return;
      if (e.pointerType === 'touch') return; // 触屏 pan/缩放交给 attachPinchPan(touch 事件)·避免 pointer+touch 双重平移
      if (e.cancelable) e.preventDefault();
      clearMapSelection();
      state.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: state.mapView.tx || 0, ty: state.mapView.ty || 0, moved: false };
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
    });
    stage.addEventListener('pointermove', function(e){
      if (!state.drag || state.drag.id !== e.pointerId) return;
      var map = getMapData();
      if (!map) return;
      // 每次读 rect：stage 的 rect 不受 world 组 transform 影响(不会 layout thrash)·且拖拽中窗口/容器 resize 时坐标仍准。
      // 性能收益全在下方 applyMapTransform 的 rAF 节流·不靠缓存 rect。
      var rect = stage.getBoundingClientRect();
      var dx = (e.clientX - state.drag.x) / rect.width * Number(map.width || 1200);
      var dy = (e.clientY - state.drag.y) / rect.height * Number(map.height || 720);
      if (!state.drag.moved && Math.abs(dx) + Math.abs(dy) > 2) { // 只在首次越过阈值时清一次选中·非每帧
        state.drag.moved = true;
        clearMapSelection();
      }
      state.mapView.tx = state.drag.tx + dx;
      state.mapView.ty = state.drag.ty + dy;
      scheduleMapTransform(); // rAF 节流：一帧多次 pointermove 合并为一次 transform 应用（去卡顿）
    });
    stage.addEventListener('pointerup', function(e){
      if (state.drag && state.drag.id === e.pointerId) {
        state.dragSuppressClick = state.drag.moved;
        state.drag = null;
        applyMapTransform(); // flush 最终位置（rAF 节流下最后一帧可能尚未应用）
        stage.classList.remove('dragging');
        clearMapSelection();
        setTimeout(function(){ state.dragSuppressClick = false; }, 0);
      }
    });
    // 触屏：单指拖动平移 + 双指捏合缩放（复用 wheel 的内容单位换算与 zoom-at-anchor 公式）
    if (window.TM && typeof TM.attachPinchPan === 'function') {
      TM.attachPinchPan(stage, {
        onGesture: function(g){
          var map = getMapData(); if (!map) return;
          var rect = stage.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          if (!state.mapView) state.mapView = { scale: 1, tx: 0, ty: 0 };
          var width = Number(map.width || 1200), height = Number(map.height || 720);
          if (g.panDX || g.panDY) {
            state.mapView.tx = (state.mapView.tx || 0) + g.panDX / rect.width * width;
            state.mapView.ty = (state.mapView.ty || 0) + g.panDY / rect.height * height;
          }
          if (g.zoom && g.zoom !== 1) {
            var ax = (g.cx - rect.left) / rect.width * width;
            var ay = (g.cy - rect.top) / rect.height * height;
            var old = state.mapView.scale || 1;
            var next = Math.max(.85, Math.min(3.4, old * g.zoom));
            state.mapView.tx = ax - (ax - (state.mapView.tx || 0)) * (next / old);
            state.mapView.ty = ay - (ay - (state.mapView.ty || 0)) * (next / old);
            state.mapView.scale = next;
          }
          applyMapTransform();
        },
        onEnd: function(g){
          if (g && g.moved) { state.dragSuppressClick = true; setTimeout(function(){ state.dragSuppressClick = false; }, 60); }
        }
      });
    }
    stage.addEventListener('dblclick', function(){
      state.mapView = { scale: 1, tx: 0, ty: 0 };
      applyMapTransform();
    });
    stage.addEventListener('click', function(e){
      if (state.dragSuppressClick) return;
      var path = regionPathFromPoint(e);
      if (!path) return;
      var r = findRegion(path.dataset.regionId || path.dataset.id);
      if (r) openRegionDossier(r);
    });
    stage.addEventListener('contextmenu', function(e){
      var path = regionPathFromPoint(e);
      if (!path) return;
      e.preventDefault();
      var r = findRegion(path.dataset.regionId || path.dataset.id);
      if (r) openFactionDossier(ownerKey(r), r);
    });
    // 性能·hover tooltip 改 rAF 节流 + 同省早退·避免每次 mousemove 都查找+重建 innerHTML+reflow
    // 2026-06-11: 内容升级为「签注」——按当前视图给 3-4 行核心读数 + 一句判语（数字翻成人话）。
    // hover key 含 mapMode：切视图后同省再悬停会重建内容（旧版只记 rid·切视图内容 stale）。
    var _hoverEvt = null, _hoverRaf = null, _hoverLastKey = null;
    function _mapHoverTick(){
      _hoverRaf = null;
      var e = _hoverEvt; if (!e) return;
      var tip = document.getElementById('tmf-map-tip');
      if (!tip) return;
      var path = regionPathFromPoint(e);
      if (!path) { tip.classList.remove('show'); _hoverLastKey = null; return; }
      // 位置每帧跟随鼠标（廉价·无 innerHTML 重建）·右/下越界翻转
      var tx = e.clientX + 14, ty = e.clientY + 14;
      if (tx + 270 > window.innerWidth) tx = e.clientX - 278;
      if (ty + 190 > window.innerHeight) ty = e.clientY - 180;
      tip.style.left = tx + 'px';
      tip.style.top = ty + 'px';
      var rid = path.dataset.regionId || path.dataset.id;
      var key = rid + '|' + (state.mapMode || 'owner');
      if (key === _hoverLastKey) { tip.classList.add('show'); return; } // 同省同视图·不重建 innerHTML
      _hoverLastKey = key;
      var r = findRegion(rid);
      if (!r) { tip.classList.remove('show'); return; }
      tip.innerHTML = mapTipHtml(r);
      tip.classList.add('show');
    }
    stage.addEventListener('mousemove', function(e){
      _hoverEvt = e;
      if (_hoverRaf) return;
      _hoverRaf = (window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); })(_mapHoverTick);
    });
  }

  // 性能·按 map 引用+regions 长度缓存的反向索引·把 findRegion 从每次 O(regions×7) 线性扫描降到 O(1)
  var _regionIndexCache = { map: null, len: -1, index: null };
  function _buildRegionIndex(map){
    var idx = new Map();
    var regs = map && Array.isArray(map.regions) ? map.regions : [];
    for (var i = 0; i < regs.length; i++) {
      var r = regs[i];
      var keys = [r.id, r.name, r.title, r.officialName, r.sourceId, r.mapRegionId, r.adminBinding];
      for (var j = 0; j < keys.length; j++) {
        var v = keys[j];
        if (v == null) continue;
        var k = String(v);
        if (!idx.has(k)) idx.set(k, r); // 与原 .find 一致：数组靠前者优先
      }
    }
    return idx;
  }
  function findRegion(id){
    var map = getMapData();
    if (!map || !Array.isArray(map.regions)) return null;
    if (_regionIndexCache.map !== map || _regionIndexCache.len !== map.regions.length) {
      _regionIndexCache.map = map;
      _regionIndexCache.len = map.regions.length;
      _regionIndexCache.index = _buildRegionIndex(map);
    }
    return _regionIndexCache.index.get(String(id == null ? '' : id)) || null;
  }

  function metric(value, fallback){
    if (value == null || value === '') return fallback == null ? '未记' : fallback;
    return value;
  }

  function fmtNum(v, unit){
    var n = Number(v);
    if (!isFinite(n)) return metric(v);
    if (Math.abs(n) >= 10000) return Math.round(n / 10000) + '万' + (unit || '');
    return String(Math.round(n)) + (unit || '');
  }

  function dossierRows(rows){
    return '<div class="tmf-dossier-rows">' + rows.map(function(r){
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(metric(r[1])) + '</b></div>';
    }).join('') + '</div>';
  }

  var MAP_MODE_META = {
    overview: { title: '地块总览', mark: '览', note: '汇总地形、户口、财赋、军务、官守与势力归属，作为点击地块后的默认档案。' },
    owner: { title: '势力归属', mark: '势', note: '显示当前控制者、法理归属和所属势力，用来判断此地听命于谁。' },
    mood: { title: '民情冷暖', mark: '民', note: '显示民心、逃户、灾异与地方不满，用来判断此地是否容易生变。' },
    classPressure: { title: '阶层民心压力', mark: '阶', note: '显示阶层-民心桥接账本在地方留下的压力，点开地块可追到阶层、近因与议题。' },
    tax: { title: '财赋压力', mark: '赋', note: '显示应征、实征、留用、银粮和税负，用来判断此地能否支撑朝廷。' },
    army: { title: '军务态势', mark: '军', note: '显示驻军、城防、边警和军压，用来判断此地是否需要调兵或拨饷。' },
    office: { title: '官守治理', mark: '官', note: '显示主官、官缺、腐败和政令执行，用来判断地方治理是否失衡。' }
  };

  function firstValue(){
    for (var i = 0; i < arguments.length; i += 1) {
      var v = arguments[i];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  // 正值优先取数（2026-06-12 零值覆盖病修）：live 源的 0 多为死缺省（provinceStats.soldiers=0、
  // cascade 未触账的 0），不应抹掉剧本静态值——取第一个 >0 的数；全无正值返回 null。
  function firstPositive(){
    for (var i = 0; i < arguments.length; i += 1) {
      var n = Number(arguments[i]);
      if (isFinite(n) && n > 0) return n;
    }
    return null;
  }

  function recruitPoolValue(source){
    if (!source || typeof source !== 'object') return null;
    var md = source.militaryDetail;
    if (md && typeof md === 'object' && hasValue(md.availableRecruits)) {
      var available = Number(md.availableRecruits);
      var base = Number(md.recruitmentBase);
      if (isFinite(available) && (available > 0 || (isFinite(base) && base > 0) || hasValue(md.recruitmentSource))) {
        return Math.max(0, Math.round(available));
      }
    }
    return firstPositive(source.militaryRecruits, source.recruits, source.levyPool);
  }

  function hasDisplayValue(v){
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v)) return v.some(hasDisplayValue);
    if (typeof v === 'object') {
      return Object.keys(v).some(function(k){ return hasDisplayValue(v[k]); });
    }
    return true;
  }

  function rowHasDisplayValue(row){
    return row && hasDisplayValue(row[1]);
  }

  function pctValueIfPresent(v){
    return hasDisplayValue(v) ? pctValue(v) : '';
  }

  function splitFieldWords(raw){
    return String(raw || '')
      .replace(/^_+/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function readableUnknownField(raw){
    raw = String(raw || '').trim();
    if (!raw) return '';
    var direct = {
      x: '横坐标', y: '纵坐标', d: '路径', line: '线段', path: '路径', polygon: '多边形',
      coords: '坐标', points: '坐标点', width: '宽度', height: '高度', color: '颜色',
      fac: '势力', self: '自身', to: '对方', from: '来源', old: '旧值', value: '数值',
      active: '启用', enabled: '启用', pending: '待处理', mutable: '可变'
    };
    if (direct[raw]) return direct[raw];
    if (/^fac[-_]/i.test(raw)) {
      try {
        var fac = findFaction(raw);
        if (fac) return '势力·' + (fac.label || fac.name || fac.scenarioFactionName || raw);
      } catch(_) {}
      return '势力编号·' + raw.replace(/^fac[-_]/i, '');
    }
    if (/^among[A-Z]/.test(raw)) {
      return '影响对象·' + readableUnknownField(raw.slice(5));
    }
    if (/^in[_-]/i.test(raw)) {
      return '所在范围·' + readableUnknownField(raw.replace(/^in[_-]/i, ''));
    }
    var wordMap = {
      ai: 'AI', npc: 'NPC', voc: 'VOC',
      id: '编号', sid: '剧本编号', key: '键', source: '来源', refs: '依据',
      map: '地图', runtime: '运行态', stable: '稳定', scenario: '剧本', supplement: '补充',
      faction: '势力', region: '地块', land: '陆地', ocean: '海域', owner: '归属',
      ownership: '归属', controller: '实际控制', current: '当前', initial: '初始',
      dejure: '法理', legal: '法理', core: '核心', border: '边缘',
      name: '名称', label: '称谓', short: '简称', type: '类型', sub: '子项',
      detail: '明细', profile: '画像', contract: '契约', role: '角色', style: '风格',
      leader: '首领', ruler: '君主', heir: '继嗣', chancellor: '宰辅', general: '主将',
      title: '头衔', rank: '位阶', government: '政体', posture: '姿态',
      population: '人口', mouths: '口数', households: '户数', ding: '丁口',
      registered: '在册', actual: '实数', hidden: '隐匿', fugitives: '逃户',
      male: '男丁', female: '女口', young: '少壮', old: '老弱',
      fiscal: '财政', revenue: '税额', claimed: '应征', remitted: '起运',
      retained: '留用', compliance: '合规率', skimming: '截留', autonomy: '自主',
      treasury: '府库', money: '银', grain: '粮', cloth: '布', horses: '马',
      economy: '经济', economic: '经济', commerce: '商业', volume: '额',
      coefficient: '系数', agriculture: '农业', arable: '可耕地', farmland: '耕地',
      handicraft: '手工业', mining: '矿业', trade: '贸易', routes: '路线',
      maritime: '海贸', tribute: '朝贡', currency: '货币',
      army: '军务', military: '军事', troops: '兵力', militia: '民兵',
      standing: '常备', artillery: '火炮', fleet: '舰队', fortification: '城防',
      supply: '补给', pressure: '压力', readiness: '备战度', casualties: '伤亡',
      war: '战争', front: '战线', fronts: '战线', mobilization: '动员',
      office: '官守', official: '官员', governor: '主官', position: '职名',
      vacancy: '官缺', corruption: '贪腐', execution: '执行', policy: '政策',
      local: '地方', gentry: '士绅', academies: '书院', religious: '宗教',
      sites: '场所', baojia: '保甲', jia: '甲', pai: '牌', bao: '保',
      mood: '民情', minxin: '民心', prosperity: '繁荣', carrying: '承载',
      capacity: '上限', disaster: '灾异', disasters: '灾异', unrest: '不稳',
      threats: '威胁', risk: '风险', risks: '风险', severity: '烈度',
      terrain: '地势', climate: '气候', water: '水利', roads: '道路',
      road: '道路', post: '驿递', relays: '驿站', port: '港口',
      salt: '盐课', mineral: '矿课', horse: '马政', fishing: '渔课',
      imperial: '皇室', domain: '皇庄', assets: '资产',
      culture: '文化', cultural: '文化', faith: '信仰', belief: '信仰',
      ethnicity: '族群', ethnic: '族群', ethnicities: '族群', gender: '性别',
      age: '年龄', settlement: '聚落', commoners: '平民', elite: '精英',
      relation: '关系', relations: '关系', relationship: '关系', allies: '盟友',
      enemies: '敌对', neutrals: '中立', attitude: '态度', player: '玩家',
      influence: '影响', court: '朝堂', popular: '民间', cohesion: '凝聚',
      prestige: '威望', loyalty: '忠诚', stability: '稳定', confidence: '可信度',
      strategy: '方略', strategic: '战略', priorities: '优先', goal: '目标',
      opening: '开局', problems: '问题', hints: '提示', decision: '决策',
      taboo: '禁忌', moves: '动作', counterplay: '应对', mitigations: '缓解',
      events: '事件', event: '事件', history: '历史', historical: '历史',
      notes: '备注', note: '备注', description: '叙述', desc: '叙述',
      technology: '技术', tech: '技术', learning: '学术', astronomy: '天文',
      mathematics: '算学', medicine: '医学', navigation: '航海', cartography: '舆图',
      printing: '刊印', metallurgy: '冶铁', shipbuilding: '造船',
      victory: '胜利', defeat: '失败', conditions: '条件',
      data: '数据', confidence: '可信度', readable: '可读', apply: '应用',
      function: '函数', visible: '可见', theme: '主题'
    };
    var words = splitFieldWords(raw);
    if (!words.length) return raw;
    var translated = words.map(function(w){
      var lower = w.toLowerCase();
      return wordMap[lower] || (/^[\u4e00-\u9fa5]/.test(w) ? w : '');
    }).filter(Boolean);
    if (translated.length) return translated.join('');
    return raw;
  }

  function fieldLabel(k){
    var map = {
      id: '编号', sid: '剧本编号', key: '键名', name: '名称', label: '称谓', short: '简称', type: '类型',
      factionType: '势力类型', leader: '首领', leaderName: '首领', leaderTitle: '称号', ruler: '君主',
      capital: '首府', home: '核心据点', government: '政体', rank: '位阶', desc: '说明', description: '叙述',
      note: '备注', goal: '目标', strategy: '方略', longTermStrategy: '长期方略', agenda: '议程',
      territory: '领土', resources: '资源', mainResources: '核心资源', ideology: '理念', mainstream: '主流',
      culture: '文化', personality: '性格', traits: '特质', members: '成员', history: '历史',
      historicalEvents: '历史事件', relations: '关系', allies: '盟友', enemies: '敌对', neutrals: '中立',
      attitude: '态度', attitudeDetail: '态度细节', playerRelation: '对玩家关系',
      strength: '实力', score: '评分', strengths: '优势', weaknesses: '弱点', militaryStrength: '军力',
      militaryBreakdown: '军力构成', warState: '战争状态', mobilization: '动员', manpower: '人力',
      economy: '经济', wealth: '财力', finance: '财政', treasury: '库藏', supply: '补给',
      population: '人口', actual: '实口', registered: '编户', hidden: '隐户', money: '银', grain: '粮',
      cloth: '布', horses: '马', courtInfluence: '朝堂影响', popularInfluence: '民间影响',
      prestige: '威望', cohesion: '凝聚', political: '政治', military: '军事', economic: '经济',
      cultural: '文化', ethnic: '族群', loyalty: '忠诚', succession: '继承', techLevel: '技术',
      cultureLevel: '文教', publicOpinion: '舆情', economicStructure: '经济结构', economicPolicy: '经济政策',
      internalParties: '内部派系', partyRelations: '党派关系', knownSpies: '已知间谍',
      offendThresholds: '冒犯阈值', decisionHints: '决策提示', npcDecisionHints: 'NPC 提示',
      strategicPriorities: '战略优先', openingProblems: '开局问题', tabooMoves: '禁忌动作',
      aiProfile: 'AI 画像', victoryConditions: '胜利条件', defeatConditions: '失败条件',
      commerceVolume: '商业额', commerceCoefficient: '商业系数', farmland: '耕地', roadQuality: '道路',
      postRelays: '驿站', saltProduction: '盐课', mineralProduction: '矿课', horseProduction: '马政',
      fishingProduction: '渔课', imperialFarmland: '皇庄'
    };
    Object.assign(map, {
      title: '题名', officialName: '官称', sourceId: '来源编号', sourceMap: '来源地图',
      sourceScenario: '来源剧本', sourceSupplement: '来源补充', generatedAt: '生成时间',
      mutableFields: '可变字段', runtimeContract: '运行契约', ownershipFields: '归属字段',
      ownershipMutable: '归属可变', liveState: '运行状态', dataConfidence: '数据可信度',
      dataConfidenceNote: '可信度说明', aiReadable: 'AI 可读', aiRole: 'AI 角色',
      aiReadFunction: 'AI 读取函数', aiApplyFunction: 'AI 应用函数',
      regionType: '地块类型', mapRegionId: '地图地块编号', center: '中心点', centroid: '几何中心',
      polygon: '边界多边形', points: '边界点', coords: '坐标', path: '路径', d: '路径',
      sourceRefs: '史料依据', notes: '备注', historicalNote: '史料备注',
      factionName: '势力名称', owner: '归属',
      ownerName: '归属势力', currentOwner: '当前归属',
      initialOwner: '初始归属', controller: '实际控制者',
      currentLoad: '当前负载', ownerHistory: '归属历史',
      controllerHistory: '控制历史', factionColor: '势力颜色', scenarioFactionColor: '剧本势力颜色',
      scenarioFactionName: '剧本势力名称',
      landRegionCount: '陆地数量', oceanRegionCount: '海域数量',
      unboundLandRegions: '未绑定陆地', affectedSubDivisions: '受影响子区',
      populationDetail: '人口明细', mouths: '口数', households: '户数', ding: '丁口',
      fugitives: '逃户', hiddenCount: '隐户数', sexRatio: '性别比例', registerAccuracy: '造册精度',
      byGender: '按性别', byAge: '按年龄', byEthnicity: '按族群', byFaith: '按信仰',
      bySettlement: '按聚落', actualRevenue: '实收税额', claimedRevenue: '应征税额',
      remittedToCenter: '起运中枢', retainedBudget: '留用地方', compliance: '合规率',
      skimmingRate: '截留率', autonomy: '财政自主', autonomyLevel: '自治程度',
      taxLevel: '税级', taxPressure: '税负压力', taxBurden: '税负',
      publicTreasuryInit: '地方府库', fiscalDetail: '财赋明细', economyBase: '经济基础',
      imperialAssets: '官府资产', zhizao: '织造', kuangchang: '矿厂', yuyao: '御窑',
      agriculture: '农业', arable: '可耕地', handicraft: '手工业', mining: '矿业',
      maritimeTradeVolume: '海贸额', tradeRoutes: '贸易路线', roads: '道路',
      hasPort: '港口', saltRegion: '盐区', mineralRegion: '矿区', horseRegion: '马政区',
      fishingRegion: '渔区', imperialDomain: '皇庄', armyDetail: '军务明细',
      armyPressure: '军压', troops: '驻军', garrison: '驻军', commander: '主将',
      fortification: '城防', borderRisk: '边警', warRisk: '战事风险',
      standingArmy: '常备军', militia: '民兵', artillery: '火炮', fleet: '舰队',
      activeFronts: '活跃战线', office: '官署', official: '官员', officialPosition: '主官职名',
      officialPattern: '官职模板', officeVacancy: '官缺', officeRisk: '官守风险',
      corruption: '腐败', corruptionLocal: '地方贪腐', policyExecution: '政令执行',
      localFaction: '地方派系', leadingGentry: '地方士绅', academies: '书院',
      religiousSites: '宗教场所', carryingCapacity: '承载上限', carryingRegime: '承载制度',
      minxinLocal: '地方民心', recentDisasters: '近期灾异', disasterRecord: '灾异记录',
      baojia: '保甲', baoCount: '保数', jiaCount: '甲数', paiCount: '牌数',
      specialResources: '特殊资源', specialCulture: '特殊文化', strategicValue: '战略价值',
      coreStatus: '核心/边缘', borderStatus: '边缘状态', capitalChildId: '治所子区',
      tags: '标签', neighbors: '邻接地块', climate: '气候', water: '水利',
      mainResources: '核心资源', publicOpinion: '公共舆情', decisionStyle: '决策风格',
      riskTolerance: '风险偏好', pressureVectors: '压力来源', playerCounterplay: '玩家应对',
      playerVisibleTheme: '玩家可见主题', shouldUseNamedCharacters: '需使用具名人物',
      simulationProfile: '推演画像', willSpawnIfUnanswered: '未回应将触发',
      relationshipType: '关系类型', localSupport: '地方支持', overall: '总体',
      leadership: '领导层', leaderInfo: '首领信息', leaderOriginalText: '首领原文',
      heir: '继嗣', heirInfo: '继嗣信息', designatedHeir: '指定继承人',
      regent: '摄政', chancellor: '宰辅', general: '主将', foundYear: '建立年份',
      peakYear: '鼎盛年份', historicalCap: '历史上限', vassalType: '藩属类型',
      twoBan: '两班', allyClass: '盟友类型', posture: '姿态', readiness: '备战度',
      casualties: '伤亡', fled: '逃散', starved: '饥亡', sold: '售出',
      landsSurveyed: '清丈土地', landsReclaimed: '垦复土地', landsAnnexed: '兼并土地',
      subTypes: '子类型', characterCorrections: '人物校正', isSupplement: '补充项',
      supplementId: '补充编号', supplementName: '补充名称'
    });
    Object.assign(map, {
      chars: '人物', armies: '军伍', parties: '党派', provinces: '辖省', summary: '概要',
      charCount: '人物数', armyCount: '军伍数', provinceCount: '辖省数', partyCount: '党派数',
      totalSoldiers: '总兵员', rebuiltTurn: '更新回合',
      active: '现战', pending: '将起', recent: '近役',
      taxation: '赋税', trade: '商贸', currency: '币制', labor: '役法', tribute: '贡赋',
      amongGentry: '士绅', amongPeasantry: '农户', amongScholars: '士林',
      in_manchu: '满洲', in_mongol: '蒙古', in_pirate: '海上',
      consequences: '其变', self: '自居', ethnicities: '族裔',
      rule: '承袭之制', designatedHeir: '所立之储', navigation: '航海', metallurgy: '冶铸',
      printing: '印书', astronomy: '天文', event: '事', turn: '回合', impact: '其效',
      tier: '门第', influenceDesc: '声势', base: '根基', org: '组织', longGoal: '长远之图',
      rivalParty: '对头', policyStance: '政见', officePositions: '在朝之职',
      belief: '信仰', learning: '学问', ethnicity: '族属', bio: '小传', gender: '性别', age: '年齿',
      ancestralSeat: '祖宅', founder: '始祖', currentHead: '当主', politicalStance: '政论',
      marriages: '姻娅', feuds: '世仇', tradition: '家风', recentFortunes: '近况',
      prominence: '门望', warEnabled: '可启战端'
    });
    var raw = String(k || '');
    if (map[raw]) return map[raw];
    if (/^[a-z][a-z0-9_-]*$/i.test(raw)) return readableUnknownField(raw);
    return raw;
  }

  function cleanDisplayValue(v){
    if (v === undefined || v === null) return '';
    var s = String(v).trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    var valueMap = {
      province: '省道',
      prefecture: '府州',
      county: '县邑',
      district: '辖区',
      region: '地块',
      realm: '天下',
      frontier: '边地',
      border: '边境',
      capital: '京畿',
      commandery: '郡府',
      tribe: '部族',
      jimi: '羁縻',
      vassal: '藩属',
      tributary: '朝贡',
      sovereign: '独立势力',
      court: '朝廷',
      local: '地方',
      direct: '直辖',
      neutral: '中立',
      ally: '盟友',
      allied: '盟友',
      enemy: '敌对',
      hostile: '敌对',
      friendly: '亲善',
      tense: '紧张',
      active: '生效',
      inactive: '未启用',
      pending: '待定',
      completed: '已完成',
      done: '已完成',
      good: '良好',
      warn: '警戒',
      danger: '危急',
      crisis: '危局',
      high: '高',
      medium: '中',
      low: '低'
    };
    if (valueMap[s]) return valueMap[s];
    if (valueMap[lower]) return valueMap[lower];
    var label = fieldLabel(s);
    if (label && label !== s) return label;
    var faction = null;
    try { faction = findFaction(s); } catch (_) { faction = null; }
    if (faction) return faction.label || faction.name || faction.shortName || faction.id || s;
    if (/^[a-z][a-z0-9_-]*$/i.test(s)) return '已记录';
    return s;
  }

  function ppValue(v, fallback){
    if (v === undefined || v === null || v === '') return fallback || '未记';
    if (typeof v === 'number') return mapNum(v);
    if (Array.isArray(v)) return v.length ? v.map(function(x){ return ppValue(x, ''); }).filter(Boolean).join('、') : (fallback || '未记');
    if (typeof v === 'object') {
      var hidden = { id: 1, sid: 1, key: 1, ownerKey: 1, factionKey: 1, factionId: 1, controllerKey: 1, currentOwnerKey: 1, initialOwnerKey: 1, mapFactionId: 1, runtimeFactionId: 1, stableOwnerKey: 1, scenarioFactionId: 1, stableFactionId: 1 };
      var rows = Object.keys(v).filter(function(k){ return !hidden[k]; }).slice(0, 6).map(function(k){ return fieldLabel(k) + '：' + ppValue(v[k], ''); }).filter(Boolean);
      return rows.length ? rows.join(' / ') : (fallback || '未记');
    }
    return cleanDisplayValue(v);
  }

  function mapNum(v, unit){
    var n = Number(v);
    if (!isFinite(n)) return v === undefined || v === null || v === '' ? '未记' : String(v);
    var abs = Math.abs(n);
    var text = '';
    if (abs >= 100000000) text = (n / 100000000).toFixed(abs >= 1000000000 ? 1 : 2).replace(/\.0+$/, '') + '亿';
    else if (abs >= 10000) text = (n / 10000).toFixed(abs >= 1000000 ? 0 : 1).replace(/\.0$/, '') + '万';
    else text = String(Math.round(n));
    return text + (unit || '');
  }

  function pctValue(v){
    var n = Number(v);
    if (!isFinite(n)) return ppValue(v);
    return Math.round(n <= 1 ? n * 100 : n) + '%';
  }

  function shortText(v, max){
    var s = ppValue(v, '');
    max = max || 18;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function regionTitle(r){
    var data = regionBundle(r).data;
    return firstValue(r && r.title, r && r.name, data.name, r && r.officialName, '未名地块');
  }

  function regionLevel(r){
    var data = regionBundle(r).data;
    // 2026-06-12: 剧本原始英文枚举(normal/jimi/tusi…)不直出 UI——映射中文，未知英文值跳过
    var TYPE_CN = { normal: '直辖政区', province: '省级政区', jimi: '羁縻之地', tusi: '土司辖地', fanbang: '藩属之邦', fanguo: '藩国', imperial_clan: '宗藩封地', military: '军镇', capital: '京畿' };
    var raw = firstValue(data.regionType, data.level, r && r.type, r && r.level, '');
    var label = TYPE_CN[raw] || (/^[a-z_\- ]+$/i.test(String(raw)) ? '' : raw) || '政区';
    return [label, ownerName(r)].filter(Boolean).join(' · ');
  }

  // ── 四视图计分（2026-06-11 重构）──────────────────────────────────
  // 从 regionBundle 运行时字段动态结算·替代旧粗算（旧版军务直接拿驻军数当 0-100 分用、
  // 官守是 100-corruption 但 riskClass 不反转致清廉显红）。每项可缺省、文本档位词可解析。
  // 失真层S3b·区域据奏取值(键='region.'+地块id·与tooltip同键防穿帮·公开事件如民变/战区扣分不失真·
  //   tax层=名义vs实征真账不套·docs/design-reported-view-2026-07.md)
  function mapReported(domain, r, val, dir){
    var RV = window.TM && TM.ReportedView;
    if (!RV || !RV.active(window.P || null) || !isFinite(Number(val))) return val;
    return RV.value(domain, 'region.' + String((r && (r.id || r.name)) || ''), Number(val), { direction: dir }).shown;
  }

  // 语义：mood=民心好坏(高=好) army=军务压力(高=险) office=吏治浊度(高=浊) tax=实征足额率(高=足·null=免科)
  function parseLevelWord(v, fallback){
    if (v === undefined || v === null || v === '') return fallback;
    var n = Number(v);
    if (isFinite(n)) {
      if (n > 0 && n <= 1) return n * 100;
      return Math.max(0, Math.min(100, n));
    }
    var s = String(v);
    if (/极|危|甚急/.test(s)) return 90;
    if (/高|重|急|紧/.test(s)) return 72;
    if (/中|常|平/.test(s)) return 45;
    if (/低|轻|缓|靖|安|无/.test(s)) return 20;
    return fallback;
  }
  function ratio01(v){
    var n = Number(v);
    if (!isFinite(n)) return null;
    return n > 1 ? Math.max(0, Math.min(1, n / 100)) : Math.max(0, Math.min(1, n));
  }
  function moodViewScore(r, b){
    b = b || regionBundle(r);
    var data = b.data || {};
    var base = Number(firstValue(data.minxinLocal, r && r.mood, data.prosperity, 55));
    if (!isFinite(base)) base = 55;
    base = mapReported('minxin', r, base, 'good');   // 据奏：地方上报的民心偏乐观·民变/战区扣分在下(公开事件不失真)
    var mouths = Number(firstValue(b.pop.mouths, data.population, 0)) || 0;
    var fug = Number(b.pop.fugitives) || 0;
    var hid = Number(b.pop.hiddenCount) || 0;
    var score = base;
    if (mouths > 0 && fug > 0) score -= Math.min(15, (fug / mouths) * 120);
    if (mouths > 0 && hid > 0) score -= Math.min(6, (hid / mouths) * 50);
    if (hasDisplayValue(firstValue(data.recentDisasters, (data.economyBase || {}).disasterRecord))) score -= 6;
    var unrest = Number(data.unrest);
    if (isFinite(unrest) && unrest > 0) score -= Math.min(12, unrest * 0.12);
    var live = b.liveDivision || {};
    if (live._revoltActive) score -= 25;
    else if (live._warZone) score -= 15;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  function armyViewScore(r, b){
    b = b || regionBundle(r);
    var data = b.data || {};
    var live = b.liveDivision || {};
    var pressure = parseLevelWord(firstValue(data.armyPressure, r && r.armyPressure), NaN);
    var border = parseLevelWord(firstValue(data.borderRisk, data.warRisk), NaN);
    var score;
    if (!isFinite(pressure) && !isFinite(border)) {
      score = hasDisplayValue(data.threats) ? 50 : 25;
    } else {
      score = Math.max(isFinite(pressure) ? pressure : 0, isFinite(border) ? border : 0);
      if (hasDisplayValue(data.threats)) score = Math.min(100, score + 8);
    }
    if (live._revoltActive) score = Math.max(score, 78);
    if (live._warZone) score = Math.max(score, 86);
    // 活态军情（2026-06-13 死字段修）：驻军兵变险/欠饷/低气/缺粮——军务舆图须反映当下危局，
    // 而非只读开局静态威胁词（armyPressure/borderRisk）。取绑定活军(GM.armies)的最坏一项。
    var liveArmies = (b.army && b.army.liveArmies) || [];
    var garrisonStress = 0;
    for (var _ia = 0; _ia < liveArmies.length; _ia += 1) {
      var _a = liveArmies[_ia]; if (!_a) continue;
      var _s = 0;
      var _mut = Number(_a.mutinyRisk); if (isFinite(_mut)) _s = Math.max(_s, _mut);
      var _arr = Number(_a.payArrearsMonths); if (isFinite(_arr) && _arr > 0) _s = Math.max(_s, Math.min(100, _arr * 18));
      var _mor = Number(_a.morale); if (isFinite(_mor) && _mor < 40) _s = Math.max(_s, (40 - _mor) * 1.6);
      var _sup = Number(_a.supply); if (isFinite(_sup) && _sup < 35) _s = Math.max(_s, (35 - _sup) * 1.4);
      if (_s > garrisonStress) garrisonStress = _s;
    }
    if (garrisonStress > 0) score = Math.max(score, Math.min(100, garrisonStress));
    var troops = Number(firstValue(data.garrison, b.army.troops, r && r.troops, 0)) || 0;
    var mouths = Number(firstValue(b.pop.mouths, data.population, 0)) || 0;
    if (score >= 60 && mouths > 0 && troops / mouths < 0.004) score = Math.min(100, score + 6);
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  function officeViewScore(r, b){
    b = b || regionBundle(r);
    var data = b.data || {};
    var corr = Number(firstValue(data.corruptionLocal, data.corruption));
    if (isFinite(corr)) corr = mapReported('corruption', r, corr, 'bad');   // 据奏：地方浊度瞒减显清明·缺员/怠政是可见事实不失真
    var score = isFinite(corr) ? corr : 50;
    var vac = Number(firstValue(data.officeVacancy, data.vacancy));
    if (isFinite(vac) && vac > 0) score += Math.min(12, vac * 4);
    var exec = ratio01(firstValue(data.policyExecution, data.execution));
    if (exec !== null && exec < 0.5) score += (0.5 - exec) * 30;
    if (!hasDisplayValue(firstValue(data.governor, data.official)) && hasDisplayValue(data.officialPosition)) score += 8;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  function taxViewScore(r, b){
    b = b || regionBundle(r);
    var data = b.data || {};
    var actual = Number(b.fiscal.actualRevenue);
    var claimed = Number(b.fiscal.claimedRevenue);
    var remit = Number(b.fiscal.remittedToCenter);
    var retain = Number(b.fiscal.retainedBudget);
    // 同源守卫（2026-06-12 归零病修）：实征 0 而起运/留用有值 = 跨源混账（live 0 抹了静态实征），
    // 此时实征以起运+留用重建，不让比值假归零。
    if ((!isFinite(actual) || actual <= 0) && ((isFinite(remit) && remit > 0) || (isFinite(retain) && retain > 0))) {
      actual = (isFinite(remit) ? remit : 0) + (isFinite(retain) ? retain : 0);
    }
    var score = null;
    if (isFinite(claimed) && claimed > 0 && isFinite(actual) && actual > 0) score = (actual / claimed) * 100;
    else {
      // compliance=0 是旧版零写入/死缺省（实征率真为零的地块走不到这条分——它会有账可算），按缺账处理
      var comp = ratio01(b.fiscal.compliance);
      if (comp !== null && comp > 0) score = comp * 100;
      else if (isFinite(actual) && actual > 0) score = 60;
    }
    if (score === null) return null; // 军镇免科/未设税制 → 图上「免」灰
    var skim = ratio01(b.fiscal.skimmingRate);
    if (skim !== null && skim > 0.25) score -= 5;
    // 有征即非零：实征为正时哨牌至少 1（0 读起来像坏档，而非「征得极少」）
    var floor = (isFinite(actual) && actual > 0) ? 1 : 0;
    return Math.max(floor, Math.min(100, Math.round(score)));
  }
  function yizhengViewScore(r){
    // 役政视图读数（人力/徭役层·R7-a）：役负率为主·抛荒率取大者→0-100；无 renli 账(未跑回合/未种子默认0)→null 灰
    var GMx = (typeof GM !== 'undefined' && GM) ? GM : ((typeof window !== 'undefined' && window.GM) ? window.GM : null);
    if (!GMx || !GMx.renli || !GMx.renli.byRegion) return null;
    var br = GMx.renli.byRegion;
    var rg = br[(r && (r.id || r.regionId || r.name)) || ''] || (r && r.name ? br[r.name] : null);
    if (!rg) return null;
    var corvee = Number(rg.corveeRate);
    var fallowShare = 0, cult = Number(rg.cultivatedLand), fallow = Number(rg.fallowLand);
    if (isFinite(cult) && isFinite(fallow) && (cult + fallow) > 0) fallowShare = fallow / (cult + fallow);
    if (!isFinite(corvee) && !(fallowShare > 0)) return null;
    var score = Math.max(isFinite(corvee) ? corvee * 100 : 0, fallowShare * 100);
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  // 据报人口（督抚奏报口径·slice-1b「默认看上报值」薛定谔范式）：读 GM.renli.reported·仅已种子且有瞒报之地·无则 null→回落真值。
  function _reportedPop(r){
    var GMx = (typeof GM !== 'undefined' && GM) ? GM : ((typeof window !== 'undefined' && window.GM) ? window.GM : null);
    if (!GMx || !GMx.renli || !GMx.renli.reported) return null;
    var rid = (r && (r.id || r.regionId || r.name)) || '';
    return GMx.renli.reported[rid] || (r && r.name ? GMx.renli.reported[r.name] : null) || null;
  }
  // 五档色板（深色舆图底·对比≥3:1·档字供哨牌/图例·色不孤行）
  var GRADE_BANDS = {
    mood:   { inverse: true,  bands: [[0,35,'#8c2f26','危'],[35,50,'#a85a3a','忧'],[50,65,'#a8833a','平'],[65,80,'#7d9183','安'],[80,101,'#557f6f','乐']], nullColor:'#5a6258', nullMark:'—' },
    army:   { inverse: false, bands: [[0,40,'#66796d','靖'],[40,60,'#a8833a','备'],[60,80,'#a85a3a','警'],[80,101,'#8c2f26','急']], nullColor:'#5a6258', nullMark:'—' },
    office: { inverse: false, bands: [[0,40,'#557f6f','清'],[40,60,'#a8833a','中'],[60,80,'#9d5b4b','浊'],[80,101,'#7a2018','蠹']], nullColor:'#5a6258', nullMark:'—' },
    tax:    { inverse: true,  bands: [[0,50,'#6e4a2a','欠'],[50,70,'#93702f','薄'],[70,85,'#b8923f','中'],[85,101,'#d8b96a','足']], nullColor:'#5a6258', nullMark:'免' },
    classPressure: { inverse: false, bands: [[0,25,'#557f6f','缓'],[25,50,'#a8833a','起'],[50,75,'#a85a3a','压'],[75,101,'#8c2f26','激']], nullColor:'#5a6258', nullMark:'—' },
    yizheng: { inverse: false, bands: [[0,20,'#557f6f','轻'],[20,35,'#a8833a','中'],[35,55,'#a85a3a','重'],[55,101,'#8c2f26','苛']], nullColor:'#5a6258', nullMark:'—' }
  };
  function gradeOf(mode, score){
    var g = GRADE_BANDS[mode];
    if (!g) return null;
    var n = Number(score);
    if (score === null || score === undefined || score === '' || !isFinite(n)) return { color: g.nullColor, mark: g.nullMark, idx: -1 };
    for (var i = 0; i < g.bands.length; i += 1) {
      if (n >= g.bands[i][0] && n < g.bands[i][1]) return { color: g.bands[i][2], mark: g.bands[i][3], idx: i };
    }
    var last = g.bands[g.bands.length - 1];
    return { color: last[2], mark: last[3], idx: g.bands.length - 1 };
  }
  function gradeIsWarn(mode, grade){
    var g = GRADE_BANDS[mode];
    if (!g || !grade || grade.idx < 0) return false;
    return g.inverse ? grade.idx <= 1 : grade.idx >= g.bands.length - 2;
  }
  function modeScore(r, mode){
    if (mode === 'mood') return moodViewScore(r);
    if (mode === 'classPressure') return classPressureForRegion(r).score;
    if (mode === 'tax') { var t = taxViewScore(r); return t === null ? '' : t; }
    if (mode === 'army') return armyViewScore(r);
    if (mode === 'office') return officeViewScore(r);
    if (mode === 'yizheng') return yizhengViewScore(r);
    if (mode === 'owner') return ownerName(r) ? 80 : 50;
    return 60;
  }

  function riskClass(score, inverse){
    var n = Number(score);
    if (!isFinite(n)) return 'risk-mid';
    if (inverse) {
      if (n >= 66) return 'risk-low';
      if (n >= 38) return 'risk-mid';
      return 'risk-high';
    }
    if (n >= 66) return 'risk-high';
    if (n >= 38) return 'risk-mid';
    return 'risk-low';
  }

  function ppTagNames(tags){
    if (!tags || typeof tags !== 'object') return [];
    var label = { hasPort: '港口', saltRegion: '盐课', mineralRegion: '矿课', horseRegion: '马政', fishingRegion: '渔课', imperialDomain: '皇庄' };
    return Object.keys(tags).filter(function(k){ return !!tags[k]; }).map(function(k){ return label[k] || k; });
  }

  function refreshMapPpop(){
    var pop = document.getElementById('ppop');
    if (!pop || !pop.classList.contains('show')) return;
    if (pop.dataset.panelKind === 'faction') {
      openFactionDossier(pop.dataset.factionKey || '');
      return;
    }
    var r = findRegion(pop.dataset.regionId || '');
    if (r) openRegionDossier(r);
  }

  function refreshMapFromRuntime(){
    getMapData();
    renderFormalMapSoon();
    setTimeout(refreshMapPpop, 0);
  }

  function installMapRefreshHooks(){
    if (state.mapRefreshHooksInstalled) return;
    state.mapRefreshHooksInstalled = true;
    ['tm-map-changed','tm:map-changed','tm-state-updated','tm:state-updated','tm-save-loaded','tm:save-loaded','tm-endturn-done','tm:endturn:done','tm:endturn:complete'].forEach(function(name){
      window.addEventListener(name, refreshMapFromRuntime);
      document.addEventListener(name, refreshMapFromRuntime);
    });
    if (window.EndTurnHooks && typeof EndTurnHooks.register === 'function') {
      try { EndTurnHooks.register('after', refreshMapFromRuntime, 'phase8-formal-map-refresh'); } catch(_) {}
    }
  }

  function renderMapAlerts(map){
    var host = document.querySelector('#mapwrap .map-alert-strip');
    if (!host) return;
    var issues = [];
    try { issues = typeof getIssues === 'function' ? getIssues() : []; } catch(_) { issues = []; }
    var urgent = issues.filter(function(x){ return x && String(x.status || 'pending') !== 'done'; }).slice(0, 2);
    var buttons = urgent.map(function(x, i){
      return '<button type="button" class="map-alert ' + (i === 0 ? 'hot' : '') + '" onclick="TMPhase8FormalBridge.openAction(\'memorial\')" title="' + attr(x.title || '') + '">' + esc(shortText(x.title || '待批奏疏', 14)) + '</button>'; /* 2026-07-03 10→14·配 CSS 放宽·治「陕西大饥荒·告…」双重截 */
    });
    if (buttons.length < 2) buttons.push('<button type="button" class="map-alert" onclick="TMPhase8FormalBridge.openPanel(\'issue\')">朝议待核</button>');
    buttons.push('<button type="button" class="map-alert ok" onclick="TMPhase8FormalBridge.openPanel(\'finance\')">财赋入库</button>');
    host.innerHTML = buttons.slice(0, 3).join('');
    var hint = document.getElementById('tmf-map-hint');
    if (hint) {
      var count = map && Array.isArray(map.regions) ? map.regions.length : 0;
      hint.textContent = mapScaleNote() + ' · ' + mapModeNote() + ' · ' + count + ' 地块 · 点击地块查看档案，右键查看势力。';
    }
  }

  // ══════ 第二十五拆 origin-first 双向 bucket 脚手架（勿动·配套 sibling phase8-formal-map-dossier.js）══════
  // 迁出段 = 军队对账+regionBundle 数据装配层[orig 2235-2675] + popup+方志谱牒册页 UI[orig 2881-3893]（body 0 改动）。
  // 范式②b(先例 tm-content-manager-community)：origin 装载末向 bucket 导出 kept 成员→sibling 闭包捕获；
  //   sibling 回填 5 函数(regionBundle/openRegionDossier/openFactionDossier/closeMapDossier/factionOwnsRegion)→
  //   origin forward shim 调用期解析。§5 计分带(modeScore/gradeOf/GRADE_BANDS 被上游 render 路径直读)故留守 origin。
  var __p8MapParts = (bridge.__p8MapParts = bridge.__p8MapParts || {});
  // origin 导出 kept 成员（sibling 捕获·45 项）
  __p8MapParts.firstValue = firstValue; __p8MapParts.esc = esc; __p8MapParts.ppValue = ppValue; __p8MapParts.hasDisplayValue = hasDisplayValue; __p8MapParts.hasValue = hasValue;
  __p8MapParts.plainObject = plainObject; __p8MapParts.attr = attr; __p8MapParts.ownerName = ownerName; __p8MapParts.assignKnown = assignKnown; __p8MapParts.ownerKey = ownerKey;
  __p8MapParts.shortText = shortText; __p8MapParts.mapNum = mapNum; __p8MapParts.findLiveAdminDivision = findLiveAdminDivision; __p8MapParts.state = state; __p8MapParts.toast = toast;
  __p8MapParts.findRegion = findRegion; __p8MapParts.fieldLabel = fieldLabel; __p8MapParts.regionTitle = regionTitle; __p8MapParts.gradeOf = gradeOf; __p8MapParts.getMapData = getMapData;
  __p8MapParts.pctValueIfPresent = pctValueIfPresent; __p8MapParts.compactText = compactText; __p8MapParts.factionTokens = factionTokens; __p8MapParts.fmtNum = fmtNum; __p8MapParts.firstPositive = firstPositive;
  __p8MapParts.recruitPoolValue = recruitPoolValue; __p8MapParts.rowHasDisplayValue = rowHasDisplayValue; __p8MapParts.ratio01 = ratio01; __p8MapParts.moodViewScore = moodViewScore; __p8MapParts.gradeIsWarn = gradeIsWarn;
  __p8MapParts.cssEscape = cssEscape; __p8MapParts.regionNameKeys = regionNameKeys; __p8MapParts.findLiveProvinceStats = findLiveProvinceStats; __p8MapParts.liveRegionVitals = liveRegionVitals; __p8MapParts.liveRegionOwner = liveRegionOwner;
  __p8MapParts.liveRegionGovernor = liveRegionGovernor; __p8MapParts.findFaction = findFaction; __p8MapParts.classPressureForRegion = classPressureForRegion; __p8MapParts.MAP_MODE_META = MAP_MODE_META; __p8MapParts.pctValue = pctValue;
  __p8MapParts.regionLevel = regionLevel; __p8MapParts.officeViewScore = officeViewScore; __p8MapParts._reportedPop = _reportedPop; __p8MapParts.modeScore = modeScore; __p8MapParts.ppTagNames = ppTagNames;
  // origin forward shim（sibling 回填后调用期解析·arguments 全透传）
  function regionBundle(){ return __p8MapParts.regionBundle.apply(this, arguments); }
  function openRegionDossier(){ return __p8MapParts.openRegionDossier.apply(this, arguments); }
  function openFactionDossier(){ return __p8MapParts.openFactionDossier.apply(this, arguments); }
  function closeMapDossier(){ return __p8MapParts.closeMapDossier.apply(this, arguments); }
  function factionOwnsRegion(){ return __p8MapParts.factionOwnsRegion.apply(this, arguments); }

  // ── public API attach (Wave 6·map) ────────────────────────────────
  bridge.map = bridge.map || {};
  bridge.map.renderFormalMap = renderFormalMap;
  bridge.map.renderFormalMapSoon = renderFormalMapSoon;
  bridge.map.ensureMainShell = ensureMainShell;
  bridge.map.getMapData = getMapData;
  bridge.map.findRegion = findRegion;
  bridge.map.focusRegion = focusRegion;
  bridge.map.openRegionDossier = openRegionDossier;
  bridge.map.openFactionDossier = openFactionDossier;
  bridge.map.closeMapDossier = closeMapDossier;
  bridge.map.refreshMapFromRuntime = refreshMapFromRuntime;
  bridge.map.installMapRefreshHooks = installMapRefreshHooks;
  bridge.map.renderMapAlerts = renderMapAlerts;
  bridge.map.updateMapChrome = updateMapChrome;
  bridge.map.factionOwnsRegion = factionOwnsRegion;
  bridge.map.ownerKey = ownerKey;
  bridge.map.ownerName = ownerName;
  bridge.map.findFaction = findFaction;
  bridge.map.dossierRows = dossierRows;
  bridge.map.fmtNum = fmtNum;
  // perf round6: 测试柄·供等价性验证脚本对照新旧 findLiveAdminDivision
  bridge.map.__findLiveAdminDivision = findLiveAdminDivision;
  bridge.map.__regionNameKeys = regionNameKeys;
  // perf round7: 测试柄·供等价性验证脚本对照新旧 findLiveProvinceStats / liveOwnerFromProvinceMap
  bridge.map.__findLiveProvinceStats = findLiveProvinceStats;
  bridge.map.__liveOwnerFromProvinceMap = liveOwnerFromProvinceMap;
  bridge.map.__regionKeyNorm = regionKeyNorm;
  bridge.map.__regionMatchFields = regionMatchFields;
  bridge.map.__regionTrueArea = regionTrueArea;
  bridge.map.__labelAnchor = labelAnchor;
  bridge.map.__requestMapLabelFeature = requestMapLabelFeature;
  // perf round7: 强制下次 renderFormalMap 重建 SVG(清 dirty 签名)·供几何变更等绕过守卫
  bridge.map.invalidateFormalMap = function(){ try { state._lastFormalMapSig = null; } catch(_){} };
  bridge.map.invalidateMapLabelGeometryCaches = invalidateMapLabelGeometryCaches;
  bridge.map.onMapLabelFeatureReady = function(){
    invalidateMapLabelGeometryCaches();
    state._lastFormalMapSig = null;
    renderFormalMapSoon();
    scheduleLabelLayout();
  };
  bridge.map.__formalMapSignature = formalMapSignature;

  // ── re-attach bridge exposes that previously came from bridge.js ──
  bridge._ownerKey = ownerKey;
  bridge._ownerName = ownerName;
  bridge._findFaction = findFaction;
  bridge._getMapData = getMapData;
  bridge._dossierRows = dossierRows;
  bridge._fmtNum = fmtNum;

})();
