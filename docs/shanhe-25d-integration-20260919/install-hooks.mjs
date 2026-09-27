// Guarded additive hooks. Preserve all current concurrent work; backups are for inspection, not blind restore.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),work=import.meta.dirname;
const file=path.join(root,'web/phase8-formal-map.js'),index=path.join(root,'web/index.html'),before=fs.readFileSync(file,'utf8'),idx=fs.readFileSync(index,'utf8');let s=before;
if(s.includes('TMShanheRuntime'))throw Error('Hooks already present: inspect instead of replacing');
const edits=[];function replace(old,value){if(s.split(old).length!==2)throw Error('Hook anchor changed: '+old.slice(0,100));s=s.replace(old,value);edits.push({old,value});}
replace('  function zoomMapAt(factor, x, y){','  function zoomMapAt(factor, x, y){\n    if (window.TMShanheRuntime && TMShanheRuntime.zoomAt(factor, x, y, state)) return;');
replace("    var svg = world.ownerSVGElement, camera = svg && svg.parentElement;","    if (window.TMShanheRuntime && TMShanheRuntime.apply(stage, getMapData(), v, state)) return;\n    var svg = world.ownerSVGElement, camera = svg && svg.parentElement;");
replace('  function regionPathFromPoint(e){\n    if (!e) return null;','  function regionPathFromPoint(e){\n    if (!e) return null;\n    if (window.TMShanheRuntime && TMShanheRuntime.active()) return TMShanheRuntime.pick(e);');
replace('  function resolveLabelLayout(){','  function resolveLabelLayout(){\n    if (window.TMShanheRuntime && TMShanheRuntime.layoutLabels(mapStage())) return;');
replace('      var dy = (e.clientY - state.drag.y) / viewport.ratio;','      var dy = (e.clientY - state.drag.y) / viewport.ratio;\n      if (window.TMShanheRuntime && TMShanheRuntime.active(stage)) { var shDelta = TMShanheRuntime.panDelta(dx, dy); dx = shDelta[0]; dy = shDelta[1]; }');
replace('            state.mapView.tx = (state.mapView.tx || 0) + g.panDX / viewport.ratio;\n            state.mapView.ty = (state.mapView.ty || 0) + g.panDY / viewport.ratio;', '            var shPan = window.TMShanheRuntime ? TMShanheRuntime.panDelta(g.panDX / viewport.ratio, g.panDY / viewport.ratio) : [g.panDX / viewport.ratio, g.panDY / viewport.ratio];\n            state.mapView.tx = (state.mapView.tx || 0) + shPan[0];\n            state.mapView.ty = (state.mapView.ty || 0) + shPan[1];');
replace('    if (!shell || !stage || !isGameVisible()) {','    if (!shell || !stage || !isGameVisible()) {\n      if (window.TMShanheRuntime) TMShanheRuntime.hide();');
const tags=[...idx.matchAll(/<script\b[^>]*src=["']phase8-formal-map\.js[^"']*["'][^>]*><\/script>/g)];if(tags.length!==1)throw Error('Map script tag not unique');
const tag='<script src="tm-shanhe-runtime.js?v=20260919-native1"></script>\n',nextIndex=idx.replace(tags[0][0],tag+tags[0][0]);
const snapshot=path.join(work,'before-hooks');fs.mkdirSync(snapshot,{recursive:true});for(const [name,data]of [['phase8-formal-map.js',before],['index.html',idx]]){const dest=path.join(snapshot,name);if(fs.existsSync(dest))throw Error('Backup exists: review installation state');fs.writeFileSync(dest,data);}
// Compare immediately before write; never revert a concurrent change.
if(fs.readFileSync(file,'utf8')!==before||fs.readFileSync(index,'utf8')!==idx)throw Error('Concurrent update detected; no installation');
fs.writeFileSync(file,s);fs.writeFileSync(index,nextIndex);fs.writeFileSync(path.join(work,'hook-install.json'),JSON.stringify({edits,indexTag:tag,files:[{path:file,before:hash(before),after:hash(s)},{path:index,before:hash(idx),after:hash(nextIndex)}]},null,2));console.log('Installed '+edits.length+' guarded hooks, existing interaction retained');
