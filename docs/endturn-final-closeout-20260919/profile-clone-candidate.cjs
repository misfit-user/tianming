const fs=require('fs'),path=require('path'),{createRequire}=require('module');const root=path.resolve(__dirname,'../..'),file=path.join(root,'web/scripts/smoke-full-turn-flow.js');
let source=fs.readFileSync(file,'utf8').replace(/^#!.*\n/,'');
const candidate=fs.readFileSync(path.join(__dirname,'clone-candidate.fragment.js'),'utf8').replace('return deepClone(value);','return __originalClone(value);');
source=source.replace('  const sandbox = loadGame();',`  const sandbox = loadGame();
  vm.runInContext(${JSON.stringify('var __originalClone=deepClone;\n'+candidate+'\ndeepClone=function(v){return v===P?_tmClonePersistenceData(v):__originalClone(v);};')},sandbox);
  const original=sandbox._buildSaveState;sandbox._buildSaveState=function(){const t=Date.now(),result=original.apply(this,arguments);console.log('FAST_SAVE_MS',Date.now()-t);return result;};`);
source=source.replace('  `, sandbox, { timeout: 10000 });\n  await delay(160);','  `, sandbox, { timeout: 120000 });\n  console.log("DIAGNOSTIC_START_DONE");process.exit(0);\n  await delay(160);');
new Function('require','__dirname','__filename','module','exports',source)(createRequire(file),path.dirname(file),file,{exports:{}},{});
