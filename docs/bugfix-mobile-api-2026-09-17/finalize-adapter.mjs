import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../../web');
const names=['tm-ai-infra-retry.js','tm-ai-infra.js'],before={},code={};
for(const n of names){before[n]=fs.readFileSync(path.join(web,n));code[n]=before[n].toString('utf8');}
function edit(n,a,b){if(code[n].split(a).length!==2)throw Error('nonunique anchor: '+n);code[n]=code[n].replace(a,b);}
edit(names[0],"if (error && /^AI_/.test(error.code || '')) { finish(error); return; }", "if (error && error._tmNativeTransport === true) { finish(error); return; }");
edit(names[1],"      // Native bridge cannot cancel an already-sent POST; do not replay after its local failure.\r\n      if (e && (e._tmNativeTransport || (timedOut && typeof _tmAINativePlatform === 'function' && _tmAINativePlatform()))) throw e;\r\n      // 外部 signal 主动中断——不重试\r\n      if (signal && signal.aborted) throw e;", "      // 外部取消和原生桥接失败不重发（原生已发出的 POST 无法物理取消）\r\n      if ((signal && signal.aborted) || (e && (e._tmNativeTransport || (timedOut && typeof _tmAINativePlatform === 'function' && _tmAINativePlatform())))) throw e;");
for(const n of names)new vm.Script(code[n],{filename:n});
for(const n of names){const p=path.join(web,n),b=Buffer.from(code[n]);if(!fs.readFileSync(p).equals(before[n]))throw Error('concurrent edit');const fd=fs.openSync(p,'r+');try{let o=0;while(o<b.length)o+=fs.writeSync(fd,b,o,b.length-o,o);fs.ftruncateSync(fd,b.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(!fs.readFileSync(p).equals(b))throw Error('readback');}
console.log('FINAL_ADAPTER_READBACK_OK');
