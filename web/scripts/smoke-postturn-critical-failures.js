#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { functionSource } = require('./lib-perf-round1');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'tm-post-turn-jobs.js'), 'utf8');
const start = source.indexOf('var _POST_TURN_NEXT_REQUIRED_IDS');
const end = source.indexOf('function _compressOldArchives', start);
if (start < 0 || end <= start) throw new Error('post-turn queue source slice missing');

let assertions = 0;
function ok(value, label) {
  if (!value) throw new Error('[smoke-postturn-critical-failures] ' + label);
  assertions++;
}

const ctx = { console, Promise, Date, Object, JSON, Error, _dbg() {}, TM: {}, recordMemoryDiagnostic() {} };
ctx.window = ctx;
ctx._tmLoadGen = 0;
vm.createContext(ctx);
vm.runInContext(source.slice(start, end), ctx);

function resetWorld() {
  ctx.GM = { turn: 6, sid: 's1', _campaignId: 'c1', _turnAiResults: { sourcePayload: { keep: true } } };
  ctx.P = { marker: 'p1' };
  ctx._tmLoadGen = 0;
}

async function rejects(fn) {
  try { await fn(); return null; }
  catch (error) { return error; }
}

async function main() {
  resetWorld();
  ctx._enqueuePostTurnJob('sc25c', async function() { throw new Error('sc25c forced failure'); });
  const failedQueue = ctx.GM._postTurnJobs;
  const error = await rejects(() => ctx._awaitPostTurnJobs());
  ok(error && /sc25c/.test(error.message), 'critical sc25c rejection blocks next-turn freshness');
  ok(ctx.GM._postTurnJobs === failedQueue && ctx.GM._postTurnJobs.pending.length === 1, 'failed critical queue remains available for retry and diagnosis');
  ok(ctx.GM._turnAiResults.sourcePayload.keep === true, 'failed critical job preserves source AI data');
  const saveError = await rejects(() => ctx._awaitPostTurnJobsForSave());
  ok(saveError && /sc25c/.test(saveError.message), 'failed critical job blocks save commit');

  let childRan = false;
  ctx._enqueuePostTurnJob('dependent-probe', async function() { childRan = true; }, { dependsOn: ['sc25c'] });
  const child = ctx.GM._postTurnJobs.pending.find(job => job.id === 'dependent-probe');
  const childResult = await child.promise;
  ok(childResult && childResult.ok === false && childRan === false, 'dependency failure prevents child task execution');

  resetWorld();
  let attempts = 0;
  ctx._enqueuePostTurnJob('sc25c', async function() {
    attempts++;
    if (attempts === 1) throw new Error('temporary sc25c failure');
    return { recovered: true };
  });
  const retryJob = ctx.GM._postTurnJobs.pending[0], retryRun = retryJob.run, retryLease = retryJob.lease;
  const firstFailure = await rejects(() => ctx._awaitPostTurnJobs());
  ok(firstFailure && attempts === 1 && ctx.GM._postTurnJobs.pending[0].status === 'retryable',
    'first critical failure remains visible and records a retryable task instead of a dead Promise');
  ok(retryJob.run === retryRun && retryJob.lease === retryLease, 'retryable failure retains the exact runner and world lease');
  await ctx._awaitPostTurnJobs();
  ok(attempts === 2 && ctx.GM._postTurnJobs === null && !Object.prototype.hasOwnProperty.call(ctx.GM, '_turnAiResults'),
    'next save/turn wait rebuilds the task Promise and clears source data only after success');
  ok(retryJob.run === null && retryJob.lease === retryLease, 'successful retry releases the callable context but retains its lease evidence');
  const retryReceipt = await retryJob.promise;
  ok((await ctx._postTurnJobPromiseForWait(retryJob)) === retryReceipt && attempts === 2,
    'waiting again returns the same successful receipt without a callable retry');

  resetWorld();
  let terminalAttempts = 0;
  ctx._enqueuePostTurnJob('sc25c', async function() {
    terminalAttempts++;
    if (terminalAttempts <= 3) throw new Error('terminal-cycle-failure-' + terminalAttempts);
    return { recoveredAfterTerminalFailure: true };
  }, { maxAttempts: 3 });
  const terminalJob = ctx.GM._postTurnJobs.pending[0];
  const terminalRun = terminalJob.run, terminalLease = terminalJob.lease;
  ok(await rejects(() => ctx._awaitPostTurnJobs()) && terminalJob.status === 'retryable',
    'first failed attempt is exposed without hidden retry');
  ok(await rejects(() => ctx._awaitPostTurnJobs()) && terminalJob.status === 'retryable',
    'second explicit wait consumes only the second attempt');
  ok(await rejects(() => ctx._awaitPostTurnJobs()) && terminalJob.status === 'failed' && terminalJob.failureObserved,
    'third failure reaches a visible terminal state');
  ok(ctx.GM._turnAiResults.sourcePayload.keep === true,
    'terminal failure still preserves the immutable source payload');
  ok(terminalJob.run === terminalRun && terminalJob.lease === terminalLease,
    'observed terminal failure retains its real callable and lease for the existing next-cycle retry');
  await ctx._awaitPostTurnJobs();
  ok(terminalAttempts === 4 && terminalJob.retryCycle === 1 && terminalJob.totalAttempts === 4,
    'next explicit wait creates a fresh retry cycle instead of reusing the terminal Promise');
  ok(terminalJob.terminalFailures.length === 1 && /terminal-cycle-failure-3/.test(terminalJob.terminalFailures[0].error),
    'terminal failure diagnostics survive the fresh retry cycle');
  ok(ctx.GM._postTurnJobs === null && !Object.prototype.hasOwnProperty.call(ctx.GM, '_turnAiResults'),
    'successful fresh cycle unlocks the session and clears source data');
  ok(terminalJob.run === null, 'only the eventual successful cycle drops the runner');

  resetWorld();
  ctx._enqueuePostTurnJob('sc25c', async function() { return { tactical: true, strategic: true }; });
  await ctx._awaitPostTurnJobs();
  ok(ctx.GM._postTurnJobs === null && !Object.prototype.hasOwnProperty.call(ctx.GM, '_turnAiResults'), 'successful critical jobs clear queue and source data');

  resetWorld();
  const pipelineSource = fs.readFileSync(path.resolve(__dirname, '..', 'tm-endturn-pipeline-steps.js'), 'utf8');
  vm.runInContext(functionSource(pipelineSource, '_scheduleNpcBehaviorPostRender'), ctx);
  ctx.P.ai = { key: 'fixture' };
  let npcRuns = 0, childRuns = 0;
  const marks = [], owner = { meta: { transaction: { captureSession: { rollbackCapture: { marker: 'actual-owner-snapshot' } } } } };
  ctx.TM.Endturn = { Timing: { mark(actualOwner, kind, data) { marks.push({ actualOwner, kind, data }); } } };
  ctx.executeNpcBehaviors = async function() { npcRuns++; return { local: true }; };
  // Use the actual production runner that closes over this turn's ctx. The
  // deterministic ownership-edge assertion avoids a flaky GC/WeakRef test.
  ctx._scheduleNpcBehaviorPostRender(owner);
  const npcJob = ctx.GM._postTurnJobs.pending.find(job => job.id === 'npc_behavior');
  ok(npcJob && typeof npcJob.run === 'function', 'the production NPC runner is genuinely retained while pending');
  const npcPromise = npcJob.promise, npcLease = npcJob.lease;
  const childValue = { dependency: 'npc_behavior', resultId: 'followup-result' };
  ctx._enqueuePostTurnJob('dependency-probe', async function() { childRuns++; return childValue; }, { dependsOn: ['npc_behavior'] });
  const dependent = ctx.GM._postTurnJobs.pending.find(job => job.id === 'dependency-probe');
  const npcReceipt = await npcPromise, childReceipt = await dependent.promise;
  ok(npcReceipt.ok && npcRuns === 1 && marks.length === 2 && marks.every(mark => mark.actualOwner === owner),
    'the real runner reads the original owner context and finishes exactly once');
  ok(npcJob.run === null && dependent.run === null && npcJob.lease === npcLease,
    'successful jobs sever the runner-to-ctx edge without weakening world lease evidence');
  ok(childRuns === 1 && childReceipt.value === childValue, 'a dependent job consumes the fulfilled prerequisite normally');
  ok(ctx._runPostTurnJobAttempt(npcJob) === npcPromise && (await ctx._postTurnJobPromiseForWait(npcJob)) === npcReceipt,
    'done job scheduling and repeated waits return the original Promise and receipt');
  await ctx._awaitPostTurnJobs();
  ok(ctx.GM._postTurnJobs === null && ctx.GM._postTurnDetachedJobs.includes(npcJob) && ctx.GM._postTurnDetachedJobs.includes(dependent),
    'the existing detached-history path retains successful receipts');
  await ctx._awaitPostTurnJobsForSave(['npc_behavior', 'dependency-probe']);
  ok(npcRuns === 1 && childRuns === 1 && npcJob.run === null && dependent.run === null,
    'saving detached successes neither restores their closures nor executes them again');
  ok(owner.meta.transaction.captureSession.rollbackCapture.marker === 'actual-owner-snapshot',
    'the queue release never deletes or mutates someone else\'s transaction snapshot');

  resetWorld();
  let staleRan = false;
  ctx._enqueuePostTurnJob('old-world-probe', async function() { staleRan = true; return { changed: true }; });
  const staleJob = ctx.GM._postTurnJobs.pending[0];
  ctx.GM = { turn: 6, sid: 'another', _campaignId: 'another-campaign' };
  ctx._tmLoadGen++;
  const staleReceipt = await staleJob.promise;
  ok(staleReceipt.ok && staleReceipt.value.stale === true && !staleRan && staleJob.run === null,
    'a settled stale-world skip releases the unused callable and still cannot run on the new world');
  ok((await ctx._postTurnJobPromiseForWait(staleJob)) === staleReceipt && !staleRan,
    'the settled stale-world receipt remains stable on repeated waits');

  console.log('[smoke-postturn-critical-failures] PASS assertions=' + assertions);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
