import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  const from=s.indexOf('    var identity, ordinal, key, config;'),to=s.indexOf('    if (!current(s)',from);
  if(from<0||to<0)throw Error('Request identity block missing');
  return r(s,s.slice(from,to),`    var identity, ordinal, key, config, hash;
    try {
      config = JSON.stringify(root.P && root.P.ai);
      identity = JSON.stringify([kind, descriptor, config]);
      if (identity.length <= LIMITS.inputChars && s.ordinals.size < 256) {
        ordinal = (s.ordinals.get(identity) || 0) + 1; s.ordinals.set(identity, ordinal);
        hash = await digest(identity);
        if (hash) key = kind + ':' + hash + ':' + ordinal;
      }
    } catch (_) { key = null; }
    if (!key) return execute();
`);
});
