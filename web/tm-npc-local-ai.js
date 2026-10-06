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
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function key(v) { return v == null ? '' : String(v).trim(); }
  function finite(v) { return v != null && v !== '' && isFinite(Number(v)); }
  // Quota values are domain data, not UI strings.  In particular, null must
  // never become zero through Number(null) or the global isFinite().
  function finiteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
  function currentDay() { return TM.SimTime && TM.SimTime.now ? TM.SimTime.now(root.GM) : Number(root.GM && root.GM.turn || 0); }
  function sameId(a, b) { return key(a) !== '' && key(a) === key(b); }
  function list(v) { return Array.isArray(v) ? v : []; }
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
        else if (view.kind === 'consultation') {
          d.response = disposition.score < 18 ? 'reject' : disposition.stress >= 65 && p.localActivity.deferrals < D.config.maxDeferrals ? 'defer' : disposition.score < 42 ? 'brief' : 'accept';
          reason = disposition.score < 18 ? '对方与当前话题关系不足，婉拒请益' : d.response === 'defer' ? '当前负担较重，暂缓请益' : d.response === 'brief' ? '延期次数已到上限，只接受一次简短切磋' : '按已知往来和当前负担接受一次具体请益';
        }
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
      } else if (d.phase === 'perform' && view.kind === 'consultation') {
        var preference = p.localActivity && p.localActivity.preferredExchange || 'explain';
        d.exchangeChoice = preference === 'question' ? 'question' : disposition.li >= 70 ? 'counter' : 'explain';
        reason = '依据具体话题和本人已知经历选择交流方式';
      } else if (d.phase === 'question_answer' && view.kind === 'consultation') {
        d.response = disposition.score < 18 ? 'uncertain' : 'answer';
        reason = d.response === 'answer' ? '依据自己的理解回答对方的具体问题' : '说明目前只能给出有限理解';
      } else if (d.phase === 'followup_response' && view.kind === 'consultation') {
        d.response = disposition.stress >= 80 && Number(p.localActivity.followUp && p.localActivity.followUp.deferrals || 0) < 1 ? 'defer' : disposition.score < 8 ? 'decline' : 'answer';
        reason = d.response === 'answer' ? '按当前话题和可用时间回应一次追问' : d.response === 'defer' ? '当前负担仍重，暂缓这一次追问' : '当前不再承接同一追问';
      } else if (d.phase === 'feedback') {
        if (view.kind === 'consultation') {
          d.response = p.localActivity.followUp && p.localActivity.followUp.status === 'received' ? 'reflect' :
            D.consultationHistory(ch, p.localActivity.topicId) ? 'reflect' : 'ask';
          reason = d.response === 'ask' ? '本次交流仍有一个具体问题，提出一次有界追问' : '依据已收到的答复整理本人的理解';
        }
        else { d.response = disposition.score >= 20 ? 'satisfied' : 'ack'; reason = '对实际收到的文书作反馈'; }
      }
      else if (d.phase === 'cancel') reason = '本地递送未能安排，结束此项请求';
      candidates.push({ priority: 1000 + Math.max(0, D.day() - p.localActivity.createdDay), source: p.id + ':' + view.revision + ':' + d.phase,
        action: d, reason: reason, planId: p.id });
    });
    return candidates;
  }
  function opportunityCandidates(ch) {
    var D = domain(), opportunities = D.consultationOpportunities ? D.consultationOpportunities(ch, root.GM) : [];
    return opportunities.map(function (o) {
      if (o.sendable === false) return null;
      var target = actor(o.action && o.action.targetId), disposition = inclination(ch, target, 'consultation');
      // A real source creates an opportunity, but it does not compel a new
      // contact.  Current burden and the actor's relation/temperament still
      // decide whether the local scheduler picks it up this turn.
      if (disposition.stress > 80 || disposition.score < 8) return null;
      return { priority: o.priority + Math.max(0, Math.round(disposition.score / 10)), source: o.source, reason: o.reason,
        action: { activityKind: 'consultation', targetId: o.action.targetId, sourceOpportunity: o.action.consultation && o.action.consultation.sourceOpportunity,
          consultation: o.action.consultation } };
    }).filter(Boolean);
  }
  function candidates(ch, related, options) {
    var D = domain(), due = dueCandidates(ch, related), out = [], b = D.budget(ch);
    if (b.steps >= D.config.dailySteps) return [];
    // Due responses keep their high priority, but a newly discovered
    // opportunity must not hide an already valid local goal.  Starts are
    // still bounded separately from the number of candidates shown.
    if (b.starts < D.config.dailyStarts) out = opportunityCandidates(ch);
    if (b.starts < D.config.dailyStarts) arr(ch.localGoals).forEach(function (goal) {
      if (!goal || !goal.id || goal.status === 'cancelled' || !/^(greeting|introduction|assistance|meeting|consultation)$/.test(goal.kind)) return;
      var source = String(goal.id) + ':' + Number(goal.version || 1);
      if (related.some(function (p) { return p.actorId === ch.id && p.localActivity.sourceGoalId === source; })) return;
      var target = actor(goal.targetId), third = goal.kind === 'introduction' && actor(goal.thirdPartyId);
      if (!target || target === ch || !D.knows(ch, target) || goal.kind === 'introduction' && (!third || !D.knows(ch, third))) return;
      var willingness = inclination(ch, target, goal.kind);
      if (willingness.stress > 90 || willingness.score < 0) return;
      out.push({ priority: 50 + willingness.score, source: 'goal:' + source, reason: '推进本人明确的普通交往目标',
        action: { activityKind: goal.kind, targetId: target.id, thirdPartyId: third && third.id || '', sourceGoalId: source, task: goal.task, meeting: goal.meeting, consultation: goal.consultation } });
    });
    if (!out.length && !due.length && !(options && options.skipUnsolicited) && b.starts < D.config.dailyStarts) {
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
    // Pending work always wins over a new start, while other executable
    // choices remain visible for the player and for bounded local selection.
    return due.concat(out).sort(function (a, b) { return b.priority - a.priority || order(a.source, b.source); }).slice(0, config.maxCandidates);
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
  // A public-transfer plan carries a reference to an existing matter and its
  // material.  The resolver is deliberately read-only and accepts stable IDs
  // from the stores already used by the game; it never treats a label or a
  // purpose sentence as evidence.
  function dutyRecords(g) {
    g = g || root.GM || {};
    return [
      { kind: 'memorial', rows: arr(g.memorials) },
      { kind: 'document', rows: arr(g.documents) },
      { kind: 'task', rows: arr(g.tasks).concat(arr(g.workItems), arr(g.activeTasks)) },
      { kind: 'plan', rows: arr(g._npcPlans) },
      { kind: 'duty_matter', rows: arr(g._npcDutyMatters) }
    ];
  }
  function dutyRecord(ref, g) {
    ref = ref || {}; g = g || root.GM || {};
    var id = key(ref.id || ref.matterId || ref.documentId), kind = key(ref.kind || '');
    if (!id) return null;
    var hits = [];
    dutyRecords(g).forEach(function (bucket) {
      if (kind && kind !== bucket.kind && !(kind === 'work_item' && bucket.kind === 'task')) return;
      bucket.rows.forEach(function (row) {
        if (row && sameId(row.id || row.matterId || row.documentId, id)) hits.push({ row: row, kind: bucket.kind });
      });
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function dutyRef(ref) {
    ref = ref || {};
    var id = key(ref.id || ref.matterId || ref.documentId), kind = key(ref.kind || 'document');
    if (!id || !/^[A-Za-z0-9_.:/-]{1,200}$/.test(id)) return null;
    return { kind: kind, id: id, version: finite(ref.version) ? Number(ref.version) : null };
  }
  function dutyRefs(task, record) {
    var basis = task && (task.basis || task.requestBasis) || {}, refs = list(basis.sourceRefs || basis.materialRefs || task && task.sourceRefs);
    if (!refs.length && record && record.row) refs = list(record.row.sourceRefs || record.row.materialRefs || record.row.materials);
    return refs.map(dutyRef).filter(Boolean);
  }
  function dutyVisible(ch, record, task) {
    if (!record || !record.row || !ch) return false;
    var row = record.row, id = key(ch.id), basis = task && (task.basis || task.requestBasis) || {};
    if (row.public === true || /^(public|open|published)$/.test(key(row.visibility || row.access))) return true;
    if (sameId(row.actorId || row.authorId || row.ownerId || row.requesterId, id)) return true;
    if (list(row.knownTo || row.visibleTo || row.audienceIds || row.recipientIds).some(function (v) { return sameId(v, id); })) return true;
    if (row.private === true || row.secret === true || /^(private|secret|hidden)$/.test(key(row.visibility))) return false;
    // Organization membership alone is not proof that a private record was
    // delivered to this person.  A record must opt into member visibility (or
    // name an explicit audience); an assignment only supplies the authority to
    // act after the record is known.
    var org = key(basis.organizationId || task && task.organizationId);
    if (!org || !(sameId(row.organizationId, org) || sameId(row.factionId, org))) return false;
    var memberReadable = row.organizationReadable === true || row.memberReadable === true ||
      /^(organization|members|office)$/.test(key(row.visibility || row.access || row.accessPolicy));
    if (!memberReadable) return false;
    return !!(TM.OfficeHolderState && TM.OfficeHolderState.activeAssignments && TM.OfficeHolderState.activeAssignments(root.GM, ch, { organizationId: org }).length);
  }
  function dutyMatter(task, ch) {
    var basis = task && (task.basis || task.requestBasis) || {}, ref = dutyRef(basis.matterRef || task && task.matterRef), hit = dutyRecord(ref, root.GM);
    if (!ref) return { ok: false, reason: 'duty_matter_reference_required' };
    if (!hit) return { ok: false, reason: 'duty_matter_not_found', matterRef: ref };
    var row = hit.row, version = finite(row.version || row.revision) ? Number(row.version || row.revision) : 1;
    if (ref.version != null && version !== ref.version) return { ok: false, reason: 'duty_matter_version_mismatch', matterRef: ref, actualVersion: version };
    if (!dutyVisible(ch, hit, task)) return { ok: false, reason: 'duty_matter_not_known', matterRef: ref };
    if (/^(closed|cancelled|rejected|superseded)$/.test(key(row.status))) return { ok: false, reason: 'duty_matter_not_open', matterRef: ref };
    var subjectId = key(basis.subjectId || task && task.subjectId), rowSubject = key(row.subjectId || row.objectId || row.beneficiaryId);
    if (subjectId && rowSubject && subjectId !== rowSubject) return { ok: false, reason: 'duty_matter_subject_mismatch', matterRef: ref };
    var policy = row.transferPolicy || row.publicTransfer || {};
    var pendingTransfer = row.requestedTransfer || row.transferRequest || null;
    if (row.allowPublicTransfer !== true && policy.allowMoney !== true && policy.allowPublicTransfer !== true && !pendingTransfer) return { ok: false, reason: 'duty_purpose_not_authorized', matterRef: ref };
    return { ok: true, ref: ref, record: row, version: version, policy: policy, pendingTransfer: pendingTransfer, pendingPolicy: !!(pendingTransfer && policy.allowMoney !== true && policy.allowPublicTransfer !== true && row.allowPublicTransfer !== true), subjectId: subjectId || rowSubject };
  }
  function dutyEvidence(task, ch, options) {
    options = options || {};
    var matter = dutyMatter(task, ch);
    if (!matter.ok) return matter;
    if (matter.pendingPolicy && options.allowPendingPolicy !== true) return { ok: false, reason: 'duty_purpose_not_authorized', matter: matter };
    var refs = dutyRefs(task, matter.record), basis = task && (task.basis || task.requestBasis) || {};
    if (!refs.length) return { ok: false, reason: 'duty_material_reference_required', matter: matter };
    var checked = [], missing = [], hidden = [], unverified = [], unrelated = [];
    function refMatches(a, b) { return a && b && key(a.kind) === key(b.kind) && key(a.id) === key(b.id) && (a.version == null || b.version == null || Number(a.version) === Number(b.version)); }
    function materialRelated(row, ref) {
      var matterRow = matter.record || {}, declared = list(matterRow.sourceRefs || matterRow.materialRefs || matterRow.materials).map(dutyRef).filter(Boolean);
      var verified = list(matterRow.verifiedSourceRefs).map(dutyRef).filter(Boolean);
      if (matterRow.sourceRefsState === 'verified' && !verified.some(function (x) { return refMatches(x, ref); })) return false;
      if (matterRow.sourceRefsState !== 'submitted' && declared.some(function (x) { return refMatches(x, ref); })) return true;
      var linked = row && (row.matterId || row.matterRef || row.sourceMatterId || row.relatedMatterId);
      if (linked && typeof linked === 'object') linked = linked.id;
      if (linked && key(linked) === key(matter.ref.id)) return true;
      var rowSubject = key(row && (row.subjectId || row.objectId || row.beneficiaryId));
      var org = key(row && (row.organizationId || row.factionId));
      return !!(matter.subjectId && rowSubject && rowSubject === matter.subjectId && (!org || !matter.record.organizationId || org === key(matter.record.organizationId)));
    }
    refs.forEach(function (ref) {
      var hit = dutyRecord(ref, root.GM);
      if (!hit) { missing.push(ref); return; }
      var version = finite(hit.row.version || hit.row.revision) ? Number(hit.row.version || hit.row.revision) : 1;
      if (ref.version != null && version !== ref.version) { missing.push(Object.assign({}, ref, { reason: 'version_mismatch' })); return; }
      if (!dutyVisible(ch, hit, task)) { hidden.push(ref); return; }
      if (!materialRelated(hit.row, ref)) { unrelated.push(Object.assign({}, ref, { reason: 'matter_association_missing' })); return; }
      // Missing provenance is unknown.  It may support a request or a
      // follow-up question, but it cannot support a payment as an observed
      // fact merely because the row exists.
      var factStatus = key(hit.row.factStatus || hit.row.status);
      if (!factStatus || /^(claimed|alleged|rumor|unverified|planned|reported|unknown|draft)$/.test(factStatus)) { unverified.push(Object.assign({}, ref, { factStatus: factStatus || 'unknown' })); return; }
      checked.push({ kind: ref.kind, id: ref.id, version: version, factStatus: factStatus });
    });
    if (missing.length) return { ok: false, reason: 'duty_material_not_found_or_stale', matter: matter, missing: missing };
    if (hidden.length) return { ok: false, reason: 'duty_material_not_readable', matter: matter, hidden: hidden };
    if (unrelated.length) return { ok: false, reason: 'duty_material_not_related', matter: matter, unrelated: unrelated };
    if (unverified.length) return { ok: false, reason: 'duty_material_unverified', matter: matter, unverified: unverified };
    if (matter.record.sourceRefsState === 'submitted' && options.allowPendingPolicy !== true) return { ok: false, reason: 'duty_material_not_verified', matter: matter, checked: checked };
    var amounts = task && task.amounts || {}, resources = Object.keys(amounts).filter(function (k) { return Number(amounts[k]) > 0; });
    if (resources.some(function (k) { return k !== 'money'; })) return { ok: false, reason: 'unsupported_duty_resource', matter: matter, checked: checked };
    var requested = Number(amounts.money || 0), rawMax = Object.prototype.hasOwnProperty.call(matter.policy, 'maxMoney') ? matter.policy.maxMoney :
      (Object.prototype.hasOwnProperty.call(matter.record, 'maxMoney') ? matter.record.maxMoney : null), max = null, quotaKind = 'unconfigured';
    if (!finite(requested) || requested <= 0) return { ok: false, reason: 'specific_positive_money_required', matter: matter, checked: checked };
    var expectedSource = key(matter.record.fromAccount || matter.record.sourceAccount), expectedTarget = key(matter.record.toAccount || matter.record.destinationAccount);
    if (expectedSource && key(task.fromAccount) !== expectedSource) return { ok: false, reason: 'duty_source_scope_mismatch', matter: matter, checked: checked };
    if (expectedTarget && key(task.toAccount) !== expectedTarget) return { ok: false, reason: 'duty_target_scope_mismatch', matter: matter, checked: checked };
    // Free-form wording is a request description.  Only a structured purpose
    // kind participates in the authorization scope, when a matter declares
    // one; otherwise the linked matter and subject/account bindings are the
    // supported deterministic purpose checks.
    var declaredPurpose = key(matter.record.purposeKind), taskPurpose = key(task.purposeKind || basis.purposeKind);
    if (declaredPurpose && taskPurpose && declaredPurpose !== taskPurpose) return { ok: false, reason: 'duty_purpose_scope_mismatch', matter: matter, checked: checked };
    if (rawMax !== null && rawMax !== undefined && rawMax !== '') {
      if (!finiteNumber(rawMax) || rawMax < 0) return { ok: false, reason: 'duty_quota_unknown', matter: matter, checked: checked };
      max = Math.floor(rawMax); quotaKind = 'finite_total';
    }
    var spent = 0;
    if (quotaKind === 'finite_total') list(root.GM && root.GM._publicTreasuryTransfers).forEach(function (receipt) {
      var ev = receipt && receipt.dutyEvidence, mr = ev && ev.matterRef;
      if (mr && key(mr.id) === key(matter.ref.id) && key(mr.kind) === key(matter.ref.kind)) spent += Number(receipt.result && receipt.result.paid && receipt.result.paid.money || 0);
    });
    var remaining = quotaKind === 'finite_total' ? Math.max(0, max - spent) : null;
    var allowPartial = task.allowPartial === true || basis.allowPartial === true || matter.policy.allowPartial === true;
    if (quotaKind === 'finite_total' && requested > remaining && !(allowPartial && remaining > 0)) return { ok: false, reason: 'duty_amount_exceeds_remaining', matter: matter, checked: checked, maxMoney: max, spentMoney: spent, remainingMoney: remaining, quota: { kind: quotaKind, limit: max, used: spent, remaining: remaining } };
    return { ok: true, matter: matter, checked: checked, requestedMoney: requested,
      allowPartial: allowPartial,
      maxMoney: quotaKind === 'finite_total' ? max : null, spentMoney: spent, remainingMoney: remaining,
      quota: { kind: quotaKind, limit: quotaKind === 'finite_total' ? max : null, used: quotaKind === 'finite_total' ? spent : null, remaining: remaining },
      facts: { matterRef: matter.ref, matterVersion: matter.version, materialRefs: checked, subjectId: matter.subjectId || '', checked: ['matter', 'materials', 'purpose_scope'], spentMoney: quotaKind === 'finite_total' ? spent : null, remainingMoney: remaining, quotaKind: quotaKind } };
  }
  function dutyMatterOptions(ch) {
    var out = [];
    dutyRecords(root.GM).forEach(function (bucket) { bucket.rows.forEach(function (row) {
      if (!row || !row.id || !dutyVisible(ch, { row: row, kind: bucket.kind }, { organizationId: row.organizationId })) return;
      var policy = row.transferPolicy || row.publicTransfer || {}, pending = row.requestedTransfer || row.transferRequest;
      if (row.allowPublicTransfer !== true && policy.allowMoney !== true && policy.allowPublicTransfer !== true && !pending) return;
      var ref = { kind: bucket.kind, id: key(row.id), version: finite(row.version || row.revision) ? Number(row.version || row.revision) : 1 };
      if (!out.some(function (x) { return x.id === ref.id && x.kind === ref.kind; })) out.push({ id: ref.id, kind: ref.kind, version: ref.version, title: row.title || row.name || row.subject || ref.id,
        purpose: row.purpose || row.description || '', organizationId: row.organizationId || row.factionId || '', fromAccount: row.fromAccount || row.sourceAccount || '', toAccount: row.toAccount || row.destinationAccount || '', amount: row.requestedAmount || row.amount || pending && pending.requestedAmount || '', sourceRefs: row.sourceRefs || row.materialRefs || row.materials || [], pendingPolicy: !!pending && !policy.allowMoney && !row.allowPublicTransfer });
    }); });
    return out.sort(function (a, b) { return order(a.id, b.id); });
  }
  function dutyMaterialOptions(ch) {
    var out = [];
    dutyRecords(root.GM).forEach(function (bucket) { bucket.rows.forEach(function (row) {
      if (!row || !row.id || !dutyVisible(ch, { row: row, kind: bucket.kind }, { organizationId: row.organizationId || row.factionId })) return;
      var status = key(row.factStatus || row.status);
      if (!status || /^(claimed|alleged|rumor|unverified|planned|reported|unknown|draft|closed|cancelled)$/.test(status)) return;
      var ref = { kind: bucket.kind, id: key(row.id), version: finite(row.version || row.revision) ? Number(row.version || row.revision) : 1 };
      if (!out.some(function (x) { return x.kind === ref.kind && x.id === ref.id; })) out.push({ kind: ref.kind, id: ref.id, version: ref.version, title: row.title || row.name || row.subject || ref.id, organizationId: row.organizationId || row.factionId || '', subjectId: row.subjectId || row.objectId || row.beneficiaryId || '', fromAccount: row.fromAccount || row.sourceAccount || '', toAccount: row.toAccount || row.destinationAccount || '' });
    }); });
    return out.sort(function (a, b) { return order(a.id, b.id); });
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
      if (task.organizationId && key(a.organizationId) !== key(task.organizationId)) return false;
      if (task.performerPositionId && key(a.positionId) !== key(task.performerPositionId)) return false;
      if (task.performerAppointmentId && key(a.appointmentId) !== key(task.performerAppointmentId)) return false;
      var scope = pos.authorityScope || {};
      if (Array.isArray(scope.accountRefs) && scope.accountRefs.indexOf(task.toAccount) < 0) return false;
      if (Array.isArray(scope.positionIds) && task.subjectPositionId && scope.positionIds.indexOf(task.subjectPositionId) < 0) return false;
      if (Array.isArray(scope.departmentIds) && task.subjectDepartmentId && scope.departmentIds.indexOf(task.subjectDepartmentId) < 0) return false;
      if (TM.OfficeTenure && TM.OfficeTenure.canAct) {
        var presence = TM.OfficeTenure.canAct({ world: g, actor: ch, positionId: a.positionId, organizationId: a.organizationId,
          appointmentId: a.appointmentId, action: 'public_transfer', power: 'treasurySpend', regionId: task.regionId });
        if (!presence || presence.ok !== true) return false;
      }
      if (TM.PoliticalActions && TM.PoliticalActions.resolve && task.organizationId && TM.PoliticalActions.resolve('organization', { id: task.organizationId }, g)) {
        var auth = TM.PoliticalActions.authority(ch, { organizationId: task.organizationId, actingPositionId: a.positionId, appointmentId: a.appointmentId }, 'treasurySpend', null, g);
        if (!auth) return false;
      }
      return true;
    }).sort(function (a, b) { return String(a.positionId).localeCompare(String(b.positionId)); });
  }
  // Spending an already authorised transfer and deciding that a new matter
  // may spend public money are separate powers.  The latter is deliberately
  // opt-in on the position/authority scope; a treasury binding alone is not
  // a blanket approval of every purpose or amount.
  function dutyDecisionScope(assignment, task) {
    var pos = assignment && assignment.pos || {}, powers = pos.powers || {}, scope = pos.authorityScope || {};
    var policy = pos.publicTransferDecision || pos.publicTransferPolicy || scope.publicTransferDecision || scope.publicTransferPolicy || scope.transferPolicy || {};
    var configured = powers.publicTransferDecide === true || powers.treasuryDecision === true || powers.publicTransferDecision === true || policy.allowDecision === true || Object.prototype.hasOwnProperty.call(policy, 'maxMoney');
    if (!configured) return null;
    return { positionId: assignment.positionId, appointmentId: assignment.appointmentId, policy: policy, scope: scope };
  }
  function dutyMaterial(task, ch, assignment, options) {
    if (!TM.PublicTreasury || !task) return { ok: false, reason: 'public_account_service_unavailable' };
    var evidence = dutyEvidence(task, ch, options);
    if (!evidence.ok) return evidence;
    if (!assignment) return { ok: false, reason: 'public_account_access_required', evidence: evidence };
    var view = TM.PublicTreasury.getAccountView({ game: root.GM, ref: task.fromAccount });
    if (!view || !view.exists || !view.known) return { ok: false, reason: 'public_account_material_unknown', view: view };
    var amount = Number(task.amounts && task.amounts.money || 0), rawAvailable = view.resources && view.resources.money && view.resources.money.available;
    var available = finiteNumber(rawAvailable) ? rawAvailable : null;
    if (!isFinite(amount) || amount <= 0) return { ok: false, reason: 'specific_positive_amount_required', view: view };
    if (available == null) return { ok: false, reason: 'public_account_material_unknown', view: view, evidence: evidence };
    if (available <= 0) return { ok: false, reason: 'public_account_material_empty', view: view };
    var quota = evidence.quota || {};
    if (quota.kind === 'unknown') return { ok: false, reason: 'duty_quota_unknown', view: view, evidence: evidence };
    if (quota.kind === 'finite_total') available = Math.min(available, quota.remaining);
    if (available < amount) {
      if (available > 0 && evidence.allowPartial) return { ok: false, reason: 'public_account_material_shortfall', view: view, available: available, evidence: evidence, allowPartial: true };
      return { ok: false, reason: quota.kind === 'finite_total' && quota.remaining === 0 ? 'duty_amount_exceeds_remaining' : 'public_account_material_shortfall', view: view, available: available, evidence: evidence, allowPartial: evidence.allowPartial };
    }
    return { ok: true, view: view, available: available, evidence: evidence };
  }
  function dutyRecipients(task, excludeId) {
    var g = root.GM, rows = arr(g && g.chars).filter(function (ch) { return ch && ch.id !== excludeId && ch.alive !== false && ch.dead !== true; });
    return rows.map(function (ch) { return { actor: ch, assignments: dutyAssignments(ch, task) }; }).filter(function (row) { return row.assignments.length; })
      .sort(function (a, b) { return order(a.actor.id, b.actor.id); });
  }
  function routeDutyRecipient(task, excludeId) {
    var rows = dutyRecipients(task, excludeId);
    return rows.length ? rows[0] : null;
  }
  function taskBasis(data, actor) {
    var basis = copy(data && (data.basis || data.requestBasis)) || {}, matter = data && (data.matter || data.matterRef || basis.matterRef);
    if (typeof matter === 'string') matter = { kind: 'memorial', id: matter };
    if (!basis.matterRef && matter) basis.matterRef = dutyRef(matter);
    if (basis.matterRef) basis.matterRef = dutyRef(basis.matterRef);
    basis.version = finite(basis.version) ? Number(basis.version) : 1;
    basis.requestedBy = key(basis.requestedBy || actor && actor.id);
    basis.purpose = key(basis.purpose || data && data.purpose);
    basis.statement = key(basis.statement || data && (data.statement || data.intent || data.purpose));
    basis.subjectId = key(basis.subjectId || data && data.subjectId);
    basis.organizationId = key(basis.organizationId || data && data.organizationId);
    basis.allowPartial = basis.allowPartial === true || data && data.allowPartial === true;
    basis.sourceRefs = list(basis.sourceRefs || basis.materialRefs || data && (data.sourceRefs || data.materialRefs) || matter && (matter.sourceRefs || matter.materialRefs)).map(dutyRef).filter(Boolean);
    return basis;
  }
  function authorizeDutyMatter(task, ch) {
    var matter = dutyMatter(task, ch);
    if (!matter.ok) return matter;
    if (!matter.pendingPolicy) return { ok: true, matter: matter, existing: true };
    var pending = matter.pendingTransfer || {}, amount = Number(task.amounts && task.amounts.money || pending.requestedAmount || 0);
    if (pending.resource && pending.resource !== 'money') return { ok: false, reason: 'unsupported_duty_resource', matter: matter };
    if (!isFinite(amount) || amount <= 0) return { ok: false, reason: 'duty_request_policy_invalid', matter: matter };
    var assignment = dutyAssignments(ch, task);
    if (!assignment.length) return { ok: false, reason: 'public_account_access_required', matter: matter };
    var decision = dutyDecisionScope(assignment[0], task);
    if (!decision) return { ok: false, reason: 'duty_decision_authority_required', matter: matter };
    var policy = decision.policy || {}, rawLimit = Object.prototype.hasOwnProperty.call(policy, 'maxMoney') ? policy.maxMoney : null;
    if (rawLimit !== null && (rawLimit === undefined || rawLimit === '' || !finiteNumber(rawLimit) || rawLimit < 0)) return { ok: false, reason: 'duty_decision_scope_unknown', matter: matter };
    if (rawLimit === null) return { ok: false, reason: 'duty_decision_scope_unknown', matter: matter };
    var limit = Math.floor(rawLimit);
    if (amount > limit) return { ok: false, reason: 'duty_decision_amount_exceeds_scope', matter: matter, limit: limit };
    var row = matter.record, version = Number(row.version || row.revision || 1);
    // Old records used maxMoney for the request field.  It is only a legacy
    // statement of the requested total here; the trusted decision ceiling
    // still comes from the current position scope above.
    var requestedLimit = Number(pending.requestedAmount != null ? pending.requestedAmount : pending.maxMoney);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) return { ok: false, reason: 'duty_request_policy_invalid', matter: matter };
    var authorizedLimit = Math.min(limit, Math.floor(requestedLimit));
    if (authorizedLimit <= 0) return { ok: false, reason: 'duty_decision_scope_unknown', matter: matter };
    var pendingEvidence = dutyEvidence(task, ch, { allowPendingPolicy: true });
    if (!pendingEvidence.ok) return pendingEvidence;
    var expectedSource = key(row.fromAccount || row.sourceAccount), expectedTarget = key(row.toAccount || row.destinationAccount),
      actualSource = key(task.fromAccount), actualTarget = key(task.toAccount);
    if (expectedSource && actualSource && expectedSource !== actualSource) return { ok: false, reason: 'duty_source_scope_mismatch', matter: matter };
    if (expectedTarget && actualTarget && expectedTarget !== actualTarget) return { ok: false, reason: 'duty_target_scope_mismatch', matter: matter };
    if (Array.isArray(policy.accountRefs) && actualTarget && policy.accountRefs.indexOf(actualTarget) < 0) return { ok: false, reason: 'duty_target_scope_mismatch', matter: matter };
    if (Array.isArray(policy.allowedSubjects) && policy.allowedSubjects.indexOf(matter.subjectId) < 0) return { ok: false, reason: 'duty_subject_scope_mismatch', matter: matter };
    if (Array.isArray(policy.purposeKinds) && policy.purposeKinds.length && policy.purposeKinds.indexOf(key(row.kind || row.purposeKind)) < 0) return { ok: false, reason: 'duty_purpose_scope_mismatch', matter: matter };
    row.sourceRefsState = 'verified';
    row.verifiedSourceRefs = copy(pendingEvidence.checked);
    row.transferPolicy = { allowMoney: true, maxMoney: authorizedLimit, allowPartial: pending.allowPartial !== false,
      source: 'office-duty-decision', decisionRef: { actorId: ch.id, organizationId: task.organizationId || row.organizationId || '', positionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, matterRef: matter.ref, version: version }, version: version };
    row.allowPublicTransfer = true;
    row.transferDecision = { actorId: ch.id, positionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, organizationId: task.organizationId || row.organizationId || '', day: currentDay(), matterRef: matter.ref, version: version };
    pending.status = 'approved'; pending.approvedBy = ch.id; pending.approvedDay = currentDay(); pending.approvedAmount = authorizedLimit;
    return { ok: true, matter: dutyMatter(task, ch), decision: copy(row.transferDecision) };
  }
  function createDutyMatter(actor, data, human) {
    var g = root.GM, d = data || {}, actionId = key(d.actionId);
    if (!actor || !actionId) return ledger().result('blocked', 'duty_matter_action_required');
    if (human === true && (!TM.PoliticalActions || !TM.PoliticalActions.controlled || !TM.PoliticalActions.controlled(actor, g))) return ledger().result('blocked', 'trusted_player_identity_required');
    var refs = list(d.sourceRefs || d.materialRefs).map(dutyRef).filter(Boolean);
    if (!refs.length) return ledger().result('blocked', 'duty_material_reference_required');
    var material = dutyRecord(refs[0], g), purpose = key(d.purpose || d.intent), amount = Number(d.amount);
    if (!material || !dutyVisible(actor, material, { organizationId: d.organizationId || material.row.organizationId || material.row.factionId })) return ledger().result('blocked', 'duty_material_not_readable');
    var factStatus = key(material.row.factStatus || material.row.status || 'unknown');
    if (!purpose || !isFinite(amount) || amount <= 0 || amount !== Math.floor(amount)) return ledger().result('blocked', 'duty_matter_terms_invalid');
    var org = key(d.organizationId || material.row.organizationId || material.row.factionId);
    if (!org) return ledger().result('blocked', 'duty_organization_required');
    var subjectId = key(d.subjectId || material.row.subjectId || material.row.objectId || material.row.beneficiaryId);
    if (!subjectId) return ledger().result('blocked', 'duty_subject_required');
    var fromAccount = key(d.fromAccount || material.row.fromAccount || material.row.sourceAccount), toAccount = key(d.toAccount || material.row.toAccount || material.row.destinationAccount);
    var requestFingerprint = JSON.stringify({ actorId: actor.id, organizationId: org, subjectId: subjectId, purpose: purpose, amount: amount, fromAccount: fromAccount, toAccount: toAccount, sourceRefs: refs });
    if (!Array.isArray(g._npcDutyMatters)) g._npcDutyMatters = []; // arch-ok: sourced duty-matter producer owns its request collection
    var prior = g._npcDutyMatters.find(function (row) { return row && row._requestActionId === actionId; });
    if (prior) {
      if (prior.requestFingerprint && prior.requestFingerprint !== requestFingerprint) return ledger().result('blocked', 'duty_matter_action_conflict');
      return ledger().result('submitted', '事项依据已存在', [{ kind: 'duty_matter', id: prior.id, actionId: actionId }], { duplicate: true, matterId: prior.id });
    }
    var row = { id: 'duty-matter:' + String(g.sid || g._campaignId || 'world') + ':' + actionId, kind: 'duty_matter', version: 1, status: 'open', public: false, visibility: 'participants', knownTo: [actor.id],
      organizationId: org, subjectId: subjectId, title: key(d.title || purpose), purpose: purpose, sourceRefs: refs, requestedBy: actor.id, fromAccount: fromAccount, toAccount: toAccount,
      sourceRefsState: 'submitted', submittedBy: actor.id, submittedFactStatus: factStatus || 'unknown', requestFingerprint: requestFingerprint,
      requestedAmount: amount, requestedTransfer: { resource: 'money', requestedAmount: amount, requestedMaxMoney: amount, allowPartial: d.allowPartial === true, status: 'requested', fromAccount: fromAccount, toAccount: toAccount },
      createdDay: currentDay(), _requestActionId: actionId };
    g._npcDutyMatters.push(row); // arch-ok: sourced duty-matter producer owns its request collection
    if (!Array.isArray(g._npcDutyMatterReceipts)) g._npcDutyMatterReceipts = []; // arch-ok: sourced duty-matter receipt index owner
    g._npcDutyMatterReceipts.push({ id: actionId, matterId: row.id, actorId: actor.id, turn: Number(g.turn || 0), sourceRefs: copy(refs) }); // arch-ok: sourced duty-matter receipt index owner
    return ledger().result('submitted', '事项依据已登记，待有权承办人受理', [{ kind: 'duty_matter', id: row.id, actionId: actionId }], { matterId: row.id });
  }
  function dutyChoice(p, ch, view) {
    var task = p && (p.remainingTask || p.task) || {}, assignment = dutyAssignments(ch, task), material = dutyMaterial(task, ch, assignment[0]), action = {
      actorId: ch.id, name: ch.name, behaviorType: 'office_duty', planId: p.id,
      targetId: p.actorId === ch.id ? p.targetId : p.actorId, target: p.actorId === ch.id ? p.target : p.actor,
      organizationId: p.organizationId || task.organizationId, actingPositionId: p.performerPositionId || task.performerPositionId || '',
      appointmentId: p.performerAppointmentId || task.performerAppointmentId || '', intent: p.intent, expectedRevision: view && view.revision,
      termsVersion: view && view.termsVersion, dutyRequest: true, basis: copy(task.basis || task.requestBasis)
    };
    if (!view || !view.nextPhase) return null;
    if (view.nextPhase === 'respond' && ch.id === p.targetId) {
      if (!assignment.length) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'respond', response: 'reject', content: '此项公库事项不在我当前有效的经管权限内，不能冒领承办。' });
      var pendingMatter = dutyMatter(task, ch);
      if (pendingMatter.ok && pendingMatter.pendingPolicy) {
        var pendingMaterial = dutyMaterial(task, ch, assignment[0], { allowPendingPolicy: true });
        if (!pendingMaterial.ok) {
          if (/duty_material_not_related|duty_material_unverified|duty_material_not_readable|duty_material_not_found/.test(pendingMaterial.reason)) return Object.assign(action, { phase: 'respond', response: 'conditions', content: '事项已收到，但附件尚未证明与本用途相关；请补充或更正材料。', terms: '需要可核验的事项材料', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
          return Object.assign(action, { phase: 'respond', response: 'reject', content: '当前事项不能在本职有效范围内办理：' + pendingMaterial.reason + '。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
        }
        if (!dutyDecisionScope(assignment[0], task)) return Object.assign(action, { phase: 'respond', response: 'reject', content: '本人可以执行已成立的拨付，但没有这类新事项的决定权限。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
        return Object.assign(action, { phase: 'respond', response: 'accept', content: '已收到事项依据，按本职有效裁量范围作出本次拨付决定。', terms: '依据现行职任额度核定', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, authorizeMatter: true });
      }
      if (!material.ok) {
        if (material.reason === 'public_account_material_shortfall' && material.available > 0 && material.allowPartial) {
          var revised = Object.assign({}, task, { amounts: Object.assign({}, task.amounts, { money: Math.floor(material.available) }), preserveOriginal: true });
          return Object.assign(action, { phase: 'respond', response: 'conditions', task: revised, terms: '当前可核余额不足，且事项允许分阶段办理，最多先办' + revised.amounts.money + '贯。', content: '已核对来源账户、事项材料和分阶段规则，提出缩减为可执行范围。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, decisionBasis: material.evidence && material.evidence.facts });
        }
        if (/duty_material_reference_required|duty_material_not_found_or_stale|duty_material_not_readable|duty_material_not_related|duty_material_unverified/.test(material.reason)) {
          return Object.assign(action, { phase: 'respond', response: 'conditions', content: '已收到事项，但还缺少可读取、可核对的材料；请补充材料来源或确认当前版本后再决定。', terms: '需要补充材料', needsMaterial: true, actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
        }
        return Object.assign(action, { phase: 'respond', response: 'reject', content: '已核对事项范围与现有账目，但当前条件不能支持这笔公库转移：' + material.reason + '。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId });
      }
      var stress = Math.max(0, Math.min(100, Number(ch.stress || 0))), basis = material.evidence && material.evidence.facts || {};
      if (stress >= 90 && !(task.basis && finite(task.basis.deadlineDay) && Number(task.basis.deadlineDay) <= currentDay() + 1)) {
        return Object.assign(action, { phase: 'respond', response: 'defer', content: '事项材料和权限已核对，但当前承办负担过重，暂缓至下一办理时段。', terms: '待下一办理时段复核', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, decisionBasis: basis });
      }
      return Object.assign(action, { phase: 'respond', response: 'accept', content: '已核对事项依据、材料版本、用途范围、来源账户与当前余额，按本职承办。', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, decisionBasis: basis });
    }
    if (view.nextPhase === 'agree' && ch.id === p.actorId) {
      var proposed = p.proposedTask || task, refs = list((proposed.basis || task.basis || {}).sourceRefs || (proposed.basis || task.basis || {}).materialRefs);
      if (!refs.length) refs = dutyRefs(proposed, dutyMatter(proposed, ch).record);
      if (p.requiresRevisedTask && !p.proposedTask) return Object.assign(action, { phase: 'agree', response: 'reject', content: '当前条件变化但没有形成可核对的新任务版本，暂不接受。' });
      if (!refs.length) return Object.assign(action, { phase: 'cancel', content: '本人没有可读取的材料来源，不能把陈述直接当作核验事实；本次事项结束。' });
      return Object.assign(action, { phase: 'agree', response: 'accept', task: proposed, sourceRefs: refs, basis: copy(proposed.basis || task.basis), content: p.proposedTask ? '同意按当前材料和可执行额度办理，保留原事项未完成部分。' : '已确认当前事项版本与材料来源，继续办理。' });
    }
    if (view.nextPhase === 'perform' && ch.id === p.targetId) {
      if (!assignment.length) {
        var routed = routeDutyRecipient(task, ch.id);
        if (routed && routed.actor && routed.actor.id !== ch.id) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'handoff', successorId: routed.actor.id, handoffPositionId: routed.assignments[0].positionId, handoffAppointmentId: routed.assignments[0].appointmentId, content: '当前承办资格或职责路由已变化，转交现行有效承办职位继续核办。' });
        var seat = p.performerPositionId && TM.OfficeHolderState && TM.OfficeHolderState.position(root.GM, { positionId: p.performerPositionId });
        var successor = seat && TM.OfficeHolderState.read(root.GM, seat.pos).primary;
        if (successor && successor.id !== ch.id) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'handoff', content: '原承办资格已变化，转交当前在任者继续核办。' });
        return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'cancel', content: '原承办资格已变化，当前没有可核验的接任者；事项需重新提出。' });
      }
      if (!material.ok && !(material.reason === 'public_account_material_shortfall' && material.available > 0 && material.allowPartial)) return Object.assign(action, { behaviorType: 'private_correspondence', phase: 'cancel', content: '接受后材料、权限或余额已变化，当前交割不能继续；事项需重新核办。' });
      return Object.assign(action, { phase: 'perform', actingPositionId: assignment[0].positionId, appointmentId: assignment[0].appointmentId, allowPartial: material.allowPartial === true, basis: copy(task.basis || task.requestBasis), sourceRefs: dutyRefs(task, dutyMatter(task, ch).record) });
    }
    if (view.nextPhase === 'feedback' && ch.id === p.actorId) {
      var step = arr(p.steps).filter(function (s) { return s && s.kind === 'public_transfer'; }).slice(-1)[0], paid = step && step.paid && Number(step.paid.money || 0), requested = Number((step && step.requestedTask && step.requestedTask.amounts && step.requestedTask.amounts.money) || task.amounts && task.amounts.money || 0);
      var full = finite(paid) && finite(requested) && paid >= requested && !(p.partial && p.remainingTask);
      return Object.assign(action, { phase: 'feedback', evaluation: full ? 'satisfied' : 'ack', content: full ? '已收到实际公库交割回执，金额、用途与材料范围按本事项核收。' : '已收到本阶段实际交割回执，但原事项仍有未完成部分，保留后续办理。' });
    }
    return null;
  }
  function runDutyChoices(limit) {
    var D = domain(), g = root.GM, rows = arr(g && g._npcPlans).filter(activeDutyPlan).sort(function (a, b) {
      return Number(a.updatedTurn || a.createdTurn || 0) - Number(b.updatedTurn || b.createdTurn || 0) || order(a.id, b.id);
    }), processed = 0, completed = 0, executed = 0, diagnostics = D && D.readState && D.readState();
    for (var i = 0; i < rows.length && processed < (limit || config.dutyPlansPerBatch); i++) {
      var p = rows[i], actor = p.nextActorId && actorById(p.nextActorId), view = actor && ledger().planView(p, actor);
      if (!actor || player(actor) || !view || !view.nextPhase) continue;
      var budget = D.budget(actor); if (budget.steps >= D.config.dailySteps) continue;
      var action = dutyChoice(p, actor, view); if (!action) continue;
      action.actionId = 'local-duty:' + p.id + ':' + view.nextPhase + ':' + String(g.turn);
      var receipt = ledger().ingest(action, 'local-office-duty');
      if (receipt && !/^(blocked|failed|expired|noop)$/.test(receipt.outcome)) {
        D.spend(actor, false); processed++;
        if (action.phase === 'perform' && /^(completed|partial)$/.test(receipt.outcome)) executed++;
        if (p.status === 'done') completed++;
      }
      if (diagnostics && diagnostics.diagnostics) {
        diagnostics.diagnostics.push({ source: 'office-duty:' + p.id, actorId: actor.id, planId: p.id, choice: view.nextPhase, reason: receipt && receipt.reason || '', outcome: receipt && receipt.outcome || 'blocked', turn: g.turn });
        if (diagnostics.diagnostics.length > 80) diagnostics.diagnostics.splice(0, diagnostics.diagnostics.length - 80);
      }
    }
    if (diagnostics) diagnostics.lastDutyBatch = { processed: processed, executed: executed, completed: completed, candidates: rows.length, turn: g.turn };
    return { processed: processed, executed: executed, completed: completed, candidates: rows.length };
  }
  function actorById(id) { return id && domain().person(id, root.GM); }
  function requestPublicTransfer(actor, data, human) {
    if (!actor || !data) return ledger().result('blocked', 'specific_duty_requester_required');
    var g = root.GM, basis = taskBasis(data, actor), matter = dutyMatter({ basis: basis }, actor), org = key(data.organizationId || basis.organizationId), requesterAssignment = TM.OfficeHolderState && data.actingPositionId && TM.OfficeHolderState.select(g, actor, { positionId: data.actingPositionId, appointmentId: data.appointmentId, organizationId: org });
    if (data.actingPositionId && !requesterAssignment) return ledger().result('blocked', 'specific_current_assignment_required');
    if (!basis.matterRef) return ledger().result('blocked', 'duty_matter_reference_required');
    if (!matter.ok && /not_found|version_mismatch|not_open|subject_mismatch/.test(matter.reason)) return ledger().result('blocked', matter.reason);
    var sourceView = TM.PublicTreasury && data.fromAccount && TM.PublicTreasury.getAccountView({ game: g, ref: data.fromAccount });
    org = org || key(sourceView && sourceView.factionId);
    if (!org) return ledger().result('blocked', 'duty_organization_required');
    var task = { kind: 'public_transfer', version: 1, dutyRequest: true, requestKind: 'sourced-duty', organizationId: org, fromAccount: key(data.fromAccount), toAccount: key(data.toAccount),
      amounts: Object.assign({}, data.amounts), purpose: key(data.purpose || basis.purpose), basis: Object.assign({}, basis, { organizationId: org }), allowPartial: data.allowPartial === true || basis.allowPartial === true,
      requesterPositionId: requesterAssignment && requesterAssignment.positionId || key(data.actingPositionId), requesterAppointmentId: requesterAssignment && requesterAssignment.appointmentId || key(data.appointmentId) };
    var target = data.targetId && actorById(data.targetId), route = !target && routeDutyRecipient(task, actor.id);
    if (!target && route) target = route.actor;
    if (!target) return ledger().result('waiting', 'duty_recipient_unresolved', [{ kind: 'plan', id: 'duty-route:' + org }]);
    task.targetId = target.id;
    var action = Object.assign({}, data, { actorId: actor.id, name: actor.name, targetId: target.id, target: target.name, organizationId: org, behaviorType: 'office_duty', intent: data.intent || data.purpose || basis.purpose || '办理具体公库事项', basis: task.basis, dutyRequest: true, task: task });
    if (!human) return ledger().ingest(action, 'local-office-duty-request');
    var handler = root.NpcBehaviorRegistry && root.NpcBehaviorRegistry._behaviors && root.NpcBehaviorRegistry._behaviors.office_duty;
    if (!handler) return ledger().result('blocked', 'office_duty_handler_unavailable');
    return ledger().executeHuman(actor, action, { _npcLease: ledger().capture() }, handler);
  }
  function renderDutyPanel() {
    var g = root.GM || {}, ch = arr(g.chars).find(function (c) { return player(c); }), hs = TM.OfficeHolderState, treasury = TM.PublicTreasury;
    if (!ch || !hs || !treasury) return '';
    var assignments = hs.activeAssignments(g, ch), matters = dutyMatterOptions(ch), knownMaterials = dutyMaterialOptions(ch), bound = treasury.getCharacterPublicAccounts({ game: g, characterId: ch.id }), accounts = (bound && bound.accounts || []).filter(function (a) { return a.exists; });
    var pending = arr(g._npcPlans).filter(activeDutyPlan).map(function (p) { return { plan: p, view: ledger().planView(p, ch) }; }).filter(function (x) { return x.view && x.view.nextPhase; });
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (x) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]; }); }
    var createMaterialOptions = knownMaterials.map(function (m) { return '<option value="' + esc(JSON.stringify({ kind: m.kind, id: m.id, version: m.version })) + '" data-org="' + esc(m.organizationId) + '" data-subject="' + esc(m.subjectId) + '" data-from="' + esc(m.fromAccount) + '" data-to="' + esc(m.toAccount) + '">' + esc(m.title) + '</option>'; }).join('');
    var createHtml = knownMaterials.length ? '<div data-office-duty-create style="margin:6px 0;padding:7px;border-top:1px solid var(--color-border-subtle)"><strong>登记新的事项依据</strong><p style="margin:4px 0;color:var(--txt-m);">选择本人已取得的材料，先登记请求；有权承办人随后决定是否形成拨付许可。</p><select data-duty-new-material aria-label="新事项材料">' + createMaterialOptions + '</select><input data-duty-new-purpose aria-label="新事项用途" placeholder="用途" style="min-width:130px"><input data-duty-new-amount type="number" min="1" step="1" value="1" aria-label="新事项金额" style="width:78px"><button class="bt bsm" data-office-duty="create-matter">登记事项</button><p data-duty-create-feedback role="status"></p></div>' : '';
    if (!matters.length && !pending.length) return createHtml ? '<div class="office-duty-panel" data-office-duty-panel style="margin:8px 0;padding:10px;border:1px solid var(--gold-500);">' + createHtml + '</div>' : '<div class="office-duty-panel" style="padding:8px;color:var(--txt-m);">当前没有你已知且允许核办的公库事项材料。</div>';
    var posOptions = '<option value="">本人提出（不代表组织）</option>' + assignments.map(function (a) { return '<option value="' + esc(a.positionId) + '" data-org="' + esc(a.organizationId) + '">' + esc(a.dept + '·' + a.pos.name) + '</option>'; }).join('');
    var matterOptions = matters.map(function (m) { return '<option value="' + esc(m.id) + '" data-kind="' + esc(m.kind) + '" data-version="' + esc(m.version) + '" data-org="' + esc(m.organizationId) + '" data-from="' + esc(m.fromAccount) + '" data-to="' + esc(m.toAccount) + '" data-amount="' + esc(m.amount) + '" data-purpose="' + esc(m.purpose) + '" data-refs="' + esc(JSON.stringify(m.sourceRefs || [])) + '">' + esc(m.title) + '</option>'; }).join('');
    var matter = matters[0] || {}, accountIds = {};
    matters.forEach(function (m) { if (m.fromAccount) accountIds[m.fromAccount] = true; if (m.toAccount) accountIds[m.toAccount] = true; });
    accounts.forEach(function (a) { accountIds[a.id] = true; });
    var accountOptions = Object.keys(accountIds).sort(order).map(function (id) { var a = accounts.find(function (x) { return x.id === id; }); return '<option value="' + esc(id) + '">' + esc(a && (a.name || a.id) || id) + '</option>'; }).join('');
    var task = { organizationId: matter.organizationId, fromAccount: matter.fromAccount, toAccount: matter.toAccount, basis: { matterRef: { kind: matter.kind, id: matter.id, version: matter.version }, sourceRefs: matter.sourceRefs } };
    var recipients = dutyRecipients(task, ch.id).map(function (x) { return x.actor; });
    var recipientOptions = recipients.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');
    var pendingHtml = pending.map(function (x) {
      var p = x.plan, v = x.view, refs = list(v.task && v.task.basis && v.task.basis.sourceRefs), materialOptions = knownMaterials.map(function (m) { var selected = refs.some(function (r) { return r && r.id === m.id && r.kind === m.kind; }) ? ' selected' : ''; return '<option value="' + esc(JSON.stringify({ kind: m.kind, id: m.id, version: m.version })) + '"' + selected + '>' + esc(m.title) + '</option>'; }).join('');
      var phaseLabels = { respond: '处理受理决定', agree: '确认修订条件', perform: '执行已决定事项', feedback: '反馈实际结果' };
      var positionOptions = dutyAssignments(ch, v.task || {}).map(function (a) { return '<option value="' + esc(a.positionId) + '" data-appointment="' + esc(a.appointmentId) + '">' + esc(a.dept + '·' + a.pos.name) + '</option>'; }).join('');
      var choices = v.nextPhase === 'respond' ? [['accept', '接受'], ['conditions', '要求补充'], ['defer', '暂缓'], ['reject', '拒绝']] : v.nextPhase === 'agree' ? [['accept', '同意当前版本'], ['reject', '不接受']] : v.nextPhase === 'perform' ? [['deliver', '执行并提交回执']] : [['satisfied', '确认符合'], ['ack', '确认收到']];
      var buttons = choices.map(function (c) { return '<button type="button" class="bt bsm" data-office-duty-response="' + esc(c[0]) + '" data-office-duty-plan="' + esc(p.id) + '" data-office-duty-phase="' + esc(v.nextPhase) + '" data-office-duty-revision="' + esc(v.revision) + '" data-office-duty-terms="' + esc(v.termsVersion) + '">' + esc(c[1]) + '</button>'; }).join('');
      return '<div data-office-duty-plan="' + esc(p.id) + '" style="margin:6px 0;padding:7px;border-top:1px solid var(--color-border-subtle)"><strong>待处理公库事项</strong><p>' + esc(p.intent || '具体公库事项') + ' · ' + esc(phaseLabels[v.nextPhase] || v.nextPhase) + '</p>' + ((v.nextPhase === 'respond' || v.nextPhase === 'perform') && positionOptions ? '<label>本次行事职任 <select data-office-duty-position="' + esc(p.id) + '">' + positionOptions + '</select></label>' : '') + (v.nextPhase === 'agree' ? '<label>补充或确认材料 <select multiple size="2" data-office-duty-material="' + esc(p.id) + '">' + materialOptions + '</select></label>' : '') + '<div style="display:flex;gap:5px;flex-wrap:wrap">' + buttons + '</div><p data-office-duty-plan-feedback role="status"></p></div>';
    }).join('');
    if (!matters.length) return '<div class="office-duty-panel" data-office-duty-panel style="margin:8px 0;padding:10px;border:1px solid var(--gold-500);">' + pendingHtml + createHtml + '</div>';
    return '<div class="office-duty-panel" data-office-duty-panel style="margin:8px 0;padding:10px;border:1px solid var(--gold-500);">' +
      pendingHtml + createHtml + '<strong>具体常务·公库事项</strong><p style="margin:4px 0;color:var(--txt-m);">选择已知事项和材料；承办人会核对事项版本、职责、用途范围与余额，实际执行后才产生流水。</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
      '<select data-duty-matter aria-label="事项依据">' + matterOptions + '</select><select data-duty-position aria-label="行事职任">' + posOptions + '</select><select data-duty-target aria-label="承办人">' + recipientOptions + '</select>' +
      '<select data-duty-from aria-label="来源账户">' + accountOptions + '</select><span>→</span><select data-duty-to aria-label="目标账户">' + accountOptions + '</select>' +
      '<input data-duty-amount type="number" min="1" step="1" value="' + esc(matter.amount || 1) + '" aria-label="金额" style="width:78px"><input data-duty-purpose aria-label="用途" value="' + esc(matter.purpose) + '" placeholder="用途" style="min-width:130px">' +
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
    var started = Date.now(), summary = { processed: 0, candidates: 0, decisions: 0, messages: 0, completed: 0, apiCalls: 0, dutySubmitted: 0, dutyExecuted: 0, dutyCompleted: 0, dutyWaiting: 0 };
    try {
      D.withIndex(function () {
        var dutyDoneBefore = arr(root.GM._npcPlans).filter(function (p) { return p && p.task && p.task.kind === 'public_transfer' && p.status === 'done'; }).length;
        var dutyBatch = runDutyChoices(config.dutyPlansPerBatch);
        summary.dutySubmitted = dutyBatch.processed;
        summary.dutyExecuted = dutyBatch.executed;
        summary.dutyCompleted = dutyBatch.completed;
        summary.dutyWaiting = Math.max(0, dutyBatch.candidates - dutyBatch.processed);
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
        summary.dutyCompleted += Math.max(0, arr(root.GM._npcPlans).filter(function (p) { return p && p.task && p.task.kind === 'public_transfer' && p.status === 'done'; }).length - dutyDoneBefore);
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
        return goal && /^(greeting|introduction|assistance|meeting|consultation)$/.test(goal.kind) && goal.status !== 'cancelled';
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
    requestPublicTransfer: requestPublicTransfer, createDutyMatter: createDutyMatter, authorizeDutyMatter: authorizeDutyMatter, renderDutyPanel: renderDutyPanel, runDutyChoices: runDutyChoices,
    dutyEvidence: dutyEvidence, dutyMatter: dutyMatter, dutyMatterOptions: dutyMatterOptions, dutyAssignments: dutyAssignments };
  if (root.GameHooks) root.GameHooks.on('enterGame:after', scheduleEntry, 60);
})(typeof window !== 'undefined' ? window : globalThis);
