'use strict';
const fs=require('fs'),path=require('path'),{root,edit}=require('./edit.cjs');
const inventory=require('./change-inventory.json'),names=new Set(inventory.files.filter(r=>r.path.startsWith('web/')&&!r.path.startsWith('web/scripts/')&&r.path.endsWith('.js')).map(r=>path.basename(r.path)));
const contracts=fs.readFileSync(path.join(root,'web/scripts/lint-split-contracts.js'),'utf8'),families=[...contracts.matchAll(/^\s*\[((?:'[\w.-]+\.js'\s*,?\s*)+)\],?\s*$/gm)].map(m=>[...m[1].matchAll(/'([\w.-]+\.js)'/g)].map(x=>x[1]));
let more=true;while(more){more=false;for(const f of families)if(f.some(n=>names.has(n)))for(const n of f)if(!names.has(n)){names.add(n);more=true;}}
const changed=[];for(const rel of ['web/index.html','web/editor.html','web/map-editor.html','web/preview/scenario-editor-reset-preview.html','web/_yan_harness.html'])edit(rel,s=>{let n=0;const next=s.replace(/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/g,(all,a,ref,b)=>{const base=ref.split('?')[0];if(!names.has(path.basename(base)))return all;n++;return a+base+'?v=20260926-edict-feedback-r2'+b;});if(next!==s)changed.push({file:rel,refs:n});return next;});
fs.writeFileSync(path.join(__dirname,'cache-integration.json'),JSON.stringify({stamp:'20260926-edict-feedback-r2',names:[...names],changed},null,2));console.log(JSON.stringify(changed));
