// map-editor-ink-realm.js
// Phase 23.6·★ 水墨势力·realm watercolor wash
//
// 替单实色 → 透晕 + 边羽化·polygon 内径向渐弱
// realm 色 (按 autonomy.type / holder)·中浓边淡·polygon 外纸白
// 选中·朱砂红外笔 + 印章小圈
//
// 这是 Phase 23 重头·势力归属直接看出
//
// 2026-05-08

(function(global){
  'use strict';

  var ME = global.TM && global.TM.MapEditor;
  if (!ME){ console.error('[ink-realm] core not loaded'); return; }

  var _enabled = true;   // Phase 24·默认开·任何 polygon 即有水墨势力 wash

  // ─── realm 调色板·按 autonomy.type ───────────────────

  // 与 core.colorForDivision 同源·但调更"墨"·为 wash 用
  // 直辖偏冷蓝·藩国紫·藩镇橙·羁縻青·朝贡黄
  var REALM_RGB = {
    'zhixia':   [70, 95, 125],   // 直辖·靛蓝
    'fanguo':   [128, 70, 105],  // 藩国·紫红
    'fanzhen':  [165, 95, 60],   // 藩镇·赭橙
    'jimi':     [95, 125, 80],   // 羁縻·绿
    'chaogong': [150, 130, 75]   // 朝贡·赭黄
  };

  // hex → [r,g,b]
  function hexToRgb(hex){
    if (!hex) return null;
    if (hex[0] === '#') hex = hex.slice(1);
    if (hex.length === 3){
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length >= 6){
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
    return null;
  }

  function realmRgb(d){
    // Phase 25·先查 faction
    if (global.TM && TM.MapEditor.factions && d.factionId){
      var f = TM.MapEditor.factions.get(d.factionId);
      if (f && f.color){
        var rgb = hexToRgb(f.color);
        if (rgb) return rgb;
      }
    }
    // fallback·autonomy.type
    var typ = (d.autonomy && d.autonomy.type) || 'zhixia';
    return REALM_RGB[typ] || REALM_RGB.zhixia;
  }

  // 略调 hue·按 holder 字符串 hash·让同 type 不同 holder 有微差
  // factionId 先·若无·则用 holder
  function holderShift(d){
    // 有 factionId·不用 hash 抖 (faction.color 已是该势力官色·不该再偏)
    if (d.factionId) return 0;
    var h = d.autonomy && d.autonomy.holder;
    if (!h) return 0;
    var s = 0;
    for (var i = 0; i < h.length; i++) s = ((s << 5) - s) + h.charCodeAt(i);
    return ((s % 30) - 15);   // -15 ~ +15
  }

  function rgbStr(rgb, a){
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  // ─── render·按 visible·polygon 内径向 wash ──────────

  function render(ctx, camera){
    if (!_enabled) return;
    var EDITOR = ME.EDITOR;
    var visible = EDITOR._visibleCache || [];
    if (!visible.length) return;

    visible.forEach(function(v){
      var d = v.base;
      var rgb = realmRgb(d).slice();
      var shift = holderShift(d);
      rgb[0] = Math.max(20, Math.min(220, rgb[0] + shift));
      rgb[1] = Math.max(20, Math.min(220, rgb[1] + shift));
      rgb[2] = Math.max(20, Math.min(220, rgb[2] + shift));

      var poly = v.allPolys[0];
      if (!poly || poly.length < 3) return;
      if (!d.bbox) return;
      var cx = d.centroid ? d.centroid[0] : (d.bbox.x + d.bbox.w / 2);
      var cy = d.centroid ? d.centroid[1] : (d.bbox.y + d.bbox.h / 2);
      // 半径·bbox 对角的 0.55
      var rad = Math.sqrt(d.bbox.w * d.bbox.w + d.bbox.h * d.bbox.h) * 0.55;

      // ① 主 polygon·radial wash·中浓边淡
      v.allPolys.forEach(function(p, idx){
        if (!p || p.length < 3) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (var i = 1; i < p.length; i++){
          ctx.lineTo(p[i][0], p[i][1]);
        }
        ctx.closePath();
        var holes = idx === 0 ? (d.holes || []) : ((d.extraPolygonHoles || [])[idx - 1] || []);
        holes.forEach(function(h){
          if (!h || h.length < 3) return;
          ctx.moveTo(h[0][0], h[0][1]);
          for (var k = 1; k < h.length; k++) ctx.lineTo(h[k][0], h[k][1]);
          ctx.closePath();
        });
        ctx.clip('evenodd');

        var grad = ctx.createRadialGradient(cx, cy, rad * 0.05, cx, cy, rad);
        grad.addColorStop(0,    rgbStr(rgb, 0.50));
        grad.addColorStop(0.55, rgbStr(rgb, 0.32));
        grad.addColorStop(1,    rgbStr(rgb, 0.10));
        ctx.fillStyle = grad;
        if (d.bbox){
          ctx.fillRect(d.bbox.x - 6, d.bbox.y - 6, d.bbox.w + 12, d.bbox.h + 12);
        } else {
          ctx.fillRect(-10000, -10000, 20000, 20000);
        }

        // ② 边羽化·内描一笔淡纸白 (像水彩干裂边)
        ctx.strokeStyle = 'rgba(245,235,210,0.45)';
        ctx.lineWidth = 1.8 / camera.zoom;
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (var j = 1; j < p.length; j++){
          ctx.lineTo(p[j][0], p[j][1]);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      });

      // ③ 都城点·realm 色更浓 + 印章圈
      if (camera.zoom > 0.5){
        ctx.save();
        ctx.fillStyle = rgbStr(rgb, 0.85);
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgbStr(rgb, 0.6);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // ④ 选中·朱砂外圈 + 印章
      var sel = EDITOR.selectedDivision;
      if (sel && sel === d){
        ctx.save();
        ctx.strokeStyle = 'rgba(181,58,44,0.85)';   // 朱砂
        ctx.lineWidth = 2.4 / camera.zoom;
        ctx.lineJoin = 'round';
        v.allPolys.forEach(function(p){
          if (!p || p.length < 3) return;
          ctx.beginPath();
          ctx.moveTo(p[0][0], p[0][1]);
          for (var k = 1; k < p.length; k++){
            ctx.lineTo(p[k][0], p[k][1]);
          }
          ctx.closePath();
          ctx.stroke();
        });
        // 印章·小方框 + 内字
        var sealS = 14;
        ctx.fillStyle = 'rgba(181,58,44,0.9)';
        ctx.fillRect(cx - sealS / 2, cy - sealS / 2, sealS, sealS);
        ctx.fillStyle = 'rgba(245,235,210,0.95)';
        ctx.font = 'bold 9px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选', cx, cy);
        ctx.restore();
      }
    });
  }

  // ─── toggle ────────────────────────────────────────────

  function toggle(b){
    _enabled = (b == null) ? !_enabled : !!b;
    try { localStorage.setItem('me.inkRealm', _enabled ? '1' : '0'); } catch(e){}
    ME.requestRender();
    if (global.meToast) meToast('水墨势力·' + (_enabled ? '开' : '关'), 'info', 1500);
  }

  function isEnabled(){ return _enabled; }

  function init(){
    try {
      var v = localStorage.getItem('me.inkRealm');
      if (v === '0') _enabled = false;
    } catch(e){}
  }

  // ─── expose ────────────────────────────────────────────

  global.TM = global.TM || {};
  global.TM.MapEditor = global.TM.MapEditor || {};
  global.TM.MapEditor.inkRealm = {
    init: init,
    render: render,
    toggle: toggle,
    isEnabled: isEnabled,
    REALM_RGB: REALM_RGB
  };

})(typeof window !== 'undefined' ? window : this);
