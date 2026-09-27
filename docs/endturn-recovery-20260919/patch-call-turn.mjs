import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'    var identity, ordinal, key, config, hash;','    var identity, ordinal, key, config, hash, callTurn = s.gm.turn;');
  s=r(s,'      identity = JSON.stringify([kind, descriptor, config]);','      identity = JSON.stringify([kind, descriptor, config, callTurn]);');
  const guard="!current(s) || active !== s || s.state !== 'running' || config !== JSON.stringify(root.P && root.P.ai)";
  if(s.split(guard).length!==3)throw Error('Expected both cached-result guards');
  s=s.replaceAll(guard,guard+' || s.gm.turn !== callTurn');
  return r(s,"if (active === s && current(s) && s.state === 'running' && !(signal && signal.aborted))","if (active === s && current(s) && s.state === 'running' && s.gm.turn === callTurn && config === JSON.stringify(root.P && root.P.ai) && !(signal && signal.aborted))");
});
