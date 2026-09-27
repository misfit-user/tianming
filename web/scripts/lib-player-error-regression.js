'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn'), {createRequire} = require('module');
const ROOT = path.resolve(__dirname, '..'), quiet = {log(){},warn(){},error(){},info(){}};
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
function functions(source) {
  const out = new Map();
  function visit(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'FunctionDeclaration' && n.id) out.set(n.id.name, source.slice(n.start,n.end));
    for (const v of Object.values(n)) { if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v); }
  }
  visit(acorn.parse(source,{ecmaVersion:'latest'})); return out;
}
function context(extra={}) {
  const c={console:quiet,JSON,Math,Date,Promise,Map,Set,Number,String,Object,Array,Error,AbortController,setTimeout,clearTimeout,...extra};
  c.window=c;c.global=c;c.globalThis=c;return vm.createContext(c);
}
function load(c,file) { vm.runInContext(read(file),c,{filename:file}); }
function extracted(c,file,names) { const f=functions(read(file)); for(const n of names) { if(!f.has(n))throw Error('Missing '+n); vm.runInContext(f.get(n),c,{filename:file+':'+n}); } }
function fixturePrefix(name,marker,exports) {
  const file=path.join(__dirname,name),source=fs.readFileSync(file,'utf8').replace(/^#!.*\n/,''),at=source.indexOf(marker);
  if(at<0)throw Error('Unknown test helper boundary');
  return new Function('require','__dirname',source.slice(0,at)+'\nreturn '+exports+';')(createRequire(file),path.dirname(file));
}
const W=fixturePrefix('smoke-ai-writeback-integrity.js','async function main()','{makeContext,baseGM}');
const Pop=fixturePrefix('smoke-population-faction-ledger.js',"console.log('[smoke-population-faction-ledger]');",'{makeRuntime,totals}');
function writer() { const c=W.makeContext();load(c,'tm-ai-result-contract.js');return c; }
function baseGM(extra) { return W.baseGM(extra); }
function population() {
  const out=Pop.makeRuntime();out.context.console=quiet;
  const f=functions(read('tm-economy-engine.js'));
  for(const [name,code]of f) if(/^_env|^_collectEnv|^_allocateEnvironmentLoss|^_applyEnvironmentPopulationLoss|^_tickOverloadFeedback/.test(name))vm.runInContext(code,out.context,{filename:'environment:'+name});
  return out;
}
function mainContext() {
  const c=context({_aiDepth:'full',_dbg(){},ctx:{results:{},meta:{},record:{}},GM:baseGM({_turnAiResults:{},_aiDispatchStats:{byId:{},totalCalls:0,totalTime:0,errors:0},_subcallTimings:{}}),P:{ai:{key:'fixture-only'},conf:{}},TM:{},ns:{getCallPolicy:()=>({subcallRetries:0})},_formatAIError:e=>({message:e.message,status:e.status||0,snippet:''})});
  load(c,'tm-ai-infra-retry.js');load(c,'tm-ai-result-contract.js');
  extracted(c,'tm-endturn-ai.js',['_runSubcall','_seedRecordFromP1ForApplyFailure']);return c;
}
async function run(tests) {
  let pass=0,fail=0;
  for(const {name,fn}of tests)try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}
  console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;
}
module.exports={ROOT,read,functions,context,load,extracted,writer,baseGM,population,mainContext,run,vm};
