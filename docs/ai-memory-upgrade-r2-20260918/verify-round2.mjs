import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const dir = 'docs/ai-memory-upgrade-r2-20260918', baseline = JSON.parse(fs.readFileSync(dir + '/baseline.json','utf8'));
const changes = JSON.parse(fs.readFileSync(dir + '/changes.json','utf8'));
const created = ['web/tm-memory-adaptive.js','web/tm-memory-long-term.js','web/tm-memory-hybrid.js','web/scripts/lib-memory-upgrade-r2.js','web/scripts/smoke-memory-adaptive-upgrade.js','web/scripts/smoke-memory-vector-upgrade.js','web/scripts/smoke-memory-model-detection.js'];
const files = Array.from(new Set(changes.map(c => c.file).concat(created))).filter(f => f.startsWith('web/')).sort();
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const checks = files.map(file => {
  const bytes = fs.readFileSync(file), last = changes.filter(c => c.file === file).at(-1);
  const result = file.endsWith('.js') ? cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:10000}) : {status:0};
  const backup = baseline.backup + '/' + file;
  return { file, bytes: bytes.length, sha256: hash(bytes), expectedHashMatches: !last || last.after === hash(bytes), syntaxExit: result.status, syntaxError: result.stderr || '', created: created.includes(file), backup: fs.existsSync(backup) ? backup : null };
});
function json(name) { return fs.existsSync(dir + '/' + name) ? JSON.parse(fs.readFileSync(dir + '/' + name,'utf8')) : null; }
function log(path) { if(!fs.existsSync(path)) return ''; const b = fs.readFileSync(path); return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,''); }
const architecture = log(dir + '/final-architecture.log');
const archFail = Array.from(architecture.matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm), m=>m[1]);
const lastRoundArch = log('docs/ai-memory-upgrade-20260918/final-arch-after-closeout.log');
const previousFailures = Array.from(lastRoundArch.matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm), m=>m[1]);
const diff = cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'});
const specialist = json('final-specialist-tests.json'), extended = json('extended-tests.json');
const ownDiff = json('own-diff-check.json') || [];
const ownDeltaClean = ownDiff.length > 0 && ownDiff.every(r => !r.output && r.exit <= 1);
const inheritedWarnings = Array.from((diff.stdout || '').matchAll(/^([^\n]+):(\d+): trailing whitespace\.\n\+([^\n]*)/gm), m => ({file:m[1],line:Number(m[2]),existedInBackup:fs.existsSync(baseline.backup+'/'+m[1]) && fs.readFileSync(baseline.backup+'/'+m[1],'utf8').includes(m[3]+'\n')}));
const report = { at: new Date().toISOString(), baselineHead: baseline.head, head: cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), branch: cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(), files: checks, scopedDiffCheck: {exit:diff.status,output:diff.stdout+diff.stderr}, ownDeltaClean, inheritedWhitespaceWarnings: inheritedWarnings, baselineTests: json('baseline-tests.json')?.summary, specialist: specialist?.summary, specialistComplete: specialist?.complete, extended: extended?.summary, extendedComplete: extended?.complete, extendedFailures: extended?.results.filter(r=>!r.pass).map(r=>({name:r.name,exit:r.exit,output:r.output.slice(-1500)})), architectureFailures: archFail, previousRoundArchitectureFailures: previousFailures, newArchitectureFailureCategories: archFail.filter(n=>!previousFailures.includes(n)), architectureComplete: architecture.includes('ref-check') && architecture.includes('13') };
report.startupRetest = json('startup-retest.json');
report.extendedFailures = extended?.results.filter(r=>!r.pass).map(r=>({name:r.name,exit:r.exit,timedOut:r.timedOut,ms:r.ms,output:r.output.slice(-1500)}));
fs.writeFileSync(dir + '/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,scopedDiffCheck:{exit:diff.status,inheritedWarnings:inheritedWarnings.length,allPresentInBackup:inheritedWarnings.every(r=>r.existedInBackup)},files:checks.map(f=>({file:f.file,hashMatches:f.expectedHashMatches,syntax:f.syntaxExit})),extendedFailures:report.extendedFailures?.map(f=>f.name)},null,2));
if (checks.some(c=>!c.expectedHashMatches||c.syntaxExit!==0)||!ownDeltaClean) process.exitCode=1;
