import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-agent-intent-plan.js', (s, r) => {
  s = r(s, '  async function proposeSpecialist(tool, input, ctx, handler) {', `  function captureProposalBasis(gm) {
    var basis = { hashes: Object.create(null), report: clone(gm._turnReport), reasks: gm._agentJsonReasks };
    Object.keys(gm).forEach(function(k) { basis.hashes[k] = hash(gm[k]); });
    return basis;
  }
  function proposalPatches(basis, after) {
    var keys = new Set(Object.keys(basis.hashes).concat(Object.keys(after))), out = [];
    keys.forEach(function(k) {
      if (UNSAFE[k]) return;
      var exists = Object.prototype.hasOwnProperty.call(after, k), afterHash = exists ? hash(after[k]) : null;
      var beforeHash = Object.prototype.hasOwnProperty.call(basis.hashes, k) ? basis.hashes[k] : hash(undefined);
      if (exists && afterHash === beforeHash) return;
      var patch = { op: exists ? 'set' : 'remove', path: k, beforeHash: beforeHash, afterHash: afterHash };
      if (exists) patch.value = clone(after[k]);
      if (k === '_turnReport') patch.beforeValue = basis.report;
      if (k === '_agentJsonReasks') patch.beforeValue = basis.reasks;
      out.push(patch);
    });
    return out;
  }
  async function proposeSpecialist(tool, input, ctx, handler) {`);
  s = r(s, '    var sandboxCtx = Object.assign({}, ctx || {}, { GM: sandboxGM });', '    var basis = captureProposalBasis(sandboxGM), generation = root._tmLoadGen, turn = gm.turn, player = root.P;\n    var sandboxCtx = Object.assign({}, ctx || {}, { GM: sandboxGM });');
  s = r(s, '      if (bindRoot) {\n        if (hadRootGM)', '      if (bindRoot && root.GM === sandboxGM) {\n        if (hadRootGM)');
  s = r(s, '    var patches = topPatches(gm, sandboxGM);', '    var signal = ctx && ctx.meta && ctx.meta.agentRuntime && ctx.meta.agentRuntime.signal;\n    if (root.P !== player || root._tmLoadGen !== generation || gm.turn !== turn || (hadRootGM && root.GM !== oldRootGM) || (signal && signal.aborted)) return { ok: false, changed: false, verified: false, proposalDiscarded: true, reason: "stale-or-cancelled-specialist" };\n    var patches = proposalPatches(basis, sandboxGM);');
  return s;
});
