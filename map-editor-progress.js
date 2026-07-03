// map-editor-progress.js
// Phase 17.5·进度 overlay·共用 modal·long ops 用
// 用·检邻 / AI 填 / 大量批 / voronoi 生
// open({title, message, total, cancellable}) → handle
// .update(current, message)
// .close()
// .cancelled   — bool·user 按了 cancel
//
// 也·tracks·arealinks staleness·polygon mutation 后·debounce 提示 rerun
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[progress] core not loaded'); return; }

  var _modal = null;
  var _bar = null;
  var _msgEl = null;
  var _titleEl = null;
  var _pctEl = null;
  var _cancelBtn = null;
  var _state = null;

  // ─── overlay UI ────────────────────────────────────────

  function ensureModal(){
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.id = 'me-progress-modal';
    _modal.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.5)',
      'backdrop-filter:blur(2px)',
      'z-index:1100',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'font-family:var(--font-serif)'
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'min-width:380px',
      'max-width:520px',
      'background:linear-gradient(180deg, var(--ink-3), var(--ink-2))',
      'border:1px solid var(--gold-3)',
      'border-radius:var(--rd-3)',
      'box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(217,181,102,0.1)',
      'padding:var(--sp-5)',
      'color:var(--paper-1)'
    ].join(';');

    _titleEl = document.createElement('div');
    _titleEl.style.cssText = 'color:var(--gold-1); font-size:var(--fs-lg); font-weight:var(--fw-sb); letter-spacing:0.1em; margin-bottom:var(--sp-2);';

    _msgEl = document.createElement('div');
    _msgEl.style.cssText = 'color:var(--paper-2); font-size:var(--fs-sm); margin-bottom:var(--sp-3); min-height:1.4em;';

    var barWrap = document.createElement('div');
    barWrap.style.cssText = 'position:relative; height:14px; background:var(--ink-1); border:1px solid var(--bd-1); border-radius:var(--rd-2); overflow:hidden; margin-bottom:var(--sp-2);';

    _bar = document.createElement('div');
    _bar.style.cssText = 'height:100%; width:0%; background:linear-gradient(90deg, var(--gold-3), var(--gold-1)); transition:width 0.18s ease-out; box-shadow:0 0 8px rgba(217,181,102,0.4);';
    barWrap.appendChild(_bar);

    _pctEl = document.createElement('div');
    _pctEl.style.cssText = 'text-align:right; color:var(--gold-2); font-size:var(--fs-xs); margin-bottom:var(--sp-3);';
    _pctEl.textContent = '0%';

    _cancelBtn = document.createElement('button');
    _cancelBtn.className = 'me-btn';
    _cancelBtn.textContent = '取消';
    _cancelBtn.style.cssText = 'display:none; margin-left:auto;';
    _cancelBtn.addEventListener('click', function(){
      if (_state){
        _state.cancelled = true;
        _msgEl.textContent = '取消中·等当前步完...';
        _cancelBtn.disabled = true;
      }
    });

    var foot = document.createElement('div');
    foot.style.cssText = 'display:flex;';
    foot.appendChild(_cancelBtn);

    card.appendChild(_titleEl);
    card.appendChild(_msgEl);
    card.appendChild(barWrap);
    card.appendChild(_pctEl);
    card.appendChild(foot);
    _modal.appendChild(card);
    document.body.appendChild(_modal);
  }

  // ─── public·open / update / close ──────────────────────

  function open(opts){
    opts = opts || {};
    ensureModal();
    _state = {
      title: opts.title || '处理中',
      message: opts.message || '',
      total: opts.total || 0,
      current: 0,
      cancellable: !!opts.cancellable,
      cancelled: false
    };
    _titleEl.textContent = _state.title;
    _msgEl.textContent = _state.message;
    _bar.style.width = (_state.total > 0 ? '0' : '0') + '%';
    _pctEl.textContent = _state.total > 0 ? '0%' : '··';
    _cancelBtn.style.display = _state.cancellable ? 'inline-block' : 'none';
    _cancelBtn.disabled = false;
    _modal.style.display = 'flex';
    return _state;
  }

  function update(current, message){
    if (!_state) return;
    if (typeof current === 'number') _state.current = current;
    if (typeof message === 'string') _msgEl.textContent = message;
    if (_state.total > 0){
      var pct = Math.min(100, Math.max(0, (_state.current / _state.total) * 100));
      _bar.style.width = pct.toFixed(1) + '%';
      _pctEl.textContent = Math.round(pct) + '%·' + _state.current + ' / ' + _state.total;
    } else {
      _pctEl.textContent = _state.current ? String(_state.current) : '··';
    }
  }

  function close(){
    if (_modal) _modal.style.display = 'none';
    _state = null;
  }

  function isCancelled(){
    return _state && _state.cancelled;
  }

  // ─── arealinks staleness tracking ───────────────────────

  var _staleTimer = null;
  var _staleToastShown = false;

  function markStale(){
    if (!ME.EDITOR || !ME.EDITOR.map) return;
    ME.EDITOR.map._areaLinksStale = true;
    if (_staleTimer) clearTimeout(_staleTimer);
    _staleTimer = setTimeout(function(){
      if (!ME.EDITOR.map._areaLinksStale) return;
      if (_staleToastShown) return;
      _staleToastShown = true;
      showStaleToast();
    }, 3000);  // 3s 静止后提示
  }

  function showStaleToast(){
    var t = document.createElement('div');
    t.id = 'me-stale-toast';
    t.style.cssText = [
      'position:fixed',
      'right:var(--sp-4)',
      'bottom:120px',
      'background:linear-gradient(180deg, var(--ink-3), var(--ink-2))',
      'border:1px solid var(--gold-3)',
      'border-left:3px solid var(--gold-1)',
      'border-radius:var(--rd-3)',
      'padding:var(--sp-3) var(--sp-4)',
      'box-shadow:var(--sh-2)',
      'color:var(--paper-1)',
      'font-family:var(--font-serif)',
      'font-size:var(--fs-sm)',
      'z-index:850',
      'display:flex',
      'align-items:center',
      'gap:var(--sp-3)',
      'cursor:pointer',
      'transition:transform var(--t-spring), opacity var(--t-default)',
      'opacity:0',
      'transform:translateX(100%)'
    ].join(';');
    t.innerHTML =
      '<span style="color:var(--gold-1); font-size:var(--fs-md);">⌒</span>' +
      '<div>' +
        '<div style="color:var(--gold-2); font-weight:var(--fw-sb);">邻 待重算</div>' +
        '<div style="color:var(--paper-3); font-size:var(--fs-xs); margin-top:2px;">点·重算·或继续编辑</div>' +
      '</div>' +
      '<button class="me-btn me-btn-warn" style="margin-left:var(--sp-2);">N</button>';
    document.body.appendChild(t);
    requestAnimationFrame(function(){
      t.style.transform = 'translateX(0)';
      t.style.opacity = '1';
    });
    var dismiss = function(){
      t.style.transform = 'translateX(120%)';
      t.style.opacity = '0';
      setTimeout(function(){ t.remove(); _staleToastShown = false; }, 320);
    };
    t.addEventListener('click', function(){
      runRecompute();
      dismiss();
    });
    setTimeout(function(){
      if (document.body.contains(t)) dismiss();
    }, 8000);
  }

  function runRecompute(){
    var al = TM.MapEditor.arealinks;
    if (!al || !al.recomputeFromNeighbors){
      if (global.meToast) meToast('arealinks 未加载', 'error');
      return;
    }
    open({ title: '检邻', message: '重建 adjacency·扫所有 polygon 对', total: 0 });
    // 让·UI 渲一帧再开扫
    setTimeout(function(){
      try {
        var r = al.recomputeFromNeighbors({ strategy: 'preserve' });
        ME.EDITOR.map._areaLinksStale = false;
        close();
        if (r && global.meToast){
          meToast('邻·' + (r.kept||0) + ' 保 / ' + (r.added||0) + ' 新 / ' + (r.removed||0) + ' 删', 'success');
        }
      } catch(e){
        close();
        if (global.meToast) meToast('检邻失败·' + e.message, 'error');
      }
    }, 50);
  }

  // ─── init ──────────────────────────────────────────────

  function init(){
    ensureModal();
    // mutation 中·polygon 变 → 标 stale
    // 字段编辑 (name / level / autonomy 等) 不算·邻 不变
    ME.on('mutation', function(payload){
      var label = (payload && payload.label) || '';
      // polygon-affecting 关键词
      var affects = /polygon|新建|加飞地|加圈|删除|split|merge|合并|切|brush|刷|voronoi|扰边|清小飞地|atlas|载|topology/.test(label);
      if (affects) markStale();
    });
    // map-loaded·清 stale
    ME.on('map-loaded', function(){
      if (ME.EDITOR && ME.EDITOR.map){
        ME.EDITOR.map._areaLinksStale = false;
      }
      _staleToastShown = false;
    });
    // N 键·手动 rerun
    document.addEventListener('keydown', function(e){
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.key === 'n' || e.key === 'N'){
        if (e.ctrlKey || e.metaKey) return;  // Ctrl+N 不抢
        runRecompute();
        e.preventDefault();
      }
    });
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.progress = {
    init: init,
    open: open,
    update: update,
    close: close,
    isCancelled: isCancelled,
    markStale: markStale,
    runRecompute: runRecompute
  };

})(typeof window !== 'undefined' ? window : this);
