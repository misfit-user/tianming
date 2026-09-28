// Local, generated map assets. Model inputs select catalog IDs, never URLs or host paths.
(function(root) {
  'use strict';
  var ME=root.TM && root.TM.MapEditor;if(!ME)return;
  var script=root.document && root.document.currentScript;
  var base=new URL('data/maps/scenario-library/',script && script.src || root.location.href).href;
  var catalog=null,cached=null;
  function fail(message) {throw new Error(message);}
  function aborted(signal) {if(signal && signal.aborted)fail('地图载入已停止');}
  async function bytes(url,signal) {
    aborted(signal);
    var controller=new AbortController(),timer=setTimeout(function() {controller.abort();},45000);
    var cancel=function() {controller.abort();};if(signal)signal.addEventListener('abort',cancel,{once:true});
    try {
      if(new URL(url).protocol==='file:' && root.XMLHttpRequest) {
        return await new Promise(function(resolve,reject) {
          var xhr=new root.XMLHttpRequest(),done=false;
          function finish(error,value) {if(done)return;done=true;controller.signal.removeEventListener('abort',stop);error?reject(error):resolve(value);}
          function stop() {xhr.abort();finish(new Error('地图载入已停止或超时'));}
          controller.signal.addEventListener('abort',stop,{once:true});
          xhr.open('GET',url);xhr.responseType='arraybuffer';xhr.onload=function() {
            if((xhr.status===0 || xhr.status===200)&&xhr.response)finish(null,xhr.response);else finish(new Error('无法读取地图资产'));
          };xhr.onerror=function() {finish(new Error('无法读取本地地图资产'));};xhr.send();
        });
      }
      var response=await root.fetch(url,{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)fail('地图资产读取失败：HTTP '+response.status);
      return await response.arrayBuffer();
    } finally {clearTimeout(timer);if(signal)signal.removeEventListener('abort',cancel);}
  }
  function decode(buffer) {if(buffer.byteLength>64*1024*1024)fail('地图资产超过读取上限');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}
  async function index(signal) {
    aborted(signal);if(catalog)return catalog;
    var value=decode(await bytes(new URL('index.json',base).href,signal));aborted(signal);
    if(value.schemaVersion!=='tm-map-editor-library-index/1'||!Array.isArray(value.entries))fail('剧本地图目录格式不匹配');
    var ids=new Set();value.entries.forEach(function(e) {
      if(!/^[a-zA-Z0-9_-]+$/.test(e.id)||e.filename!==e.id+'.json'||ids.has(e.id)||!/^[a-f0-9]{64}$/.test(e.sha256))fail('剧本地图目录包含无效条目');ids.add(e.id);
    });catalog=value;return value;
  }
  async function list(query,signal) {
    var data=await index(signal),q=String(query || '').trim().toLowerCase();
    return data.entries.filter(function(e) {return !q || (e.name+' '+e.id+' '+e.mapName+' '+e.era).toLowerCase().indexOf(q)>=0;})
      .map(function(e) {return {id:e.id,name:e.name,mapName:e.mapName,dynasty:e.dynasty,levels:e.levels,counts:e.counts,source:e.source.path,sourceSha256:e.source.sha256};});
  }
  function hydrate(map) {
    map=Object.assign({},map,ME.createMapState(map));
    map.divisions=map.divisions.map(function(d) {var row=Object.assign({},d,ME.createDivision(d));ME.recomputeDerived(row);return row;});return map;
  }
  async function load(id,tier,signal) {
    var data=await index(signal),entry=data.entries.find(function(e) {return e.id===id;});
    if(!entry)fail('剧本不在地图目录中，请先使用 listScenarioMaps');
    if(entry.levels.indexOf(tier)<0)fail('该剧本没有请求的地图层级');
    var bundle;
    if(cached && cached.sha256===entry.sha256)bundle=cached.bundle;
    else {
      var buffer=await bytes(new URL(entry.filename,base).href,signal);aborted(signal);
      if(buffer.byteLength!==entry.bytes)fail('地图资产字节数与目录不符');
      if(!root.crypto || !root.crypto.subtle)fail('当前环境无法校验地图资产');
      var hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',buffer))).map(function(n) {return n.toString(16).padStart(2,'0');}).join('');
      if(hash!==entry.sha256)fail('地图资产摘要与目录不符，请重新同步地图目录');
      bundle=decode(buffer);aborted(signal);
      if(bundle.source.id!==id||bundle.source.sha256!==entry.source.sha256)fail('地图来源与目录不符');
      cached={sha256:entry.sha256,bundle:bundle};
    }
    var dynasty=ME.dynasty.list().find(function(d) {return d.id===entry.dynasty || d.label===entry.dynasty;});
    var map=ME.scenarioGeometry.materialize(bundle,tier,dynasty?dynasty.id:undefined);
    aborted(signal);return hydrate(map);
  }
  function refresh(map) {
    if(!map.meta || !map.meta.scenarioMap || map.meta.scenarioMap.tier!=='all')return map;
    return hydrate(ME.scenarioGeometry.rebuild(map));
  }
  function showLayer(level) {
    var meta=ME.EDITOR.map.meta && ME.EDITOR.map.meta.scenarioMap;
    if(!meta || !meta.levels.some(function(tier) {return ME.scenarioGeometry.levels[tier]===level;}))fail('当前地图没有该层级');
    ME.EDITOR.mapLayer=level;ME.EDITOR._visibleCache=null;ME.selectClear();ME.requestRender();ME.fire('map-layer-change');
  }
  ME.scenarioLibrary={list:list,load:load,refresh:refresh,hydrate:hydrate,showLayer:showLayer};

  function mount() {
    var anchor=document.getElementById('export-format');if(!anchor)return;
    var select=document.createElement('select');select.id='me-scenario-map-layer';select.className='me-tb-select';
    select.title='当前地图层级';select.setAttribute('aria-label','当前地图层级');select.hidden=true;anchor.insertAdjacentElement('afterend',select);
    function sync() {
      var meta=ME.EDITOR.map.meta && ME.EDITOR.map.meta.scenarioMap;select.hidden=!meta;
      if(!meta)return;
      select.textContent='';meta.levels.forEach(function(tier) {var option=document.createElement('option');option.value=ME.scenarioGeometry.levels[tier];option.textContent=({realm:'天下',region:'省道',prefecture:'府州'})[tier];select.appendChild(option);});
      var allowed=meta.levels.map(function(tier) {return ME.scenarioGeometry.levels[tier];});
      if(allowed.indexOf(ME.EDITOR.mapLayer)<0)ME.EDITOR.mapLayer=meta.defaultLevel;
      select.value=ME.EDITOR.mapLayer;
      var dynastySelect=document.getElementById('dynasty-select');if(dynastySelect)dynastySelect.value=ME.EDITOR.map.dynasty;
    }
    select.onchange=function() {showLayer(select.value);};
    ['map-loaded','mutation','map-layer-change'].forEach(function(evt) {ME.on(evt,sync);});sync();
  }
  if(root.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();}
})(typeof window!=='undefined'?window:globalThis);
