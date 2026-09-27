import fs from 'node:fs';
import {parse} from 'acorn';
import {edit} from './patch-utils.mjs';
const dir='docs/endturn-final-closeout-20260919',moved=[];
function functions(source){const out=new Map();function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)out.set(n.id.name,{node:n,text:source.slice(n.start,n.end)});for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(parse(source,{ecmaVersion:'latest',sourceType:'module'}));return out;}
const pure=['_aiPolicyText','_aiPolicyAmount','_aiPolicyRegion','_aiPolicyRatioLabel','_aiStructuredPolicyText','_aiStructuredPolicyParams','_aiStructuredPolicyExpectedType'];
const core=fs.readFileSync('web/modules/ai-change-applier/core.js','utf8'),coreFns=functions(core);
const moduleFile='web/modules/ai-change-applier/policy-format.js';if(fs.existsSync(moduleFile))throw Error('New module already exists');
const texts=pure.map(n=>{if(!coreFns.has(n))throw Error(n);moved.push({name:n,from:'web/modules/ai-change-applier/core.js',to:moduleFile,text:coreFns.get(n).text});return 'export '+coreFns.get(n).text;});
fs.writeFileSync(moduleFile,'// Pure structured policy formatting. Extracted unchanged from core.\n'+texts.join('\n\n')+'\n',{flag:'wx'});
edit('web/modules/ai-change-applier/core.js',(s,r)=>{for(const n of pure)s=r(s,coreFns.get(n).text,'');return "import { "+pure.join(', ') +" } from './policy-format.js';\n"+s;});
const ai=fs.readFileSync('web/tm-endturn-ai.js','utf8'),aiFns=functions(ai),schemas=['_buildSc1JsonSchema','_buildSc1bJsonSchema','_buildSc1cJsonSchema','_buildSc1qJsonSchema'];
let schemaCode='\n// Pure wire schemas retained without field or requirement changes.\n(function(root) {\n  var ns = root.TM.Endturn.AI.subcalls;\n';
for(const n of schemas){const f=aiFns.get(n);if(!f)throw Error(n);schemaCode+=f.text+'\n  ns.'+n+' = '+n+';\n';moved.push({name:n,from:'web/tm-endturn-ai.js',to:'web/tm-endturn-ai-sc1-budget.js',text:f.text});}
schemaCode+='})(typeof window !== "undefined" ? window : globalThis);\n';
edit('web/tm-endturn-ai-sc1-budget.js',s=>s+schemaCode);
edit('web/tm-endturn-ai.js',(s,r)=>{for(const n of schemas)s=r(s,aiFns.get(n).text,'var '+n+' = ns.'+n+';');return s;});
fs.writeFileSync(dir+'/moved-functions.json',JSON.stringify(moved,null,2));
console.log('Moved pure functions:',moved.length);
