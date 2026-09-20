import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const dir = 'docs/endturn-reliability-20260918';
const json = name => JSON.parse(fs.readFileSync(dir + '/' + name, 'utf8'));
const base = json('baseline.json'), changes = json('changes.json');
const created = ['web/tm-endturn-reliability.js','web/tm-memory-mode-bridge.js','web/scripts/lib-turn-reliability.js','web/scripts/smoke-turn-memory-parity.js','web/scripts/smoke-turn-request-reliability.js','web/scripts/smoke-turn-stream-reliability.js'];
const files = [...new Set(changes.map(c=>c.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const results = files.map(file => {
  const bytes = fs.readFileSync(file), last = changes.filter(c=>c.file===file).at(-1);
  const syntax = file.endsWith('.js') ? cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:10000}) : {status:0,stderr:''};
  return { file, sha256:sha(bytes), hashMatches:!last || last.after===sha(bytes), syntaxExit:syntax.status, syntaxError:syntax.stderr || '', bytes:bytes.length, lines:bytes.toString('utf8').split('\n').length, created:created.includes(file) };
});
function readLog(name) { const bytes=fs.readFileSync(dir+'/'+name); return bytes.toString(bytes[0]===255&&bytes[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,''); }
const archFailures = name => [...readLog(name).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const beforeArch = archFailures('baseline-architecture.log'), afterArch = archFailures('final-architecture.log');
const before = json('baseline-tests.json'), after = json('final-tests.json');
const previousFailures = before.results.filter(r=>!r.pass).map(r=>r.name), failures = after.results.filter(r=>!r.pass).map(r=>r.name);
const newTests = after.results.filter(r=>/^smoke-turn-(memory-parity|request-reliability|stream-reliability)\.js$/.test(r.name)).map(r=>({name:r.name,pass:r.pass,detail:String(r.output).trim().split('\n').at(-1)}));
const ownDiff = json('own-diff-check.json');
const fullDiff = cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'});
const report = {at:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),baselineHead:base.head,files:results,baselineTests:before.summary,finalTests:after.summary,testsComplete:after.complete,newTests,previousFailures,failures,newFailures:failures.filter(f=>!previousFailures.includes(f)),baselineArchitectureFailures:beforeArch,architectureFailures:afterArch,newArchitectureFailures:afterArch.filter(f=>!beforeArch.includes(f)),ownDiffClean:ownDiff.every(row=>!row.output&&row.exit<=1),workingTreeDiffCheck:{exit:fullDiff.status,output:fullDiff.stdout+fullDiff.stderr},manifest:json('manifest-check.json'),benchmark:json('benchmark.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,files:results.map(f=>({file:f.file,hash:f.hashMatches,syntax:f.syntaxExit,lines:f.lines})),workingTreeDiffCheck:{exit:fullDiff.status,warningLines:fullDiff.stdout.split('\n').filter(l=>l.includes('trailing whitespace')).length}},null,2));
if(results.some(r=>!r.hashMatches||r.syntaxExit)||!report.ownDiffClean||!after.complete||report.newFailures.length)process.exitCode=1;
