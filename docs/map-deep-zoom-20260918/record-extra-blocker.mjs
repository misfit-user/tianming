// Keep the failed optional Tang startup check separate from completed zoom verification.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),f=path.join(root,'docs/map-deep-zoom-20260918/finalize-zoom.mjs');
let t=fs.readFileSync(f,'utf8');
function one(a,b){assert.equal(t.split(a).length,2,a);t=t.replace(a,b);}
one("const uiTags=['reconnected-final-sc-tianqi7-1627','cross-scenario-final-sc-jianyan1-1127-shaosong','cross-scenario-final-sc-tang840-840'];","const uiTags=['reconnected-final-sc-tianqi7-1627','cross-scenario-final-sc-jianyan1-1127-shaosong'];");
one(",[uiTags[2]+'/small-target-autofocus.png','晚唐_小岛自动聚焦.png']",'');
one("const arch=reg.results.find(r=>r.name==='lint-arch-all.js');","const arch=reg.results.find(r=>r.name==='lint-arch-all.js');\nconst extra=read('tang-start-diagnostic-sc-tang840-840/report.json');assert.equal(extra.complete,false);assert.equal(extra.startResult.ok,false);");
one("for(const item of ui)fs.copyFileSync", "fs.copyFileSync(path.join(w,'tang-start-diagnostic-sc-tang840-840/report.json'),path.join(doc,'reports/tang-start-blocker.json'));\nfor(const item of ui)fs.copyFileSync");
one("tests:{mapAdaptation:","additionalScenarioCheck:{scenarioId:extra.sid,passed:false,stage:'before-map-world-start',error:extra.startResult,report:'reports/tang-start-blocker.json'},\n tests:{mapAdaptation:");
one("console.log(JSON.stringify({applied:result.applied,zoom:result.zoom", "console.log(JSON.stringify({applied:result.applied,additionalScenarioCheck:result.additionalScenarioCheck,zoom:result.zoom");
fs.writeFileSync(f,t);console.log('Optional startup blocker is preserved, not waived or counted as passed.');
