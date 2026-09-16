// map-editor-to-game.js
// Phase 14.1·map editor v2 schema → game runtime region 格式
//
// 来源·web/map-editor*.js 导出的 JSON·包含·
//   { dynasty, era, title, bitmapWidth, bitmapHeight, divisions[],
//     rivers, roads, strongholds, areaLinks, ferries, heightMap, terrainMap, ... }
//
// 目标·game P.map / scriptData.map 的格式·
//   { name, width, height, regions[]: { id, name, coords (flat), center, neighbors,
//                                       terrain, owner, color, development, ... } }
//
// 飞地策略·extraPolygons 拆为 sibling region·id 后缀 _ex0/_ex1·共享 owner+terrain+color
//
// 2026-05-06

(function(global){
  'use strict';

  // ─── ① 主转换 ────────────────────────────────────────────

  function convertMapEditorToGame(meData, opts){
    opts = opts || {};
    if (!meData || !meData.divisions){
      throw new Error('非 map-editor v2 格式·缺 divisions');
    }

    var gm = {
      name: meData.title || '未命名地图',
      width: meData.bitmapWidth || 1280,
      height: meData.bitmapHeight || 800,
      dynasty: meData.dynasty || '',
      era: meData.era || '',
      regions: [],
      // phase 14·扩展·game 端可选用·不识则忽略
      _v2: {
        rivers: meData.rivers || [],
        roads: meData.roads || [],
        strongholds: meData.strongholds || [],
        ferries: meData.ferries || [],
        areaLinks: meData.areaLinks || []
      }
    };

    var splitExclaves = opts.splitExclaves !== false; // 默 true·飞地拆 sibling
    var simplifyTopology = !!opts.simplifyTopology;   // 拓扑顶点 cache·游戏端不需

    meData.divisions.forEach(function(d){
      gm.regions.push(divisionToRegion(d, meData));
      if (splitExclaves && d.logicalRegionId !== d.id && d.extraPolygons && d.extraPolygons.length){
        d.extraPolygons.forEach(function(p, i){
          if (!p || p.length < 3) return;
          gm.regions.push(divisionToRegion(d, meData, {
            polygon: p,
            idSuffix: '_ex' + i,
            nameSuffix: '·飞地' + (i + 1)
          }));
        });
      }
    });

    // 邻接·若 v2 有 areaLinks·优先用·否则用 division.neighbors
    if (gm._v2.areaLinks && gm._v2.areaLinks.length){
      var byId = {};
      gm.regions.forEach(function(r){ byId[r.id] = r; });
      gm._v2.areaLinks.forEach(function(l){
        var a = byId[l.areaA], b = byId[l.areaB];
        if (!a || !b) return;
        if (a.neighbors.indexOf(l.areaB) < 0) a.neighbors.push(l.areaB);
        if (b.neighbors.indexOf(l.areaA) < 0) b.neighbors.push(l.areaA);
      });
    }

    return gm;
  }

  // ─── ② 单 division → region ──────────────────────────────

  function divisionToRegion(d, meData, override){
    override = override || {};
    var poly = override.polygon || d.polygon || [];
    var coordsFlat = flattenPolygon(poly);

    // owner·Phase 25·factionId 优先 (resolve to faction.name)·再 dejureOwner·autonomy.holder·governor
    var owner = '';
    if (d.factionId && meData && Array.isArray(meData.factions)){
      var fac = meData.factions.find(function(f){ return f && f.id === d.factionId; });
      if (fac) owner = fac.name || fac.id;
    }
    owner = owner || d.dejureOwner ||
            (d.autonomy && d.autonomy.holder) ||
            d.governor || '';

    // development·从 prosperity (0-100·已有) 或 populationDetail.mouths 估算
    var development = 50;
    if (typeof d.prosperity === 'number') development = Math.round(d.prosperity);
    else if (d.populationDetail && d.populationDetail.mouths){
      development = Math.min(100, Math.round(d.populationDetail.mouths / 10000));
    }

    // color·colorKey 优先·否则按 autonomy 类型
    var color = colorFromDivision(d);

    // troops·从 governanceMilitary 或 publicTreasuryInit 估
    var troops = 0;
    if (d.governanceMilitary && d.governanceMilitary.standingArmy){
      troops = d.governanceMilitary.standingArmy;
    } else if (d.publicTreasuryInit && d.publicTreasuryInit.troops){
      troops = d.publicTreasuryInit.troops;
    }

    var compound = null;
    if (d.logicalRegionId === d.id && !override.idSuffix) {
      var parts = [[poly].concat(d.holes || [])];
      (d.extraPolygons || []).forEach(function(p,i){
        if (p && p.length >= 3) parts.push([p].concat((d.extraPolygonHoles || [])[i] || []));
      });
      compound={parts:parts,path:parts.reduce(function(out,p){
        return out.concat(p.map(function(r){return 'M'+r.map(function(q){return q.join(',');}).join(' L')+' Z';}));
      },[]).join(' ')};
    }
    return {
      logicalRegionId: compound ? d.id : undefined,
      path: compound ? compound.path : undefined,
      d: compound ? compound.path : undefined,
      points: compound ? poly.map(function(p){return p.slice();}) : undefined,
      holes: compound ? (d.holes || []) : undefined,
      extraPolygons: compound ? (d.extraPolygons || []) : undefined,
      extraPolygonHoles: compound ? (d.extraPolygonHoles || []) : undefined,
      geometry: compound ? {type:compound.parts.length>1?'MultiPolygon':'Polygon',coordinates:compound.parts.length>1?compound.parts:compound.parts[0]} : undefined,
      id: d.id + (override.idSuffix || ''),
      name: d.name + (override.nameSuffix || ''),
      type: 'poly',
      coords: coordsFlat,
      center: d.centroid ? d.centroid.slice() : polygonCentroid(poly),
      neighbors: (d.neighbors || []).slice(),
      terrain: d.terrain || 'plains',
      resources: extractResources(d),
      owner: owner,
      characters: [],
      troops: troops,
      development: development,
      events: '',
      color: color,
      // v2 扩展·game 端可选读
      _meta: {
        level: d.level,
        regionType: d.regionType,
        autonomy: d.autonomy ? Object.assign({}, d.autonomy) : null,
        populationDetail: d.populationDetail || null,
        fiscalDetail: d.fiscalDetail || null,
        carryingCapacity: d.carryingCapacity || null,
        byEthnicity: d.byEthnicity || null,
        byFaith: d.byFaith || null,
        // schema v2·tm-endturn-province.js _peRender* 读·从 adminHierarchy 走才生效·此处携带备用
        tags: d.tags || null,
        economyBase: d.economyBase || null,
        timeline: d.timeline || [],
        establishedYear: d.establishedYear || null,
        abolishedYear: d.abolishedYear || null,
        isCapital: !!d.isCapital,
        isFrontier: !!d.isFrontier,
        isJunDi: !!d.isJunDi,
        crossDynastyId: d.crossDynastyId || '',
        colorKey: typeof d.colorKey === 'number' ? d.colorKey : null,
        sources: d.sources || []
      }
    };
  }

  // ─── ③ 几何 helpers ─────────────────────────────────────

  function flattenPolygon(poly){
    var arr = [];
    if (!poly || !poly.length) return arr;
    poly.forEach(function(p){
      if (Array.isArray(p) && p.length >= 2){
        arr.push(p[0], p[1]);
      }
    });
    return arr;
  }

  function polygonCentroid(poly){
    if (!poly || poly.length < 3) return null;
    var n = poly.length, cx = 0, cy = 0, area = 0;
    for (var i = 0; i < n; i++){
      var j = (i + 1) % n;
      var cross = poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
      area += cross;
      cx += (poly[i][0] + poly[j][0]) * cross;
      cy += (poly[i][1] + poly[j][1]) * cross;
    }
    if (Math.abs(area) < 1e-9) return null;
    return [cx / (3 * area), cy / (3 * area)];
  }

  // ─── ④ 颜色规则 ──────────────────────────────────────────

  // 优先 colorKey (BGR 24-bit)·否则按 autonomy 类型
  function colorFromDivision(d){
    if (typeof d.colorKey === 'number'){
      var b = d.colorKey & 0xff;
      var g = (d.colorKey >> 8) & 0xff;
      var r = (d.colorKey >> 16) & 0xff;
      return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    var typ = d.autonomy && d.autonomy.type;
    var palette = {
      zhixia:   '#3d4f6a',
      fanguo:   '#8a3a2e',
      fanzhen:  '#b65a30',
      jimi:     '#6a8a3a',
      chaogong: '#7a6a3a'
    };
    return palette[typ] || '#666666';
  }
  function toHex(n){
    var s = n.toString(16);
    return s.length === 1 ? '0' + s : s;
  }

  // ─── ⑤ resources 抽取 ──────────────────────────────────

  function extractResources(d){
    var res = [];
    if (d.specialResources && Array.isArray(d.specialResources)){
      res = res.concat(d.specialResources);
    }
    if (d.terrain){
      // 按地形推断常见资源·非排他·user 可后补
      var hint = {
        plains: ['粮'], hill: ['木'], mountain: ['石', '铁'],
        forest: ['木', '兽'], desert: ['盐'], marsh: ['鱼'],
        water: ['鱼'], jungle: ['木'], savanna: []
      };
      (hint[d.terrain] || []).forEach(function(r){
        if (res.indexOf(r) < 0) res.push(r);
      });
    }
    return res;
  }

  // ─── ⑥ 文件载入 + 整合到 P / scriptData ─────────────────

  function loadMapEditorJSON(json, opts){
    var meData = typeof json === 'string' ? JSON.parse(json) : json;
    var gm = convertMapEditorToGame(meData, opts);
    return gm;
  }

  function loadMapEditorFile(file, opts){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(e){
        try {
          var gm = loadMapEditorJSON(e.target.result, opts);
          resolve(gm);
        } catch(err){
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function loadMapEditorDialog(opts){
    return new Promise(function(resolve, reject){
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function(){
        var file = input.files && input.files[0];
        if (!file){ reject(new Error('未选文件')); return; }
        loadMapEditorFile(file, opts).then(function(gm){
          resolve({ gm: gm, fileName: file.name });
        }).catch(reject);
      };
      input.click();
    });
  }

  // ─── ⑦ map-editor divisions → adminHierarchy (DiFang panel 数据源) ───
  //
  // runtime tm-endturn-province.js 的 _peRender* 只读 GM.adminHierarchy / P.adminHierarchy·
  // 不读 GM.regions。要让地图编辑器的 schema v2 字段 (tags/economyBase) 流到玩家面板·
  // 必须建一份 adminHierarchy 平行结构。
  //
  // 结构·{ [factionName]: { name, divisions: [...flat·已附 children=[]] } }
  // 分组规则·按 division.factionId·解析为 faction.name·无 factionId 的进 '未归属'

  function convertMapEditorToAdminHierarchy(meData){
    if (!meData || !Array.isArray(meData.divisions)) return null;
    var facById = {};
    (meData.factions || []).forEach(function(f){ if (f && f.id) facById[f.id] = f; });

    // 先全转 admin 节点(divisionForAdmin 补 children:[])·按 id 索引·便于按 parentId 挂层级树
    var nodeById = {};
    var items = meData.divisions.map(function(d){
      var node = divisionForAdmin(d);
      if (d.id) nodeById[d.id] = node;
      return { d: d, node: node };
    });

    var byFac = {};
    items.forEach(function(item){
      var d = item.d, node = item.node;
      // 子地块(府/县·parentId 指上级)→ 挂到父的 children·实现层级聚合(liveRegionVitals walk children
      //   把府县数据加权汇到省)·而非与父并列。父不存在则回落顶层势力分组。
      var par = d.parentId && nodeById[d.parentId];
      if (par && par !== node){
        par.children.push(node);
        return;
      }
      // 顶层(省/路·无父)→ 按势力分组进 divisions
      var facName;
      if (d.factionId && facById[d.factionId]){
        facName = facById[d.factionId].name || d.factionId;
      } else {
        facName = '未归属';
      }
      if (!byFac[facName]){
        byFac[facName] = { name: facName, divisions: [] };
      }
      byFac[facName].divisions.push(node);
    });
    return byFac;
  }

  // 拷一份 division·剥几何缓存·保所有 gameplay 字段·补 children=[]·与剧本 adminHierarchy 形状对齐
  var GEOMETRY_KEYS = {
    polygon: 1, holes: 1, extraPolygons: 1,
    polygonVids: 1, extraPolygonsVids: 1, holesVids: 1,
    bbox: 1, colorKey: 1, bitmap_color: 1, z_order: 1, area: 1, neighbors: 1
  };
  function divisionForAdmin(d){
    var clone = {};
    for (var k in d){
      if (GEOMETRY_KEYS[k]) continue;
      clone[k] = d[k];
    }
    if (!clone.children) clone.children = [];
    // runtime _peRender* 兼容·div.minxin / div.corruption 优先于 *Local
    if (clone.minxin == null && typeof clone.minxinLocal === 'number') clone.minxin = clone.minxinLocal;
    if (clone.corruption == null && typeof clone.corruptionLocal === 'number') clone.corruption = clone.corruptionLocal;
    return clone;
  }

  // ⑧.1·跑 IntegrationBridge.ensureDivisionData·扩 publicTreasuryInit→publicTreasury·
  //       populationDetail→population·fiscalDetail→fiscal·carryingCapacity→environment·
  //       minxinLocal→minxin·corruptionLocal→corruption·补 fallback 字段
  function _ensureBridgeRanOnAllDivisions(adminHierarchy){
    if (!adminHierarchy) return 0;
    var IB = (typeof window !== 'undefined' && window.IntegrationBridge) || null;
    if (!IB || typeof IB.ensureDivisionData !== 'function'){
      console.warn('[map-editor-to-game] IntegrationBridge 未加载·跳过 ensureDivisionData·publicTreasuryInit 不会扩展');
      return 0;
    }
    var n = 0;
    function walk(nodes){
      if (!nodes || !nodes.length) return;
      nodes.forEach(function(d){
        IB.ensureDivisionData(d, {});
        n++;
        if (d.children && d.children.length) walk(d.children);
      });
    }
    Object.keys(adminHierarchy).forEach(function(facName){
      var fh = adminHierarchy[facName];
      walk(fh && fh.divisions);
    });
    return n;
  }

  // ─── ⑧ 装入 game runtime / scriptData ─────────────────

  function installToGame(gm, opts){
    opts = opts || {};
    var meData = opts.meData || null;          // 若给·同时装 adminHierarchy
    var ah = meData ? convertMapEditorToAdminHierarchy(meData) : null;

    if (typeof window.P !== 'undefined'){
      window.P.map = gm;
      if (ah){
        window.P.adminHierarchy = ah;
        if (typeof window.GM !== 'undefined') window.GM.adminHierarchy = ah;
      }
      var nEnsured = ah ? _ensureBridgeRanOnAllDivisions(ah) : 0;
      console.log('[map-editor-to-game] P.map 已装·' + gm.regions.length + ' regions' +
        (ah ? '·adminHierarchy ' + Object.keys(ah).length + ' 势力·ensureDivisionData ' + nEnsured + ' divs' : ''));
      return { target: 'P.map', gm: gm, adminHierarchy: ah };
    }
    if (typeof window.scriptData !== 'undefined'){
      window.scriptData.map = gm;
      if (ah){
        window.scriptData.adminHierarchy = ah;
        var nEns2 = _ensureBridgeRanOnAllDivisions(ah);
        console.log('[map-editor-to-game] scriptData.map 已装·' + gm.regions.length + ' regions·adminHierarchy ' + Object.keys(ah).length + ' 势力·ensureDivisionData ' + nEns2 + ' divs');
      } else {
        console.log('[map-editor-to-game] scriptData.map 已装·' + gm.regions.length + ' regions');
      }
      return { target: 'scriptData.map', gm: gm, adminHierarchy: ah };
    }
    console.warn('[map-editor-to-game] 未发现 P / scriptData·返回 gm');
    return { target: null, gm: gm, adminHierarchy: ah };
  }

  // ─── expose ─────────────────────────────────────────────

  // ─── ⁹ 反向桥·剧本/游戏格式 → map-editor 原生 divisions (刀２) ──────
  //
  // 输入·scenario { map:{regions[],factions}, adminHierarchy:{[fac]:{divisions[]}} }
  // 输出·{ dynasty, era, title, bitmapWidth, bitmapHeight, divisions[], factions[] }·可直馈 ME.loadMap
  // 几何取 map.regions·gameplay 取 adminHierarchy.divisions(最全)·按 id 合。loadMap 会走 createDivision 补全默认。
  function convertScenarioToMapEditor(scenario){
    scenario = scenario || {};
    var map = scenario.map || scenario.mapData || {};
    var regions = Array.isArray(map.regions) ? map.regions : [];
    var ah = scenario.adminHierarchy;

    // 几何索引·多键登记·官方剧本 div↔region 是松链接(div.name 常等于 region.adminBinding)
    var geomById = {}, logicalById = {};
    function regKey(k, poly){ if (k != null && k !== '' && geomById[k] == null && poly && poly.length >= 3) geomById[k] = poly; }
    regions.forEach(function(r){
      if (!r) return;
      if (r.logicalRegionId === r.id) [r.id,r.mapRegionId,r.name,r.adminBinding].forEach(function(k){if(k)logicalById[k]=r;});
      var poly = regionToPolygon(r);
      if (!poly || poly.length < 3) return;
      regKey(r.id, poly); regKey(r.mapRegionId, poly); regKey(r.name, poly); regKey(r.adminBinding, poly); regKey(r.sourceId, poly);
    });

    var divisions = [];
    var factions = [];
    var facSeen = {};
    function pushFaction(id, name, color){
      if (!id || facSeen[id]) return;
      facSeen[id] = 1;
      factions.push({ id: id, name: name || id, color: color || '' });
    }
    function attachGeom(nd){
      var g = geomById[nd.mapRegionId] || geomById[nd.id] || geomById[nd.name] || geomById[nd.adminBinding];
      if (g && g.length >= 3) nd.polygon = g;
      var lr=logicalById[nd.mapRegionId] || logicalById[nd.id] || logicalById[nd.name];
      if(lr){nd.logicalRegionId=nd.id;nd.holes=JSON.parse(JSON.stringify(lr.holes||[]));
        nd.extraPolygons=JSON.parse(JSON.stringify(lr.extraPolygons||[]));
        nd.extraPolygonHoles=JSON.parse(JSON.stringify(lr.extraPolygonHoles||[]));}
    }
    function walkDivs(divs, facId){
      (divs || []).forEach(function(d){
        if (!d || typeof d !== 'object') return;
        var nd = {};
        for (var k in d){ if (k === 'children') continue; nd[k] = d[k]; }
        attachGeom(nd);
        if (facId && nd.factionId == null) nd.factionId = facId;
        divisions.push(nd);
        if (d.children && d.children.length) walkDivs(d.children, facId);
      });
    }

    if (ah && typeof ah === 'object' && !Array.isArray(ah)){
      Object.keys(ah).forEach(function(facKey){
        var node = ah[facKey] || {};
        var facId = node.factionId || facKey;
        pushFaction(facId, node.factionName || node.name || facKey, node.color);
        walkDivs(node.divisions || [], facId);
      });
    } else if (Array.isArray(ah) && ah.length){
      walkDivs(ah, null);
    } else {
      regions.forEach(function(r){
        var fid = r.factionId || r.ownerKey || r.currentOwnerKey || r.controllerKey || null;
        pushFaction(fid, r.factionName || r.ownerName || fid, r.color || r.factionColor);
        divisions.push({
          id: r.id || r.mapRegionId, name: r.name || '', level: r.level || 'province',
          polygon: regionToPolygon(r), terrain: r.terrain, neighbors: (r.neighbors || []).slice(),
          prosperity: typeof r.prosperity === 'number' ? r.prosperity : (typeof r.development === 'number' ? r.development : undefined),
          minxinLocal: r.minxinLocal, corruptionLocal: r.corruptionLocal, factionId: fid
        });
      });
    }

    enrichFactionColors(factions, map.factions);
    return {
      dynasty: map.dynasty || scenario.dynasty || '',
      era: map.era || scenario.era || '',
      title: map.name || map.title || scenario.name || scenario.title || '剧本地图',
      bitmapWidth: map.width || map.bitmapWidth || 1280,
      bitmapHeight: map.height || map.bitmapHeight || 800,
      divisions: divisions,
      factions: factions
    };
  }

  function enrichFactionColors(factions, mapFactions){
    if (!mapFactions) return;
    var byId = {};
    if (Array.isArray(mapFactions)) mapFactions.forEach(function(f){ if (f && f.id) byId[f.id] = f; });
    else if (typeof mapFactions === 'object') Object.keys(mapFactions).forEach(function(k){ byId[k] = mapFactions[k]; });
    factions.forEach(function(f){
      var src = byId[f.id];
      if (src && !f.color && src.color) f.color = src.color;
      if (src && (!f.name || f.name === f.id) && src.name) f.name = src.name;
    });
  }

  // 几何提取·优先 polygon[[x,y]]·次 points·次 coords(flat)·最后解 SVG path/d (scaffold 的 M/L)
  function regionToPolygon(r){
    if (!r) return [];
    if (Array.isArray(r.polygon) && r.polygon.length >= 3 && Array.isArray(r.polygon[0])) return r.polygon.map(function(p){ return [p[0], p[1]]; });
    if (Array.isArray(r.points) && r.points.length >= 3 && Array.isArray(r.points[0])) return r.points.map(function(p){ return [p[0], p[1]]; });
    if (Array.isArray(r.coords) && r.coords.length >= 6){
      var out = []; for (var i = 0; i + 1 < r.coords.length; i += 2) out.push([r.coords[i], r.coords[i + 1]]); return out;
    }
    var d = r.path || r.d;
    if (typeof d === 'string'){
      var nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      var pts = []; for (var j = 0; j + 1 < nums.length; j += 2) pts.push([nums[j], nums[j + 1]]); return pts;
    }
    return [];
  }

  global.convertMapEditorToGame = convertMapEditorToGame;
  global.convertScenarioToMapEditor = convertScenarioToMapEditor;
  global.convertMapEditorToAdminHierarchy = convertMapEditorToAdminHierarchy;
  global.loadMapEditorJSON = loadMapEditorJSON;
  global.loadMapEditorFile = loadMapEditorFile;
  global.loadMapEditorDialog = loadMapEditorDialog;
  global.installMapEditorToGame = installToGame;

  // 命名空间汇集
  global.MapEditorBridge = {
    convertMapEditorToGame: convertMapEditorToGame,
    convertScenarioToMapEditor: convertScenarioToMapEditor,
    convertMapEditorToAdminHierarchy: convertMapEditorToAdminHierarchy,
    loadMapEditorJSON: loadMapEditorJSON,
    loadMapEditorFile: loadMapEditorFile,
    loadMapEditorDialog: loadMapEditorDialog,
    installToGame: installToGame
  };

})(typeof window !== 'undefined' ? window : this);
