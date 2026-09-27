import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const { parse } = createRequire(path.resolve('package.json'))('acorn');
const dir = 'docs/api-wait-compatibility-20260920';
const json = file => JSON.parse(fs.readFileSync(dir + '/' + file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const base = json('baseline.json'), changes = json('changes.json');
const files = [...new Set(changes.map(row => row.file))].sort();
const checks = files.map(file => {
  const final = changes.filter(row => row.file === file).at(-1);
  const syntax = file.endsWith('.js') ? cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }) : { status: 0 };
  return { file, sha256: hash(file), expectedHashMatches: hash(file) === final.after, syntax: syntax.status, bytes: fs.statSync(file).size };
});
function functions(text) {
  const rows = new Map();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id) rows.set(node.id.name, text.slice(node.start, node.end).replace(/\r\n/g, '\n'));
    for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
  }
  walk(parse(text, { ecmaVersion: 'latest' })); return rows;
}
const quality = [];
const unchangedFiles = ['web/tm-ai-infra-model-detect.js', 'web/tm-ai-request-options.js', 'web/tm-endturn-ai-sc1-budget.js', 'web/tm-agent-kernel.js', 'web/tm-endturn-validity.js', 'web/tm-endturn-mode-contract.js', 'web/tm-endturn-pipeline-steps.js', 'web/tm-endturn-reliability.js'];
for (const file of unchangedFiles) quality.push({ check: file + ' unchanged', ok: base.files.find(row => row.file === file)?.sha256 === hash(file) });
const protectedFunctions = {
  'web/tm-endturn-ai.js': ['_tok', '_buildFetchBody', '_buildSc1Schema', '_parseOrRepairJsonResult', '_runSubcall', '_runSubcallBatch'],
  'web/tm-endturn-agent-mode.js': ['_depthGate', '_selfCheck', '_buildSystemPrompt', '_buildTurnPrompt', '_qualityGate', '_dispatch', '_snapshot', '_rollback'],
  'web/tm-ai-infra.js': ['getPromptBudget', 'estimateTokens', 'checkPromptTokenBudget', 'callAISmart'],
  'web/tm-memory-agent-tools.js': ['_buildRecallPrompt', '_requestRecallPlan', '_normHit', 'exec']
};
for (const [file, names] of Object.entries(protectedFunctions)) {
  const before = functions(fs.readFileSync(path.join(base.backup, file), 'utf8'));
  const after = functions(fs.readFileSync(file, 'utf8'));
  for (const name of names) quality.push({ check: file + ':' + name + ' unchanged', ok: before.has(name) && before.get(name) === after.get(name) });
}
const run = json('resumed-run-status.json'), tests = json('resumed-full-tests.json');
const input = json('resumed-tested-inputs.json');
const stale = input.files.filter(row => !fs.existsSync(row.file) || hash(row.file) !== row.sha256).map(row => row.file);
const bytes = fs.readFileSync(dir + '/resumed-architecture.log');
const architectureText = bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8');
const archPass = [...architectureText.matchAll(/^\[lint-arch-all\] PASS\s+(lint-[a-z-]+|ref-check)\s+\(/gm)].map(m => m[1]);
const archFail = [...architectureText.matchAll(/^\[lint-arch-all\] FAIL\s+(lint-[a-z-]+|ref-check)\s+\(/gm)].map(m => m[1]);
const browser = json('browser-realtime-result.json');
const browserMatches = Object.entries(browser.sources || {}).every(([name, value]) => hash('web/' + name) === value);
const ownDiff = json('own-diff-check.json');
const diff = cp.spawnSync('git', ['diff', '--check', '--', ...files], { encoding: 'utf8' });
const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const detail = tests.results.find(row => row.name === 'smoke-api-wait-compatibility.js');
const proof = {
  at: new Date().toISOString(), head, baselineHead: base.head,
  branch: cp.execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  files: checks, qualityChecks: quality,
  baselineSpecialist: json('baseline-tests.json').summary, earlierExpanded: json('final-tests.json').summary,
  full: tests.summary, fullComplete: tests.complete,
  compatibilitySuite: detail ? { pass: detail.pass, output: detail.output } : null,
  architecture: { pass: archPass, fail: archFail },
  commands: run.results, runComplete: run.complete, testedFileCount: input.files.length,
  changedDuringRun: run.changedDuringRun, changedAfterTests: stale,
  browser: { version: browser.version, outcome: browser.outcome, requests: browser.requests, profileRemoved: browser.profileRemoved, sourcesMatch: browserMatches },
  ownDeltaClean: ownDiff.length > 0 && ownDiff.every(row => !row.output && row.exit <= 1),
  scopedDiff: { exit: diff.status, output: (diff.stdout || '') + (diff.stderr || '') }
};
proof.ok = head === base.head && checks.every(row => row.expectedHashMatches && row.syntax === 0)
  && quality.every(row => row.ok) && run.complete === true && run.results.every(row => row.exit === 0)
  && tests.complete === true && tests.summary.fail === 0 && tests.summary.skipped === 0 && tests.summary.waived === 0
  && detail?.pass === true && archPass.length === 13 && archFail.length === 0
  && !stale.length && !run.changedDuringRun.length && browser.outcome?.ok === true && browserMatches
  && proof.ownDeltaClean && diff.status === 0;
fs.writeFileSync(dir + '/verification.json', JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ ok: proof.ok, files: files.length, qualityFailures: quality.filter(row => !row.ok), full: proof.full, architecture: proof.architecture, changed: stale, browser: proof.browser.outcome, diff: proof.scopedDiff }, null, 2));
if (!proof.ok) process.exitCode = 1;
