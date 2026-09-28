// Native map capability pack for the existing Guoshi authoring loop.
// Tools edit an isolated native snapshot; the host commits one undoable command.
(function (root) {
  'use strict';
  var TM = root.TM, ME = TM && TM.MapEditor;
  if (!ME || !TM.AuthoringExtensions) return;
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var fields = {
    name: 'string', description: 'string', officialPosition: 'string', governor: 'string',
    terrain: 'string', specialResources: 'string', factionId: 'string', prosperity: 'number',
    taxLevel: 'string', isCapital: 'boolean', isFrontier: 'boolean', isJunDi: 'boolean',
    isTradePort: 'boolean', isHistoric: 'boolean'
  };
  var skill = [
    '你是天命地图编辑器中的国师。当前文档是原生地图，nativeMap.divisions 是唯一编辑对象。',
    '玩家指定天启、绍宋等剧本地图时，先 listScenarioMaps(query) 查真实剧本 ID，再 loadScenarioMap(scenarioId,tier)。tier=all 是天下→省道→府州三级；region 只取省道，prefecture 只取府州，realm 只取天下。不要把这些操作替换为口头说明。',
    '载入后在同一轮继续 mapEditorOverview 查新地图的 ID，再改名或调整属性，最后 finish 一次应用。省道按真实成员和归属聚合；同名跨势力分组须用 ID 区分。',
    '先 mapEditorOverview 检索并取得稳定 ID，再 mapEditorRead 读目标；同名地块不得猜选。',
    'mapEditorEdit 可批量改名、势力归属和属性。势力只能使用地图现有 factionId；清空用空字符串。',
    '边界调整先读取对应环的顶点和编号，再 mapEditorMoveVertex；坐标单位是地图像素，共享顶点会联动相邻地块。',
    '不要凭空编造地理坐标、历史名称或事实；不确定时提问。无法完成的部分如实说明。',
    '这些工具修改本次候选。检查结果后 finish；成功后宿主自动写入当前地图，整次指令可撤销。',
    'mapEditorFocus 仅选择和定位地块。地图保存、导出和返回剧本仍由编辑器现有按钮完成。',
    '仅使用本轮提供的地图工具。此入口不编辑人物、剧本行政账或运行中的游戏。'
  ].join('\n');

  function fail(message) { throw new Error(message); }
  function mapOf(draft) {
    var m = draft && draft.nativeMap;
    if (!m || !Array.isArray(m.divisions)) fail('没有原生地图');
    return m;
  }
  function find(m, id) {
    if (typeof id !== 'string' || !id) fail('请先检索并使用地块的稳定 ID');
    var matches = m.divisions.filter(function (d) { return d.id === id; });
    if (matches.length !== 1) fail('地块 ID 不存在或不唯一：' + id);
    return matches[0];
  }
  function row(d) {
    return { id: d.id, name: d.name, level: d.level, factionId: d.factionId || '',
      terrain: d.terrain, parentId: d.parentId || '', sourceCircuitId:d.sourceCircuitId || '', memberCount:(d.sourceRegionIds || []).length, vertices: (d.polygon || []).length };
  }
  function page(input) {
    var offset = input.offset == null ? 0 : input.offset, limit = input.limit == null ? 60 : input.limit;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200)
      fail('offset 须为非负整数，limit 须为 1 到 200');
    return { offset: offset, limit: limit };
  }
  function ringOf(d, input) {
    var kind = input.ring || 'polygon', ri = input.ringIndex == null ? 0 : input.ringIndex;
    if (!Number.isInteger(ri) || ri < 0) fail('ringIndex 须为非负整数');
    var ring, vids;
    if (kind === 'polygon') { if (ri !== 0) fail('主轮廓的 ringIndex 为 0'); ring = d.polygon; vids = d.polygonVids; }
    else if (kind === 'holes' || kind === 'extraPolygons') {
      ring = (d[kind] || [])[ri]; vids = (d[kind + 'Vids'] || [])[ri];
    } else fail('ring 只能是 polygon、holes 或 extraPolygons');
    if (!Array.isArray(ring)) fail('指定轮廓不存在');
    return { points: ring, vids: vids || [], kind: kind, ringIndex: ri };
  }
  function rings(d) { return [d.polygon || []].concat(d.holes || [], d.extraPolygons || [],[].concat.apply([],(d.extraPolygonHoles || []))); }
  function cross(a, b, c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
  function onSegment(a, b, c) {
    return Math.abs(cross(a,b,c)) < 1e-8 && c[0] >= Math.min(a[0],b[0])-1e-8 && c[0] <= Math.max(a[0],b[0])+1e-8
      && c[1] >= Math.min(a[1],b[1])-1e-8 && c[1] <= Math.max(a[1],b[1])+1e-8;
  }
  function intersects(a,b,c,d) {
    return (cross(a,b,c)*cross(a,b,d) < 0 && cross(c,d,a)*cross(c,d,b) < 0)
      || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
  }
  function checkRing(input) {
    var p = input.slice();
    if (p.length > 1 && JSON.stringify(p[0]) === JSON.stringify(p[p.length-1])) p.pop();
    if (p.length < 3 || p.length > 2000) fail('边界检查支持 3 到 2000 个顶点；请先简化过密轮廓');
    if (p.some(function (v) { return !Array.isArray(v) || v.length !== 2 || v.some(function (n) { return typeof n !== 'number' || !Number.isFinite(n); }); })) fail('轮廓含无效坐标');
    if (ME.polygonArea(p) <= 1e-8) fail('边界修改会使轮廓面积为零');
    for (var i=0; i<p.length; i++) {
      var a=p[i], b=p[(i+1)%p.length];
      if (JSON.stringify(a) === JSON.stringify(b)) fail('边界修改会重合相邻顶点');
      for (var j=i+1; j<p.length; j++) {
        if ((i+1)%p.length === j || (j+1)%p.length === i) continue;
        if (intersects(a,b,p[j],p[(j+1)%p.length])) fail('边界修改会使轮廓自相交');
      }
    }
  }
  function checkDivision(d) {
    rings(d).forEach(checkRing);
    (d.holes || []).forEach(function (hole) {
      if (hole.some(function(p) { return !ME.pointInPolygon(p[0],p[1],d.polygon); })) fail('修改会使孔洞离开主轮廓');
      for(var i=0;i<hole.length;i++) for(var j=0;j<d.polygon.length;j++)
        if(intersects(hole[i],hole[(i+1)%hole.length],d.polygon[j],d.polygon[(j+1)%d.polygon.length])) fail('孔洞与外边界相交');
    });
  }
  function assertContext(ctx) {
    if (!ctx || ctx.signal && ctx.signal.aborted) fail('本次操作已停止');
    if (ctx.document !== ME.EDITOR.map) fail('地图文档已切换，请重新读取');
  }
  function writeContext(ctx) {
    assertContext(ctx);
    if (ctx.readOnly) fail('本次为仅查看模式');
  }
  function patchMap(m, edits) {
    if (!Array.isArray(edits) || !edits.length || edits.length > 100) fail('每批提供 1 到 100 项修改');
    var next = clone(m), seen = new Set(), regroup=false;
    edits.forEach(function (e) {
      if (!e || seen.has(e.id)) fail('同一批次地块 ID 不得重复');
      seen.add(e.id);
      var d = find(next,e.id), patch = e.patch;
      if (!patch || Array.isArray(patch) || typeof patch !== 'object' || !Object.keys(patch).length) fail('patch 须包含实际修改字段');
      Object.keys(patch).forEach(function (k) {
        var v = patch[k];
        if (!own(fields,k) || typeof v !== fields[k]) fail('不支持的字段或类型：' + k);
        if (typeof v === 'string' && v.length > (k === 'description' ? 4000 : 200)) fail('字段文字过长：' + k);
        if (k === 'name' && !v.trim()) fail('地块名称不能为空');
        if (k === 'factionId' && v && !(next.factions || []).some(function(f) { return f.id === v; })) fail('势力 ID 不存在：' + v);
        if (k === 'prosperity' && (!Number.isFinite(v) || v < 0 || v > 100)) fail('繁荣须在 0 到 100 之间');
        if (k === 'taxLevel' && ['轻','中','重'].indexOf(v) < 0) fail('税级只能是轻、中、重');
        if(k === 'factionId' && next.meta && next.meta.scenarioMap && next.meta.scenarioMap.tier==='all' && d.factionId!==v) {
          if(!v)fail('三级地图需保留明确归属，请选择已有势力');
          var members=new Set(d.sourceRegionIds || [d.id]);
          next.divisions.forEach(function(leaf) {if(leaf.layerRole==='prefecture'&&members.has(leaf.id))leaf.factionId=v;});regroup=true;
        }
        if(k === 'name' && d.layerRole==='realm') {
          var faction=next.factions.find(function(f) {return f.id===d.factionId;});if(faction)faction.name=v;
        }
        d[k] = k === 'factionId' && !v ? null : v;
      });
    });
    return regroup && ME.scenarioLibrary?ME.scenarioLibrary.refresh(next):next;
  }
  function moveVertex(m, input) {
    if (!Number.isInteger(input.index) || input.index < 0) fail('index 须为非负整数');
    if (![input.x,input.y].every(function(n) { return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7; })) fail('坐标须为有效地图像素');
    var next=clone(m), d=find(next,input.id), ring=ringOf(d,input), previous=ring.points[input.index];
    if(next.meta && next.meta.scenarioMap && next.meta.scenarioMap.tier==='all' && d.layerRole!=='prefecture')fail('上层边界由府州组成，请调整府州顶点；如需独立编辑省界，可载入省道单层副本');
    if (!previous) fail('顶点编号超出范围');
    var affected=[], vid=ring.vids[input.index];
    if (next.topology && next.topology.enabled) {
      if (!vid || !ME.topology || !ME.topology.moveVertex(next,vid,input.x,input.y)) fail('共享顶点缺失，未修改地图');
      next.divisions.forEach(function (part) {
        if(next.meta && next.meta.scenarioMap && next.meta.scenarioMap.tier==='all' && part.layerRole!=='prefecture')return;
        var ids=(part.polygonVids || []).concat.apply(part.polygonVids || [], (part.holesVids || []).concat(part.extraPolygonsVids || []));
        if (ids.indexOf(vid) >= 0) { ME.topology.rebuildDivisionCoords(next,part); affected.push(part); }
      });
    } else {
      next.divisions.forEach(function (part) {
        if(next.meta && next.meta.scenarioMap && next.meta.scenarioMap.tier==='all' && part.layerRole!=='prefecture')return;
        var changed=false;
        rings(part).forEach(function (points) { points.forEach(function(p,i) {
          if (p[0] === previous[0] && p[1] === previous[1]) { points[i]=[input.x,input.y]; changed=true; }
        }); });
        if(changed) affected.push(part);
      });
    }
    affected.forEach(function(part) { checkDivision(part); ME.recomputeDerived(part); });
    return { map:ME.scenarioLibrary?ME.scenarioLibrary.refresh(next):next, affected:affected.map(row) };
  }
  function focus(id) {
    var d=find(ME.EDITOR.map,id), b=ME.polygonBBox(d.polygon || []), c=ME.EDITOR.canvas;
    if(ME.scenarioLibrary && ME.EDITOR.map.meta && ME.EDITOR.map.meta.scenarioMap)ME.scenarioLibrary.showLayer(d.level);
    ME.selectOne(id);
    if (c && b) {
      var box=c.getBoundingClientRect(), mid=ME.polygonCentroid(d.polygon);
      ME.EDITOR.camera.x=box.width/2-mid[0]*ME.EDITOR.camera.zoom;
      ME.EDITOR.camera.y=box.height/2-mid[1]*ME.EDITOR.camera.zoom;
      ME.fire('camera-change');
    }
    ME.requestRender();
    return {ok:true,selected:row(d)};
  }
  function dispatch(name,input,draft,ctx) {
    try {
      assertContext(ctx); input=input || {};
      var m=mapOf(draft), p, list, d, r;
      if(name === 'listScenarioMaps') {
        if(!ME.scenarioLibrary)return {ok:false,reason:'剧本地图目录未加载'};
        return ME.scenarioLibrary.list(input.query,ctx.signal).then(function(entries) {assertContext(ctx);return {ok:true,maps:entries};}).catch(function(e) {return {ok:false,reason:e.message};});
      }
      if(name === 'loadScenarioMap') {
        writeContext(ctx);if(!ME.scenarioLibrary)return {ok:false,reason:'剧本地图目录未加载'};
        return ME.scenarioLibrary.load(input.scenarioId,input.tier || 'all',ctx.signal).then(function(map) {
          assertContext(ctx);draft.nativeMap=map;draft.importedMap=true;delete draft.focusRegionId;ctx.selectedIds=[];
          return {ok:true,changed:true,title:map.title,source:map.meta.scenarioMap.source,counts:map.meta.scenarioMap.counts,tier:map.meta.scenarioMap.tier,note:'已载入本次候选，可继续查找地块并改名；finish 后一次应用'};
        }).catch(function(e) {return {ok:false,reason:e.message};});
      }
      if(name === 'mapEditorOverview') {
        p=page(input); var q=String(input.query || '').toLowerCase();
        list=m.divisions.filter(function(v) { return (!input.level || v.level===input.level) && (!input.selectedOnly || ctx.selectedIds.indexOf(v.id)>=0) && (!q || String(v.name+' '+v.id).toLowerCase().indexOf(q)>=0); });
        return {ok:true,title:m.title,era:m.era,coordinateSystem:'map-pixels',total:list.length,offset:p.offset,
          nextOffset:p.offset+p.limit<list.length?p.offset+p.limit:null,selectedIds:ctx.selectedIds,
          factions:(m.factions || []).map(function(f) { return {id:f.id,name:f.name}; }),divisions:list.slice(p.offset,p.offset+p.limit).map(row)};
      }
      if(name === 'mapEditorRead') {
        d=find(m,input.id); r=ringOf(d,input); p=page(input); var data=row(d);
        Object.keys(fields).forEach(function(k) { if(own(d,k))data[k]=d[k]; });
        return {ok:true,division:data,ring:r.kind,ringIndex:r.ringIndex,total:r.points.length,
          holes:(d.holes || []).length,extraPolygons:(d.extraPolygons || []).length,
          nextOffset:p.offset+p.limit<r.points.length?p.offset+p.limit:null,
          vertices:r.points.slice(p.offset,p.offset+p.limit).map(function(v,i) { return {index:p.offset+i,x:v[0],y:v[1],vertexId:r.vids[p.offset+i] || null}; })};
      }
      if(name === 'mapEditorFocus') {
        if(draft.importedMap){find(m,input.id);draft.focusRegionId=input.id;return {ok:true,queued:true,note:'地图应用后定位此地块'};}
        return focus(input.id);
      }
      writeContext(ctx);
      if(name === 'mapEditorEdit') {
        var edited=patchMap(m,input.edits); draft.nativeMap=edited;
        return {ok:true,changed:JSON.stringify(m)!==JSON.stringify(edited),divisions:input.edits.map(function(e) {var d=edited.divisions.find(function(v) {return v.id===e.id;});return d?row(d):{previousId:e.id,regrouped:true,note:'归属变化已重算上层分组，请重新检索 ID'};})};
      }
      if(name === 'mapEditorMoveVertex') {
        var moved=moveVertex(m,input); draft.nativeMap=moved.map;
        return {ok:true,changed:JSON.stringify(m)!==JSON.stringify(moved.map),affected:moved.affected};
      }
      fail('未知地图工具');
    } catch(e) { return {ok:false,reason:e.message}; }
  }
  var patchProperties={}; Object.keys(fields).forEach(function(k) {patchProperties[k]={type:fields[k]};});
  var locationFields={id:{type:'string'},ring:{type:'string',enum:['polygon','holes','extraPolygons']},ringIndex:{type:'integer',minimum:0}};
  function spec(name,effect,description,properties,required) {
    return {name:name,effect:effect,description:description,parameters:{type:'object',properties:properties,required:required || [],additionalProperties:false}};
  }
  var pagination={offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:200}};
  var specs=[
    spec('listScenarioMaps','read','按名称检索可复用剧本地图，返回稳定剧本 ID、来源及层级。',{query:{type:'string'}}),
    spec('loadScenarioMap','draft-write','载入指定剧本的完整三级地图或单层地图副本，可在同一轮继续改名。',{scenarioId:{type:'string'},tier:{type:'string',enum:['all','realm','region','prefecture']}},['scenarioId','tier']),
    spec('mapEditorOverview','read','分页检索当前地图及选中地块，返回稳定 ID、势力清单；可按层级筛选。',Object.assign({query:{type:'string'},selectedOnly:{type:'boolean'},level:{type:'string',enum:['country','province','prefecture']}},pagination)),
    spec('mapEditorRead','read','按稳定 ID 读取地块属性及一段轮廓顶点；index 为零起点。',Object.assign({},locationFields,pagination),['id']),
    spec('mapEditorFocus','control','在画布选中并定位指定地块。',{id:{type:'string'}},['id']),
    spec('mapEditorEdit','draft-write','原子批量修改地块属性，保留几何、层级、栅格及其他字段。',{edits:{type:'array',minItems:1,maxItems:100,items:{type:'object',properties:{id:{type:'string'},patch:{type:'object',properties:patchProperties,additionalProperties:false}},required:['id','patch'],additionalProperties:false}}},['edits']),
    spec('mapEditorMoveVertex','draft-write','移动已读取的边界顶点，共享顶点同步；返回全部受影响地块。',Object.assign({},locationFields,{index:{type:'integer',minimum:0},x:{type:'number'},y:{type:'number'}}),['id','index','x','y'])
  ];
  var api={specs:specs,dispatch:dispatch,skill:skill,clone:clone,focus:focus,
    capture:function(options) {return Object.assign({document:ME.EDITOR.map,selectedIds:(ME.EDITOR.selectedIds || []).slice()},options);},
    writeTargets:function(name,input) {
      if(name === 'loadScenarioMap')return ['scenario-map-import'];
      if(name === 'mapEditorEdit') return (input.edits || []).map(function(e) {return 'map-division:'+e.id;});
      if(name === 'mapEditorMoveVertex') return ['map-vertex:'+input.id+':'+(input.ring || 'polygon')+':'+(input.ringIndex || 0)+':'+input.index];
      return null;
    }
  };
  ME.agentTools=api;
  TM.AuthoringExtensions.registerWorkbench(api);
})(typeof window !== 'undefined' ? window : globalThis);
