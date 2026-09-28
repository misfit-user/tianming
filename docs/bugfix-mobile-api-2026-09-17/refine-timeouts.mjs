import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../../web');
const files=['tm-ai-infra-retry.js','tm-ai-infra.js'],before={},code={};
for(const f of files){before[f]=fs.readFileSync(path.join(web,f));code[f]=before[f].toString('utf8');}
function edit(f,a,b){if(code[f].split(a).length!==2)throw Error('nonunique '+f);code[f]=code[f].replace(a,b);}
edit(files[0],"function failure(code, message) { var e = new Error(message); e.code = code; return e; }", "function failure(code, message) { var e = new Error(message); e.code = code; e._tmNativeTransport = true; return e; }");
edit(files[0],"e.name = timedOut ? 'TimeoutError' : 'AbortError'; return e;", "e.name = timedOut ? 'TimeoutError' : 'AbortError'; if (timedOut) e.timeoutMs = timeoutMs; return e;");
edit(files[0],"finish(failure(/timed?\\s*out|timeout/i.test(text) ? 'AI_TIMEOUT' : 'AI_MOBILE_NETWORK', message));", "var e = failure(/timed?\\s*out|timeout/i.test(text) ? 'AI_TIMEOUT' : 'AI_MOBILE_NETWORK', message);\n      if (e.code === 'AI_TIMEOUT') e.timeoutMs = timeoutMs;\n      if (error && /UNIMPLEMENTED|UNAVAILABLE/.test(String(error.code || ''))) { e.code = 'AI_MOBILE_BRIDGE'; e.message = '手机端原生联网组件未就绪，请重新启动或更新安卓客户端'; }\n      finish(e);");
edit(files[1],"      // 外部 signal 主动中断——不重试", "      // Native bridge cannot cancel an already-sent POST; do not replay after its local failure.\r\n      if (e && (e._tmNativeTransport || (timedOut && typeof _tmAINativePlatform === 'function' && _tmAINativePlatform()))) throw e;\r\n      // 外部 signal 主动中断——不重试");
for(const f of files)new vm.Script(code[f],{filename:f});
for(const f of files){const p=path.join(web,f);if(!fs.readFileSync(p).equals(before[f]))throw Error('concurrent edit');const b=Buffer.from(code[f]);const fd=fs.openSync(p,'r+');try{let off=0;while(off<b.length)off+=fs.writeSync(fd,b,off,b.length-off,off);fs.ftruncateSync(fd,b.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(!fs.readFileSync(p).equals(b))throw Error('readback');}
console.log('NATIVE_TIMEOUT_REFINEMENT_OK');
