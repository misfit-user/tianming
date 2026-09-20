'use strict';
// Exact full-graph JSON replacer, then bounded sequential hashing. No permanent full-world string is retained by the caller.
module.exports=async function fullGraphDigest(value,chunkCharacters=1048576){
 const size=Math.max(2,Math.floor(chunkCharacters));if(!Number.isFinite(size))throw Error('Invalid graph digest chunk size');
 const t=performance.now(); let seen=new WeakMap(),seq=0;
 const text=JSON.stringify(value,(_key,v)=>{if(v&&typeof v==='object'){if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,seq++);}return typeof v==='function'?String(v):v;});
 console.log('RELIEF_DIGEST_SERIALIZED '+JSON.stringify({codeUnits:text?.length,nodes:seq,ms:performance.now()-t})); const hashStart=performance.now();
 seen=null;if(text===undefined)throw Error('Graph root must serialize to text');
 const encoder=new TextEncoder(),chunks=[];
 for(let start=0;start<text.length;){let end=Math.min(start+size,text.length);
  if(end<text.length&&text.charCodeAt(end-1)>=0xd800&&text.charCodeAt(end-1)<=0xdbff&&text.charCodeAt(end)>=0xdc00&&text.charCodeAt(end)<=0xdfff)end--;
  const digest=await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(text.slice(start,end)));
  chunks.push([end,Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')]);start=end;
 }
 console.log('RELIEF_DIGEST_HASHED '+JSON.stringify({chunks:chunks.length,ms:performance.now()-hashStart}));
 return JSON.stringify({codeUnits:text.length,chunks});
};
