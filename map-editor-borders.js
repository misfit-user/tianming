// map-editor-borders.js
// Phase 21.2·双线 hatching 边界
//
// 替单 stroke·画双线·外暗 thicker / 内金 thinner·古地图 frame 风
// 在 polygon 渲染后·overlay 双线·略覆默认 1.2px stroke
// 选中省·线变金双·hover·稍亮
//
// hatching·跨海岸 / 番国边·扰短斜线 (TODO·v2)
//
// 2026-05-07

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[borders] core not loaded'); return; }

  var _enabled = true;
  var _style = 'ink';   // Phase 24·默 ink 单墨线·替"双金线霓虹"·更接近卷轴·setStyle('double') 切回

  // ─── render·后 polygon·绘双线 / 单墨线 ───────────────

  function render(ctx, camera){
    if (!_enabled) return;
    var EDITOR = ME.EDITOR;
    if (!EDITOR.layers.polygon) return;
    var visible = EDITOR._visibleCache || [];
    if (!visible.length) return;

    var zoom = camera.zoom;

    // Phase 23.7·ink mode (player view) → 单墨线
    if (_style === 'ink'){
      var inkW = 0.9 / zoom;
      visible.forEach(function(v){
        var d = v.base;
        var isSelected = EDITOR.selectedIds.indexOf(d.id) !== -1;
        var isHover = EDITOR.hoverId === d.id;
        var inkColor = isSelected ? 'rgba(181,58,44,0.9)' :    // 朱砂
                       isHover ? 'rgba(40,30,20,0.85)' :
                       'rgba(50,40,30,0.55)';                  // 淡墨
        var poly = v.allPolys[0];
        if (poly && poly.length >= 3){
          drawSingle(ctx, poly, inkW, inkColor);
        }
        for (var px = 1; px < v.allPolys.length; px++){
          var p = v.allPolys[px];
          if (!p || p.length < 3) continue;
          ctx.save();
          ctx.setLineDash([3 / zoom, 3 / zoom]);
          drawSingle(ctx, p, inkW, inkColor);
          ctx.restore();
        }
      });
      return;
    }

    // 默 double·双金线 (editor)
    var outerW = 2.6 / zoom;
    var innerW = 0.8 / zoom;
    visible.forEach(function(v){
      var d = v.base;
      var isSelected = EDITOR.selectedIds.indexOf(d.id) !== -1;
      var isHover = EDITOR.hoverId === d.id;

      var outerColor = isSelected ? 'rgba(217,181,102,0.95)' :
                       isHover ? 'rgba(58,42,28,0.85)' :
                       'rgba(58,42,28,0.75)';
      var innerColor = isSelected ? '#efdfb2' :
                       isHover ? '#c9a96e' :
                       'rgba(184,147,42,0.65)';

      var poly = v.allPolys[0];
      if (poly && poly.length >= 3){
        drawDouble(ctx, poly, outerW, outerColor, innerW, innerColor);
      }
      for (var px = 1; px < v.allPolys.length; px++){
        var p = v.allPolys[px];
        if (!p || p.length < 3) continue;
        ctx.save();
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        drawDouble(ctx, p, outerW, outerColor, innerW, innerColor);
        ctx.restore();
      }
    });
  }

  function drawSingle(ctx, poly, w, color){
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (var i = 1; i < poly.length; i++){
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawDouble(ctx, poly, outerW, outerColor, innerW, innerColor){
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (var i = 1; i < poly.length; i++){
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();

    // outer·暗 thicker
    ctx.lineWidth = outerW;
    ctx.strokeStyle = outerColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // inner·金 thin
    ctx.lineWidth = innerW;
    ctx.strokeStyle = innerColor;
    ctx.stroke();
    ctx.restore();
  }

  // ─── toggle ────────────────────────────────────────────

  function toggle(b){
    _enabled = (b == null) ? !_enabled : !!b;
    try { localStorage.setItem('me.borders', _enabled ? '1' : '0'); } catch(e){}
    ME.requestRender();
    if (global.meToast) meToast('双线边·' + (_enabled ? '开' : '关'), 'info', 1200);
  }

  function isEnabled(){ return _enabled; }

  // ─── init ──────────────────────────────────────────────

  function init(){
    try {
      var v = localStorage.getItem('me.borders');
      if (v === '0') _enabled = false;
      var st = localStorage.getItem('me.bordersStyle');
      if (st === 'double' || st === 'ink') _style = st;
    } catch(e){}
    document.addEventListener('keydown', function(e){
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.ctrlKey && e.altKey && (e.key === 'b' || e.key === 'B')){
        e.preventDefault();
        toggle();
      }
      // Ctrl+Alt+Shift+B·切风格 (single ink ↔ double gold)
      if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'b' || e.key === 'B' || e.key === 'B')){
        e.preventDefault();
        setStyle(_style === 'ink' ? 'double' : 'ink');
        if (global.meToast) meToast('边·' + (_style === 'ink' ? '单墨线' : '双金线'), 'info', 1200);
      }
    });
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  function setStyle(s){
    if (s !== 'double' && s !== 'ink') return;
    _style = s;
    try { localStorage.setItem('me.bordersStyle', s); } catch(e){}
    ME.requestRender();
  }
  function getStyle(){ return _style; }

  global.TM.MapEditor.borders = {
    init: init,
    render: render,
    toggle: toggle,
    isEnabled: isEnabled,
    setStyle: setStyle,
    getStyle: getStyle
  };

})(typeof window !== 'undefined' ? window : this);
