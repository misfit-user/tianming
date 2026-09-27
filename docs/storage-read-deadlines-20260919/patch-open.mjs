import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
const dir='docs/storage-read-deadlines-20260919';
edit('web/tm-storage.js',(s,r)=>{
  s=r(s,'  function _utf8ByteLength(text) {',fs.readFileSync(dir+'/read-helpers.fragment.txt','utf8')+'\n  function _utf8ByteLength(text) {');
  const start=s.indexOf('  function open() {'),end=s.indexOf('  // ── R103',start);
  if(start<0||end<0)throw Error('Open boundaries not found');
  let fn=s.slice(start,end);
  const from=fn.indexOf('    _openPromise = new Promise('),to=fn.indexOf('      var req = indexedDB.open',from);
  fn=r(fn,fn.slice(from,to),fs.readFileSync(dir+'/open-owner.fragment.txt','utf8'));
  fn=r(fn,'      req.onupgradeneeded = function(e) {','      req.onupgradeneeded = function(e) {\n        if (owner.failed) { _abortRead(e.target.transaction); try { e.target.result.close(); } catch (_) {} return; }\n        owner.upgrade = e.target.transaction;');
  if(fn.split('cursorReq.onsuccess = function() {').length!==3)throw Error('Expected two migration cursor handlers');
  fn=fn.replaceAll('cursorReq.onsuccess = function() {','cursorReq.onsuccess = function() {\n              if (owner.failed) return;');
  const success=fn.indexOf('      req.onsuccess = function(e) {');
  if(success<0)throw Error('Open success boundary not found');
  const suffix=fs.readFileSync(dir+'/open-result.fragment.txt','utf8');
  fn=r(fn,fn.slice(success),suffix);
  return r(s,s.slice(start,end),fn);
});
