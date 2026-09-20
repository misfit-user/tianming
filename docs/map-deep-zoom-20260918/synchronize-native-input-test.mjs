// Native input arrives asynchronously in hidden Electron windows; sample the resulting state, not a fixed sleep.
import fs from 'node:fs';import assert from 'node:assert/strict';
const p='docs/map-deep-zoom-20260918/verify-zoom-ui.mjs';let t=fs.readFileSync(p,'utf8');
function one(a,b){assert.equal(t.split(a).length,2,a);t=t.replace(a,b);}
one(" const state=()=>js(`JSON.parse(JSON.stringify(TMPhase8FormalBridge.__p8MapParts.state.mapView))`);", " const state=()=>js(`JSON.parse(JSON.stringify(TMPhase8FormalBridge.__p8MapParts.state.mapView))`);\n async function waitView(predicate,label){const start=Date.now();let v;do{v=await state();if(predicate(v))return v;if(Date.now()-start>12000)throw Error(label+' native-input timeout '+JSON.stringify(v));await sleep(120);}while(!done);throw Error('Test cancelled');}");
one("await sleep(500);const v2=await state();", "const v2=await waitView(v=>v.scale<128,'wheel down');");
one("for(let i=0;i<28;i++){win.webContents.sendInputEvent({type:'mouseWheel',x:point.x,y:point.y,deltaY:100,deltaX:0,canScroll:true});await sleep(25);}await sleep(600);", "for(let i=0;i<40;i++){const prior=await state();if(prior.scale===128)break;win.webContents.sendInputEvent({type:'mouseWheel',x:point.x,y:point.y,deltaY:100,deltaX:0,canScroll:true});await waitView(v=>v.scale>prior.scale,'wheel up');}await sleep(250);");
one(" for(let i=0;i<12;i++){\n  await win.webContents.debugger.sendCommand", " for(let i=0;i<12;i++){\n  const prior=await state();if(prior.scale===128)break;\n  await win.webContents.debugger.sendCommand");
one("{type:'touchMove',touchPoints:touchAt(160)});await sleep(35);", "{type:'touchMove',touchPoints:touchAt(160)});await waitView(v=>v.scale>prior.scale,'two-finger pinch');");
one("await sleep(550);\n const afterDrag=await state();", "const afterDrag=await waitView(v=>v.tx!==beforeDrag.tx,'drag');");
one("report.failureScreenshot=await shot('failure');report.finalView=await state();", "report.failureScreenshot=await shot('failure');report.finalView=await state();report.wheelInput=await js(`window.__zoomWheelLog`);");
fs.writeFileSync(p,t);console.log('Native input tests now wait for actual state transitions, retaining the same numerical assertions.');
