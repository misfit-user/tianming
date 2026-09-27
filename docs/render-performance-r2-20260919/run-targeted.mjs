import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(work,'../..');
const tests=['smoke-render-identity-cost.mjs','smoke-battle-menu-render-idle.mjs','smoke-raster-display-cache.mjs','smoke-perf-map-render-path.js','smoke-battle-render-resolution.js','smoke-map-live-vitals.js','smoke-map-view-scores.js','smoke-map-viewport-collision.js','smoke-map-zoom-preload.js','smoke-battle-deterministic.js','smoke-battle-embed-protocol.js','smoke-battle-render-assets.js','smoke-editor-renderall-resilient.js','smoke-battle-hud-retained.js'];
const results=[];
for(const name of tests){
 const r=spawnSync(process.execPath,[path.join(root,'web/scripts',name)],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
 const text=(r.stdout||'')+'\n'+(r.stderr||'');fs.writeFileSync(path.join(work,'rerun-'+name+'.log'),text);
 const passed=r.status===0&&!r.error;results.push({name,passed,code:r.status,error:r.error?.message});
 console.log((passed?'PASS ':'FAIL ')+name);if(!passed)console.error(text.slice(-4000));
}
fs.writeFileSync(path.join(work,'rerun-results.json'),JSON.stringify(results,null,2));
process.exitCode=results.every(r=>r.passed)?0:1;
