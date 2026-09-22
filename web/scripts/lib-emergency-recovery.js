'use strict';
const {transport,load,okay,pause}=require('./lib-turn-reliability');
const {webcrypto}=require('crypto');
function fixture(settings={}){
  const f=transport(),c=f.c;c.crypto=webcrypto;c.global=c;
  c.P.conf.emergencyRecovery=Object.assign({mode:'auto',maxTokens:120000},settings);
  c._aiRetryDelay=()=>1;
  c._getAITier=tier=>Object.assign({tier:'primary'},tier==='secondary'&&c.P.ai.secondary?Object.assign({tier:'secondary'},c.P.ai.secondary):c.P.ai);
  c._buildAIUrlForTier=()=> 'https://fixture.invalid/v1/chat/completions';c._buildAIUrl=c._buildAIUrlForTier;
  const events=[];c.CustomEvent=function(type,opts){this.type=type;this.detail=opts.detail;};c.dispatchEvent=event=>events.push(event.detail);
  ['tm-agent-kernel.js','tm-call-retry-policy.js','tm-emergency-recovery-core.js','tm-emergency-recovery-tools.js','tm-emergency-recovery-adapters.js','tm-emergency-recovery-runtime.js','tm-emergency-recovery-edict.js'].forEach(file=>load(c,file));
  return Object.assign(f,{events});
}
function response(text){return okay({choices:[{message:{content:text},finish_reason:'stop'}]});}
function envelope(prompt){const at=prompt.indexOf('\n');return JSON.parse(prompt.slice(at+1));}
function isEmergency(body){return String(body.messages&&body.messages[0]&&body.messages[0].content||'').startsWith('你是天命的失败后应急恢复 Agent');}
function agentReply(prompt,plan){
  const task=envelope(prompt),history=task.history||[],previews=history.filter(h=>h.tool==='preview');
  if(!history.length)return JSON.stringify({tools:[{name:'read_source',input:{id:'original',offset:0,length:4096}},{name:'read_source',input:{id:'contract',offset:0,length:4096}}]});
  if(!previews.length||!previews.at(-1).result.ok)return JSON.stringify({tools:[{name:'preview',input:typeof plan==='function'?plan(task):plan}]});
  return JSON.stringify({tools:[{name:'finish',input:{previewId:previews.at(-1).result.previewId}}]});
}
function rawParse(raw){try{return {raw,parsed:JSON.parse(raw),truncated:false};}catch(_){return {raw,parsed:null,failed:true,truncated:false};}}
async function run(tests){let pass=0,fail=0;for(const t of tests)try{await t.fn();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;}
module.exports={fixture,load,response,envelope,isEmergency,agentReply,rawParse,pause,run};
