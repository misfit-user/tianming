'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');
const names=new Set(['tm-minxin-hard-link-consumers.js','tm-fiscal-statements.js','tm-guoku-panel.js','phase8-formal-rightrail.js','tm-class-engine.js','tm-party-class-llm-calibrator.js','tm-social-political-signals.js','tm-party-class-ecology.js','tm-patches-start.js','tm-renli.js','tm-topbar-vars.js']);
const contracts=fs.readFileSync(path.join(root,'web/scripts/lint-split-contracts.js'),'utf8');
const families=[...contracts.matchAll(/^\s*\[((?:'[\w.-]+\.js'\s*,?\s*)+)\],?\s*$/gm)].map(m=>[...m[1].matchAll(/'([\w.-]+\.js)'/g)].map(x=>x[1]));
let again=true;while(again){again=false;for(const fam of families)if(fam.some(n=>names.has(n)))for(const n of fam)if(!names.has(n)){names.add(n);again=true;}}
const entries=['web/index.html','web/editor.html','web/map-editor.html','web/preview/scenario-editor-reset-preview.html','web/_yan_harness.html'];const changed=[];
for(const rel of entries){const file=path.join(root,rel),before=fs.readFileSync(file,'utf8');let count=0;
 const after=before.replace(/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/g,(all,lead,ref,end)=>{const bare=ref.split('?')[0],name=path.posix.basename(bare);if(!names.has(name))return all;count++;return lead+bare+'?v=20260926-fiscal-social-fix'+end;});
 if(after!==before){const b=path.join(__dirname,'backups/root',rel.replace(/[\\/]/g,'__')+'.bak');fs.mkdirSync(path.dirname(b),{recursive:true});if(!fs.existsSync(b))fs.copyFileSync(file,b);fs.writeFileSync(file,after);changed.push({file:rel,refs:count});}
}
fs.writeFileSync(path.join(__dirname,'cache-integration.json'),JSON.stringify({stamp:'20260926-fiscal-social-fix',families:[...names].sort(),changed},null,2));console.log(JSON.stringify(changed));
