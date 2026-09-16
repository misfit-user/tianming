'use strict';
// Test-only networking bridge. Production scripts and CSP remain untouched.
const crypto=require('node:crypto'),realFetch=global.fetch.bind(globalThis);
if(process.env.TM_BRIDGE_TEST_MODE!=='native-start-live-authoring'||!process.send)throw Error('Private acceptance IPC required');
let config,remaining;const pending=new Map();let resolveConfig;
const ready=new Promise(r=>resolveConfig=r);
process.on('message',message=>{
  if(message.type==='private-config'&&!config){config=message.config;remaining=message.remaining;resolveConfig(config);}
  if(message.type==='reservation'&&pending.has(message.id)){const p=pending.get(message.id);pending.delete(message.id);message.ok?p.resolve():p.reject(Error('real-api-budget-exhausted'));}
});
function endpoint(base){if(/\/(chat\/completions|messages|responses)(\?|#|$)/.test(base))return base;if(/\/v\d+(beta)?$/.test(base))return base+'/chat/completions';if(/^https?:\/\/[^/]+\/?$/.test(base))return base.replace(/\/+$/,'')+'/v1/chat/completions';return base+'/chat/completions';}
global.__tmNativeLiveAcceptance={ready,remaining:()=>remaining,redact:text=>config?String(text).split(config.key).join('[REDACTED]'):String(text),async transport(request){
  await ready;const target=endpoint(config.url),body=JSON.parse(request.body||'{}');
  if(request.url!==target||request.method!=='POST'||body.model!==config.model||request.headers.Authorization!=='Bearer '+config.key)throw Error('acceptance-endpoint-denied');
  const id=crypto.randomUUID(),bodyBytes=Buffer.byteLength(request.body),started=Date.now();
  await new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});process.send({type:'reserve',id,bodyBytes});});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
    const response=await realFetch(target,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:controller.signal});
    const reader=response.body.getReader(),parts=[];let total=0;
    try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>16*1024*1024)throw Error('acceptance-response-budget');parts.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});}
    const bytes=Buffer.concat(parts);process.send({type:'outcome',id,status:'response-received',httpStatus:response.status,responseBytes:total,elapsedMs:Date.now()-started});
    return{status:response.status,headers:{'content-type':response.headers.get('content-type')||'application/json'},base64:bytes.toString('base64')};
  }catch(e){process.send({type:'outcome',id,status:'failed-or-uncertain',elapsedMs:Date.now()-started});throw Error('Configured provider did not return a complete response: '+(e.name||'transport-error'));}
  finally{clearTimeout(timer);}
}};
require('./bridge-main.cjs');
