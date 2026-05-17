'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const indexSrc = read('index.html');
const timingPath = path.join(ROOT, 'tm-endturn-timing-ledger.js');
const timingSrc = fs.existsSync(timingPath) ? fs.readFileSync(timingPath, 'utf8') : '';
const executorSrc = read('tm-endturn-pipeline-executor.js');
const inferSrc = read('tm-endturn-ai-infer.js');
const systemsSrc = read('tm-endturn-systems.js');
const stepsSrc = read('tm-endturn-pipeline-steps.js');
const postJobsSrc = read('tm-post-turn-jobs.js');
const followupSrc = read('tm-endturn-followup.js');
const infraSrc = read('tm-ai-infra.js');

assert(fs.existsSync(timingPath), 'endturn timing ledger module exists');
assert(indexSrc.indexOf('tm-endturn-timing-ledger.js') >= 0, 'timing ledger is loaded by index.html');
assert(/TM\.Endturn\.Timing/.test(timingSrc), 'TM.Endturn.Timing namespace exists');
assert(/startLedger/.test(timingSrc) && /mark/.test(timingSrc) && /finishLedger/.test(timingSrc), 'timing ledger exposes start/mark/finish');
assert(/GM\._endturnTimingLedger/.test(timingSrc), 'timing ledger writes GM._endturnTimingLedger');
assert(/TM\.Endturn\.Timing\.startLedger/.test(executorSrc), 'pipeline executor starts timing ledger');
assert(/TM\.Endturn\.Timing\.mark/.test(executorSrc), 'pipeline executor records step timings');

assert(!/setTimeout\s*\(\s*resolve\s*,\s*300\s*\)/.test(inferSrc), 'strict-history artificial 300ms delay removed');

assert(!/await\s+executeNpcBehaviors\s*\(/.test(systemsSrc), 'systems step no longer awaits NPC behavior in foreground');
assert(/_scheduleNpcBehaviorPostRender/.test(stepsSrc), 'pipeline schedules NPC behavior after render');
assert(/npc_behavior/.test(stepsSrc), 'NPC behavior is tracked as a post-turn job');

assert(/_POST_TURN_CRITICAL_IDS/.test(postJobsSrc), 'post-turn jobs declare critical ids');
assert(/_detachRemainingPostTurnJobs/.test(postJobsSrc), 'post-turn jobs detach optional jobs after critical wait');
assert(/criticalOnly/.test(postJobsSrc), 'post-turn await supports critical-only policy');
assert(/npc_behavior/.test(postJobsSrc), 'npc_behavior post-turn policy is declared');
assert(/_postTurnDetachedJobs/.test(postJobsSrc), 'detached post-turn jobs are retained for save waits');

assert(/_branchCSc2ReadyP/.test(followupSrc), 'followup starts SC2 branch from the narrower dependency');
assert(/_branchCSc27ReadyP/.test(followupSrc), 'followup waits for specialty/audit before SC27');
assert(!/Promise\.all\s*\(\s*\[\s*_branchASettledP\s*,\s*_branchBSettledP\s*\]\s*\)\.then\s*\([^)]*?_runBranchC/s.test(followupSrc), 'SC2 no longer waits for both A and B branches');
assert(/_buildLateSpecialtySummary/.test(followupSrc), 'SC27 can consume late specialty summaries');

assert(/adaptiveMaxConcurrent/.test(infraSrc), 'AI queue supports adaptive max concurrency setting');
assert(/_aiQueueHealth/.test(infraSrc), 'AI queue tracks health for adaptive concurrency');
assert(/recordResult/.test(infraSrc), 'AI queue records success/failure outcomes');

assert(/_aiQueuePickNext/.test(infraSrc), 'AI queue reserves foreground dispatch capacity');
assert(/backgroundMaxConcurrent/.test(infraSrc), 'AI queue caps background/low-priority lanes');
assert(!/await\s+ctx\.subcalls\.preThreeSystemsP/.test(stepsSrc), 'three-systems prefetch no longer blocks foreground AI');
assert(!/await\s+ctx\.subcalls\.preLongTermP/.test(stepsSrc), 'long-term digest prefetch no longer blocks foreground AI');
assert(/_POST_TURN_NEXT_REQUIRED_IDS/.test(postJobsSrc), 'post-turn jobs distinguish next-turn-required jobs');
assert(!/npc_behavior:\s*true/.test(postJobsSrc), 'npc_behavior is not always a next-turn blocker');
assert(!/sc28:\s*true/.test(postJobsSrc), 'sc28 is not always a next-turn blocker');
assert(!/compress_ai_memory:\s*true/.test(postJobsSrc), 'AI memory compression is not a next-turn blocker');
assert(!/compress_foreshadows:\s*true/.test(postJobsSrc), 'foreshadow compression is not a next-turn blocker');
assert(!/compress_conversation:\s*true/.test(postJobsSrc), 'conversation compression is not a next-turn blocker');
assert(/_awaitPostTurnJobsForSave\(\['sc25'/.test(followupSrc + '\n' + read('tm-endturn-render.js')), 'autosave waits only persistence-critical post-turn jobs');
assert(/_queuePostTurnSubcall\('compress_ai_memory'/.test(followupSrc), 'AI memory compression is queued post-turn');
assert(/_queuePostTurnSubcall\('compress_foreshadows'/.test(followupSrc), 'foreshadow compression is queued post-turn');
assert(/_queuePostTurnSubcall\('compress_conversation'/.test(followupSrc), 'conversation compression is queued post-turn');
assert(!/await\s+fetch\(opts\.url/.test(inferSrc + '\n' + read('tm-endturn-ai.js')), 'JSON repair uses controlled AI queue instead of raw fetch');

console.log('[smoke-endturn-performance-optimizations] pass assertions=' + passed.value);
