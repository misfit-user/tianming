// Short independent official-world tests; generated test scripts are syntax-checked first.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),sid=process.argv[4];
assert.ok(['sc-jianyan1-1127-shaosong','sc-tang840-840'].includes(sid));
let text=fs.readFileSync(path.join(root,'docs/map-deep-zoom-20260918/verify-zoom-ui.mjs'),'utf8');
const original="check('island-is-visible',atMax.width>40&&atMax.height>25&&atMax.inside,atMax);";
assert.equal(text.split(original).length,2);
text=text.replace(original,"check('large-island-visible-at-128',atMax.width>40&&atMax.height>25,atMax);");
const needle=' // Real wheel input at the target must preserve its screen anchor while reducing deep zoom.';assert.equal(text.split(needle).length,2);
const extra=` {
 const onScreen=await js(\`(()=>{const r=GM.mapData.regions.find(r=>r.id==='\${targetId}'),p=document.querySelector('#tmf-formal-map .tmf-region[data-region-id="\${targetId}"]'),b=document.getElementById('ming-map-layer').getBoundingClientRect(),v=new DOMPoint(r.center[0],r.center[1]).matrixTransform(p.getScreenCTM());return {x:v.x,y:v.y,visible:v.x>=b.left&&v.x<=b.right&&v.y>=b.top&&v.y<=b.bottom};})()\`);
 check('target-centre-is-onscreen',onScreen.visible,onScreen);
 await js(\`document.querySelector('[data-map-reset]').click()\`);await sleep(700);
 const reset=await js(\`({view:TMPhase8FormalBridge.__p8MapParts.state.mapView,rendering:document.getElementById('tmf-formal-map').dataset.zoomRendering,paths:document.querySelectorAll('#tmf-formal-map .tmf-region').length})\`);
 check('cross-scenario-reset',reset.view.scale===1&&reset.view.tx===0&&reset.view.ty===0&&reset.paths===source.regions&&reset.rendering==='compositor',reset);
 report.resetScreenshot=await shot('whole-map-after-deep-zoom');report.complete=true;finish(0);return;
 }
`;
text=text.replace(needle,extra+needle);
const script=path.join(w,'cross-scenario-'+sid+'.mjs');fs.writeFileSync(script,text);
const syntax=spawnSync(process.execPath,['--check',script],{encoding:'utf8'});assert.equal(syntax.status,0,syntax.stderr);
const mode='cross-scenario-final',dir=path.join(w,mode+'-'+sid);fs.mkdirSync(dir,{recursive:true});
const out=fs.openSync(path.join(dir,'stdout.log'),'w'),err=fs.openSync(path.join(dir,'stderr.log'),'w');
const env={...process.env,ZOOM_REPO:root,ZOOM_WORK:w,ZOOM_MODE:mode,ZOOM_SID:sid};delete env.ELECTRON_RUN_AS_NODE;
console.log('Cross-scenario native check '+sid);
const r=spawnSync(path.join(root,'node_modules/electron/dist/electron.exe'),[script],{cwd:root,env,stdio:['ignore',out,err],timeout:230000,windowsHide:true});
fs.closeSync(out);fs.closeSync(err);const result={status:r.status,signal:r.signal,error:r.error?.message||null};fs.writeFileSync(path.join(dir,'process-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=r.status===0&&!r.error?0:1;
