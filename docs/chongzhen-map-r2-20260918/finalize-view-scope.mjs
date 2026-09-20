// Keep a user's layer lock attached to its map, not the next scenario.
import fs from 'node:fs';import assert from 'node:assert/strict';
const p='docs/chongzhen-map-r2-20260918/stage-view-controls.mjs';
let text=fs.readFileSync(p,'utf8');
if(!text.includes('state._tierLockMapId = controlMap.id;')){
 const a='state._zoomLevelLinkOff = fitButton ? true : !state._zoomLevelLinkOff;';
 assert.equal(text.split(a).length,2);
 text=text.replace(a,a+'\n          state._tierLockMapId = controlMap.id;');
 const b="    document.querySelectorAll('[data-map-tier-lock],[data-map-fit-all]').forEach(function(btn){";
 assert.equal(text.split(b).length,2);
 text=text.replace(b,"    if (state._tierLockMapId && (!currentMap || state._tierLockMapId !== currentMap.id)) { state._zoomLevelLinkOff = false; state._tierLockMapId = null; }\n"+b);
 fs.writeFileSync(p,text);
}
console.log('Layer lock is scoped to the chosen map.');
