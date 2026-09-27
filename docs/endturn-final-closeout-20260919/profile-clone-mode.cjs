const fs=require('fs'),path=require('path'),{createRequire}=require('module');const root=path.resolve(__dirname,'../..'),file=path.join(root,'web/scripts/smoke-full-turn-flow.js');
let source=fs.readFileSync(file,'utf8').replace(/^#!.*\n/,'');
source=source.replace('  const sandbox = loadGame();',`  const sandbox = loadGame();
  let calls=0; sandbox.structuredClone=function(value){const start=Date.now();try{const output=structuredClone(value);if(value===sandbox.P)console.log('CLONE_P_SUCCESS',Date.now()-start);return output;}catch(e){if(value===sandbox.P)console.log('CLONE_P_FAIL',Date.now()-start,e.message);throw e;}};
  const actual=sandbox._buildSaveState;sandbox._buildSaveState=function(opts){const p=opts&&opts.p||sandbox.P;
    console.log('PROJECT_SHAPE',Object.keys(p));console.log('SCENARIOS',p.scenarios&&p.scenarios.map(s=>({keys:Object.keys(s),frozen:Object.isFrozen(s),mapsame:s.map===s.mapData})));
    const t=Date.now(),r=actual.apply(this,arguments);console.log('SAVE_MS',Date.now()-t);return r;};`);
source=source.replace('  `, sandbox, { timeout: 10000 });\n  await delay(160);','  `, sandbox, { timeout: 120000 });\n  console.log("DIAGNOSTIC_START_DONE");process.exit(0);\n  await delay(160);');
new Function('require','__dirname','__filename','module','exports',source)(createRequire(file),path.dirname(file),file,{exports:{}},{});
