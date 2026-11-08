'use strict';
// Diagnostic-only: reading a CDP sample forces GC in this V8; disable it for acceptance.
// No heap snapshot, world write, model call or altered V8 limit; stacks contain code only.
const fs = require('node:fs'), path = require('node:path');

function compactAllocationProfile(profile) {
  if (!profile || !profile.head) throw Error('allocation profile head missing');
  const nodes = [], stack = [{ node: profile.head, parentId: null }];
  while (stack.length) {
    const { node, parentId } = stack.pop(), frame = node.callFrame || {};
    if (!Number.isFinite(node.id) || !Number.isFinite(node.selfSize) || !Array.isArray(node.children)) throw Error('allocation profile node invalid');
    nodes.push({ id: node.id, parentId, selfSize: node.selfSize, functionName: String(frame.functionName || ''),
      url: String(frame.url || ''), lineNumber: Number(frame.lineNumber), columnNumber: Number(frame.columnNumber) });
    for (let i = node.children.length - 1; i >= 0; i--) stack.push({ node: node.children[i], parentId: node.id });
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  const topStacks = nodes.filter(node => node.selfSize > 0).sort((a, b) => b.selfSize - a.selfSize).slice(0, 25).map(node => {
    const frames = []; let current = node;
    while (current) { frames.push({ functionName: current.functionName, url: current.url, lineNumber: current.lineNumber, columnNumber: current.columnNumber }); current = byId.get(current.parentId); }
    return { selfSize: node.selfSize, frames: frames.reverse() };
  });
  return { nodes, topStacks, sampledLiveBytes: nodes.reduce((total, node) => total + node.selfSize, 0),
    scope: 'statistical live allocation stacks; not a heap snapshot or retained-size measurement' };
}

async function startCompositeAllocationSampling(options) {
  const { debugger: dbg, directory, onFailure } = options;
  const clock = options.clock || { now: () => Date.now(), setInterval, clearInterval };
  const write = options.write || ((name, data) => fs.writeFileSync(path.join(directory, name), data, { flag: 'wx' }));
  let disposed = false, timer = null, pending = null, sequence = 0, ownedAttachment = false;
  function event(name, detail) { write('allocation-event-' + (++sequence) + '.json', JSON.stringify({ at: clock.now(), event: name, ...detail }) + '\n'); }
  function fail(error) {
    if (disposed) return;
    try { event('error', { message: String(error && error.message || error) }); } finally {
      dispose(); if (onFailure) onFailure(error);
    }
  }
  function detached(_event, reason) { fail(Error('allocation debugger detached: ' + reason)); }
  function dispose() {
    if (disposed) return; disposed = true;
    if (timer !== null) clock.clearInterval(timer); timer = null;
    if (dbg.removeListener) dbg.removeListener('detach', detached);
    if (ownedAttachment && dbg.isAttached()) dbg.detach();
  }
  async function sample(reason) {
    if (disposed) return null;
    if (pending) return pending;
    const startedAt = clock.now(), sampleId = ++sequence;
    const request = Promise.resolve().then(() => dbg.sendCommand('HeapProfiler.getSamplingProfile')).then(result => {
      if (disposed) return null;
      const data = { sampleId, reason, startedAt, finishedAt: clock.now(), samplingInterval: 1048576,
        includeCollectedObjects: false, protocolForcesGC: true, ...compactAllocationProfile(result.profile) };
      write('allocation-profile-' + String(sampleId).padStart(4, '0') + '.json', JSON.stringify(data) + '\n');
      return { sampleId, startedAt, finishedAt: data.finishedAt, sampledLiveBytes: data.sampledLiveBytes, nodeCount: data.nodes.length };
    });
    pending = request;
    try { return await request; } catch (error) { fail(error); throw error; }
    finally { if (pending === request) pending = null; }
  }
  try {
    if (dbg.isAttached()) throw Error('allocation sampling requires its own debugger attachment; disable CPU profiling');
    dbg.attach('1.3'); ownedAttachment = true;
    if (dbg.on) dbg.on('detach', detached);
    // Default collection policy records currently live sampled objects only.
    // Do not enable includeObjectsCollectedByMajorGC/MinorGC history.
    await dbg.sendCommand('HeapProfiler.startSampling', { samplingInterval: 1048576 });
    event('started', { samplingInterval: 1048576, pollMs: 10000, includeCollectedObjects: false, protocolForcesGC: true });
    await sample('initial');
    timer = clock.setInterval(() => { sample('interval').catch(() => {}); }, 10000);
    if (timer && timer.unref) timer.unref();
    return { sample, dispose };
  } catch (error) { dispose(); throw error; }
}

// The existing renderer stage observer may use this compact, read-only record.
// Capture no arguments, Promise values, world objects or serialized state.
function installCompositeAllocationStages(root) {
  let sequence = 0;
  function record(label, event, operation, startedAt) {
    const g = root.GM || {}, memory = root.performance && root.performance.memory;
    root.console.info('COMPOSITE_ALLOCATION_STAGE ' + JSON.stringify({ label, event, operation, startedAt,
      at: Date.now(), turn: Number(g.turn), day: root.TM.SimTime.now(g), load: Number(root._tmLoadGen || 0),
      heap: memory ? { limit: memory.jsHeapSizeLimit, used: memory.usedJSHeapSize, total: memory.totalJSHeapSize } : null,
      canonicalRevision: Number(root._autoSaveCommittedRevision), desktopInFlight: !!root._autoSaveInFlight,
      backgroundInFlight: !!root._backgroundSaveInFlight, reviewCount: root.TM.RecoveryReview.status().length }));
  }
  function observe(owner, key, label) {
    const real = owner && owner[key]; if (typeof real !== 'function') throw Error('allocation boundary missing: ' + label);
    owner[key] = function() {
      const operation = ++sequence, startedAt = Date.now(); record(label, 'start', operation, startedAt);
      let result;
      try { result = real.apply(this, arguments); } catch (error) { record(label, 'throw', operation, startedAt); throw error; }
      if (result && typeof result.then === 'function') result.then(() => record(label, 'end', operation, startedAt), () => record(label, 'reject', operation, startedAt));
      else record(label, 'end', operation, startedAt);
      return result;
    };
  }
  observe(root, '_tmCommitBackgroundWorld', 'background-canonical');
  observe(root, '_buildSaveState', 'detached-save-build');
  observe(root.TM_SaveDB, 'createCanonicalPayload', 'canonical-payload');
  observe(root, '_tmRunDesktopAutoSaveTick', 'desktop-autosave');
  return true;
}

module.exports = { compactAllocationProfile, startCompositeAllocationSampling, installCompositeAllocationStages };
