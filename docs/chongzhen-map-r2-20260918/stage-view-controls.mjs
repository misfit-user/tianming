// Opt-in map viewing controls; no world, army or financial mutations.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const file=path.join(root,'web/phase8-formal-map.js'),before=fs.readFileSync(file);let text=before.toString('utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(before),JSON.parse(fs.readFileSync(path.join(work,'baseline.json'),'utf8')).files.find(r=>r.file==='web/phase8-formal-map.js').sha256,'Concurrent map renderer edit');
function one(a,b){if(text.includes('\r\n')){a=a.replace(/\r?\n/g,'\r\n');b=b.replace(/\r?\n/g,'\r\n');}assert.equal(text.split(a).length,2,a.slice(0,80));text=text.replace(a,b);}
one('aria-pressed="false">府州</button></div>', 'aria-pressed="false">府州</button><button type="button" class="map-scale" data-map-tier-lock="1" style="display:none" aria-pressed="false" title="锁定后，缩放不会自动改变地图层级">缩放联动</button><button type="button" class="map-scale" data-map-fit-all="1" style="display:none" title="保持当前层级并查看完整地图">全图</button></div>');
one("        var zoom = e.target && e.target.closest ? e.target.closest('[data-map-zoom]') : null;",`        var lockButton = e.target && e.target.closest ? e.target.closest('[data-map-tier-lock]') : null;
        var fitButton = e.target && e.target.closest ? e.target.closest('[data-map-fit-all]') : null;
        if (lockButton || fitButton) {
          var controlMap = getMapData();
          if (!controlMap || !controlMap.hierarchyPresentation || !controlMap.hierarchyPresentation.layerControl) return;
          e.preventDefault(); e.stopPropagation();
          state._zoomLevelLinkOff = fitButton ? true : !state._zoomLevelLinkOff;
          state._tierLockMapId = controlMap.id;
          if (fitButton) resetMapView();
          else if (!state._zoomLevelLinkOff) _syncScaleLevelFromZoom();
          updateMapChrome(); renderFormalMapSoon(); return;
        }
        var zoom = e.target && e.target.closest ? e.target.closest('[data-map-zoom]') : null;`);
one('var _s2 = bandToScale(state.mapScale);','var _s2 = state._zoomLevelLinkOff ? _s1 : bandToScale(state.mapScale);');
one("    var mode = document.getElementById('map-tools-mode');",`    var currentMap = getMapData(), controlsOn = !!(currentMap && currentMap.hierarchyPresentation && currentMap.hierarchyPresentation.layerControl);
    if (state._tierLockMapId && (!currentMap || state._tierLockMapId !== currentMap.id)) { state._zoomLevelLinkOff = false; state._tierLockMapId = null; }
    document.querySelectorAll('[data-map-tier-lock],[data-map-fit-all]').forEach(function(btn){
      btn.style.display = controlsOn ? '' : 'none';
      if (btn.hasAttribute('data-map-tier-lock')) {
        btn.textContent = state._zoomLevelLinkOff ? '层级已锁' : '缩放联动';
        btn.setAttribute('aria-pressed', String(!!state._zoomLevelLinkOff));
      }
    });
    var mode = document.getElementById('map-tools-mode');`);
fs.mkdirSync(path.join(work,'runtime-after'),{recursive:true});fs.writeFileSync(path.join(work,'runtime-after/phase8-formal-map.js'),text);
fs.writeFileSync(path.join(work,'view-plan.json'),JSON.stringify({file:'web/phase8-formal-map.js',before:hash(before),after:hash(text)},null,2));console.log('Opt-in view controls staged');
