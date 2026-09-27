// Record and stage the CSS coordinate-origin correction found by the real viewport test.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),doc=path.join(root,'docs/map-deep-zoom-20260918');
const style='phase8-formal-bridge-styles.js',bytes=fs.readFileSync(path.join(root,'web',style)),dest=path.join(w,'before',style);
if(fs.existsSync(dest))assert.ok(fs.readFileSync(dest).equals(bytes));else fs.writeFileSync(dest,bytes);
const file=path.join(doc,'stage-zoom.mjs');let t=fs.readFileSync(file,'utf8');const needle="fs.writeFileSync(path.join(work,'patch-plan.json')";assert.equal(t.split(needle).length,2);
const block=`stage('phase8-formal-bridge-styles.js',t=>{
 const a='.tmf-map-world{transform-box:fill-box;transform-origin:0 0;}';
 const b='.tmf-map-world{transform-box:view-box;transform-origin:0 0;}body.tm-phase8-formal #tmf-formal-map[data-zoom-rendering="vector"] path{vector-effect:non-scaling-stroke!important;filter:none!important;}body.tm-phase8-formal #tmf-formal-map[data-zoom-rendering="vector"] .tmf-ocean-label{display:none;}';
 return replaceOnce(t,a,b);
});
`;
fs.writeFileSync(file,t.replace(needle,block+needle));
const baselineFile=path.join(w,'baseline.json'),base=JSON.parse(fs.readFileSync(baselineFile,'utf8'));base.files.push({file:'web/'+style,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});fs.writeFileSync(baselineFile,JSON.stringify(base,null,2));
console.log('Stylesheet baseline preserved; view-box origin and deep-zoom non-scaling stroke staged.');
