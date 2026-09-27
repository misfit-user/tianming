'use strict';
const { webcrypto } = require('crypto');
const { transport, load, pause, ROOT } = require('./lib-turn-reliability');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const f = transport(), c = f.c;
  c.crypto = webcrypto; c.TextEncoder = TextEncoder;
  c._buildAIUrl = () => 'https://fixture.invalid/v1/chat/completions'; c._aiEffectiveTierIsSecondary = () => false;
  load(c, 'tm-endturn-response-recovery.js');
  const R = c.TM.Endturn.ResponseRecovery;
  function capture() { return { gmRef:c.GM, pRef:c.P, turn:c.GM.turn, loadGen:c._tmLoadGen || 0, gm:{data:copy(c.GM)}, p:{data:copy(c.P),descriptors:{}}, rolledBack:false,committed:false }; }
  async function begin(options) { const txn=capture(); await R.begin(txn, options || {}); return txn; }
  function rollback(txn, error, finish=true) {
    for(const [target, data] of [[txn.gmRef,txn.gm.data],[txn.pRef,txn.p.data]]) { Object.keys(target).forEach(k=>delete target[k]); Object.assign(target,copy(data)); }
    c.GM=txn.gmRef;c.P=txn.pRef;c._tmLoadGen=(c._tmLoadGen || 0)+1;
    c.GM.busy=false;c.GM._endTurnBusy=false;c.GM._lastEndTurnRollback={at:Date.now(),reason:'fixture failure'};
    txn.rolledBack=true;if(finish)R.finish(txn,'failed',error || Object.assign(Error('fixture timeout'),{code:'AI_TIMEOUT'}));
  }
  const body=()=>({model:c.P.ai.model,messages:[{role:'system',content:'Retain all quality constraints.'},{role:'user',content:'Full world reasoning and complete narrative.'}],max_tokens:4096,temperature:0.7});
  const response=(content='完整叙事与有效状态提案。',finish='stop')=>({choices:[{message:{role:'assistant',content},finish_reason:finish}],usage:{total_tokens:99}});
  const okay=data=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data});
  const request=(b=body(),opts={})=>c._aiFetchWithRetry('https://fixture.invalid/v1',b,opts.signal,{maxRetries:0,timeoutMs:500,id:'quality-test',...opts});
  return {...f,R,begin,capture,rollback,body,response,okay,request};
}
module.exports={fixture,copy,pause,load,ROOT};
