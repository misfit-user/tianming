const fs=require('fs'),path=require('path'),{createRequire}=require('module');const root=path.resolve(__dirname,'../..'),file=path.join(root,'web/scripts/smoke-full-turn-flow.js');
let source=fs.readFileSync(file,'utf8').replace(/^#!.*\n/,'');
source=source.replace('  const sandbox = loadGame();',`  const sandbox = loadGame();
  const original = sandbox._buildSaveState;
  sandbox._buildSaveState = function(options) {
    const p = options && options.p || sandbox.P;
    console.log('SAVE_INPUT_KEYS',JSON.stringify(Object.keys(p).map(k=>{let bytes=0;try{bytes=JSON.stringify(p[k]).length;}catch(_){}return {key:k,bytes};}).sort((a,b)=>b.bytes-a.bytes).slice(0,18)));
    const t=Date.now();const result=original.apply(this,arguments);console.log('SAVE_DURATION',Date.now()-t);return result;
  };`);
// Diagnostic only: allow observing the completed startup; production smoke keeps its 10000ms guard unchanged.
source=source.replace('  `, sandbox, { timeout: 10000 });\n  await delay(160);','  `, sandbox, { timeout: 120000 });\n  console.log("DIAGNOSTIC_STARTUP_DONE");return;\n  await delay(160);');
new Function('require','__dirname','__filename','module','exports',source)(createRequire(file),path.dirname(file),file,{exports:{}},{});
