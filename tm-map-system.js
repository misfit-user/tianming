// 地图系统 - 多边形地图
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

  // 初始化势力颜色
  assignFactionColors();

  // 初始化地形类型定义
  initTerrainTypes();
}

/**
 * 自动为势力分配颜色
 */
function assignFactionColors() {
  if (!GM.facs || GM.facs.length === 0) return;
  if (!GM.mapData) return;

  var hueStep = 360 / GM.facs.length;

  for (var i = 0; i < GM.facs.length; i++) {
    var faction = GM.facs[i];
    var hue = i * hueStep;

    // 生成主颜色
    var mainColor = hslToRgb(hue, 70, 60);

    // 生成高亮颜色（更亮）
    var highlightColor = hslToRgb(hue, 70, 75);

    // 生成暗色（用于边界）
    var darkColor = hslToRgb(hue, 70, 40);

    GM.mapData.factionColors[faction.name] = {
      main: mainColor,
      highlight: highlightColor,
      dark: darkColor,
      alpha: 'rgba(' + hexToRgb(mainColor) + ', 0.7)'
    };

    // 同时更新势力对象的颜色（向后兼容）
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
 * 为多边形设置地形
 */
function setPolygonTerrain(cityId, terrainType) {
  if (!GM.mapData || !GM.mapData.polygons[cityId]) return;

  if (!GM.mapData.terrains) {
    GM.mapData.terrains = {};
  }

  GM.mapData.terrains[cityId] = terrainType;
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
 * 应用地形效果到游戏机制
 */
function applyTerrainEffects(cityId) {
  var terrainType = getPolygonTerrain(cityId);
  var terrain = GM.terrainTypes[terrainType];
  if (!terrain) return;

  var city = GM.mapData.cities[cityId];
  if (!city) return;

  // 应用收入倍数
  if (city.baseIncome) {
    city.income = Math.floor(city.baseIncome * terrain.incomeMultiplier);
  }

  // 应用防御加成（如果城市有驻军）
  if (city.garrison > 0 && terrain.defensiveBonus) {
    city.defensePower = Math.floor(city.garrison * (1 + terrain.defensiveBonus));
  }
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
  // 按管辖类型给地块着色修正——直辖用势力主色；非直辖用"势力主色+autonomy类型色调"混合
  var _AUTONOMY_COLORS = { fanguo:'#9a7bd8', fanzhen:'#f87171', jimi:'#66bb6a', chaogong:'#f59e0b' };

  // 更新智能格式地块颜色
  if (P.map.regions && Array.isArray(P.map.regions)) {
    P.map.regions.forEach(function(region) {
      if (!region) return;

      // 根据 owner 查找对应势力
      var owner = region.owner;
      if (!owner) {
        region.color = '#cccccc'; // 无主地块为灰色
        return;
      }

      // 查找势力
      var faction = GM.facs ? GM.facs.find(function(f) { return f.name === owner; }) : null;
      var baseColor = null;
      if (faction && faction.color) baseColor = faction.color;
      else if (GM.mapData && GM.mapData.factionColors && GM.mapData.factionColors[owner]) baseColor = GM.mapData.factionColors[owner].main;
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
      updateCount++;
    });
  }

  // 更新传统格式地块颜色
  if (P.map.items && Array.isArray(P.map.items)) {
    P.map.items.forEach(function(item) {
      if (!item) return;

      var owner = item.owner;
      if (!owner) {
        item.color = '#cccccc';
        return;
      }

      var faction = GM.facs ? GM.facs.find(function(f) { return f.name === owner; }) : null;
      if (faction && faction.color) {
        item.color = faction.color;
        updateCount++;
      } else if (GM.mapData && GM.mapData.factionColors && GM.mapData.factionColors[owner]) {
        item.color = GM.mapData.factionColors[owner].main;
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
  if (!canvas) return;

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
 * 根据城市位置自动生成Voronoi图
 */
function generateVoronoiMap() {
  if (!GM.mapData || !GM.mapData.cities) return;

  var cities = Object.values(GM.mapData.cities);
  if (cities.length < 3) {
    toast('至少需要3个城市才能生成Voronoi图');
    return;
  }

  // 1. 计算Delaunay三角剖分
  var triangles = delaunayTriangulation(cities);

  // 2. 从三角剖分生成Voronoi图
  var voronoiCells = generateVoronoiCells(cities, triangles);

  // 3. 裁剪到地图边界
  var mapBounds = {
    minX: 0,
    minY: 0,
    maxX: GM.mapData.config.width,
    maxY: GM.mapData.config.height
  };
  voronoiCells = clipVoronoiCells(voronoiCells, mapBounds);

  // 4. 更新地图数据
  GM.mapData.polygons = {};
  voronoiCells.forEach(function(cell) {
    GM.mapData.polygons[cell.cityId] = {
      cityId: cell.cityId,
      points: cell.points
    };
  });

  // 5. 重新渲染地图
  renderMap();
  toast('Voronoi图生成成功！');
}

/**
 * Delaunay三角剖分（Bowyer-Watson算法）
 */
function delaunayTriangulation(cities) {
  // 创建超级三角形（包含所有点）
  var minX = Math.min.apply(null, cities.map(function(c) { return c.x; }));
  var minY = Math.min.apply(null, cities.map(function(c) { return c.y; }));
  var maxX = Math.max.apply(null, cities.map(function(c) { return c.x; }));
  var maxY = Math.max.apply(null, cities.map(function(c) { return c.y; }));

  var dx = maxX - minX;
  var dy = maxY - minY;
  var deltaMax = Math.max(dx, dy);
  var midX = (minX + maxX) / 2;
  var midY = (minY + maxY) / 2;

  var superTriangle = [
    { x: midX - 20 * deltaMax, y: midY - deltaMax, id: -1 },
    { x: midX, y: midY + 20 * deltaMax, id: -2 },
    { x: midX + 20 * deltaMax, y: midY - deltaMax, id: -3 }
  ];

  var triangles = [superTriangle];

  // 逐点插入
  cities.forEach(function(city) {
    var badTriangles = [];

    // 找到外接圆包含该点的三角形
    triangles.forEach(function(triangle) {
      if (pointInCircumcircle(city, triangle)) {
        badTriangles.push(triangle);
      }
    });

    // 找到多边形边界
    var polygon = [];
    badTriangles.forEach(function(triangle) {
      for (var i = 0; i < 3; i++) {
        var edge = [triangle[i], triangle[(i + 1) % 3]];
        var isShared = false;

        badTriangles.forEach(function(otherTriangle) {
          if (triangle === otherTriangle) return;
          for (var j = 0; j < 3; j++) {
            var otherEdge = [otherTriangle[j], otherTriangle[(j + 1) % 3]];
            if (edgesEqual(edge, otherEdge)) {
              isShared = true;
            }
          }
        });

        if (!isShared) {
          polygon.push(edge);
        }
      }
    });

    // 移除坏三角形
    triangles = triangles.filter(function(t) {
      return badTriangles.indexOf(t) === -1;
    });

    // 添加新三角形
    polygon.forEach(function(edge) {
      triangles.push([edge[0], edge[1], city]);
    });
  });

  // 移除包含超级三角形顶点的三角形
  triangles = triangles.filter(function(triangle) {
    return triangle[0].id >= 0 && triangle[1].id >= 0 && triangle[2].id >= 0;
  });

  return triangles;
}

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
 * 从Delaunay三角剖分生成Voronoi图
 */
function generateVoronoiCells(cities, triangles) {
  var cells = {};

  // 初始化每个城市的Voronoi单元
  cities.forEach(function(city) {
    cells[city.id] = {
      cityId: city.id,
      center: { x: city.x, y: city.y },
      vertices: []
    };
  });

  // 计算每个三角形的外接圆圆心（Voronoi顶点）
  triangles.forEach(function(triangle) {
    var circumcenter = calculateCircumcenter(triangle);

    // 将该顶点添加到三角形三个顶点对应的Voronoi单元
    for (var i = 0; i < 3; i++) {
      var cityId = triangle[i].id;
      if (cells[cityId]) {
        cells[cityId].vertices.push(circumcenter);
      }
    }
  });

  // 对每个单元的顶点按角度排序
  Object.values(cells).forEach(function(cell) {
    cell.vertices = sortVerticesByAngle(cell.vertices, cell.center);
    cell.points = cell.vertices;
  });

  return Object.values(cells);
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
 * 按角度排序顶点
 */
function sortVerticesByAngle(vertices, center) {
  return vertices.sort(function(a, b) {
    var angleA = Math.atan2(a.y - center.y, a.x - center.x);
    var angleB = Math.atan2(b.y - center.y, b.x - center.x);
    return angleA - angleB;
  });
}

/**
 * 裁剪Voronoi单元到地图边界
 */
function clipVoronoiCells(cells, bounds) {
  return cells.map(function(cell) {
    cell.points = clipPolygonToBounds(cell.points, bounds);
    return cell;
  });
}

/**
 * 裁剪多边形到矩形边界（Sutherland-Hodgman算法）
 */
function clipPolygonToBounds(polygon, bounds) {
  var output = polygon;

  // 依次对四条边界进行裁剪
  var edges = [
    { x: bounds.minX, y: 0, dx: 0, dy: 1 },  // 左边界
    { x: 0, y: bounds.maxY, dx: 1, dy: 0 },  // 上边界
    { x: bounds.maxX, y: 0, dx: 0, dy: -1 }, // 右边界
    { x: 0, y: bounds.minY, dx: -1, dy: 0 }  // 下边界
  ];

  edges.forEach(function(edge) {
    var input = output;
    output = [];

    if (input.length === 0) return;

    var prevVertex = input[input.length - 1];

    input.forEach(function(vertex) {
      var prevInside = isInsideBoundary(prevVertex, edge, bounds);
      var vertexInside = isInsideBoundary(vertex, edge, bounds);

      if (vertexInside) {
        if (!prevInside) {
          var intersection = computeIntersection(prevVertex, vertex, edge, bounds);
          if (intersection) output.push(intersection);
        }
        output.push(vertex);
      } else if (prevInside) {
        var intersection = computeIntersection(prevVertex, vertex, edge, bounds);
        if (intersection) output.push(intersection);
      }

      prevVertex = vertex;
    });
  });

  return output;
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

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var cityId = getCityAtPosition(x, y);

    if (GM.mapData.state.hoveredCityId !== cityId) {
      GM.mapData.state.hoveredCityId = cityId;
      renderMap();
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

  var isDragging = false;
  var lastX = 0;
  var lastY = 0;

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

      renderMap();
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
  html += '<div style="margin-bottom:0.5rem;"><strong>人口：</strong>' + city.population.toLocaleString() + '</div>';
  html += '<div style="margin-bottom:0.5rem;"><strong>收入：</strong>' + city.income.toLocaleString() + ' 金/月</div>';
  html += '<div style="margin-bottom:0.5rem;"><strong>驻军：</strong>' + city.garrison.toLocaleString() + '</div>';

  if (city.neighbors.length > 0) {
    html += '<div style="margin-top:1rem;"><strong>相邻城市：</strong></div>';
    html += '<div style="font-size:0.9rem;color:var(--txt-s);">';
    city.neighbors.forEach(function(neighborId) {
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
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;';
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
  syncGameMapData();

  initMapSystem();

  var scenario = P.scenarios.find(function(s) { return s.id === GM.sid; });
  if (scenario && scenario.mapData) {
    loadMapFromScenario(scenario);
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
    var hasCoords = (r.coords && r.coords.length > 0) || (r.polygon && r.polygon.length > 0);
    if (!hasCoords) {
      var col = idx % gridCols, row = Math.floor(idx / gridCols);
      var cx = (col + 1) * cellW, cy = (row + 1) * cellH;
      var sz = Math.min(cellW, cellH) * 0.35;
      r.coords = [{x:cx-sz,y:cy-sz},{x:cx+sz,y:cy-sz},{x:cx+sz,y:cy+sz},{x:cx-sz,y:cy+sz}];
      if (!r.polygon || r.polygon.length === 0) r.polygon = r.coords.slice();
      console.warn('[地图校验] 为区域 "' + r.name + '" 生成占位坐标');
    }
    if (!r.center || (!r.center.x && !r.center.y)) {
      var pts = r.coords || r.polygon || [];
      if (pts.length > 0) {
        var sx = 0, sy = 0;
        pts.forEach(function(p) { sx += (p.x||0); sy += (p.y||0); });
        r.center = { x: sx / pts.length, y: sy / pts.length };
      } else {
        r.center = { x: 0, y: 0 };
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
  GM.mapData.battles = GM.mapData.battles.filter(function(battle) {
    return GM.turn - battle.turn <= 3;
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

