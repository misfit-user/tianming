'use strict';
const fs=require('fs'),assert=require('assert/strict');
module.exports=async function({win,check,recordPerformance}){
  const js=code=>win.webContents.executeJavaScript(code),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const sid=process.env.TM_PERF_SCENARIO;
  assert(['sc-jianyan1-1127-shaosong','sc-tianqi7-1627'].includes(sid));
  const cycles=Number(process.env.TM_PERF_PANEL_CYCLES),histories=process.env.TM_PERF_PANEL_HISTORY.split(',').map(Number),panelName=process.env.TM_PERF_PANEL;
  assert(Number.isInteger(cycles)&&cycles>0&&cycles<=5);assert(histories.every(n=>Number.isInteger(n)&&n>=0&&n<=5000));assert(['edict','memorial','letter','all'].includes(panelName));
  const report={scenario:sid,samples:[],cycles,histories,panelName,stages:[],scope:'Actual production renderer APIs in real sandbox Electron. Public deterministic UI fixture, no AI/network/player data; synthetic DOM clicks are separate from computer-use observations.'};recordPerformance(report);
  const stage=name=>{report.stages.push({name,at:performance.now()});console.log('PANEL_STAGE',name);};stage('new-game');
  await js(`(async()=>{if(P.ai&&P.ai.key)throw Error('unexpected credential');await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});P.conf.fixedSeed='perf-panels';doActualStart(${JSON.stringify(sid)});await _tmAwaitLoadBarrier();return true;})()`);
  if(process.env.TM_PERF_PANEL_SAMPLE){
    stage('load-public-sample');
    const raw=fs.readFileSync(process.env.TM_PERF_PANEL_SAMPLE,'utf8');
    await js(`window.__panelInput=JSON.parse(${JSON.stringify(raw)});true`);
    await js(`(async()=>{await fullLoadGame(__panelInput,{source:'panel-public-sample'});delete window.__panelInput;await _tmAwaitLoadBarrier();if(P.ai&&P.ai.key)throw Error('unexpected sample credential');return true;})()`);
  }
  await js(`(async()=>{await TM.Features.ensureRecoverable('formalMapLabels');TMPhase8FormalBridge.map.invalidateFormalMap();TMPhase8FormalBridge.map.renderFormalMap();await document.fonts.ready;return true;})()`);
  // Only dismiss startup presentation through its real handlers; no world/save stubs.
  await js(`(()=>{for(const text of ['开始临朝','知道了']){const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(b)b.click();}const close=document.querySelector('#changelog-overlay .cl-close,#changelog-modal .cl-close');if(close)close.click();return true;})()`);
  await sleep(600);win.show();win.focus();stage('initialized');
  const traceEnabled=process.env.TM_PERF_PANEL_TRACE==='1';
  const cdp=(m,p)=>win.webContents.debugger.sendCommand(m,p);
  // Native tracing is a separate diagnostic run: attachment/metrics collection
  // was expensive on this machine. Default timing keeps the in-renderer probes
  // and must not label observer overhead as game startup or layout latency.
  report.nativeMetrics=traceEnabled;
  if(traceEnabled){win.webContents.debugger.attach('1.3');await cdp('Performance.enable');}
  const metrics=async()=>traceEnabled?Object.fromEntries((await cdp('Performance.getMetrics')).metrics.map(x=>[x.name,x.value])):{};
  await js(`(()=>{const p=window.__panelProbe={tasks:[],changes:[],counts:{}};
    new PerformanceObserver(l=>{for(const e of l.getEntries())p.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});
    new MutationObserver(ms=>{for(const m of ms)p.changes.push({at:performance.now(),added:m.addedNodes.length,removed:m.removedNodes.length});}).observe(document.body,{childList:true,subtree:true});
    const b=TMPhase8FormalBridge,old=b._saveFormalDraftsToGM;b._saveFormalDraftsToGM=function(...a){p.counts.save=(p.counts.save||0)+1;return old.apply(this,a);};
    p.step=async(selector)=>{p.tasks=[];p.changes=[];p.counts={};const el=document.querySelector(selector);if(!el)throw Error('missing '+selector);if(document.hidden)throw Error('panel-measurement-hidden');const start=performance.now();el.click();const syncMs=performance.now()-start;const frame1=await new Promise(r=>requestAnimationFrame(()=>r(performance.now())));const frame2=await new Promise(r=>requestAnimationFrame(()=>r(performance.now())));await new Promise(r=>setTimeout(r,80));return {start,end:performance.now(),syncMs,frame1Ms:frame1-start,frame2Ms:frame2-start,tasks:p.tasks.slice(),changes:p.changes.slice(),counts:{...p.counts},nodes:document.querySelectorAll('*').length,archiveNodes:document.querySelectorAll('.arc-body *').length};};return true;})()`);
  stage('instruments-ready');
  let traceDone;
  if(traceEnabled){
    traceDone=new Promise(resolve=>win.webContents.debugger.on('message',(_e,m,p)=>{if(m==='Tracing.tracingComplete')resolve(p);}));
    await cdp('Tracing.start',{categories:'devtools.timeline',transferMode:'ReturnAsStream'});
    await cdp('Profiler.enable');await cdp('Profiler.start');
  }
  try{
    for(const history of histories){
      // Controlled public history only; same values on both code trees. No history reduction.
      const fixture=await js(`(()=>{TMPhase8FormalBridge.drafts.closeDeskOverlay();const text='受控回归诏书：核实田亩钱粮，勿扰民。正常名称 & < > "。';GM.turn=801;GM._edictTracker=Array.from({length:${history}},(_,i)=>({id:'perf-edict-'+i,turn:i+1,category:'政令',content:text.repeat(12)+i,feedback:'已收讫，遵令核验。',status:i%2?'completed':'executing',assignee:'回归承办人'}));return {history:GM._edictTracker.length,characters:GM.chars.length,bytes:JSON.stringify(GM._edictTracker).length};})()`);
      report.fixture=fixture;
      for(const [panel,open] of [['edict','#zhao-btn'],['memorial','#zhao-btn-2'],['letter','#zhao-btn-3']].filter(([name])=>panelName==='all'||name===panelName)){
        stage(history+'/'+panel);
        for(let i=0;i<cycles;i++)for(const [action,selector] of [['open',open],['close','.tm-desk-overlay [data-close-bridge]']]){
          const before=await metrics(),result=await js(`__panelProbe.step(${JSON.stringify(selector)})`),after=await metrics();
          const delta=traceEnabled?Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'].map(k=>[k,after[k]-before[k]])):null;
          await check(`${history}/${panel}/${i}/${action}`,async()=>assert.equal(await js('!!document.querySelector(".tm-desk-overlay")'),action==='open'));
          report.samples.push({history,panel,iteration:i,action,...result,delta});
          console.log('PANEL',history,panel,i,action,'js',result.syncMs.toFixed(1),'frame2',result.frame2Ms.toFixed(1),'nativeMetrics',delta||'not collected','draftSaves',result.counts.save||0);
        }
      }
    }
  }finally{
    if(traceDone){
      const p=await cdp('Profiler.stop');fs.writeFileSync(process.env.TM_BRIDGE_TEST_REPORT+'.cpu.json',JSON.stringify(p.profile));
      await cdp('Tracing.end');const done=await traceDone;report.traceDataLoss=!!done.dataLossOccurred;
      const fd=fs.openSync(process.env.TM_BRIDGE_TEST_REPORT+'.trace.json','w');
      try{for(;;){const chunk=await cdp('IO.read',{handle:done.stream,size:1024*1024});fs.writeSync(fd,chunk.base64Encoded?Buffer.from(chunk.data,'base64'):chunk.data);if(chunk.eof)break;}}finally{fs.closeSync(fd);await cdp('IO.close',{handle:done.stream});}
    }
    if(traceEnabled){await cdp('Performance.disable');win.webContents.debugger.detach();}
  }
  if(process.env.TM_PERF_PANEL_CONTRACTS==='1')await require('./panels-contracts.cjs')({win,check,report});
  return report;
};
