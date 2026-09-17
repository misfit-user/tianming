'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const { monitorEventLoopDelay } = require('perf_hooks');
// Same real main/preload and public samples as round 1, focused on the CUA-observed stall.
module.exports = async function({ win, root, temp, check, recordPerformance }) {
  const js = code => win.webContents.executeJavaScript(code), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const report = { samples: [], scope: 'real unpackaged Electron, production bridge, isolated public samples; forced production autosave tick, not an AI turn or physical IME benchmark' };
  recordPerformance(report); win.show();
  const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
  const stringify = JSON.stringify; let active = false, mainStringify = [];
  JSON.stringify = function(...args) { const start = performance.now(); try { return stringify.apply(this, args); }
    finally { if (active) mainStringify.push(performance.now() - start); } };
  try {
    await js(`(()=>{const m=window.__autosavePerf={active:false,tasks:[],frames:[]};let previous;
      function frame(t){if(m.active&&previous)m.frames.push(t-previous);previous=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
      new PerformanceObserver(list=>{if(m.active)for(const e of list.getEntries())m.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});
      m.begin=()=>{m.tasks=[];m.frames=[];m.active=true;TM.perf.reset();};m.end=()=>{m.active=false;return {longTasks:m.tasks,frames:m.frames,perf:TM.perf.report(),heap:performance.memory&&performance.memory.usedJSHeapSize};};return true;})()`);
    const scenarios = process.env.TM_PERF_SCENARIO ? [process.env.TM_PERF_SCENARIO] : ['sc-jianyan1-1127-shaosong','sc-tianqi7-1627'];
    for (const sid of scenarios) {
      assert(['sc-jianyan1-1127-shaosong','sc-tianqi7-1627'].includes(sid));
      const file = path.join(process.env.TM_PERF_SAMPLE_DIR, sid + '.json'), bytes = fs.readFileSync(file), raw = bytes.toString('utf8');
      report.stage = sid + '/new-game';
      await js(`(async()=>{if(P.ai&&P.ai.key)throw Error('unexpected API credential');await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});P.conf.fixedSeed='perf-round1';doActualStart(${JSON.stringify(sid)});await _tmAwaitLoadBarrier();return true;})()`);
      report.stage = sid + '/load';
      // Input is data, not a gigantic nested object literal compiled as JS code.
      await js(`window.__autosaveInput=JSON.parse(${JSON.stringify(raw)});true`);
      await js('(async()=>{await fullLoadGame(__autosaveInput);delete window.__autosaveInput;await _tmAwaitLoadBarrier();return true;})()');
      await sleep(300);
      // Never return a 35–43 MB world through the diagnostic executeJavaScript
      // bridge: that measures the observer's result conversion, not game IPC.
      report.stage = sid + '/settle-and-hash';
      const expectedHash = await js(`(async()=>{await _tmFlushBackgroundAutosavesForClose();const text=JSON.stringify(_tmCommittedSnapshotProjectEnvelope().gameState);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');})()`);
      for (let i = 0; i < 3; i++) {
        report.stage = sid + '/autosave-' + i;
        await js('(async()=>{if(_autoSaveInFlightPromise)await _autoSaveInFlightPromise;return true;})()');
        let inspector, post;
        if (i === 0 && process.env.TM_PERF_MAIN_PROFILE === '1') {
          inspector = new (require('inspector').Session)(); inspector.connect();
          post = (method, params = {}) => new Promise((resolve, reject) => inspector.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
          await post('Profiler.enable'); await post('Profiler.start');
        }
        delay.reset(); mainStringify = []; await js('__autosavePerf.begin();true'); active = true;
        const start = performance.now();
        const result = await js(`(async()=>{const t=performance.now();const value=await _tmRunDesktopAutoSaveTick({force:true});return {value,ms:performance.now()-t,textBridge:typeof tianming.autoSaveJson==='function'};})()`);
        const wallMs = performance.now() - start; await sleep(100); active = false;
        if (inspector) {
          const { profile } = await post('Profiler.stop'); inspector.disconnect();
          fs.writeFileSync(process.env.TM_BRIDGE_TEST_REPORT + '.main-cpu-' + sid + '.json', stringify(profile));
        }
        const renderer = await js('__autosavePerf.end()');
        const mainLoop = { maxMs: delay.max / 1e6, p95Ms: delay.percentile(95) / 1e6 };
        await check(sid + ':autosave-' + i + ':real disk and generation/session', async () => {
          assert.equal(result.value.ok, true, JSON.stringify(result));
          const saves = path.join(temp, 'saves');
          const diskPath = path.join(saves, '__autosave__.json');
          const savedText = fs.readFileSync(diskPath, 'utf8'), saved = JSON.parse(savedText);
          assert(savedText.startsWith('{"__tmDesktopSaveGeneration":'));
          assert.equal(saved.__tmAutoSaveEnvelope, 1); assert.equal(typeof saved.sessionToken, 'string');
          const actual = JSON.stringify(saved.data.gameState);
          assert.equal(crypto.createHash('sha256').update(actual).digest('hex'), expectedHash, 'exact saved state bytes differ');
          assert.equal(await js('!_autoSaveInFlight&&!_autoSaveInFlightPromise'), true);
        });
        report.samples.push({ scenario: sid, repetition: i, bytes: bytes.length, sampleHash: crypto.createHash('sha256').update(bytes).digest('hex'), wallMs, result, renderer, mainStringify, mainLoop });
        console.log('AUTOSAVE_PERF', sid, i, wallMs.toFixed(1), 'longest', Math.max(0, ...renderer.longTasks.map(t=>t.duration)));
      }
    }
    return report;
  } finally { active = false; JSON.stringify = stringify; delay.disable(); }
};
