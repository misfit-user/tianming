'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const timingPath = path.join(ROOT, 'tm-endturn-timing-ledger.js');
const inferSrc = read('tm-endturn-ai-infer.js');
const systemsSrc = read('tm-endturn-systems.js');
const stepsSrc = read('tm-endturn-pipeline-steps.js');
const postJobsSrc = read('tm-post-turn-jobs.js');
const followupSrc = read('tm-endturn-followup.js');
const coreSrc = read('tm-endturn-core.js');

async function main() {
assert(fs.existsSync(timingPath), 'endturn timing ledger module exists');

assert(!/setTimeout\s*\(\s*resolve\s*,\s*300\s*\)/.test(inferSrc), 'strict-history artificial 300ms delay removed');

assert(!/await\s+executeNpcBehaviors\s*\(/.test(systemsSrc), 'systems step no longer awaits NPC behavior in foreground');

assert(!/Promise\.all\s*\(\s*\[\s*_branchASettledP\s*,\s*_branchBSettledP\s*\]\s*\)\.then\s*\([^)]*?_runBranchC/s.test(followupSrc), 'SC2 no longer waits for both A and B branches');
// 2026-09-18：整段子调用可能已经落账，默认不重放；网络恢复由传输层的共享预算负责。
// 明确配置仍然保留。smoke-turn-request-reliability 动态验证传输耗尽不触发外层重放。

assert(!/await\s+ctx\.subcalls\.preThreeSystemsP/.test(stepsSrc), 'three-systems prefetch no longer blocks foreground AI');
assert(!/await\s+ctx\.subcalls\.preLongTermP/.test(stepsSrc), 'long-term digest prefetch no longer blocks foreground AI');
assert(!/npc_behavior:\s*true/.test(postJobsSrc), 'npc_behavior is not always a next-turn blocker');
assert(!/sc28:\s*true/.test(postJobsSrc), 'sc28 is not always a next-turn blocker');
assert(!/compress_ai_memory:\s*true/.test(postJobsSrc), 'AI memory compression is not a next-turn blocker');
assert(!/compress_foreshadows:\s*true/.test(postJobsSrc), 'foreshadow compression is not a next-turn blocker');
assert(!/compress_conversation:\s*true/.test(postJobsSrc), 'conversation compression is not a next-turn blocker');
assert(!/await\s+fetch\(opts\.url/.test(inferSrc + '\n' + read('tm-endturn-ai.js')), 'JSON repair uses controlled AI queue instead of raw fetch');
await require('./lib-ai-priority-routing').verifyGenericPriority(assert);
assert(!/fetch\(_mUrl/.test(coreSrc), 'monthly chronicle no longer bypasses the shared AI queue');

console.log('[smoke-endturn-performance-optimizations] pass assertions=' + passed.value);
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
