// Prepare focused edits from frozen runtime bytes. No scenario or live source writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),plan=[];
function replaceOnce(t,a,b){if(t.includes('\r\n')){a=a.replace(/\r?\n/g,'\r\n');b=b.replace(/\r?\n/g,'\r\n');}assert.equal(t.split(a).length,2,'Patch context: '+a.slice(0,100));return t.replace(a,b);}
function stage(name,fn){const b=fs.readFileSync(path.join(work,'before',name)),t=fn(b.toString('utf8'));new vm.Script(t,{filename:name});assert.ok(t.split(/\r?\n/).length<3000,name+' module budget');fs.writeFileSync(path.join(work,'after',name),t);plan.push({file:'web/'+name,before:hash(b),after:hash(t),lines:t.split(/\r?\n/).length});}
stage('phase8-formal-map.js',t=>{
 function one(a,b){t=replaceOnce(t,a,b);}
 one('  function zoomMap(factor){\n    var v = state.mapView || { scale: 1, tx: 0, ty: 0 };\n    v.scale = Math.max(0.72, Math.min(4.2, Number(v.scale || 1) * (factor || 1)));\n    state.mapView = v;\n    scheduleMapTransform();\n  }',`  // One limit for buttons, wheel, pinch, focus and restored camera state.
  function clampMapScale(value){
    value = Number(value);
    return Math.max(.72, Math.min(128, Number.isFinite(value) && value > 0 ? value : 1));
  }
  function zoomMapAt(factor, x, y){
    if (!Number.isFinite(factor) || factor <= 0) return;
    var v = state.mapView || { scale: 1, tx: 0, ty: 0 }, old = clampMapScale(v.scale || 1);
    var next = clampMapScale(old * factor);
    v.tx = x - (x - (Number(v.tx) || 0)) * (next / old);
    v.ty = y - (y - (Number(v.ty) || 0)) * (next / old);
    v.scale = next; state.mapView = v;
  }
  function zoomMap(factor){
    zoomMapAt(Number(factor), (Number(state._mapVBW) || 1200) / 2, (Number(state._mapVBH) || 720) / 2);
    scheduleMapTransform();
  }`);
 one('      var old = state.mapView.scale || 1;\n      // Trackpads emit many tiny deltas: a fixed notch per event races through tiers.\n      var pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (stage.__phase8CameraSize && stage.__phase8CameraSize.height || 720) : 1);\n      var next = Math.max(.85, Math.min(3.4, old * Math.exp(-Math.max(-100, Math.min(100, pixels)) * .002)));\n      state.mapView.tx = x - (x - (state.mapView.tx || 0)) * (next / old);\n      state.mapView.ty = y - (y - (state.mapView.ty || 0)) * (next / old);\n      state.mapView.scale = next;',`      // Trackpads emit many tiny deltas: scale by distance, not one notch per event.
      var pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (stage.__phase8CameraSize && stage.__phase8CameraSize.height || 720) : 1);
      zoomMapAt(Math.exp(-Math.max(-100, Math.min(100, pixels)) * .002), x, y);`);
 one('            var old = state.mapView.scale || 1;\n            var next = Math.max(.85, Math.min(3.4, old * g.zoom));\n            state.mapView.tx = ax - (ax - (state.mapView.tx || 0)) * (next / old);\n            state.mapView.ty = ay - (ay - (state.mapView.ty || 0)) * (next / old);\n            state.mapView.scale = next;', '            zoomMapAt(Number(g.zoom), ax, ay);');
 one('    var s = Number(v.scale) || 1;\n    if (s >= 1) {','    var s = clampMapScale(v.scale); v.scale = s;\n    if (s >= 1) {');
 one('      state.mapView.scale = Math.max(state.mapView.scale || 1, 1.45);',`      var shape = window.TMMapRealmLayout && window.TMMapRealmLayout.region(r), box = shape && shape.bounds;
      var stage = mapStage(), ratio = stage ? mapViewportMetrics(stage, map).ratio : 1;
      var extent = box ? Math.max(box.maxX - box.minX, box.maxY - box.minY) : 0;
      var target = extent > 0 && Number.isFinite(extent) ? 160 / (extent * ratio) : 1.45;
      state.mapView = state.mapView || { scale: 1, tx: 0, ty: 0 };
      state.mapView.scale = clampMapScale(Math.max(state.mapView.scale || 1, 1.45, target));`);
 one("    if (camera && camera.classList.contains('ming-map-camera')) {",`    var directVector = v.scale > 4.2;
    if (camera && camera.classList.contains('ming-map-camera') && !directVector) {
      world.removeAttribute('transform');`);
 one("    } else world.setAttribute('transform', 'translate(' + v.tx.toFixed(2) + ' ' + v.ty.toFixed(2) + ') scale(' + v.scale.toFixed(4) + ')');",`    } else {
      // Deep zoom stays in the clipped SVG viewport; never enlarge a screen-sized bitmap 128x.
      if (camera && camera.classList.contains('ming-map-camera')) camera.style.transform = 'none';
      if (svg) svg.dataset.tmfComposited = '0';
      world.setAttribute('transform', 'translate(' + v.tx.toFixed(3) + ' ' + v.ty.toFixed(3) + ') scale(' + v.scale.toFixed(6) + ')');
    }
    if (svg) svg.dataset.zoomRendering = directVector ? 'vector' : 'compositor';
    var zoomReadout = document.querySelector('[data-map-zoom-value]');
    if (zoomReadout) { zoomReadout.textContent = (v.scale < 10 ? v.scale.toFixed(1) : v.scale.toFixed(0)) + '×'; zoomReadout.title = '当前缩放 / 上限 128×'; }`);
 one("<div class=\"map-zoom-tools\" aria-label=\"舆图缩放\"><button", "<div class=\"map-zoom-tools\" aria-label=\"舆图缩放（最高128倍）\"><output data-map-zoom-value style=\"font-size:12px;min-width:3em;text-align:center\" aria-label=\"当前地图倍率\">1.0×</output><button");
 return t;
});
stage('tm-map-label-collide.js',t=>{
 function one(a,b){t=replaceOnce(t,a,b);}
 one("      desired.set(g, false);\n      var lw = (parseFloat(g.getAttribute('data-lw')) || fs) * sx;\n      var lh = (parseFloat(g.getAttribute('data-lh')) || fs) * sy;",`      desired.set(g, false);
      // Keep large-area names readable at deep zoom instead of filling the viewport.
      var inkScale = parseFloat(g.getAttribute('data-ink-scale')) || 1;
      var labelScale = scale > 4.2 ? Math.min(1, 48 / (fs * Math.min(sx, sy) * inkScale)) : 1;
      var baseTransform = g.getAttribute('data-zoom-base-transform');
      if (labelScale < 1 || baseTransform !== null) {
        if (baseTransform === null) { baseTransform = g.getAttribute('transform') || ''; g.setAttribute('data-zoom-base-transform', baseTransform); }
        var labelTransform = baseTransform + (labelScale < 1 ? ' scale(' + labelScale + ')' : '');
        if (g.getAttribute('transform') !== labelTransform) g.setAttribute('transform', labelTransform);
      }
      var lw = (parseFloat(g.getAttribute('data-lw')) || fs) * sx * labelScale;
      var lh = (parseFloat(g.getAttribute('data-lh')) || fs) * sy * labelScale;`);
 one("{ hw: obb[0] * sx / 2 + PAD, hh: obb[1] * sy / 2 + PAD, angle: obb[2] }", "{ hw: obb[0] * sx * labelScale / 2 + PAD, hh: obb[1] * sy * labelScale / 2 + PAD, angle: obb[2] }");
 one('    if (!isFinite(cellSize) || cellSize <= 0) cellSize = 64;',`    if (!isFinite(cellSize) || cellSize <= 0) cellSize = 64;
    // Bound broad-phase memory for oversized labels without changing exact overlap checks.
    for (var z = 0; z < items.length; z++) cellSize = Math.max(cellSize, Math.max(items[z].hw, items[z].hh) / 16);`);
 return t;
});
stage('phase8-formal-bridge-styles.js',t=>{
 const a='.tmf-map-world{transform-box:fill-box;transform-origin:0 0;}';
 const b='.tmf-map-world{transform-box:view-box;transform-origin:0 0;}body.tm-phase8-formal #tmf-formal-map[data-zoom-rendering="vector"] path{vector-effect:non-scaling-stroke!important;filter:none!important;}body.tm-phase8-formal #tmf-formal-map[data-zoom-rendering="vector"] .tmf-ocean-label{display:none;}';
 return replaceOnce(t,a,b);
});
fs.writeFileSync(path.join(work,'patch-plan.json'),JSON.stringify(plan,null,2));console.log(JSON.stringify(plan,null,2));
