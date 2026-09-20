import {edit} from './patch-utils.mjs';
edit('web/scripts/headless-smoke.js',(s,r)=>{
 s=r(s,"    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },","    URL: Object.assign(class extends URL {}, { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} }),\n    URLSearchParams,");
 return s;
});
for(const file of ['web/scripts/smoke-full-turn-flow.js','web/scripts/smoke-start-game-data-integrity.js'])edit(file,(s,r)=>{
 const anchor="    vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 });";
 return r(s,anchor,"    const scriptNode = sandbox.document.createElement('script');\n    scriptNode.src = new URL(src, 'http://localhost/index.html').href;\n    sandbox.document.currentScript = scriptNode;\n    try { "+anchor.trim()+" } finally { sandbox.document.currentScript = null; }");
});
