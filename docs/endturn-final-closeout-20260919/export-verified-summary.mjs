import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const directory = 'docs/endturn-final-closeout-20260919';
const proof = JSON.parse(fs.readFileSync(directory + '/verification.json', 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (!proof.ok) throw Error('Final verification is not complete; do not export a passing summary.');
const changed = proof.files.filter(row => !fs.existsSync(row.file) || hash(fs.readFileSync(row.file)) !== row.sha256);
if (changed.length) throw Error('Files changed after verification: ' + changed.map(row => row.file).join(', '));
const summary = { verifiedAt: proof.at, branch: proof.branch, head: proof.head, sourceFiles: proof.files.length,
  fullTests: proof.full, fullComplete: proof.fullComplete, sourceChangesDuringRun: proof.changedDuringRun,
  architecture: proof.architecture, qualityChecks: proof.quality, scopedDiff: proof.scopedDiff,
  independentCommands: proof.commands, additionalCases: proof.caseResults,
  browser: proof.browser.outcome, browserSourceHashesMatch: proof.browserSourcesMatch,
  exactMemoryScoringBenchmark: proof.memoryBenchmark, benchmarkSourceHashMatches: proof.benchmarkSourceMatches,
  startupScriptCount: proof.scriptCount, files: proof.files,
  scope: 'Local source and engineering validation only; no paid AI run, commit, push, package build or deployment.' };
const summaryPath = directory + '/acceptance-summary.json';
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
const reportPath = directory + '/README.md';
for (const path of [reportPath, summaryPath]) {
  const bytes = fs.readFileSync(path);
  console.log(JSON.stringify({ path, bytes: bytes.length, sha256: hash(bytes), gzipBase64: zlib.gzipSync(bytes).toString('base64') }));
}
