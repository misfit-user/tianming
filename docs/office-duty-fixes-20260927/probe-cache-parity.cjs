'use strict';
// Preserve strict deep comparison while avoiding Node's very large assertion diff.
const fs=require('fs'),path=require('path'),util=require('util');
const root=path.resolve(__dirname,'../..');
const {ROW_KEYS,materializeScenarioRows}=require(path.join(root,'web/scripts/lib/official-scenario-fixture.js'));
const sid='sc-tianqi7-1627', source=JSON.parse(fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'),'utf8'));
global.P={scenarios:[{id:sid,name:'stale cached official scenario'}]};
for(const key of ROW_KEYS)global.P[key]=[{id:'stale-'+key,sid}];
global.window=global;global.document={readyState:'complete'};
const originalLog=console.log;console.log=()=>{};
try{require(path.join(root,'web/scenarios/tianqi7-1627.js'));}finally{console.log=originalLog;}
const actual=materializeScenarioRows(global.P,sid), equal=util.isDeepStrictEqual(actual,source);
const result={equal,differingTopLevelKeys:[...new Set([...Object.keys(actual),...Object.keys(source)])].filter(key=>!util.isDeepStrictEqual(actual[key],source[key]))};
fs.writeFileSync(path.join(__dirname,'cache-parity-diagnosis.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));process.exitCode=equal?0:1;
