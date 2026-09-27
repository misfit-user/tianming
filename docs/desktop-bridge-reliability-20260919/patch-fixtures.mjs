import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-runtime-save-consistency.js',(s,r)=>{
  s=r(s,'function sliceFn(src, marker) {',"function loadTurnBridge(ctx) {\n  ctx.setTimeout = ctx.setTimeout || setTimeout; ctx.clearTimeout = ctx.clearTimeout || clearTimeout;\n  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-reliability.js'), 'utf8'), ctx, { filename: 'tm-endturn-reliability.js' });\n}\nfunction sliceFn(src, marker) {");
  const tag='vm.createContext(ctx); vm.runInContext(render, ctx);';
  if(s.split(tag).length!==5)throw Error('Expected four render fixtures; inspect before patching');
  s=s.replaceAll(tag,'vm.createContext(ctx); loadTurnBridge(ctx); vm.runInContext(render, ctx);');
  s=r(s,"vm.createContext(ctx); vm.runInContext(sliceFn(lifecycle, 'function _recoverPendingTurnDataPublish('), ctx);","vm.createContext(ctx); loadTurnBridge(ctx); vm.runInContext(sliceFn(lifecycle, 'function _recoverPendingTurnDataPublish('), ctx);");
  s=r(s,'ok(/stageTurnData\\([\\s\\S]*?result\\.success === true',"ok(/callTurnBridge\\('stageTurnData',[\\s\\S]*?result\\.success === true");
  return r(s,'recoverTurnData\\(marker\\)[\\s\\S]*?deleteTurnPublishReceipt\\(marker',"callTurnBridge\\('recoverTurnData', marker[\\s\\S]*?deleteTurnPublishReceipt\\(marker");
});
edit('web/scripts/smoke-storage-atomic-batch.js',(s,r)=>r(s,
  "  vm.runInContext(source, context, { filename: 'tm-storage.js' });",
  "  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-reliability.js'), 'utf8'), context, { filename: 'tm-endturn-reliability.js' });\n  vm.runInContext(source, context, { filename: 'tm-storage.js' });"));
