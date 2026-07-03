// map-editor-hover-glow.js
// Phase 21.10·hover glow + 脉冲
//
// hover 边外发光·shadow blur·选中省脉冲·1.6s ease·alpha sin
// 渲染·polygon 之上·border 之下·或 border 之后再 overlay
//
// 2026-05-07

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[hover-glow] core not loaded'); return; }

  var _enabled = true;

  function render(ctx, camera){
    if (!_enabled) return;
    var EDITOR = ME.EDITOR;
    if (!EDITOR.layers.polygon) return;
    var visible = EDITOR._visibleCache || [];
    if (!visible.length) return;

    var z = camera.zoom;
    var time = Date.now() / 1000;
    // 脉冲·1.6s 周期·alpha 0.5-1·scale 1-1.05
    var pulse = 0.5 + 0.5 * Math.sin(time * 2 * Math.PI / 1.6);

    visible.forEach(function(v){
      var d = v.base;
      var isSel = EDITOR.selectedIds.indexOf(d.id) !== -1;
      var isHov = EDITOR.hoverId === d.id;
      if (!isSel && !isHov) return;
      var poly = v.allPolys[0];
      if (!poly || poly.length < 3) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (var i = 1; i < poly.length; i++){
        ctx.lineTo(poly[i][0], poly[i][1]);
      }
      ctx.closePath();

      // Phase 25 fix·ink-realm 启用时·选中色用 朱砂·并大幅减 blur·避"光团"
      var inkOn = global.TM && TM.MapEditor.inkRealm && TM.MapEditor.inkRealm.isEnabled && TM.MapEditor.inkRealm.isEnabled();

      if (isSel){
        if (inkOn){
          // 朱砂细线·blur 极小·不再"光团"
          ctx.shadowBlur = 0;
          ctx.lineWidth = (1.6 + pulse * 0.6) / z;
          ctx.strokeStyle = 'rgba(181,58,44,' + (0.85 + pulse * 0.15) + ')';
          ctx.stroke();
        } else {
          ctx.shadowColor = '#d9b566';
          ctx.shadowBlur = 12 + pulse * 8;
          ctx.lineWidth = (3 + pulse * 1.5) / z;
          ctx.strokeStyle = 'rgba(217,181,102,' + (0.85 + pulse * 0.15) + ')';
          ctx.stroke();
        }
      } else if (isHov){
        if (inkOn){
          // 淡墨 hover·blur 0·避光环
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1.4 / z;
          ctx.strokeStyle = 'rgba(80,55,30,0.65)';
          ctx.stroke();
        } else {
          ctx.shadowColor = 'rgba(255,247,194,0.85)';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 2 / z;
          ctx.strokeStyle = 'rgba(255,247,194,0.9)';
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    // 选中时·持续 redraw 才能看到脉冲·调度下一帧
    var hasSel = EDITOR.selectedIds && EDITOR.selectedIds.length > 0;
    if (hasSel){
      // 防 spam·只 schedule 不直接 ME.requestRender
      if (!_pulseScheduled){
        _pulseScheduled = true;
        requestAnimationFrame(function(){
          _pulseScheduled = false;
          if (ME.EDITOR && ME.EDITOR.selectedIds && ME.EDITOR.selectedIds.length > 0){
            ME.requestRender();
          }
        });
      }
    }
  }

  var _pulseScheduled = false;

  function toggle(b){
    _enabled = (b == null) ? !_enabled : !!b;
    try { localStorage.setItem('me.hoverGlow', _enabled ? '1' : '0'); } catch(e){}
    ME.requestRender();
    if (global.meToast) meToast('hover glow·' + (_enabled ? '开' : '关'), 'info', 1200);
  }

  function isEnabled(){ return _enabled; }

  function init(){
    try {
      var v = localStorage.getItem('me.hoverGlow');
      if (v === '0') _enabled = false;
    } catch(e){}
  }

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.hoverGlow = {
    init: init,
    render: render,
    toggle: toggle,
    isEnabled: isEnabled
  };

})(typeof window !== 'undefined' ? window : this);
