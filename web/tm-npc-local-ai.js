// Bounded ordinary choices. No model, organization binding, world clock or second activity store.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {}, NPC = TM.NPC = TM.NPC || {};
  var config = Object.freeze({ actorsPerBatch: 12, decisionsPerBatch: 12, decisionsPerEvent: 48, initialDecisions: 4, initialNewContacts: 1, maxCandidates: 6, greetingThreshold: 24, dutyPlansPerBatch: 4 });
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
        else if (view.kind === 'meeting') { d.response = disposition.score < 22 ? 'defer' : 'accept'; reason = '按关系、负担和已知行程决定是否赴约'; }
        else if (view.kind === 'greeting') { d.response = disposition.score > 45 && disposition.sociability >= 0 ? 'warm' : 'brief'; reason = '依已有往来选择答复方式'; }
        else if (view.kind === 'assistance' && !arr(p.localActivity.task && p.localActivity.task.materials).length) { d.response = 'conditions'; reason = '已收到的任务缺少材料'; }
        else if (view.kind === 'assistance' && disposition.score < 22 && p.localActivity.task.materials.length > 1) { d.response = 'partial'; reason = '只愿承接较小范围'; }
        else if (view.kind === 'introduction' && ch.id === p.localActivity.thirdPartyId && disposition.li >= 70 && disposition.score < 65) { d.response = 'conditions'; reason = '愿先约明仅通书的边界'; }
        else { d.response = 'accept'; reason = '依本人关系、意愿和当前负担承接'; }
      } else if (d.phase === 'agree') {
        d.response = disposition.score < 0 ? 'reject' : 'accept'; reason = '核对已收到的当前条件';
        if (view.kind === 'assistance' && !arr(p.localActivity.proposedTask && p.localActivity.proposedTask.materials).length) {
          var material = D.selectMaterial(ch, p.localActivity.task);
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
      if (!goal || !goal.id || goal.status === 'cancelled' || !/^(greeting|introduction|assistance|meeting)$/.test(goal.kind)) return;
      var source = String(goal.id) + ':' + Number(goal.version || 1);
      if (related.some(function (p) { return p.actorId === ch.id && p.localActivity.sourceGoalId === source; })) return;
      var target = actor(goal.targetId), third = goal.kind === 'introduction' && actor(goal.thirdPartyId);
      if (!target || target === ch || !D.knows(ch, target) || goal.kind === 'introduction' && (!third || !D.knows(ch, third))) return;
      var willingness = inclination(ch, target, goal.kind);
      if (willingness.stress > 90 || willingness.score < 0) return;
      out.push({ priority: 50 + willingness.score, source: 'goal:' + source, reason: '推进本人明确的普通交往目标',
        action: { activityKind: goal.kind, targetId: target.id, thirdPartyId: third && third.id || '', sourceGoalId: source, task: goal.task, meeting: goal.meeting } });
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
  // Office leave/delegation is a regular local choice, not a model fallback.
  // It runs only for NPC participants whose current message has been delivered;
  // player decisions remain pending for the existing human UI.
  function officeLeaveForPlan(p) {
    var row = TM.OfficeHolderState && TM.OfficeHolderState.position(root.GM, { positionId: p.officeTenure && p.officeTenure.positionId, organizationId: p.officeTenure && p.officeTenure.organizationId });
    var st = row && TM.OfficeTenure && TM.OfficeTenure.state(row, false);
    return st && arr(st.leaves).find(function (v) { return v && v.id === p.officeTenure.leaveId; }) || null;
  }
  function activeDutyPlan(p) {
    return !!(p && p.version === 2 && !p.localActivity && p.task && p.task.kind === 'public_transfer' &&
      !/^(done|rejected|cancelled|failed)$/.test(p.status));
  }
  function dutyAssignments(ch, task) {
    var hs = TM.OfficeHolderState, g = root.GM;
    if (!hs || !ch || !task || !task.fromAccount) return [];
    return hs.activeAssignments(g, ch).filter(function (a) {
      var pos = a.pos || {}, binding = pos.treasuryBinding || {}, refs = binding.accountRefs || (binding.accountRef ? [binding.accountRef] : []);
      var role = binding.role || '';
      if (!pos.powers || pos.powers.treasurySpend !== true || !/^(custodian|manager)$/.test(role)) return false;
      if (refs.indexOf(task.fromAccount) < 0) return false;
      var scope = pos.authorityScope || {};
      return !Array.isArray(scope.accountRefs) || scope.accountRefs.indexOf(task.toAccount) >= 0;
    }).sort(function (a, b) { return String(a.positionId).localeCompare(String(b.positionId)); });
  }
  function dutyMaterial(task) {
    if (!TM.PublicTreasury || !task) return { ok: false, reason: 'public_account_service_unavailable' };
    var view = TM.PublicTreasury.getAccountView({ game: root.GM, ref: task.fromAccount });
    if (!view || !view.exists || !view.known) return { ok: false, reason: 'public_account_material_unknown', view: view };
    var amount = Number(task.amounts && task.amounts.money || 0), available = Number(view.resources && view.resources.money && view.resources.money.available);
    if (!isFinite(amount) || amount <= 0) return { ok: false, reason: 'specific_positive_amount_required', view: view };
    if (!isFinite(available) || available <= 0) return { ok: false, reason: 'public_account_material_empty', view: view };
    if (available < amount) return { ok: false, reason: 'public_account_material_shortfall', view: view, available: available };
    return { ok: true, view: view, available: available };
  }
  function dutyChoice(p, ch, view) {
    var task = p && p.task || {}, assignment = dutyAssignments(ch, task), material = dutyMaterial(task), action = {
      actorId: ch.id, name: ch.name, behaviorType: 'office_duty', planId: p.id,
      targetId: p.actorId === ch.id ? p.targetId : p.actorId, target: p.actorId === ch.id ? p.target : p.actor,
      intent: p.intent, expectedRevision: view && view.revision
    };
    if (!view || !view.nextPhase) return null;
    if (view.nextPhase === 'respond' && ch.id === p.targetId) {
      if (!assignment.length) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'respond', response: 'reject', content: '此项公库事项不在我当前有效的经管权限内，不能冒领承办。' });
      if (!material.ok) {
        if (material.reason === 'public_account_material_shortfall' && material.available > 0) {
          var revised = Object.assign({}, task, { amounts: Object.assign({}, task.amounts, { money: Math.floor(material.available) }) });
          return Object.assign(action, { phase: 'respond', response: 'conditions', task: revised, terms: '当前可核余额不足，最多先办' + revised.amounts.money + '贯。', content: '已核对来源账户，现有余额不足原申请，提出缩减为可核范围。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
        }
        return Object.assign(action, { phase: 'respond', response: 'reject', content: '已核对现有账目，但来源账户或金额材料尚未达到可执行条件：' + material.reason + '。' });
      }
      return Object.assign(action, { phase: 'respond', response: 'accept', content: '已核对来源账户、用途和当前余额，按本职承办。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
    }
    if (view.nextPhase === 'agree' && ch.id === p.actorId) {
      return Object.assign(action, { phase: 'agree', response: p.proposedTask ? 'accept' : 'reject', content: p.proposedTask ? '同意按已核明的可执行额度办理。' : '材料不足，暂不接受未明确的变更。' });
    }
    if (view.nextPhase === 'perform' && ch.id === p.targetId) {
      if (!assignment.length) {
        var seat = p.performerPositionId && TM.OfficeHolderState && TM.OfficeHolderState.position(root.GM, { positionId: p.performerPositionId });
        var successor = seat && TM.OfficeHolderState.read(root.GM, seat.pos).primary;
        if (successor && successor.id !== ch.id) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'handoff', content: '原承办资格已变化，转交当前在任者继续核办。' });
        return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'cancel', content: '原承办资格已变化，当前没有可核验的接任者；事项需重新提出。' });
      }
      if (!dutyMaterial(task).ok) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'cancel', content: '接受后材料或余额已变化，当前交割不能继续；事项需重新核办。' });
      return Object.assign(action, { phase: 'perform', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
    }
    if (view.nextPhase === 'feedback' && ch.id === p.actorId) {
      return Object.assign(action, { phase: 'feedback', evaluation: 'satisfied', content: '已收到实际公库交割回执，金额与用途按本事项核收。' });
    }
    return null;
  }
  function runDutyChoices(limit) {
    var D = domain(), g = root.GM, rows = arr(g && g._npcPlans).filter(activeDutyPlan).sort(function (a, b) {
      return Number(a.updatedTurn || a.createdTurn || 0) - Number(b.updatedTurn || b.createdTurn || 0) || order(a.id, b.id);
    }), done = 0, diagnostics = D && D.readState && D.readState();
    for (var i = 0; i < rows.length && done < (limit || config.dutyPlansPerBatch); i++) {
      var p = rows[i], actor = p.nextActorId && actorById(p.nextActorId), view = actor && ledger().planView(p, actor);
      if (!actor || player(actor) || !view || !view.nextPhase) continue;
      var budget = D.budget(actor); if (budget.steps >= D.config.dailySteps) continue;
      var action = dutyChoice(p, actor, view); if (!action) continue;
      action.actionId = 'local-duty:' + p.id + ':' + view.nextPhase + ':' + String(g.turn);
      var receipt = ledger().ingest(action, 'local-office-duty');
      if (receipt && /^(submitted|completed)$/.test(receipt.outcome)) { D.spend(actor, false); done++; }
      if (diagnostics && diagnostics.diagnostics) {
        diagnostics.diagnostics.push({ source: 'office-duty:' + p.id, actorId: actor.id, planId: p.id, choice: view.nextPhase, reason: receipt && receipt.reason || '', outcome: receipt && receipt.outcome || 'blocked', turn: g.turn });
        if (diagnostics.diagnostics.length > 80) diagnostics.diagnostics.splice(0, diagnostics.diagnostics.length - 80);
      }
    }
    return done;
  }
  function actorById(id) { return id && domain().person(id, root.GM); }
  function requestPublicTransfer(actor, data, human) {
    if (!actor || !data || !data.targetId) return ledger().result('blocked', 'specific_duty_recipient_required');
    var assignment = TM.OfficeHolderState && TM.OfficeHolderState.select(root.GM, actor, { positionId: data.actingPositionId, appointmentId: data.appointmentId, organizationId: data.organizationId });
    if (!assignment) return ledger().result('blocked', 'specific_current_assignment_required');
    var action = Object.assign({}, data, { actorId: actor.id, name: actor.name, behaviorType: 'office_duty', intent: data.intent || data.purpose || '办理具体公库事项', task: { kind: 'public_transfer', fromAccount: data.fromAccount, toAccount: data.toAccount, amounts: Object.assign({}, data.amounts) } });
    if (!human) return ledger().ingest(action, 'local-office-duty-request');
    var handler = root.NpcBehaviorRegistry && root.NpcBehaviorRegistry._behaviors && root.NpcBehaviorRegistry._behaviors.office_duty;
    if (!handler) return ledger().result('blocked', 'office_duty_handler_unavailable');
    return ledger().executeHuman(actor, action, { _npcLease: ledger().capture() }, handler);
  }
  function renderDutyPanel() {
    var g = root.GM || {}, ch = arr(g.chars).find(function (c) { return player(c); }), hs = TM.OfficeHolderState, treasury = TM.PublicTreasury;
    if (!ch || !hs || !treasury) return '';
    var assignments = hs.activeAssignments(g, ch), accounts = treasury.listAccountViews({ game: g, includePools: false }).accounts.filter(function (a) { return a.exists; });
    if (!assignments.length || accounts.length < 2) return '<div class="office-duty-panel" style="padding:8px;color:var(--txt-m);">当前没有可供你发起的已配置常务账户或有效任职。</div>';
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (x) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]; }); }
    var posOptions = assignments.map(function (a) { return '<option value="' + esc(a.positionId) + '" data-org="' + esc(a.organizationId) + '">' + esc(a.dept + '·' + a.pos.name) + '</option>'; }).join('');
    var accountOptions = accounts.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name || a.id) + '</option>'; }).join('');
    var recipients = arr(g.chars).filter(function (x) { return x && x.id !== ch.id && x.alive !== false && x.dead !== true; }).sort(function (a, b) { return order(a.id, b.id); });
    var recipientOptions = recipients.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');
    return '<div class="office-duty-panel" data-office-duty-panel style="margin:8px 0;padding:10px;border:1px solid var(--gold-500);">' +
      '<strong>具体常务·公库事项</strong><p style="margin:4px 0;color:var(--txt-m);">提出用途明确的交割请求；承办人会核对账户、权限与余额，实际执行后才产生流水。</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
      '<select data-duty-position aria-label="行事职任">' + posOptions + '</select><select data-duty-target aria-label="承办人">' + recipientOptions + '</select>' +
      '<select data-duty-from aria-label="来源账户">' + accountOptions + '</select><span>→</span><select data-duty-to aria-label="目标账户">' + accountOptions + '</select>' +
      '<input data-duty-amount type="number" min="1" step="1" value="1" aria-label="金额" style="width:78px"><input data-duty-purpose aria-label="用途" placeholder="用途" style="min-width:130px">' +
      '<button class="bt bsm" data-office-duty="request-transfer">提出事项</button></div><p data-duty-feedback role="status" style="margin:5px 0 0;"></p></div>';
  }
  function runOfficeChoices(limit) {
    if (!TM.OfficeTenure || !TM.OfficeHolderState) return 0;
    var done = 0, now = TM.SimTime && TM.SimTime.now ? TM.SimTime.now(root.GM) : Number(root.GM.turn || 0);
    arr(root.GM._npcPlans).filter(function (p) { return p && p.type === 'office_leave' && p.officeTenure && !/^(done|rejected|cancelled)$/.test(p.status); }).forEach(function (p) {
      if (done >= (limit || 4)) return;
      var leave = officeLeaveForPlan(p); if (!leave) return;
      var next = p.nextActorId && actor(p.nextActorId);
      if (!next || player(next)) return;
      var args = { positionId: leave.positionId, organizationId: leave.organizationId, leaveId: leave.id };
      var r = null;
      if (p.status === 'awaiting_response') r = TM.OfficeTenure.decideLeave(next, Object.assign({}, args, { actionId: 'local-office-decide:' + p.id + ':' + root.GM.turn, decision: 'approve' }), false);
      else if (p.status === 'handoff_ready') r = TM.OfficeTenure.acceptDelegate(next, Object.assign({}, args, { actionId: 'local-office-accept:' + p.id + ':' + root.GM.turn, delegationId: leave.delegationId }), false);
      else if (leave.status === 'approved' && leave.holderId === next.id && now >= Number(leave.startDay)) r = TM.OfficeTenure.beginLeave(next, Object.assign({}, args, { actionId: 'local-office-depart:' + p.id + ':' + root.GM.turn }), false);
      else if (leave.status === 'returned_pending_report') {
        var approver = TM.OfficeTenure.authorityTarget(root.GM, TM.OfficeHolderState.position(root.GM, { positionId: leave.positionId, organizationId: leave.organizationId }));
        if (approver && approver.id === next.id) r = TM.OfficeTenure.receiveReturnReport(next, Object.assign({}, args, { actionId: 'local-office-report:' + p.id + ':' + root.GM.turn }), false);
      }
      if (r && /^(submitted|started|completed)$/.test(r.outcome)) done++;
    });
    return done;
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
    var started = Date.now(), summary = { processed: 0, candidates: 0, decisions: 0, messages: 0, completed: 0, apiCalls: 0, dutyCompleted: 0 };
    try {
      D.withIndex(function () {
        summary.dutyCompleted = runDutyChoices(config.dutyPlansPerBatch);
        runOfficeChoices(4);
        var visited = new Set(), attempted = new Set();
        for (var count = 0; count < config.decisionsPerBatch && event.remaining > 0; count++) {
          var advance = ledger().advance(root.GM,{localOnly:true}); if (!advance.ok) throw Error(advance.reason || 'local_delivery_failed');
          st = D.readState(); event = st.event;
          var all = arr(root.GM.chars).filter(function (ch) { return ch && ch.id && ch.alive !== false && ch.dead !== true && !player(ch) && D.budget(ch).steps < D.config.dailySteps; }).sort(function (a, b) { return order(a.id, b.id); });
          var matterIndex = new Map();
          D.plans().filter(function (p) { return p && p.localActivity; }).forEach(function (p) { [p.actorId, p.targetId, p.localActivity.thirdPartyId].filter(Boolean).forEach(function (key) {
            if (!matterIndex.has(key)) matterIndex.set(key, []); matterIndex.get(key).push(p);
          }); });
          var dueIds = D.plans().filter(function (p) { if (!p || !p.localActivity) return false; var who = p.nextActorId && actor(p.nextActorId), v = who && D.view(p, who); return !D.terminal(p) && v && v.nextPhase; }).sort(function (a, b) { return a.localActivity.createdDay - b.localActivity.createdDay || order(a.id, b.id); }).map(function (p) { return p.nextActorId; });
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
        return goal && /^(greeting|introduction|assistance|meeting)$/.test(goal.kind) && goal.status !== 'cancelled';
      });
    });
    var hasMatters = arr(g._npcPlans).some(function (p) { return p && p.localActivity && p.localActivity.schemaVersion === 1; });
    var hasDutyMatters = arr(g._npcPlans).some(activeDutyPlan);
    var hasKnownRelations = !!(g.affinityMap && Object.keys(g.affinityMap).length) || chars.some(function (ch) { return ch && domain().relationshipRefs(ch).some(function (ref) { return domain().relationshipIds(ref, g).length; }); });
    if (!hasGoals && !hasMatters && !hasDutyMatters && !hasKnownRelations && !g._npcLocalAiEnabled) return;
    var lease = ledger().capture();
    root.setTimeout(function () {
      if (!ledger().current(lease)) return;
      wake('enter'); if (NPC.DailyUI) NPC.DailyUI.render();
    }, 0);
  }
  NPC.LocalAI = { config: config, wake: wake, candidates: candidates, inclination: inclination, scheduleEntry: scheduleEntry,
    requestPublicTransfer: requestPublicTransfer, renderDutyPanel: renderDutyPanel, runDutyChoices: runDutyChoices };
  if (root.GameHooks) root.GameHooks.on('enterGame:after', scheduleEntry, 60);
})(typeof window !== 'undefined' ? window : globalThis);
