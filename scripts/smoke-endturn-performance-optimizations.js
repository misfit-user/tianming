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
const coreSrc = read('tm-endturn-core.js');
const infraSrc = read('tm-ai-infra.js');
const applySrc = read('tm-endturn-apply.js');
const aiSubcallSrc = read('tm-endturn-ai.js');
const factionDecisionSrc = read('tm-faction-npc-llm-decision.js');
const postTurnSrc = read('tm-post-turn-jobs.js');
const chronicleSrc = read('tm-chronicle-system.js');
const factionEnrichSrc = read('tm-faction-npc-llm-enrich.js');
const kejuRuntimeSrc = read('tm-keju-runtime.js');

assert(fs.existsSync(timingPath), 'endturn timing ledger module exists');
assert(indexSrc.indexOf('tm-endturn-timing-ledger.js') >= 0, 'timing ledger is loaded by index.html');
assert(/TM\.Endturn\.Timing/.test(timingSrc), 'TM.Endturn.Timing namespace exists');
assert(/startLedger/.test(timingSrc) && /mark/.test(timingSrc) && /finishLedger/.test(timingSrc), 'timing ledger exposes start/mark/finish');
assert(/GM\._endturnTimingLedger/.test(timingSrc), 'timing ledger writes GM._endturnTimingLedger');
assert(/TM\.Endturn\.Timing\.startLedger/.test(executorSrc), 'pipeline executor starts timing ledger');
assert(/TM\.Endturn\.Timing\.mark/.test(executorSrc), 'pipeline executor records step timings');

assert(!/setTimeout\s*\(\s*resolve\s*,\s*300\s*\)/.test(inferSrc), 'strict-history artificial 300ms delay removed');

assert(!/await\s+executeNpcBehaviors\s*\(/.test(systemsSrc), 'systems step no longer awaits NPC behavior in foreground');
assert(/_markSystemStage/.test(systemsSrc), 'systems step records fine-grained stage timings');
assert(/GM\._lastEndturnSystemsTimings/.test(systemsSrc), 'systems step stores last detailed timings');
assert(/showLoading\("检查历史事件"/.test(systemsSrc), 'systems tail updates loading after ChangeQueue');
assert(/changeQueueApply/.test(systemsSrc), 'ChangeQueue apply stage is timed separately');
assert(/_changeQueueLen <= 0/.test(systemsSrc) && /skipped:\s*true/.test(systemsSrc), 'systems step skips empty ChangeQueue without applyAll');
assert(/queueLength:\s*_changeQueueLen/.test(systemsSrc) && /byType:\s*_changeQueueStats/.test(systemsSrc), 'systems timing records ChangeQueue stats');
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
assert(/id:\s*'sc19'[\s\S]{0,220}priority:\s*'background'/.test(followupSrc), 'SC19 sparse detail enrichment runs as background work');
assert(/id:\s*'sc19'[\s\S]{0,260}timeoutMs:\s*45000/.test(followupSrc), 'SC19 sparse detail enrichment has a bounded timeout');
assert(/id:\s*'sc19'[\s\S]{0,280}maxRetries:\s*0/.test(followupSrc), 'SC19 sparse detail enrichment has no retry amplification');
assert(/_enrichExpectedKeys[\s\S]{0,180}factions_enriched/.test(followupSrc), 'SC19 validates faction enrichment with the actual requested key');
assert(/_enrichExpectedKeys[\s\S]{0,260}characters_enriched/.test(followupSrc), 'SC19 validates character enrichment with the actual requested key');
assert(/repair:\s*false/.test(followupSrc), 'SC19 sparse detail enrichment does not launch foreground repair');
assert(/_reviewText27\.length > 7000/.test(followupSrc), 'SC27 trims very long narrative review text');
assert(/id:\s*'sc27'[\s\S]{0,180}priority:\s*'high'/.test(followupSrc), 'SC27 foreground review uses high queue priority');
assert(/id:\s*'sc27'[\s\S]{0,220}timeoutMs:\s*60000/.test(followupSrc), 'SC27 foreground review has bounded timeout');
assert(/id:\s*'sc27'[\s\S]{0,240}maxRetries:\s*0/.test(followupSrc), 'SC27 foreground review has bounded internal retries');
assert(/id === 'sc27'\s*\?\s*0\s*:\s*1/.test(aiSubcallSrc), 'SC27 disables outer subcall retry amplification');
assert(/max_tokens:\s*_tok\(3000\)/.test(followupSrc), 'SC27 output budget is bounded to review-sized JSON');
assert(/var _needsForegroundHistoryCheck =/.test(followupSrc), 'historical foreground check controls post-turn launch timing');
assert(/if \(!_needsForegroundHistoryCheck\)[\s\S]*_flushQueuedPostTurnSubcalls/.test(followupSrc), 'post-turn jobs are not flushed before foreground history check');
assert(/id: 'history_check'[\s\S]*priority: 'critical'/.test(followupSrc), 'foreground history check is queued as critical work');

assert(/adaptiveMaxConcurrent/.test(infraSrc), 'AI queue supports adaptive max concurrency setting');
assert(/_aiQueueHealth/.test(infraSrc), 'AI queue tracks health for adaptive concurrency');
assert(/recordResult/.test(infraSrc), 'AI queue records success/failure outcomes');

assert(/_aiQueuePickNext/.test(infraSrc), 'AI queue reserves foreground dispatch capacity');
assert(/backgroundMaxConcurrent/.test(infraSrc), 'AI queue caps background/low-priority lanes');
assert(/callAI\(currentPrompt,\s*maxTok,\s*signal,\s*options\.tier,\s*\{\s*priority:\s*options\.priority/.test(infraSrc), 'callAISmart forwards explicit priority');
assert(/priority:\s*opts\.priority \|\| 'normal'[\s\S]*repairPriority:\s*opts\.repairPriority/.test(aiSubcallSrc), 'JSON repair inherits original call priority');
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
assert(/function\s+_callAIMessagesStreamDirect/.test(infraSrc) && /_aiQueue\.enqueue\(function\(\)\s*\{\s*return _callAIMessagesStreamDirect/.test(infraSrc), 'streaming AI calls are routed through the shared AI queue');
assert(/priority:\s*opts\.priority/.test(infraSrc), 'generic AI helpers forward explicit priority into the queue');
assert(/callAIMessagesStream\(_sc1Body\.messages[\s\S]*priority:\s*'critical'/.test(aiSubcallSrc), 'SC1 streaming request is queued as critical foreground work');
assert(/callAIMessages\(_callABody\.messages[\s\S]*priority:\s*'critical'/.test(aiSubcallSrc), 'SC1 Call A compression is queued as critical foreground work');
assert(/typeof _callARaw === 'string'/.test(aiSubcallSrc), 'SC1 Call A accepts callAIMessages string results');
assert(/结构化数据'[\s\S]{0,260}priority:\s*'critical'/.test(aiSubcallSrc), 'SC1 repair fallback remains critical priority');
assert(/历史检查'[\s\S]{0,260}priority:\s*'critical'/.test(followupSrc), 'history-check JSON repair remains critical priority');
assert(/伏笔记忆'[\s\S]{0,260}priority:\s*'high'/.test(followupSrc), 'sc25 JSON repair keeps high priority');
assert(/世界快照'[\s\S]{0,260}priority:\s*'low'/.test(followupSrc), 'sc28 JSON repair keeps low priority');
assert(/callAIWithTools\(_reconcilePrompt[\s\S]*priority:\s*'high'/.test(applySrc), 'foreground reconciliation tool call is queued as high priority');
assert(/callAIWithTools\(_reconcilePrompt[\s\S]*timeoutMs:\s*60000[\s\S]*maxRetries:\s*0/.test(applySrc), 'foreground reconciliation tool call has bounded timeout and no inner retry amplification');
assert(/global\.callAI\(promptText,\s*maxTokens,\s*null,\s*'secondary',\s*\{\s*priority:\s*'background'/.test(factionDecisionSrc), 'background faction NPC LLM uses background queue priority');
assert(/global\.callAI\(promptText,\s*maxTokens,\s*null,\s*'secondary',[\s\S]*timeoutMs:\s*timeoutMs \|\| undefined[\s\S]*maxRetries:\s*0/.test(factionDecisionSrc), 'background faction NPC LLM forwards configured timeout to fetch layer');
assert(/callAI\(_compressPrompt,\s*500,\s*null,\s*'primary',\s*\{\s*priority:\s*'background'/.test(coreSrc), 'tail AI memory summary uses background queue priority');
assert(/callAI\(_compressPrompt,\s*500,\s*null,\s*'primary',[\s\S]*timeoutMs:\s*45000[\s\S]*maxRetries:\s*0/.test(coreSrc), 'tail AI memory summary is bounded to avoid queue stalls');
assert(/callAISmart\(checkPrompt,\s*1500,[\s\S]*priority:\s*'background'/.test(coreSrc), 'post-turn historical deviation check uses background priority');
assert(/callAISmart\(checkPrompt,\s*1500,[\s\S]*timeoutMs:\s*60000[\s\S]*fetchMaxRetries:\s*0/.test(coreSrc), 'post-turn historical deviation check has bounded fetch attempts');
assert(!/fetch\(_mUrl/.test(coreSrc), 'monthly chronicle no longer bypasses the shared AI queue');
assert(/callAIMessages\(\[[\s\S]*priority:\s*'background'/.test(coreSrc), 'monthly chronicle uses background queue priority');
assert(/callAIMessages\(\[[\s\S]*timeoutMs:\s*45000[\s\S]*maxRetries:\s*0/.test(coreSrc), 'monthly chronicle is bounded to avoid queue stalls');
assert((postTurnSrc.match(/priority:\s*'background'/g) || []).length >= 4, 'post-turn optional memory jobs use background queue priority');
assert(/callAI\(prompt,\s*1500,\s*null,\s*'primary',\s*\{\s*priority:\s*'background'/.test(chronicleSrc), 'chronicle year generation uses background queue priority');
assert(/global\.callAI\(combined,\s*200,\s*null,\s*'secondary',\s*\{\s*priority:\s*'background'/.test(factionEnrichSrc), 'NPC faction enrichment uses background queue priority');
assert(/callAISmart\(prompt,\s*300,[\s\S]*priority:\s*'high'/.test(kejuRuntimeSrc), 'foreground keju trigger check uses high priority');
assert(/callAISmart\(prompt,\s*300,[\s\S]*timeoutMs:\s*30000[\s\S]*fetchMaxRetries:\s*0/.test(kejuRuntimeSrc), 'foreground keju trigger check has bounded fetch attempts');

console.log('[smoke-endturn-performance-optimizations] pass assertions=' + passed.value);
