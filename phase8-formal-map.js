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
          '<div class="map-alert-strip"><button type="button" class="map-alert hot" onclick="TMPhase8FormalBridge.openModule(\'memorial\')">待批奏疏</button><button type="button" class="map-alert" onclick="TMPhase8FormalBridge.openPanel(\'issue\')">朝议待核</button><button type="button" class="map-alert ok" onclick="TMPhase8FormalBridge.openPanel(\'finance\')">财赋入库</button></div>' +
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
          state.mapView.scale = bandToScale(state.mapScale);
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
    var groups = {};
    (map && map.regions || []).forEach(function(r){
      var key = canonicalOwnerKey(r);
      if (!key) return;
      var c = actualCenter(r);
      if (!isFinite(c.x) || !isFinite(c.y)) return;
      if (!groups[key]) {
        groups[key] = { key: key, name: ownerName(r), color: regionColor(r), x: 0, y: 0, n: 0, area: 0, minX: c.x, maxX: c.x, minY: c.y, maxY: c.y };
      }
      var g = groups[key];
      var ext = regionExtent(r);
      g.x += c.x;
      g.y += c.y;
      g.n += 1;
      g.area += Math.max(1, ext.area || 0);
      g.minX = Math.min(g.minX, ext.minX, c.x);
      g.maxX = Math.max(g.maxX, ext.maxX, c.x);
      g.minY = Math.min(g.minY, ext.minY, c.y);
      g.maxY = Math.max(g.maxY, ext.maxY, c.y);
    });
    return Object.keys(groups).map(function(k){
      var g = groups[k];
      g.x = g.x / Math.max(1, g.n);
      g.y = g.y / Math.max(1, g.n);
      g.span = Math.sqrt(Math.pow(Math.max(0, g.maxX - g.minX), 2) + Math.pow(Math.max(0, g.maxY - g.minY), 2));
      return g;
    }).sort(function(a, b){ return b.n - a.n; });
  }

  function factionLabelLayer(map){
    var groups = ownerGroups(map);
    var maxArea = Math.max.apply(null, groups.map(function(g){ return Number(g.area || 0); }).concat([1]));
    var maxN = Math.max.apply(null, groups.map(function(g){ return Number(g.n || 0); }).concat([1]));
    var maxSpan = Math.max.apply(null, groups.map(function(g){ return Number(g.span || 0); }).concat([1]));
    return groups.map(function(g){
      var name = realmFactionName(g);
      var size = realmLabelSize(g, maxArea, maxN, maxSpan, name);
      var rotate = realmLabelRotation(g.key || name);
      return '<g class="tmf-faction-label" data-faction-key="' + attr(g.key) + '" style="--realm-label-size:' + attr(size) + 'px" transform="translate(' + attr(g.x) + ' ' + attr(g.y) + ') rotate(' + attr(rotate) + ')" onclick="TMPhase8FormalBridge.openFactionByKey(\'' + attr(g.key) + '\')">' +
        '<text class="main" x="0" y="0" text-anchor="middle">' + esc(name) + '</text>' +
      '</g>';
    }).join('');
  }

  function realmLabelSize(g, maxArea, maxN, maxSpan, name){
    var areaScore = maxArea ? Math.sqrt(Math.max(0, Number(g.area || 0)) / maxArea) : 0;
    var countScore = maxN ? Math.sqrt(Math.max(0, Number(g.n || 0)) / maxN) : 0;
    var spanScore = maxSpan ? Math.sqrt(Math.max(0, Number(g.span || 0)) / maxSpan) : 0;
    var score = Math.max(0.05, areaScore * 0.56 + countScore * 0.28 + spanScore * 0.16);
    var size = 16 + score * 40;
    if (Number(g.n || 0) <= 1) size = Math.min(size, 24);
    var len = String(name || '').length;
    if (len >= 5) size *= 0.9;
    if (len >= 7) size *= 0.82;
    return Math.round(Math.max(16, Math.min(56, size)));
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
    return filtered.length ? filtered : regions;  // 该级无地块→回落全量(不空屏)
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
    var regionWashes = visibleRegions.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      return '<path class="tmf-region-wash ming-region-wash" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill="' + attr(regionColor(r)) + '" fill-rule="evenodd"></path>';
    }).join('');
    var regionHalos = visibleRegions.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      return '<path class="tmf-region-halo ming-region-halo" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '"></path>';
    }).join('');
    var regionPaths = visibleRegions.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      var c = actualCenter(r);
      var labelText = String(r.title || r.name || r.officialName || '');
      var labelWidth = Math.max(34, Math.min(96, labelText.length * 13 + 18));
      return '<path class="tmf-region ming-region" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill="' + attr(regionColor(r)) + '" fill-rule="evenodd"></path>' +
        '<g class="tmf-region-label ming-label" transform="translate(' + attr(c.x) + ' ' + attr(c.y) + ')"><rect x="' + attr(-labelWidth / 2) + '" y="-10" width="' + attr(labelWidth) + '" height="20"></rect><text x="0" y="0">' + esc(labelText) + '</text></g>';
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
    var rows = regions.filter(function(r){
      return !query || regionSearchText(r).toLowerCase().indexOf(query) >= 0;
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

  function applyMapTransform(){
    var world = document.getElementById('tmf-map-world');
    if (!world) return;
    var v = state.mapView || { scale: 1, tx: 0, ty: 0 };
    world.setAttribute('transform', 'translate(' + v.tx.toFixed(2) + ' ' + v.ty.toFixed(2) + ') scale(' + v.scale.toFixed(4) + ')');
    var stage = mapStage();
    if (stage) stage.classList.toggle('zoomed', v.scale > 1.35);
    _syncScaleLevelFromZoom();  // 阶段3·缩放跨阈值自动切层级(CK3)
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
        _tipRow('民心', firstValue(data.minxinLocal, r && r.mood));
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
      fugitives: '逃户', hiddenCount: '隐户数', sexRatio: '性别比例',
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

  // ── 军队↔地块对账层（2026-06-12）：GM.armies 与地块驻军此前两本账（驻地是城名·区划字段全空）。
  //    驻地名 token 拆分 → 两遍匹配（先全等后包含·区划子树名册爬根）→ 按地块聚合活军。
  //    剧本可在 region.data.aliases / division.aliases 扩别名（朝代地名不硬编进引擎）。──
  var _armyRegionCache = { sig: '', byRegion: {}, unboundCount: 0, unbound: [] };
  function armyRegionIndex(){
    var gm = window.GM || {};
    var armies = Array.isArray(gm.armies) ? gm.armies : [];
    var map = getMapData() || {};
    var regions = map.regions || [];
    var sig = (gm.turn || 0) + ':' + armies.length + ':' +
      armies.reduce(function(a, x){ return a + (Number(x && x.soldiers) || 0); }, 0) + ':' + regions.length;
    if (_armyRegionCache.sig === sig) return _armyRegionCache;
    // 聚落层名册（2026-06-12）：localityLayer 自带 regionId↔城名（宁远城/锦州城/皮岛/山海关…），
    // 是城名驻地的通用解（朝代地名仍归剧本数据·引擎只读结构）。
    var locByRegion = {};
    (Array.isArray(map.localityLayer) ? map.localityLayer : []).forEach(function(x){
      if (!x || !x.regionId || !x.localityName) return;
      var k = String(x.regionId);
      if (!locByRegion[k]) locByRegion[k] = [];
      locByRegion[k].push(String(x.localityName));
    });
    var books = regions.map(function(r){
      var names = regionNameKeys(r).slice();
      var live = findLiveAdminDivision(r);
      if (live) (function walk(d){
        if (d && d.name) names.push(String(d.name));
        if (d && Array.isArray(d.aliases)) d.aliases.forEach(function(a){ names.push(String(a)); });
        var kids = d && (d.children || d.divisions);
        if (kids && kids.length) kids.forEach(walk);
      })(live);
      var alias = (r.data && r.data.aliases) || (r.admin && r.admin.aliases);
      if (Array.isArray(alias)) alias.forEach(function(a){ names.push(String(a)); });
      var rid0 = String(r.id || r.name || '');
      if (locByRegion[rid0]) names = names.concat(locByRegion[rid0]);
      return {
        id: rid0,
        names: names.filter(function(n){ return n && n.length >= 2; }),
        ownerKey: String(r.owner || r.currentOwner || (r.data && r.data.dejureOwner) || ''),
        pop: Number(r.data && r.data.population) || 0
      };
    });
    function matchRegion(token){
      if (!token || token.length < 2) return null;
      var i, j, ns;
      for (i = 0; i < books.length; i += 1) {        // 第一遍：全等
        ns = books[i].names;
        for (j = 0; j < ns.length; j += 1) if (ns[j] === token) return books[i].id;
      }
      for (i = 0; i < books.length; i += 1) {        // 第二遍：双向包含
        ns = books[i].names;
        for (j = 0; j < ns.length; j += 1) {
          if (ns[j].indexOf(token) >= 0 || token.indexOf(ns[j]) >= 0) return books[i].id;
        }
      }
      return null;
    }
    var facIdByName = {};
    (Array.isArray(gm.facs) ? gm.facs : []).forEach(function(f){
      if (f && f.name && (f.id || f.sid)) facIdByName[String(f.name)] = String(f.id || f.sid);
    });
    var byRegion = {};
    var unbound = [];
    function addTo(rid, a, soldiers, label){
      if (!byRegion[rid]) byRegion[rid] = { troops: 0, armies: [] };
      byRegion[rid].troops += soldiers;
      byRegion[rid].armies.push(label ? Object.assign({}, a, { name: String(a.name || '') + label, soldiers: soldiers }) : a);
    }
    armies.forEach(function(a){
      if (!a || a.destroyed) return;
      var soldiers = Math.max(0, Math.round(Number(a.soldiers || a.size || a.strength) || 0));
      if (soldiers <= 0) return;
      var garrisonText = String(a.garrison || a.location || '');
      // ① 剧本 regionHint 直绑：不在区划树/聚落层的驻地（蓟州/固原/京师等）由剧本点名所属地块
      var hint = a.regionHint || a.regionId;
      var rid = hint ? matchRegion(String(hint)) : null;
      // ② 驻地名 token 两遍匹配（区划子树+聚落层城名）
      if (!rid) {
        var tokens = garrisonText.split(/[·\-—~／/、()（）\s]+/).filter(Boolean);
        for (var i = 0; i < tokens.length && !rid; i += 1) rid = matchRegion(tokens[i]);
      }
      // ③ 散驻天下（卫所总览类）：按本势力治下地块户口分摊（纸面分驻·卡名缀「分驻」）
      if (!rid && /全国|各地|诸省|天下/.test(garrisonText)) {
        var fid = facIdByName[String(a.faction || '')] || '';
        var owned = books.filter(function(b){ return fid && b.ownerKey === fid; });
        if (owned.length) {
          var wsum = 0;
          owned.forEach(function(b){ wsum += (b.pop > 0 ? b.pop : 1); });
          owned.forEach(function(b){
            var share = Math.round(soldiers * ((b.pop > 0 ? b.pop : 1) / wsum));
            if (share > 0) addTo(b.id, a, share, '·分驻');
          });
          return;
        }
      }
      // ④ 势力本部兜底：主力驻「游牧汗帐/诸部寨落」等无城名 → 势力名↔地块名匹配，或独块势力直绑
      if (!rid && a.faction) {
        rid = matchRegion(String(a.faction));
        if (!rid) {
          var fid2 = facIdByName[String(a.faction)] || '';
          var owned2 = books.filter(function(b){ return fid2 && b.ownerKey === fid2; });
          if (owned2.length === 1) rid = owned2[0].id;
        }
      }
      if (!rid) { unbound.push({ name: String(a.name || ''), garrison: garrisonText, soldiers: soldiers }); return; }
      addTo(rid, a, soldiers);
    });
    _armyRegionCache = { sig: sig, byRegion: byRegion, unboundCount: unbound.length, unbound: unbound };
    return _armyRegionCache;
  }
  function regionArmies(r){
    if (!r) return null;
    var idx = armyRegionIndex();
    return idx.byRegion[String(r.id || r.name || '')] || null;
  }

  function regionBundle(r){
    var base = Object.assign({}, (r && r.admin) || {}, (r && r.data) || {});
    var liveDivision = findLiveAdminDivision(r);
    var liveStats = findLiveProvinceStats(r);
    var data = assignKnown({}, base, liveDivision, liveStats);
    var liveOwner = liveRegionOwner(r, liveStats, liveDivision);
    if (hasValue(liveOwner)) {
      data.owner = liveOwner;
      data.factionName = liveOwner;
      data.ownerName = liveOwner;
    }
    var liveGovernor = firstValue(
      liveStats && liveStats.governor,
      liveStats && liveStats.governorName,
      liveStats && liveStats.currentGovernor,
      liveStats && liveStats.administrator,
      liveStats && liveStats.administratorName,
      liveStats && liveStats.localOfficial,
      liveStats && liveStats.official,
      liveStats && liveStats.currentOfficial,
      liveDivision && liveDivision.governor,
      liveDivision && liveDivision.governorName,
      liveDivision && liveDivision.currentGovernor,
      liveDivision && liveDivision.administrator,
      liveDivision && liveDivision.administratorName,
      liveDivision && liveDivision.localOfficial,
      liveDivision && liveDivision.official,
      liveDivision && liveDivision.currentOfficial
    );
    if (hasValue(liveGovernor)) {
      data.governor = liveGovernor;
      data.official = liveGovernor;
    }
    var liveOffice = firstValue(
      liveStats && liveStats.officialPosition,
      liveStats && liveStats.officialTitle,
      liveStats && liveStats.governorTitle,
      liveStats && liveStats.positionTitle,
      liveStats && liveStats.office,
      liveDivision && liveDivision.officialPosition,
      liveDivision && liveDivision.officialTitle,
      liveDivision && liveDivision.governorTitle,
      liveDivision && liveDivision.positionTitle,
      liveDivision && liveDivision.office
    );
    if (hasValue(liveOffice)) {
      data.officialPosition = liveOffice;
      data.office = liveOffice;
    }
    // ★主官绑定官职:按治理官职找在世持有人(权威·随任命/死亡而变)·剧本静态 governor(死字段)降为兜底。
    var _officePos = firstValue(data.officialPosition, liveOffice);
    var _liveGov = _officePos ? liveRegionGovernor(_officePos) : null;
    if (_liveGov) {
      data.governor = _liveGov.name; data.official = _liveGov.name;
      data.governorChar = _liveGov.name; data.governorVacant = false;
    } else {
      var _sg = firstValue(data.governor, data.official);
      var _sc = (hasValue(_sg) && typeof findCharByName === 'function') ? findCharByName(_sg) : null;
      if (_sc && (_sc.alive === false || _sc.dead === true)) { data.governor = ''; data.official = ''; data.governorVacant = true; }   // 静态主官已殁→出缺(死字段曾显死人)
      else if (!hasValue(_sg) && hasValue(_officePos)) { data.governorVacant = true; }                                                  // 有治理官职却无人→出缺
      else if (_sc) { data.governorChar = _sc.name; }                                                                                   // 静态主官在世(官职串格式异)→兜底保留+可取属性
    }
    var pop = assignKnown({},
      plainObject(base.populationDetail),
      plainObject(liveDivision && liveDivision.populationDetail),
      plainObject(liveStats && liveStats.populationDetail),
      plainObject(liveStats && liveStats.population)
    );
    if (hasValue(liveDivision && liveDivision.population) && typeof liveDivision.population !== 'object') pop.mouths = liveDivision.population;
    if (hasValue(liveStats && liveStats.population) && typeof liveStats.population !== 'object') pop.mouths = liveStats.population;
    if (hasValue(liveStats && liveStats.households)) pop.households = liveStats.households;
    [
      ['ding', 'ding', 'dingCount'],
      ['fugitives', 'fugitives', 'escapedHouseholds', 'escapedPopulation'],
      ['hiddenCount', 'hiddenCount', 'hiddenHouseholds', 'hiddenPopulation']
    ].forEach(function(row){
      var target = row[0];
      for (var i = 1; i < row.length; i += 1) {
        var key = row[i];
        var value = firstValue(liveStats && liveStats[key], liveDivision && liveDivision[key]);
        if (hasValue(value)) {
          pop[target] = value;
          break;
        }
      }
    });
    if (hasValue(pop.mouths)) data.population = pop.mouths;
    var fiscal = assignKnown({},
      plainObject(base.fiscalDetail),
      plainObject(liveDivision && liveDivision.fiscalDetail),
      plainObject(liveStats && liveStats.fiscalDetail)
    );
    // 收支四账（应征/实征/起运/留用）+实征率/产出 正值优先：live 的 0 是「cascade 未触账/旧版零写入存档」
    // 死缺省，不抹静态账。compliance 尤要：境外/边镇地块财赋分全靠它，live 0 盖掉静态即整片归零。
    var REVENUE_KEYS = { actualRevenue: 1, claimedRevenue: 1, remittedToCenter: 1, retainedBudget: 1, compliance: 1, moneyOutput: 1, grainOutput: 1 };
    [
      ['actualRevenue', 'taxRevenue', 'revenue', 'actualRevenue'],
      ['claimedRevenue', 'claimedRevenue', 'expectedRevenue'],
      ['remittedToCenter', 'remittedToCenter', 'remitToCenter'],
      ['retainedBudget', 'retainedBudget', 'retainedLocal'],
      ['compliance', 'compliance', 'taxCompliance'],
      ['skimmingRate', 'skimmingRate', 'corruptionSkimRate'],
      ['autonomy', 'fiscalAutonomy', 'autonomy'],
      ['taxBurden', 'taxBurden'],
      ['moneyOutput', 'moneyOutput', 'silverOutput', 'cashOutput'],
      ['grainOutput', 'grainOutput', 'grainTaxOutput']
    ].forEach(function(row){
      var target = row[0];
      for (var i = 1; i < row.length; i += 1) {
        var key = row[i];
        var value = firstValue(liveStats && liveStats[key], liveDivision && liveDivision[key]);
        if (REVENUE_KEYS[target] && hasValue(value) && !(Number(value) > 0)) continue; // 零值跳过·继续找
        if (hasValue(value)) {
          fiscal[target] = value;
          break;
        }
      }
    });
    // 同源对账：实征空/零而起运+留用有值（跨源混账残留），以起运+留用重建实征
    if (!(Number(fiscal.actualRevenue) > 0)) {
      var _rebuilt = (Number(fiscal.remittedToCenter) > 0 ? Number(fiscal.remittedToCenter) : 0) +
                     (Number(fiscal.retainedBudget) > 0 ? Number(fiscal.retainedBudget) : 0);
      if (_rebuilt > 0) fiscal.actualRevenue = _rebuilt;
    }
    if (hasValue(fiscal.actualRevenue)) data.taxRevenue = fiscal.actualRevenue;
    // P0-1(2026-06-20): 财政自主活账在 .fiscal.autonomyLevel(0-1·central-local/fiscal-engine 维护)·
    // 面板字段名 autonomy 仅从顶层取(:2230)取不到嵌套 autonomyLevel → 补接活账
    if (!(Number(fiscal.autonomy) > 0)) {
      var _autoLvl = firstValue(
        liveStats && liveStats.fiscal && liveStats.fiscal.autonomyLevel,
        liveDivision && liveDivision.fiscal && liveDivision.fiscal.autonomyLevel
      );
      if (hasValue(_autoLvl)) fiscal.autonomy = _autoLvl;
    }
    var treasury = assignKnown({},
      plainObject(base.publicTreasuryInit),
      plainObject(liveDivision && liveDivision.publicTreasuryInit),
      plainObject(liveStats && liveStats.publicTreasuryInit),
      plainObject(liveStats && liveStats.treasury)
    );
    ['money','silver','grain','cloth','horse'].forEach(function(k){
      var value = firstValue(liveStats && liveStats[k], liveDivision && liveDivision[k]);
      if (hasValue(value)) treasury[k] = value;
    });
    // P0-1(2026-06-20): 库藏布活账在 publicTreasury.cloth.stock(fiscal-engine cunliu 每回合写)·
    // 顶层 cloth 取不到(money/grain 由 military 写顶层 treasury·cloth 走 publicTreasury) → 补接活账
    if (!(Number(treasury.cloth) > 0)) {
      var _clothStock = firstValue(
        liveDivision && liveDivision.publicTreasury && liveDivision.publicTreasury.cloth && liveDivision.publicTreasury.cloth.stock,
        liveStats && liveStats.publicTreasury && liveStats.publicTreasury.cloth && liveStats.publicTreasury.cloth.stock
      );
      if (hasValue(_clothStock)) treasury.cloth = _clothStock;
    }
    var economy = assignKnown({},
      plainObject(base.economyBase),
      plainObject(liveDivision && liveDivision.economyBase),
      plainObject(liveStats && liveStats.economyBase)
    );
    [
      'farmland',
      'commerceVolume',
      'commerceCoefficient',
      'saltProduction',
      'mineralProduction',
      'horseProduction',
      'fishingProduction',
      'imperialFarmland',
      'postRelays',
      'roadQuality',
      'kejuQuota'
    ].forEach(function(k){
      var value = firstValue(liveStats && liveStats[k], liveDivision && liveDivision[k]);
      if (hasValue(value)) economy[k] = value;
    });
    if (hasValue(liveStats && liveStats.imperialAssets) || hasValue(liveDivision && liveDivision.imperialAssets)) {
      economy.imperialAssets = assignKnown({}, plainObject(economy.imperialAssets), plainObject(liveDivision && liveDivision.imperialAssets), plainObject(liveStats && liveStats.imperialAssets));
    }
    var army = assignKnown({},
      plainObject(base.armyDetail),
      plainObject(liveDivision && liveDivision.armyDetail),
      plainObject(liveStats && liveStats.armyDetail)
    );
    var liveDivisionArmy = plainObject(liveDivision && liveDivision.armyDetail);
    var liveStatsArmy = plainObject(liveStats && liveStats.armyDetail);
    // 驻军真账（2026-06-12 军地绑定）：第一优先 = GM.armies 按驻地聚合的活军；
    // 次之 live 字段取正值（provinceStats.soldiers=0 是死缺省·不抹静态）；全无正值保静态。
    var boundArmies = regionArmies(r);
    var troops = firstPositive(
      boundArmies && boundArmies.troops,
      liveStats && liveStats.soldiers, liveStats && liveStats.troops, liveStats && liveStats.garrison, liveStats && liveStats.strength,
      liveDivision && liveDivision.garrison, liveDivision && liveDivision.troops
    );
    if (troops !== null) {
      army.troops = troops;
      data.garrison = troops;
    }
    if (boundArmies && boundArmies.armies.length) {
      army.liveArmies = boundArmies.armies;
      army.liveArmyCount = boundArmies.armies.length;
    }
    var recruits = firstValue(
      recruitPoolValue(liveStats),
      recruitPoolValue(liveDivision),
      firstPositive(
        data.militaryRecruits,
        data.recruits,
        data.levyPool,
        data.militaryDetail && data.militaryDetail.availableRecruits,
        army.recruits,
        army.availableRecruits
      )
    );
    if (hasValue(recruits)) {
      army.recruits = recruits;
      data.militaryRecruits = recruits;
    }
    var regionCommander = firstValue(
      liveStatsArmy.commander,
      liveStatsArmy.commanderName,
      liveStatsArmy.general,
      liveStatsArmy.generalName,
      liveStatsArmy.commandingOfficer,
      liveStatsArmy.chiefCommander,
      liveStats && liveStats.commander,
      liveStats && liveStats.commanderName,
      liveStats && liveStats.general,
      liveStats && liveStats.generalName,
      liveStats && liveStats.commandingOfficer,
      liveStats && liveStats.chiefCommander,
      liveDivisionArmy.commander,
      liveDivisionArmy.commanderName,
      liveDivisionArmy.general,
      liveDivisionArmy.generalName,
      liveDivisionArmy.commandingOfficer,
      liveDivisionArmy.chiefCommander,
      liveDivision && liveDivision.commander,
      liveDivision && liveDivision.commanderName,
      liveDivision && liveDivision.general,
      liveDivision && liveDivision.generalName,
      army.commander,
      army.commanderName,
      army.general,
      army.generalName
    );
    if (hasValue(regionCommander)) {
      army.commander = regionCommander;
      data.commander = regionCommander;
    }
    var regionSupply = firstValue(
      liveStatsArmy.supply,
      liveStatsArmy.supplies,
      liveStatsArmy.supplyState,
      liveStats && liveStats.supply,
      liveStats && liveStats.supplies,
      liveStats && liveStats.supplyState,
      liveDivisionArmy.supply,
      liveDivisionArmy.supplies,
      liveDivisionArmy.supplyState,
      liveDivision && liveDivision.supply,
      liveDivision && liveDivision.supplies,
      liveDivision && liveDivision.supplyState,
      army.supply,
      army.supplies,
      army.supplyState
    );
    if (hasValue(regionSupply)) {
      army.supply = regionSupply;
      data.supply = regionSupply;
    }
    // 活态要素（2026-06-13 死字段修）：民心/吏治/繁荣/民变 优先取「活叶人口加权聚合」——
    // liveStats 对省级地块恒空（provinceStats 按府级叶键存）、liveDivision 是开局冻结的省节点，
    // 二者都读不到引擎逐回合更新的叶值；vitals 才是真实活账，置于 firstValue 首位。
    var vitals = liveRegionVitals(r, liveDivision);
    // P0-2(2026-06-20): 省级财赋四账=子叶 fiscalDetail 求和(vitals.fiscal·与叶级同源保证省=Σ府)。
    // 省节点自身 fiscalDetail 是开局静数·liveStats 省级恒空——仅父节点(有子区)覆盖,叶子保持自身账(P0-1)。
    var _isFiscalParent = liveDivision && (
      (liveDivision.children && liveDivision.children.length) ||
      (liveDivision.divisions && liveDivision.divisions.length)
    );
    if (_isFiscalParent && vitals.fiscal && vitals.fiscal.leaves > 0) {
      fiscal.claimedRevenue = vitals.fiscal.claimedRevenue;
      fiscal.actualRevenue = vitals.fiscal.actualRevenue;
      fiscal.remittedToCenter = vitals.fiscal.remittedToCenter;
      fiscal.retainedBudget = vitals.fiscal.retainedBudget;
      data.taxRevenue = vitals.fiscal.actualRevenue;
    }
    // P1-B3b·省级耕地=子府和(farmland 父覆盖·vitals 已 Σ叶·像 P0-2 fiscal·父节点用聚合值·叶级保持自身)·economy 是 :2291 clone·:2446 赋 data.economyBase
    if (_isFiscalParent && vitals.farmland > 0) economy.farmland = vitals.farmland;
    var minxin = firstValue(
      vitals.minxin,
      liveStats && liveStats.minxin, liveStats && liveStats.mood, liveStats && liveStats.stability,
      liveDivision && liveDivision.minxinLocal, liveDivision && liveDivision.minxin
    );
    if (hasValue(minxin)) { data.minxinLocal = minxin; data.minxin = minxin; }
    var prosperity = firstValue(
      vitals.prosperity,
      liveStats && liveStats.prosperity, liveStats && liveStats.wealth, liveStats && liveStats.development,
      liveDivision && liveDivision.prosperity, liveDivision && liveDivision.wealth
    );
    if (hasValue(prosperity)) data.prosperity = prosperity;
    var development = firstValue(liveStats && liveStats.development, liveDivision && liveDivision.development);
    if (hasValue(development)) data.development = development;
    var unrest = firstValue(
      vitals.unrest,
      liveStats && liveStats.unrest, liveStats && liveStats.revoltRisk,
      liveDivision && liveDivision.unrest, liveDivision && liveDivision.revoltRisk
    );
    if (hasValue(unrest)) data.unrest = unrest;
    var corruption = firstValue(
      vitals.corruption,
      liveStats && liveStats.corruption, liveStats && liveStats.corruptionLocal,
      liveDivision && liveDivision.corruptionLocal, liveDivision && liveDivision.corruption
    );
    if (hasValue(corruption)) {
      data.corruptionLocal = corruption;
      data.corruption = corruption;
    }
    data.liveVitals = vitals;
    data.populationDetail = pop;
    data.fiscalDetail = fiscal;
    data.publicTreasuryInit = treasury;
    data.economyBase = economy;
    data.armyDetail = army;
    return { data: data, pop: pop, fiscal: fiscal, treasury: treasury, army: army, liveStats: liveStats, liveDivision: liveDivision, vitals: vitals };
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

  function ensureMapPpop(){
    var pop = document.getElementById('ppop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'ppop';
      document.body.appendChild(pop);
    }
    if (!pop.__phase8MapBound) {
      pop.__phase8MapBound = true;
      // 2026-06-12 册页委托：关闭(×)=真关闭·合册(—)=收成书脊·检签=滚卷·兴造=诏令建议库
      pop.addEventListener('click', function(e){
        var hit = function(sel){ return e.target && e.target.closest ? e.target.closest(sel) : null; };
        if (hit('[data-pp-close]')) { closeMapDossier(); return; }
        var fold = hit('[data-bk-fold]');
        if (fold) { pop.classList.toggle('bk-folded'); return; }
        if (hit('.bk-spine')) { pop.classList.remove('bk-folded'); return; }
        var jq = hit('[data-bk-jq]');
        if (jq) {
          var target = pop.querySelector('#' + jq.dataset.bkJq);
          if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        var desc = hit('[data-bk-desc]');
        if (desc) { desc.classList.toggle('open'); return; }
        var foldText = hit('[data-bk-fold-text]');
        if (foldText) {
          var box = foldText.closest('.bk-fold');
          if (box) {
            box.classList.toggle('open');
            foldText.textContent = box.classList.contains('open') ? '收 起 ▴' : '展 读 全 文 ▾';
          }
          return;
        }
        var build = hit('[data-bk-build]');
        if (build) {
          var divName = build.dataset.bkBuild || '';
          if (typeof window._dfBuildModal === 'function') window._dfBuildModal(divName);
          else if (typeof toast === 'function') toast('营造入口未就绪');
          return;
        }
        var openFac = hit('[data-bk-open-faction]');
        if (openFac) { openFactionDossier(openFac.dataset.bkOpenFaction || '', null); return; }
        var openReg = hit('[data-bk-open-region]');
        if (openReg) {
          var rr = findRegion(openReg.dataset.bkOpenRegion || '');
          if (rr) openRegionDossier(rr);
          else if (typeof toast === 'function') toast('舆图上未录此地');
          return;
        }
        var ledger = hit('[data-bk-ledger]');
        if (ledger) {
          var dn = ledger.dataset.bkLedger || '';
          if (typeof window.openDivisionDetail === 'function') window.openDivisionDetail(dn);
          return;
        }
      });
      // 活账因果签：hover 展示「此数牵动什么」
      pop.addEventListener('mouseover', function(e){
        var el = e.target && e.target.closest ? e.target.closest('[data-bk-cause]') : null;
        if (el) showBkCause(el);
      });
      pop.addEventListener('mouseout', function(e){
        var el = e.target && e.target.closest ? e.target.closest('[data-bk-cause]') : null;
        if (el) hideBkCause();
      });
      // 兴造录入诏令后：方志开着就重渲营造志（候诏卡即时可见）并滚到该卷
      document.addEventListener('tm-yingzao-submitted', function(e){
        var detail = (e && e.detail) || {};
        var p = document.getElementById('ppop');
        if (!p || p.dataset.panelKind !== 'region' || p.className.indexOf('show') < 0) return;
        var r = findRegion(p.dataset.regionId || '') || findRegion(detail.regionId || detail.divName || '');
        if (!r) return;
        openRegionDossier(r);
        setTimeout(function(){
          var y = document.getElementById('bk-yingzao');
          if (y && typeof y.scrollIntoView === 'function') y.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      });
    }
    return pop;
  }

  function markSelectedRegion(id){
    document.querySelectorAll('.tmf-region.selected').forEach(function(x){ x.classList.remove('selected'); });
    if (!id) return;
    var el = document.querySelector('.tmf-region[data-region-id="' + cssEscape(id) + '"]');
    if (el) el.classList.add('selected');
  }

  function closeMapDossier(){
    var old = document.getElementById('tmf-map-dossier');
    if (old) old.remove();
    var pop = document.getElementById('ppop');
    if (pop) {
      pop.classList.remove('show', 'region-panel', 'faction-panel');
      pop.removeAttribute('data-region-id');
      pop.removeAttribute('data-faction-key');
      pop.removeAttribute('data-panel-kind');
    }
    document.body.classList.remove('province-panel-open');
  }

  // ════════ 方志/谱牒册页（2026-06-12 重构）════════════════════════════
  // 替代 codex 版 760px 大板+7tab+重复 grid：左缘窄册页 392px·检签六卷连续滚动·
  // 可合册成书脊·×真关闭。数据与四视图计分同源(regionBundle/modeScore)，
  // 营造志读 division.buildings（建筑工役引擎），因果账签展示字段牵动链。
  function bkRow(k, v, tone, cause){
    if (!hasDisplayValue(v)) return '';
    var vs = ppValue(v);
    return '<div class="bk-lr"' + (cause ? ' data-bk-cause="' + attr(cause) + '"' : '') + '><span class="bk-k">' + esc(k) + '</span><span class="bk-v ' + (tone || '') + (vs.length > 14 ? ' wrap' : '') + '">' + esc(vs) + '</span></div>';
  }
  // 豪强势力数值条(读 provinceStats.magnatePower·tm-region-magnate 引擎):势力<20 不扰目,渐进定性。
  function _magnateLabel(ls){
    if (!ls || typeof ls.magnatePower !== 'number') return '';
    var mp = ls.magnatePower;
    if (mp < 20) return '';
    var label = mp >= 70 ? '势大难制' : mp >= 50 ? '坐大' : mp >= 35 ? '渐起' : '抬头';
    return Math.round(mp) + ' · ' + label + (ls._magnateCollusion ? ' · 勾结州县' : '');
  }
  function bkLan(rows, one){
    var html = rows.join('');
    return html ? '<div class="bk-lan' + (one ? ' one' : '') + '">' + html + '</div>' : '';
  }
  function bkJuan(id, no, title, hint, inner){
    if (!inner) return '';
    return '<section class="bk-juan" id="' + attr(id) + '"><div class="bk-jt"><span class="bk-jseal">' + esc(no) + '</span><b>' + esc(title) + '</b><small>' + esc(hint || '') + '</small></div>' + inner + '</section>';
  }
  function bkStat(k, v, note, warn, cause){
    if (!hasDisplayValue(v)) return '';
    return '<div class="bk-stat' + (warn ? ' warn' : '') + '"' + (cause ? ' data-bk-cause="' + attr(cause) + '"' : '') + '><span class="k">' + esc(k) + '</span><span class="v">' + esc(ppValue(v)) + '</span><span class="n">' + esc(note || '') + '</span></div>';
  }
  function bkStats(cards){
    var html = cards.filter(Boolean).join('');
    return html ? '<div class="bk-stats">' + html + '</div>' : '';
  }
  function bkWuGrid(rows){
    var html = rows.filter(rowHasDisplayValue).map(function(row){
      return '<div class="bk-wu"><span class="k">' + esc(row[0]) + '</span><span class="v">' + esc(ppValue(row[1])) + '</span></div>';
    }).join('');
    return html ? '<div class="bk-wu-grid">' + html + '</div>' : '';
  }
  function bkChips(rows){
    var html = rows.filter(rowHasDisplayValue).map(function(row){
      return '<span class="bk-chip"><b>' + esc(row[0]) + '</b>' + esc(ppValue(row[1])) + '</span>';
    }).join('');
    return html ? '<div class="bk-chips">' + html + '</div>' : '';
  }
  // 年龄结构 {young/ding/old:{count,ratio}} → "少壮 X / 丁壮 X / 老弱 X"(专用格式化·绕开泛型 dump·免 old 被误译"旧值"+count/ratio 吐原文)
  function fmtByAge(a){
    if (!a || typeof a !== 'object' || Array.isArray(a)) return a;
    var AGE = { infant: '婴孩', child: '幼弱', young: '少壮', ding: '丁壮', adult: '丁壮', old: '老弱', elder: '耆老' };
    var order = ['infant', 'child', 'young', 'ding', 'adult', 'old', 'elder'];
    var keys = order.filter(function(k){ return a[k] != null; });
    Object.keys(a).forEach(function(k){ if (keys.indexOf(k) < 0 && a[k] != null) keys.push(k); });
    var parts = [];
    keys.forEach(function(k){
      var g = a[k], cnt = (g && typeof g === 'object') ? g.count : g;
      if (cnt == null || cnt === '') return;
      parts.push((AGE[k] || fieldLabel(k)) + ' ' + mapNum(cnt));
    });
    return parts.length ? parts.join(' / ') : a;
  }
  // 聚落结构 {fang/shi/zhen:{mouths,households}} → "坊 X / 市 X / 镇 X"(专用格式化·免拼音键+口数重复)
  function fmtBySettlement(s){
    if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
    var SET = { fang: '坊', shi: '市', zhen: '镇', cun: '村', xiang: '乡', li: '里', du: '都', tun: '屯', bao: '堡', wei: '卫', suo: '所', cheng: '城', guan: '关' };
    var parts = [];
    Object.keys(s).forEach(function(k){
      var v = s[k], m = (v && typeof v === 'object') ? (v.mouths != null ? v.mouths : (v.population != null ? v.population : v.count)) : v;
      if (m == null || m === '') return;
      parts.push((SET[k] || fieldLabel(k)) + ' ' + mapNum(m));
    });
    return parts.length ? parts.join(' / ') : s;
  }
  function bkFold(text){
    if (!hasDisplayValue(text)) return '';
    return '<div class="bk-fold"><pre>' + esc(ppValue(text)) + '</pre><button type="button" class="bk-fold-btn" data-bk-fold-text="1">展 读 全 文 ▾</button></div>';
  }
  function bkBar(title, items, totalLabel){
    var sum = items.reduce(function(a, x){ return a + (Number(x[1]) || 0); }, 0);
    if (sum <= 0) return '';
    return '<div class="bk-bar-strip"><div class="bs-t"><span>' + esc(title) + '</span><span>' + esc(totalLabel || '') + '</span></div>' +
      '<div class="bk-bar">' + items.map(function(x){ return '<i style="width:' + ((Number(x[1]) || 0) / sum * 100) + '%;background:' + attr(x[2]) + '"></i>'; }).join('') + '</div>' +
      '<div class="bk-bar-legend">' + items.map(function(x){ return '<em style="--c:' + attr(x[2]) + '">' + esc(x[0]) + ' ' + esc(fmtNum(x[1])) + '</em>'; }).join('') + '</div></div>';
  }
  function bkHead(opts){
    return '<div class="bk-head">' +
      '<div class="bk-bigseal' + (opts.round ? ' round' : '') + '"><i>' + esc(opts.seal) + '</i></div>' +
      '<div class="bk-kind"><span class="bk-tag">' + esc(opts.kind) + '</span>' +
        '<button type="button" class="bk-close" data-bk-fold="1" title="合册成脊">—</button>' +
        '<button type="button" class="bk-close x" data-pp-close="1" title="关闭">×</button></div>' +
      '<div class="bk-title-row"><div class="bk-name">' + esc(opts.name) + '</div><div class="bk-name-sub">' + esc(opts.sub || '') + '</div></div>' +
      '<div class="bk-govline">' + opts.pills.filter(Boolean).join('') + '</div>' +
      (hasDisplayValue(opts.desc) ? '<p class="bk-desc" data-bk-desc="1">' + esc(ppValue(opts.desc)) + '</p>' : '') +
    '</div>';
  }
  function bkSpine(label){
    return '<div class="bk-spine"><div class="sp-seal">印</div><div class="sp-label">' + esc(label) + '<small>点 脊 展 册</small></div></div>';
  }
  function bkJianqian(items){
    return '<div class="bk-jianqian">' + items.map(function(it, i){
      return '<div class="bk-jq" data-bk-jq="' + attr(it[0]) + '"><span class="jq-no">' + '一二三四五六七八'.charAt(i) + '</span>' + esc(it[1]) + '</div>';
    }).join('') + '</div>';
  }
  var BK_TAB_JUAN = { mood: 'bk-hukou', classPressure: 'bk-hukou', tax: 'bk-caifu', army: 'bk-junbei', office: 'bk-zhiguan' };
  function bkScrollToTab(pop, tab){
    var id = BK_TAB_JUAN[tab];
    if (!id) return;
    var el = pop.querySelector('#' + id);
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'start' }); } catch(_) { el.scrollIntoView(); }
    }
  }
  var _bkSpy = null;
  function bindBkSpy(pop){
    if (_bkSpy) { try { _bkSpy.disconnect(); } catch(_) {} _bkSpy = null; }
    var scroll = pop.querySelector('.bk-scroll');
    if (!scroll || typeof IntersectionObserver !== 'function') return;
    _bkSpy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        pop.querySelectorAll('.bk-jq').forEach(function(x){ x.classList.toggle('active', x.dataset.bkJq === en.target.id); });
      });
    }, { root: scroll, rootMargin: '-8% 0px -78% 0px', threshold: 0 });
    scroll.querySelectorAll('.bk-juan').forEach(function(s){ _bkSpy.observe(s); });
    var first = pop.querySelector('.bk-jq');
    if (first) first.classList.add('active');
  }
  // ── 活账因果签：字段牵动链（动态拼当前账面值·非死文案） ──
  function bkCauseDef(key, r){
    var b = regionBundle(r);
    var data = b.data || {};
    var corr = firstValue(data.corruptionLocal, data.corruption);
    var skim = ratio01(b.fiscal.skimmingRate);
    var comp = ratio01(b.fiscal.compliance);
    var defs = {
      corr: { t: '贪腐 ' + ppValue(corr) + ' · 牵动', items: [
        ['截留', '贪腐推高税赋截留' + (skim !== null ? '——今截留 ' + Math.round(skim * 100) + '%' : '') + '，实征随减'],
        ['税基', '征税公式按贪腐打折（罚至五成为限）'],
        ['整饬', '肃贪诏令 / 换主官 / 派钦差可降之（走诏令）']] },
      minxin: { t: '民心 ' + ppValue(moodViewScore(r, b)) + ' · 牵动', items: [
        ['民变', '民变判级按各省民心，非全国均值——低于 50 入「忧」档'],
        ['逃户', '民心愈低逃户愈众' + (hasDisplayValue(b.pop.fugitives) ? '——今逃 ' + ppValue(b.pop.fugitives) : '') + '，税基随减'],
        ['回原', '民心由叶账聚合：税负、灾异、徭役、兵祸、贪腐皆摊入']] },
      tax: { t: '实征 ' + ppValue(b.fiscal.actualRevenue) + ' · 牵动', items: [
        ['央地', '实征按央地分成：起运入太仓，留用存地方库'],
        ['合规', (comp !== null ? '合规率 ' + Math.round(comp * 100) + '%——' : '') + '应征与实征之差即欠征'],
        ['加派', '强征可增实征，然民心叶账立扣——加派激变之鉴不远']] },
      army: { t: '驻军 ' + ppValue(firstValue(data.garrison, b.army.troops)) + ' · 牵动', items: [
        ['守御', '守城战力 = 驻军 × 城防档位乘成（围城结算实读）'],
        ['军压', '边警与驻军共定军压——高军压日耗粮饷'],
        ['抽调', '抽兵他调则本地守御立减，边警之地慎抽']] },
      pop: { t: '户口 ' + ppValue(firstValue(data.population, b.pop.mouths)) + ' · 牵动', items: [
        ['税基', '应征 = 田亩 × 税则 + 丁口 × 丁银——户口即税基'],
        ['兵源', '可募兵源按丁口折算'],
        ['逃隐', '逃户隐户不纳粮——清丈括户可收编（走诏令）']] },
      fugitive: { t: '逃户 ' + ppValue(b.pop.fugitives) + ' · 牵动', items: [
        ['税基', '逃户不纳粮——岁入随减'],
        ['民变', '流民为民变之薪'],
        ['安辑', '减赋、放赈、垦荒可招抚归籍（走诏令）']] },
      hidden: { t: '隐户 ' + ppValue(b.pop.hiddenCount) + ' · 牵动', items: [
        ['税基', '豪强荫庇之口，不在册——税基之漏'],
        ['清丈', '清丈括户可收编入册，然必触士绅之怒']] },
      ding: { t: '丁口 ' + ppValue(b.pop.ding) + ' · 牵动', items: [
        ['丁银', '丁口 × 丁银入应征'],
        ['徭役', '征发徭役按丁——大工役耗丁则民心叶账立扣'],
        ['兵源', '募兵上限按丁口折算']] },
      compliance: { t: '合规率 ' + (comp !== null ? Math.round(comp * 100) + '%' : '—') + ' · 牵动', items: [
        ['实征', '起运净额 = 起运毛额 × 合规率——央地财政真账之闸'],
        ['因由', '贪腐、士绅抗税、灾异共同压低'],
        ['提振', '清吏治 / 安民心 / 缓灾年皆走叶账']] },
      skim: { t: '截留 ' + (skim !== null ? Math.round(skim * 100) + '%' : '—') + ' · 牵动', items: [
        ['去向', '截留入贪腐之囊，不入太仓不入地方库'],
        ['根由', '与贪腐同涨同消——肃贪则截留自降']] },
      fort: { t: '城防 · 牵动', items: [
        ['守御', '守城战力按城防档位乘成（1-5 档 ×1.3 ～ ×3.0·围城结算实读）'],
        ['营造', '营造志修城墙 / 敌台可升档（走诏令工役）']] },
      vacancy: { t: '官缺 ' + ppValue(firstValue(data.officeVacancy, data.vacancy)) + ' · 牵动', items: [
        ['执行', '官缺愈多政令执行愈低——无官则政不行'],
        ['铨选', '吏部铨选 / 科举取士可补（走人事）']] },
      exec: { t: '政令执行 ' + ppValue(firstValue(data.policyExecution, data.execution)) + ' · 牵动', items: [
        ['诏效', '凡颁于此地之诏，效用按执行率打折'],
        ['因由', '官缺、贪腐、地方派系共同拖累']] },
      recruits: { t: '可募兵源 ' + ppValue(firstValue(data.militaryRecruits, b.army.recruits)) + ' · 牵动', items: [
        ['上限', '募兵不得过此数——强拉则民心叶账立扣'],
        ['营造', '卫所 / 军府类工役可增之']] },
      post: { t: '驿路 · 牵动', items: [
        ['政令', '驿密则政令时滞短——边报朝发夕至'],
        ['裁驿', '裁驿省银而驿卒失业——流民之源，前车可鉴']] },
      prosperity: { t: '繁荣 ' + ppValue(firstValue(data.prosperity, r && r.prosperity)) + ' · 牵动', items: [
        ['税基', '繁荣即税基之一——繁则岁入随长'],
        ['缓变', '每回合按民心、地方状态（奇观/灾异/营造之利）、兵燹缓变'],
        ['状态', '状态卷之效皆乘入此地岁入——奇观增之，灾异削之']] }
    };
    return defs[key] || null;
  }
  // S7 近账：因果签下半显示该字段最近变更（div._fieldLedger 环账·FieldPipes/BuildingWorks 记入）
  var BK_CAUSE_LEDGER_FIELD = { minxin: 'minxin', recruits: 'recruits', army: 'recruits', fort: 'fort', corr: 'corruption', prosperity: 'prosperity' };
  function bkCauseLedgerHtml(key, r){
    var field = BK_CAUSE_LEDGER_FIELD[key];
    if (!field) return '';
    var div = findLiveAdminDivision(r);
    var ring = div && div._fieldLedger && Array.isArray(div._fieldLedger[field]) ? div._fieldLedger[field] : null;
    if (!ring || !ring.length) return '';
    return ring.slice(-3).reverse().map(function(en){
      var d = Number(en.delta) || 0;
      return '<div class="cp-led-row"><span class="lt">回合 ' + esc(String(en.turn)) + '</span><span class="ld ' + (d < 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '+' : '') + esc(String(d)) + '</span><span class="lw">' + esc(en.why || '') + '</span></div>';
    }).join('');
  }
  function ensureBkCausePop(){
    var el = document.getElementById('tmf-bk-cause');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tmf-bk-cause';
      el.className = 'tmf-bk-cause';
      document.body.appendChild(el);
    }
    return el;
  }
  function showBkCause(el){
    var pop = document.getElementById('ppop');
    var rid = pop && pop.dataset.regionId;
    var r = rid ? findRegion(rid) : null;
    if (!r) return;
    var def = bkCauseDef(el.dataset.bkCause, r);
    if (!def) return;
    var host = ensureBkCausePop();
    var led = bkCauseLedgerHtml(el.dataset.bkCause, r);
    host.innerHTML = '<div class="cp-hd"><span class="cp-seal">牵</span><b>' + esc(def.t) + '</b></div>' +
      '<div class="cp-body">' + def.items.map(function(it){ return '<div class="cp-item"><span class="ck">' + esc(it[0]) + '</span><span class="cv">' + esc(it[1]) + '</span></div>'; }).join('') + '</div>' +
      (led ? '<div class="cp-led"><b>近 账</b>' + led + '</div>' : '') +
      '<div class="cp-ft">活账之义：此数每回合由叶账聚合而来，亦反向牵动他账。</div>';
    var rect = el.getBoundingClientRect();
    var x = rect.right + 12, y = rect.top - 6;
    if (x + 280 > window.innerWidth) x = rect.left - 286;
    if (y + 230 > window.innerHeight) y = window.innerHeight - 240;
    host.style.left = x + 'px';
    host.style.top = Math.max(52, y) + 'px';
    host.classList.add('show');
  }
  function hideBkCause(){
    var host = document.getElementById('tmf-bk-cause');
    if (host) host.classList.remove('show');
  }
  // ── 营造志卡（建筑工役引擎数据） ──
  function bkYeCard(bld, P){
    var bw = (window.TM && TM.BuildingWorks) || null;
    var typeDef = bw ? bw.typeDefFor(bld.name, P) : null;
    var labels = bw ? bw.fxLabels(bld, typeDef) : [];
    var doing = bld.status === 'building';
    var neglected = bld.status === 'neglected';
    var damaged = bld.status === 'damaged';   // S6·半损态
    var ledger = (bw && bw.buildingLedger && !doing && !bld._proposal) ? bw.buildingLedger(bld, typeDef) : null;   // S7·实入账(完工/半损卡显真贡献)
    var total = Number(bld.timeActual) || Number(typeDef && typeDef.buildTime) || Math.max(1, Number(bld.remainingTurns) || 1);
    var prog = doing ? Math.round(Math.max(0, Math.min(1, (total - (Number(bld.remainingTurns) || 0)) / total)) * 100) : 100;
    var stCls = doing ? 'doing' : (neglected ? 'ni' : (damaged ? 'ni' : 'done'));
    var stTxt = doing ? '工 役 中' : (neglected ? '失 修' : (damaged ? '半 损' : '完 好'));
    return '<div class="bk-ye' + (bld._proposal ? ' nijian' : '') + '">' +
      '<div class="ye-hd"><b>' + esc(bld.name) + '</b><span class="lv">' + (bld._proposal ? '候 诏' : esc((bld.isCustom ? '自拟 · ' : '') + (bld.level || 1) + ' 级')) + '</span><span class="st ' + stCls + '">' + (bld._proposal ? '候 诏' : stTxt) + '</span></div>' +
      (hasDisplayValue(bld.description) ? '<p>' + esc(compactText ? compactText(bld.description, 90) : String(bld.description).slice(0, 90)) + '</p>' : '') +
      (hasDisplayValue(bld.judgedEffects) && !labels.length ? '<p>' + esc(String(bld.judgedEffects).slice(0, 90)) + '</p>' : '') +
      (labels.length ? '<div class="fx">' + labels.map(function(x, i){ return '<em class="' + (i === labels.length - 1 && /维护/.test(x) ? 'cost' : '') + '">' + esc(x) + '</em>'; }).join('') + '</div>' : '') +
      // S7·营造可观测账：完工/半损卡显「实入账」(真为本地所添·非 per-level 规则) + 工成之利岁入
      (ledger && ledger.applied && ledger.applied.length ? '<div style="margin-top:4px;font-size:12px;color:#5a4a32;">实入账：' + esc(ledger.applied.join(' · ')) + (ledger.flowPct > 0 ? ' · 岁入 +' + ledger.flowPct + '%/回合' : '') + '</div>' : '') +
      (damaged ? '<div style="margin-top:3px;font-size:12px;color:#9a3a2a;">半损 · 效用减半 · 库银可支半费则葺治复完</div>' : '') +
      (doing ? '<div class="gq"><div class="gq-bar"><i style="width:' + prog + '%"></i></div><em>余 ' + esc(bld.remainingTurns) + ' 回合</em></div>' : '') +
      '</div>';
  }
  function bkYingzao(r, b){
    var live = b.liveDivision;
    var P = window.P || {};
    var divName = firstValue(live && live.name, r && r.name, r && r.title, '');
    var cards = [];
    var seenBuildCards = {};
    function buildCardKey(bld){
      if (!bld) return '';
      return String(bld.territory || bld._territory || divName || '') + '|' + String(bld.type || bld.name || '');
    }
    function pushBuildCard(bld){
      if (!bld) return;
      var k = buildCardKey(bld);
      if (k && seenBuildCards[k]) return;
      if (k) seenBuildCards[k] = true;
      cards.push(bkYeCard(bld, P));
    }
    if (live && Array.isArray(live.buildings) && live.buildings.length) {
      live.buildings.forEach(pushBuildCard);
    }
    if (typeof getTerritoryBuildingsCompat === 'function') {
      var compatNames = [];
      [divName, live && live.name, r && r.name, r && r.title, r && r.officialName].forEach(function(v){
        if (!hasDisplayValue(v)) return;
        v = String(v);
        if (compatNames.indexOf(v) < 0) compatNames.push(v);
      });
      compatNames.forEach(function(name){
        try { getTerritoryBuildingsCompat(name).forEach(pushBuildCard); } catch (_) {}
      });
    }
    // 诏令建议库中候颁的本地营造案（_dfBuildModal 推入·source='工程'）
    var gm = window.GM || {};
    (Array.isArray(gm._edictSuggestions) ? gm._edictSuggestions : []).forEach(function(s){
      if (s && !s.used && s.from === divName && String(s.source || '') === '工程') {
        cards.push(bkYeCard({ name: String(s.content || '营造案').slice(0, 24) + '…', _proposal: true, description: '已录入诏令建议库，候颁行后由有司核定费用、工期与效用。' }, P));
      }
    });
    var canBuild = !!live && hasDisplayValue(divName);
    var buildBtn = canBuild
      ? '<button type="button" class="bk-act zhu wide" data-bk-build="' + attr(divName) + '">⊕ 兴 造 · 录 入 诏 令</button>'
      : '';
    if (!cards.length && !buildBtn) return '';
    var note = !cards.length ? '<p class="bk-ye-empty">此地尚无在册工役——可兴造以厚其本。</p>' : '';
    return note + cards.join('') + buildBtn;
  }
  // ── 地块方志 ──
  function renderRegionBook(r){
    var b = regionBundle(r);
    var data = b.data || {};
    var econ = data.economyBase || {};
    var assets = econ.imperialAssets || {};
    var children = Array.isArray(data.children) ? data.children : [];
    var tagList = ppTagNames(data.tags);
    var oKey = ownerKey(r);
    var moodS = moodViewScore(r, b);
    var offS = officeViewScore(r, b);
    var corr = firstValue(data.corruptionLocal, data.corruption);
    var cp = classPressureForRegion(r);
    var cpHtml = (cp.count > 0 || Number(cp.score) > 0) ? bkLan([
      bkRow('阶层压力', hasDisplayValue(cp.score) ? cp.score + ' / 100' : '', Number(cp.score) >= 50 ? 'zhu' : ''),
      bkRow('牵动阶层', cp.classNames.join('、')),
      bkRow('最近近因', cp.reason)
    ], true) : '';
    var head = bkHead({
      seal: '御览', round: false, kind: '方 志',
      name: regionTitle(r), sub: regionLevel(r), desc: firstValue(data.description, r && r.description),
      pills: [
        hasDisplayValue(ownerName(r)) ? '<span class="bk-pill owner" data-bk-open-faction="' + attr(oKey) + '" title="展其谱牒"><span class="dot"></span>隶 <b>' + esc(ownerName(r)) + '</b></span>' : '',
        (function(){
          var op = esc(firstValue(data.officialPosition, '主官'));
          if (data.governorVacant) return '<span class="bk-pill" style="color:var(--vermillion-400,#c0563a);border-color:var(--vermillion-400,#c0563a);" title="该地治理官职出缺·待补任">' + op + ' <b>空缺·待补</b></span>';
          var gn = firstValue(data.governor, data.official);
          if (!hasDisplayValue(gn)) return '';
          var gc = (data.governorChar && typeof findCharByName === 'function') ? findCharByName(data.governorChar) : null;
          var adm = (gc && hasDisplayValue(gc.administration)) ? ' <span style="opacity:.65;font-size:0.92em;">政' + esc(gc.administration) + '</span>' : '';
          return '<span class="bk-pill" title="' + op + ' · 当任主官(绑官职持有人·随任免更新)">' + op + ' <b>' + esc(gn) + '</b>' + adm + '</span>';
        })(),
        hasDisplayValue(firstValue(data.terrain, r && r.terrain)) ? '<span class="bk-pill">' + esc(firstValue(data.terrain, r && r.terrain)) + '</span>' : '',
        hasDisplayValue(data.taxLevel) ? '<span class="bk-pill">税 <b>' + esc(data.taxLevel) + '</b></span>' : ''
      ]
    });
    var stats = bkStats([
      bkStat('户口', firstValue(data.population, b.pop.mouths), hasDisplayValue(b.pop.ding) ? '丁 ' + ppValue(b.pop.ding) : '', false, 'pop'),
      bkStat('实征', b.fiscal.actualRevenue, hasDisplayValue(b.fiscal.compliance) ? '合规 ' + pctValue(b.fiscal.compliance) : '', false, 'tax'),
      bkStat('驻军', firstValue(data.garrison, b.army.troops, r && r.troops), firstValue(data.armyPressure, ''), false, 'army'),
      bkStat('民心', hasDisplayValue(firstValue(data.minxinLocal, r && r.mood, data.prosperity)) ? moodS : '', (gradeOf('mood', moodS) || {}).mark || '', gradeIsWarn('mood', gradeOf('mood', moodS)), 'minxin'),
      bkStat('吏治', hasDisplayValue(corr) ? offS : '', (gradeOf('office', offS) || {}).mark || '', gradeIsWarn('office', gradeOf('office', offS)), 'corr')
    ]);
    var hukou = bkLan([
      bkRow('在册口数', firstValue(data.population, b.pop.mouths)),
      bkRow('在册户', b.pop.households),
      bkRow('丁口', b.pop.ding, null, 'ding'),
      bkRow('逃户', b.pop.fugitives, 'zhu', 'fugitive'),
      bkRow('隐户', b.pop.hiddenCount, 'zhu', 'hidden'),
      bkRow('承载上限', data.carryingCapacity),
      bkRow('保甲', data.baojia),
      bkRow('繁荣', firstValue(data.prosperity, r && r.prosperity), null, 'prosperity'),
      (hasDisplayValue(data.wealth) && String(data.wealth) !== String(firstValue(data.prosperity, r && r.prosperity)) ? bkRow('财富', data.wealth) : ''),            // P2-2·异于繁荣才显(去重同值·保留异值·不盲删)
      (hasDisplayValue(data.development) && String(data.development) !== String(firstValue(data.prosperity, r && r.prosperity)) ? bkRow('发展', data.development) : ''),  // P2-2·同上
      bkRow('不稳', data.unrest, 'zhu')
    ]) + bkChips([
      ['性别', data.byGender], ['年龄', fmtByAge(data.byAge)], ['族群', data.byEthnicity],
      ['信仰', data.byFaith], ['聚落', fmtBySettlement(data.bySettlement)], ['宗教场所', data.religiousSites]
    ]) + cpHtml;
    var caifu = bkLan([
      bkRow('应征', b.fiscal.claimedRevenue),
      bkRow('实征', b.fiscal.actualRevenue, null, 'tax'),
      bkRow('起运中枢', b.fiscal.remittedToCenter),
      bkRow('留用地方', b.fiscal.retainedBudget),
      bkRow('合规率', pctValueIfPresent(b.fiscal.compliance), null, 'compliance'),
      bkRow('截留率', pctValueIfPresent(b.fiscal.skimmingRate), 'zhu', 'skim'),
      bkRow('财政自主', pctValueIfPresent(b.fiscal.autonomy)),
      bkRow('税负', firstValue(b.fiscal.taxBurden, data.taxBurden)),
      bkRow('税级', data.taxLevel),
      bkRow('库藏银', b.treasury.money),
      bkRow('库藏粮', b.treasury.grain),
      bkRow('库藏布', b.treasury.cloth),
      bkRow('本回合银产', b.fiscal.moneyOutput, 'jin'),
      bkRow('本回合粮产', b.fiscal.grainOutput, 'jin'),
      bkRow('豪强', _magnateLabel(b.liveStats), 'zhu', 'magnate')
    ]);
    var fortRow = (b.liveDivision && Number(b.liveDivision.fortLevel) > 0) || hasDisplayValue(b.army.fortification);  // P0-5(2026-06-20): 删 data.fortification(剧本死字段)触发,城防只认活档+armyDetail回落
    // 活军卡（军地绑定·2026-06-12）：GM.armies 驻此地者列于卷首——驻军数即其合计
    var liveArmyHtml = '';
    if (b.army.liveArmies && b.army.liveArmies.length) {
      liveArmyHtml = '<div class="bk-jun-list">' + b.army.liveArmies.slice(0, 8).map(function(a){
        var mor = Number(a.morale);
        return '<div class="bk-jun"><span class="j-ni"></span><b>' + esc(String(a.name || '无名之师')) + '</b>' +
          '<span class="j-n">' + esc(mapNum(Number(a.soldiers || a.size || a.strength) || 0)) + '</span>' +
          (hasDisplayValue(a.commander) ? '<span class="j-cmd">' + esc(shortText(a.commander, 10)) + '</span>' : '') +
          (isFinite(mor) ? '<span class="j-mor' + (mor < 45 ? ' low' : '') + '">气 ' + Math.round(mor) + '</span>' : '') +
          '</div>';
      }).join('') + (b.army.liveArmies.length > 8 ? '<div class="bk-jun-more">…另 ' + (b.army.liveArmies.length - 8) + ' 支</div>' : '') + '</div>';
    }
    var junbei = liveArmyHtml + bkLan([
      bkRow('驻军', firstValue(data.garrison, b.army.troops, r && r.troops), null, 'army'),
      liveArmyHtml ? bkRow('在驻之师', b.army.liveArmyCount + ' 支（驻军数即其合计）') : '',
      bkRow('可募兵源', firstValue(data.militaryRecruits, b.army.recruits), null, 'recruits'),
      bkRow('军压', firstValue(data.armyPressure, r && r.armyPressure), 'zhu'),
      bkRow('月军费', data.localMilitaryCost, null, 'army'),                                       // P1-A2b·本地养兵月耗(armyPressureEnabled 关→叶无值·自动不渲染)
      bkRow('净留用', data.retainedNet, (Number(data.retainedNet) < 0 ? 'zhu' : null), 'army'),    // P1-A2b·养兵后净留用·赤字(军费吃穿地方留用)标红
      fortRow ? bkRow('城防', [(b.liveDivision && Number(b.liveDivision.fortLevel) > 0) ? b.liveDivision.fortLevel + ' 档' : '', b.army.fortification].filter(hasDisplayValue).map(ppValue).join(' · '), 'jin', 'fort') : '',  // P0-5: fortLevel 活档优先·删 data.fortification 死重复
      bkRow('主将', firstValue(b.army.liveArmies && b.army.liveArmies[0] && b.army.liveArmies[0].commander, data.commander, b.army.commander)),
      bkRow('边警', firstValue(data.borderRisk, data.warRisk), 'zhu'),
      bkRow('补给', firstValue(data.supply, b.army.supply)),
      bkRow('水师 / 海防', firstValue(data.navy, data.coastalDefense)),
      bkRow('威胁', data.threats, 'zhu'),
      bkRow('战略价值', data.strategicValue)
    ], true);
    var zhiguan = bkLan([
      bkRow('主官', data.governorVacant ? '空缺·待补' : firstValue(data.governor, data.official), data.governorVacant ? 'zhu' : ''),
      bkRow('官职', data.officialPosition),
      bkRow('官缺', firstValue(data.officeVacancy, data.vacancy), null, 'vacancy'),
      bkRow('贪腐', corr, 'zhu', 'corr'),
      bkRow('政令执行', firstValue(data.policyExecution, data.execution), null, 'exec'),
      bkRow('地方派系', firstValue(data.localFaction, data.party)),
      bkRow('士绅', data.leadingGentry),
      bkRow('书院', data.academies),
      bkRow('科举解额', econ.kejuQuota),
      bkRow('官府资产', econ.imperialAssets),
      bkRow('备注', firstValue(data.note, r && r.note))
    ]);
    var fengwu = bkWuGrid([
      ['耕地', econ.farmland], ['商贸', econ.commerceVolume], ['商系数', econ.commerceCoefficient],
      ['盐课', econ.saltProduction], ['矿课', econ.mineralProduction], ['马政', econ.horseProduction],
      ['渔课', econ.fishingProduction], ['皇庄', econ.imperialFarmland], ['海贸', econ.maritimeTradeVolume],
      ['织造', assets.zhizao], ['矿场', assets.kuangchang], ['御窑', assets.yuyao],
      ['驿站', econ.postRelays], ['道路', econ.roadQuality]
    ]) + bkLan([
      bkRow('地势', firstValue(data.terrain, r && r.terrain)),
      bkRow('特殊资源', firstValue(data.specialResources, r && r.resources)),
      bkRow('特殊文化', data.specialCulture),
      bkRow('商路', data.tradeRoutes),
      bkRow('驿路', hasDisplayValue(econ.postRelays) ? ppValue(econ.postRelays) + ' 处' : '', null, 'post'),
      bkRow('近期灾异', firstValue(data.recentDisasters, econ.disasterRecord), 'zhu'),
      bkRow('标签', tagList.length ? tagList.join('、') : ''),
      bkRow('法理归属', firstValue(data.dejureOwner, ownerName(r))),
      bkRow('核心 / 边缘', firstValue(data.coreStatus, data.borderStatus)),
      bkRow('归属历史', data.ownerHistory),
      bkRow('下辖子区', children.length ? children.map(function(x){ return ppValue(x.name || x.title || x); }).join('、') : '')
    ], true);
    var yingzao = bkYingzao(r, b);
    // 状态卷（2026-06-12）：奇观/灾异/圣裁/风云/营造之利——落在此地的持续境况（活账·乘进岁入）
    var zhuangkuang = '';
    var statusFx = (b.liveDivision && Array.isArray(b.liveDivision.statusEffects)) ? b.liveDivision.statusEffects.filter(Boolean) : [];
    if (statusFx.length) {
      var ZT_SEAL = { wonder: '观', disaster: '灾', player: '裁', event: '云', building: '营' };
      var _gmTurn = Number(window.GM && GM.turn) || 0;
      zhuangkuang = '<div class="bk-zt-list">' + statusFx.slice(0, 12).map(function(e){
        var chips = [];
        var ep = Number(e.econPct);
        if (isFinite(ep) && ep) chips.push('<em class="' + (ep > 0 ? 'pos' : 'neg') + '">岁入 ' + (ep > 0 ? '+' : '') + Math.round(ep * 100) + '%</em>');
        var mp = Number(e.minxinPerTurn);
        if (isFinite(mp) && mp) chips.push('<em class="' + (mp > 0 ? 'pos' : 'neg') + '">民心 ' + (mp > 0 ? '+' : '') + mp + '/回合</em>');
        var left = e.expiresTurn != null ? Math.max(0, Number(e.expiresTurn) - _gmTurn) : null;
        return '<div class="bk-zt ' + esc(String(e.kind || 'event')) + '">' +
          '<span class="zt-seal">' + esc(ZT_SEAL[e.kind] || '云') + '</span>' +
          '<div class="zt-body"><b>' + esc(String(e.name || '')) + '</b>' +
          (e.desc ? '<p>' + esc(String(e.desc)) + '</p>' : '') +
          (chips.length ? '<div class="zt-fx">' + chips.join('') + '</div>' : '') + '</div>' +
          '<span class="zt-term">' + (left === null ? '永 续' : '余 ' + left + ' 回合') + '</span>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="bk-zt-note">状态之效乘入本地岁入、逐回合作用民心——非摆设。</div>';
    }
    var foot = '<div class="bk-foot">' +
      (hasDisplayValue(ownerName(r)) ? '<button type="button" class="bk-act" data-bk-open-faction="' + attr(oKey) + '">展 势 力 谱</button>' : '') +
      ((b.liveDivision && typeof window.openDivisionDetail === 'function') ? '<button type="button" class="bk-act" data-bk-ledger="' + attr(firstValue(b.liveDivision.id, b.liveDivision.name, '')) + '">地 方 账 本</button>' : '') +
      '</div>';
    // 卷与检签同源：空卷不渲染、签也不挂（不留点了不动的死签）
    // 役政志（人力/徭役/农政层·R7-c）——仅已行役政（已种子）地域渲染·未种子不挂此卷
    var yizheng = '';
    (function(){
      var ld = (typeof findLiveAdminDivision === 'function') ? findLiveAdminDivision(r) : (b.liveDivision || null);
      if (!ld || !ld.renliSeed) return;
      var GMr = (window.GM && GM.renli && GM.renli.byRegion) ? GM.renli.byRegion : null;
      var rid = String(r.id || r.name || '');
      var rg = GMr ? (GMr[rid] || (r.name ? GMr[r.name] : null)) : null;
      var pd = ld.populationDetail || null;
      var alloc = pd && pd.alloc ? pd.alloc : null;
      var pol = rg && rg.levyPolicy ? rg.levyPolicy : null;
      yizheng = bkLan([
        bkRow('役负率', rg && hasDisplayValue(rg.corveeRate) ? Math.round(Number(rg.corveeRate) * 100) + '%' : '', (rg && Number(rg.corveeRate) > 0.35) ? 'zhu' : ''),
        bkRow('地力', rg ? rg.soil : ''),
        bkRow('水利', rg ? rg.waterworks : ''),
        bkRow('在耕田亩', rg ? rg.cultivatedLand : ''),
        bkRow('抛荒田亩', rg ? rg.fallowLand : '', 'zhu'),
        bkRow('本回合粮产', rg ? rg.grainOutput : '', 'jin'),
        bkRow('缺粮', rg ? rg.foodDeficit : '', 'zhu'),
        // 刀C·官报对照：督抚奏报口径（reported·可粉饰）vs 上列真值——瞒报显著则标红示警
        (function(){
          var rep = (window.GM && GM.renli && GM.renli.reported) ? (GM.renli.reported[rid] || (r.name ? GM.renli.reported[r.name] : null)) : null;
          if (!rep) return '';
          var cz = Number(rep.conceal) || 0;
          return bkRow('督抚奏报', '役负' + Math.round((Number(rep.corveeRate)||0)*100) + '% · 抛荒' + Math.round((Number(rep.fallowShare)||0)*100) + '%' + (cz > 0.12 ? ('　〔瞒报~' + Math.round(cz*100) + '%·实情见上〕') : '　〔与实情相符〕'), cz > 0.12 ? 'zhu' : '');
        })(),
        alloc ? bkRow('丁分配', '务农 ' + ppValue(alloc.farm) + ' · 应役 ' + ppValue(alloc.corvee) + ' · 应征 ' + ppValue(alloc.draft) + ' · 优免 ' + ppValue(alloc.exempt)) : '',
        pd ? bkRow('册载丁', pd.registeredDing) : '',
        pd ? bkRow('优免丁', pd.exemptDing, 'zhu') : '',
        pd ? bkRow('诡寄丁', pd.commendedDing, 'zhu') : '',
        bkRow('逃户', b.pop.fugitives, 'zhu', 'fugitive'),
        bkRow('隐户', b.pop.hiddenCount, 'zhu', 'hidden'),
        pol ? bkRow('现行则例', String(pol.strength || 'normal') + (Number(pol.remitTurns) > 0 ? ' · 蠲免余 ' + pol.remitTurns + ' 回合' : '')) : ''
      ], true);
    })();
    var juans = [
      ['bk-hukou', '一', '户口志', '黄册口算', '户', hukou],
      ['bk-yizheng', '二', '役政志', '徭役农政 · 丁田', '役', yizheng],
      ['bk-caifu', '三', '财赋志', '岁入库藏', '赋', caifu],
      ['bk-junbei', '四', '军备志', '戎政边防', '军', junbei],
      ['bk-zhiguan', '五', '职官志', '官守治理', '官', zhiguan],
      ['bk-fengwu', '六', '风物志', '物产设施', '物', fengwu],
      ['bk-yingzao', '七', '营造志', '已建之业 · 工役', '营', yingzao],
      ['bk-zhuangkuang', '八', '状态', '奇观灾异风云圣裁', '况', zhuangkuang]
    ];
    var live = juans.filter(function(j){ return !!j[5]; });
    return bkSpine(regionTitle(r) + ' · 方志') +
      '<div class="bk-inner">' + head + stats +
      '<div class="bk-scroll">' +
        live.map(function(j){ return bkJuan(j[0], j[1], j[2], j[3], j[5]); }).join('') +
      '</div>' + foot + '</div>' +
      bkJianqian(live.map(function(j){ return [j[0], j[4]]; })) +
      '<div class="bk-straddle"><i>验讫</i></div>';
  }
  function openRegionDossier(r){
    if (!r) return;
    var id = String(r.id || r.name || r.title || '');
    state.mapPanelTab = MAP_MODE_META[state.mapPanelTab] ? state.mapPanelTab : 'overview';
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'region';
    pop.dataset.regionId = id;
    pop.removeAttribute('data-faction-key');
    pop.className = 'tmf-map-ppop tmf-book region-panel show';
    pop.innerHTML = renderRegionBook(r);
    document.body.classList.add('province-panel-open');
    markSelectedRegion(id);
    bindBkSpy(pop);
    bkScrollToTab(pop, state.mapPanelTab);
  }

  function sumFactionValues(regions, pick){
    return regions.reduce(function(sum, r){
      var value = Number(pick(regionBundle(r), r));
      return sum + (isFinite(value) ? value : 0);
    }, 0);
  }

  function factionRegionTokens(r){
    var b = regionBundle(r);
    return factionTokens(null, ownerKey(r), firstValue(b.data.factionName, b.data.ownerName, b.data.dejureOwner, r && r.factionName, r && r.ownerName));
  }

  function factionOwnsRegion(r, key, f){
    var ft = factionTokens(f, key, f && (f.label || f.name || f.scenarioFactionName));
    var rt = factionRegionTokens(r);
    return rt.some(function(x){ return ft.indexOf(x) >= 0; });
  }

  function factionControlledRegions(key, f){
    var map = getMapData() || {};
    return (map.regions || []).filter(function(r){ return factionOwnsRegion(r, key, f); });
  }

  function avgFactionValue(regions, pick){
    var vals = regions.map(function(r){ return Number(pick(regionBundle(r), r)); }).filter(function(n){ return isFinite(n); });
    if (!vals.length) return '';
    return Math.round(vals.reduce(function(a, b){ return a + b; }, 0) / vals.length);
  }

  function factionIndexEntry(f, key){
    var api = window.TM && TM.FactionIndex;
    if (!api || typeof api.getOrRebuild !== 'function') return null;
    var names = [];
    function add(v){
      if (v === undefined || v === null || v === '') return;
      var s = String(v);
      if (names.indexOf(s) < 0) names.push(s);
    }
    add(f && f.name);
    add(f && f.label);
    add(f && f.scenarioFactionName);
    add(f && f.runtimeFactionId);
    add(f && f.stableOwnerKey);
    add(f && f.mapFactionId);
    add(key);
    for (var i = 0; i < names.length; i += 1) {
      try {
        var entry = api.getOrRebuild(names[i]);
        if (entry) return entry;
      } catch (_) {}
    }
    return null;
  }

  function runtimeFactionValue(f, key){
    var live = f && f._runtimeFaction;
    return live && hasValue(live[key]) ? live[key] : undefined;
  }

  function factionProfile(f, key, region){
    f = f || {};
    key = key || f.stableOwnerKey || f.mapFactionId || f.id || '';
    var regions = factionControlledRegions(key, f);
    var sample = region || regions[0] || null;
    var pop = sumFactionValues(regions, function(b, r){ return firstValue(b.data.population, b.pop.mouths, r && r.population, 0); });
    var revenue = sumFactionValues(regions, function(b){ return firstValue(b.fiscal.actualRevenue, 0); });
    var grain = sumFactionValues(regions, function(b){ return firstValue(b.treasury.grain, 0); });
    var indexEntry = factionIndexEntry(f, key);
    var indexMetrics = (indexEntry && indexEntry.metrics) || {};
    var indexedTroops = Number(indexMetrics.totalSoldiers);
    var regionTroops = sumFactionValues(regions, function(b, r){ return firstValue(b.data.garrison, b.army.troops, r && r.troops, 0); });
    var troops = firstValue(indexMetrics.armyCount > 0 && isFinite(indexedTroops) ? indexedTroops : '', regionTroops || '', f.militaryStrength, f.strength);
    var avgMood = avgFactionValue(regions, function(b, r){ return firstValue(b.data.minxinLocal, r && r.mood); });
    var avgCorr = avgFactionValue(regions, function(b){ return firstValue(b.data.corruptionLocal, b.data.corruption); });
    var threats = [];
    var resources = [];
    regions.forEach(function(r){
      var b = regionBundle(r);
      [b.data.threats, b.data.tradeRoutes].forEach(function(v){
        if (Array.isArray(v)) v.forEach(function(x){ if (x && threats.indexOf(x) < 0) threats.push(x); });
        else if (v && threats.indexOf(v) < 0) threats.push(v);
      });
      [b.data.specialResources, r && r.resources].forEach(function(v){
        if (Array.isArray(v)) v.forEach(function(x){ if (x && resources.indexOf(x) < 0) resources.push(x); });
        else if (v && resources.indexOf(v) < 0) resources.push(v);
      });
    });
    return { f: f, key: key, regions: regions, sample: sample, pop: pop, revenue: revenue, grain: grain, troops: troops, avgMood: avgMood, avgCorr: avgCorr, threats: threats, resources: resources, indexEntry: indexEntry, indexMetrics: indexMetrics };
  }

  function factionFinanceValue(f, p){
    return firstValue(runtimeFactionValue(f, 'economy'), runtimeFactionValue(f, 'wealth'), p.regions.length ? p.revenue : '', f.economy, f.wealth);
  }

  function factionTreasuryValue(f, p){
    return firstValue(runtimeFactionValue(f, 'treasury'), p.regions.length ? p.revenue : '', f.treasury);
  }

  // ── 势力谱牒 ──
  var BK_LEADERSHIP_LABEL = { ruler: '君主', regent: '摄政', general: '主将', chancellor: '宰辅', spy: '耳目', heir: '继嗣' };
  // 剧本数据里常见的英文枚举值 → 中文（只译整 token·按「·」分段各自比对·不破坏混排中文）
  var BK_ENUM_CN = {
    heavy_from_land: '重赋于田', light_touch: '轻徭薄赋', restricted: '有禁', open: '开放',
    silver_standard: '银本位', coin_standard: '钱法', barter: '以物易物',
    primogeniture: '嫡长承袭', election: '推举', tanistry: '幼子守灶', merit: '择贤',
    declining: '渐衰', rising: '方兴', stable: '安稳', tribute_conquest: '贡赋掳掠',
    corvee: '力役', imperial: '宗室', noble: '勋贵', gentry: '士绅', commoner: '庶民'
  };
  function bkEnumText(v){
    var s = ppValue(v, '');
    if (!s || !/[a-z_]/i.test(s)) return s;
    return s.split('·').map(function(seg){
      var t = seg.trim();
      return BK_ENUM_CN[t] || seg;
    }).join('·');
  }
  // {键: 数值} → 评分徽签条（负值/低值朱显）
  function bkScoreChips(title, obj, warnBelow){
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
    var keys = Object.keys(obj).filter(function(k){ return isFinite(Number(obj[k])); });
    if (!keys.length) return '';
    var lim = (warnBelow === undefined) ? 0 : warnBelow;
    return '<div class="bk-lr"><span class="bk-k">' + esc(title) + '</span><span class="bk-v wrap"><span class="bk-score-chips">' +
      keys.map(function(k){
        var n = Number(obj[k]);
        return '<em class="' + (n < lim ? 'neg' : '') + '">' + esc(fieldLabel(k)) + ' <b>' + esc(mapNum(n)) + '</b></em>';
      }).join('') + '</span></span></div>';
  }
  // 势力级 relations {名: 亲疏分} → 邦交印泥条（≥50 盟 · <0 敌 · 余 中）
  function bkRelationRows(relations){
    if (!relations || typeof relations !== 'object' || Array.isArray(relations)) return [];
    return Object.keys(relations).filter(function(k){ return isFinite(Number(relations[k])); }).map(function(k){
      var n = Number(relations[k]);
      return bkBangRow(k, n >= 50 ? 'meng' : (n < 0 ? 'di' : 'zhong'), '亲疏 ' + n);
    });
  }
  // historicalEvents [{event, impact}] → 年表行
  function bkEventLines(arr){
    if (!Array.isArray(arr) || !arr.length) return '';
    return arr.map(function(e){
      if (!e || typeof e !== 'object') return ppValue(e, '');
      var ev = firstValue(e.event, e.name, '');
      var im = firstValue(e.impact, e.note, '');
      return ev ? (ev + (im ? '——' + im : '')) : '';
    }).filter(Boolean).join('\n');
  }
  // offendThresholds [{score, description, consequences[]}] → 阈值行
  function bkThresholdLines(arr){
    if (!Array.isArray(arr)) return ppValue(arr, '');
    return arr.map(function(t){
      if (!t || typeof t !== 'object') return ppValue(t, '');
      var head = (isFinite(Number(t.score)) ? '至 ' + t.score + '：' : '') + firstValue(t.description, t.desc, '');
      var cons = Array.isArray(t.consequences) ? t.consequences.join('·') : ppValue(t.consequences, '');
      return head + (cons && cons !== '未记' ? '（' + cons + '）' : '');
    }).filter(Boolean).join('\n');
  }
  function bkRenCard(title, person, main, emptyName){
    if (!hasDisplayValue(person)) return '';
    var isObj = person && typeof person === 'object';
    var name = isObj ? firstValue(person.name, person.ruler, person.general, person.chancellor) : person;
    if (isObj && !hasDisplayValue(name)) {
      // 空名对象（如储位未定的 heirInfo）——有小传则以虚位示之·否则整卡不出
      if (!hasDisplayValue(person.bio)) return '';
      name = emptyName || '（虚位）';
    }
    var meta = isObj ? [person.title, person.role, person.age ? ppValue(person.age) + ' 岁' : '', person.personality].filter(hasDisplayValue).map(ppValue).join(' / ') : '';
    if (isObj && hasDisplayValue(person.bio)) meta = meta ? meta + ' · ' + ppValue(person.bio) : ppValue(person.bio);
    var label = title ? title + ' · ' : '';
    return '<div class="bk-ren' + (main ? ' main' : '') + '"><div class="r-seal">' + esc(String(ppValue(name)).replace(/[\s（）()]/g, '').slice(0, 1)) + '</div><div class="r-body"><b>' + esc(label + ppValue(name)) + '</b><span>' + esc(shortText(meta, 46)) + '</span></div></div>';
  }
  function bkBangRow(name, rel, note){
    if (!hasDisplayValue(name)) return '';
    var relCls = rel === 'di' ? 'di' : (rel === 'meng' ? 'meng' : 'zhong');
    var relTxt = rel === 'di' ? '敌 对' : (rel === 'meng' ? '盟 好' : '中 立');
    return '<div class="bk-bang"><span class="b-ni ' + relCls + '"></span><b>' + esc(ppValue(name)) + '</b><span class="b-rel ' + relCls + '">' + relTxt + '</span><span class="b-note">' + esc(ppValue(note || '')) + '</span></div>';
  }
  function bkBangList(f){
    var rows = [];
    function many(v, rel){
      if (!hasDisplayValue(v)) return;
      if (Array.isArray(v)) v.forEach(function(x){ rows.push(bkBangRow(typeof x === 'object' ? firstValue(x.name, ppValue(x)) : x, rel, typeof x === 'object' ? firstValue(x.note, x.attitude, '') : '')); });
      else rows.push(bkBangRow(ppValue(v), rel, ''));
    }
    many(f.allies, 'meng');
    many(f.enemies, 'di');
    many(f.neutrals, 'zhong');
    // 势力级 relations {名: 亲疏分} → 同列印泥条·不再流水 dump
    var relRows = bkRelationRows(f.relations);
    relRows.forEach(function(x){ rows.push(x); });
    var html = rows.filter(Boolean).join('');
    var attitudeObj = f.attitude && typeof f.attitude === 'object' ? f.attitude : null;
    var spies = f.knownSpies && typeof f.knownSpies === 'object' && !Array.isArray(f.knownSpies) ? f.knownSpies : null;
    var thLines = Array.isArray(f.offendThresholds) ? bkThresholdLines(f.offendThresholds) : '';
    var extra = bkLan([
      relRows.length ? '' : bkRow('关系', f.relations),
      attitudeObj ? bkRow('自居', attitudeObj.self) : bkRow('态度', firstValue(f.attitudeDetail, f.attitude)),
      attitudeObj ? bkRow('所敌', attitudeObj.enemies, 'zhu') : '',
      attitudeObj ? bkRow('所盟', attitudeObj.allies) : '',
      attitudeObj ? bkRow('所持中立', attitudeObj.neutrals) : '',
      bkRow('与本朝', f.playerRelation),
      thLines ? '' : bkRow('冒犯阈值', f.offendThresholds),
      bkRow('内部派系', f.internalParties),
      bkRow('党派关系', f.partyRelations),
      spies ? bkRow('已知耳目', Object.keys(spies).filter(function(k){ return isFinite(Number(spies[k])); }).map(function(k){ return fieldLabel(k) + ' ' + spies[k]; }).join(' · ')) : bkRow('已知耳目', f.knownSpies)
    ], true);
    var thHtml = thLines ? '<div class="bk-lan one"><div class="bk-lr"><span class="bk-k">冒犯阈值</span><span class="bk-v wrap zhu">' + esc(thLines).replace(/\n/g, '<br>') + '</span></div></div>' : '';
    return (html ? '<div class="bk-bang-list">' + html + '</div>' : '') + extra + thHtml;
  }
  function renderFactionBook(f, key, r){
    var p = factionProfile(f, key, r);
    var name = firstValue(f.label, f.name, f.scenarioFactionName, r && ownerName(r), key, '未名势力');
    var attitudeObj = f.attitude && typeof f.attitude === 'object' ? f.attitude : null;
    var attitudeText = firstValue(attitudeObj ? attitudeObj.self : f.attitude, f.playerRelation);
    var head = bkHead({
      seal: shortText(f.short || name, 2) + '印', round: true, kind: '谱 牒',
      name: name, sub: firstValue(f.type, f.factionType, '势力'), desc: firstValue(f.description, f.desc, f.note),
      pills: [
        hasDisplayValue(firstValue(f.leader, f.leaderName, f.ruler)) ? '<span class="bk-pill">' + esc(firstValue(f.leaderTitle, '首领')) + ' <b>' + esc(firstValue(f.leader, f.leaderName, f.ruler)) + '</b></span>' : '',
        hasDisplayValue(firstValue(f.capital, f.home)) ? '<span class="bk-pill">都 <b>' + esc(firstValue(f.capital, f.home)) + '</b></span>' : '',
        hasDisplayValue(attitudeText) ? '<span class="bk-pill' + (/敌/.test(String(attitudeText)) ? ' hostile' : '') + '">' + esc(shortText(attitudeText, 10)) + '</span>' : '',
        hasDisplayValue(firstValue(f.government, f.ideology)) ? '<span class="bk-pill">' + esc(shortText(firstValue(f.government, f.ideology), 10)) + '</span>' : ''
      ]
    });
    var stats = bkStats([
      bkStat('领地', p.regions.length ? p.regions.length + ' 块' : '', p.regions.slice(0, 2).map(regionTitle).join('、')),
      bkStat('总兵', firstValue(p.troops, runtimeFactionValue(f, 'militaryStrength'), f.militaryStrength), '势力/地块聚合'),
      bkStat('户口', firstValue(p.regions.length ? p.pop : '', runtimeFactionValue(f, 'population'), f.population), '所辖合计'),
      bkStat('实收', p.regions.length ? p.revenue : factionFinanceValue(f, p), '财赋'),
      bkStat('民心', p.avgMood, '所辖均值', isFinite(Number(p.avgMood)) && Number(p.avgMood) < 50)
    ]);
    var junchen = '';
    var renCards = [];
    renCards.push(bkRenCard(firstValue(f.leaderTitle, '首领'), firstValue(f.leaderInfo, f.leader, f.leaderName, f.ruler), true));
    renCards.push(bkRenCard('继嗣', firstValue(f.heirInfo, f.heir), false, '储位未定'));
    if (f.leadership && typeof f.leadership === 'object') {
      Object.keys(f.leadership).slice(0, 6).forEach(function(k){
        if (k === 'ruler' && renCards[0]) return;
        renCards.push(bkRenCard(BK_LEADERSHIP_LABEL[k] || k, f.leadership[k]));
      });
    }
    var renHtml = renCards.filter(Boolean).join('');
    // 运行时 members = FactionIndex 派生 {chars, armies, provinces, parties, summary}——只取人物名册
    var memberChars = f.members && typeof f.members === 'object' && Array.isArray(f.members.chars) ? f.members.chars : (Array.isArray(f.members) ? f.members : null);
    var memberNames = memberChars ? memberChars.map(function(c){ return typeof c === 'object' ? firstValue(c && c.name, '') : c; }).filter(hasDisplayValue) : [];
    var memberText = memberNames.length ? '共 ' + memberNames.length + ' 人：' + shortText(memberNames.join('、'), 56) : (memberChars ? '' : (hasDisplayValue(f.members) ? shortText(ppValue(f.members), 60) : ''));
    junchen = (renHtml ? '<div class="bk-ren-row">' + renHtml + '</div>' : '') + bkLan([
      bkRow('在册人物', memberText),
      bkRow('政体', firstValue(f.government, f.type)),
      bkRow('战略目标', firstValue(f.goal, f.strategy)),
      bkRow('意识形态', firstValue(f.ideology, f.mainstream)),
      bkRow('文化', f.culture),
      bkScoreChips('凝聚', f.cohesion, 50) || bkRow('凝聚', f.cohesion),
      bkRow('开局问题', f.openingProblems)
    ], true);
    var bantu = (p.regions.length ? '<div class="bk-qian-links">' + p.regions.map(function(rg){
      return '<button type="button" class="bk-qian" data-bk-open-region="' + attr(rg.id || rg.name || rg.title || '') + '">' + esc(regionTitle(rg)) + '</button>';
    }).join('') + '</div>' : '') + bkLan([
      bkRow('剧本领土', f.territory),
      bkRow('资源', firstValue(f.resources, f.mainResources, p.resources.length ? p.resources.join('、') : '')),
      bkRow('威胁 / 商路', p.threats.length ? p.threats.join('、') : '')
    ], true);
    var mb = f.militaryBreakdown && typeof f.militaryBreakdown === 'object' ? f.militaryBreakdown : null;
    var ws = f.warState && typeof f.warState === 'object' && !Array.isArray(f.warState) ? f.warState : null;
    var MB_LABEL = { elite: '精锐', standingArmy: '常备', militia: '民兵', fleet: '水师' };
    var MB_COLOR = { elite: '#8e6aa8', standingArmy: '#a8833a', militia: '#7d6a48', fleet: '#4a5e8a' };
    var junlue = (mb ? bkBar('兵力构成', Object.keys(mb).filter(function(k){ return Number(mb[k]) > 0; }).map(function(k){
      return [MB_LABEL[k] || k, Number(mb[k]) || 0, MB_COLOR[k] || '#9d5b4b'];
    }), '总 ' + fmtNum(Object.keys(mb).reduce(function(a, k){ return a + (Number(mb[k]) || 0); }, 0))) : '') + bkLan([
      bkRow('总兵力', firstValue(p.troops, runtimeFactionValue(f, 'militaryStrength'), f.militaryStrength)),
      mb ? '' : bkRow('军力构成', f.militaryBreakdown),
      ws ? bkRow('现战', ws.active, 'zhu') : bkRow('战争状态', f.warState, 'zhu'),
      ws ? bkRow('将起', ws.pending) : '',
      ws ? bkRow('近役', ws.recent) : '',
      bkRow('动员', firstValue(f.mobilization, f.manpower)),
      bkRow('战略优先', f.strategicPriorities),
      bkRow('决策提示', firstValue(f.decisionHints, f.npcDecisionHints)),
      bkRow('禁忌动作', f.tabooMoves, 'zhu')
    ], true);
    var tre = f.treasury && typeof f.treasury === 'object' ? f.treasury : null;
    var ecoPol = f.economicPolicy && typeof f.economicPolicy === 'object' ? f.economicPolicy : null;
    var succ = f.succession && typeof f.succession === 'object' ? f.succession : null;
    var fpop = f.population && typeof f.population === 'object' ? f.population : null;
    var caiji = bkLan([
      bkRow('经济', factionFinanceValue(f, p)),
      bkRow('库藏银', tre ? tre.money : factionTreasuryValue(f, p)),
      bkRow('库藏粮', firstValue(tre && tre.grain, p.regions.length ? p.grain : '')),
      bkRow('库藏布', tre && tre.cloth),
      bkRow('战马', tre && tre.horses, 'jin'),
      bkRow('库藏注', tre && tre.note),
      fpop ? bkRow('编户 / 实口', [mapNum(fpop.registered), mapNum(fpop.actual)].filter(function(s){ return s && s !== '未记'; }).join(' / ')) : '',
      fpop && fpop.ethnicities ? bkScoreChips('族裔', fpop.ethnicities, -1) : '',
      bkScoreChips('经济结构', f.economicStructure, -1) || bkRow('经济结构', f.economicStructure),
      ecoPol ? bkRow('赋税之政', bkEnumText(ecoPol.taxation)) : bkRow('经济政策', f.economicPolicy),
      ecoPol ? bkRow('商贸之政', bkEnumText(ecoPol.trade)) : '',
      ecoPol ? bkRow('币制', bkEnumText(ecoPol.currency)) : '',
      ecoPol ? bkRow('役法', bkEnumText(ecoPol.labor)) : '',
      bkScoreChips('公共舆情', f.publicOpinion, 0) || bkRow('公共舆情', f.publicOpinion),
      bkScoreChips('技术', f.techLevel, 40) || bkRow('科技', f.techLevel),
      bkRow('文教', f.cultureLevel),
      succ ? bkRow('继承', [bkEnumText(succ.rule), hasDisplayValue(succ.designatedHeir) ? '储 ' + ppValue(succ.designatedHeir) : '储位未定', isFinite(Number(succ.stability)) ? '稳定 ' + succ.stability : ''].filter(Boolean).join(' · ')) : bkRow('继承', f.succession)
    ]);
    var youlie = '';
    var you = Array.isArray(f.strengths) ? f.strengths : (hasDisplayValue(f.strengths) ? [ppValue(f.strengths)] : []);
    var lie = Array.isArray(f.weaknesses) ? f.weaknesses : (hasDisplayValue(f.weaknesses) ? [ppValue(f.weaknesses)] : []);
    if (you.length || lie.length) {
      youlie = '<div class="bk-youlie">' +
        (you.length ? '<div class="yl you"><b>所 长</b>' + you.slice(0, 6).map(function(s){ return '<span>' + esc(ppValue(s)) + '</span>'; }).join('') + '</div>' : '') +
        (lie.length ? '<div class="yl lie"><b>所 短</b>' + lie.slice(0, 6).map(function(s){ return '<span>' + esc(ppValue(s)) + '</span>'; }).join('') + '</div>' : '') +
        '</div>';
    }
    var shilueText = [
      hasDisplayValue(f.strategy) ? '【大略】' + ppValue(f.strategy) : '',
      hasDisplayValue(f.longTermStrategy) ? '【长策】' + ppValue(f.longTermStrategy) : '',
      hasDisplayValue(f.history) ? '【国史】' + ppValue(f.history) : '',
      hasDisplayValue(f.historicalEvents) ? '【年表】\n' + (bkEventLines(f.historicalEvents) || ppValue(f.historicalEvents)) : '',
      hasDisplayValue(f.aiProfile) ? '【画像】' + ppValue(f.aiProfile) : '',
      hasDisplayValue(f.victoryConditions) ? '【胜局】' + ppValue(f.victoryConditions) : '',
      hasDisplayValue(f.defeatConditions) ? '【败局】' + ppValue(f.defeatConditions) : ''
    ].filter(function(s){ return s && s.length > 5; }).join('\n\n');
    var shilue = youlie + bkFold(shilueText);
    var foot = '<div class="bk-foot">' +
      (p.regions.length ? '<button type="button" class="bk-act" data-bk-open-region="' + attr(p.regions[0].id || p.regions[0].name || '') + '">翻 其 首 地</button>' : '') +
      '<button type="button" class="bk-act" data-pp-close="1">合 上 谱 牒</button>' +
      '</div>';
    var juans = [
      ['bk-junchen', '一', '君臣', '首脑重臣', '君', junchen],
      ['bk-bantu', '二', '版图', '所辖之地', '图', bantu],
      ['bk-junlue', '三', '军略', '兵制方略', '军', junlue],
      ['bk-caiji', '四', '财计', '库藏经济', '财', caiji],
      ['bk-bangjiao', '五', '邦交', '与国之谊', '交', bkBangList(f)],
      ['bk-shilue', '六', '史略', '优劣大略', '史', shilue]
    ];
    var live = juans.filter(function(j){ return !!j[5]; });
    return bkSpine(name + ' · 谱牒') +
      '<div class="bk-inner">' + head + stats +
      '<div class="bk-scroll">' +
        live.map(function(j){ return bkJuan(j[0], j[1], j[2], j[3], j[5]); }).join('') +
      '</div>' + foot + '</div>' +
      bkJianqian(live.map(function(j){ return [j[0], j[4]]; })) +
      '<div class="bk-straddle"><i>验讫</i></div>';
  }
  function openFactionDossier(key, region){
    var map = getMapData() || {};
    var f = findFaction(key, region && (region.factionName || region.ownerName)) || {};
    var r = region || factionControlledRegions(key, f)[0] || ((map.regions || []).find(function(x){ return ownerKey(x) === key; }) || null);
    key = key || (r && ownerKey(r)) || '';
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'faction';
    pop.dataset.factionKey = key;
    pop.removeAttribute('data-region-id');
    pop.className = 'tmf-map-ppop tmf-book faction-panel show';
    pop.innerHTML = renderFactionBook(f, key, r);
    document.body.classList.add('province-panel-open');
    bindBkSpy(pop);
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
      return '<button type="button" class="map-alert ' + (i === 0 ? 'hot' : '') + '" onclick="TMPhase8FormalBridge.openModule(\'memorial\')" title="' + attr(x.title || '') + '">' + esc(shortText(x.title || '待批奏疏', 10)) + '</button>';
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
  // perf round7: 强制下次 renderFormalMap 重建 SVG(清 dirty 签名)·供几何变更等绕过守卫
  bridge.map.invalidateFormalMap = function(){ try { state._lastFormalMapSig = null; } catch(_){} };
  bridge.map.__formalMapSignature = formalMapSignature;

  // ── re-attach bridge exposes that previously came from bridge.js ──
  bridge._ownerKey = ownerKey;
  bridge._ownerName = ownerName;
  bridge._findFaction = findFaction;
  bridge._getMapData = getMapData;
  bridge._dossierRows = dossierRows;
  bridge._fmtNum = fmtNum;

})();
