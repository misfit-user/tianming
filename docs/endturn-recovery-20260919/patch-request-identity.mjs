import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'    var identity, ordinal, key;','    var identity, ordinal, key, config;');
  s=r(s,'      identity = JSON.stringify([kind, descriptor, root.P && root.P.ai]);','      config = JSON.stringify(root.P && root.P.ai);\n      identity = JSON.stringify([kind, descriptor, config]);');
  s=r(s,"if (!current(s) || active !== s || s.state !== 'running') throw failed();","if (!current(s) || active !== s || s.state !== 'running' || config !== JSON.stringify(root.P && root.P.ai)) throw failed();");
  return r(s,'    if (s.reuse && s.reuse.has(key)) {','    if (Date.now() < s.at || Date.now() - s.at > LIMITS.ttlMs) s.reuse = null;\n    if (s.reuse && s.reuse.has(key)) {');
});
