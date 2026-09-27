import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,"var LIMITS = { entries: 64, responseChars: 1000000, totalChars: 8000000, inputChars: 32000000, ttlMs: 30 * 60000 };","var LIMITS = { entries: 64, responseChars: 1000000, totalChars: 8000000, inputChars: 32000000, requestChars: 1000000, identityChars: 8000000, ttlMs: 30 * 60000 };");
  s=r(s,'records: new Map(), reuse: reuse, ordinals: new Map(), chars: 0, hits: 0, stored: 0, skipped: 0','records: new Map(), reuse: reuse, ordinals: new Map(), chars: 0, identityChars: 0, hits: 0, stored: 0, skipped: 0');
  s=r(s,'  function clear() {\n    retained = null;','  function clear() {\n    sequence++; retained = null;');
  s=r(s,'if (identity.length <= LIMITS.inputChars && s.ordinals.size < 256) {','if (identity.length <= LIMITS.requestChars && s.ordinals.size < 256 && (s.ordinals.has(identity) || s.identityChars + identity.length <= LIMITS.identityChars)) {\n        if (!s.ordinals.has(identity)) s.identityChars += identity.length;');
  return s;
});
