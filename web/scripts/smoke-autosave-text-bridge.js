#!/usr/bin/env node
'use strict';
// Real preload, renderer and serial main autosave implementation. IPC/disk are
// controlled boundaries; parsing and disk envelope preparation use real source.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
let pass = 0;
async function check(name, fn) { await fn(); pass++; console.log('PASS ' + name); }
const plain = value => JSON.parse(JSON.stringify(value));
function mainBoundary(initialToken = 'autosave-text-session-0001') {
  const source=fs.readFileSync(path.join(root,'main-impl.js'),'utf8'),files=new Map(),handles={},sync={},events=[];
  const a=source.indexOf('const AUTO_SAVE_FILE ='),b=source.indexOf("ipcMain.handle('load-auto-save'",a);
  const p=source.indexOf('function normalizeDesktopSaveGeneration('),q=source.indexOf('function desktopSavePayloadStamp(',p);
  assert(a>=0&&b>a&&p>=0&&q>p);let parseCount=0,writeHook=null,renameHook=null,renames=0,ensures=0;
  const fakeFs={existsSync:file=>files.has(file),readFileSync:file=>{if(!files.has(file))throw Error('ENOENT');return files.get(file);},
    writeFileSync:(file,data)=>files.set(file,String(data)),renameSync:(from,to)=>{files.set(to,files.get(from));files.delete(from);},
    promises:{async writeFile(file,data){events.push('write-start');if(writeHook)await writeHook(file,data);files.set(file,String(data));events.push('write-end');},
      async rename(from,to){events.push('rename');renames++;files.set(to,files.get(from));files.delete(from);if(renameHook)await renameHook(from,to);},async unlink(file){files.delete(file);},async stat(file){return {size:Buffer.byteLength(files.get(file)||''),mtimeMs:1};}}};
  const observedJSON=Object.create(JSON);observedJSON.parse=function(text){parseCount++;events.push('parse');return JSON.parse(text);};
  const c={ipcMain:{handle:(name,fn)=>handles[name]=fn,on:(name,fn)=>sync[name]=fn},fs:fakeFs,path,SAVE_DIR:'memory-save',
    ensureSaveDir(){ensures++;},crypto:{randomUUID:()=> 'payload-generation-fixture-0001'},JSON:observedJSON,Promise,console,
    invalidateDesktopSaveGeneration(){},writeDesktopSaveMetadata(){}};
  vm.createContext(c);vm.runInContext(source.slice(p,q)+'\n'+source.slice(a,b),c,{filename:'main-impl.js actual autosave queue'});
  const rotate=value=>{const event={};sync['auto-save-session-rotate'](event,value);return event.returnValue;};
  const current=()=>{const event={};sync['auto-save-session-current'](event);return event.returnValue.token;};
  if(initialToken)rotate(initialToken);
  return {invoke:(channel,payload)=>handles[channel]({},plain(payload)),rotate,current,files,events,
    parseCount:()=>parseCount,renameCount:()=>renames,ensureCount:()=>ensures,setWriteHook:fn=>writeHook=fn,setRenameHook:fn=>renameHook=fn,
    disk:()=>files.get(path.join('memory-save','__autosave__.json'))};
}
function setup(initialToken) {
  const main=mainBoundary(initialToken);let api, reply=null, rendererParses=0;
  const calls = [];
  const ipc = { sendSync(channel, value) { return channel === 'auto-save-session-rotate' ? main.rotate(value) : {success:true,token:main.current()}; },
    invoke(channel, payload) { calls.push({ channel, payload:plain(payload) });return reply ? reply(channel,payload) : main.invoke(channel,payload); }, on() {}, removeListener() {} };
  const observedJSON=Object.create(JSON);observedJSON.parse=function(text){rendererParses++;return JSON.parse(text);};
  vm.runInNewContext(fs.readFileSync(process.env.TM_AUTOSAVE_PRELOAD_OVERRIDE||path.join(root, 'preload-impl.js'), 'utf8'), {
    require(name) { assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'tianming'); api = value; } }, ipcRenderer: ipc }; },
    process: { platform: process.platform }, Buffer, console, crypto: require('crypto').webcrypto,JSON:observedJSON
  }, { filename: 'preload-impl.js' });
  return { api, calls,main,rendererParses:()=>rendererParses,setReply(fn) { reply = fn; } };
}
const body=call=>Object.prototype.hasOwnProperty.call(call.payload,'dataJson')?JSON.parse(call.payload.dataJson):call.payload.data;
function renderer(api) {
  const source = fs.readFileSync(path.join(root, 'web/tm-save-lifecycle.js'), 'utf8');
  const start = source.indexOf('var _autoSaveInFlight=false;'), end = source.indexOf('if(_tmHasNativeFs()){', start);
  assert(start >= 0 && end > start);
  const c = { console: { warn() {}, error() {}, log() {} }, Date, setTimeout, clearTimeout,
    window: { _tmLoadGen: 1, tianming: api },
    GM: { running: true, turn: 8, sid: 'public-fixture', saveName: '保存😀', _campaignId: 'campaign-a', _timelineId: 'timeline-a' },
    P: { conf: {}, scenarios: [] }, deepClone: plain, _tmLiteSafeConf: plain, localStorage: { setItem() {}, removeItem() {} },
    findScenarioById: () => ({ name: '中文 e\u0301 😀' }) };
  vm.createContext(c); vm.runInContext(source.slice(start, end), c, { filename: 'tm-save-lifecycle.js' });
  c._tmAdoptCommittedWorldSnapshot({ GM: c.GM, P: c.P }, { transactionId: 'committed-a' });
  return c;
}
async function main() {
  const h = setup();
  await check('text capability exposed by actual preload', () => assert.equal(typeof h.api.autoSaveJson, 'function'));
  const data = { conf: { name: '正常 & < > " \' 中文😀 e\u0301' }, gameState: { turn: 8, missing: undefined, value: NaN } };
  await check('text and object paths produce identical JSON persistence envelopes', async () => {
    await h.api.autoSave(data);const original=h.main.disk();await h.api.autoSaveJson(JSON.stringify(data));
    assert.equal(h.calls[0].channel, 'auto-save'); assert.equal(h.calls[1].channel,'auto-save');assert.equal(h.main.disk(),original);
    assert.deepEqual(plain(body(h.calls[0])),plain(body(h.calls[1])));assert.equal(h.rendererParses(),0,'preload must not allocate a parsed copy of the whole text body');assert.equal(h.main.parseCount(),1);
    assert.equal(h.calls[1].payload.sessionToken, 'autosave-text-session-0001');
  });
  for (const value of ['{broken', 'null', '[]', '1', '"text"', null, {}]) {
    await check('malformed/non-object text is rejected without changing the real main disk or session: ' + String(value), async () => {
      const count=h.calls.length,bytes=h.main.disk(),token=h.main.current(),ensures=h.main.ensureCount();
      await assert.rejects(async () => h.api.autoSaveJson(value));assert.equal(h.calls.length,count+(typeof value==='string'?1:0));
      assert.equal(h.main.disk(),bytes);assert.equal(h.main.current(),token);assert.equal(h.main.ensureCount(),ensures);assert.equal(h.rendererParses(),0);
    });
  }
  await check('initial malformed text cannot create a main session or touch the canonical directory',async()=>{
    const f=setup('');assert.equal(f.main.current(),'');const before=[...f.main.files];
    await assert.rejects(f.api.autoSaveJson('{bad'),/JSON/);assert.equal(f.main.current(),'');assert.deepEqual([...f.main.files],before);assert.equal(f.main.ensureCount(),0);
  });
  await check('real main queue parses a second text only after the first write and rename complete',async()=>{
    const f=setup();let release,started;const ready=new Promise(r=>started=r);let writes=0;
    f.main.setWriteHook(async()=>{if(++writes===1){started();await new Promise(r=>release=r);}});
    const first=f.api.autoSaveJson('{"gameState":{"turn":1}}');await ready;
    const second=f.api.autoSaveJson('{"gameState":{"turn":2}}');await Promise.resolve();await Promise.resolve();
    assert.equal(f.main.parseCount(),1);assert.equal(f.main.renameCount(),0);assert.equal(f.calls.length,2);
    assert(f.calls.every(call=>typeof call.payload.dataJson==='string'&&!Object.prototype.hasOwnProperty.call(call.payload,'data')));
    release();assert.equal((await first).success,true);assert.equal((await second).success,true);
    assert.equal(f.main.parseCount(),2);assert.equal(JSON.parse(f.main.disk()).data.gameState.turn,2);assert.equal(f.rendererParses(),0);
    assert.deepEqual(f.main.events,['parse','write-start','write-end','rename','parse','write-start','write-end','rename']);
  });
  await check('queued malformed text still rejects after rotation and cannot overwrite the prior disk',async()=>{
    const f=setup();await f.api.autoSaveJson('{"gameState":{"turn":1}}');const before=f.main.disk();let release,started;
    const ready=new Promise(r=>started=r);f.main.setWriteHook(async()=>{started();await new Promise(r=>release=r);});
    const old=f.api.autoSaveJson('{"gameState":{"turn":2}}');await ready;
    const invalid=f.api.autoSaveJson('{bad'),rejected=assert.rejects(invalid,/JSON/);
    f.api.rotateAutoSaveSession('autosave-text-session-new-0002');release();assert.equal((await old).stale,true);await rejected;
    assert.equal(f.main.disk(),before);assert.equal(f.main.current(),'autosave-text-session-new-0002');assert.equal(f.main.renameCount(),1);
    f.main.setWriteHook(null);assert.equal((await f.api.autoSaveJson('{"gameState":{"turn":3}}')).success,true);assert.equal(JSON.parse(f.main.disk()).data.gameState.turn,3);
  });
  await check('rotation before queue dispatch rejects a valid obsolete text with no disk write',async()=>{
    const f=setup(),save=f.api.autoSaveJson('{"gameState":{"turn":1}}');f.api.rotateAutoSaveSession('autosave-text-session-new-0002');
    const result=await save;assert.equal(result.success,false);assert.equal(result.stale,true);assert.equal(f.main.disk(),undefined);assert.equal(f.main.renameCount(),0);
  });
  await check('the actual main write failure preserves disk, renderer bookkeeping and a later retry',async()=>{
    const f=setup(),c=renderer(f.api);assert.equal((await c._tmRunDesktopAutoSaveTick({force:true})).ok,true);const before=f.main.disk(),saved=c._autoSaveLastDoneMs;
    f.main.setWriteHook(async()=>{throw Error('disk full');});assert.equal((await c._tmRunDesktopAutoSaveTick({force:true})).ok,false);
    assert.equal(f.main.disk(),before);assert.equal(c._autoSaveLastDoneMs,saved);assert.equal(c._autoSaveInFlightPromise,null);
    f.main.setWriteHook(null);assert.equal((await c._tmRunDesktopAutoSaveTick({force:true})).ok,true);assert.equal(f.main.renameCount(),2);
  });
  await check('rotation during atomic rename cannot certify the old envelope or advance success time',async()=>{
    const f=setup(),c=renderer(f.api);f.main.setRenameHook(async()=>f.api.rotateAutoSaveSession('autosave-text-session-new-0002'));
    const result=await c._tmRunDesktopAutoSaveTick({force:true});assert.equal(result.ok,false);assert.equal(c._autoSaveLastDoneMs,0);
    assert.equal(JSON.parse(f.main.disk()).sessionToken,'autosave-text-session-0001');assert.equal(f.main.current(),'autosave-text-session-new-0002');
    f.main.setRenameHook(null);c._tmAdoptCommittedWorldSnapshot({GM:c.GM,P:c.P},{transactionId:'current-session-commit'});
    assert.equal((await c._tmRunDesktopAutoSaveTick({force:true})).ok,true);assert.equal(JSON.parse(f.main.disk()).sessionToken,f.main.current());
  });
  await check('an ambiguous or incorrectly typed transport cannot choose a weaker interpretation',async()=>{
    const f=setup();await f.api.autoSaveJson('{}');const before=f.main.disk(),token=f.main.current();
    for(const extra of [{data:{gameState:{turn:99}},dataJson:'{}'},{dataJson:null},{dataJson:{gameState:{turn:99}}}]){
      const result=await f.main.invoke('auto-save',{__tmAutoSaveEnvelope:1,sessionToken:token,...extra});
      assert.equal(result.success,false);assert.equal(result.code,'AUTO_SAVE_JSON_INVALID');assert.equal(f.main.disk(),before);assert.equal(f.main.current(),token);
    }
  });
  await check('IPC negative result and rejection remain observable', async () => {
    h.setReply(async () => ({ success: false, error: 'quota' })); assert.equal((await h.api.autoSaveJson('{}')).success, false);
    h.setReply(async () => { throw Error('transport'); }); await assert.rejects(h.api.autoSaveJson('{}'), /transport/);
    h.setReply(async () => ({ success: true }));
  });
  await check('session comes from preload, not JSON metadata', async () => {
    h.api.rotateAutoSaveSession('autosave-text-session-0002'); await h.api.autoSaveJson('{"sessionToken":"untrusted"}');
    assert.equal(h.calls.at(-1).payload.sessionToken, 'autosave-text-session-0002');
  });
  const c = renderer(h.api); let stringCalls = 0, objectCalls = 0;
  const text = h.api.autoSaveJson, object = h.api.autoSave;
  h.api.autoSaveJson = value => { assert.equal(typeof value, 'string'); stringCalls++; return text(value); };
  h.api.autoSave = value => { objectCalls++; return object(value); };
  await check('renderer selects text transport without changing committed world or live state', async () => {
    const before = JSON.stringify({ GM: c.GM, P: c.P, committed: c.lastCommittedSnapshot });
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
    assert.equal(stringCalls, 1); assert.equal(objectCalls, 0);
    assert.equal(JSON.stringify({ GM: c.GM, P: c.P, committed: c.lastCommittedSnapshot }), before);
    assert.deepEqual(plain(body(h.calls.at(-1)).gameState), c.GM);
  });
  await check('old shell keeps existing transport and frequency guards', async () => {
    delete h.api.autoSaveJson;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true); assert.equal(objectCalls, 1);
    h.api.autoSaveJson = text;
    c.GM.busy = true; const count = h.calls.length;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).deferred, true); assert.equal(h.calls.length, count); c.GM.busy = false;
  });
  await check('JSON failure is not retried through the object bridge and in-flight state resets', async () => {
    c.lastCommittedSnapshot.GM.bad = 1n; const count = h.calls.length;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, false);
    assert.equal(h.calls.length, count); assert.equal(c._autoSaveInFlight, false); assert.equal(c._autoSaveInFlightPromise, null);
    delete c.lastCommittedSnapshot.GM.bad;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
  });
  for (const transport of ['text', 'legacy']) {
    await check(transport + ': failed write never advances success clock/turn, retry still succeeds', async () => {
      if (transport === 'legacy') delete h.api.autoSaveJson; else h.api.autoSaveJson = text;
      c._autoSaveLastDoneMs = 123; c._autoSaveLastSavedTurn = 4;
      for (const fail of [async () => ({ success: false, error: 'quota' }), async () => { throw Error('write'); }]) {
        h.setReply(fail); assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, false);
        assert.equal(c._autoSaveLastDoneMs, 123); assert.equal(c._autoSaveLastSavedTurn, 4);
        assert.equal(c._autoSaveInFlight, false); assert.equal(c._autoSaveInFlightPromise, null);
      }
      h.setReply(async () => ({ success: true })); assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
      assert(c._autoSaveLastDoneMs > 123); assert.equal(c._autoSaveLastSavedTurn, 8);
      h.api.autoSaveJson = text;
    });
  }
  await check('late IPC does not mark the replacement world saved; overlapping call does not write twice', async () => {
    let release; h.setReply(() => new Promise(resolve => { release = resolve; }));
    const a = c._tmRunDesktopAutoSaveTick({ force: true }); await Promise.resolve();
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).reason, 'in-flight');
    c.GM = { ...c.GM, _timelineId: 'timeline-b' }; h.api.rotateAutoSaveSession('autosave-text-session-0003');
    release({ success: true }); assert.equal((await a).stale, true); assert.equal(c._autoSaveInFlightPromise, null);
    h.setReply(async () => ({ success: true }));
    c._tmAdoptCommittedWorldSnapshot({ GM: c.GM, P: c.P }, { transactionId: 'committed-b' });
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
    assert.equal(body(h.calls.at(-1)).gameState._timelineId, 'timeline-b');
  });
  console.log(`autosave text bridge: ${pass} PASS, 0 FAIL`);
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
