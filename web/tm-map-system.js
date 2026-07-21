// @ts-check
/// <reference path="types.d.ts" />
// 地图系统 - 多边形地图
// ============================================================
// R157 章节导航 (1947 行)：
//   §1 [L9]    initMapSystem 入口 + 势力配色 (HSL→RGB·明暗变体)
//   §2 [L130]  地形类型注册 (terrainTypes·收入/防御加成)
//   §3 [L300]  地形效果应用 + 颜色刷新
//   §4 [L500]  绘制 (drawMap·polygon·标注)
//   §5 [L1000] 编辑器入口 (openMapViewer·showMapInGame)
//   §6 [L1500] 工具：投影/坐标/邻接
// ============================================================

/**
 * 初始化地图数据结构
 */
function initMapSystem() {
  if (!GM.mapData) {
    GM.mapData = {
      cities: {},
      polygons: {},
      edges: {},
      terrains: {},  // 地形数据
      armies: [],    // 地图上的军队
      battles: [],   // 正在进行的战斗
      config: {
        width: 1200,
        height: 800,
        backgroundColor: '#f5f5dc',
        borderColor: '#000000',
        borderWidth: 2,
        highlightColor: 'rgba(255, 255, 255, 0.3)',
        selectedColor: 'rgba(255, 255, 0, 0.3)'
      },
      state: {
        hoveredCityId: null,
        selectedCityId: null,
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
        showTerrain: true  // 是否显示地形
      },
      factionColors: {}  // 势力颜色映射
    };
  }
  ensureMapDataScaffold(GM.mapData);

  // 初始化势力颜色
  assignFactionColors();

  // 初始化地形类型定义
  initTerrainTypes();
}

function ensureMapDataScaffold(mapData) {
  if (!mapData || typeof mapData !== 'object') return mapData;
  if (!mapData.cities) mapData.cities = {};
  if (!mapData.polygons) mapData.polygons = {};
  if (!mapData.edges) mapData.edges = {};
  if (!mapData.terrains) mapData.terrains = {};
  if (!Array.isArray(mapData.armies)) mapData.armies = [];
  if (!Array.isArray(mapData.battles)) mapData.battles = [];
  if (!Array.isArray(mapData.regions)) mapData.regions = [];
  if (!Array.isArray(mapData.items)) mapData.items = [];
  if (!Array.isArray(mapData.roads)) mapData.roads = [];
  if (!mapData.config) {
    mapData.config = {
      width: mapData.width || 1200,
      height: mapData.height || 800,
      backgroundColor: '#f5f5dc',
      borderColor: '#000000',
      borderWidth: 2,
      highlightColor: 'rgba(255, 255, 255, 0.3)',
      selectedColor: 'rgba(255, 255, 0, 0.3)'
    };
  } else {
    if (!mapData.config.width) mapData.config.width = mapData.width || 1200;
    if (!mapData.config.height) mapData.config.height = mapData.height || 800;
    if (!mapData.config.backgroundColor) mapData.config.backgroundColor = '#f5f5dc';
    if (!mapData.config.borderColor) mapData.config.borderColor = '#000000';
    if (!mapData.config.borderWidth) mapData.config.borderWidth = 2;
    if (!mapData.config.highlightColor) mapData.config.highlightColor = 'rgba(255, 255, 255, 0.3)';
    if (!mapData.config.selectedColor) mapData.config.selectedColor = 'rgba(255, 255, 0, 0.3)';
  }
  if (!mapData.state) {
    mapData.state = {
      hoveredCityId: null,
      selectedCityId: null,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      showTerrain: true
    };
  }
  if (!mapData.factionColors) mapData.factionColors = {};
  if (mapData.enabled === undefined) mapData.enabled = true;
  return mapData;
}

function getLiveMapData() {
  if (typeof GM !== 'undefined' && GM && GM.mapData && GM.mapData.regions) return GM.mapData;
  if (typeof P !== 'undefined' && P && P.map && P.map.regions) return P.map;
  if (typeof P !== 'undefined' && P && P.mapData && P.mapData.regions) return P.mapData;
  return null;
}

function cloneMapValue(value) {
  if (!value) return value;
  if (typeof deepClone === 'function') return deepClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asPointArray(value) {
  if (!Array.isArray(value)) return [];
  if (value.length > 0 && typeof value[0] === 'number') {
    var pairs = [];
    for (var i = 0; i < value.length - 1; i += 2) {
      pairs.push([Number(value[i]), Number(value[i + 1])]);
    }
    return pairs;
  }
  if (value.length > 0 && Array.isArray(value[0])) {
    return value.map(function(p) { return [Number(p[0]), Number(p[1])]; });
  }
  return value.map(function(p) { return [Number(p.x), Number(p.y)]; });
}

function pointsToFlat(points) {
  var flat = [];
  points.forEach(function(p) {
    flat.push(Number(p[0]) || 0, Number(p[1]) || 0);
  });
  return flat;
}

function pointsToObjects(points) {
  return points.map(function(p) { return { x: Number(p[0]) || 0, y: Number(p[1]) || 0 }; });
}

function parsePathPoints(path) {
  if (!path || typeof path !== 'string') return [];
  var nums = path.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 6) return [];
  var points = [];
  for (var i = 0; i < nums.length - 1; i += 2) {
    points.push([Number(nums[i]), Number(nums[i + 1])]);
  }
  return points;
}

function normalizeCenter(region, points) {
  if (Array.isArray(region.center) && region.center.length >= 2) return [Number(region.center[0]) || 0, Number(region.center[1]) || 0];
  if (region.center && typeof region.center === 'object') return [Number(region.center.x) || 0, Number(region.center.y) || 0];
  if (region.centroid && typeof region.centroid === 'object') return [Number(region.centroid.x) || 0, Number(region.centroid.y) || 0];
  if (!points || !points.length) return [0, 0];
  var sx = 0, sy = 0;
  points.forEach(function(p) { sx += Number(p[0]) || 0; sy += Number(p[1]) || 0; });
  return [sx / points.length, sy / points.length];
}

function findScenarioFactionByMapValue(value, mapData) {
  if (!value) return null;
  var factions = (typeof GM !== 'undefined' && GM && GM.facs) || (typeof P !== 'undefined' && P && P.factions) || [];
  var mapFactions = (mapData && mapData.factions) || {};
  var directMeta = mapFactions[value] || null;
  var directKey = directMeta ? value : null;
  var candidates = [value];
  if (directMeta) {
    candidates.push(directMeta.label, directMeta.scenarioFactionId, directMeta.scenarioFactionName, directMeta.short);
  }
  Object.keys(mapFactions).forEach(function(key) {
    var meta = mapFactions[key] || {};
    if (key === value || meta.label === value || meta.short === value || meta.scenarioFactionId === value || meta.scenarioFactionName === value) {
      candidates.push(key, meta.label, meta.scenarioFactionId, meta.scenarioFactionName, meta.short);
      directKey = directKey || key;
      directMeta = directMeta || meta;
    }
  });
  for (var i = 0; i < candidates.length; i++) {
    var needle = candidates[i];
    if (!needle) continue;
    var hit = factions.find(function(f) { return f && (f.id === needle || f.name === needle); });
    if (hit) return { id: hit.id || hit.name, key: directKey || (hit.id || hit.name), name: hit.name || hit.id, color: hit.color || (directMeta && directMeta.color) || '' };
  }
  if (directMeta) {
    return {
      id: directMeta.scenarioFactionId || value,
      key: directKey || value,
      name: directMeta.scenarioFactionName || directMeta.label || value,
      color: directMeta.color || ''
    };
  }
  return { id: value, key: value, name: value, color: '' };
}

function normalizeGameMapRuntime(mapData) {
  if (!mapData || typeof mapData !== 'object') return mapData;
  ensureMapDataScaffold(mapData);
  mapData.width = mapData.width || mapData.config.width || 1200;
  mapData.height = mapData.height || mapData.config.height || 800;
  mapData.config.width = mapData.width;
  mapData.config.height = mapData.height;

  mapData.regions.forEach(function(region, idx) {
    if (!region) return;
    if (!region.id) region.id = region.name || ('region_' + idx);
    if (!region.name) region.name = region.title || region.id;
    var points = asPointArray(region.points);
    if (!points.length) points = asPointArray(region.coords);
    if (!points.length) points = asPointArray(region.polygon);
    if (!points.length) points = parsePathPoints(region.path || region.d);
    if (points.length) {
      region.points = points;
      region.coords = pointsToFlat(points);
      region.polygon = pointsToObjects(points);
    }
    region.center = normalizeCenter(region, points);
    region.centroid = { x: region.center[0], y: region.center[1] };
    if (!Array.isArray(region.neighbors)) region.neighbors = [];
    if (!Array.isArray(region.resources)) {
      region.resources = String(region.resources || region.data?.specialResources || '').split(/[、，,·\s]+/).filter(Boolean);
    }
    if (!region.terrain) region.terrain = region.data?.terrain || 'plains';
    var ownerValue = region.currentOwner || region.owner || region.factionId || region.ownerKey || '';
    var resolved = findScenarioFactionByMapValue(ownerValue, mapData);
    region.owner = resolved.id || ownerValue;
    region.currentOwner = region.owner;
    region.controller = region.controller || region.owner;
    region.ownerKey = region.ownerKey || resolved.key || ownerValue;
    region.currentOwnerKey = region.currentOwnerKey || region.ownerKey;
    region.controllerKey = region.controllerKey || region.ownerKey;
    region.stableFactionId = region.stableFactionId || region.ownerKey;
    region.factionId = region.owner;
    region.factionName = region.factionName || resolved.name || ownerValue;
    region.ownerName = region.ownerName || region.factionName;
    if (!region.initialOwner) region.initialOwner = region.owner;
    if (!region.initialOwnerKey) region.initialOwnerKey = region.ownerKey;
    if (!region.color && resolved.color) region.color = resolved.color;
    if (region.development === undefined) region.development = Number(region.data?.prosperity ?? region.prosperity ?? 50);
    if (region.prosperity === undefined) region.prosperity = Number(region.data?.prosperity ?? region.development ?? 50);
    if (region.troops === undefined) region.troops = Number(region.data?.governanceMilitary?.standingArmy ?? region.data?.publicTreasuryInit?.troops ?? 0);
    if (!region.events) region.events = '';
    if (!Array.isArray(region.ownerHistory)) region.ownerHistory = [];
    region.mutable = region.mutable !== false;
  });

  if ((!mapData.items || mapData.items.length === 0) && mapData.regions.length) {
    mapData.items = mapData.regions.map(function(region) {
      return {
        id: region.id,
        name: region.name,
        type: 'poly',
        coords: pointsToObjects(asPointArray(region.coords)),
        center: { x: region.center[0], y: region.center[1] },
        neighbors: region.neighbors || [],
        terrain: region.terrain || 'plains',
        resources: region.resources || [],
        owner: region.owner || '',
        characters: region.characters || [],
        troops: region.troops || 0,
        development: region.development || 50,
        events: region.events || '',
        color: region.color || '#cccccc'
      };
    });
  }
  return mapData;
}

function bindRuntimeMapState(sourceMap) {
  if (!sourceMap || !sourceMap.regions) return null;
  var liveMap = cloneMapValue(sourceMap);
  normalizeGameMapRuntime(liveMap);
  if (typeof GM !== 'undefined' && GM) GM.mapData = liveMap;
  if (typeof P !== 'undefined' && P) {
    P.map = liveMap;
    P.mapData = liveMap;
  }
  return liveMap;
}

function findMapRegion(mapData, regionRef) {
  if (arguments.length === 1 && (!mapData || !Array.isArray(mapData.regions))) {
    regionRef = mapData;
    mapData = null;
  }
  mapData = mapData || getLiveMapData();
  if (!mapData || !Array.isArray(mapData.regions)) return null;
  return mapData.regions.find(function(region) {
    return region && (region.id === regionRef || region.name === regionRef || region.adminBinding === regionRef || region.mapRegionId === regionRef);
  }) || null;
}

function pushMapTurnChange(change) {
  if (typeof GM === 'undefined' || !GM) return;
  if (!GM.turnChanges) GM.turnChanges = { variables: [], characters: [], factions: [], parties: [], classes: [], military: [], map: [] };
  if (!Array.isArray(GM.turnChanges.map)) GM.turnChanges.map = [];
  GM.turnChanges.map.push(change);
}

function setMapRegionOwner(regionRef, newOwner, opts) {
  opts = opts || {};
  var mapData = opts.mapData || getLiveMapData();
  var region = findMapRegion(mapData, regionRef);
  if (!region) return null;
  var resolved = findScenarioFactionByMapValue(newOwner, mapData);
  var oldOwner = region.owner;
  var oldOwnerKey = region.ownerKey;
  region.owner = resolved.id || newOwner;
  region.currentOwner = region.owner;
  region.controller = region.owner;
  region.ownerKey = resolved.key || newOwner;
  region.currentOwnerKey = region.ownerKey;
  region.controllerKey = region.ownerKey;
  region.stableFactionId = region.ownerKey;
  region.factionId = region.owner;
  region.factionName = resolved.name || newOwner;
  region.ownerName = region.factionName;
  if (resolved.color) region.color = resolved.color;
  if (!Array.isArray(region.ownerHistory)) region.ownerHistory = [];
  region.ownerHistory.push({
    turn: typeof GM !== 'undefined' && GM ? GM.turn : 0,
    from: oldOwner,
    fromKey: oldOwnerKey,
    to: region.owner,
    toKey: region.ownerKey,
    reason: opts.reason || '领地易主'
  });
  if (region.events !== undefined) region.events += (region.events ? '\n' : '') + (opts.reason || '领地易主');
  pushMapTurnChange({ regionId: region.id, regionName: region.name, field: 'owner', oldValue: oldOwner, newValue: region.owner, reason: opts.reason || '领地易主' });
  if (typeof recordChange === 'function') {
    try { recordChange('map', region.name, 'owner', oldOwner, region.owner, opts.reason || '领地易主'); } catch (_) {}
  }
  if (typeof updateMapColors === 'function') updateMapColors();
  return region;
}

function updateMapRegionFields(regionRef, patch, opts) {
  opts = opts || {};
  var mapData = opts.mapData || getLiveMapData();
  var region = findMapRegion(mapData, regionRef);
  if (!region || !patch || typeof patch !== 'object') return null;
  Object.keys(patch).forEach(function(key) {
    if (key === 'owner' || key === 'currentOwner' || key === 'ownerKey') return;
    var oldValue = region[key];
    if (key === 'data' && patch.data && typeof patch.data === 'object') {
      region.data = Object.assign({}, region.data || {}, patch.data);
    } else {
      region[key] = patch[key];
    }
    pushMapTurnChange({ regionId: region.id, regionName: region.name, field: key, oldValue: oldValue, newValue: region[key], reason: opts.reason || '地块字段变化' });
  });
  return region;
}

function applyRuntimeAIMapChanges(aiResponse, mapData) {
  if (!aiResponse || !aiResponse.map_changes) return;
  var changes = aiResponse.map_changes;
  (changes.ownership_changes || []).forEach(function(change) {
    setMapRegionOwner(change.region_id || change.region_name, change.new_owner, { mapData: mapData, reason: change.reason || 'AI推演领地易主' });
  });
  (changes.troop_changes || []).forEach(function(change) {
    var region = findMapRegion(mapData, change.region_id || change.region_name);
    if (region) updateMapRegionFields(region.id, { troops: Math.max(0, Number(region.troops || 0) + Number(change.delta || 0)) }, { mapData: mapData, reason: change.reason || 'AI推演驻军变化' });
  });
  (changes.development_changes || []).forEach(function(change) {
    var region = findMapRegion(mapData, change.region_id || change.region_name);
    if (region) updateMapRegionFields(region.id, { development: clamp(Number(region.development || 50) + Number(change.delta || 0), 0, 100) }, { mapData: mapData, reason: change.reason || 'AI推演发展度变化' });
  });
  (changes.events || []).forEach(function(event) {
    var region = findMapRegion(mapData, event.region_id || event.region_name);
    if (region) updateMapRegionFields(region.id, { events: (region.events ? region.events + '\n' : '') + (event.description || '') }, { mapData: mapData, reason: 'AI推演地块事件' });
  });
}

function getMapAIContextData(mapData) {
  mapData = normalizeGameMapRuntime(mapData || getLiveMapData());
  if (!mapData) return null;
  return {
    id: mapData.id || '',
    name: mapData.name || '',
    width: mapData.width || 0,
    height: mapData.height || 0,
    regionCount: mapData.regions.length,
    regions: mapData.regions.map(function(region) {
      return {
        id: region.id,
        name: region.name,
        owner: region.owner,
        ownerKey: region.ownerKey,
        factionName: region.factionName,
        terrain: region.terrain,
        neighbors: region.neighbors || [],
        development: region.development,
        prosperity: region.prosperity,
        troops: region.troops,
        adminBinding: region.adminBinding,
        mutable: region.mutable !== false
      };
    })
  };
}

var TMMapRuntime = {
  bind: bindRuntimeMapState,
  normalize: normalizeGameMapRuntime,
  getMap: getLiveMapData,
  findRegion: findMapRegion,
  setRegionOwner: setMapRegionOwner,
  updateRegion: updateMapRegionFields,
  applyAIMapChanges: applyRuntimeAIMapChanges,
  toAIContext: getMapAIContextData
};
if (typeof window !== 'undefined') window.TMMapRuntime = TMMapRuntime;
if (typeof globalThis !== 'undefined') globalThis.TMMapRuntime = TMMapRuntime;

/**
 * 自动为势力分配颜色
 */
// 以 factor>1 朝白混合(提亮)·factor<1 朝黑缩放(压暗)·派生剧本主色的高亮/暗色。
function _tmAdjustBrightness(hex, factor) {
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return hex;
  var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  if (factor >= 1) { var tt = factor - 1; r += (255 - r) * tt; g += (255 - g) * tt; b += (255 - b) * tt; }
  else { r *= factor; g *= factor; b *= factor; }
  function cl(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  return '#' + cl(r).toString(16).padStart(2, '0') + cl(g).toString(16).padStart(2, '0') + cl(b).toString(16).padStart(2, '0');
}

function assignFactionColors() {
  if (!GM.facs || GM.facs.length === 0) return;
  if (!GM.mapData) return;

  var hueStep = 360 / GM.facs.length;

  for (var i = 0; i < GM.facs.length; i++) {
    var faction = GM.facs[i];
    var hue = i * hueStep;

    // 剧本权威配色:优先用剧本地图所定义的势力色(map.factions[id|name].color)·缺则按序号自动生成。
    // 跨朝代根治:此前 GM.facs 永无 color → 自动 HSL 总覆盖 → 剧本在 map.factions 配的势力色形同死字段(地块填色 line 708 首选 faction.color)。
    // 现以剧本色为准(任何剧本受益)·自动 HSL 仅作未配色势力的兜底。
    var scColor = null;
    if (GM.mapData.factions) {
      var _fm = GM.mapData.factions[faction.id] || GM.mapData.factions[faction.name];
      if (_fm && typeof _fm.color === 'string' && /^#?[0-9a-fA-F]{6}$/.test(_fm.color)) {
        scColor = (_fm.color[0] === '#') ? _fm.color : ('#' + _fm.color);
      }
    }

    // 生成主/高亮/暗色:有剧本色则由其派生·否则按序号 HSL
    var mainColor = scColor || hslToRgb(hue, 70, 60);
    var highlightColor = scColor ? _tmAdjustBrightness(scColor, 1.28) : hslToRgb(hue, 70, 75);
    var darkColor = scColor ? _tmAdjustBrightness(scColor, 0.62) : hslToRgb(hue, 70, 40);

    GM.mapData.factionColors[faction.name] = {
      main: mainColor,
      highlight: highlightColor,
      dark: darkColor,
      alpha: 'rgba(' + hexToRgb(mainColor) + ', 0.7)'
    };

    // 势力对象主色(地块填色首选源)·剧本/自动色写入·已有则不覆盖(s.factions 若自带 color 最权威)。
    if (!faction.color) {
      faction.color = mainColor;
    }
  }
}

/**
 * HSL 转 RGB
 */
function hslToRgb(h, s, l) {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  var r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    var hue2rgb = function(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return '#' +
    Math.round(r * 255).toString(16).padStart(2, '0') +
    Math.round(g * 255).toString(16).padStart(2, '0') +
    Math.round(b * 255).toString(16).padStart(2, '0');
}

/**
 * Hex 转 RGB 字符串（用于 rgba）
 */
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';

  return parseInt(result[1], 16) + ', ' +
         parseInt(result[2], 16) + ', ' +
         parseInt(result[3], 16);
}

// ==================== 地形系统 ====================

/**
 * 初始化地形类型定义
 */
function initTerrainTypes() {
  if (!GM.terrainTypes) {
    GM.terrainTypes = {
      'plains': {
        name: '平原',
        color: '#90EE90',
        pattern: null,
        movementCost: 1.0,
        defensiveBonus: 0,
        incomeMultiplier: 1.2,
        description: '适合农业和行军'
      },
      'hills': {
        name: '丘陵',
        color: '#D2B48C',
        pattern: 'diagonal',
        movementCost: 1.5,
        defensiveBonus: 0.2,
        incomeMultiplier: 0.9,
        description: '防御有利，移动困难'
      },
      'mountains': {
        name: '山地',
        color: '#8B7355',
        pattern: 'cross',
        movementCost: 2.0,
        defensiveBonus: 0.5,
        incomeMultiplier: 0.6,
        description: '极难通行，防御极佳'
      },
      'forest': {
        name: '森林',
        color: '#228B22',
        pattern: 'dots',
        movementCost: 1.3,
        defensiveBonus: 0.15,
        incomeMultiplier: 0.8,
        description: '木材资源丰富'
      },
      'desert': {
        name: '沙漠',
        color: '#F4A460',
        pattern: 'waves',
        movementCost: 1.8,
        defensiveBonus: -0.1,
        incomeMultiplier: 0.4,
        description: '贫瘠之地'
      },
      'water': {
        name: '水域',
        color: '#4682B4',
        pattern: 'horizontal',
        movementCost: 999,
        defensiveBonus: 0,
        incomeMultiplier: 0,
        description: '无法通行'
      },
      'grassland': {
        name: '草原',
        color: '#7CFC00',
        pattern: null,
        movementCost: 0.8,
        defensiveBonus: -0.1,
        incomeMultiplier: 1.0,
        description: '适合骑兵作战'
      },
      'swamp': {
        name: '沼泽',
        color: '#556B2F',
        pattern: 'zigzag',
        movementCost: 2.5,
        defensiveBonus: 0.1,
        incomeMultiplier: 0.3,
        description: '极难通行'
      }
    };
  }
}

/**
 * 获取多边形的地形
 */
function getPolygonTerrain(cityId) {
  if (!GM.mapData || !GM.mapData.terrains) return 'plains';
  return GM.mapData.terrains[cityId] || 'plains';
}

/**
 * 创建地形图案
 */
function createTerrainPattern(ctx, patternType) {
  var patternCanvas = document.createElement('canvas');
  patternCanvas.width = 20;
  patternCanvas.height = 20;
  var pctx = patternCanvas.getContext('2d');

  pctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  pctx.lineWidth = 1;

  switch(patternType) {
    case 'diagonal':
      for (var i = 0; i < 40; i += 5) {
        pctx.beginPath();
        pctx.moveTo(i, 0);
        pctx.lineTo(0, i);
        pctx.stroke();
      }
      break;
    case 'cross':
      for (var i = 0; i < 20; i += 5) {
        pctx.beginPath();
        pctx.moveTo(i, 0);
        pctx.lineTo(i, 20);
        pctx.stroke();
        pctx.beginPath();
        pctx.moveTo(0, i);
        pctx.lineTo(20, i);
        pctx.stroke();
      }
      break;
    case 'dots':
      for (var x = 5; x < 20; x += 10) {
        for (var y = 5; y < 20; y += 10) {
          pctx.beginPath();
          pctx.arc(x, y, 2, 0, Math.PI * 2);
          pctx.fill();
        }
      }
      break;
    case 'waves':
      pctx.beginPath();
      for (var x = 0; x < 20; x++) {
        var y = 10 + Math.sin(x * 0.5) * 3;
        if (x === 0) pctx.moveTo(x, y);
        else pctx.lineTo(x, y);
      }
      pctx.stroke();
      break;
    case 'horizontal':
      for (var i = 0; i < 20; i += 5) {
        pctx.beginPath();
        pctx.moveTo(0, i);
        pctx.lineTo(20, i);
        pctx.stroke();
      }
      break;
    case 'zigzag':
      pctx.beginPath();
      for (var x = 0; x < 20; x += 5) {
        pctx.lineTo(x, x % 10 === 0 ? 5 : 15);
      }
      pctx.stroke();
      break;
  }

  return ctx.createPattern(patternCanvas, 'repeat');
}

/**
 * 更新地图颜色 - 根据占领者实时更新地块颜色
 * 说明：地图主要用于可视化和帮助AI理解地理关系
 * 实际游戏推演以行政区划（cities/territories）为准
 */
function updateMapColors() {
  if (!P.map) return;

  _dbg('[Map] 更新地图颜色...');

  var updateCount = 0;

  // 建立 region.id → autonomy 类型 映射（若该地块映射了行政区划）
  var _regionAutonomyMap = {};
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.mappedRegions && d.autonomy && d.autonomy.type) {
            d.mappedRegions.forEach(function(rid) { _regionAutonomyMap[rid] = d.autonomy.type; });
          }
          if (d.children) _walk(d.children);
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }

  // 批五·义军占据覆色：region.id → 占据者（民变演绎层写 div.occupiedBy·此处渲染层消费）。
  // 双树防御走查：P 与 GM 的 adminHierarchy 通常同引用·若分叉则以任一侧有 occupiedBy 为准（占据只由
  // tm-revolt-inference 写在 GM 叶上·P 侧缺失=静默无覆色·安全失效不破图）。
  var _regionOccupiedMap = {};
  [P.adminHierarchy, (typeof GM !== 'undefined' && GM && GM.adminHierarchy !== P.adminHierarchy) ? GM.adminHierarchy : null].forEach(function(ah) {
    if (!ah) return;
    Object.keys(ah).forEach(function(fk) {
      var fh = ah[fk]; if (!fh || !fh.divisions) return;
      (function _wOcc(ds) {
        ds.forEach(function(d) {
          if (!d) return;
          if (d.occupiedBy && Array.isArray(d.mappedRegions)) {
            d.mappedRegions.forEach(function(rid) { _regionOccupiedMap[rid] = d.occupiedBy; });
          }
          if (d.children) _wOcc(d.children);
          if (d.divisions) _wOcc(d.divisions);
        });
      })(fh.divisions);
    });
  });
  // 按管辖类型给地块着色修正——直辖用势力主色；非直辖用"势力主色+autonomy类型色调"混合
  var _AUTONOMY_COLORS = { fanguo:'#9a7bd8', fanzhen:'#f87171', jimi:'#66bb6a', chaogong:'#f59e0b' };

  // 更新智能格式地块颜色
  if (P.map.regions && Array.isArray(P.map.regions)) {
    P.map.regions.forEach(function(region) {
      if (!region) return;

      // 根据 owner/currentOwner/ownerKey 查找对应势力
      var owner = region.currentOwner || region.owner || region.factionId || region.ownerKey;
      if (!owner) {
        region.color = '#cccccc'; // 无主地块为灰色
        return;
      }

      // 查找势力
      var faction = GM.facs ? GM.facs.find(function(f) { return f.name === owner || f.id === owner || f.name === region.factionName || f.id === region.factionId; }) : null;
      var baseColor = null;
      if (faction && faction.color) baseColor = faction.color;
      else if (GM.mapData && GM.mapData.factionColors && GM.mapData.factionColors[owner]) baseColor = GM.mapData.factionColors[owner].main;
      else if (GM.mapData && GM.mapData.factionColors && region.factionName && GM.mapData.factionColors[region.factionName]) baseColor = GM.mapData.factionColors[region.factionName].main;
      else if (GM.mapData && GM.mapData.factions && region.ownerKey && GM.mapData.factions[region.ownerKey]) baseColor = GM.mapData.factions[region.ownerKey].color;
      else if (region.factionColor) baseColor = region.factionColor;
      if (!baseColor) { region.color = '#cccccc'; return; }
      // 按 autonomy 覆盖或混合——非直辖显示管辖类型色
      var _autType = _regionAutonomyMap[region.id];
      if (_autType && _autType !== 'zhixia' && _AUTONOMY_COLORS[_autType]) {
        region.color = _AUTONOMY_COLORS[_autType];
        region.autonomyType = _autType;
      } else {
        region.color = baseColor;
        region.autonomyType = 'zhixia';
      }
      // 批五·义军占据覆色压轴（占据是既成军事事实·压过 autonomy 显示·退据即自动还色）
      var _occ = _regionOccupiedMap[region.id];
      if (_occ) {
        var _occC = (GM.mapData && GM.mapData.factionColors && GM.mapData.factionColors[_occ]) || null;
        if (_occC && _occC.main) { region.color = _occC.main; region.occupiedBy = _occ; }
      } else if (region.occupiedBy) {
        delete region.occupiedBy;
      }
      updateCount++;
    });
  }

  // 更新传统格式地块颜色
  if (P.map.items && Array.isArray(P.map.items)) {
    P.map.items.forEach(function(item) {
      if (!item) return;

      var owner = item.currentOwner || item.owner || item.factionId || item.ownerKey;
      if (!owner) {
        item.color = '#cccccc';
        return;
      }

      var faction = GM.facs ? GM.facs.find(function(f) { return f.name === owner || f.id === owner || f.name === item.factionName || f.id === item.factionId; }) : null;
      if (faction && faction.color) {
        item.color = faction.color;
        updateCount++;
      } else if (GM.mapData && GM.mapData.factionColors && GM.mapData.factionColors[owner]) {
        item.color = GM.mapData.factionColors[owner].main;
        updateCount++;
      } else if (GM.mapData && GM.mapData.factions && item.ownerKey && GM.mapData.factions[item.ownerKey]) {
        item.color = GM.mapData.factions[item.ownerKey].color;
        updateCount++;
      } else if (item.factionColor) {
        item.color = item.factionColor;
        updateCount++;
      } else {
        item.color = '#cccccc';
      }
    });
  }

  _dbg('[Map] 地图颜色更新完成，更新了 ' + updateCount + ' 个地块');

  // 如果有地图显示组件，触发重绘
  if (typeof refreshMapDisplay === 'function') {
    refreshMapDisplay();
  }
}

/**
 * 城市数据结构
 */
function createCity(id, name, x, y, owner) {
  return {
    id: id,
    name: name,
    x: x,
    y: y,
    owner: owner,
    neighbors: [],
    population: 10000,
    income: 1000,
    garrison: 0
  };
}

/**
 * 多边形数据结构
 */
function createPolygon(cityId, points) {
  return {
    cityId: cityId,
    points: points
  };
}

/**
 * 初始化Canvas
 */
function initMapCanvas() {
  var canvas = document.getElementById('mapCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'mapCanvas';
    canvas.width = GM.mapData.config.width;
    canvas.height = GM.mapData.config.height;
    canvas.style.cssText = 'border: 2px solid var(--gold); cursor: pointer; display: block; margin: 1rem auto;';

    var container = document.getElementById('map-container');
    if (container) {
      container.appendChild(canvas);
    }
  }

  return canvas;
}

/**
 * 渲染地图主函数
 */
function renderMap() {
  if (!GM.mapData) return;

  var canvas = initMapCanvas();
  // 无头/测试环境无真 canvas(getContext 缺失)时跳过渲染·不影响真浏览器(getContext 恒在)·并保结算管线确定性
  if (!canvas || typeof canvas.getContext !== 'function') return;

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = GM.mapData.config.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(GM.mapData.state.offsetX, GM.mapData.state.offsetY);
  ctx.scale(GM.mapData.state.scale, GM.mapData.state.scale);

  renderPolygons(ctx);
  renderEdges(ctx);
  renderCities(ctx);
  renderCrests(ctx);  // 添加纹章渲染
  renderArmies(ctx);  // 添加军队渲染
  renderBattles(ctx); // 添加战斗渲染
  renderHighlights(ctx);

  ctx.restore();
}

/**
 * 渲染多边形领地
 */
function renderPolygons(ctx) {
  Object.values(GM.mapData.polygons).forEach(function(polygon) {
    var city = GM.mapData.cities[polygon.cityId];
    if (!city) return;

    var faction = findFacByName(city.owner);
    var color = '#cccccc';

    // 检查是否显示地形
    var showTerrain = GM.mapData.state.showTerrain;
    var terrainType = getPolygonTerrain(polygon.cityId);
    var terrain = GM.terrainTypes ? GM.terrainTypes[terrainType] : null;

    if (showTerrain && terrain) {
      // 显示地形模式：使用地形颜色
      color = terrain.color;
    } else {
      // 显示势力模式：使用势力颜色
      if (faction && GM.mapData.factionColors[faction.name]) {
        color = GM.mapData.factionColors[faction.name].alpha;
      } else if (faction && faction.color) {
        color = faction.color;
      }
    }

    ctx.beginPath();
    polygon.points.forEach(function(point, index) {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // 如果有地形图案，叠加图案
    if (showTerrain && terrain && terrain.pattern) {
      var pattern = createTerrainPattern(ctx, terrain.pattern);
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fill();
      }
    }
  });
}

/**
 * 渲染边界线
 */
function renderEdges(ctx) {
  Object.values(GM.mapData.polygons).forEach(function(polygon) {
    ctx.beginPath();
    polygon.points.forEach(function(point, index) {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();

    ctx.strokeStyle = GM.mapData.config.borderColor;
    ctx.lineWidth = GM.mapData.config.borderWidth;
    ctx.stroke();
  });
}

/**
 * 渲染城市标记
 */
function renderCities(ctx) {
  Object.values(GM.mapData.cities).forEach(function(city) {
    ctx.beginPath();
    ctx.arc(city.x, city.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(city.name, city.x, city.y - 8);

    ctx.font = '10px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(city.owner, city.x, city.y + 18);
  });
}

/**
 * 渲染纹章系统
 */
function renderCrests(ctx) {
  if (!GM.facs || GM.facs.length === 0) return;

  // 为每个势力找到首都或主要城市
  GM.facs.forEach(function(faction) {
    var capitalCity = findCapitalCity(faction);
    if (!capitalCity) return;

    var colorInfo = GM.mapData.factionColors[faction.name];
    if (!colorInfo) return;

    // 绘制纹章圆形背景
    ctx.beginPath();
    ctx.arc(capitalCity.x, capitalCity.y - 30, 18, 0, Math.PI * 2);
    ctx.fillStyle = colorInfo.main;
    ctx.fill();
    ctx.strokeStyle = colorInfo.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制势力名称首字母
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(faction.name.substring(0, 1), capitalCity.x, capitalCity.y - 30);
  });
}

/**
 * 查找势力的首都城市
 */
function findCapitalCity(faction) {
  if (!faction || !GM.mapData.cities) return null;

  // 查找属于该势力的城市
  var factionCities = Object.values(GM.mapData.cities).filter(function(city) {
    return city.owner === faction.name;
  });

  if (factionCities.length === 0) return null;

  // 返回第一个城市作为首都（可以后续优化为人口最多或收入最高的城市）
  return factionCities[0];
}

// ==================== Voronoi图生成系统 ====================

/**
 * 判断点是否在三角形外接圆内
 */
function pointInCircumcircle(point, triangle) {
  var ax = triangle[0].x - point.x;
  var ay = triangle[0].y - point.y;
  var bx = triangle[1].x - point.x;
  var by = triangle[1].y - point.y;
  var cx = triangle[2].x - point.x;
  var cy = triangle[2].y - point.y;

  var det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
            (bx * bx + by * by) * (ax * cy - cx * ay) +
            (cx * cx + cy * cy) * (ax * by - bx * ay);

  return det > 0;
}

/**
 * 判断两条边是否相等
 */
function edgesEqual(edge1, edge2) {
  return (edge1[0] === edge2[0] && edge1[1] === edge2[1]) ||
         (edge1[0] === edge2[1] && edge1[1] === edge2[0]);
}

/**
 * 计算三角形外接圆圆心
 */
function calculateCircumcenter(triangle) {
  var ax = triangle[0].x, ay = triangle[0].y;
  var bx = triangle[1].x, by = triangle[1].y;
  var cx = triangle[2].x, cy = triangle[2].y;

  var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  return { x: ux, y: uy };
}

/**
 * 判断点是否在边界内侧
 */
function isInsideBoundary(point, edge, bounds) {
  if (edge.dx === 0 && edge.dy === 1) return point.x >= bounds.minX;
  if (edge.dx === 1 && edge.dy === 0) return point.y <= bounds.maxY;
  if (edge.dx === 0 && edge.dy === -1) return point.x <= bounds.maxX;
  if (edge.dx === -1 && edge.dy === 0) return point.y >= bounds.minY;
  return true;
}

/**
 * 计算线段与边界的交点
 */
function computeIntersection(p1, p2, edge, bounds) {
  var x1 = p1.x, y1 = p1.y;
  var x2 = p2.x, y2 = p2.y;

  if (edge.dx === 0 && edge.dy === 1) {
    var t = (bounds.minX - x1) / (x2 - x1);
    return { x: bounds.minX, y: y1 + t * (y2 - y1) };
  }
  if (edge.dx === 1 && edge.dy === 0) {
    var t = (bounds.maxY - y1) / (y2 - y1);
    return { x: x1 + t * (x2 - x1), y: bounds.maxY };
  }
  if (edge.dx === 0 && edge.dy === -1) {
    var t = (bounds.maxX - x1) / (x2 - x1);
    return { x: bounds.maxX, y: y1 + t * (y2 - y1) };
  }
  if (edge.dx === -1 && edge.dy === 0) {
    var t = (bounds.minY - y1) / (y2 - y1);
    return { x: x1 + t * (x2 - x1), y: bounds.minY };
  }
  return null;
}

/**
 * 渲染高亮效果
 */
function renderHighlights(ctx) {
  var state = GM.mapData.state;

  if (state.hoveredCityId) {
    var polygon = GM.mapData.polygons[state.hoveredCityId];
    if (polygon) {
      ctx.beginPath();
      polygon.points.forEach(function(point, index) {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();

      ctx.fillStyle = GM.mapData.config.highlightColor;
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  if (state.selectedCityId && state.selectedCityId !== state.hoveredCityId) {
    var polygon = GM.mapData.polygons[state.selectedCityId];
    if (polygon) {
      ctx.beginPath();
      polygon.points.forEach(function(point, index) {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();

      ctx.fillStyle = GM.mapData.config.selectedColor;
      ctx.fill();

      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/**
 * 格式化数字显示（如 1000 -> 1k）
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * 渲染地图上的军队
 */
function renderArmies(ctx) {
  if (!GM.mapData || !GM.mapData.armies) return;

  GM.mapData.armies.forEach(function(army) {
    // 获取军队所在位置
    var x = army.x;
    var y = army.y;

    // 如果军队正在移动，计算插值位置
    if (army.moving && army.targetX !== undefined && army.targetY !== undefined) {
      var progress = army.moveProgress || 0;
      x = army.x + (army.targetX - army.x) * progress;
      y = army.y + (army.targetY - army.y) * progress;
    }

    // 获取势力颜色
    var faction = findFacByName(army.faction);
    var color = '#666666';
    if (faction && GM.mapData.factionColors[faction.name]) {
      color = GM.mapData.factionColors[faction.name].main;
    }

    // 绘制军队图标（旗帜形状）
    ctx.save();
    ctx.translate(x, y);

    // 旗杆
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -30);
    ctx.stroke();

    // 旗帜
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(20, -25);
    ctx.lineTo(0, -20);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 军队规模文字
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var sizeText = formatNumber(army.size);
    ctx.strokeText(sizeText, 10, -25);
    ctx.fillText(sizeText, 10, -25);

    ctx.restore();

    // 如果军队正在移动，绘制移动路径
    if (army.moving && army.targetX !== undefined && army.targetY !== undefined) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(army.x, army.y);
      ctx.lineTo(army.targetX, army.targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

/**
 * 渲染战斗效果
 */
function renderBattles(ctx) {
  if (!GM.mapData || !GM.mapData.battles) return;

  GM.mapData.battles.forEach(function(battle) {
    var x = battle.x;
    var y = battle.y;

    // 战斗动画效果（闪烁的圆圈）
    var time = Date.now() / 1000;
    var radius = 20 + Math.sin(time * 5) * 5;
    var alpha = 0.5 + Math.sin(time * 3) * 0.3;

    // 外圈（红色）
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, ' + alpha + ')';
    ctx.fill();

    // 内圈（黄色）
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 0, ' + (alpha * 0.8) + ')';
    ctx.fill();

    // 战斗图标（交叉的剑）
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    // 第一把剑
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, 10);
    ctx.stroke();

    // 第二把剑
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.lineTo(-10, 10);
    ctx.stroke();

    ctx.restore();

    // 战斗信息文字
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var battleText = battle.attacker + ' vs ' + battle.defender;
    ctx.strokeText(battleText, x, y + 30);
    ctx.fillText(battleText, x, y + 30);
  });
}

/**
 * 点在多边形内检测算法（射线法）
 */
function isPointInPolygon(x, y, polygon) {
  var inside = false;
  var points = polygon.points;

  for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
    var xi = points[i].x, yi = points[i].y;
    var xj = points[j].x, yj = points[j].y;

    var intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * 获取鼠标位置对应的城市ID
 */
function getCityAtPosition(x, y) {
  var state = GM.mapData.state;

  var mapX = (x - state.offsetX) / state.scale;
  var mapY = (y - state.offsetY) / state.scale;

  for (var cityId in GM.mapData.polygons) {
    var polygon = GM.mapData.polygons[cityId];
    if (isPointInPolygon(mapX, mapY, polygon)) {
      return parseInt(cityId);
    }
  }

  return null;
}

/**
 * 初始化地图交互事件
 */
function initMapInteraction() {
  var canvas = document.getElementById('mapCanvas');
  if (!canvas) return;

  // 拖拽/渲染性能（治拖拽卡顿）：拖拽状态 + rAF 节流渲染——把每帧多次 mousemove 合并为一次重绘，
  // 避免多次 renderMap() 挤在同一帧做无用功；拖拽中亦跳过悬停命中测试(见下)。
  var isDragging = false, lastX = 0, lastY = 0;
  var _renderQueued = false;
  var _raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 16); };
  function _scheduleRender() {
    if (_renderQueued) return;
    _renderQueued = true;
    _raf(function() { _renderQueued = false; renderMap(); });
  }

  canvas.addEventListener('mousemove', function(e) {
    if (isDragging) return; // 拖拽中跳过悬停命中测试+重绘（与拖拽渲染叠加是卡顿主因之一）
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var cityId = getCityAtPosition(x, y);

    if (GM.mapData.state.hoveredCityId !== cityId) {
      GM.mapData.state.hoveredCityId = cityId;
      _scheduleRender();
      canvas.style.cursor = cityId ? 'pointer' : 'default';
    }
  });

  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var cityId = getCityAtPosition(x, y);

    if (cityId) {
      GM.mapData.state.selectedCityId = cityId;
      renderMap();
      showCityInfo(cityId);
    }
  });

  canvas.addEventListener('mouseleave', function() {
    GM.mapData.state.hoveredCityId = null;
    renderMap();
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();

    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    var newScale = GM.mapData.state.scale * delta;

    if (newScale >= 0.5 && newScale <= 3.0) {
      GM.mapData.state.scale = newScale;
      renderMap();
    }
  });

  // isDragging / lastX / lastY 已在函数顶部声明（配合 rAF 节流渲染）
  canvas.addEventListener('mousedown', function(e) {
    if (e.button === 2) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    }
  });

  canvas.addEventListener('mousemove', function(e) {
    if (isDragging) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;

      GM.mapData.state.offsetX += dx;
      GM.mapData.state.offsetY += dy;

      lastX = e.clientX;
      lastY = e.clientY;

      _scheduleRender(); // rAF 节流：多次 mousemove 合并为每帧一次重绘（去卡顿）
    }
  });

  canvas.addEventListener('mouseup', function(e) {
    if (e.button === 2) {
      isDragging = false;
    }
  });

  canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
}

/**
 * 显示城市信息面板
 */
function showCityInfo(cityId) {
  var city = GM.mapData.cities[cityId];
  if (!city) return;

  var faction = findFacByName(city.owner);
  // faction may be null if owner not found — safe, not dereferenced below

  var html = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg);border:2px solid var(--gold);border-radius:0.5rem;padding:1.5rem;min-width:300px;z-index:10000;">';
  html += '<h3 style="color:var(--gold);margin-bottom:1rem;">' + city.name + '</h3>';
  html += '<div style="margin-bottom:0.5rem;"><strong>归属：</strong>' + city.owner + '</div>';
  html += '<div style="margin-bottom:0.5rem;"><strong>人口：</strong>' + (city.population||0).toLocaleString() + '</div>';
  html += '<div style="margin-bottom:0.5rem;"><strong>收入：</strong>' + (city.income||0).toLocaleString() + ' 金/月</div>';
  var _cgv = Number(city.garrison || 0);
  if (_cgv > 0) {
    html += '<div style="margin-bottom:0.5rem;"><strong>驻军：</strong>' + _cgv.toLocaleString() + '</div>';
  } else {
    // 无逐块驻军实体：兜底显所属势力机动军力（游牧显「机动兵力」·余显「势力军力」），免得游牧/无常驻势力显 0
    var _cms = faction && Number(faction.militaryStrength || faction.military || 0);
    if (isFinite(_cms) && _cms > 0) {
      var _cnomad = /部落|游牧|游猎/.test(String((faction && faction.type) || '') + String((faction && faction.traits) ? faction.traits.join('') : ''));
      html += '<div style="margin-bottom:0.5rem;"><strong>' + (_cnomad ? '机动兵力' : '势力军力') + '：</strong>' + _cms.toLocaleString() + '</div>';
    } else {
      html += '<div style="margin-bottom:0.5rem;"><strong>驻军：</strong>0</div>';
    }
  }

  if ((city.neighbors||[]).length > 0) {
    html += '<div style="margin-top:1rem;"><strong>相邻城市：</strong></div>';
    html += '<div style="font-size:0.9rem;color:var(--txt-s);">';
    (city.neighbors||[]).forEach(function(neighborId) {
      var neighbor = GM.mapData.cities[neighborId];
      if (neighbor) {
        html += neighbor.name + ' (' + neighbor.owner + ')、';
      }
    });
    html = html.slice(0, -1);
    html += '</div>';
  }

  html += '<button class="bt" onclick="closeCityInfo()" style="width:100%;margin-top:1rem;">关闭</button>';
  html += '</div>';

  var overlay = document.createElement('div');
  overlay.id = 'city-info-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;'; // 须压过 map-viewer-overlay(10000)·旧9999令城市详情被压在地图下(2026-07-04 审查定罪)
  overlay.innerHTML = html;

  document.body.appendChild(overlay);
}

/**
 * 关闭城市信息面板
 */
function closeCityInfo() {
  var overlay = document.getElementById('city-info-overlay');
  if (overlay) overlay.remove();
}

/**
 * 添加城市
 */
function addCity(id, name, x, y, owner) {
  GM.mapData.cities[id] = createCity(id, name, x, y, owner);
}

/**
 * 添加多边形
 */
function addPolygon(cityId, points) {
  GM.mapData.polygons[cityId] = createPolygon(cityId, points);
}

/**
 * 设置相邻关系
 */
function setNeighbors(cityId, neighborIds) {
  var city = GM.mapData.cities[cityId];
  if (city) {
    city.neighbors = neighborIds;
  }
}

/**
 * 更新城市归属
 */
function updateCityOwner(cityId, newOwner) {
  var city = GM.mapData.cities[cityId];
  if (city) {
    var oldOwner = city.owner;
    city.owner = newOwner;

    recordChange('map', city.name, 'owner', oldOwner, newOwner, '领地易主');

    renderMap();
  }
}

/**
 * 从剧本数据加载地图
 */
function loadMapFromScenario(scenario) {
  if (!scenario.mapData) return;

  GM.mapData.cities = deepClone(scenario.mapData.cities || {});
  GM.mapData.polygons = deepClone(scenario.mapData.polygons || {});
  GM.mapData.edges = deepClone(scenario.mapData.edges || {});

  initMapInteraction();

  renderMap();
}

/**
 * 创建示例地图数据
 */
function createSampleMapData() {
  initMapSystem();

  addCity(1, '长安', 400, 300, '秦国');
  addCity(2, '洛阳', 600, 300, '魏国');
  addCity(3, '邯郸', 500, 150, '赵国');
  addCity(4, '临淄', 700, 200, '齐国');
  addCity(5, '郢都', 500, 450, '楚国');

  addPolygon(1, [
    {x: 300, y: 200}, {x: 450, y: 200}, {x: 450, y: 400}, {x: 300, y: 400}
  ]);

  addPolygon(2, [
    {x: 550, y: 200}, {x: 700, y: 200}, {x: 700, y: 400}, {x: 550, y: 400}
  ]);

  addPolygon(3, [
    {x: 450, y: 50}, {x: 600, y: 50}, {x: 600, y: 200}, {x: 450, y: 200}
  ]);

  addPolygon(4, [
    {x: 650, y: 100}, {x: 800, y: 100}, {x: 800, y: 300}, {x: 650, y: 300}
  ]);

  addPolygon(5, [
    {x: 400, y: 400}, {x: 600, y: 400}, {x: 600, y: 550}, {x: 400, y: 550}
  ]);

  setNeighbors(1, [2, 3, 5]);
  setNeighbors(2, [1, 3, 4]);
  setNeighbors(3, [1, 2, 4]);
  setNeighbors(4, [2, 3]);
  setNeighbors(5, [1]);

  initMapInteraction();

  renderMap();
}

/**
 * 在游戏开始时初始化地图
 */
function initGameMap() {
  // AI地理志模式：跳过地图初始化
  if (P.map && P.map.enabled === false) {
    console.log('[initGameMap] 地图已禁用（AI地理志模式），跳过初始化');
    return;
  }

  // 同步地图数据格式（确保两种格式都可用）
  if (GM.mapData && GM.mapData.regions && GM.mapData.regions.length > 0) {
    normalizeGameMapRuntime(GM.mapData);
    P.map = GM.mapData;
    P.mapData = GM.mapData;
  } else if (P.map && P.map.regions && P.map.regions.length > 0) {
    bindRuntimeMapState(P.map);
  } else if (P.mapData && P.mapData.regions && P.mapData.regions.length > 0) {
    bindRuntimeMapState(P.mapData);
  }
  syncGameMapData();

  initMapSystem();

  var scenario = P.scenarios.find(function(s) { return s.id === GM.sid; });
  if (scenario && scenario.mapData && (scenario.mapData.cities || scenario.mapData.polygons)) {
    loadMapFromScenario(scenario);
  } else if (GM.mapData && GM.mapData.regions && GM.mapData.regions.length > 0) {
    updateMapColors();
  } else {
    createSampleMapData();
  }
}

/**
 * 同步游戏地图数据 - 确保智能格式和传统格式都可用
 */
function syncGameMapData() {
  if (!P.map) {
    P.map = { items: [], regions: [], roads: [], width: 1200, height: 800 };
    return;
  }

  // 校验并补全地图区域数据：为缺失 coords/center 的区域生成占位值
  var allRegions = [].concat(P.map.regions || [], P.map.items || []);
  var gridCols = Math.ceil(Math.sqrt(allRegions.length || 1));
  var cellW = (P.map.width || 1200) / (gridCols + 1);
  var cellH = (P.map.height || 800) / (gridCols + 1);
  allRegions.forEach(function(r, idx) {
    if (!r.id) r.id = r.name || ('region_' + idx);
    if (!r.terrain) r.terrain = 'plains';
    if (!r.development && r.development !== 0) r.development = 50;
    if (!r.troops && r.troops !== 0) r.troops = 0;
    // 为缺失坐标的区域生成网格占位坐标
    var hasCoords = asPointArray(r.coords).length > 0 || asPointArray(r.polygon).length > 0 || asPointArray(r.points).length > 0;
    if (!hasCoords) {
      var col = idx % gridCols, row = Math.floor(idx / gridCols);
      var cx = (col + 1) * cellW, cy = (row + 1) * cellH;
      var sz = Math.min(cellW, cellH) * 0.35;
      r.coords = [{x:cx-sz,y:cy-sz},{x:cx+sz,y:cy-sz},{x:cx+sz,y:cy+sz},{x:cx-sz,y:cy+sz}];
      if (!r.polygon || r.polygon.length === 0) r.polygon = r.coords.slice();
      console.warn('[地图校验] 为区域 "' + r.name + '" 生成占位坐标');
    }
    if (!r.center || (Array.isArray(r.center) ? (r.center.length < 2) : (!r.center.x && !r.center.y))) {
      var pts = asPointArray(r.coords);
      if (!pts.length) pts = asPointArray(r.polygon);
      if (!pts.length) pts = asPointArray(r.points);
      if (pts.length > 0) {
        r.center = normalizeCenter(r, pts);
      } else {
        r.center = [0, 0];
      }
    }
  });

  // 如果有智能格式（regions）但没有传统格式（items），进行转换
  if (P.map.regions && P.map.regions.length > 0 &&
      (!P.map.items || P.map.items.length === 0)) {
    _dbg('[地图同步] 智能格式 → 传统格式');
    P.map.items = P.map.regions.map(function(region) {
      return {
        id: region.id,
        name: region.name,
        type: 'poly',
        coords: region.coords || region.polygon || [],
        center: region.center || { x: 0, y: 0 },
        neighbors: region.neighbors || [],
        terrain: region.terrain || 'plains',
        resources: region.resources || [],
        owner: region.owner || '',
        characters: region.characters || [],
        troops: region.troops || 0,
        development: region.development || 50,
        events: '',
        color: region.color || '#cccccc'
      };
    });
  }

  // 如果有传统格式（items）但没有智能格式（regions），进行转换
  if (P.map.items && P.map.items.length > 0 &&
      (!P.map.regions || P.map.regions.length === 0)) {
    _dbg('[地图同步] 传统格式 → 智能格式');
    P.map.regions = P.map.items.map(function(item) {
      return {
        id: item.id,
        name: item.name,
        coords: item.coords || [],
        polygon: item.coords || [],
        center: item.center || { x: 0, y: 0 },
        neighbors: item.neighbors || [],
        terrain: item.terrain || 'plains',
        resources: item.resources || [],
        owner: item.owner || '',
        characters: item.characters || [],
        troops: item.troops || 0,
        development: item.development || 50,
        color: item.color || '#cccccc'
      };
    });

    // 计算地图尺寸
    var maxX = 1200, maxY = 800;
    P.map.regions.forEach(function(region) {
      if (region.coords && region.coords.length > 0) {
        region.coords.forEach(function(coord) {
          if (coord.x > maxX) maxX = coord.x;
          if (coord.y > maxY) maxY = coord.y;
        });
      }
    });

    P.map.width = Math.ceil(maxX * 1.1);
    P.map.height = Math.ceil(maxY * 1.1);
    P.map.roads = P.map.roads || [];
  }

  _dbg('[地图同步] 完成 - items:', P.map.items?.length || 0, 'regions:', P.map.regions?.length || 0);
}

/**
 * 在每回合更新地图状态
 */
function updateMapState() {
  if (!GM.mapData) return;

  // 更新城市状态
  Object.values(GM.mapData.cities).forEach(function(city) {
    var faction = findFacByName(city.owner);
    if (faction) {
      if (faction.population) {
        city.population = faction.population;
      }

      if (faction.income) {
        city.income = faction.income;
      }

      if (faction.military) {
        city.garrison = faction.military;
      }
    }
  });

  // 同步军队到地图
  syncArmiesToMap();

  // 同步战斗到地图
  syncBattlesToMap();

  // 更新军队移动动画
  updateArmyMovement();

  renderMap();
}

/**
 * 同步游戏中的军队到地图显示
 */
function syncArmiesToMap() {
  if (!GM.mapData) return;
  if (!GM.armies || GM.armies.length === 0) {
    GM.mapData.armies = [];
    return;
  }

  GM.mapData.armies = [];

  GM.armies.forEach(function(army) {
    // 获取军队所在城市的坐标
    var city = GM.mapData.cities[army.location] || findCityByName(army.location);
    if (!city) return;

    var mapArmy = {
      id: army.id,
      faction: army.faction,
      size: army.soldiers || 0,
      x: city.x,
      y: city.y,
      location: army.location,
      moving: false,
      moveProgress: 0
    };

    // 如果军队正在移动，设置目标位置
    if (army.targetLocation) {
      var targetCity = GM.mapData.cities[army.targetLocation] || findCityByName(army.targetLocation);
      if (targetCity) {
        mapArmy.moving = true;
        mapArmy.targetX = targetCity.x;
        mapArmy.targetY = targetCity.y;
        mapArmy.moveProgress = army.moveProgress || 0;
      }
    }

    GM.mapData.armies.push(mapArmy);
  });
}

/**
 * 同步战斗到地图显示
 */
function syncBattlesToMap() {
  if (!GM.mapData) return;
  GM.mapData.battles = [];

  // 从事件日志中查找正在进行的战斗
  if (GM.evtLog && GM.evtLog.length > 0) {
    var recentEvents = GM.evtLog.slice(-10); // 最近10条事件
    recentEvents.forEach(function(evt) {
      if (evt.type === '战争' && evt.text && evt.text.indexOf('战斗') !== -1) {
        // 解析战斗信息
        var match = evt.text.match(/(.+?)与(.+?)在(.+?)发生战斗/);
        if (match) {
          var attacker = match[1];
          var defender = match[2];
          var location = match[3];

          var city = GM.mapData.cities[location] || findCityByName(location);
          if (city) {
            GM.mapData.battles.push({
              attacker: attacker,
              defender: defender,
              location: location,
              x: city.x,
              y: city.y,
              turn: GM.turn
            });
          }
        }
      }
    });
  }

  // 清理旧战斗（超过3回合的）
  var battleKeepTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(3) : 3;
  GM.mapData.battles = GM.mapData.battles.filter(function(battle) {
    return GM.turn - battle.turn <= battleKeepTurns;
  });
}

/**
 * 更新军队移动动画
 */
function updateArmyMovement() {
  if (!GM.mapData || !GM.mapData.armies) return;

  GM.mapData.armies.forEach(function(army) {
    if (army.moving && army.moveProgress < 1) {
      army.moveProgress += 0.1; // 每次更新增加10%进度
      if (army.moveProgress >= 1) {
        army.moveProgress = 1;
        army.moving = false;
        army.x = army.targetX;
        army.y = army.targetY;
      }
    }
  });
}

/**
 * 根据名字查找城市
 */
function findCityByName(name) {
  if (!GM.mapData || !GM.mapData.cities) return null;

  for (var id in GM.mapData.cities) {
    var city = GM.mapData.cities[id];
    if (city.name === name) {
      return city;
    }
  }
  return null;
}

/**
 * 打开地图查看器
 * R107·AI 地理志模式兜底：若玩家选了 AI 地理志（P.map.enabled=false 或 GM._useAIGeo=true），
 *      则不显示空白地图弹窗·改为展示"AI 地理志"说明
 */
function openMapViewer() {
  // AI 地理志模式·没有地形图数据
  var isAIGeo = (typeof P !== 'undefined' && P.map && P.map.enabled === false)
             || (typeof GM !== 'undefined' && GM._useAIGeo === true)
             || (typeof GM === 'undefined' || !GM.mapData);
  if (isAIGeo) {
    var placeholder = document.createElement('div');
    placeholder.id = 'map-viewer-overlay';
    placeholder.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;';
    placeholder.innerHTML =
      '<div style="background:var(--color-surface,#241e18);border:1px solid var(--gold-500,#c9a849);border-radius:12px;padding:2.5rem;max-width:480px;text-align:center;">' +
        '<div style="font-size:2.5rem;margin-bottom:1rem;opacity:0.5;">📜</div>' +
        '<div style="font-size:1.15rem;color:var(--gold-400,#c9a849);margin-bottom:0.8rem;font-weight:600;">AI 地理志模式</div>' +
        '<div style="font-size:0.9rem;color:var(--color-foreground-muted,#999);line-height:1.8;margin-bottom:1.5rem;">' +
          '本局无地形图数据。<br>距离、地形、关隘、城防由 AI 根据真实历史知识推算。<br>' +
          '<span style="opacity:0.7;font-size:0.85rem;">若需查看地图·请新建游戏时选择"剧本地图模式"。</span>' +
        '</div>' +
        '<button class="bt" onclick="document.getElementById(\'map-viewer-overlay\').remove();" style="padding:0.5rem 2rem;">知道了</button>' +
      '</div>';
    document.body.appendChild(placeholder);
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'map-viewer-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;';

  var html = '<div style="background:var(--bg);border:2px solid var(--gold);border-radius:0.5rem;padding:1.5rem;max-width:1400px;width:100%;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">';
  html += '<h2 style="color:var(--gold);margin:0;">天下地图</h2>';
  html += '<div style="display:flex;gap:10px;">';
  html += '<button class="bt" onclick="toggleTerrainView()">切换地形/势力</button>';
  html += '<button class="bt" onclick="closeMapViewer()">关闭</button>';
  html += '</div>';
  html += '</div>';
  html += '<div id="map-container" style="overflow:auto;"></div>';
  html += '<div style="margin-top:1rem;font-size:0.9rem;color:var(--txt-s);">';
  html += '提示：鼠标滚轮缩放，右键拖拽平移，点击城市查看详情';
  html += '</div>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  renderMap();
  // 交互监听补挂(2026-07-04 审查定罪)：initMapInteraction 原只在开局被调·彼时 #mapCanvas 未在文档即 return——
  // 查看器曾是死图：滚轮/拖拽/点城全失效·底部却写着操作提示。canvas 随 overlay 每次重建·不叠监听。
  if (typeof initMapInteraction === 'function') { try { initMapInteraction(); } catch (_miE) {} }
}

/**
 * 切换地形/势力视图
 */
function toggleTerrainView() {
  if (!GM.mapData) return;
  GM.mapData.state.showTerrain = !GM.mapData.state.showTerrain;
  renderMap();
  toast(GM.mapData.state.showTerrain ? '已切换到地形视图' : '已切换到势力视图');
}

/**
 * 关闭地图查看器
 */
function closeMapViewer() {
  var overlay = document.getElementById('map-viewer-overlay');
  if (overlay) overlay.remove();
}

// ============================================================
// 邻接图构建 + A*寻路
// 从 P.map.regions 的 neighbors 数据自动构建，供 MarchSystem/SupplySystem 调用
// ============================================================

/**
 * 从P.map.regions构建邻接图
 * 在doActualStart中调用（地图启用时）
 */
function buildAdjacencyGraph() {
  if (!P.map || !P.map.regions || !P.map.regions.length) return;
  if (!GM.mapData) GM.mapData = {};

  var graph = {};
  var regions = P.map.regions;
  var roads = P.map.roads || [];

  // 构建road索引（双向查找）
  var roadMap = {};
  roads.forEach(function(rd) {
    if (!rd.from || !rd.to) return;
    var k1 = rd.from + '|' + rd.to;
    var k2 = rd.to + '|' + rd.from;
    roadMap[k1] = rd;
    roadMap[k2] = rd;
  });

  regions.forEach(function(r) {
    var rId = r.id || r.name;
    if (!rId) return;
    graph[rId] = [];

    (r.neighbors || []).forEach(function(nId) {
      var neighbor = regions.find(function(n) { return (n.id || n.name) === nId; });
      var road = roadMap[rId + '|' + nId];

      // 地形移动消耗
      var terrainCost = 1.0;
      if (neighbor && neighbor.terrain && GM.mapData.terrains) {
        var tDef = GM.mapData.terrains[neighbor.terrain];
        if (tDef && tDef.movementCost) terrainCost = tDef.movementCost;
      } else if (neighbor && neighbor.terrain && typeof initTerrainTypes !== 'undefined') {
        // fallback: 从默认terrain定义读取
        var defCosts = { plains: 1.0, hills: 1.5, mountains: 2.0, forest: 1.3, desert: 1.8, grassland: 0.8, swamp: 2.5, water: 999 };
        terrainCost = defCosts[neighbor.terrain] || 1.0;
      }

      graph[rId].push({
        target: nId,
        type: road ? (road.type || 'land') : 'land',
        distance: road ? (road.distance || 1) : 1,
        hasPostRoad: road ? !!road.hasPostRoad : false,
        movementCost: terrainCost,
        passLevel: neighbor ? (neighbor.passLevel || 0) : 0,
        passName: neighbor ? (neighbor.passName || '') : '',
        terrain: neighbor ? (neighbor.terrain || 'plains') : 'plains'
      });
    });
  });

  GM.mapData.adjacencyGraph = graph;
  _dbg('[Map] 邻接图构建完成:', Object.keys(graph).length, '个节点');
}

/**
 * A*寻路算法
 * @param {string} from - 起点区域ID/名称
 * @param {string} to - 终点区域ID/名称
 * @param {Object} [options] - {avoidEnemy:bool, faction:string, waterOnly:bool}
 * @returns {{path:string[], cost:number, distance:number, hasPostRoad:boolean, terrainTypes:string[]}|null}
 */
function findPath(from, to, options) {
  var graph = GM.mapData && GM.mapData.adjacencyGraph;
  if (!graph || !graph[from]) return null;
  if (from === to) return { path: [from], cost: 0, distance: 0, hasPostRoad: false, terrainTypes: [] };

  options = options || {};
  var openSet = [{ node: from, g: 0, f: 0, path: [from], terrains: [], postRoad: false }];
  var closed = {};

  while (openSet.length > 0) {
    // 取f值最小的节点
    openSet.sort(function(a, b) { return a.f - b.f; });
    var current = openSet.shift();

    if (current.node === to) {
      return {
        path: current.path,
        cost: current.g,
        distance: current.path.length - 1,
        hasPostRoad: current.postRoad,
        terrainTypes: current.terrains
      };
    }

    if (closed[current.node]) continue;
    closed[current.node] = true;

    var edges = graph[current.node] || [];
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (closed[edge.target]) continue;

      // 关隘阻断：敌方控制的关隘不可通过
      if (edge.passLevel > 0 && options.avoidEnemy) {
        var region = (P.map.regions || []).find(function(r) { return (r.id || r.name) === edge.target; });
        if (region) {
          var regionOwner = region.occupiedBy || region.owner || '';
          if (regionOwner && options.faction && regionOwner !== options.faction) {
            continue; // 敌占关隘，跳过
          }
        }
      }

      // 计算移动消耗
      var g = current.g + edge.distance * edge.movementCost;

      // 水路加速
      if (edge.type === 'water') g *= 0.3;
      // 栈道减速
      if (edge.type === 'mountain_pass') g *= 1.5;
      // 驿道加速
      if (edge.hasPostRoad) g *= 0.7;

      var newTerrains = current.terrains.concat(edge.terrain);
      var hasRoad = current.postRoad || edge.hasPostRoad;

      openSet.push({
        node: edge.target,
        g: g,
        f: g, // 无启发式（退化为Dijkstra，保证最优）
        path: current.path.concat(edge.target),
        terrains: newTerrains,
        postRoad: hasRoad
      });
    }
  }

  return null; // 不可达
}

/**
 * 计算补给线效率
 * @param {string} baseCityId - 补给基地
 * @param {string} armyCityId - 前线军队位置
 * @param {string} factionName - 所属势力
 * @returns {{path:string[], efficiency:number, isCut:boolean}}
 */
function calculateSupplyLine(baseCityId, armyCityId, factionName) {
  var pathResult = findPath(baseCityId, armyCityId, { avoidEnemy: true, faction: factionName });
  if (!pathResult) {
    return { path: [], efficiency: 0.1, isCut: true };
  }

  // 效率随距离递减
  var distanceDecay = (P.battleConfig && P.battleConfig.supplyConfig && P.battleConfig.supplyConfig.distanceDecay) || 0.08;
  var efficiency = Math.max(0.1, 1.0 - pathResult.distance * distanceDecay);

  // 检查路径上是否有敌方占领的节点（补给线被截断）
  var isCut = false;
  for (var i = 1; i < pathResult.path.length - 1; i++) {
    var node = pathResult.path[i];
    var region = (P.map.regions || []).find(function(r) { return (r.id || r.name) === node; });
    if (region) {
      var nodeOwner = region.occupiedBy || region.owner || '';
      if (nodeOwner && factionName && nodeOwner !== factionName) {
        isCut = true;
        efficiency = 0.1;
        break;
      }
    }
  }

  return { path: pathResult.path, efficiency: efficiency, isCut: isCut };
}


// ============================================================
// Phase 3 (2026-05-03)·从 tm-chaoyi-misc.js redistribute
// 原 misc.js L186-529·drawMinimap + InteractiveMap object + openInteractiveMap + closeInteractiveMap
// ============================================================
function drawMinimap(){
  var c=_$("g-minimap");if(!c)return;
  if(!P.mapData || !P.mapData.regions || P.mapData.regions.length === 0) return;
  var ctx=c.getContext("2d");
  ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,c.width,c.height);
  var scale=c.width/(P.mapData.width||800);
  P.mapData.regions.forEach(function(r){
    ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle=r.color||"#c9a84c";
    if(r.type==="rect"&&r.rect){
      ctx.fillRect(r.rect.x*scale,r.rect.y*scale,r.rect.w*scale,r.rect.h*scale);
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font=Math.max(7,9*scale)+"px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,(r.rect.x+r.rect.w/2)*scale,(r.rect.y+r.rect.h/2)*scale+3);
    }else if(r.type==="point"&&r.point){
      ctx.globalAlpha=0.8;ctx.beginPath();ctx.arc(r.point.x*scale,r.point.y*scale,4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="7px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,r.point.x*scale,r.point.y*scale-7);
    }else if(r.type==="poly"&&r.points&&r.points.length>2){
      ctx.beginPath();ctx.moveTo(r.points[0][0]*scale,r.points[0][1]*scale);
      r.points.forEach(function(p){ctx.lineTo(p[0]*scale,p[1]*scale);});
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  });
}

// ============================================================
//  交互式地图系统
// ============================================================

var InteractiveMap = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  selectedRegion: null,
  hoveredRegion: null,

  // 初始化
  init: function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 绑定事件
    this.bindEvents();

    // 绘制地图
    this.draw();
  },

  // 绑定事件
  bindEvents: function() {
    var self = this;

    // 鼠标滚轮缩放
    this.canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? 0.9 : 1.1;
      var newScale = self.scale * delta;

      // 限制缩放范围
      if (newScale < 0.5) newScale = 0.5;
      if (newScale > 3) newScale = 3;

      // 计算缩放中心
      var rect = self.canvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      // 调整偏移以保持鼠标位置不变
      self.offsetX = mouseX - (mouseX - self.offsetX) * (newScale / self.scale);
      self.offsetY = mouseY - (mouseY - self.offsetY) * (newScale / self.scale);

      self.scale = newScale;
      self.draw();
    });

    // 鼠标拖拽平移
    this.canvas.addEventListener('mousedown', function(e) {
      self.isDragging = true;
      self.dragStartX = e.clientX - self.offsetX;
      self.dragStartY = e.clientY - self.offsetY;
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (self.isDragging) {
        self.offsetX = e.clientX - self.dragStartX;
        self.offsetY = e.clientY - self.dragStartY;
        self.draw();
      } else {
        // 检测悬停区域
        var rect = self.canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left - self.offsetX) / self.scale;
        var mouseY = (e.clientY - rect.top - self.offsetY) / self.scale;

        self.hoveredRegion = self.getRegionAt(mouseX, mouseY);
        self.draw();
      }
    });

    this.canvas.addEventListener('mouseup', function(e) {
      if (self.isDragging) {
        self.isDragging = false;
      } else {
        // 点击选择区域
        var rect = self.canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left - self.offsetX) / self.scale;
        var mouseY = (e.clientY - rect.top - self.offsetY) / self.scale;

        var region = self.getRegionAt(mouseX, mouseY);
        if (region) {
          self.selectedRegion = region;
          self.showRegionInfo(region);
          self.draw();
        }
      }
    });

    this.canvas.addEventListener('mouseleave', function() {
      self.isDragging = false;
      self.hoveredRegion = null;
      self.draw();
    });
  },

  // 获取指定坐标的区域
  getRegionAt: function(x, y) {
    if (!P.mapData || !P.mapData.regions) return null;

    for (var i = P.mapData.regions.length - 1; i >= 0; i--) {
      var r = P.mapData.regions[i];

      if (r.type === 'rect' && r.rect) {
        if (x >= r.rect.x && x <= r.rect.x + r.rect.w &&
            y >= r.rect.y && y <= r.rect.y + r.rect.h) {
          return r;
        }
      } else if (r.type === 'point' && r.point) {
        var dist = Math.sqrt(Math.pow(x - r.point.x, 2) + Math.pow(y - r.point.y, 2));
        if (dist <= 10) return r;
      } else if (r.type === 'poly' && r.points && r.points.length > 2) {
        if (this.isPointInPolygon(x, y, r.points)) return r;
      }
    }

    return null;
  },

  // 判断点是否在多边形内
  isPointInPolygon: function(x, y, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i][0], yi = points[i][1];
      var xj = points[j][0], yj = points[j][1];

      var intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  // 绘制地图
  draw: function() {
    if (!this.ctx || !P.mapData || !P.mapData.regions) return;

    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;

    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 应用变换
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 绘制所有区域
    P.mapData.regions.forEach(function(r) {
      var isSelected = this.selectedRegion && this.selectedRegion.name === r.name;
      var isHovered = this.hoveredRegion && this.hoveredRegion.name === r.name;

      ctx.save();

      // 设置透明度和颜色
      ctx.globalAlpha = isSelected ? 0.7 : (isHovered ? 0.5 : 0.35);
      ctx.fillStyle = r.color || '#c9a84c';

      // 绘制区域形状
      if (r.type === 'rect' && r.rect) {
        ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);

        // 绘制边框
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffd700' : '#fff';
          ctx.lineWidth = 2 / this.scale;
          ctx.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
        }

        // 绘制文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (14 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2 + 5);
      } else if (r.type === 'point' && r.point) {
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(r.point.x, r.point.y, 6 / this.scale, 0, Math.PI * 2);
        ctx.fill();

        // 绘制文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (12 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.point.x, r.point.y - 10 / this.scale);
      } else if (r.type === 'poly' && r.points && r.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(r.points[0][0], r.points[0][1]);
        r.points.forEach(function(p) {
          ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.fill();

        // 绘制边框
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffd700' : '#fff';
          ctx.lineWidth = 2 / this.scale;
          ctx.stroke();
        }

        // 计算中心点绘制文字
        var centerX = r.points.reduce(function(sum, p) { return sum + p[0]; }, 0) / r.points.length;
        var centerY = r.points.reduce(function(sum, p) { return sum + p[1]; }, 0) / r.points.length;

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (14 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, centerX, centerY + 5);
      }

      ctx.restore();
    }.bind(this));

    ctx.restore();

    // 绘制控制提示
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('滚轮缩放 | 拖拽平移', 20, 30);
    ctx.fillText('点击区域查看详情', 20, 50);
    ctx.fillText('缩放: ' + (this.scale * 100).toFixed(0) + '%', 20, 65);
  },

  // 显示区域信息
  showRegionInfo: function(region) {
    var infoDiv = document.getElementById('map-region-info');
    if (!infoDiv) return;

    var html = '<h4 style="color:var(--gold);margin-bottom:0.5rem;">' + region.name + '</h4>';

    // 显示控制者
    if (region.controller) {
      html += '<div style="margin-bottom:0.3rem;"><strong>控制者:</strong> ' + region.controller + '</div>';
    }

    // 显示人口
    if (region.population) {
      html += '<div style="margin-bottom:0.3rem;"><strong>人口:</strong> ' + region.population + '</div>';
    }

    // 显示收入
    if (region.income) {
      html += '<div style="margin-bottom:0.3rem;"><strong>收入:</strong> ' + region.income + '</div>';
    }

    // 显示描述
    if (region.desc) {
      html += '<div style="margin-top:0.5rem;color:var(--txt-d);font-size:0.85rem;">' + region.desc + '</div>';
    }

    infoDiv.innerHTML = html;
  }
};

// 打开交互式地图
function openInteractiveMap() {
  if (!P.mapData || !P.mapData.regions || P.mapData.regions.length === 0) {
    toast('❌ 当前剧本没有地图数据');
    return;
  }

  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'interactive-map-overlay';

  var html = '<div class="generic-modal" style="max-width:90vw;max-height:90vh;width:1200px;display:flex;flex-direction:column;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>🗺️ 交互式地图</h3>';
  html += '<button onclick="closeInteractiveMap()">✕</button>';
  html += '</div>';

  html += '<div style="flex:1;display:flex;overflow:hidden;">';

  // 左侧地图画布
  html += '<div style="flex:1;position:relative;">';
  html += '<canvas id="interactive-map-canvas" width="900" height="600" style="width:100%;height:100%;cursor:grab;"></canvas>';
  html += '</div>';

  // 右侧信息面板
  html += '<div style="width:280px;border-left:1px solid var(--bg-3);padding:1rem;overflow-y:auto;">';
  html += '<div id="map-region-info" style="color:var(--txt-d);font-size:0.9rem;">点击地图区域查看详情</div>';
  html += '</div>';

  html += '</div>';
  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);

  // 初始化交互式地图
  var canvas = document.getElementById('interactive-map-canvas');
  if (canvas) {
    InteractiveMap.init(canvas);
  }
}

function closeInteractiveMap() {
  var ov = document.getElementById('interactive-map-overlay');
  if (ov) ov.remove();
}
