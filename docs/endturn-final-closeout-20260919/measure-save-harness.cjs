const fs=require('fs'),path=require('path'),{createRequire}=require('module'),{performance}=require('perf_hooks');
const requireProject=createRequire(path.resolve('package.json'));
const {saveBuilder,controlledWorld}=requireProject('./web/scripts/lib-perf-round1');
const source=path.resolve('scenarios/绍宋·建炎元年八月（官方）.json');
function mark(name,start,more={}){console.log(JSON.stringify({name,ms:Math.round(performance.now()-start),memory:process.memoryUsage(),...more}));}
let t=performance.now();const scenario=JSON.parse(fs.readFileSync(source,'utf8'));mark('load scenario',t,{bytes:fs.statSync(source).size});
t=performance.now();const h=saveBuilder();mark('build harness',t);
t=performance.now();const f=controlledWorld(scenario,false);h.c.P=f.p;h.c.GM=f.gm;mark('world fixture',t);
t=performance.now();let expected=h.legacyBuild('idb');mark('legacy state',t,{clones:h.work.clones,cloneMs:h.work.cloneMs});
t=performance.now();let canonical=h.c._buildSaveState({format:'idb',detach:true});mark('canonical state',t,{clones:h.work.clones,cloneMs:h.work.cloneMs});
t=performance.now();const a=JSON.stringify(expected),b=JSON.stringify(canonical);mark('exact comparison',t,{chars:a.length,equal:a===b});
expected=null;canonical=null;if(global.gc)global.gc();
