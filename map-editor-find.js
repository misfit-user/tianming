// map-editor-find.js
// Phase 18.1·find / search / goto
// Ctrl+F·浮 search input + result list·实时 filter
// 搜·name / id / level / autonomy.type / autonomy.holder / region / governor
// click 结果·跳 camera + 选·Up / Down 导航·Enter 跳·Esc 关
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[find] core not loaded'); return; }

  var _modal = null;
  var _input = null;
  var _list = null;
  var _hits = [];
  var _hl = 0;
  var _visible = false;

  // ─── overlay UI ────────────────────────────────────────

  function ensureUI(){
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.id = 'me-find';
    _modal.style.cssText = [
      'position:fixed',
      'top:84px',
      'left:50%',
      'transform:translateX(-50%)',
      'width:520px',
      'max-width:92vw',
      'background:linear-gradient(180deg, var(--ink-3), var(--ink-2))',
      'border:1px solid var(--gold-3)',
      'border-radius:var(--rd-3)',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(217,181,102,0.1)',
      'z-index:1000',
      'display:none',
      'font-family:var(--font-serif)',
      'color:var(--paper-1)',
      'overflow:hidden'
    ].join(';');

    var head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; gap:var(--sp-2); padding:var(--sp-3); border-bottom:1px solid var(--bd-1); background:rgba(0,0,0,0.3);';
    head.innerHTML =
      '<span style="color:var(--gold-2); font-size:var(--fs-md); font-weight:var(--fw-sb); letter-spacing:0.1em;">尋</span>';

    _input = document.createElement('input');
    _input.type = 'text';
    _input.placeholder = '搜·name / level / autonomy / region / governor';
    _input.style.cssText = 'flex:1; background:var(--ink-1); border:1px solid var(--bd-1); border-radius:var(--rd-2); color:var(--paper-1); padding:6px 10px; font-size:var(--fs-sm); font-family:var(--font-serif); outline:none;';
    head.appendChild(_input);

    var counter = document.createElement('span');
    counter.id = 'me-find-counter';
    counter.style.cssText = 'color:var(--paper-3); font-size:var(--fs-xs); min-width:50px; text-align:right;';
    counter.textContent = '0';
    head.appendChild(counter);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'me-btn';
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'padding:4px 10px;';
    closeBtn.addEventListener('click', hide);
    head.appendChild(closeBtn);

    _list = document.createElement('div');
    _list.id = 'me-find-list';
    _list.style.cssText = 'max-height:50vh; overflow-y:auto;';

    _modal.appendChild(head);
    _modal.appendChild(_list);
    document.body.appendChild(_modal);

    _input.addEventListener('input', onInput);
    _input.addEventListener('keydown', onKeyDown);
  }

  // ─── show / hide ───────────────────────────────────────

  function show(){
    ensureUI();
    _modal.style.display = 'block';
    _visible = true;
    _input.value = '';
    _hits = [];
    _hl = 0;
    runQuery('');
    setTimeout(function(){ _input.focus(); _input.select(); }, 0);
  }

  function hide(){
    if (_modal) _modal.style.display = 'none';
    _visible = false;
  }

  function toggle(){
    if (_visible) hide();
    else show();
  }

  // ─── query ─────────────────────────────────────────────

  function onInput(){
    runQuery(_input.value);
  }

  function runQuery(q){
    var divs = ME.EDITOR.map && ME.EDITOR.map.divisions || [];
    q = (q || '').trim().toLowerCase();
    var hits;
    if (!q){
      hits = divs.slice(0, 80).map(function(d){ return { d: d, score: 0 }; });
    } else {
      hits = [];
      for (var i = 0; i < divs.length; i++){
        var d = divs[i];
        var s = score(d, q);
        if (s > 0) hits.push({ d: d, score: s });
      }
      hits.sort(function(a, b){ return b.score - a.score; });
      hits = hits.slice(0, 80);
    }
    _hits = hits;
    _hl = 0;
    renderList();
  }

  function score(d, q){
    var s = 0;
    var name = (d.name || '').toLowerCase();
    if (name === q) s += 100;
    else if (name.indexOf(q) === 0) s += 50;
    else if (name.indexOf(q) >= 0) s += 30;

    if ((d.id || '').toLowerCase().indexOf(q) >= 0) s += 20;
    if ((d.level || '').toLowerCase().indexOf(q) >= 0) s += 15;
    if (d.autonomy){
      if ((d.autonomy.type || '').toLowerCase().indexOf(q) >= 0) s += 15;
      if ((d.autonomy.holder || '').toLowerCase().indexOf(q) >= 0) s += 10;
      if ((d.autonomy.suzerain || '').toLowerCase().indexOf(q) >= 0) s += 8;
    }
    if ((d.region || '').toLowerCase().indexOf(q) >= 0) s += 10;
    if ((d.regionType || '').toLowerCase().indexOf(q) >= 0) s += 8;
    if ((d.governor || '').toLowerCase().indexOf(q) >= 0) s += 12;
    if ((d.officialPosition || '').toLowerCase().indexOf(q) >= 0) s += 8;
    return s;
  }

  function renderList(){
    if (!_list) return;
    var counter = document.getElementById('me-find-counter');
    if (counter) counter.textContent = _hits.length + (_hits.length === 80 ? '+' : '');

    if (_hits.length === 0){
      _list.innerHTML = '<div style="padding:var(--sp-4); color:var(--paper-3); text-align:center; font-size:var(--fs-sm);">无匹配·</div>';
      return;
    }

    _list.innerHTML = _hits.map(function(h, i){
      var d = h.d;
      var typ = d.autonomy && d.autonomy.type;
      var typeLabel = typ === 'fanguo' ? '番' : typ === 'fanzhen' ? '镇' : typ === 'jimi' ? '羁' : typ === 'chaogong' ? '贡' : '直';
      var typeColor = typ === 'fanguo' ? '#8a3a2e' : typ === 'fanzhen' ? '#b65a30' : typ === 'jimi' ? '#6a8a3a' : typ === 'chaogong' ? '#7a6a3a' : '#3d4f6a';
      var sel = i === _hl;
      return '<div class="me-find-row" data-i="' + i + '" style="' +
        'padding:8px 14px;' +
        'border-bottom:1px solid var(--bd-1);' +
        'cursor:pointer;' +
        'display:flex;' +
        'align-items:center;' +
        'gap:var(--sp-3);' +
        'background:' + (sel ? 'linear-gradient(90deg, var(--gold-5), transparent)' : 'transparent') + ';' +
        'border-left:3px solid ' + (sel ? 'var(--gold-1)' : 'transparent') + ';' +
      '">' +
        '<span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; background:' + typeColor + '; color:#fff; border-radius:var(--rd-1); font-size:var(--fs-xs); font-weight:var(--fw-sb);">' + typeLabel + '</span>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="color:var(--paper-0); font-size:var(--fs-sm); font-weight:var(--fw-sb);">' + escHtml(d.name || '(无名)') + '</div>' +
          '<div style="color:var(--paper-3); font-size:var(--fs-xxs); margin-top:1px;">' + escHtml((d.level || '') + ' · ' + (d.region || d.regionType || '') + (d.governor ? ' · ' + d.governor : '')) + '</div>' +
        '</div>' +
        '<span style="color:var(--paper-4); font-size:var(--fs-xxs); font-family:monospace;">' + escHtml(d.id || '') + '</span>' +
      '</div>';
    }).join('');

    // bind
    _list.querySelectorAll('.me-find-row').forEach(function(row){
      row.addEventListener('click', function(){
        _hl = parseInt(row.getAttribute('data-i'), 10);
        gotoCurrent();
      });
      row.addEventListener('mouseenter', function(){
        _hl = parseInt(row.getAttribute('data-i'), 10);
        renderList();
      });
    });

    // 滚 highlighted row 进 view
    var hlRow = _list.querySelector('.me-find-row[data-i="' + _hl + '"]');
    if (hlRow) hlRow.scrollIntoView({ block: 'nearest' });
  }

  // ─── nav ───────────────────────────────────────────────

  function onKeyDown(e){
    if (e.key === 'Escape'){
      e.preventDefault();
      hide();
      return;
    }
    if (e.key === 'ArrowDown'){
      e.preventDefault();
      if (_hl < _hits.length - 1){ _hl++; renderList(); }
      return;
    }
    if (e.key === 'ArrowUp'){
      e.preventDefault();
      if (_hl > 0){ _hl--; renderList(); }
      return;
    }
    if (e.key === 'Enter'){
      e.preventDefault();
      gotoCurrent();
      return;
    }
  }

  function gotoCurrent(){
    if (!_hits.length) return;
    var d = _hits[_hl] && _hits[_hl].d;
    if (!d) return;
    gotoDivision(d);
    hide();
  }

  function gotoDivision(d){
    if (!d) return;
    // 选
    ME.EDITOR.selectedIds = [d.id];
    ME.fire('selection-change');
    // 跳 camera·中心 division bbox·保留当前 zoom
    if (d.bbox){
      var cv = ME.EDITOR.canvas;
      var z = ME.EDITOR.camera.zoom;
      var cx = d.bbox.x + d.bbox.w / 2;
      var cy = d.bbox.y + d.bbox.h / 2;
      ME.EDITOR.camera.x = cv.width / 2 - cx * z;
      ME.EDITOR.camera.y = cv.height / 2 - cy * z;
      ME.requestRender();
    }
    if (global.meToast) meToast('跳·' + (d.name || d.id), 'info', 1500);
  }

  // ─── init ──────────────────────────────────────────────

  function init(){
    document.addEventListener('keydown', function(e){
      // Ctrl+F / Cmd+F
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')){
        // 不抢 input 内的 (e.g., 搜框已开 / 字段编辑)
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target !== _input){
          return;  // 允 native 搜
        }
        e.preventDefault();
        toggle();
      }
    });
  }

  // ─── helpers ───────────────────────────────────────────

  function escHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.find = {
    init: init,
    show: show,
    hide: hide,
    toggle: toggle,
    gotoDivision: gotoDivision
  };

})(typeof window !== 'undefined' ? window : this);
