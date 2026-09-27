import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js',(s,r)=>{
  s=r(s,'  compress: async function(jsonStr) {',fs.readFileSync('docs/storage-write-reliability-20260919/codec-helper.fragment.txt','utf8')+'\n  compress: async function(jsonStr) {');
  s=r(s,"      var stream = blob.stream().pipeThrough(cs);\n      var compressed = await new Response(stream).blob();","      var compressed = await this.transform(blob.stream(), cs, 'compress', false);");
  s=r(s,'var headBuf = await blob.slice(0, 2).arrayBuffer();',"var headBuf = await this.awaitResult(blob.slice(0, 2).arrayBuffer(), 'decompress');");
  s=r(s,"      var stream = blob.stream().pipeThrough(ds);\n      return await new Response(stream).text();","      return await this.transform(blob.stream(), ds, 'decompress', true);");
  s=r(s,"if (typeof blob.text === 'function') return await blob.text();","if (typeof blob.text === 'function') return await this.awaitResult(blob.text(), 'decompress');");
  s=r(s,'var bytes = new Uint8Array(await blob.arrayBuffer());',"var bytes = new Uint8Array(await this.awaitResult(blob.arrayBuffer(), 'decompress'));");
  return r(s,'        var digest = await digestPromise;',"        var digest = await (typeof SaveCompression.awaitResult === 'function' ? SaveCompression.awaitResult(digestPromise, 'checksum') : digestPromise);");
});
