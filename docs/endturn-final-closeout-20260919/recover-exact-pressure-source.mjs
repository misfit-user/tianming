import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(path.resolve('package.json')),{parse}=require('acorn');
const d='docs/endturn-final-closeout-20260919',target='web/scripts/smoke-perf-save-preparation.js',base=JSON.parse(fs.readFileSync(d+'/baseline.json','utf8'));
const entries=JSON.parse(fs.readFileSync(d+'/changes.json','utf8')).filter(r=>r.file===target),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
let value=fs.readFileSync(base.backup+'/'+target,'utf8');if(sha(value)!==entries[0].before)throw Error('Backup hash mismatch');
function offset(raw,end){let i=0,n=0;while(i<raw.length&&n<end){if(raw[i]==='\r'&&raw[i+1]==='\n')i++;i++;n++;}return i;}
function replace(text,from,to){const normalized=text.replace(/\r\n/g,'\n'),wanted=from.replace(/\r\n/g,'\n');if(normalized.split(wanted).length!==2)throw Error('Recovery patch anchor mismatch');const at=normalized.indexOf(wanted),a=offset(text,at),b=offset(text,at+wanted.length),eol=text.slice(a,b).includes('\r\n')?'\r\n':'\n';return text.slice(0,a)+to.replace(/\r?\n/g,eol)+text.slice(b);}
const patches=['patch-save-test-lifetime.mjs','patch-complete-fixture-lifetimes.mjs','patch-bounded-parity-diagnostics.mjs','patch-parity-object-lifetimes.mjs','prepare-frozen-validation.mjs','patch-no-duplicate-comparisons.mjs'];
for(let i=0;i<patches.length;i++){
 const text=fs.readFileSync(d+'/'+patches[i],'utf8'),ast=parse(text,{ecmaVersion:'latest',sourceType:'module'});
 const node=ast.body.find(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&n.expression.callee.name==='edit'&&n.expression.arguments[0].value===target);
 if(!node)throw Error('Recorded transform not found: '+patches[i]);
 new Function('edit',text.slice(node.start,node.end))((file,fn)=>{if(file!==target)throw Error('Wrong recovery target');value=fn(value,replace);});
 if(sha(value)!==entries[i].after)throw Error('Recorded transform hash mismatch after '+patches[i]+': '+sha(value));
 console.log('Verified exact stage',i+1,patches[i]);
}
const destination=d+'/pressure-source-before-disk-full.js';fs.writeFileSync(destination,value);fs.writeFileSync(d+'/pressure-source-recovery.json',JSON.stringify({at:new Date().toISOString(),target,recoveredPath:destination,sha256:sha(value),matchesLastLoggedHash:sha(value)===entries.at(-1).after,bytes:Buffer.byteLength(value)},null,2));console.log('Reconstructed verified source on D; canonical file not written yet.');
