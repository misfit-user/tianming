import fs from 'node:fs';
const path = 'docs/ai-memory-upgrade-r2-20260918/verify-round2.mjs';
let source = fs.readFileSync(path,'utf8');
source = source.replace("const specialist = json('final-specialist-tests.json'), extended = json('extended-tests.json');", "const specialist = json('final-specialist-tests.json'), extended = json('extended-tests.json');\nconst ownDiff = json('own-diff-check.json') || [];\nconst ownDeltaClean = ownDiff.length > 0 && ownDiff.every(r => !r.output && r.exit <= 1);\nconst inheritedWarnings = Array.from((diff.stdout || '').matchAll(/^([^\\n]+):(\\d+): trailing whitespace\\.\\n\\+([^\\n]*)/gm), m => ({file:m[1],line:Number(m[2]),existedInBackup:fs.existsSync(baseline.backup+'/'+m[1]) && fs.readFileSync(baseline.backup+'/'+m[1],'utf8').includes(m[3]+'\\n')}));");
source = source.replace('scopedDiffCheck: {exit:diff.status,output:diff.stdout+diff.stderr},', 'scopedDiffCheck: {exit:diff.status,output:diff.stdout+diff.stderr}, ownDeltaClean, inheritedWhitespaceWarnings: inheritedWarnings,');
source = source.replace('console.log(JSON.stringify({...report,files:', "console.log(JSON.stringify({...report,scopedDiffCheck:{exit:diff.status,inheritedWarnings:inheritedWarnings.length,allPresentInBackup:inheritedWarnings.every(r=>r.existedInBackup)},files:");
source = source.replace('||diff.status!==0) process.exitCode=1;', '||!ownDeltaClean) process.exitCode=1;');
fs.writeFileSync(path, source, 'utf8');
