'use strict';
const fs = require('fs'), assert = require('assert/strict'), crypto = require('crypto');
module.exports = async function({ win, root, check }) {
  const js = code => win.webContents.executeJavaScript(code);
  const sid = process.env.TM_PERF_INSPECT_SCENARIO;
  await js(`(async()=>{if(P.ai&&P.ai.key)throw Error('unexpected API credential');await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});P.conf.fixedSeed='perf-round1';doActualStart(${JSON.stringify(sid)});await _tmAwaitLoadBarrier();return true;})()`);
  const file = process.env.TM_PERF_INSPECT_SAMPLE;
  let sampleHash = null;
  if (file) {
    const bytes = fs.readFileSync(file); sampleHash = crypto.createHash('sha256').update(bytes).digest('hex');
    await js(`(async()=>{await fullLoadGame(${bytes.toString('utf8')});await _tmAwaitLoadBarrier();return true;})()`);
  }
  await check('interactive-isolated-world', async () => assert.equal(await js(`!!GM&&GM.sid===${JSON.stringify(sid)}&&!!tianming.isDesktop&&!(P.ai&&P.ai.key)`), true));
  await js(`(()=>{
    document.title='天命 · 性能隔离观察';
    const trace=window.__perfInspection={events:[],eventTiming:[],longTasks:[],timings:{},started:performance.now(),complete:false};
    // Bounded metadata only: no input text, actor names, API credentials or saved world.
    const push=(arr,value)=>{if(arr.length<2048)arr.push(value);};
    for(const name of ['click','input','wheel','pointerdown','pointerup'])document.addEventListener(name,e=>{
      const t=performance.now(),target=e.target,control=target&&target.closest&&target.closest('button,[role="button"]'),overlay=document.querySelector('.tm-desk-overlay');
      const entry={type:name,at:t,eventAt:e.timeStamp,tag:target&&target.tagName,id:target&&target.id||'',control:control&&(control.id||control.className)||'',overlayBefore:overlay&&overlay.id||'',trusted:e.isTrusted};
      push(trace.events,entry);requestAnimationFrame(()=>{entry.nextFrameMs=performance.now()-t;requestAnimationFrame(()=>{entry.secondFrameMs=performance.now()-t;const ov=document.querySelector('.tm-desk-overlay');entry.overlayAfter=ov&&ov.id||'';});});
    },true);
    if(PerformanceObserver.supportedEntryTypes.includes('event'))new PerformanceObserver(list=>{for(const e of list.getEntries())push(trace.eventTiming,{name:e.name,start:e.startTime,duration:e.duration,processingStart:e.processingStart,processingEnd:e.processingEnd,interactionId:e.interactionId,id:e.target&&e.target.id||''});}).observe({type:'event',durationThreshold:16});
    new PerformanceObserver(list=>{for(const e of list.getEntries())push(trace.longTasks,{start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});
    for(const name of ['renderGameState','_buildSaveState','_prepareGMForSave']){const original=window[name];if(typeof original!=='function')throw Error('missing '+name);
      window[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{push(trace.timings[name]||(trace.timings[name]=[]),{start,ms:performance.now()-start});}};}
    TM.perf.reset();return true;
  })()`);
  win.setTitle('天命 · 性能隔离观察'); win.show();
  let stopped = false, sampling = false;
  const report = { scope: 'Computer Use observation; real production main/preload, isolated public state, external network denied. Tool observation intervals are NOT input latency or FPS.',
    sampleHash, scenario: sid, root: root.replace(require('os').homedir(), '<user-profile>') };
  let profileTimer, profileBusy = false, profileIndex = 0;
  if (process.env.TM_PERF_INSPECT_CPU === '1') {
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Profiler.enable');
    await win.webContents.debugger.sendCommand('Profiler.setSamplingInterval', { interval: 1000 });
    await win.webContents.debugger.sendCommand('Profiler.start');
    report.cpuProfiles = [];
    profileTimer = setInterval(async () => {
      if (profileBusy || stopped || profileIndex >= 12) return;
      profileBusy = true;
      try {
        const { profile } = await win.webContents.debugger.sendCommand('Profiler.stop');
        const name = 'cpu-' + (++profileIndex) + '.json';
        const at = await js('performance.now()');
        fs.writeFileSync(require('path').join(require('path').dirname(process.env.TM_PERF_INSPECT_TRACE), name), JSON.stringify(profile));
        report.cpuProfiles.push({ name, rendererEndMs: at, samples: profile.samples?.length });
        if (profileIndex < 12) await win.webContents.debugger.sendCommand('Profiler.start');
      } catch (error) { report.cpuProfileError = String(error.message); }
      finally { profileBusy = false; }
    }, 20000);
  }
  async function snapshot() {
    if (sampling || stopped) return;
    sampling = true;
    try { report.trace = await js('JSON.parse(JSON.stringify({...__perfInspection,perf:TM.perf.report(),work:TM.perf.workReport()}))'); fs.writeFileSync(process.env.TM_PERF_INSPECT_TRACE, JSON.stringify(report, null, 2)); }
    finally { sampling = false; }
  }
  await snapshot();
  const timer = setInterval(() => { snapshot().catch(error => { report.sampleError = String(error.message); }); }, 3000);
  console.log('INTERACTIVE_READY');
  await new Promise(resolve => win.on('closed', resolve));
  stopped = true; clearInterval(timer); clearInterval(profileTimer); report.complete = true;
  fs.writeFileSync(process.env.TM_PERF_INSPECT_TRACE, JSON.stringify(report, null, 2));
  return report;
};
