#!/usr/bin/env node
// smoke-endturn-followup.js - Phase 7 follow-up boundary and topology gate.
// P7-zeta split-aware: section 5 lives in tm-endturn-followup.js.

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readSource, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();
const followupPath = path.join(ROOT, 'tm-endturn-followup.js');
const aiInferPath = path.join(ROOT, 'tm-endturn-ai-infer.js');
const indexPath = path.join(ROOT, 'index.html');

assert(fs.existsSync(followupPath), 'tm-endturn-followup.js exists');
const followupSrc = fs.readFileSync(followupPath, 'utf8');
const aiInferSrc = fs.readFileSync(aiInferPath, 'utf8');
const indexSrc = fs.readFileSync(indexPath, 'utf8');

assert(/ns\.run\s*=\s*async\s+function\s*\(ctx\)/.test(followupSrc),
  'followup exposes TM.Endturn.AI.followup.run(ctx)');
assert(/TM\.Endturn\.AI\.followup\.run\s*\(ctx\)/.test(aiInferSrc),
  'ai-infer bridge calls followup.run(ctx)');

const applyLoad = indexSrc.indexOf('tm-endturn-apply.js');
const followupLoad = indexSrc.indexOf('tm-endturn-followup.js');
const inferLoad = indexSrc.indexOf('tm-endturn-ai-infer.js');
assert(applyLoad >= 0 && followupLoad > applyLoad && inferLoad > followupLoad,
  'index load order apply -> followup -> ai-infer');

const sec5FamilyCount = (src.match(/\u00a75\s*sc15-sc27\s*/g) || []).length;
assert(sec5FamilyCount === 1, 'section 5 marker appears once in endturn family, count=' + sec5FamilyCount);
assert(/\u00a75\s*sc15-sc27\s*/.test(followupSrc), 'section 5 marker lives in followup module');
assert(!/\u00a75\s*sc15-sc27\s*/.test(aiInferSrc), 'section 5 marker moved out of ai-infer module');

const followupSubcalls = [
  'sc15',
  'sc_memwrite',
  'sc16',
  'sc17',
  'sc18',
  'sc_audit',
  'sc2',
  'sc25',
  'sc27',
  'sc07',
  'sc28'
];

followupSubcalls.forEach(function(id) {
  assert(followupSrc.indexOf("'" + id + "'") >= 0, 'followup sub-call id referenced: ' + id);
});

const sc15Pos = followupSrc.indexOf("'sc15'");
const sc16Pos = followupSrc.indexOf("'sc16'");
const sc17Pos = followupSrc.indexOf("'sc17'");
const sc18Pos = followupSrc.indexOf("'sc18'");
const sc28Pos = followupSrc.indexOf("'sc28'");
assert(sc15Pos > 0 && sc16Pos > 0 && sc17Pos > 0 && sc18Pos > 0 && sc28Pos > 0,
  'core followup sub-call ids found in followup module');
assert(sc15Pos < sc16Pos && sc16Pos < sc17Pos && sc17Pos < sc18Pos,
  'source order keeps sc15 < sc16 < sc17 < sc18');

assert(followupSrc.indexOf("_queuePostTurnSubcall('sc_memwrite'") >= 0,
  'sc_memwrite remains queued post-turn');
assert(followupSrc.indexOf("_runSubcallBatch('full-specialty'") >= 0,
  'sc16/sc17/sc18 still run through _runSubcallBatch');

const finalDag = followupSrc.indexOf('var _branchASettledP = _branchA.then');
assert(finalDag >= 0, 'foreground followup uses dependency DAG');
assert(followupSrc.indexOf('var _branchBSettledP = _branchB.then', finalDag) > finalDag,
  'dependency DAG tracks branchB settlement');
assert(followupSrc.indexOf('var _auditP = _branchBSettledP.then', finalDag) > finalDag,
  'sc_audit waits only for sc16/sc17/sc18 branch');
assert(followupSrc.indexOf('var _sc07P = _branchASettledP.then', finalDag) > finalDag,
  'sc07 waits only for sc15 branch');
assert(followupSrc.indexOf('var _branchCSc27ReadyP = Promise.all([_branchBSettledP, _auditP])', finalDag) > finalDag,
  'sc27 waits for specialty branch and audit before final review');
assert(followupSrc.indexOf('var _branchCSc2ReadyP = _branchASettledP.then', finalDag) > finalDag,
  'sc2 starts after sc15 branch without waiting for specialty branch');
const finalParallel = followupSrc.indexOf('var _finalSettled = await Promise.all([_auditP, _branchCSc2ReadyP, _sc07P])');
assert(finalParallel >= 0, 'final wait joins audit + branchC + sc07 DAG promises');
assert(followupSrc.indexOf('var _specialtySummary = { sc15: "", sc16: "", sc17: "", sc18: "" }') >= 0,
  'parallel specialty summaries use deterministic slots');
assert(followupSrc.indexOf('function _buildLateSpecialtySummary()') > 0 &&
       followupSrc.indexOf('var _branchSpecialtySummary = _buildLateSpecialtySummary()') > 0 &&
       followupSrc.indexOf('if (_branchSpecialtySummary) p1Summary += _branchSpecialtySummary;') > 0,
  'sc2/sc27 share the late specialty summary builder');

assert(followupSrc.indexOf("_queuePostTurnSubcall('sc_consolidate'") >= 0,
  'sc_consolidate remains queued post-turn');
assert(followupSrc.indexOf("_awaitQueuedPostTurnSubcallsById(['sc25', 'sc28'])") >= 0,
  'sc_consolidate waits for sc25 and sc28');
assert(followupSrc.lastIndexOf('_flushQueuedPostTurnSubcalls') > followupSrc.indexOf('_logicSelfCheck'),
  'queued jobs flush after foreground cleanup/self-check');
assert(followupSrc.indexOf('ctx.record.suggestions') >= 0,
  'p2 suggestions are copied to ctx.record.suggestions');
assert(followupSrc.indexOf('msCh._mood = ms.mood.trim()') >= 0,
  'sc15 mood_shifts write back character _mood');
assert(followupSrc.indexOf('function _tmHiddenMoveForMemory') >= 0 &&
       followupSrc.indexOf('_tmHiddenMoveForMemory(h)') >= 0,
  'sc_memwrite normalizes string/object hidden_moves before memory prompt');
assert(followupSrc.indexOf('_parseOrRepairJsonResult = ctx.subcalls._parseOrRepairJsonResult') >= 0,
  'followup uses shared parse-or-repair JSON helper');
assert((followupSrc.match(/_parseOrRepairJsonResult\(/g) || []).length >= 15,
  'followup JSON subcalls route through parse-or-repair helper');
assert(followupSrc.indexOf('function _requireAIResponseOk') >= 0,
  'followup has explicit non-2xx AI response guard');
assert(followupSrc.indexOf('async function _callFollowupAI') >= 0,
  'followup has shared AI call adapter');
assert((followupSrc.match(/_callFollowupAI\(/g) || []).length >= 18 &&
       followupSrc.indexOf('throw e;') >= 0,
  'critical followup AI calls route through shared adapter and still throw on hard failures');
['sc15', 'sc16', 'sc17', 'sc18', 'sc25', 'sc27', 'sc28'].forEach(function(id) {
  assert(followupSrc.indexOf('_' + id + 'Body.response_format') >= 0,
    id + ' OpenAI response_format json_object is set');
});
assert(followupSrc.indexOf('_mwBody.response_format') >= 0,
  'sc_memwrite OpenAI response_format json_object is set');
[
  '_auditBody.response_format',
  '_consolidateBody.response_format',
  '_comp1Body.response_format',
  '_comp2Body.response_format',
  '_comp3Body.response_format',
  '_histBody.response_format'
].forEach(function(token) {
  assert(followupSrc.indexOf(token) >= 0, token + ' json_object is set');
});

console.log('[smoke-endturn-followup] pass assertions=' + passed.value);
