import fs from 'node:fs';
import {parse} from 'acorn';
for(const name of ['web/tm-endturn-ai.js','web/modules/ai-change-applier/core.js']){
 const s=fs.readFileSync(name,'utf8'),ast=parse(s,{ecmaVersion:'latest',sourceType:'module'});
 console.log('\nFUNCTIONS '+name);
 function scan(n){
  if(!n||typeof n!=='object')return;
  if(n.type==='FunctionDeclaration'&&n.id){const a=s.slice(0,n.start).split('\n').length,b=s.slice(n.start,n.end).split('\n').length;if(b>20)console.log(n.id.name,a,b);}
  for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(scan);else if(v&&typeof v==='object')scan(v);}
 }
 scan(ast);
}
const html=fs.readFileSync('web/index.html','utf8').split('\n');
html.forEach((l,i)=>{if(/<script.*(tm-utils|tm-faction-membership|tm-patches|tm-player|tm-custom-build|tm-fiscal|tm-public-treasury|tm-office|tm-military|tm-map-drawer|tm-endturn-ai|tm-ai-infra|tm-startup|tm-indices)/.test(l))console.log((i+1)+': '+l);});
const b=fs.readFileSync('docs/endturn-final-closeout-20260919/baseline-full-tests.log');console.log('BASELINE TAIL',b.toString(b[0]===255?'utf16le':'utf8').split('\n').slice(-5).join('\n'));
