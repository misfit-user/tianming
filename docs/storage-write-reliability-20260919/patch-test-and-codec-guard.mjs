import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-save-commit-boundary.js',(s,r)=>r(s,"abort(){aborted++;}})};","abort(){aborted++;if(this.onabort)this.onabort({target:this});}})};"));
edit('web/tm-storage.js',(s,r)=>{
  s=r(s,"var error = new Error('存档' + stage + '超时，未把不完整数据当成成功');","var error = new Error('存档' + ({compress:'压缩',decompress:'解压',checksum:'校验'}[stage] || '处理') + '超时，未把不完整数据当成成功');");
  return r(s,'try { while (true) { var part = await reader.read(); if (part.done) break; chunks.push(part.value); } }','try { while (true) { if (controller.signal.aborted) throw controller.signal.reason; var part = await reader.read(); if (controller.signal.aborted) throw controller.signal.reason; if (part.done) break; chunks.push(part.value); } }');
});
edit('web/scripts/verify-all.js',(s,r)=>r(s,"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }","  { name: 'storage-write-reliability', file: 'smoke-storage-write-reliability.js', estSec: 3, expectExit: 0 },\n  { name: 'save-codec-deadlines', file: 'smoke-save-codec-deadlines.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
