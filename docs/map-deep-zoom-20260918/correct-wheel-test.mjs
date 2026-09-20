// Electron native wheel deltas have the opposite sign to DOM WheelEvent deltas.
// Correct only the input fixture; the game continues to use standard DOM wheel direction.
import fs from 'node:fs';import assert from 'node:assert/strict';
const file='docs/map-deep-zoom-20260918/verify-zoom-ui.mjs';let t=fs.readFileSync(file,'utf8');
function one(a,b){assert.equal(t.split(a).length,2,a);t=t.replace(a,b);}
one("deltaY:40,deltaX:0,canScroll:true","deltaY:-40,deltaX:0,canScroll:true");
one("deltaY:-100,deltaX:0,canScroll:true","deltaY:100,deltaX:0,canScroll:true");
one(" await js(`TMPhase8FormalBridge.map.closeMapDossier()`);", " await js(`TMPhase8FormalBridge.map.closeMapDossier();window.__zoomWheelLog=[];document.getElementById('ming-map-layer').addEventListener('wheel',e=>window.__zoomWheelLog.push({deltaY:e.deltaY,trusted:e.isTrusted}),{passive:true})`);await sleep(300);");
one("const vw=await state();check('real-wheel-reaches-same-cap'","report.wheelInput=await js(`window.__zoomWheelLog`);const vw=await state();check('real-wheel-reaches-same-cap'");
fs.writeFileSync(file,t);console.log('Corrected native input direction; wheel events now recorded in test evidence.');
