import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-mobile-api-integration.js',(s,r)=>{
 s=r(s,'assert.equal(f.sent[0].readTimeout,100);','assert.equal(f.sent[0].readTimeout,0);assert(f.sent[0].connectTimeout>0);');
 return r(s,"mainRequest(f,{timeoutMs:15,maxRetries:3}),e=>e.code==='AI_TIMEOUT'","mainRequest(f,{timeoutMs:15,totalResponseTimeoutMs:15,maxRetries:3}),e=>e.code==='AI_TIMEOUT'||e.code==='AI_REQUEST_DEADLINE'");
});
