// Bounded ordinary choices. No model, organization binding, world clock or second activity store.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {}, NPC = TM.NPC = TM.NPC || {};
  var config = Object.freeze({ actorsPerBatch: 12, decisionsPerBatch: 12, decisionsPerEvent: 48, initialDecisions: 4, initialNewContacts: 1, maxCandidates: 6, greetingThreshold: 24 });
  var running = false, queued = null;
  function domain() { return NPC.DailyActivities; }
  function ledger() { return NPC.ActionLedger; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function hash(s) { var n = 2166136261; for (var i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619); } return n >>> 0; }
  function player(ch) { return domain().controlled(ch); }
  function actor(key) { return domain().person(key, root.GM); }
  function order(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }
  function personality(ch) {
    var out = { greed: 0, compassion: 0, honor: 0, sociability: 0, caution: 0 };
    var ids = arr(ch.traitIds), defs = arr(root.P && root.P.traitDefinitions);
    defs.filter(function (d) { return ids.indexOf(d.id) >= 0; }).forEach(function (d) {
      Object.keys(out).forEach(function (k) { out[k] += Number(d.dims && d.dims[k] || 0); });
    });
    return out;
  }
  function inclination(ch, other, kind) {
    var virtue = typeof root._npcWuchangProfile === 'function' ? root._npcWuchangProfile(ch) : {}, traits = personality(ch);
    var relation = other ? domain().relation(ch, other) : 0, role = other ? domain().relationKind(ch, other) : '', stress = Math.max(0, Math.min(100, Number(ch.stress || 0)));
    if(role==='teacher'||role==='family')relation+=8;
    return { score: 35 + relation * 0.45 + (Number(virtue.ren || 50) - 50) * 0.12 + (Number(virtue.xin || 50) - 50) * 0.08
      - stress * 0.5 + traits.compassion * 5 - traits.greed * (kind === 'assistance' ? 5 : 1),
      li: Number(virtue.li || 50), xin: Number(virtue.xin || 50), sociability: traits.sociability, stress: stress };
  }
  function dueCandidates(ch, related) {
    var D = domain(), candidates = [];
    related.forEach(function (p) {
      var view = D.view(p, ch); if (!view || !view.nextPhase) return;
      var other = actor(ch.id === p.actorId ? p.targetId : p.actorId), disposition = inclination(ch, other, view.kind);
      if(view.kind==='introduction'&&ch.id===p.targetId){var third=actor(p.localActivity.thirdPartyId);if(third)disposition.score+=D.relation(ch,third)*0.7;}
      var d = { planId: p.id, phase: view.nextPhase, expectedRevision: view.revision, termsVersion: view.termsVersion }, reason = '继续已送达的事项';
      if (d.phase === 'respond') {
        if (disposition.score < 4) { d.response = 'reject'; reason = '本人对这项请求意愿不足'; }
        else if (disposition.stress >= 75 && p.localActivity.deferrals < D.config.maxDeferrals) { d.response = 'defer'; reason = '当前负担较重，明确请求延期'; }
        else if (view.kind === 'greeting') { d.response = disposition.score > 45 && disposition.sociability >= 0 ? 'warm' : 'brief'; reason = '依已有往来选择答复方式'; }
        else if (view.kind === 'assistance' && !arr(p.localActivity.task && p.localActivity.task.materials).length) { d.response = 'conditions'; reason = '已收到的任务缺少材料'; }
        else if (view.kind === 'assistance' && disposition.score < 22 && p.localActivity.task.materials.length > 1) { d.response = 'partial'; reason = '只愿承接较小范围'; }
        else if (view.kind === 'introduction' && ch.id === p.localActivity.thirdPartyId && disposition.li >= 70 && disposition.score < 65) { d.response = 'conditions'; reason = '愿先约明仅通书的边界'; }
        else { d.response = 'accept'; reason = '依本人关系、意愿和当前负担承接'; }
      } else if (d.phase === 'agree') {
        d.response = disposition.score < 0 ? 'reject' : 'accept'; reason = '核对已收到的当前条件';
        if (view.kind === 'assistance' && !arr(p.localActivity.proposedTask && p.localActivity.proposedTask.materials).length) {
          var material = D.materialOptions(ch)[0];
          if (material) d.task = { kind: 'material_summary', title: '整理现有材料清单', materialRefs: [material.ref] };
          else { d.phase = 'cancel'; delete d.response; reason = '本人暂无可提供材料，结束本次请求'; }
        }
      } else if (d.phase === 'feedback') { d.response = disposition.score >= 20 ? 'satisfied' : 'ack'; reason = '对实际收到的文书作反馈'; }
      else if (d.phase === 'cancel') reason = '本地递送未能安排，结束此项请求';
      candidates.push({ priority: 1000 + Math.max(0, D.day() - p.localActivity.createdDay), source: p.id + ':' + view.revision + ':' + d.phase,
        action: d, reason: reason, planId: p.id });
    });
    return candidates;
  }
  function candidates(ch, related, options) {
    var D = domain(), out = dueCandidates(ch, related), b = D.budget(ch);
    if (b.steps >= D.config.dailySteps) return [];
    if (out.length || b.starts >= D.config.dailyStarts) return out.slice(0, config.maxCandidates);
    arr(ch.localGoals).forEach(function (goal) {
      if (!goal || !goal.id || goal.status === 'cancelled' || !/^(greeting|introduction|assistance)$/.test(goal.kind)) return;
      var source = String(goal.id) + ':' + Number(goal.version || 1);
      if (related.some(function (p) { return p.actorId === ch.id && p.localActivity.sourceGoalId === source; })) return;
      var target = actor(goal.targetId), third = goal.kind === 'introduction' && actor(goal.thirdPartyId);
      if (!target || target === ch || !D.knows(ch, target) || goal.kind === 'introduction' && (!third || !D.knows(ch, third))) return;
      var willingness = inclination(ch, target, goal.kind);
      if (willingness.stress > 90 || willingness.score < 0) return;
      out.push({ priority: 50 + willingness.score, source: 'goal:' + source, reason: '推进本人明确的普通交往目标',
        action: { activityKind: goal.kind, targetId: target.id, thirdPartyId: third && third.id || '', sourceGoalId: source, task: goal.task } });
    });
    if (!out.length && !(options && options.skipUnsolicited)) {
      D.knownIds(ch).forEach(function (key) {
        var target = actor(key); if (!target || target === ch) return;
        var relation = D.relation(ch, target), role = D.relationKind(ch, target), disposition = inclination(ch, target, 'greeting');
        if(role==='teacher'||role==='family')relation+=25;
        var contact = D.contactFor(ch, target);
        if (relation < config.greetingThreshold && !contact || disposition.stress > 80 || disposition.score < 8) return;
        var cool = D.readState().cooldowns[ch.id + ':' + target.id + ':greeting'];
        if (cool && (cool.turn === root.GM.turn || D.day() < cool.day + D.config.contactCooldownDays)) return;
        var recentExchange=related.some(function(p){return arr(p.messages).some(function(m){
          var knownPair=m.fromId===ch.id&&m.toId===target.id||m.fromId===target.id&&m.toId===ch.id&&m.status==='delivered';
          return knownPair&&(m.sentTurn===root.GM.turn||m.sentDay!=null&&D.day()<m.sentDay+D.config.contactCooldownDays);
        });});
        if(recentExchange)return;
        if (related.some(function (p) { return !D.terminal(p) && (p.actorId === ch.id && p.targetId === target.id || p.targetId === ch.id && p.actorId === target.id); })) return;
        out.push({ priority: relation + (contact ? 8 : 0) + disposition.sociability * 3 + hash(ch.id + ':' + key + ':' + root.GM.turn) % 5,
          source: 'contact:' + key + ':' + root.GM.turn, reason: contact ? '依已获知的引见约定继续通书' : '已有来往且近期未通问', action: { activityKind: 'greeting', targetId: key } });
      });
    }
    return out.sort(function (a, b) { return b.priority - a.priority || order(a.source, b.source); }).slice(0, config.maxCandidates);
  }
  function prepareEvent(source, detail) {
    var D = domain(), st = D.readState();
    var key = source === 'response' ? 'response:' + String(detail && detail.actionId || '') : 'turn:' + root.GM.turn;
    if (st.event && st.event.turn === root.GM.turn && st.event.remaining > 0 && st.event.active && (source !== 'response' || st.lastEventKey === key)) return st.event;
    if (st.lastEventKey === key || source !== 'response' && st.initializedTurn === root.GM.turn) return null;
    if (source === 'response' && (!detail || !detail.actionId)) return null;
    st.initializedTurn = root.GM.turn; st.lastEventKey = key;
    // Initial entry is a small playable greeting/request cycle, not a full-population startup settlement.
    st.event = { id: key, remaining: source === 'enter' ? config.initialDecisions : config.decisionsPerEvent, batches: source === 'enter' ? 1 : 4, newContacts: 0, active: true, source: source, turn: root.GM.turn };
    return st.event;
  }
  function wake(source, detail) {
    if (running || !root.GM || !root.GM.running || root.GM.busy || root.GM._endTurnBusy || root.GM._loadHydrationPending) return { waiting: true, reason: 'world_busy' };
    if (queued && !ledger().current(queued.lease)) queued = null;
    var D = domain(), migrated = D && D.migrate(); if (!migrated || !migrated.ok) return { waiting: true, reason: 'local_domain_unavailable' };
    var st = D.readState(), event = prepareEvent(source || 'turn', detail);
    if (!event) return { processed: 0, decisions: 0, apiCalls: 0, reason: 'same_period_already_evaluated' };
    if (event.batches <= 0) { event.active = false; return { processed: 0, decisions: 0, apiCalls: 0 }; }
    event.batches--;
    running = true;
    var started = Date.now(), summary = { processed: 0, candidates: 0, decisions: 0, messages: 0, completed: 0, apiCalls: 0 };
    try {
      D.withIndex(function () {
        var visited = new Set(), attempted = new Set();
        for (var count = 0; count < config.decisionsPerBatch && event.remaining > 0; count++) {
          var advance = ledger().advance(root.GM,{localOnly:true}); if (!advance.ok) throw Error(advance.reason || 'local_delivery_failed');
          st = D.readState(); event = st.event;
          var all = arr(root.GM.chars).filter(function (ch) { return ch && ch.id && ch.alive !== false && ch.dead !== true && !player(ch) && D.budget(ch).steps < D.config.dailySteps; }).sort(function (a, b) { return order(a.id, b.id); });
          var matterIndex = new Map();
          D.plans().forEach(function (p) { [p.actorId, p.targetId, p.localActivity.thirdPartyId].filter(Boolean).forEach(function (key) {
            if (!matterIndex.has(key)) matterIndex.set(key, []); matterIndex.get(key).push(p);
          }); });
          var dueIds = D.plans().filter(function (p) { var who = p.nextActorId && actor(p.nextActorId), v = who && D.view(p, who); return !D.terminal(p) && v && v.nextPhase; }).sort(function (a, b) { return a.localActivity.createdDay - b.localActivity.createdDay || order(a.id, b.id); }).map(function (p) { return p.nextActorId; });
          var ordered = all.slice(), cursor = ordered.findIndex(function (ch) { return ch.id === st.cursor; });
          if (cursor >= 0) ordered = ordered.slice(cursor + 1).concat(ordered.slice(0, cursor + 1));
          ordered.sort(function (a, b) { return (dueIds.indexOf(a.id) < 0 ? 1 : 0) - (dueIds.indexOf(b.id) < 0 ? 1 : 0); });
          var choice = null, chosen = null;
          for (var i = 0; i < ordered.length; i++) {
            var ch = ordered[i]; if (!visited.has(ch.id) && visited.size >= config.actorsPerBatch) continue;
            visited.add(ch.id); var options = candidates(ch, matterIndex.get(ch.id) || [], { skipUnsolicited: event.source === 'enter' && event.newContacts >= config.initialNewContacts }); summary.candidates += options.length;
            choice = options.find(function (o) { return !attempted.has(ch.id + ':' + o.source); });
            if (choice) { chosen = ch; break; }
            st.cursor = ch.id;
          }
          if (!chosen) { event.active = visited.size >= config.actorsPerBatch && all.length > visited.size; break; }
          attempted.add(chosen.id + ':' + choice.source); st.cursor = chosen.id;
          if (!st.origins) st.origins = {};
          var origin = JSON.stringify([event.turn, chosen.id, choice.source]);
          if (!st.origins[origin]) st.origins[origin] = 'daily-local:' + (++ledger().state(root.GM).sequence);
          var command = Object.assign({}, choice.action, { actionId: st.origins[origin] });
          var beforeMessages = D.plans().reduce(function (n, p) { return n + p.messages.length; }, 0);
          var receipt = D.submitNPC(chosen, command, { inlineDelivery: true });
          // A failed domain transaction restores nested state objects; do not keep their stale references.
          st = D.readState(); event = st.event; event.remaining--; summary.decisions++;
          if (/^(submitted|completed)$/.test(receipt.outcome) && !choice.action.planId && !choice.action.sourceGoalId) event.newContacts = (event.newContacts || 0) + 1;
          if (receipt.outcome === 'completed') summary.completed++;
          summary.messages += D.plans().reduce(function (n, p) { return n + p.messages.length; }, 0) - beforeMessages;
          // These are development diagnostics, never copied into the player's explanation.
          st.diagnostics.push({ source: event.id, actorId: chosen.id, planId: receipt.planId || '', choice: choice.source, reason: choice.reason,
            outcome: receipt.outcome, waitingReason: receipt.reason, turn: root.GM.turn });
          if (st.diagnostics.length > 80) st.diagnostics.splice(0, st.diagnostics.length - 80);
        }
        summary.processed = visited.size;
        var finalDelivery = ledger().advance(root.GM,{localOnly:true}); if (!finalDelivery.ok) throw Error(finalDelivery.reason || 'local_delivery_failed');
      });
      if (event.remaining <= 0 || event.batches <= 0) event.active = false;
      summary.ms = Date.now() - started; st.lastBatch = summary;
    } finally { running = false; }
    if (event.active && !queued && typeof root.setTimeout === 'function') {
      var pending = { lease: ledger().capture() }; queued = pending;
      root.setTimeout(function () { if (queued === pending) queued = null; if (ledger().current(pending.lease)) { wake('resume'); if (NPC.DailyUI) NPC.DailyUI.render(); } }, 0);
    }
    return summary;
  }
  function scheduleEntry() {
    // A clean scenario with no local goals, active daily matters, or known
    // relationships has nothing for the ordinary loop to decide yet.  Do not
    // scan every character during world bootstrap; later explicit goals,
    // responses, and time/turn wakes still enter the same loop.
    var g = root.GM || {}, chars = arr(g.chars);
    var hasGoals = chars.some(function (ch) {
      return arr(ch && ch.localGoals).some(function (goal) {
        return goal && /^(greeting|introduction|assistance)$/.test(goal.kind) && goal.status !== 'cancelled';
      });
    });
    var hasMatters = arr(g._npcPlans).some(function (p) { return p && p.localActivity && p.localActivity.schemaVersion === 1; });
    var hasKnownRelations = !!(g.affinityMap && Object.keys(g.affinityMap).length);
    if (!hasGoals && !hasMatters && !hasKnownRelations && !g._npcLocalAiEnabled) return;
    var lease = ledger().capture();
    root.setTimeout(function () {
      if (!ledger().current(lease)) return;
      wake('enter'); if (NPC.DailyUI) NPC.DailyUI.render();
    }, 0);
  }
  NPC.LocalAI = { config: config, wake: wake, candidates: candidates, inclination: inclination, scheduleEntry: scheduleEntry };
  if (root.GameHooks) root.GameHooks.on('enterGame:after', scheduleEntry, 60);
})(typeof window !== 'undefined' ? window : globalThis);
