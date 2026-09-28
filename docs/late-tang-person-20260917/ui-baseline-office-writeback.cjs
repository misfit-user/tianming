'use strict';
// Read-only baseline comparison: run the same failing smoke with the backed-up office module.
// No runtime file is restored or overwritten.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const meta=JSON.parse(fs.readFileSync(path.join(__dirname,'before.json'),'utf8'));
const office=path.join(root,'web/tm-office-system.js');
const baseline=path.join(meta._backup,'web/tm-office-system.js');
const read=fs.readFileSync;read(baseline);
fs.readFileSync=function(file,...args){return read.call(fs,typeof file==='string'&&path.resolve(file)===office?baseline:file,...args);};
require(path.join(root,'web/scripts/smoke-edict-office-tree-writeback.js'));
