import fs from 'node:fs';import {edit} from './patch-utils.mjs';
const d='docs/endturn-final-closeout-20260919';
edit('web/scripts/smoke-perf-save-preparation.js',(s,r)=>{
 s=r(s,'if (selectedCase === null) {\n  let passed = 0, failed = 0;','if (selectedCase === null) {\n  const deadline = Date.now() + 290000; // Remains inside the existing 300-second outer guard.\n  let passed = 0, failed = 0;');
 return r(s,"{ encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }","{ encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: Math.max(1, deadline - Date.now()) }");
});
let proof=fs.readFileSync(d+'/verify-final.mjs','utf8');
proof=proof.replace("import {parse} from 'acorn';","import {createRequire} from 'node:module';import path from 'node:path';const {parse}=createRequire(path.resolve('package.json'))('acorn');");
fs.writeFileSync(d+'/verify-final.mjs',proof);
let runner=fs.readFileSync(d+'/run-final-validation.mjs','utf8');
runner=runner.replace("const before=sourceFiles.map", "for(const folder of ['web','web/scripts']) for(const f of fs.readdirSync(folder)) { const file=folder+'/'+f; if(/\\.(?:js|mjs)$/.test(f)&&!sourceFiles.includes(file))sourceFiles.push(file); }\nconst workspace=JSON.parse(fs.readFileSync(d+'/validation-workspace.json','utf8'));process.env.TEMP=workspace.temp;process.env.TMP=workspace.temp;\nconst before=sourceFiles.map");
fs.writeFileSync(d+'/run-final-validation.mjs',runner);
for(const name of ['final-full-tests.json','final-full-tests.log','final-tested-inputs.json','final-run-status.json','browser-realtime-result.json']){const source=d+'/'+name,dest=d+'/before-resume-'+name;if(fs.existsSync(source)&&!fs.existsSync(dest))fs.copyFileSync(source,dest);}
console.log('Validation preserves previous evidence, runs complete fixtures in bounded isolated workers, and uses the dedicated D-drive temporary directory.');
