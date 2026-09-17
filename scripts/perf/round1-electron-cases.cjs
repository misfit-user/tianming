'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto'), { monitorEventLoopDelay } = require('perf_hooks');
const { app } = require('electron');
module.exports = async function({ win, root, temp, check, recordPerformance }) {
  const js = code => win.webContents.executeJavaScript(code), sleep = ms => new Promise(r => setTimeout(r, ms));
  const report = { samples: [], mainIo: [], startup: await js('({navigation:performance.getEntriesByType("navigation")[0].toJSON(),visibility:document.visibilityState})'),
    scope: 'visible unpackaged Electron; production main/preload, official new-game bootstrap and load; isolated public scenario samples; external network denied',
    notes: ['DOM mutation counts are added/removed roots, not all descendants; rebuild IDs do not force a visibility/layout query', 'async compression/checksum spans overlap and are wall time', 'main RSS is sampled every 25 ms, not an absolute peak guarantee', 'load forks timeline by design', 'new-game samples use actual initialization; load/save comparison uses identical shared long-history snapshot bytes', 'metrics include 100 ms post-operation settling; wallMs excludes that settling', 'draft updatedAt clock is fixed only for the synchronous equality assertion, never for measurements'] };
  recordPerformance(report);
  win.show(); win.setSize(1280, 800);
  win.webContents.debugger.attach('1.3'); await win.webContents.debugger.sendCommand('Performance.enable');
  const metrics = async () => Object.fromEntries((await win.webContents.debugger.sendCommand('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const cpuDelay = monitorEventLoopDelay({ resolution: 10 }); cpuDelay.enable();
  let active = false, rssPeak = 0;
  const rssTimer = setInterval(() => { if (active) rssPeak = Math.max(rssPeak, process.memoryUsage().rss); }, 25);
  const originals = {};
  for (const name of ['writeFileSync', 'fsyncSync', 'renameSync']) {
    originals[name] = fs[name]; fs[name] = function(...args) {
      const start = performance.now(); try { return originals[name].apply(this, args); }
      finally { if (active) report.mainIo.push({ operation: name, ms: performance.now() - start }); }
    };
  }
  const stringify = JSON.stringify;
  JSON.stringify = function(...args) { const t = performance.now(); try { return stringify.apply(this, args); } finally { if (active) report.mainIo.push({ operation: 'JSON.stringify', ms: performance.now() - t }); } };
  await js(`(() => {
    window.__pr1 = { active:false, timings:{}, frames:[], longTasks:[], mutations:0, removed:0, rebuilds:{}, calls:{} };
    const m = __pr1;
    function wrap(obj, key, label) { const old=obj[key]; if(typeof old!=='function')throw Error('missing measured function '+key);
      obj[key]=function(...args){if(!m.active)return old.apply(this,args);const t=performance.now();try{return old.apply(this,args);}finally{(m.timings[label] ||= []).push(performance.now()-t);m.calls[label]=(m.calls[label]||0)+1;}};
    }
    for (const name of ['_buildSaveState','_autoSaveSnapshotGM','_prepareGMForSave','_ensureGMDefaults','_ensurePDefaults','deepClone','renderGameState']) wrap(window,name,name);
    wrap(JSON,'stringify','JSON.stringify'); wrap(TextEncoder.prototype,'encode','UTF8.encode');
    const html = Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){ if(m.active){const key=this.id||this.tagName;m.rebuilds[key]=(m.rebuilds[key]||0)+1;}return html.set.call(this,value);}});
    new MutationObserver(rows=>{if(m.active)for(const r of rows){m.mutations+=r.addedNodes.length;m.removed+=r.removedNodes.length;}}).observe(document,{subtree:true,childList:true});
    new PerformanceObserver(list=>{if(m.active)for(const e of list.getEntries())m.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});
    let prev; function frame(t){ if(m.active&&prev)m.frames.push(t-prev);prev=t;requestAnimationFrame(frame); }requestAnimationFrame(frame);
    m.begin=()=>{m.timings={};m.frames=[];m.longTasks=[];m.mutations=0;m.removed=0;m.rebuilds={};m.calls={};TM.perf.reset();m.active=true;};
    m.end=()=>{m.active=false;return {timings:m.timings,calls:m.calls,frames:m.frames,longTasks:m.longTasks,addedRoots:m.mutations,removedRoots:m.removed,rebuilds:m.rebuilds,perf:TM.perf.report(),work:TM.perf.workReport(),heap:performance.memory&&performance.memory.usedJSHeapSize,visibility:document.visibilityState};};
    true;
  })()`);
  async function measure(name, fn) {
    await sleep(120); const before = await metrics(), index = report.mainIo.length; cpuDelay.reset(); rssPeak = process.memoryUsage().rss;
    await js('__pr1.begin();true'); active = true; const t = performance.now();
    let value, wallMs; try { value = await fn(); } finally { wallMs = performance.now() - t; await sleep(100); active = false; }
    const renderer = await js('__pr1.end()'), after = await metrics();
    report.samples.push({ name, wallMs, renderer, metricsBefore: before, metricsAfter: after, mainIo: report.mainIo.slice(index),
      mainLoopDelay: { maxMs: cpuDelay.max / 1e6, p95Ms: cpuDelay.percentile(95) / 1e6 }, mainRssSampledPeakBytes: rssPeak, value });
    console.log('PERF_CASE', name, wallMs.toFixed(1)); return value;
  }
  const sampleDir = process.env.TM_PERF_SAMPLE_DIR; fs.mkdirSync(sampleDir, { recursive: true });
  try {
    for (const sid of ['sc-jianyan1-1127-shaosong', 'sc-tianqi7-1627']) {
      await measure(sid + '/new-game', async () => js(`(async()=>{if(P.ai&&P.ai.key)throw Error('unexpected API credential');P.conf.fixedSeed='perf-round1';await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});doActualStart(${JSON.stringify(sid)});await _tmAwaitLoadBarrier();return {sid:GM.sid,chars:GM.chars.length,regions:GM.mapData.regions.length};})()`));
      await sleep(400);
      await check(sid + ': full-provider canonical builder matches legacy preparation and preserves live', async () => {
        const result = await js(`(()=>{const now=Date.now,fixed=now();Date.now=()=>fixed;try{const before=JSON.stringify({GM,P}),oldGM=GM,oldP=P;
          const g=_autoSaveSnapshotGM(GM,{detach:true}),p=deepClone(P),prepared=_prepareGMForSave(g,p);
          const expected={GM:_autoSaveSnapshotGM(prepared.GM,{reuseMutable:true,detach:true}),P:_tmStripAiKeyInPlace(prepared.P)};delete expected.P.gameState;
          const actual=_buildSaveState({format:'idb',detach:true});
          const differences=[];function diff(a,b,p){if(differences.length>=10||JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p+'.'+k);}else differences.push({path:p,expected:a,actual:b});}diff(expected,actual,'state');
          return {equal:JSON.stringify(expected)===JSON.stringify(actual),differences,live:before===JSON.stringify({GM,P})&&oldGM===GM&&oldP===P,
            providers:[typeof ChronicleSystem.serialize,typeof WarWeightSystem.serialize,typeof OpinionSystem.getAllEventOpinions,typeof StoryEventBus.serialize,typeof TM.PopulationSchema.normalize]};}finally{Date.now=now;}})()`);
        assert.equal(result.equal, true, 'saved state differs: '+JSON.stringify(result.differences)); assert.equal(result.live, true, 'live GM/P changed'); assert.deepEqual(result.providers, Array(5).fill('function'));
      });
      const sampleFile = path.join(sampleDir, sid + '.json');
      if (!fs.existsSync(sampleFile)) {
        const sample = await js(`(()=>{const sample=_buildSaveState({format:'project',detach:true});const rows=()=>Array.from({length:800},(_,turn)=>({turn,text:'受控虚构历史，无玩家私密信息。😀'.repeat(12)}));
          for(const k of ['_convArchive','letters','_edictTracker','_edictSuggestions','_npcActionLedger','_chronicle','culturalWorks','_edictLifecycle','_courtRecords','_memoryArchiveFull','battleHistory'])sample.gameState[k]=rows();
          sample.gameState.turn=800;sample.gameState._campaignId='perf_shared';sample.gameState._timelineId='tml_perf_shared';return sample;})()`);
        fs.writeFileSync(sampleFile, stringify(sample));
      }
      const raw = fs.readFileSync(sampleFile, 'utf8');
      await js('window.__perfSharedInput=' + raw + ';true');
      await measure(sid + '/load-long-history', async () => {
        await js(`(async()=>{await fullLoadGame(deepClone(__perfSharedInput),{source:'perf-isolated'});await _tmAwaitLoadBarrier();return true;})()`);
        return { sampleSha256: crypto.createHash('sha256').update(raw).digest('hex'), sampleBytes: Buffer.byteLength(raw), controlledTurns: 800 };
      });
      for (let j = 0; j < 3; j++) {
        await measure(sid + '/snapshot-' + j, () => js(`(()=>{const t=performance.now();window.__perfSaved=_buildSaveState({format:'idb',detach:true});return {ms:performance.now()-t,turn:__perfSaved.GM.turn};})()`));
        await measure(sid + '/canonical-' + j, () => js(`(async()=>{const p=await TM_SaveDB.createCanonicalPayload(__perfSaved,{campaignId:GM._campaignId,timelineId:GM._timelineId,turn:GM.turn});return {bytes:p.jsonByteLength,compressedBytes:p.compressedByteLength};})()`));
        await measure(sid + '/map-rebuild-' + j, () => js(`(()=>{TMPhase8FormalBridge.home();TMPhase8FormalBridge.map.invalidateFormalMap();TMPhase8FormalBridge.map.renderFormalMap();const svg=document.getElementById('tmf-formal-map');if(!svg||!svg.getClientRects().length)throw Error('formal map not visible');const rows=sel=>Array.from(svg.querySelectorAll(sel)).map(p=>p.getAttribute('d')),wash=rows('.tmf-region-wash'),halo=rows('.tmf-region-halo'),face=rows('.tmf-region');if(!face.length||JSON.stringify(wash)!==JSON.stringify(halo)||JSON.stringify(wash)!==JSON.stringify(face))throw Error('rendered path layers differ');return {regionPaths:face.length,paths:svg.querySelectorAll('path').length};})()`));
      }
      await measure(sid + '/panel-switch', () => js(`(()=>{const r=TMPhase8FormalBridge.rightrail.renderers;const slots=Object.keys(r).filter(k=>['army','policy','treasury','finance','office'].includes(k)).slice(0,2);if(!slots.length)throw Error('no actual panel');for(const s of slots)TMPhase8FormalBridge.openPanel(s);TMPhase8FormalBridge.home();return slots;})()`));
      await measure(sid + '/map-wheel-pan', () => js(`(()=>{const stage=document.getElementById('ming-map-layer')||document.getElementById('tmf-map-stage');if(!stage)throw Error('missing map stage');
        stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:600,clientY:300,bubbles:true,cancelable:true}));
        stage.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,clientX:600,clientY:300,bubbles:true}));
        stage.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:650,clientY:330,bubbles:true}));
        stage.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:650,clientY:330,bubbles:true}));return {kind:'synthetic DOM pointer/wheel, not physical input'};})()`));
      await measure(sid + '/open-edict-panel', () => js('TMPhase8FormalBridge.openZhao();true'));
      win.focus();
      await measure(sid + '/chinese-input-next-frame', async () => {
        await js(`(()=>{const el=Array.from(document.querySelectorAll('[data-desk-edict-cat]')).find(e=>e.getClientRects().length);if(!el)throw Error('missing visible edict draft');el.focus();if(document.activeElement!==el)throw Error('draft focus failed');window.__inputFrame=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('insertText produced no input event')),5000);el.addEventListener('input',()=>{const t=performance.now();clearTimeout(timer);requestAnimationFrame(()=>resolve(performance.now()-t));},{once:true});});true;})()`);
        await win.webContents.insertText('中文输入延迟样本😀');
        return { inputToNextFrameMs: await js('__inputFrame'), kind: 'programmatic insertText; NOT real IME composition' };
      });
      await measure(sid + '/manual-save-real-ipc', async () => {
        const ok = await js(`(async()=>{let el=document.getElementById('save-name-inp');if(!el){el=document.createElement('input');el.id='save-name-inp';document.body.appendChild(el);}el.value='perf-isolated';return await desktopDoSave();})()`);
        assert.equal(ok, true); const saved = await js(`window.tianming.loadProject('perf-isolated')`);
        assert.equal(saved.success, true); assert.equal(saved.data.gameState.turn, 800);
        assert(JSON.stringify(saved.data.gameState._phase8FormalDrafts).includes('中文输入延迟样本😀'), 'actual typed draft must persist');
        return { saved: true, readBack: true };
      });
      await measure(sid + '/background-save-flush', async () => {
        const result = await js(`(async()=>{const r=await requestBackgroundAutosave({reason:'perf-controlled-summary'});await _tmAwaitBackgroundAutosaves();const flush=await _tmFlushBackgroundAutosavesForClose();return {requested:r.ok,flushed:flush.ok,reason:flush.reason,quiet:!_backgroundSavePending&&!_backgroundSaveInFlight&&!_autoSaveInFlightPromise&&!_autoSaveDeferred};})()`);
        assert.equal(result.requested, true); assert.equal(result.flushed, true); assert.equal(result.quiet, true); return result;
      });
    }
    report.rendererProcessMemory = app.getAppMetrics().find(p => p.pid === win.webContents.getOSProcessId())?.memory;
    report.mainIo = undefined; return report;
  } finally {
    active = false; clearInterval(rssTimer); cpuDelay.disable(); JSON.stringify = stringify;
    for (const name of Object.keys(originals)) fs[name] = originals[name];
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
  }
};
