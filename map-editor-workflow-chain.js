// map-editor-workflow-chain.js
// Phase 17.2·workflow chain·voronoi 后处理·下一步建议系列
//
// 用·完·voronoi / sample 生成 / atlas 载入·后·一连串 polish 操作 step
// 浮 bar·底中·step 描·一键 run·可 skip·可 完
// 链定义·{ id, title, steps: [{label, hint, run, optional}] }
//
// 2026-05-06

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[workflow-chain] core not loaded'); return; }

  var _bar = null;
  var _activeChain = null;
  var _stepIdx = 0;

  // ─── 链定义 ────────────────────────────────────────────

  var CHAINS = {
    voronoiPolish: {
      id: 'voronoiPolish',
      title: 'voronoi 后处理',
      steps: [
        {
          label: '海岸 snap',
          hint: 'polygon 顶点·若海·吸到最近陆·只在底图存在时',
          optional: true,
          run: function(){
            var cs = TM.MapEditor.coastlineSnap;
            if (!cs){ if (global.meToast) meToast('coastline-snap 未加载', 'error'); return true; }
            if (!ME.EDITOR.bitmapImage){
              if (global.meToast) meToast('未载底图·snap 跳过', 'info', 1500);
              return true;   // skip ok
            }
            cs.snapAll({ maxRadius: 30, densify: true });
            return true;
          }
        },
        {
          label: '清小飞地',
          hint: '飞地 < 200 px²·洞 < 100 px² 自动清',
          run: function(){
            var pp = TM.MapEditor.postprocess;
            if (!pp){ if (global.meToast) meToast('postprocess 未加载', 'error'); return false; }
            var r = pp.cleanupSmallExtras({ extraThreshold: 200, holeThreshold: 100 });
            if (global.meToast){
              if (r) meToast('清·' + (r.extras||0) + ' 飞地 + ' + (r.holes||0) + ' 洞', 'success');
            }
            return true;
          }
        },
        {
          label: 'fractal 扰边',
          hint: 'mid-point displacement·3 octave·natural 海岸',
          run: function(){
            var pp = TM.MapEditor.postprocess;
            if (!pp || !pp.fractalIrregularize){ if (global.meToast) meToast('postprocess 未加载', 'error'); return false; }
            var r = pp.fractalIrregularize({ octaves: 3, initialOffset: 8, roughness: 0.55, minEdgeLen: 6 });
            if (r === null) return false;
            if (global.meToast && r){
              meToast('fractal·' + (r.divs||0) + ' div / +' + (r.vertsAdded||0) + ' 顶', 'success');
            }
            return true;
          }
        },
        {
          label: '检邻',
          hint: '重建 adjacency·按 polygon 邻接',
          run: function(){
            var al = TM.MapEditor.arealinks;
            if (!al){ if (global.meToast) meToast('arealinks 未加载', 'error'); return false; }
            var r = al.recomputeFromNeighbors({ strategy: 'preserve' });
            if (global.meToast && r){
              meToast('邻·' + (r.kept||0) + ' 保 / ' + (r.added||0) + ' 新 / ' + (r.removed||0) + ' 删', 'success');
            }
            return true;
          }
        },
        {
          label: 'smart names',
          hint: 'V001 → 按位置 + 朝代 词库重命名',
          optional: true,
          run: function(){
            var sn = TM.MapEditor.smartNames;
            if (!sn){ if (global.meToast) meToast('smart-names 未加载', 'error'); return false; }
            sn.applyToCurrentMap({ filterPattern: /^V\d+$/ });
            return true;
          }
        }
      ]
    },
    sampleRefine: {
      id: 'sampleRefine',
      title: '样本精化',
      steps: [
        {
          label: '清小飞地',
          hint: '可选·清 < 200 px² 飞地',
          optional: true,
          run: function(){
            var pp = TM.MapEditor.postprocess;
            if (!pp) return false;
            pp.cleanupSmallExtras({ extraThreshold: 200, holeThreshold: 100 });
            return true;
          }
        },
        {
          label: '检邻',
          hint: '重建 adjacency',
          run: function(){
            var al = TM.MapEditor.arealinks;
            if (!al) return false;
            al.recomputeFromNeighbors({ strategy: 'preserve' });
            return true;
          }
        }
      ]
    }
  };

  // ─── UI ────────────────────────────────────────────────

  function ensureBar(){
    if (_bar) return _bar;
    _bar = document.createElement('div');
    _bar.id = 'me-wf-bar';
    _bar.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:42px',
      'transform:translateX(-50%)',
      'min-width:420px',
      'max-width:560px',
      'background:linear-gradient(180deg, var(--ink-3), var(--ink-2))',
      'border:1px solid var(--gold-3)',
      'border-radius:var(--rd-3)',
      'box-shadow:0 6px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(217,181,102,0.1)',
      'padding:var(--sp-3) var(--sp-4)',
      'z-index:900',
      'display:none',
      'font-family:var(--font-serif)',
      'color:var(--paper-1)'
    ].join(';');
    document.body.appendChild(_bar);
    return _bar;
  }

  function start(chainId){
    var chain = CHAINS[chainId];
    if (!chain){ console.warn('[workflow-chain] unknown', chainId); return; }
    _activeChain = chain;
    _stepIdx = 0;
    ensureBar(); /* 须先建 bar 再 render·首次 _bar 为 null 时 render 早退→空壳 bar */
    render();
    _bar.style.display = 'block';
  }

  function startVoronoiPolish(){ start('voronoiPolish'); }
  function startSampleRefine(){ start('sampleRefine'); }

  // ─── auto polish·gen 完后默自动跑 ────────────────────

  function autoPolishEnabled(){
    try {
      var v = localStorage.getItem('me.autoPolish');
      return v !== '0';   // 默 on
    } catch(e){ return true; }
  }
  function setAutoPolishEnabled(b){
    try { localStorage.setItem('me.autoPolish', b ? '1' : '0'); } catch(e){}
  }

  function autoPolish(kind){
    if (!autoPolishEnabled()){
      if (global.meToast) meToast('post-gen 链·关 (设置中可开)', 'info', 1800);
      return;
    }
    var chainId = kind === 'voronoi' ? 'voronoiPolish'
                : (kind === 'sample' || kind === 'atlas' || kind === 'bitmap') ? 'sampleRefine'
                : null;
    if (!chainId) return;
    setTimeout(function(){ start(chainId); }, 400);
  }

  function close(){
    if (_bar) _bar.style.display = 'none';
    _activeChain = null;
    _stepIdx = 0;
  }

  function render(){
    if (!_bar || !_activeChain) return;
    var ch = _activeChain;
    var n = ch.steps.length;
    var i = _stepIdx;

    if (i >= n){
      // done
      var apOn = autoPolishEnabled();
      _bar.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center; gap:var(--sp-3);">' +
          '<div>' +
            '<div style="color:var(--gold-1); font-size:var(--fs-md); font-weight:var(--fw-sb); letter-spacing:0.1em;">' + escHtml(ch.title) + '·完</div>' +
            '<div style="color:var(--paper-3); font-size:var(--fs-xs); margin-top:3px;">' + n + ' 步全过</div>' +
          '</div>' +
          '<label style="display:flex; align-items:center; gap:5px; color:var(--paper-3); font-size:var(--fs-xxs); cursor:pointer; user-select:none;">' +
            '<input type="checkbox" id="wf-auto" ' + (apOn ? 'checked' : '') + ' /> gen 后自动跑' +
          '</label>' +
          '<button class="me-btn" id="wf-close">关</button>' +
        '</div>';
      var ap = _bar.querySelector('#wf-auto');
      if (ap) ap.addEventListener('change', function(){
        setAutoPolishEnabled(ap.checked);
        if (global.meToast) meToast('post-gen 链·' + (ap.checked ? '开' : '关'), 'info', 1500);
      });
      _bar.querySelector('#wf-close').addEventListener('click', close);
      return;
    }

    var step = ch.steps[i];
    var dots = '';
    for (var k = 0; k < n; k++){
      var color = k < i ? 'var(--gold-2)' : (k === i ? 'var(--gold-1)' : 'var(--bd-1)');
      dots += '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + color + '; margin-right:4px;"></span>';
    }

    _bar.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--sp-3);">' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="display:flex; align-items:center; gap:var(--sp-2); margin-bottom:4px;">' +
            '<span style="color:var(--gold-2); font-size:var(--fs-xs); letter-spacing:0.1em;">' + escHtml(ch.title) + '</span>' +
            '<span style="color:var(--paper-3); font-size:var(--fs-xxs);">' + (i + 1) + ' / ' + n + '</span>' +
            '<span style="margin-left:auto;">' + dots + '</span>' +
          '</div>' +
          '<div style="color:var(--paper-0); font-size:var(--fs-md); font-weight:var(--fw-sb);">' + escHtml(step.label) + (step.optional ? ' <span style="color:var(--paper-3); font-weight:normal; font-size:var(--fs-xs);">(可选)</span>' : '') + '</div>' +
          '<div style="color:var(--paper-3); font-size:var(--fs-xs); margin-top:3px;">' + escHtml(step.hint || '') + '</div>' +
        '</div>' +
        '<div style="display:flex; flex-direction:column; gap:6px;">' +
          '<button class="me-btn me-btn-warn" id="wf-run" title="执行此步">执</button>' +
          '<button class="me-btn" id="wf-skip" title="跳过">跳</button>' +
          '<button class="me-btn" id="wf-close" title="关闭整个链">×</button>' +
        '</div>' +
      '</div>';

    _bar.querySelector('#wf-run').addEventListener('click', runCurrent);
    _bar.querySelector('#wf-skip').addEventListener('click', skipCurrent);
    _bar.querySelector('#wf-close').addEventListener('click', close);
  }

  function runCurrent(){
    if (!_activeChain) return;
    var step = _activeChain.steps[_stepIdx];
    if (!step) return;
    var ok;
    try { ok = step.run(); }
    catch(e){
      console.error('[workflow-chain] step error', e);
      if (global.meToast) meToast('步出错·' + e.message, 'error');
      ok = false;
    }
    if (ok !== false){
      _stepIdx++;
      render();
    }
    // 出错·留 i·user 决定 retry / skip
  }

  function skipCurrent(){
    if (!_activeChain) return;
    _stepIdx++;
    render();
  }

  // ─── helpers ───────────────────────────────────────────

  function escHtml(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.workflowChain = {
    start: start,
    startVoronoiPolish: startVoronoiPolish,
    startSampleRefine: startSampleRefine,
    autoPolish: autoPolish,
    isAutoPolishEnabled: autoPolishEnabled,
    setAutoPolishEnabled: setAutoPolishEnabled,
    close: close,
    CHAINS: CHAINS
  };

})(typeof window !== 'undefined' ? window : this);
