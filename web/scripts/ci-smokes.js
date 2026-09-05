'use strict';
const cp = require('child_process'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { discover, validateReport } = require('./lib-smoke-evidence');
const WEB = path.join(__dirname, '..');
function main() {
  const runId = crypto.randomUUID();
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WEB, encoding: 'utf8' }).trim();
  const tests = discover();
  const parent = path.join(WEB, 'dev-tools/arch-guard'); fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, 'ci-'));
  const reportFile = path.join(dir, 'smoke-report.json');
  console.log('[ci-smokes] run=' + runId + ' HEAD=' + head + ' report=' + reportFile);
  const child = cp.spawnSync(process.execPath, [path.join(__dirname, 'run-smokes.js'), '--all', '--no-retry', '--run-id', runId, '--report', reportFile], { stdio: 'inherit', cwd: WEB, windowsHide: true });
  if (child.error || child.signal || child.status !== 0) throw new Error('smoke-evidence-runner-failed');
  if (cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WEB, encoding: 'utf8' }).trim() !== head
      || JSON.stringify(discover()) !== JSON.stringify(tests)) throw new Error('smoke-evidence-source-changed');
  const result = validateReport(JSON.parse(fs.readFileSync(reportFile, 'utf8')), { runId, head, tests, runnerExit: child.status });
  console.log('[ci-smokes] PASS gate ' + JSON.stringify(result));
  if (result.waived) console.log('[ci-smokes] 缺席资产检查已明确豁免；其余断言全部执行。');
  return result;
}
if (require.main === module) { try { main(); } catch (error) { console.error('[ci-smokes] FAIL ' + error.message); process.exitCode = 1; } }
module.exports = { main };
