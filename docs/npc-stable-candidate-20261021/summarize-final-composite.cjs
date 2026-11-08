'use strict';
// Read saved evidence only, after the Electron process has written report.json.
// node docs/npc-stable-candidate-20261021/summarize-final-composite.cjs --run-dir web/dev-tools/electron-bridge/<run-id> --expected-head <full SHA>
// No running-world access, tests, model requests or input-file mutations.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? '' : process.argv[i + 1]; };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const countBy = (rows, key) => rows.reduce((out, row) => { const k = String(key(row)); out[k] = (out[k] || 0) + 1; return out; }, {});
const unique = values => [...new Set(values.filter(value => value !== undefined && value !== null && value !== ''))].sort();
function main() {
  const requested = option('--run-dir'), expectedHead = option('--expected-head');
  assert(requested && !requested.startsWith('--'), '--run-dir is required');
  assert.match(expectedHead || '', /^[0-9a-f]{40}$/, '--expected-head must be the exact tested checkout SHA');
  const dir = fs.realpathSync(path.resolve(root, requested));
  assert(dir.startsWith(fs.realpathSync(root) + path.sep), 'evidence directory must be inside this checkout');
  const reportFile = path.join(dir, 'report.json'), timelineFile = path.join(dir, 'composite-timeline.json');
  assert(fs.existsSync(reportFile), 'no final report exists; leave the running gate pending');
  const reportBytes = fs.readFileSync(reportFile), report = JSON.parse(reportBytes);
  assert.equal(report.complete, true, 'report is incomplete; do not create a final summary');
  assert.equal(report.head, expectedHead, 'report checkout differs from expected SHA');
  const run = (report.results || []).find(row => row.mode === 'npc-composite');
  assert(run && run.detail && run.detail.complete === true, 'composite result is not terminal');
  const timelineBytes = fs.readFileSync(timelineFile), data = JSON.parse(timelineBytes);
  assert.equal(data.identity && data.identity.head, expectedHead, 'timeline and final report have different identities');
  const timeline = data.timeline || [], states = timeline.filter(row => finite(row.day) && Array.isArray(row.plans));
  assert(states.length, 'timeline contains no recorded game state');
  const first = states[0], last = states[states.length - 1], calls = data.calls || {};
  const reloads = timeline.filter(row => row.stage === 'real-slot-reload').map(row => ({
    slot: row.slot, name: row.name, expected: row.expected,
    beforeGeneration: row.before && row.before.load, afterGeneration: row.after && row.after.load,
    beforeDay: row.before && row.before.day, afterDay: row.after && row.after.day,
    beforePlayer: row.before && row.before.player, afterPlayer: row.after && row.after.player,
    beforeLocations: (row.before && row.before.locations || []).map(({ id, region, travel, controlled }) => ({ id, region, travel, controlled })),
    afterLocations: (row.after && row.after.locations || []).map(({ id, region, travel, controlled }) => ({ id, region, travel, controlled })),
    recordedActivityCharacters: row.before && row.before.activityBytes,
    sizeMeaning: 'Producer field activityBytes is JSON.stringify(...).length (UTF-16 code units), not save-file bytes.',
    generationAdvanced: !!(row.before && row.after && finite(row.before.load) && finite(row.after.load) && row.after.load > row.before.load)
  }));
  const plans = new Map(), messages = new Map(), requests = new Map(), directions = new Map();
  for (const state of states) {
    for (const plan of state.plans) {
      plans.set(plan.id, plan);
      for (const message of plan.messages || []) if (message.id) messages.set(message.id, { ...message, observedInPlanId: plan.id });
    }
    for (const q of state.planning && state.planning.requests || []) {
      if (!q.id) continue;
      const earlier = requests.get(q.id), age = finite(q.createdDay) ? state.day - q.createdDay : null;
      const pendingAge = q.status === 'pending' && finite(age) ? age : null;
      requests.set(q.id, { id: q.id, actorId: q.actorId, kind: q.kind, sourceKey: q.sourceKey,
        planId: q.planId, messageId: q.messageId, revision: q.revision, termsVersion: q.termsVersion,
        sourceVersion: q.sourceVersion, status: q.status, attempts: q.attempts, directionId: q.directionId,
        createdDay: q.createdDay, knownDay: q.knownDay, expiresDay: q.expiresDay,
        firstObservedDay: earlier ? earlier.firstObservedDay : state.day, lastObservedDay: state.day,
        statusesObserved: unique([...(earlier ? earlier.statusesObserved : []), q.status]),
        maxObservedPendingAgeDays: pendingAge === null ? (earlier ? earlier.maxObservedPendingAgeDays : null)
          : Math.max(pendingAge, earlier && finite(earlier.maxObservedPendingAgeDays) ? earlier.maxObservedPendingAgeDays : pendingAge) });
    }
    for (const d of state.planning && state.planning.directions || []) if (d.id) directions.set(d.id, d);
  }
  const finalRequests = last.planning && last.planning.requests || [];
  const finalPending = finalRequests.filter(q => q.status === 'pending').map(q => ({ id: q.id, actorId: q.actorId,
    kind: q.kind, sourceKey: q.sourceKey, createdDay: q.createdDay, knownDay: q.knownDay, attempts: q.attempts,
    ageSinceCreatedDays: finite(q.createdDay) ? last.day - q.createdDay : null,
    ageSinceKnownDays: finite(q.knownDay) ? last.day - q.knownDay : null }));
  const physicalReturns = timeline.filter(row => row.stage === 'physical-return');
  const formalPlanIds = unique(physicalReturns.map(row => row.planId));
  const activities = [...plans.values()].map(p => ({ id: p.id, kind: p.kind, status: p.status, nextActorId: p.next,
    messageIds: unique((p.messages || []).map(m => m.id)),
    steps: (p.steps || []).map(s => ({ id: s.id || null, phase: s.phase, actorId: s.actorId,
      day: s.day, actionId: s.actionId, status: s.status, outcome: s.outcome })),
    meeting: p.meeting || null }));
  const transport = calls.transport || [];
  function classify(row) {
    if (String(row.label || '').includes('依据收到的信息选择行动，允许无事、等待、拒绝和改条件。')) return 'npc-direction';
    if (String(row.label || '').includes('天命每回合固定执行的复核与补全 Agent')) return 'routine-review';
    if (row.kind) return 'tagged-world-subcall';
    return 'other-direct-producer';
  }
  const modelGroups = new Map();
  transport.forEach((row, index) => {
    const category = classify(row), key = JSON.stringify([category, row.kind || '', row.label || '', row.responseKeys || []]);
    const group = modelGroups.get(key) || { category, kind: row.kind || '', responseKind: row.responseKind || null,
      promptPrefix: row.label || '', responseKeys: row.responseKeys || [], attemptIndices: [], days: [] };
    group.attemptIndices.push(index); group.days.push(row.day); modelGroups.set(key, group);
  });
  const economy = calls.provinceEconomy || [], systems = calls.systems || [];
  const completedEvidence = timeline.some(row => row.stage === 'completed-evidence');
  const finalBackground = timeline.find(row => row.stage === 'final-review-and-save-settled');
  const visibleResult = timeline.find(row => row.stage === 'visible-formal-result');
  const modelBoundary = (run.detail.results || []).find(row => row.name === 'official-composite-model-boundary');
  const economyReconciliation = modelBoundary && modelBoundary.value && modelBoundary.value.economyReconciliation;
  const profilingDetected = !!(data.identity && data.identity.diagnostics && data.identity.diagnostics.heapSampling) || fs.readdirSync(dir).some(name => /^allocation-profile-/.test(name));
  const failureReasons = [];
  if (profilingDetected) failureReasons.push('GC-assisted sampling was enabled; diagnostic result is not ordinary acceptance');
  if (report.ok !== true || run.ok !== true || run.exitCode !== 0 || run.detail.ok !== true) failureReasons.push('final report did not pass');
  if ((run.detail.failures || []).length) failureReasons.push('final report contains failures');
  if (!completedEvidence) failureReasons.push('completed-evidence stage is absent');
  if (!visibleResult || visibleResult.hit !== true || !visibleResult.text) failureReasons.push('actual visible result evidence is absent');
  if (!finalBackground || finalBackground.status !== 'settled') failureReasons.push('final review and save settlement evidence is absent');
  if (!economyReconciliation || economyReconciliation.turns !== systems.length) failureReasons.push('settlements are not reconciled with genuine committed turns');
  if (![1, 2].every(slot => reloads.some(row => row.slot === slot && row.generationAdvanced))) failureReasons.push('two actual advancing load generations are absent');
  if (!physicalReturns.length) failureReasons.push('actual physical-return evidence is absent');
  if (!economy.length || economy.length !== systems.length) failureReasons.push('economic settlement/system interval counts differ or are absent');
  if (unique(economy.map(row => row.turn)).length !== economy.length) failureReasons.push('economic settlement repeats a recorded turn');
  if ((calls.fixtureErrors || []).length) failureReasons.push('external response fixture recorded errors');
  const summary = {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    scope: 'One completed formal Electron run. Separate local targeted and remote CI results must retain their own identities.',
    runId: report.runId, testedCheckout: expectedHead, identity: data.identity,
    status: profilingDetected && failureReasons.length === 1 ? 'diagnostic_pass' : failureReasons.length ? 'failed' : 'passed', profilingDetected, formalAcceptancePassed: failureReasons.length === 0,
    sources: [{ file: relative(reportFile), sha256: sha(reportBytes) }, { file: relative(timelineFile), sha256: sha(timelineBytes) }],
    terminalReport: { complete: report.complete, ok: report.ok, exit: run.exitCode, signal: run.signal,
      elapsedMs: run.elapsedMs, timing: run.detail.timing, failures: run.detail.failures || [] },
    summaryChecks: { completedEvidence, failureReasons },
    populationAndTime: { first: { day: first.day, turn: first.turn, people: first.people },
      last: { day: last.day, turn: last.turn, people: last.people },
      samples: states.map(({ stage, day, turn, people, load, money }) => ({ stage, day, turn, people, loadGeneration: load, treasuryMoney: money })) },
    reloads, physicalReturns, formalPlanIds, activities, finalBackground: finalBackground || null, visibleResult: visibleResult || null,
    economyReconciliation: economyReconciliation || null,
    messages: { observedUniqueCount: messages.size, rows: [...messages.values()] },
    personalResults: timeline.filter(row => row.stage === 'personal-result'),
    models: { transportAttempts: transport.length, categoryCounts: countBy(transport, classify),
      groupingMeaning: 'Actual transport attempts grouped by emitted kind and recorded prompt prefix. Unknown direct producers stay separate; no guessed category.',
      groups: [...modelGroups.values()], canonicalPlanningCounters: calls.planningStats || null,
      canonicalCounterBoundary: 'logicalRequests is a dispatch counter, not unique queued requests or unique source IDs. Compatibility counters are not assumed to equal network attempts.',
      fixtureErrors: calls.fixtureErrors || [], blockedNetworkRequests: data.traffic || [] },
    economy: { settlements: economy.length, systemIntervals: systems.length, settlementTurns: economy.map(row => row.turn),
      samples: economy, systems },
    planning: { boundary: 'Counts cover requests and directions visible in recorded snapshots; transient entries between snapshots may be unobserved.',
      observedUniqueRequestIds: requests.size,
      observedUniqueRawSourceCount: unique([...requests.values()].map(q => q.sourceKey)).length,
      observedUniqueRawSourceKeys: unique([...requests.values()].map(q => q.sourceKey)),
      observedUniqueActorSourceCount: unique([...requests.values()].filter(q => q.sourceKey).map(q => JSON.stringify([q.actorId, q.sourceKey]))).length,
      requests: [...requests.values()], finalStatusCounts: countBy(finalRequests, q => q.status || 'unknown'),
      finalPending, finalPendingMaxAgeDays: finalPending.some(q => finite(q.ageSinceCreatedDays))
        ? Math.max(...finalPending.filter(q => finite(q.ageSinceCreatedDays)).map(q => q.ageSinceCreatedDays)) : null,
      directions: [...directions.values()], observedUniqueDirectionSources: unique([...directions.values()].map(d => d.sourceKey)) },
    limitations: ['No actual save-file byte size is inferred from activity JSON character length.',
      'No unique queue or source count is inferred from logicalRequests.', 'No acceptance is inferred from partial pass fragments.']
  };
  assert.equal(sha(fs.readFileSync(reportFile)), sha(reportBytes), 'final report changed during extraction');
  assert.equal(sha(fs.readFileSync(timelineFile)), sha(timelineBytes), 'timeline changed during extraction');
  const output = path.resolve(__dirname, option('--output') || 'final-composite-' + report.runId + '.json');
  assert(output.startsWith(__dirname + path.sep), 'summary output must stay in this documentation directory');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: summary.status, report: relative(output), testedCheckout: expectedHead,
    formalAcceptancePassed: summary.formalAcceptancePassed, failureReasons }));
  process.exitCode = summary.formalAcceptancePassed ? 0 : 1;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; } }
