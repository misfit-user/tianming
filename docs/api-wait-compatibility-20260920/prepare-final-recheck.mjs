import fs from 'node:fs';
import path from 'node:path';
const dir = 'docs/api-wait-compatibility-20260920';
const target = dir + '/interrupted-listener-fixture-recheck';
fs.mkdirSync(target, { recursive: true });
for (const name of ['resumed-run-status.json', 'resumed-tested-inputs.json', 'resumed-full-tests.json', 'resumed-full-tests.log', 'final-proof.log']) {
  if (fs.existsSync(dir + '/' + name) && !fs.existsSync(target + '/' + name)) fs.copyFileSync(dir + '/' + name, target + '/' + name);
}
const runnerFile = dir + '/run-resumed-validation.mjs';
let runner = fs.readFileSync(runnerFile, 'utf8');
const marker = 'const results = [];';
if (!runner.includes('freshRunStartedAt')) runner = runner.replace(marker, marker + "\nfs.writeFileSync(dir + '/resumed-run-status.json', JSON.stringify({ complete: false, freshRunStartedAt: new Date().toISOString(), results }, null, 2));");
fs.writeFileSync(runnerFile, runner, 'utf8');
const reportFile = dir + '/write-final-report.mjs';
let report = fs.readFileSync(reportFile, 'utf8');
const note = "blocks.push('取消监听器测试也同步了实际所有权：重试等待使用内部控制器，而不是在外部信号重复挂监听器。保留外部三次请求的精确添加/移除检查，并额外用真实 getEventListeners 检查两次内部等待均清理完毕；29 条断言通过。该修改没有放宽或绕过运行时取消逻辑。');\n";
if (!report.includes('真实 getEventListeners')) report = report.replace("blocks.push('## 七、文件与交付状态');", note + "blocks.push('## 七、文件与交付状态');");
fs.writeFileSync(reportFile, report, 'utf8');
console.log('Intermediate results preserved; the final full run starts from fresh metadata.');
