import fs from 'node:fs';
import crypto from 'node:crypto';
import cp from 'node:child_process';
const dir = 'docs/ai-memory-upgrade-20260918';
const baseline = JSON.parse(fs.readFileSync(dir + '/baseline.json', 'utf8'));
const changes = JSON.parse(fs.readFileSync(dir + '/changes.json', 'utf8'));
const files = [...new Set(changes.map(row => row.file).filter(file => file.startsWith('web/')))];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const han = text => (String(text).match(/\p{Script=Han}/gu) || []).join('');
const inspected = files.map(file => {
  const bytes = fs.readFileSync(file), last = changes.filter(row => row.file === file).at(-1);
  const syntax = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 10000 });
  const original = baseline.files.find(row => row.file === file);
  const before = original ? fs.readFileSync(baseline.backup + '/' + file) : null;
  return { file, sha256: sha(bytes), expectedHashMatches: sha(bytes) === last.after, syntaxExit: syntax.status, syntaxError: syntax.stderr || '', originalChinesePreserved: before ? han(before.toString('utf8')) === han(bytes.toString('utf8')) : null, created: !original };
});
const diff = cp.spawnSync('git', ['diff', '--check', '--', ...files], { encoding: 'utf8' });
const readReport = name => fs.existsSync(dir + '/' + name) ? JSON.parse(fs.readFileSync(dir + '/' + name, 'utf8')) : null;
const full = readReport('full-smokes.json'), memory = readReport('final-memory-smokes.json');
function readLog(file) { const b = fs.readFileSync(file); return b.toString(b[0] === 255 && b[1] === 254 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''); }
const archNames = name => fs.existsSync(dir + '/' + name) ? [...readLog(dir + '/' + name).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(match => match[1]) : [];
const archBefore = archNames('baseline-arch.log'), archAfter = archNames('final-arch-after-closeout.log');
const report = { at: new Date().toISOString(), head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baselineHead: baseline.head, files: inspected, scopedDiffCheck: { exit: diff.status, output: diff.stdout + diff.stderr }, fullScanSummary: full && full.summary, finalMemorySummary: memory && memory.summary, archBefore, archAfter, newlyFailingArchChecks: archAfter.filter(name => !archBefore.includes(name)) };
fs.writeFileSync(dir + '/closeout.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (inspected.some(row => !row.expectedHashMatches || row.syntaxExit !== 0) || diff.status !== 0) process.exitCode = 1;
