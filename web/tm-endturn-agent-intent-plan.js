// @ts-check
// ============================================================
// tm-endturn-agent-intent-plan.js — 正式 Agent 的意图账与唯一提交器
//
// 主 Agent 的每次 runtime-write 先记 intent，再由 AgentMode._dispatch 唯一提交；
// 深化专家则只在 GM 克隆上工作，产出顶层 patch proposal，最后由本模块一次提交。
// ============================================================
(function(root) {
  'use strict';
  var TM = root.TM || (root.TM = {});
  TM.Endturn = TM.Endturn || {};
  var UNSAFE = { '__proto__': 1, prototype: 1, constructor: 1 };
  var PROTECTED = { turn: 1, running: 1, id: 1 };

  function clone(v) { try { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } catch (_) { return v; } }
  function strictClone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function same(a, b) { if (a === b) return true; try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; } }
  function hash(v) {
    var s = ''; try { var encoded = JSON.stringify(v); s = encoded === undefined ? String(v) : encoded; } catch (_) { s = String(v); }
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function create(meta) { return { version: 1, createdAt: Date.now(), meta: clone(meta || {}), intents: [], status: 'open' }; }
  function add(plan, tool, input, meta) {
    if (!plan || plan.status !== 'open') return null;
    var it = { id: 'intent_' + (plan.intents.length + 1), tool: String(tool || ''), input: clone(input || {}), evidence: clone((meta && meta.evidence) || []), uncertainty: String((meta && meta.uncertainty) || ''), status: 'pending', receipt: null };
    plan.intents.push(it); return it;
  }
  function settle(intent, receipt) { if (!intent) return; intent.receipt = clone(receipt || {}); intent.status = receipt && receipt.ok ? (receipt.changed ? 'committed' : 'noop') : 'failed'; }
  function summarize(plan) {
    var counts = { pending: 0, committed: 0, noop: 0, failed: 0 };
    ((plan && plan.intents) || []).forEach(function(i) { counts[i.status] = (counts[i.status] || 0) + 1; });
    return { version: 1, status: plan && plan.status, counts: counts, intents: ((plan && plan.intents) || []).slice(-80).map(function(i) { return { id: i.id, tool: i.tool, status: i.status, receipt: i.receipt }; }) };
  }

  function topPatches(before, after) {
    var keys = {}, out = [];
    Object.keys(before || {}).forEach(function(k) { keys[k] = 1; });
    Object.keys(after || {}).forEach(function(k) { keys[k] = 1; });
    Object.keys(keys).sort().forEach(function(k) {
      if (UNSAFE[k] || same(before && before[k], after && after[k])) return;
      if (!Object.prototype.hasOwnProperty.call(after || {}, k)) out.push({ op: 'remove', path: k, beforeValue: clone(before[k]), beforeHash: hash(before[k]), afterHash: null });
      else out.push({ op: 'set', path: k, value: clone(after[k]), beforeValue: clone(before && before[k]), beforeHash: hash(before && before[k]), afterHash: hash(after[k]) });
    });
    return out;
  }

  var ALLOWED = {
    recall_consolidate: ['_aiMemory', '_consolidatedMemory', '_sagaMemory', '_stateBoard', '_plotThreads', '_foreshadows', '_causalGraph', '_turnReport', '_agentJsonReasks'],
    deepen_factions: ['facs', '_factionUndercurrents', '_factionUndercurrentsHistory', 'activeSchemes', '_turnReport'],
    deepen_economy: ['_economyDeepening', '_turnReport'],
    deepen_military: ['_militaryDeepening', '_turnReport'],
    deepen_npcs: ['chars', '_memoryArchiveFull', '_charInteractionCount', '_charInteractionCountTurn', '_turnReport'],
    deepen_cognition: ['_npcCognition', '_turnReport'],
    deepen_relations: ['chars', '_turnReport'],
    deepen_letters: ['letters', '_turnReport'],
    deepen_court: ['currentIssues', '_pendingAudiences', 'evtLog', '_turnReport'],
    deepen_world: ['_aiMemory', '_foreshadows', '_lastSc28Snapshot', '_turnReport'],
    deepen_narrative: ['_agentChronicle', '_narrativePolished', 'shijiHistory', '_turnReport', '_agentJsonReasks']
  };
  // JSON 自纠计数是所有深化工具共享的诊断字段；关系领域的 canonical
  // applyNpcInteraction/NpcMemorySystem 还会同步事件证据与双向记忆账，必须随 chars 一起原子提交。
  Object.keys(ALLOWED).forEach(function(k) { if (ALLOWED[k].indexOf('_agentJsonReasks') < 0) ALLOWED[k].push('_agentJsonReasks'); });
  ['_npcRelationEvents', '_memoryArchiveFull', '_charInteractionCount', '_charInteractionCountTurn'].forEach(function(k) {
    if (ALLOWED.deepen_relations.indexOf(k) < 0) ALLOWED.deepen_relations.push(k);
  });
  ['_memoryWriteQueue', '_memoryDraftInbox', '_memoryQuarantine', '_memoryAccepted', '_memoryAuditEvents', '_memoryLongTerm', '_memoryRevision'].forEach(function(k) { ALLOWED.recall_consolidate.push(k); });
  function validatePatches(tool, patches) {
    var allow = ALLOWED[tool] || [];
    var problems = [];
    (patches || []).forEach(function(p) {
      var top = String(p.path || '').split('.')[0];
      if (!top || UNSAFE[top] || PROTECTED[top]) problems.push('protected:' + top);
      else if (allow.indexOf(top) < 0) problems.push('unexpected:' + top);
    });
    return { ok: problems.length === 0, problems: problems };
  }
  function commitPatches(gm, tool, patches) {
    var valid = validatePatches(tool, patches);
    if (!valid.ok) return { ok: false, changed: false, verified: false, reason: valid.problems.join(','), patches: [] };
    patches = (patches || []).map(function(p) { return Object.assign({}, p, { value: clone(p.value), beforeValue: clone(p.beforeValue) }); });
    var backup = {}, existed = {};
    try {
      // proposal 生成后若真实存档已被别的提交改动，拒绝用旧快照覆盖新值。
      var stale = [];
      patches.forEach(function(p) {
        if (hash(gm[p.path]) === p.beforeHash) return;
        // 并行专家都只向回合报告追加时，可在确定性提交阶段安全 rebase 到当前尾部。
        if (p.path === '_turnReport' && p.op === 'set' && Array.isArray(p.value)) {
          var base = Array.isArray(p.beforeValue) ? p.beforeValue : [];
          var prefixOk = p.value.length >= base.length && base.every(function(v, i) { return same(v, p.value[i]); });
          if (prefixOk && Array.isArray(gm[p.path])) {
            p.value = clone(gm[p.path]).concat(clone(p.value.slice(base.length)));
            p.beforeHash = hash(gm[p.path]); p.afterHash = hash(p.value); return;
          }
        }
        // JSON 重问是诊断计数器；多个专家各自的增量可相加，不覆盖彼此。
        if (p.path === '_agentJsonReasks' && p.op === 'set') {
          var delta = (Number(p.value) || 0) - (Number(p.beforeValue) || 0);
          p.value = (Number(gm[p.path]) || 0) + delta;
          p.beforeHash = hash(gm[p.path]); p.afterHash = hash(p.value); return;
        }
        stale.push(p.path);
      });
      if (stale.length) return { ok: false, changed: false, verified: false, reason: 'stale-proposal:' + stale.join(','), patches: [] };
      patches.forEach(function(p) { existed[p.path] = Object.prototype.hasOwnProperty.call(gm, p.path); backup[p.path] = clone(gm[p.path]); });
      patches.forEach(function(p) { if (p.op === 'remove') delete gm[p.path]; else gm[p.path] = clone(p.value); });
      var verified = patches.every(function(p) { return p.op === 'remove' ? !Object.prototype.hasOwnProperty.call(gm, p.path) : hash(gm[p.path]) === p.afterHash; });
      if (!verified) throw new Error('postcondition');
      return { ok: true, changed: patches.length > 0, verified: true, patches: patches.map(function(p) { return { op: p.op, path: p.path, beforeHash: p.beforeHash, afterHash: p.afterHash }; }) };
    } catch (e) {
      Object.keys(backup).forEach(function(k) { if (existed[k]) gm[k] = backup[k]; else delete gm[k]; });
      return { ok: false, changed: false, verified: false, reason: 'commit-failed:' + ((e && e.message) || e), patches: [] };
    }
  }

  // 仍依赖全局 GM 的 canonical 子系统必须独占 root.GM 沙箱，不能与普通
  // 专家并行：关系走 applyNpcInteraction，NPC 心绪走 NpcMemorySystem.remember。
  var ROOT_BOUND = { deepen_npcs: 1, deepen_relations: 1 };
  function isRootBound(tool) { return !!ROOT_BOUND[tool]; }
  function captureProposalBasis(gm) {
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
  async function proposeSpecialist(tool, input, ctx, handler) {
    var gm = (ctx && ctx.GM) || root.GM;
    if (!gm || typeof handler !== 'function') return { ok: false, changed: false, verified: false, text: '(specialist sandbox unavailable)' };
    var sandboxGM;
    try { sandboxGM = strictClone(gm); }
    catch (e) { return { ok: false, changed: false, verified: false, text: '(specialist sandbox clone failed:' + ((e && e.message) || e) + ')' }; }
    if (!sandboxGM || sandboxGM === gm) return { ok: false, changed: false, verified: false, text: '(specialist sandbox isolation failed)' };
    var basis = captureProposalBasis(sandboxGM), generation = root._tmLoadGen, turn = gm.turn, player = root.P;
    var sandboxCtx = Object.assign({}, ctx || {}, { GM: sandboxGM });
    sandboxCtx.meta = Object.assign({}, (ctx && ctx.meta) || {}, { specialistProposalOnly: true, specialist: tool });
    var bindRoot = isRootBound(tool);
    var hadRootGM = Object.prototype.hasOwnProperty.call(root, 'GM'), oldRootGM = root.GM;
    var raw;
    try {
      if (bindRoot) root.GM = sandboxGM;
      raw = await handler(tool, input || {}, sandboxCtx);
    } catch (e) {
      raw = { ok: false, text: '(specialist failed:' + ((e && e.message) || e) + ')' };
    } finally {
      if (bindRoot && root.GM === sandboxGM) {
        if (hadRootGM) root.GM = oldRootGM; else { try { delete root.GM; } catch (_) { root.GM = oldRootGM; } }
      }
    }
    if (!raw || raw.ok === false) return Object.assign({}, raw || {}, { changed: false, verified: false, proposalDiscarded: true });
    var signal = ctx && ctx.meta && ctx.meta.agentRuntime && ctx.meta.agentRuntime.signal;
    if (root.P !== player || root._tmLoadGen !== generation || gm.turn !== turn || (hadRootGM && root.GM !== oldRootGM) || (signal && signal.aborted)) return { ok: false, changed: false, verified: false, proposalDiscarded: true, reason: "stale-or-cancelled-specialist" };
    var patches = proposalPatches(basis, sandboxGM);
    var valid = validatePatches(tool, patches);
    if (!valid.ok) return Object.assign({}, raw, { ok: false, changed: false, verified: false, reason: valid.problems.join(','), proposalDiscarded: true });
    return Object.assign({}, raw, { changed: patches.length > 0, verified: true, specialistProposal: true, proposal: { tool: tool, patches: patches } });
  }
  function commitSpecialistProposal(gm, prepared) {
    prepared = prepared || {};
    var clean = Object.assign({}, prepared); delete clean.proposal; delete clean._agentIntent;
    if (!prepared.ok || !prepared.proposal) return Object.assign(clean, { ok: false, changed: false, verified: false, proposalDiscarded: true });
    var committed = commitPatches(gm, prepared.proposal.tool, prepared.proposal.patches);
    return Object.assign(clean, committed, { specialistProposal: true });
  }
  async function runSpecialist(tool, input, ctx, handler) {
    var gm = (ctx && ctx.GM) || root.GM;
    var prepared = await proposeSpecialist(tool, input, ctx, handler);
    return commitSpecialistProposal(gm, prepared);
  }

  TM.Endturn.AgentIntentPlan = {
    create: create, add: add, settle: settle, summarize: summarize,
    topPatches: topPatches, validatePatches: validatePatches, commitPatches: commitPatches,
    proposeSpecialist: proposeSpecialist, commitSpecialistProposal: commitSpecialistProposal,
    isRootBound: isRootBound,
    runSpecialist: runSpecialist, allowedRoots: clone(ALLOWED), hash: hash
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.Endturn.AgentIntentPlan;
})(typeof window !== 'undefined' ? window : globalThis);
