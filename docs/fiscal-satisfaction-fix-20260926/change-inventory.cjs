'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'source-snapshot.json'))),sha=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const allowed=[
'web/tm-minxin-hard-link-consumers.js','web/tm-fiscal-statements.js','web/tm-guoku-panel.js','web/phase8-formal-rightrail.js',
'web/tm-class-engine.js','web/tm-party-class-llm-calibrator.js','web/tm-social-political-signals.js','web/tm-party-class-ecology.js','web/tm-patches-start.js','web/tm-renli.js','web/tm-topbar-vars.js',
'web/scripts/smoke-class-satisfaction-guard.js','web/scripts/smoke-social-satisfaction-recovery.js','web/scripts/smoke-fiscal-actual-display.js','web/scripts/smoke-guoku-shared-display.js','web/scripts/smoke-topbar-fiscal-consistency.js','web/scripts/smoke-class-pressure-scope.js','web/scripts/smoke-opening-renli-prime.js','web/scripts/verify-all.js','web/scripts/lib-ai-priority-routing.js','web/scripts/smoke-rightrail-datasource.js','web/scripts/smoke-endturn-performance-optimizations.js',
'web/index.html','web/tm-start-runtime-manifest.json','web/startup-script-phases.json','web/.hot-update-manifest.json'];
const changed=[];for(const rel of allowed){const before=snapshot.files[rel]||null,after=sha(path.join(root,rel)),live=sha(path.join(snapshot.source,rel));if(before===after)continue;changed.push({path:rel,before,after,live,sourceUnchanged:before===live,bytes:fs.statSync(path.join(root,rel)).size});}
const inventory={source:snapshot.source,candidate:root,head:snapshot.head,files:changed,conflicts:changed.filter(r=>!r.sourceUnchanged).map(r=>r.path)};
fs.writeFileSync(path.join(__dirname,'change-inventory.json'),JSON.stringify(inventory,null,2));
console.log(JSON.stringify({count:changed.length,conflicts:inventory.conflicts,files:changed.map(r=>r.path)},null,2));if(inventory.conflicts.length)process.exitCode=1;
