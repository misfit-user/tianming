// map-editor-state.js
// Phase 16.4·DnD 文件载入 + 状态记忆 (localStorage)
//
// DnD·拖 PNG / JSON / GeoJSON 入 canvas·自动识·走对应 import
// 状态记忆·camera (zoom/pan)·activeTool·drawer 收折·last selectedIds·last drawer pane
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[state] core not loaded'); return; }

  var STATE_KEY = 'me.uiState.v1';
  var DEBOUNCE = 600;     // ms·camera saving

  // ════════════════════════════════════════════════════════════════
  // ① DnD·拖文件入 canvas
  // ════════════════════════════════════════════════════════════════

  function initDnD(){
    var stage = document.querySelector('.me-stage');
    var canvas = ME.EDITOR.canvas;
    if (!stage || !canvas) return;

    // 视觉 cue·drag 进入时显
    var hint = document.createElement('div');
    hint.id = 'me-dnd-hint';
    hint.style.cssText = [
      'position:absolute',
      'inset:0',
      'background:rgba(217,181,102,0.08)',
      'border:3px dashed var(--gold-1)',
      'border-radius:var(--rd-3)',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'z-index:1500',
      'font-size:var(--fs-2xl)',
      'color:var(--gold-1)',
      'text-shadow:0 2px 8px rgba(0,0,0,0.6)',
      'pointer-events:none',
      'letter-spacing:0.1em'
    ].join(';');
    hint.textContent = '釋·載入文件';
    stage.appendChild(hint);

    var dragDepth = 0;
    function show(){ hint.style.display = 'flex'; }
    function hide(){ hint.style.display = 'none'; dragDepth = 0; }

    stage.addEventListener('dragenter', function(e){
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') >= 0){
        dragDepth++;
        show();
      }
    });
    stage.addEventListener('dragleave', function(e){
      e.preventDefault();
      dragDepth--;
      if (dragDepth <= 0) hide();
    });
    stage.addEventListener('dragover', function(e){
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    stage.addEventListener('drop', function(e){
      e.preventDefault();
      hide();
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      handleFiles(files);
    });
  }

  function handleFiles(files){
    // 一次只处理 1 个·若多·提示
    if (files.length > 1){
      if (global.meToast) meToast('一次只支持 1 个文件·只处理首个', 'warn');
    }
    var file = files[0];
    if (!file) return;
    var name = (file.name || '').toLowerCase();
    var type = file.type || '';

    if (type.indexOf('image/') === 0 || /\.(png|jpe?g|webp|bmp|gif)$/i.test(name)){
      handleImage(file);
    } else if (type.indexOf('json') >= 0 || /\.json$/i.test(name)){
      handleJSON(file);
    } else {
      if (global.meToast) meToast('不识·' + name + '·只支持 PNG/JPG/JSON', 'error');
    }
  }

  function handleImage(file){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      ME.EDITOR.bitmapImage = img;
      ME.EDITOR.map.bitmapWidth = img.width;
      ME.EDITOR.map.bitmapHeight = img.height;
      ME.EDITOR.map.bitmapUrl = url;
      ME.EDITOR.dirty = true;
      ME.fire('bitmap-loaded');
      ME.requestRender();
      if (ME.fitToContent) ME.fitToContent();
      if (global.meToast) meToast('底图已载·' + img.width + '×' + img.height, 'success');
    };
    img.onerror = function(){
      if (global.meToast) meToast('底图载入失败', 'error');
    };
    img.src = url;
  }

  function handleJSON(file){
    var reader = new FileReader();
    reader.onload = function(e){
      var obj;
      try { obj = JSON.parse(e.target.result); }
      catch(err){
        if (global.meToast) meToast('JSON 解析失败·' + err.message, 'error');
        return;
      }

      if (Array.isArray(obj.divisions)){
        // map editor v2
        if (ME.EDITOR.dirty && !confirm('当前未保存·确认覆盖载入?')) return;
        ME.loadMap(obj);
        if (global.meToast) meToast('剧本已载·' + obj.divisions.length + ' 省', 'success');
      } else if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)){
        // GeoJSON·暂提示·后续可加 converter
        if (global.meToast) meToast('GeoJSON 暂未自动转·请用·载剧·按钮', 'warn');
      } else if (Array.isArray(obj.regions)){
        // game P.map 格式
        if (global.meToast) meToast('P.map 格式·暂不支持反向载·只 game 用', 'warn');
      } else {
        if (global.meToast) meToast('JSON 不识·缺 divisions / features / regions', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ════════════════════════════════════════════════════════════════
  // ② state persistence
  // ════════════════════════════════════════════════════════════════

  function loadState(){
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }
  function saveState(s){
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch(e){}
  }

  function snapshot(){
    var EDITOR = ME.EDITOR;
    return {
      activeTool: EDITOR.activeTool,
      camera: { x: EDITOR.camera.x, y: EDITOR.camera.y, zoom: EDITOR.camera.zoom },
      selectedIds: EDITOR.selectedIds.slice(),
      drawerCollapsed: document.getElementById('right-drawer') &&
                       document.getElementById('right-drawer').classList.contains('collapsed'),
      drawerPane: getCurrentPaneName(),
      timestamp: Date.now()
    };
  }
  function getCurrentPaneName(){
    var act = document.querySelector('.me-dtab.active');
    return act ? act.getAttribute('data-pane') : null;
  }

  var _saveTimer = null;
  function scheduleSave(){
    if (_saveTimer) return;
    _saveTimer = setTimeout(function(){
      _saveTimer = null;
      saveState(snapshot());
    }, DEBOUNCE);
  }

  function restore(){
    var s = loadState();
    if (!s) return;
    var EDITOR = ME.EDITOR;
    if (s.camera){
      EDITOR.camera.x = s.camera.x;
      EDITOR.camera.y = s.camera.y;
      EDITOR.camera.zoom = s.camera.zoom;
    }
    if (s.activeTool && s.activeTool !== 'select'){
      // 延迟·等 binding 完
      setTimeout(function(){
        if (ME.setTool) ME.setTool(s.activeTool);
      }, 50);
    }
    if (Array.isArray(s.selectedIds) && s.selectedIds.length){
      // 验·只保留实存 div
      var valid = s.selectedIds.filter(function(id){
        return EDITOR.map.divisions.some(function(d){ return d.id === id; });
      });
      if (valid.length){
        EDITOR.selectedIds = valid;
        ME.fire('selection-change');
      }
    }
    if (s.drawerCollapsed){
      var drawer = document.getElementById('right-drawer');
      if (drawer){
        drawer.classList.add('collapsed');
        var icon = document.getElementById('drawer-toggle-icon');
        if (icon) icon.textContent = '‹';
      }
    }
    if (s.drawerPane){
      setTimeout(function(){
        var tab = document.querySelector('.me-dtab[data-pane="' + s.drawerPane + '"]');
        if (tab) tab.click();
      }, 80);
    }
    ME.requestRender();
  }

  // ════════════════════════════════════════════════════════════════
  // ③ hook events
  // ════════════════════════════════════════════════════════════════

  function bindHooks(){
    ME.on('tool-change', scheduleSave);
    ME.on('selection-change', scheduleSave);
    ME.on('mutation', scheduleSave);

    // camera 没 event·polling
    var lastCam = { x: NaN, y: NaN, zoom: NaN };
    setInterval(function(){
      var c = ME.EDITOR.camera;
      if (c.x !== lastCam.x || c.y !== lastCam.y || c.zoom !== lastCam.zoom){
        lastCam.x = c.x; lastCam.y = c.y; lastCam.zoom = c.zoom;
        scheduleSave();
      }
    }, 1000);

    // drawer toggle / pane change·watch DOM
    var drawer = document.getElementById('right-drawer');
    if (drawer){
      var lastClass = drawer.className;
      setInterval(function(){
        if (drawer.className !== lastClass){
          lastClass = drawer.className;
          scheduleSave();
        }
      }, 600);
    }
    document.querySelectorAll('.me-dtab').forEach(function(t){
      t.addEventListener('click', scheduleSave);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // ④ init·调时机
  // ════════════════════════════════════════════════════════════════

  function init(){
    initDnD();
    bindHooks();
    // restore·延迟 to ensure map loaded
    setTimeout(restore, 200);
  }

  // ════════════════════════════════════════════════════════════════
  // expose
  // ════════════════════════════════════════════════════════════════

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.state = {
    init: init,
    snapshot: snapshot,
    saveState: saveState,
    loadState: loadState,
    restore: restore,
    handleFiles: handleFiles
  };

})(typeof window !== 'undefined' ? window : this);
