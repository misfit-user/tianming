import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-turn-response-recovery.js',(s)=>{
  s=s.replaceAll('assert.deepEqual(second.choices,first.choices)','assert.equal(JSON.stringify(second.choices),JSON.stringify(first.choices))');
  s=s.replaceAll('assert.deepEqual((await f.request()).choices,one.choices)','assert.equal(JSON.stringify((await f.request()).choices),JSON.stringify(one.choices))');
  return s.replaceAll('assert.deepEqual((await f.request()).choices,two.choices)','assert.equal(JSON.stringify((await f.request()).choices),JSON.stringify(two.choices))');
});
edit('web/scripts/lib-turn-response-recovery.js',(s,r)=>{
  s=r(s,'  function rollback(txn, error) {','  function rollback(txn, error, finish=true) {');
  return r(s,"txn.rolledBack=true;R.finish(txn,'failed',error ||", "txn.rolledBack=true;if(finish)R.finish(txn,'failed',error ||");
});
