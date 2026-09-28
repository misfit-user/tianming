import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../../web');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
const names=['tm-ai-infra-retry.js','tm-ai-infra.js','tm-ai-infra-model-detect.js','tm-api-models.js','tm-patches.js'];
const before={},code={},counts={};fs.mkdirSync(path.join(here,'originals'),{recursive:true});
for(const n of names){before[n]=fs.readFileSync(path.join(web,n));code[n]=before[n].toString('utf8');fs.writeFileSync(path.join(here,'originals',n+'.bak'),before[n],{flag:'wx'});}
function once(n,a,b){if(code[n].split(a).length!==2)throw Error('anchor not unique: '+n+' '+a.slice(0,50));code[n]=code[n].replace(a,b);}
const helper=fs.readFileSync(path.join(here,'native-transport.txt'),'utf8');
if(code[names[0]].includes('function _tmAIFetch'))throw Error('already patched');
code[names[0]]+=helper;
once(names[0],"error.code === 'mandatory_context_overflow'", "/^AI_MOBILE_/.test(error.code || '') || error.code === 'mandatory_context_overflow'");
for(const n of ['tm-ai-infra.js','tm-ai-infra-model-detect.js']){
 counts[n]=(code[n].match(/\bfetch\(/g)||[]).length;
 code[n]=code[n].replace(/\bfetch\(/g,"(typeof _tmAIFetch === 'function' ? _tmAIFetch : fetch)(");
}
once('tm-ai-infra.js',"signal: ctrl.signal\r\n      }), deadline]", "signal: ctrl.signal, timeoutMs: timeoutMs\r\n      }), deadline]");
once('tm-api-models.js','(options.fetch || global.fetch)',"(options.fetch || global._tmAIFetch || global.fetch)");
once('tm-api-models.js',"method: 'GET', headers: headers, signal: ctrl.signal, redirect: 'error'", "method: 'GET', headers: headers, signal: ctrl.signal, timeoutMs: options.timeoutMs || 20000, redirect: 'error'");
once('tm-api-models.js',"e.name === 'AbortError' || /^模型列表", "e.name === 'AbortError' || /^AI_MOBILE_/.test(e.code || '') || e.code === 'AI_TIMEOUT' || /^模型列表");
const detect='tm-ai-infra-model-detect.js';
code[detect]=code[detect].replace(/signal: _sig\((20000|25000)\)/g,'signal: _sig($1), timeoutMs: $1');
once(detect,"  // 2/3 流式 SSE\r\n", "  // 2/3 流式 SSE：原生桥按整包返回，不能当作首包流式测速。\r\n  var _nativeBuffered = typeof _tmAINativePlatform === 'function' && _tmAINativePlatform();\r\n");
once(detect,"  try {\r\n    var t1 = Date.now();", "  if (_nativeBuffered) {\r\n    report.stream.buffered = true;\r\n    report.stream.detail = '手机原生通道为整包响应；不影响推演，不进行首包流式测速';\r\n  } else try {\r\n    var t1 = Date.now();");
once(detect,"  if (!report.stream.ok) report.warnings.push('流式不可用：'", "  if (!report.stream.ok && !report.stream.buffered) report.warnings.push('流式不可用：'");
once('tm-patches.js','var key=_$("s-key")?_$("s-key").value:"";var url=_$("s-url")?_$("s-url").value:"";', 'var key=_$("s-key")?_$("s-key").value.trim():"";var url=_$("s-url")?_$("s-url").value.trim():"";');
once('tm-patches.js',"chip(qr.stream.ok, '流式', qr.stream.detail)","chip(qr.stream.ok || qr.stream.buffered, qr.stream.buffered ? '原生整包' : '流式', qr.stream.detail)");
for(const n of names)new vm.Script(code[n],{filename:n});
if(!process.argv.includes('--apply')){console.log('PREPARED',counts,names);process.exit(0);}
for(const n of names)if(!fs.readFileSync(path.join(web,n)).equals(before[n]))throw Error('concurrent edit: '+n);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const files=[];
for(const n of names){
 const out=Buffer.from(code[n],'utf8'),target=path.join(web,n),fd=fs.openSync(target,'r+');
 try{let offset=0;while(offset<out.length)offset+=fs.writeSync(fd,out,offset,out.length-offset,offset);fs.ftruncateSync(fd,out.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 if(!fs.readFileSync(target).equals(out))throw Error('readback failed: '+n);
 files.push({file:'web/'+n,before:sha(before[n]),after:sha(out)});
}
fs.writeFileSync(path.join(here,'patch-record.json'),JSON.stringify({device:os.hostname(),at:new Date().toISOString(),files,counts},null,2));
console.log('MOBILE_API_PATCH_READBACK_OK',JSON.stringify({files:names,counts}));
