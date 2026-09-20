import fs from 'node:fs';
const d='docs/api-wait-compatibility-20260920';let source=fs.readFileSync('docs/endturn-final-closeout-20260919/browser-final-test.mjs','utf8');
const start=source.indexOf("const dir=path.resolve("),end=source.indexOf('await new Promise(resolve=>server.listen',start);
source=source.slice(0,start)+`const dir=path.resolve('${d}');
const names=['tm-ai-infra-json.js','tm-ai-infra-retry.js','tm-ai-infra.js','tm-ai-request-options.js','tm-api-settings.js'];
const requests=[],timers=new Set();
const server=http.createServer((req,res)=>{
 if(req.method==='POST'&&['/chat','/tools'].includes(req.url)){
  let data='';req.on('data',c=>{data+=c;});req.on('end',()=>{const b=JSON.parse(data);requests.push({path:req.url,maxTokens:b.max_tokens,stream:b.stream,tool:!!b.tools});
   res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();
   const out=b.tools?{choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{"deep":true}'}}]},finish_reason:'tool_calls'}]}:{choices:[{message:{content:b.stream?'完整工具或流式正文':'完整正文，不能删减。'.repeat(500)},finish_reason:'stop'}]};
   const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)res.end(JSON.stringify(out));},800);timers.add(timer);res.on('close',()=>{clearTimeout(timer);timers.delete(timer);});
  });return;
 }
 if(req.url==='/test.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(dir,'browser-test.html')));return;}
 const name=req.url.slice(1);if(names.includes(name)){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join('web',name)));return;}res.writeHead(404);res.end();
});
`+source.slice(end);
source=source.replace("const profile=path.join(dir,'.edge-realtime-'+Date.now());", "const profileRoot='D:/tianming-task-artifacts-20260919';const profile=path.join(profileRoot,'.edge-api-wait-'+Date.now());");
source=source.replace("if(child.exitCode===null)child.kill();server.close();", "if(child.exitCode===null)child.kill();for(const timer of timers)clearTimeout(timer);server.closeAllConnections();server.close();");
const a=source.indexOf('const report={'),b=source.indexOf('\nawait sleep',a);
source=source.slice(0,a)+"const report={at:new Date().toISOString(),sources:Object.fromEntries(names.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('web/'+n)).digest('hex')])),version,isolatedProfile:profile,requests,outcome,error};\nif(requests.length!==5){report.error='Expected five single requests; got '+requests.length;if(outcome)outcome.ok=false;}"+source.slice(b);
source=source.replace('path.dirname(profile) === dir','path.dirname(profile) === path.resolve(profileRoot)');
fs.writeFileSync(d+'/browser-proof.mjs',source,'utf8');
