'use strict';
// Offline production routing checks: the chosen API tier must resolve before retry budgets.
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
const {transport, load} = require('./lib-turn-reliability');
const tests = [];
const test = (name, fn) => tests.push({name, fn});
const bad = () => ({ok:false, status:502, headers:{get(){return null;}}, text:async()=>'{"error":"fixture"}'});
const good = (content='{"events":[]}') => ({ok:true, status:200, headers:{get(){return 'application/json';}}, json:async()=>({choices:[{message:{content}, finish_reason:'stop'}]})});
function fixture({secondary, overrides={}, useSecondary=true}={}) {
  const f = transport(), c = f.c;
  c._dbg = () => {};
  c.extractJSON = text => {try {return JSON.parse(text);} catch (_) {return null;}};
  c.TM.Endturn.AI = {};
  c.P.conf.aiCallRetryOverrides = overrides;
  if (secondary !== undefined) c.P.conf.aiSecondaryRetryCount = secondary;
  c.P.ai.tier = 'primary';
  c.P.ai.secondary = {tier:'secondary', model:'secondary-fixture', url:'https://secondary.fixture.invalid/v1', key:'secondary-fixture-only'};
  c._useSecondaryTier = () => useSecondary;
  c._getAITier = tier => tier === 'secondary' && useSecondary ? c.P.ai.secondary : c.P.ai;
  c._buildAIUrlForTier = tier => c._getAITier(tier).url + '/chat/completions';
  c._aiRetryDelay = () => 1;
  ['tm-call-retry-policy.js', 'tm-endturn-ai-sc1-budget.js', 'tm-endturn-ai.js'].forEach(file => load(c, file));
  const ctx = c.TM.Endturn.AI.subcalls.setupInfra({});
  f.endturn = ctx.subcalls._callEndturnAI;
  f.call = opts => ctx.subcalls._callEndturnAI({model:'primary-fixture', messages:[{role:'user',content:'offline routing fixture'}]}, {id:'sc19', ...opts});
  return f;
}
for (const [label, secondary, expected] of [['default',undefined,1],['zero',0,0],['eight',8,8],['twenty',20,20]]) {
  test('secondary '+label+' retries bypass the turn fallback and old eight-attempt budget', async () => {
    const f = fixture({secondary, overrides:{'*':4}}), sent=[];
    try {
      f.c.fetch = async (url, init) => {sent.push({url,body:JSON.parse(init.body)});return bad();};
      await assert.rejects(f.call());
      assert.equal(sent.length, expected+1);
      assert(sent.every(row => row.url === 'https://secondary.fixture.invalid/v1/chat/completions'));
      assert(sent.every(row => row.body.model === 'secondary-fixture'));
    } finally {f.dispose();}
  });
}
test('primary calls retain the turn-wide retry fallback', async () => {
  const f=fixture({secondary:0,overrides:{'*':3}}), urls=[];
  try {f.c.fetch=async url=>{urls.push(url);return bad();};await assert.rejects(f.call({id:'sc0'}));assert.equal(urls.length,4);assert(urls.every(url=>url==='https://fixture.invalid/v1/chat/completions'));} finally {f.dispose();}
});
test('disabled secondary routing retains primary defaults for secondary-eligible IDs', async () => {
  const f=fixture({secondary:0,overrides:{'*':3},useSecondary:false});let sent=0;
  try {f.c.fetch=async()=>{sent++;return bad();};await assert.rejects(f.call());assert.equal(sent,4);} finally {f.dispose();}
});
test('a call-specific override takes priority over the secondary zero setting', async () => {
  const f=fixture({secondary:0,overrides:{sc19:3}});let sent=0;
  try {f.c.fetch=async()=>{sent++;return bad();};await assert.rejects(f.call());assert.equal(sent,4);} finally {f.dispose();}
});
test('changing settings after the budget is built cannot extend the active request', async () => {
  const f=fixture({secondary:1});let sent=0;const create=f.c._aiCreateRetryBudget;
  try {f.c._aiCreateRetryBudget=opts=>{const budget=create(opts);f.c.P.conf.aiSecondaryRetryCount=20;return budget;};f.c.fetch=async()=>{sent++;return bad();};await assert.rejects(f.call());assert.equal(sent,2);} finally {f.dispose();}
});
test('resolved recovery attempts retain zero inner retries and the same ticket', async () => {
  const f=fixture({secondary:20}), ticket={id:'sc19',limit:1,attempts:0};let received;
  try {f.c._aiFetchWithRetry=async(_url,_body,_signal,opts)=>{received=opts;return (await good().json());};await f.call({maxRetries:0,_turnRetriesResolved:true,_configuredRetries:false,_normalRecoveryTicket:ticket,_recoveryValidationRetry:true});assert.equal(received.maxRetries,0);assert.equal(received._turnRetriesResolved,true);assert.equal(received._configuredRetries,false);assert.equal(received._normalRecoveryTicket,ticket);assert.equal(received._recoveryValidationRetry,true);} finally {f.dispose();}
});
test('JSON repair uses the same secondary tier and shared budget with its own retry setting', async () => {
  const f=fixture({secondary:3});let sent=0;const urls=[];
  try {f.c.fetch=async url=>{urls.push(url);sent++;return sent===1?good('invalid JSON'):sent<5?bad():good();};const result=await f.call({expectedKeys:['events']});assert.equal(sent,5);assert.equal(result.parse.repaired,true);assert.equal(result.parsed.events.length,0);assert(urls.every(url=>url==='https://secondary.fixture.invalid/v1/chat/completions'));} finally {f.dispose();}
});
test('an explicit repair override remains distinct from the original call override', async () => {
  const f=fixture({secondary:0,overrides:{'sc19:repair':2}});let sent=0;
  try {f.c.fetch=async()=>{sent++;return sent===1?good('invalid JSON'):bad();};const result=await f.call({expectedKeys:['events']});assert.equal(sent,4);assert.equal(result.parse.failed,true);} finally {f.dispose();}
});

const followupSource = fs.readFileSync(path.join(__dirname,'../tm-endturn-followup.js'),'utf8');
const followupCalls = new Map(), followupRepairs = new Map();let followupWrapper='';
(function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type==='FunctionDeclaration' && node.id.name==='_callFollowupAI') followupWrapper=followupSource.slice(node.start,node.end);
  if (node.type==='CallExpression' && ['_callFollowupAI','_parseOrRepairJsonResult'].includes(node.callee.name)) {
    const opts=node.arguments[node.callee.name==='_callFollowupAI'?1:3];
    const id=opts&&opts.type==='ObjectExpression'&&opts.properties.find(row=>row.key.name==='id');
    if(id&&['sc_audit','sc25','sc_consolidate'].includes(id.value.value)) (node.callee.name==='_callFollowupAI'?followupCalls:followupRepairs).set(id.value.value,followupSource.slice(opts.start,opts.end));
  }
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
})(acorn.parse(followupSource,{ecmaVersion:'latest'}));
function followupFixture(f) {
  const c=f.c,body={model:c.P.ai.secondary.model,messages:[{role:'user',content:'offline followup fixture'}]};
  Object.assign(c,{url:c.P.ai.url+'/chat/completions',_callEndturnAI:f.endturn,_getCallPolicy:c.TM.Endturn.AI.subcalls.getCallPolicy,
    _auTier:'secondary',_t25:'secondary',_tCons:'secondary',_auCfg:c.P.ai.secondary,_c25:c.P.ai.secondary,_cCons:c.P.ai.secondary,
    _auUrl:c.P.ai.secondary.url+'/chat/completions',_u25:c.P.ai.secondary.url+'/chat/completions',_uCons:c.P.ai.secondary.url+'/chat/completions',
    _auditBody:body,_sc25Body:body,_consolidateBody:body});
  vm.runInContext(followupWrapper,c,{filename:'tm-endturn-followup.js:_callFollowupAI'});
  return body;
}
for(const id of ['sc_audit','sc25','sc_consolidate'])for(const secondary of [0,1,20])test('actual followup '+id+' call and repair retain secondary retries '+secondary,async()=>{
  const f=fixture({secondary,overrides:{'*':4}});let sent=0;
  try {
    const body=followupFixture(f);assert(followupCalls.has(id));assert(followupRepairs.has(id));
    const opts=vm.runInContext('('+followupCalls.get(id)+')',f.c),repair=vm.runInContext('('+followupRepairs.get(id)+')',f.c);
    assert.equal(opts.tier,'secondary');assert.equal(repair.tier,'secondary');assert.equal(repair.id,id);
    assert.equal(f.c.TM.CallRetryPolicy.options({...repair,id:repair.id+':repair'}).maxRetries,secondary);
    f.c.fetch=async()=>{sent++;return bad();};await assert.rejects(f.c._callFollowupAI(body,opts));assert.equal(sent,secondary+1);
  }finally{f.dispose();}
});
test('followup wrapper preserves an already resolved retry snapshot and recovery ownership',async()=>{
  const f=fixture({secondary:20}),ticket={id:'sc25',limit:1,attempts:0};let received;
  try {const body=followupFixture(f);f.c._callEndturnAI=async(_body,opts)=>{received=opts;return {};};await f.c._callFollowupAI(body,{id:'sc25',tier:'secondary',maxRetries:0,_turnRetriesResolved:true,_configuredRetries:false,_normalRecoveryTicket:ticket,_recoveryValidationRetry:true});assert.equal(received.tier,'secondary');assert.equal(received.maxRetries,0);assert.equal(received._turnRetriesResolved,true);assert.equal(received._normalRecoveryTicket,ticket);assert.equal(received._recoveryValidationRetry,true);}finally{f.dispose();}
});
test('followup explicit providers falling back to primary report their actual tier',()=>{
  const f=fixture();try {followupFixture(f);f.c._auCfg=f.c._c25=f.c._cCons=f.c.P.ai;for(const id of ['sc_audit','sc25','sc_consolidate'])for(const source of [followupCalls,followupRepairs])assert.equal(vm.runInContext('('+source.get(id)+')',f.c).tier,'primary');}finally{f.dispose();}
});


const shizhengSource=fs.readFileSync(path.join(__dirname,'../tm-shizheng-panel.js'),'utf8');
const ministerNode=acorn.parse(shizhengSource,{ecmaVersion:'latest'}).body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='_mzSpeakMinister');
function ministerFixture(f) {
  const c=f.c,target={textContent:'waiting'};
  c.document={getElementById:()=>target};c._mzPromptComposerAddon=()=>'';c._mzDlg={issue:{title:'fixture',description:''},history:[],perMinisterReplies:{}};
  c._buildAIUrl=()=>c.P.ai.url+'/chat/completions';
  vm.runInContext(shizhengSource.slice(ministerNode.start,ministerNode.end),c,{filename:'tm-shizheng-panel.js:_mzSpeakMinister'});
  return target;
}
for(const secondary of [0,1,20])test('minister stream exhaustion cannot reopen its secondary allowance '+secondary,async()=>{
  const f=fixture({secondary});let sent=0,fallback=0;
  try {const target=ministerFixture(f);f.c.fetch=async()=>{sent++;return bad();};f.c.callAI=async()=>{fallback++;return 'unexpected duplicate';};await f.c._mzSpeakMinister({name:'fixture'},'fixture-block',0);assert.equal(sent,secondary+1);assert.equal(fallback,0);assert.equal(f.c._mzDlg.history.length,0);assert(target.textContent.includes('API'));}finally{f.dispose();}
});
test('minister partial streaming output is retained and never regenerated after interruption',async()=>{
  const f=fixture({secondary:20});let fallback=0;
  try {const target=ministerFixture(f);f.c.callAIMessagesStream=async(_messages,_tokens,opts)=>{opts.onChunk('partial fixture reply');throw new TypeError('network interrupted');};f.c.callAI=async()=>{fallback++;return 'unexpected duplicate';};await f.c._mzSpeakMinister({name:'fixture'},'fixture-block',0);assert.equal(fallback,0);assert.equal(target.textContent,'partial fixture reply');assert.equal(f.c._mzDlg.history.length,0);}finally{f.dispose();}
});
for(const code of ['AI_ABORTED','AI_STALE_WORLD','AI_REQUEST_DEADLINE'])test('minister terminal '+code+' does not trigger a fresh request',async()=>{
  const f=fixture({secondary:1});let fallback=0;
  try {ministerFixture(f);f.c.callAIMessagesStream=async()=>{throw Object.assign(new Error(code),{code});};f.c.callAI=async()=>{fallback++;return 'unexpected duplicate';};await f.c._mzSpeakMinister({name:'fixture'},'fixture-block',0);assert.equal(fallback,0);assert.equal(f.c._mzDlg.history.length,0);}finally{f.dispose();}
});
test('minister nonterminal protocol fallback remains available before any stream content',async()=>{
  const f=fixture({secondary:1});let fallback=0;
  try {const target=ministerFixture(f);f.c.callAIMessagesStream=async()=>{throw Object.assign(new Error('fixture protocol not supported'),{code:'fixture-protocol'});};f.c.callAI=async()=>{fallback++;return 'complete compatible reply';};await f.c._mzSpeakMinister({name:'fixture'},'fixture-block',0);assert.equal(fallback,1);assert.equal(target.textContent,'complete compatible reply');assert.equal(f.c._mzDlg.history.length,1);}finally{f.dispose();}
});

(async()=>{let pass=0,fail=0;for(const t of tests)try{await t.fn();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
