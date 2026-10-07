// Ordinary private activities share the NPC ledger, plans, messages and memories.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  TM.NPC = TM.NPC || {};
  var issued = new WeakSet();
  var inlineDeliveries = new WeakSet();
  var readIndex = null;
  var config = Object.freeze({ maxMaterials: 6, maxMaterialChars: 2400, dailyStarts: 1, dailySteps: 10, contactCooldownDays: 7, timeoutDays: 30, maxDeferrals: 2 });
  function game() { return root.GM; }
  function ledger() { return TM.NPC.ActionLedger; }
  function rows(v) { return Array.isArray(v) ? v : []; }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function order(a, b) { a = text(a); b = text(b); return a < b ? -1 : a > b ? 1 : 0; }
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function id(v) { return text(v && v.id); }
  function person(key, g) {
    g = g || game();
    if (readIndex && readIndex.game === g && readIndex.chars === g.chars) { var found = readIndex.ids.get(text(key)); return found && found.length === 1 ? found[0] : null; }
    return ledger().findChar({ id: text(key) }, g);
  }
  function alive(ch) { return !!ch && ch.alive !== false && ch.dead !== true; }
  function controlled(ch, g) { return !!(TM.PoliticalActions && TM.PoliticalActions.controlled(ch, g || game())); }
  function day(g) {
    g = g || game();
    if (TM.SimTime && TM.SimTime.read(g)) return TM.SimTime.now(g);
    if (g === game() && typeof root.getCurrentGameDay === 'function') return Number(root.getCurrentGameDay());
    if (TM.TaxPolicy) return TM.TaxPolicy.now(g);
    return Math.max(0, Number(g.turn || 1) - 1) * Number((g.time || {}).daysPerTurn || (root.P && root.P.time || {}).daysPerTurn || 30);
  }
  function signature(value) {
    if (TM.PoliticalActions) return TM.PoliticalActions.signature(value);
    if (Array.isArray(value)) return '[' + value.map(signature).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (k) { return JSON.stringify(k) + ':' + signature(value[k]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function result(status, reason, refs, extra) { return ledger().result(status, reason, refs, extra); }
  function isPlan(p) { return !!(p && p.version === 2 && p.localActivity && p.localActivity.schemaVersion === 1); }
  function supportedDefinition(a) { return !!(a && (a.definitionVersion === 1 || a.definitionVersion === 2)); }
  var consultationTopics = {
    letter_style: {
      id: 'letter_style', title: '文书表达',
      question: '怎样把这次往来写得有礼而不让对方误会成命令？',
      explain: '先说明来意和可拒绝的边界，再写明只求赐复，不以品级压人。',
      questionReply: '我先说我的理解：应把请求写成可选择的答复，而不是预设对方必须承诺。',
      counter: '若已有约定，仍应写出本次条件，不能让旧往来替新承诺背书。',
      questionPrompt: '你先说说，怎样把这次请求写成可选择的答复？',
      answer: '我理解应先说清来意，再给对方明确的拒绝余地，不能把品级写成必须答应的理由。',
      uncertain: '我只能先确认，不能把礼貌用语直接当成对方已经同意。',
      followUpQuestion: '如果对方已经知道来意，哪一项边界仍应在这次文书中重新写明？',
      followUpAnswer: '仍应写明本次请求的范围与可拒绝之处，旧日来往不能代替新的同意。'
    },
    reading_understanding: {
      id: 'reading_understanding', title: '阅读理解',
      question: '如何分清材料中的已知事实、本人陈述和仍待确认之处？',
      explain: '先分出文书记录的事实、当事人的陈述和尚待核验之处；不要把陈述直接当成事实。',
      questionReply: '我先说我的理解：应把来源与时间列出，再问对方还有哪一段未核。',
      counter: '若材料只有单一来源，仍不能把它视为完整结论；可先列出缺口。',
      questionPrompt: '你先说说，材料中的哪一部分仍不能直接当成已核实事实？',
      answer: '我理解，材料中的本人陈述和还没有交叉来源的段落，都只能先列为待确认。',
      uncertain: '我只能先指出来源和时间还不完整，不能替材料补出没有写明的事实。',
      followUpQuestion: '如果只有一份转述，下一步最应该补哪一种来源或说明？',
      followUpAnswer: '应补上直接来源或明确说明是谁在何时转述，仍不能把转述本身当作亲见。'
    }
  };
  function topicInfo(topicId) { return consultationTopics[text(topicId)] || null; }
  function plans(g) { return rows((g || game())._npcPlans).filter(isPlan); }
  function get(key, g) { var found = plans(g).filter(function (p) { return p.id === key; }); return found.length === 1 ? found[0] : null; }
  function terminal(p) { return /^(done|rejected|cancelled|expired)$/.test(p.status); }
  function readState(g) { return (g || game())._npcActionState && (g || game())._npcActionState.localDaily; }
  function withIndex(fn) {
    var g = game(), previous = readIndex;
    var index = { game: g, chars: g.chars, ids: new Map(), names: new Map(), neighbours: new Map() };
    rows(g.chars).forEach(function (ch) {
      if (!index.ids.has(id(ch))) index.ids.set(id(ch), []); index.ids.get(id(ch)).push(ch);
      if (!index.names.has(ch.name)) index.names.set(ch.name, []); index.names.get(ch.name).push(id(ch));
    });
    function link(a, b) { if (!index.neighbours.has(a)) index.neighbours.set(a, new Set()); index.neighbours.get(a).add(b); }
    Object.keys(g.affinityMap || {}).forEach(function (key) {
      var pair = key.split('|'), a = index.names.get(pair[0]), b = index.names.get(pair[1]);
      if (pair.length === 2 && a && b && a.length === 1 && b.length === 1) { link(a[0], b[0]); link(b[0], a[0]); }
    });
    readIndex = index;
    try { return fn(index); } finally { readIndex = previous; }
  }
  function migrate(g) {
    g = g || game();
    if(rows(g._npcPlans).some(function(p){return p&&p.localActivity&&(p.localActivity.schemaVersion!==1||!supportedDefinition(p.localActivity));}))return {ok:false,reason:'unsupported_daily_activity_definition'};
    if (readState(g)) return readState(g).version === 1 ? { ok: true } : { ok: false, reason: 'unsupported_daily_activity_version' };
    var guard = TM.AIChange && TM.AIChange.WriteGuards;
    if (!guard || g !== game()) return { ok: false, reason: 'daily_atomic_world_required' };
    return guard.runAtomicMutation(function () {
      ledger().migrate(g);
      g._npcActionState.localDaily = { version: 1, actors: {}, cooldowns: {}, schedule: {}, cursor: '', diagnostics: [] };
      return { ok: true };
    });
  }
  function budget(ch, g) {
    g = g || game(); var st = readState(g), b = st && st.actors[id(ch)];
    // Budget is keyed by the committed simulation day, not by an arbitrary
    // render or the current turn number. A 30-day turn grants one interval,
    // while changing the setting without advancing time grants nothing.
    var now = day(g);
    now = Math.floor(now);
    return b && (b.periodStartDay === now || b.periodStartDay == null && b.turn === g.turn) ? b : { turn: g.turn, day: now, periodStartDay: now, starts: 0, steps: 0 };
  }
  function spend(ch, start) {
    var st = readState(), b = copy(budget(ch));
    if (b.steps >= config.dailySteps || start && b.starts >= config.dailyStarts) return false;
    b.steps++; if (start) b.starts++; st.actors[id(ch)] = b; return true;
  }
  function exactLocation(ch, g) {
    if (!ch || ch._missing || ch.missing || ch._imprisoned || ch.imprisoned || text(ch._travelTo) || ch._travel === true || ch._travel && ch._travel.status === 'traveling' || ch.traveling || ch.travelStatus === 'traveling') return null;
    var location = root.TMMapLocations && root.TMMapLocations.read(ch, 'character', g || game());
    if (location) return location.status === 'resolved' && location.precision === 'region' ? location.regionId : null;
    // Legacy explicit IDs may be used only against an actual leaf in this world.
    var key = ch.locationId || ch.regionId, map = (g || game()).mapData || (g || game()).map;
    var region = key && rows(map && map.regions).filter(function (r) { return r.id === key; });
    return region && region.length === 1 && !rows(region[0].children).length && !region[0].isArea ? key : null;
  }
  function canDeliver(from, to, g) {
    if (!alive(from) || !alive(to)) return false;
    var a = exactLocation(from, g), b = exactLocation(to, g);
    return !!a && a === b;
  }
  function knownIds(ch, g) {
    g = g || game(); var set = new Set([id(ch)]), cached = readIndex && readIndex.game === g && readIndex.chars === g.chars ? readIndex : null;
    var uniqueNames = cached ? cached.names : new Map();
    if (!cached) rows(g.chars).forEach(function (c) { if (!uniqueNames.has(c.name)) uniqueNames.set(c.name, []); uniqueNames.get(c.name).push(c.id); });
    function name(n) { var hit = uniqueNames.get(text(n)); if (hit && hit.length === 1) set.add(text(hit[0])); }
    if (cached) rows(Array.from(cached.neighbours.get(id(ch)) || [])).forEach(function (v) { set.add(v); });
    else Object.keys(g.affinityMap || {}).forEach(function (key) {
      var pair = key.split('|'); if (pair.length !== 2 || !uniqueNames.has(ch.name) || uniqueNames.get(ch.name).length !== 1) return;
      if (pair[0] === ch.name) name(pair[1]); if (pair[1] === ch.name) name(pair[0]);
    });
    rows(ch._eventOpinions).forEach(function (o) { if (o.fromId) set.add(text(o.fromId)); else name(o.from); });
    Object.keys(ch._impressions || {}).forEach(name);
    relationshipRefs(ch).forEach(function (ref) { relationshipIds(ref, g).forEach(function (key) { set.add(key); }); });
    rows(ch._memory).concat(rows(ch._memArchive)).forEach(function (m) { name(m.who); });
    plans(g).forEach(function (p) {
      rows(p.messages).filter(function (m) { return m.fromId === id(ch) || m.toId === id(ch) && m.status === 'delivered'; }).forEach(function (m) {
        set.add(m.fromId); set.add(m.toId); rows(m.data && m.data.publicParticipants).forEach(function (v) { set.add(text(v.id)); });
      });
      var contact = p.localActivity.contact;
      if (contact && rows(contact.participants).indexOf(id(ch)) >= 0) rows(contact.participants).forEach(function (key) { set.add(key); });
    });
    return set;
  }
  function knows(ch, other, g) {
    return !!other && (knownIds(ch, g).has(id(other)) || !other.hidden && !other._hidden && !/^(private|secret|hidden)$/.test(other.visibility || '') && (other.publicIdentity === true || other.visibility === 'public'));
  }
  function relation(ch, other, g) {
    g = g || game(); var value = 0, cached = readIndex && readIndex.game === g && readIndex.chars === g.chars;
    var unique = cached ? (readIndex.names.get(ch.name) || []).length === 1 && (readIndex.names.get(other.name) || []).length === 1 : rows(g.chars).filter(function (c) { return c.name === ch.name || c.name === other.name; }).length === 2;
    if (unique && ch.name !== other.name) value += Number((g.affinityMap || {})[[ch.name, other.name].sort().join('|')] || 0);
    rows(ch._eventOpinions).forEach(function (o) { if (o.fromId ? o.fromId === id(other) : unique && o.from === other.name) value += Number(o.value || 0); });
    if (unique) value += Number((ch._impressions || {})[other.name] && ch._impressions[other.name].favor || 0);
    return Math.max(-100, Math.min(100, value));
  }
  function relationshipIds(ref, g) {
    g = g || game();
    var explicit = ref && typeof ref === 'object' && (ref.characterId != null || ref.id != null);
    var key = ref && typeof ref === 'object' ? text(explicit ? ref.characterId != null ? ref.characterId : ref.id : ref.name) : text(ref);
    if (!key) return [];
    var byId = rows(g.chars).filter(function (c) { return c && id(c) === key; });
    if (byId.length === 1) return [key];
    if (explicit || byId.length > 1) return [];
    var byName = rows(g.chars).filter(function (c) { return c && c.name === key; });
    return byName.length === 1 ? [id(byName[0])] : [];
  }
  function relationshipRefs(ch) {
    return ['fatherId','motherId','spouseId','_mentorId','mentorId'].filter(function (k) { return ch[k] != null; }).map(function (k) { return { id: ch[k] }; })
      .concat(['father','mother','spouse','mentor'].filter(function (k) { return ch[k]; }).map(function (k) { return ch[k]; }))
      .concat(rows(ch.studentsIds).map(function (key) { return { id: key }; }), rows(ch.mentees));
  }
  function relationKind(ch, other, g) {
    g = g || game(); if (!ch || !other) return 'acquaintance';
    function matches(ref) { return relationshipIds(ref, g).indexOf(id(other)) >= 0; }
    if (matches({id:ch._mentorId || ch.mentorId}) || matches(ch.mentor)) return 'teacher';
    if ([{id:ch.fatherId}, {id:ch.motherId}, {id:ch.spouseId}, ch.father, ch.mother, ch.spouse].some(function (v) { return v && matches(v); })) return 'family';
    return relation(ch, other, g) >= 24 ? 'friend' : 'acquaintance';
  }
  function contactFor(ch, other, g) {
    if (!ch || !other) return null;
    var p = plans(g).find(function (p) {
      var c = p.localActivity.contact, k = p.knowledge[id(ch)];
      return c && k && k.stage === 'done' && c.participants.indexOf(id(ch)) >= 0 && c.participants.indexOf(id(other)) >= 0;
    });
    return p ? { planId: p.id, mode: p.localActivity.contact.mode, sourceMessageId: p.localActivity.contact.sourceMessageId } : null;
  }
  function deliveredMessage(p, messageId, actorId) {
    return rows(p && p.messages).find(function (m) {
      return m && m.id === messageId && m.toId === actorId && m.status === 'delivered';
    }) || null;
  }
  function receivedDocument(p, actorId, documentId) {
    var a = p && p.localActivity;
    return rows(a && a.documents).map(function (doc) {
      var delivery = rows(p.messages).find(function (m) {
        return m && m.kind === 'delivery' && m.data && m.data.documentId === doc.id && m.toId === actorId && m.status === 'delivered';
      });
      // The delivery receipt is the durable fact.  Older saves may not have
      // carried receivedBy/status through the projection, so those fields
      // constrain the read when present but never replace the receipt.
      if (documentId && doc.id !== documentId || !delivery || doc.receivedBy != null && doc.receivedBy !== actorId || doc.status != null && !/^(received|sent)$/.test(doc.status)) return null;
      return { document: doc, delivery: delivery };
    }).find(Boolean) || null;
  }
  function consultationHistory(ch, topicId, g) {
    var key = id(ch), count = 0;
    plans(g).forEach(function (p) {
      var a = p.localActivity;
      if (a.kind === 'consultation' && p.actorId === key && a.topicId === topicId && a.result && a.result.appliedKey && a.result.reflection === 'reflect') count++;
    });
    return count;
  }
  // A caller supplied opportunity key is only a projection.  The durable
  // identity is derived from the delivered source record and the participant
  // who actually knows it, so changing a string key cannot create a second
  // opportunity for the same experience.
  function consultationSourceKey(source) {
    source = source || {};
    var kind = text(source.kind), planId = text(source.sourcePlanId), messageId = text(source.sourceMessageId), actorId = text(source.actorId);
    if (!kind || !planId || !messageId || !actorId) return '';
    return kind + ':' + planId + ':' + messageId + ':' + actorId + (kind === 'document' ? ':' + text(source.documentId) : '');
  }
  function canonicalConsultationSource(source, g) {
    source = source || {};
    var out = copy(source), canonical = consultationSourceKey(source);
    if (!canonical) return null;
    out.key = canonical;
    return out;
  }
  function consultationChannel(ch, target, g) {
    if (!target || !alive(target)) return { available: false, reason: 'recipient_unavailable' };
    if (canDeliver(ch, target, g)) return { available: true, mode: 'local' };
    return { available: false, mode: 'local', reason: 'recipient_location_unavailable' };
  }
  function consultationOpportunities(ch, g) {
    g = g || game(); if (!ch || !alive(ch)) return [];
    var actorId = id(ch), out = [], used = {};
    plans(g).forEach(function (p) {
      var a = p.localActivity, source = null, targetId = '', topicId = '', basisMessage = null;
      if (!a || p.status !== 'done') return;
      if (a.contact && rows(a.contact.participants).indexOf(actorId) >= 0) {
        targetId = rows(a.contact.participants).find(function (v) { return v !== actorId; }) || '';
        basisMessage = deliveredMessage(p, a.contact.sourceMessageId, actorId);
        var contactTarget = targetId && person(targetId, g), contactRelation = contactTarget && relation(ch, contactTarget, g), contactKind = contactTarget && relationKind(ch, contactTarget, g);
        if (targetId && basisMessage && alive(contactTarget) && knows(ch, contactTarget, g) && (contactRelation >= 20 || /^(teacher|family)$/.test(contactKind))) {
          topicId = 'letter_style';
          source = { kind: 'contact', sourcePlanId: p.id, sourceMessageId: basisMessage.id, actorId: actorId,
            knownDay: basisMessage.deliveredDay,
            basisRefs: [{ kind: 'npc_message', planId: p.id, id: basisMessage.id }] };
        }
      }
      rows(a.documents).filter(function (d) { return !!d; }).some(function (doc) {
        var receipt = receivedDocument(p, actorId, doc.id), delivery = receipt && receipt.document.id === doc.id && receipt.delivery;
        var target = person(p.targetId, g);
        // Receiving a document from the helper is itself a sourced contact;
        // do not require a pre-existing affinity/relationship entry before
        // the recipient can decide whether to continue the conversation.
        if (!delivery || !alive(target) || (!knows(ch, target, g) && delivery.fromId !== target.id)) return false;
        targetId = target.id; topicId = 'reading_understanding';
        source = { kind: 'document', sourcePlanId: p.id, sourceMessageId: delivery.id, documentId: doc.id, actorId: actorId,
          knownDay: delivery.deliveredDay,
          basisRefs: [{ kind: 'npc_message', planId: p.id, id: delivery.id }] };
        return true;
      });
      if (!source || !targetId || !topicInfo(topicId)) return;
      var target = person(targetId, g);
      // The source already proves a real contact/document channel.  Do not
      // discard the opportunity merely because the next correspondence is
      // remote or the recipient's current route is not yet available; the
      // normal message commit will perform the actual delivery check.
      if (!target) return;
      source = canonicalConsultationSource(source, g); if (!source) return;
      var channel = consultationChannel(ch, target, g);
      if (used[source.key] || plans(g).some(function (q) { return q.localActivity && q.localActivity.kind === 'consultation' && canonicalConsultationSource(q.localActivity.sourceOpportunity, g) && canonicalConsultationSource(q.localActivity.sourceOpportunity, g).key === source.key; })) return;
      used[source.key] = true;
      var topic = topicInfo(topicId);
      out.push({ source: 'opportunity:' + source.key, priority: 72 + Math.min(12, consultationHistory(ch, topicId, g) * 2),
        sendable: channel.available, waitingReason: channel.reason || '',
        reason: channel.available ? (source.kind === 'contact' ? '已实际收到引见后的来往，想就文书表达请益' : '已实际收到有来源的材料，想就阅读理解请教') : '已有值得考虑的来源，但当前接触地点尚不可用',
        action: { activityKind: 'consultation', targetId: targetId, consultation: { topicId: topic.id, question: topic.question, sourceOpportunity: source,
          preferredExchange: consultationHistory(ch, topicId, g) ? 'question' : 'explain', channel: channel } } });
    });
    return out.sort(function (a, b) { return b.priority - a.priority || order(a.source, b.source); });
  }
  function consultationBasis(activity, ch, g) {
    var source = activity && activity.sourceOpportunity, p, m, canonical;
    if (!source || source.actorId !== id(ch)) return null;
    if (!/^(contact|document)$/.test(text(source.kind))) return null;
    p = get(source.sourcePlanId, g); if (!p) return null;
    m = deliveredMessage(p, source.sourceMessageId, id(ch));
    if (!m) return null;
    canonical = canonicalConsultationSource(source, g); if (!canonical) return null;
    if (source.kind === 'document') {
      var receipt = receivedDocument(p, id(ch), source.documentId), doc = receipt && receipt.document;
      if (m.kind !== 'delivery' || !doc || doc.id !== source.documentId || !m.data || m.data.documentId !== doc.id) return null;
    } else if (source.kind === 'contact' && (!p.localActivity.contact || p.localActivity.contact.sourceMessageId !== m.id)) return null;
    return { source: canonical, message: copy(m) };
  }
  function material(ch, ref, g) {
    g = g || game(); if (!ref || !ref.kind) return null;
    var body = '', label = '', factStatus = 'received_claim', found;
    if (ref.kind === 'character_public') {
      found = person(ref.characterId, g); if (!found || !knows(ch, found, g) || found._hidden || found.visibility === 'secret') return null;
      label = '人物公开身份'; body = '姓名：' + found.name;
      if (found.publicIdentity || found.visibility === 'public') body += found.officialTitle ? '；公开身份：' + found.officialTitle : '';
      factStatus = 'public_record';
    } else if (ref.kind === 'memory') {
      if (ref.ownerId !== id(ch)) return null;
      var memories = rows(ch._memory).concat(rows(ch._memArchive)).filter(function (m) { return m.id === ref.id; });
      found = memories.length === 1 ? memories[0] : null;
      if (!found) return null; body = found.event; label = '本人已有经历'; factStatus = found.factStatus || 'personal_experience';
    } else if (ref.kind === 'npc_message') {
      var sourcePlans = rows(g._npcPlans).filter(function (p) { return p.id === ref.planId; });
      var sourceMessages = sourcePlans.length === 1 ? rows(sourcePlans[0].messages).filter(function (m) { return m.id === ref.id; }) : [];
      found = sourceMessages.length === 1 ? sourceMessages[0] : null;
      if (!found || found.fromId !== id(ch) && !(found.toId === id(ch) && found.status === 'delivered')) return null;
      body = found.content; label = '实际来往文书'; factStatus = found.kind === 'delivery' ? 'received_document' : 'received_claim';
    } else return null;
    if (!text(body) || text(body).length > config.maxMaterialChars) return null;
    return { ref: copy(ref), content: text(body), label: label, factStatus: factStatus, sharedDay: day(g), providerId: id(ch), providerName: ch.name,
      fingerprint: signature({ ref: ref, content: text(body), factStatus: factStatus }) };
  }
  function materialOptions(ch, g) {
    g = g || game(); var out = [];
    plans(g).slice().reverse().forEach(function (p) { rows(p.messages).slice().reverse().filter(function (m) { return m.kind === 'delivery' && m.toId === id(ch) && m.status === 'delivered'; }).forEach(function (m) {
      var v = material(ch, { kind: 'npc_message', planId: p.id, id: m.id }, g); if (v) out.push(v);
    }); });
    rows(ch._memory).slice(-12).reverse().forEach(function (m) { if (m.id) { var v = material(ch, { kind: 'memory', ownerId: id(ch), id: m.id }, g); if (v) out.push(v); } });
    knownIds(ch, g).forEach(function (key) { var v = material(ch, { kind: 'character_public', characterId: key }, g); if (v) out.push(v); });
    return out;
  }
  function selectMaterial(ch, task, g) {
    g = g || game(); task = task || {};
    var refs = rows(task.materialRefs).concat(rows(task.materials).map(function (m) { return m.ref; })).filter(Boolean), options = materialOptions(ch, g);
    if (refs.length) {
      var matched = options.filter(function (v) { return refs.some(function (ref) { return signature(ref) === signature(v.ref); }); });
      if (matched.length) return matched[0];
    }
    // Only structured scope can establish relevance. Readability is not
    // permission to forward a received document or an unrelated memory.
    var scope = task.materialScope;
    if (!scope || scope.kind !== 'public_identity') return null;
    return options.find(function (v) { return v.ref.kind === 'character_public' && rows(scope.characterIds).indexOf(v.ref.characterId) >= 0; }) || null;
  }
  function remember(ch, other, p, source, content, factStatus) {
    if (!ch || !root.NpcMemorySystem) return;
    var origin = p.messages.find(function (m) { return source === m.id || source === m.id + ':sent' || source === m.id + ':received'; });
    if (!origin) throw Error('daily_memory_message_source_missing');
    root.NpcMemorySystem.remember(ch.name, content, '平', 4, other && other.name || '', {
      characterId: id(ch), _noMirror: true, relationshipHandled: true, sourceId: source,
      taskId: p.id, type: 'dialogue', source: 'witnessed', factStatus: factStatus || 'personal_experience',
      sourceRefs: [{ kind: 'npc_message', planId: p.id, id: origin.id, actionId: origin.actionId || '', deliveryRefId: origin.deliveryRef && origin.deliveryRef.id || '' }]
    });
  }
  function participant(p, key) { return [p.actorId, p.targetId, p.localActivity.thirdPartyId].filter(Boolean).indexOf(key) >= 0; }
  function message(p, fromId, toId, kind, content, data, action) {
    var m = { id: 'daily-message:' + (++ledger().state(game()).sequence), sourceId: p.id, actionId: action.actionId,
      phase: action.phase, fromId: fromId, toId: toId, kind: kind, content: content, data: copy(Object.assign({}, data || {}, { expiresDay: p.localActivity.expiresDay })), channel: 'local',
      sentTurn: game().turn, sentDay: day(), deliveryDay: day(), originLocationId: exactLocation(person(fromId), game()), status: 'in_transit', termsVersion: p.localActivity.termsVersion };
    p.messages.push(m); p.status = 'in_transit'; p.nextActorId = ''; p.nextTurn = game().turn;
    p.knowledge[fromId] = { stage: 'sent', lastMessageId: m.id, termsVersion: m.termsVersion };
    remember(person(fromId), person(toId), p, m.id + ':sent', '向' + person(toId).name + '递送：' + content);
    return m;
  }

  function taskFor(ch, spec) {
    spec = spec || {}; var refs = rows(spec.materialRefs), materials = [];
    if (refs.length > config.maxMaterials || spec.kind && spec.kind !== 'material_summary') return null;
    for (var i = 0; i < refs.length; i++) { var m = material(ch, refs[i]); if (!m || rows(spec.expectedFingerprints).length && spec.expectedFingerprints[i] !== m.fingerprint) return null; materials.push(m); }
    return { kind: 'material_summary', title: text(spec.title || '整理已提供材料的简短清单'), materials: materials, materialScope: copy(spec.materialScope || null) };
  }
  function workDays(ch, task) {
    var ability = typeof root._npcAbilityProfile === 'function' ? root._npcAbilityProfile(ch) : {};
    var capacity = Math.max(1, Math.floor((Number(ability.intelligence || 50) + Number(ability.administration || 50)) / 60));
    return Math.max(0, Math.ceil((rows(task.materials).length - 2) / capacity));
  }
  function inputHash(d) {
    var out = {}; ['activityKind', 'planId', 'phase', 'actorId', 'targetId', 'thirdPartyId', 'response', 'exchangeChoice', 'expectedRevision', 'termsVersion', 'task', 'consultation', 'contactMode', 'sourceGoalId'].forEach(function (key) { if (d[key] != null) out[key] = d[key]; });
    return signature(out);
  }
  function syncShortPlan(p, phase, outcome) {
    var plan = p.localActivity && p.localActivity.shortPlan; if (!plan) return;
    var map = { request: 'request', respond: 'response', agree: 'response', perform: 'exchange', question_answer: 'answer', followup_response: 'followup', feedback: 'reflection' }, step = map[phase];
    if (step) markShortStep(p, step);
    if (/^(rejected|cancelled|expired)$/.test(p.status)) plan.current = 'ended';
    else if (p.status === 'done') plan.current = 'done';
    else if (p.nextActorId) plan.current = p.status === 'awaiting_question_answer' ? 'answer' : p.status === 'awaiting_followup_response' ? 'followup' : map[p.status === 'awaiting_feedback' ? 'feedback' : p.status === 'working' ? 'perform' : 'respond'] || plan.current;
    plan.attempts = Number(plan.attempts || 0) + 1;
    plan.lastOutcome = outcome || '';
  }
  function markShortStep(p, step) {
    var plan = p.localActivity && p.localActivity.shortPlan; if (!plan) return;
    plan.steps.forEach(function (s) { if (s.id === step) s.status = 'done'; });
  }
  function finish(p, actor, d, outcome, reason) {
    var before = p.localActivity.revision;
    p.localActivity.revision++; p.updatedTurn = game().turn;
    var step = { id: d.actionId + ':' + d.phase, actionId: d.actionId, phase: d.phase, actorId: id(actor),
      beforeRevision: before, afterRevision: p.localActivity.revision, inputHash: inputHash(d), day: day(), termsVersion: p.localActivity.termsVersion };
    p.steps.push(step); syncShortPlan(p, d.phase, outcome);
    return result(outcome, reason, [{ kind: 'daily_step', id: step.id, planId: p.id }], { planId: p.id, activityKind: p.localActivity.kind, revision: p.localActivity.revision, source: d.source });
  }
  function setNext(p, status, key) {
    p.status = status; p.nextActorId = key || ''; p.nextTurn = game().turn;
    if (key) p.knowledge[key] = Object.assign({}, p.knowledge[key] || {}, { stage: status, termsVersion: p.localActivity.termsVersion });
  }
  function requestText(kind, actor, target, third, task) {
    if (kind === 'greeting') {
      var relation = relationKind(actor, target);
      if (contactFor(actor, target)) return target.name + '：承此前引见，依约通书问候。近来可安？得便时答复即可。';
      return target.name + (relation === 'teacher' ? '：谨候起居，日后得便愿再请教。不必为此耽搁事务。' : relation === 'family' ? '：谨问起居，得便时告我安否。' : '：近来可安？得便时赐复即可。');
    }
    if (kind === 'introduction') return '想请你代向' + third.name + '询问，是否愿意与我通书。尚请先征得本人意愿。';
    if (kind === 'consultation') {
      var topic = topicInfo(task && task.topicId);
      return target.name + '：想就“' + (topic ? topic.title : '这件事') + '”请益切磋。具体问题是：' + (task && task.question || topic && topic.question || '想听你说明一个要点') + '。只占一个短时段，是否方便由你决定。';
    }
    return '想请你据所附材料整理一份清单：' + task.title + '。只须注明现有材料和来源，不必另作调查。';
  }
  function commit(actor, unused, d) {
    if (!issued.has(d)) return result('blocked', 'ordinary_activity_requires_local_choice');
    if (!game().running || game().busy || game()._endTurnBusy || game()._loadHydrationPending) return result('blocked', 'world_busy');
    var p = d.planId ? get(d.planId) : null, key = id(actor), kind = p && p.localActivity.kind || d.activityKind;
    if (kind === 'meeting' && TM.NPC.Meetings) return TM.NPC.Meetings.commit(actor, d);
    if (!/^(greeting|introduction|assistance|consultation)$/.test(kind)) return result('blocked', 'unsupported_ordinary_activity');
    if (d.planId && !p) return result('blocked', 'unknown_daily_plan');
    if (!p) {
      var target = person(d.targetId), third = kind === 'introduction' ? person(d.thirdPartyId) : null;
      if (!target || target === actor || !knows(actor, target)) return result('blocked', 'known_specific_recipient_required');
      if (kind === 'introduction' && (!third || third === actor || third === target || !knows(actor, third))) return result('blocked', 'known_distinct_third_person_required');
      var task = kind === 'assistance' ? taskFor(actor, d.task) : kind === 'consultation' ? Object.assign({}, d.consultation || {}, { topicId: text(d.consultation && d.consultation.topicId), question: text(d.consultation && d.consultation.question) }) : null;
      var consultationBasisResult = null;
      if (kind === 'consultation') {
        consultationBasisResult = consultationBasis({ sourceOpportunity: task && task.sourceOpportunity }, actor, game());
        if (!topicInfo(task.topicId) || !consultationBasisResult) return result('blocked', 'consultation_source_required');
        task.sourceOpportunity = consultationBasisResult.source;
        if (!canDeliver(actor, target, game())) return result('blocked', 'consultation_contact_unavailable');
      }
      if (kind === 'assistance' && !task) return result('blocked', 'actual_permitted_materials_required');
      if (kind === 'consultation' && !d.phase) d.phase = 'request';
      var pair = key + ':' + id(target) + ':' + kind, last = readState().cooldowns[pair];
      if (last && (last.turn === game().turn || day() < last.day + config.contactCooldownDays)) return result('blocked', 'recent_contact_cooldown');
      if (plans().some(function (x) { return !terminal(x) && x.actorId === key && x.targetId === id(target) && x.localActivity.kind === kind; })) return result('blocked', 'existing_activity_continues');
      if (!spend(actor, true)) return result('blocked', 'daily_activity_budget');
      p = { id: 'plan:' + d.actionId, version: 2, type: 'ordinary_interaction', actorId: key, actor: actor.name,
        targetId: id(target), target: target.name, createdTurn: game().turn, updatedTurn: game().turn, progress: 0,
        intent: kind === 'greeting' ? '通问与答复' : kind === 'introduction' ? '请求引见' : kind === 'consultation' ? '请益与切磋' : '请求协助整理材料',
        messages: [], steps: [], knowledge: {}, status: 'in_transit', nextActorId: '', nextTurn: game().turn,
        localActivity: { schemaVersion: 1, definitionVersion: kind === 'consultation' ? 2 : 1, kind: kind, revision: 0, termsVersion: 1,
          thirdPartyId: id(third), task: task, topicId: kind === 'consultation' ? task.topicId : '', question: kind === 'consultation' ? task.question : '',
          sourceOpportunity: kind === 'consultation' ? copy(task.sourceOpportunity) : null,
          preferredExchange: kind === 'consultation' ? text(task.preferredExchange || task.exchangeChoice || 'explain') : '',
          shortPlan: kind === 'consultation' ? { id: 'short:' + d.actionId, steps: [{ id: 'request', status: 'current' }, { id: 'response', status: 'pending' }, { id: 'exchange', status: 'pending' }, { id: 'question', status: 'pending' }, { id: 'answer', status: 'pending' }, { id: 'followup', status: 'pending' }, { id: 'reflection', status: 'pending' }], current: 'request', attempts: 0 } : null,
          createdDay: day(), expiresDay: day() + config.timeoutDays, deferrals: 0, contactMode: 'correspondence', sourceGoalId: text(d.sourceGoalId), sourceContact: contactFor(actor, target) } };
      ledger().ensurePlans(game()).push(p);
      readState().cooldowns[pair] = { day: day(), turn: game().turn, planId: p.id };
      message(p, key, p.targetId, 'request', requestText(kind, actor, target, third, task), {
        task: kind === 'consultation' ? { topicId: task.topicId, question: task.question } : task,
        consultation: kind === 'consultation' ? { topicId: task.topicId, question: task.question } : null,
        expiresDay: p.localActivity.expiresDay, sourceContact: p.localActivity.sourceContact, publicParticipants: third ? [{ id: id(third), name: third.name }] : []
      }, d);
      return finish(p, actor, d, 'submitted', '本地递话已提出，尚待送达与回应');
    }
    var activity = p.localActivity;
    if (!supportedDefinition(activity)) return result('blocked', 'activity_definition_requires_migration');
    if (!participant(p, key) || !p.knowledge[key]) return result('blocked', 'not_an_informed_participant');
    if (d.expectedRevision !== activity.revision || d.termsVersion !== activity.termsVersion) return result('expired', 'activity_or_terms_changed');
    if (terminal(p)) return result('noop', 'activity_terminal');
    if (d.phase === 'cancel') {
      if (activity.cancelSenderId === key) return result('noop', 'cancellation_already_sent');
      if (!spend(actor, false)) return result('blocked', 'daily_activity_budget');
      var oldStatus = p.status, oldNext = p.nextActorId;
      var informed = [p.actorId, p.targetId, activity.thirdPartyId].filter(function (v) { return v && v !== key && p.knowledge[v]; });
      if (!informed.length) {
        // Withdraw a request which nobody else has received. Record the withdrawal itself.
        p.messages.forEach(function (m) { if (m.fromId === key && /^(in_transit|undeliverable)$/.test(m.status)) m.status = 'withdrawn'; });
        message(p, key, key, 'cancel', '未送达的本次请求已撤回，未替任何人作出回应。', {}, d);
      }
      informed.forEach(function (v) {
        message(p, key, v, 'cancel', '此项往来暂且作罢；已经收到的文书仍予保留。', {}, d);
      });
      p.status = oldStatus; p.nextActorId = oldNext;
      p.knowledge[key] = { stage: 'cancel_sent', termsVersion: activity.termsVersion };
      activity.cancelSenderId = key;
      return finish(p, actor, d, 'submitted', '取消通知已发，其他参与者须收到后才知情');
    }
    if (p.nextActorId !== key || !p.knowledge[key]) return result('blocked', 'response_not_known_or_due');
    if (!spend(actor, false)) return result('blocked', 'daily_activity_budget');
    if (d.phase === 'respond' && /^(awaiting_response|awaiting_third)$/.test(p.status)) {
      var thirdResponse = p.status === 'awaiting_third', targetId = thirdResponse ? p.targetId : p.actorId;
      if (!/^(accept|warm|brief|reject|conditions|partial|defer)$/.test(d.response || '')) return result('blocked', 'supported_response_required');
      var answer = d.response;
      if (kind !== 'greeting' && kind !== 'consultation' && /^(warm|brief)$/.test(answer)) return result('blocked', 'unsupported_task_response');
      if (kind === 'greeting' && /^(conditions|partial)$/.test(answer) || kind === 'introduction' && answer === 'partial') return result('blocked', 'unsupported_task_response');
      if (answer === 'defer' && activity.deferrals >= config.maxDeferrals) return result('blocked', 'deferral_limit_reached');
      if (kind === 'assistance' && answer === 'accept' && !rows(activity.task.materials).length) return result('blocked', 'materials_missing');
      if (kind === 'introduction' && !thirdResponse && answer === 'accept' && !knows(actor, person(activity.thirdPartyId))) return result('blocked', 'intermediary_cannot_claim_unknown_contact');
      if (answer === 'conditions' || answer === 'partial') {
        activity.termsVersion++;
        activity.conditionByThird = thirdResponse;
        if (kind === 'consultation') activity.responseMode = 'brief';
        if (kind === 'assistance') activity.proposedTask = Object.assign({}, copy(activity.task), { materials: answer === 'partial' ? rows(activity.task.materials).slice(0, 1) : rows(activity.task.materials) });
        activity.condition = kind === 'introduction' ? '只先通书，不约面谈，也不承诺其它请托。' : kind === 'consultation' ? '可以只作简短切磋，不承诺长期授业或正式师承。' : !rows(activity.task && activity.task.materials).length ? '请先补交可使用的材料。' : '只整理当前提供的材料，不另作调查。';
      }
      if (kind === 'consultation' && /^(accept|brief)$/.test(answer)) activity.responseMode = answer;
      if (answer === 'defer') { activity.deferrals++; activity.retryDay = day() + 1; activity.retryTurn = game().turn; activity.expiresDay = Math.max(activity.expiresDay, activity.retryDay + config.timeoutDays); }
      var topic = kind === 'consultation' ? topicInfo(activity.topicId) : null;
      var body = answer === 'reject' ? '眼下不便承接此事，还望见谅。' : answer === 'defer' ? '眼下尚有安排，请容我稍后再答复。' : /conditions|partial/.test(answer) ? activity.condition : kind === 'greeting' ? answer === 'warm' ? '来问已悉，多谢挂怀。也望你诸事顺遂。' : '来问已悉，谨复。' : kind === 'consultation' ? (answer === 'brief' ? '可以在一个短时段内只谈这一个问题，仍不构成长期授业。' : '愿就这一个问题作一次短时请益，具体内容到时再说。') : thirdResponse ? '愿先通书相识；其它事项另行商议。' : kind === 'introduction' ? '愿代为转达，仍须对方自行答复。' : '愿按所附材料整理清单，交付时注明来源。';
      message(p, key, targetId, thirdResponse ? 'third_response' : 'response', body, { response: answer, task: activity.proposedTask || activity.task, topicId: activity.topicId, question: activity.question || topic && topic.question || '', condition: activity.condition || '' }, d);
      return finish(p, actor, d, 'submitted', '答复已递出，尚未替对方同意');
    }
    if (d.phase === 'agree' && p.status === 'awaiting_agreement' && key === p.actorId) {
      if (!/^(accept|reject)$/.test(d.response || '')) return result('blocked', 'explicit_current_agreement_required');
      var revised = activity.proposedTask;
      if (kind === 'assistance' && d.task) { revised = taskFor(actor, d.task); if (!revised) return result('blocked', 'actual_permitted_materials_required'); }
      if (kind === 'assistance' && d.response === 'accept' && !rows(revised && revised.materials).length) return result('blocked', 'materials_missing');
      if (kind === 'assistance' && d.response === 'accept' && d.task && signature(revised) !== signature(activity.proposedTask)) {
        activity.termsVersion++; activity.proposedTask = revised;
        message(p, key, p.targetId, 'task_revision', '已补充这次拟使用的材料，请核对当前任务后再决定是否承接。', { task: revised }, d);
        return finish(p, actor, d, 'submitted', '补充材料已递出，协助者须重新决定');
      }
      activity.proposedTask = revised;
      message(p, key, activity.conditionByThird ? activity.thirdPartyId : p.targetId, 'agreement', d.response === 'accept' ? '同意本次已说明的条件。' : '这次条件尚不合适，暂且作罢。', { response: d.response, task: revised }, d);
      return finish(p, actor, d, 'submitted', '当前条件的选择已递出');
    }
    if (d.phase === 'forward' && p.status === 'ready_forward' && key === p.targetId) {
      var third = person(activity.thirdPartyId);
      if (!third || !knows(actor, third)) return result('blocked', 'intermediary_contact_unavailable');
      message(p, key, id(third), 'introduction_offer', person(p.actorId).name + '托我询问：你是否愿意先与其通书？是否接受由你决定。', { publicParticipants: [{ id: p.actorId, name: person(p.actorId).name }] }, d);
      return finish(p, actor, d, 'submitted', '引见询问已转达，对方尚未同意');
    }
    if (d.phase === 'report' && p.status === 'ready_report' && key === p.targetId) {
      var response = activity.thirdResponse;
      if (!response || response.termsVersion !== activity.termsVersion) return result('blocked', 'current_third_response_required');
      message(p, key, p.actorId, 'introduction_result', response.response === 'accept' ? '对方已答复，愿先与你通书。此次并未安排会面。' : response.response === 'reject' ? '对方这次未接受引见，暂且作罢。' : response.response === 'defer' ? '对方请稍后再议，目前还未同意。' : response.condition, { response: response.response, condition: response.condition }, d);
      return finish(p, actor, d, 'submitted', '仅转述实际收到的答复');
    }
    if (d.phase === 'confirm' && p.status === 'ready_confirm' && key === activity.thirdPartyId) {
      message(p, key, p.actorId, 'contact_confirmation', '已收到你对条件的确认，可以依约先行通书。', { response: 'accept' }, d);
      return finish(p, actor, d, 'submitted', '联系条件确认已递出');
    }
    if (d.phase === 'perform' && p.status === 'working' && key === p.targetId && kind === 'consultation') {
      if (day() < activity.readyDay || activity.workDays > 0 && game().turn <= activity.acceptedTurn) return result('blocked', 'consultation_time_not_reached');
      var consultation = topicInfo(activity.topicId), exchangeChoice = text(d.exchangeChoice || 'explain');
      if (!consultation || !/^(explain|question|counter)$/.test(exchangeChoice)) return result('blocked', 'consultation_choice_required');
      var exchangeContent = exchangeChoice === 'counter' ? consultation.counter : consultation.explain;
      var questionPrompt = consultation.question === activity.question ? consultation.questionPrompt : '你先说说，如何理解“' + activity.question + '”？';
      activity.exchange = { topicId: consultation.id, choice: exchangeChoice, content: exchangeChoice === 'question' ? questionPrompt : exchangeContent, day: day(), actorId: key,
        sourceRefs: copy(activity.sourceOpportunity && activity.sourceOpportunity.basisRefs || []) };
      if (exchangeChoice === 'question') {
        message(p, key, p.actorId, 'consultation_question', questionPrompt, { topicId: consultation.id, question: activity.question, choice: exchangeChoice }, d);
        return finish(p, actor, d, 'submitted', '已提出一个具体理解问题，等待对方独立回答');
      }
      message(p, key, p.actorId, 'consultation_exchange', exchangeContent, { topicId: consultation.id, question: activity.question, choice: exchangeChoice }, d);
      return finish(p, actor, d, 'submitted', '已完成一次有具体话题的请益内容，待本人反馈');
    }
    if (d.phase === 'perform' && p.status === 'working' && key === p.targetId && kind === 'assistance') {
      if (day() < activity.readyDay || activity.workDays > 0 && game().turn <= activity.acceptedTurn) return result('blocked', 'work_date_not_reached');
      var sources = rows(activity.task.materials);
      if (!sources.length) return result('blocked', 'materials_missing');
      // Sources are the explicitly shared snapshots actually received with this agreement.
      var body = activity.task.title + '\n' + sources.map(function (s, n) { return (n + 1) + '、' + s.label + '：' + s.content + '\n来源：' + s.providerName + '于第' + s.sharedDay + '日提供的' + s.label; }).join('\n') + '\n仅据提供时的现有材料整理，未作额外调查。';
      var document = { id: 'daily-document:' + d.actionId, actionId: d.actionId, authorId: key, taskVersion: activity.termsVersion,
        content: body, sources: copy(sources), createdDay: day(), createdTurn: game().turn, status: 'formed' };
      activity.documents = rows(activity.documents).concat([document]);
      message(p, key, p.actorId, 'delivery', body, { documentId: document.id, sources: document.sources, taskVersion: activity.termsVersion }, d);
      document.status = 'sent';
      return finish(p, actor, d, 'submitted', '已形成并递送有来源的清单，尚待收件');
    }
    if (d.phase === 'question_answer' && p.status === 'awaiting_question_answer' && key === p.actorId && kind === 'consultation') {
      var questionTopic = topicInfo(activity.topicId), answerChoice = text(d.response || 'answer');
      if (!questionTopic || !/^(answer|uncertain)$/.test(answerChoice) || !activity.exchange || activity.exchange.choice !== 'question') return result('blocked', 'consultation_question_missing');
      var answerContent = answerChoice === 'uncertain' ? questionTopic.uncertain : questionTopic.answer;
      activity.questionAnswer = { topicId: questionTopic.id, response: answerChoice, content: answerContent, day: day(), actorId: key, questionId: activity.exchange.receivedMessageId || '' };
      message(p, key, p.targetId, 'consultation_question_answer', answerContent, { topicId: questionTopic.id, question: activity.exchange.content, response: answerChoice }, d);
      return finish(p, actor, d, 'submitted', '已针对对方提出的问题作答，等待对方收到');
    }
    if (d.phase === 'followup_response' && p.status === 'awaiting_followup_response' && key === p.targetId && kind === 'consultation') {
      var followTopic = topicInfo(activity.topicId), followChoice = text(d.response || 'answer'), follow = activity.followUp;
      if (!followTopic || !follow || follow.status !== 'awaiting_response' || !/^(answer|decline|defer)$/.test(followChoice)) return result('blocked', 'consultation_followup_missing');
      if (followChoice === 'defer') {
        if (Number(follow.deferrals || 0) >= 1) return result('blocked', 'consultation_followup_defer_limit');
        follow.deferrals = Number(follow.deferrals || 0) + 1; follow.retryDay = day() + 1; follow.retryTurn = game().turn;
        activity.retryDay = follow.retryDay; activity.retryTurn = follow.retryTurn; activity.retryActorId = p.targetId; activity.retryPhase = 'followup_response';
        setNext(p, 'deferred', '');
        message(p, key, p.actorId, 'consultation_followup_response', '这一个追问暂待稍后再答，请容我有暇时再复。', { topicId: followTopic.id, response: followChoice, followUpId: follow.id }, d);
        return finish(p, actor, d, 'submitted', '追问已收到延期答复，待约定时间再议');
      }
      var followContent = followChoice === 'decline' ? '这一个追问眼下不便再答，先请依已说明的范围办理。' : followTopic.followUpAnswer;
      follow.response = { choice: followChoice, content: followContent, day: day(), actorId: key };
      follow.status = 'answered';
      message(p, key, p.actorId, 'consultation_followup_response', followContent, { topicId: followTopic.id, response: followChoice, followUpId: follow.id }, d);
      return finish(p, actor, d, 'submitted', '追问已作出独立答复，等待请益者确认');
    }
    if (d.phase === 'feedback' && p.status === 'awaiting_feedback' && key === p.actorId && kind === 'consultation') {
      var reflection = text(d.response || 'ack');
      if (!/^(reflect|ask|ack)$/.test(reflection)) return result('blocked', 'consultation_feedback_required');
      var exchanged = activity.exchange, topicDone = topicInfo(activity.topicId);
      if (!exchanged || !topicDone) return result('blocked', 'consultation_exchange_missing');
      if (reflection === 'ask') {
        if (activity.followUp) return result('blocked', 'consultation_followup_already_used');
        activity.followUp = { id: p.id + ':followup:1', question: topicDone.followUpQuestion, topicId: topicDone.id, status: 'awaiting_response', count: 1, deferrals: 0, createdDay: day(), actorId: p.actorId, targetId: p.targetId,
          sourceExchangeId: activity.exchange.receivedMessageId || activity.exchange.sourceMessageId || '' };
        message(p, key, p.targetId, 'consultation_followup_request', topicDone.followUpQuestion, { topicId: topicDone.id, question: topicDone.followUpQuestion, followUpId: activity.followUp.id }, d);
        return finish(p, actor, d, 'submitted', '已提出一个具体追问，等待对方独立决定是否回答');
      }
      var summary = reflection === 'reflect' ? '已将本次要点与自己的理解对照，形成一次有来源的个人心得。' : '已确认收到本次说明，暂不继续追问。';
      if (activity.followUp && activity.followUp.status === 'answered') summary += activity.followUp.response.choice === 'decline' ? ' 对方已说明暂不再答，当前问题到此为止。' : ' 对方已针对追问补充说明。';
      activity.result = { topicId: topicDone.id, summary: summary, reflection: reflection, exchangeChoice: exchanged.choice,
        sourceRefs: copy(exchanged.sourceRefs || []), questionAnswer: copy(activity.questionAnswer || null), followUp: copy(activity.followUp || null), appliedKey: p.id + ':consultation-result:' + activity.termsVersion, day: day(), actorId: key };
      if (root.CharacterGrowthSystem && typeof root.CharacterGrowthSystem.recordExperience === 'function') {
        root.CharacterGrowthSystem.recordExperience(actor.name, '请益·' + topicDone.id, '与' + person(p.targetId).name + '切磋：' + exchanged.content);
      }
      if (root.OpinionSystem && reflection === 'reflect') root.OpinionSystem.addEventOpinion(actor, person(p.targetId), 1, '一次有具体内容的请益切磋', { sourceId: activity.result.appliedKey });
      var publicResult = copy(activity.result); delete publicResult.sourceRefs;
      message(p, key, p.targetId, 'consultation_feedback', summary, { topicId: topicDone.id, reflection: reflection, result: publicResult }, d);
      return finish(p, actor, d, 'completed', '请益切磋已结束，心得与后续倾向已记录');
    }
    if (d.phase === 'feedback' && p.status === 'awaiting_feedback' && key === p.actorId) {
      if (!/^(ack|satisfied|supplement)$/.test(d.response || '')) return result('blocked', 'supported_feedback_required');
      var supplement = d.response === 'supplement' ? taskFor(actor, d.task || {}) : null;
      if (d.response === 'supplement' && (!supplement || !supplement.materials.length)) return result('blocked', 'specific_supplement_materials_required');
      if (supplement) { activity.termsVersion++; activity.proposedTask = supplement; }
      if (d.response === 'satisfied' && root.OpinionSystem) root.OpinionSystem.addEventOpinion(actor, person(p.targetId), 2, '所交清单有助于当前事项', { sourceId: p.id + ':delivery-evaluation' });
      message(p, key, p.targetId, 'feedback', supplement ? '已读收到的清单；还想请你另核这部分材料，请重新决定是否承接。' : '清单已收到，来源已阅，多谢相助。', { response: d.response, task: supplement }, d);
      return finish(p, actor, d, supplement ? 'submitted' : 'completed', supplement ? '补办请求须重新答应' : '收件者已反馈，未重复发放效果');
    }
    return result('blocked', 'daily_phase_not_available');
  }

  function submitNPC(ch, d, options) {
    var migration = migrate(); if (!migration.ok) return result('blocked', migration.reason);
    if (controlled(ch)) return result('blocked', 'player_choice_required');
    var existing = d.planId && get(d.planId);
    d = Object.assign({}, d, { activityKind: d.activityKind || existing && existing.localActivity.kind, actorId: id(ch), behaviorType: 'ordinary_interaction', source: 'daily-local' });
    issued.add(d);
    if (options && options.inlineDelivery === true) inlineDeliveries.add(d);
    try { return root.NpcBehaviorRegistry.execute(ch, d, { _npcLease: ledger().capture() }); }
    finally { issued.delete(d); inlineDeliveries.delete(d); }
  }
  function afterVerifiedCommit(d, receipt) {
    if (d.activityKind === 'meeting' && TM.NPC.Meetings && TM.NPC.Meetings.afterVerifiedCommit) return TM.NPC.Meetings.afterVerifiedCommit(d, receipt);
    if (!issued.has(d) || !inlineDeliveries.has(d)) return receipt;
    var p = get(receipt.planId), delivered = [];
    if (!p) throw Error('daily_inline_plan_missing');
    p.messages.slice().filter(function (m) { return m.actionId === d.actionId && m.phase === d.phase && m.status === 'in_transit' && m.deliveryDay <= day(); }).forEach(function (m) {
      var to = person(m.toId);
      if (alive(to) && m.originLocationId && m.originLocationId === exactLocation(to, game())) { receive(p, m); delivered.push(m.deliveryRef); }
      else failedDelivery(p, m);
    });
    return Object.assign({}, receipt, { revision: p.localActivity.revision, deliveryRefs: copy(delivered),
      reason: delivered.length ? '本步骤文书已送达，后续按当前事项办理。' : '本地递送未能安排，尚未取得对方回应。' });
  }
  function verifyEvidence(ref, d, actor, g, before) {
    if (!issued.has(d)) return false;
    if (d.activityKind === 'meeting' && ref.kind === 'meeting_step' && TM.NPC.Meetings && TM.NPC.Meetings.verifyEvidence) return TM.NPC.Meetings.verifyEvidence(ref, d, actor, g, before);
    if (ref.kind !== 'daily_step') return false;
    var p = get(ref.planId, g), old = get(ref.planId, before), step = p && p.steps.find(function (s) { return s.id === ref.id; });
    if (!p || !step || step.actionId !== d.actionId || step.phase !== d.phase || step.actorId !== id(actor) || step.inputHash !== inputHash(d)) return false;
    if (old && old.steps.some(function (s) { return s.id === ref.id; })) return false;
    if (step.beforeRevision !== (old ? old.localActivity.revision : 0) || step.afterRevision !== step.beforeRevision + 1 || p.localActivity.revision !== step.afterRevision) return false;
    var created = p.messages.filter(function (m) { return m.actionId === d.actionId && m.phase === d.phase; });
    if (!created.length || created.some(function (m) { return m.fromId !== id(actor) || !participant(p, m.toId) || old && old.messages.some(function (x) { return x.id === m.id; }); })) return false;
    if (d.phase === 'perform' && p.localActivity.kind === 'assistance') {
      var doc = rows(p.localActivity.documents).find(function (v) { return v.actionId === d.actionId; });
      if (!doc || doc.authorId !== id(actor) || doc.taskVersion !== p.localActivity.termsVersion || !doc.sources.length || old && rows(old.localActivity.documents).some(function (v) { return v.id === doc.id; })) return false;
      if (!created.some(function (m) { return m.kind === 'delivery' && m.data.documentId === doc.id && m.content === doc.content && signature(m.data.sources) === signature(doc.sources); })) return false;
    }
    if (d.phase === 'perform' && p.localActivity.kind === 'consultation') {
      var exchange = p.localActivity.exchange;
      if (!exchange || exchange.actorId !== id(actor) || !exchange.content || exchange.topicId !== p.localActivity.topicId || old && old.localActivity.exchange) return false;
      var exchangeKind = d.exchangeChoice === 'question' ? 'consultation_question' : 'consultation_exchange';
      if (!created.some(function (m) { return m.kind === exchangeKind && m.fromId === id(actor) && m.toId === p.actorId && m.content === exchange.content && m.data && m.data.topicId === exchange.topicId; })) return false;
    }
    if (d.phase === 'question_answer' && p.localActivity.kind === 'consultation') {
      var answer = p.localActivity.questionAnswer;
      if (!answer || answer.actorId !== id(actor) || !answer.content || answer.topicId !== p.localActivity.topicId || old && old.localActivity.questionAnswer) return false;
      if (!created.some(function (m) { return m.kind === 'consultation_question_answer' && m.fromId === id(actor) && m.toId === p.targetId && m.content === answer.content && m.data && m.data.topicId === answer.topicId; })) return false;
    }
    if (d.phase === 'followup_response' && p.localActivity.kind === 'consultation') {
      var follow = p.localActivity.followUp, followResponse = follow && follow.response;
      if (!follow) return false;
      if (d.response === 'defer') {
        if (!created.some(function (m) { return m.kind === 'consultation_followup_response' && m.fromId === id(actor) && m.toId === p.actorId && m.data && m.data.followUpId === follow.id; })) return false;
      } else {
        if (!followResponse || followResponse.actorId !== id(actor) || !followResponse.content) return false;
        if (!created.some(function (m) { return m.kind === 'consultation_followup_response' && m.fromId === id(actor) && m.toId === p.actorId && m.content === followResponse.content && m.data && m.data.followUpId === follow.id; })) return false;
      }
    }
    return true;
  }

  function beginWork(p) {
    var a = p.localActivity;
    a.workDays = a.kind === 'consultation' ? (a.responseMode === 'brief' ? 0 : 1) : workDays(person(p.targetId), a.task);
    a.acceptedTurn = game().turn; a.acceptedDay = day(); a.readyDay = day() + a.workDays;
    setNext(p, 'working', p.targetId);
  }
  function establishContact(p, m) {
    var a = p.localActivity;
    if (a.contact) return;
    a.contact = { participants: [p.actorId, a.thirdPartyId], mode: a.contactMode, sourceMessageId: m.id,
      sourceActionId: m.actionId, termsVersion: a.termsVersion, day: day(), turn: game().turn };
    setNext(p, 'done', '');
    p.knowledge[p.actorId] = { stage: 'done', lastMessageId: m.id, termsVersion: a.termsVersion };
    // The third party's own consent is known; no friendship, office or audience is created.
    p.knowledge[a.thirdPartyId] = Object.assign({}, p.knowledge[a.thirdPartyId] || {}, { stage: 'consent_given' });
    [a.thirdPartyId, p.targetId].forEach(function (key) {
      p.messages.push({ id: 'daily-message:' + (++ledger().state(game()).sequence), sourceId: p.id, sourceMessageId: m.id,
        actionId: m.actionId, phase: 'delivery_receipt', kind: 'contact_notice', authorKind: 'delivery_receipt',
        fromId: p.actorId, toId: key, content: '递话回执：本事项的同意文书已送达请求人，现有约定仅限先行通书。', data: {},
        channel: 'local', sentTurn: game().turn, sentDay: day(), deliveryDay: day(), originLocationId: exactLocation(person(p.actorId), game()),
        status: 'in_transit', termsVersion: a.termsVersion });
    });
  }
  function projectLetter(p, m) {
    var to = person(m.toId), from = person(m.fromId);
    if (!controlled(to)) return;
    if (!Array.isArray(game().letters)) game().letters = [];
    if (!game().letters.some(function (l) { return l.id === m.id; })) game().letters.push({
      id: m.id, fromId: m.fromId, toId: m.toId, from: from ? from.name : '传递记录', to: to.name,
      subjectLine: p.intent, content: m.content, sentTurn: m.sentTurn, deliveryTurn: game().turn,
      status: 'returned', letterType: 'personal', _npcInitiated: true, _playerRead: false,
      _replyExpected: false, npcPlanId: p.id, npcMessageId: m.id, _localActivity: true
    });
  }
  function receive(p, m) {
    var a = p.localActivity, to = person(m.toId), from = person(m.fromId), wasTerminal = terminal(p);
    m.status = 'delivered'; m.deliveredDay = day(); m.deliveredTurn = game().turn;
    m.deliveryRef = { id: 'daily-delivery:' + m.id, sourceMessageId: m.id, fromId: m.fromId, toId: m.toId, termsVersion: m.termsVersion };
    var reply = m.data && m.data.response;
    // Receipt is a physical fact even if a cancellation or a newer task overtook this document.
    if (m.kind === 'delivery') {
      var deliveredDocument = rows(a.documents).filter(function (x) { return x.id === m.data.documentId; });
      var doc = deliveredDocument.length === 1 && deliveredDocument[0];
      if (!doc || doc.taskVersion !== m.termsVersion || doc.content !== m.content || signature(doc.sources) !== signature(m.data.sources)) throw Error('daily_document_delivery_inconsistent');
      doc.status = 'received'; doc.receivedDay = day(); doc.receivedBy = m.toId;
    }
    if (!wasTerminal && m.termsVersion === a.termsVersion) {
      if (m.kind === 'request') setNext(p, 'awaiting_response', p.targetId);
      if (m.kind === 'response') {
        if (reply === 'reject') setNext(p, 'rejected', '');
        else if (reply === 'defer') { a.retryActorId = p.targetId; setNext(p, 'deferred', ''); }
        else if (/^(conditions|partial)$/.test(reply)) setNext(p, 'awaiting_agreement', p.actorId);
        else if (a.kind === 'greeting') setNext(p, 'done', '');
        else if (a.kind === 'introduction') setNext(p, 'ready_forward', p.targetId);
        else beginWork(p);
      }
      if (m.kind === 'agreement') {
        if (reply === 'reject') setNext(p, 'rejected', '');
        else if (a.kind === 'assistance') { a.task = copy(m.data.task); beginWork(p); }
        else if (a.kind === 'consultation') { beginWork(p); }
        else if (a.conditionByThird) setNext(p, 'ready_confirm', a.thirdPartyId);
        else setNext(p, 'ready_forward', p.targetId);
      }
      if (m.kind === 'task_revision') { a.task = copy(m.data.task); setNext(p, 'awaiting_response', p.targetId); }
      if (m.kind === 'introduction_offer') setNext(p, 'awaiting_third', a.thirdPartyId);
      if (m.kind === 'third_response') {
        a.thirdResponse = { response: reply, condition: m.data.condition, sourceMessageId: m.id, termsVersion: m.termsVersion };
        setNext(p, 'ready_report', p.targetId);
      }
      if (m.kind === 'introduction_result') {
        if (reply === 'accept') establishContact(p, m);
        else if (reply === 'reject') setNext(p, 'rejected', '');
        else if (reply === 'defer') { a.retryActorId = a.thirdPartyId; setNext(p, 'deferred', ''); }
        else setNext(p, 'awaiting_agreement', p.actorId);
      }
      if (m.kind === 'contact_confirmation') establishContact(p, m);
      if (m.kind === 'delivery') {
        setNext(p, 'awaiting_feedback', p.actorId);
      }
      if (m.kind === 'feedback') {
        if (reply === 'supplement') { a.task = copy(m.data.task); setNext(p, 'awaiting_response', p.targetId); }
        else setNext(p, 'done', '');
      }
      if (m.kind === 'consultation_exchange') {
        if (!m.data || !m.data.topicId || !topicInfo(m.data.topicId) || !m.content) throw Error('consultation_exchange_inconsistent');
        a.exchange = Object.assign({}, a.exchange || {}, { topicId: m.data.topicId, content: m.content, choice: m.data.choice, receivedDay: day(), receivedMessageId: m.id });
        setNext(p, 'awaiting_feedback', p.actorId);
      }
      if (m.kind === 'consultation_question') {
        if (!m.data || !m.data.topicId || !topicInfo(m.data.topicId) || !m.content) throw Error('consultation_question_inconsistent');
        a.exchange = Object.assign({}, a.exchange || {}, { topicId: m.data.topicId, content: m.content, choice: 'question', receivedDay: day(), receivedMessageId: m.id });
        setNext(p, 'awaiting_question_answer', p.actorId);
      }
      if (m.kind === 'consultation_question_answer') {
        if (!m.data || !m.data.topicId || !topicInfo(m.data.topicId) || !m.content) throw Error('consultation_question_answer_inconsistent');
        a.questionAnswer = Object.assign({}, a.questionAnswer || {}, { topicId: m.data.topicId, content: m.content, response: m.data.response, actorId: m.fromId, receivedDay: day(), receivedMessageId: m.id });
        setNext(p, 'awaiting_feedback', p.actorId);
      }
      if (m.kind === 'consultation_followup_request') {
        if (!m.data || !m.data.topicId || !m.data.followUpId || !m.content) throw Error('consultation_followup_inconsistent');
        a.followUp = Object.assign({}, a.followUp || {}, { id: m.data.followUpId, topicId: m.data.topicId, question: m.content, status: 'awaiting_response', receivedDay: day(), receivedMessageId: m.id });
        setNext(p, 'awaiting_followup_response', p.targetId);
      }
      if (m.kind === 'consultation_followup_response') {
        if (!m.data || !m.data.topicId || !m.data.followUpId || !m.content) throw Error('consultation_followup_response_inconsistent');
        a.followUp = Object.assign({}, a.followUp || {}, { id: m.data.followUpId, topicId: m.data.topicId, status: m.data.response === 'defer' ? 'deferred' : 'answered', response: { choice: m.data.response, content: m.content, actorId: m.fromId, receivedDay: day(), receivedMessageId: m.id } });
        if (m.data.response === 'defer') setNext(p, 'deferred', '');
        else setNext(p, 'awaiting_feedback', p.actorId);
      }
      if (m.kind === 'consultation_feedback') {
        a.result = copy(m.data && m.data.result || a.result);
        setNext(p, 'done', '');
      }
    }
    if (m.kind === 'cancel' && !wasTerminal) setNext(p, 'cancelled', '');
    p.knowledge[m.toId] = { stage: p.status, lastMessageId: m.id, termsVersion: m.termsVersion };
    if (a.shortPlan) {
      if (m.kind === 'request') markShortStep(p, 'request');
      if (m.kind === 'response' || m.kind === 'agreement') markShortStep(p, 'response');
      if (m.kind === 'consultation_exchange') markShortStep(p, 'exchange');
      if (m.kind === 'consultation_question') markShortStep(p, 'question');
      if (m.kind === 'consultation_question_answer') markShortStep(p, 'answer');
      if (m.kind === 'consultation_followup_request' || m.kind === 'consultation_followup_response') markShortStep(p, 'followup');
      if (m.kind === 'consultation_feedback') markShortStep(p, 'reflection');
      a.shortPlan.current = p.status === 'done' ? 'done' : p.status === 'working' ? 'exchange' : p.status === 'awaiting_feedback' ? 'reflection' : a.shortPlan.current;
    }
    a.revision++; p.updatedTurn = game().turn;
    remember(to, from, p, m.id + ':received', '收到' + (from ? from.name : '递话人') + '的文书：' + m.content, m.kind === 'delivery' ? 'received_document' : 'received_claim');
    projectLetter(p, m);
    if (typeof root._npcPlanningStepResult === 'function' && a.sourceGoalId) {
      root._npcPlanningStepResult(p.actorId, a.sourceGoalId, { outcome: p.status === 'done' ? 'completed' : p.status === 'rejected' ? 'rejected' : p.status === 'cancelled' ? 'cancelled' : 'waiting', reason: 'actual_message_delivered', planningOwnerId: p.actorId, verified: p.status === 'done' });
    }
  }
  function failedDelivery(p, m) {
    m.status = 'undeliverable'; m.failedTurn = game().turn;
    var receipt = { id: m.id + ':transport', sourceId: p.id, sourceMessageId: m.id, kind: 'transport', fromId: '', toId: m.fromId,
      content: '这次本地递送未能安排，尚未取得对方回应。可以取消，或待接触条件明确后另议。', data: {},
      termsVersion: m.termsVersion, sentTurn: game().turn, sentDay: day(), status: 'delivered', deliveredTurn: game().turn, deliveredDay: day() };
    p.messages.push(receipt);
    if (!terminal(p)) setNext(p, m.kind === 'cancel' ? 'cancelled' : 'waiting_contact', m.kind === 'cancel' ? '' : m.fromId);
    p.knowledge[m.fromId] = { stage: m.kind === 'cancel' ? 'cancel_not_delivered' : 'waiting_contact', lastMessageId: receipt.id, termsVersion: p.localActivity.termsVersion };
    p.localActivity.revision++;
    remember(person(m.fromId), null, p, receipt.id, receipt.content, 'delivery_status');
    projectLetter(p, receipt);
    if (typeof root._npcPlanningStepResult === 'function' && p.localActivity.sourceGoalId) {
      root._npcPlanningStepResult(p.actorId, p.localActivity.sourceGoalId, { outcome: m.kind === 'cancel' ? 'cancelled' : 'waiting', reason: 'delivery_unavailable', planningOwnerId: p.actorId, verified: false });
    }
  }
  function replyMayExpire(p) {
    // Coarse turns must not cancel accepted short work before the next safe processing point.
    if (/^(assistance|consultation)$/.test(p.localActivity.kind) && (p.status === 'working' && alive(person(p.targetId)) || p.status === 'awaiting_feedback' && alive(person(p.actorId)))) return false;
    return true;
  }
  // Called by ActionLedger.advance inside its existing synchronous atomic boundary.
  function needsAdvance(g) {
    g = g || game(); var now = day(g);
    if (TM.NPC.Meetings && TM.NPC.Meetings.needsAdvance && TM.NPC.Meetings.needsAdvance(g)) return true;
    return plans(g).some(function (p) {
      var a = p.localActivity;
      return a.kind !== 'meeting' && supportedDefinition(a) && (p.messages.some(function (m) { return m.status === 'in_transit' && m.deliveryDay <= now; }) ||
        !terminal(p) && (replyMayExpire(p) && g.turn > p.createdTurn && now >= a.expiresDay || p.status === 'deferred' && g.turn > a.retryTurn && now >= a.retryDay));
    });
  }
  function advanceWithin() {
    var delivered = 0;
    if (TM.NPC.Meetings && TM.NPC.Meetings.advanceWithin) TM.NPC.Meetings.advanceWithin();
    plans().forEach(function (p) {
      var a = p.localActivity;
      if(!supportedDefinition(a) || a.kind === 'meeting')return;
      p.messages.slice().filter(function (m) { return m.status === 'in_transit' && m.deliveryDay <= day(); }).forEach(function (m) {
        var to = person(m.toId);
        if (alive(to) && m.originLocationId && m.originLocationId === exactLocation(to, game())) { receive(p, m); delivered++; }
        else failedDelivery(p, m);
      });
      if (!terminal(p) && p.status === 'deferred' && game().turn > a.retryTurn && day() >= a.retryDay) {
        var retryStatus = a.retryPhase === 'followup_response' ? 'awaiting_followup_response' : a.retryActorId === a.thirdPartyId ? 'awaiting_third' : 'awaiting_response';
        if (a.retryPhase === 'followup_response' && a.followUp) a.followUp.status = 'awaiting_response';
        setNext(p, retryStatus, a.retryActorId); a.retryPhase = '';
        a.revision++;
      }
      if (!terminal(p) && replyMayExpire(p) && game().turn > p.createdTurn && day() >= a.expiresDay) {
        setNext(p, 'expired', ''); a.revision++;
        Object.keys(p.knowledge).forEach(function (key) {
          // Expiry is a pre-declared procedural deadline, not knowledge of another person's private reason.
          p.knowledge[key] = Object.assign({}, p.knowledge[key], { stage: 'expired' });
        });
        if (typeof root._npcPlanningStepResult === 'function' && a.sourceGoalId) {
          root._npcPlanningStepResult(p.actorId, a.sourceGoalId, { outcome: 'expired', reason: 'ordinary_activity_expired', planningOwnerId: p.actorId, verified: false });
        }
      }
    });
    return delivered;
  }
  function participantHasMessage(messages, key, kind) {
    return rows(messages).some(function (m) { return m.kind === kind && (m.fromId === key || m.toId === key && m.status === 'delivered'); });
  }
  function visibleShortPlan(a, p, key, messages) {
    if (!a.shortPlan) return null;
    var out = copy(a.shortPlan);
    out.steps = rows(out.steps).map(function (step) {
      var status = 'pending';
      if (step.id === 'request' && participantHasMessage(messages, key, 'request')) status = 'done';
      if (step.id === 'response' && (participantHasMessage(messages, key, 'response') || participantHasMessage(messages, key, 'agreement'))) status = 'done';
      if (step.id === 'exchange' && (participantHasMessage(messages, key, 'consultation_exchange') || participantHasMessage(messages, key, 'consultation_question'))) status = 'done';
      if (step.id === 'question' && participantHasMessage(messages, key, 'consultation_question')) status = 'done';
      if (step.id === 'answer' && participantHasMessage(messages, key, 'consultation_question_answer')) status = 'done';
      if (step.id === 'followup' && (participantHasMessage(messages, key, 'consultation_followup_request') || participantHasMessage(messages, key, 'consultation_followup_response'))) status = 'done';
      if (step.id === 'reflection' && participantHasMessage(messages, key, 'consultation_feedback')) status = 'done';
      return { id: step.id, status: status };
    });
    // A participant may see that the other side is still considering the
    // matter, but not the other side's private plan or pending answer.
    out.current = p.nextActorId === key ? (p.status === 'awaiting_question_answer' ? 'answer' : p.status === 'awaiting_followup_response' ? 'followup' : out.current) :
      terminal(p) ? (p.status === 'done' ? 'done' : 'ended') : 'waiting';
    return out;
  }
  function view(p, ch) {
    if (isPlan(p) && p.localActivity.kind === 'meeting' && TM.NPC.Meetings && TM.NPC.Meetings.view) return TM.NPC.Meetings.view(p, ch);
    if (!isPlan(p) || !ch || !p.knowledge[id(ch)]) return null;
    var key = id(ch), k = p.knowledge[key], a = p.localActivity;
    var messages = p.messages.filter(function (m) { return m.fromId === key || m.toId === key && m.status === 'delivered'; });
    var visibleMessages = messages.map(function (m) {
      var out = copy(m);
      if (out.fromId !== key && out.data) {
        delete out.data.sourceOpportunity;
        delete out.data.sourceRefs;
        if (out.data.result) { out.data.result = copy(out.data.result); delete out.data.result.sourceRefs; }
      }
      return out;
    });
    var knownDeadline = messages.reduce(function (deadline, m) { return m.data && Number.isFinite(m.data.expiresDay) ? m.data.expiresDay : deadline; }, a.createdDay + config.timeoutDays);
    var phase = p.nextActorId === key && !terminal(p) ? ({ awaiting_response: 'respond', awaiting_third: 'respond', awaiting_agreement: 'agree',
      ready_forward: 'forward', ready_report: 'report', ready_confirm: 'confirm', working: 'perform', awaiting_feedback: 'feedback', awaiting_question_answer: 'question_answer', awaiting_followup_response: 'followup_response', waiting_contact: 'cancel' })[p.status] || '' : '';
    if (phase === 'perform' && (day() < a.readyDay || a.workDays > 0 && game().turn <= a.acceptedTurn)) phase = '';
    var permittedDocuments = rows(a.documents).filter(function (d) { return d.authorId === key || d.receivedBy === key; });
    var exchangeVisible = a.exchange && (a.exchange.actorId === key || participantHasMessage(p.messages, key, 'consultation_exchange') || participantHasMessage(p.messages, key, 'consultation_question'));
    var answerVisible = a.questionAnswer && (a.questionAnswer.actorId === key || participantHasMessage(p.messages, key, 'consultation_question_answer'));
    var resultVisible = a.result && (a.result.actorId === key || participantHasMessage(p.messages, key, 'consultation_feedback'));
    var followUpVisible = a.followUp && (a.followUp.actorId === key || participantHasMessage(p.messages, key, 'consultation_followup_request') || participantHasMessage(p.messages, key, 'consultation_followup_response'));
    var visibleExchange = exchangeVisible ? copy(a.exchange) : null;
    var visibleResult = resultVisible ? copy(a.result) : null;
    if (visibleExchange && visibleExchange.actorId !== key) delete visibleExchange.sourceRefs;
    if (visibleResult && visibleResult.actorId !== key) delete visibleResult.sourceRefs;
    return { id: p.id, kind: a.kind, actorId: p.actorId, targetId: p.targetId,
      thirdPartyId: key === a.thirdPartyId || messages.some(function (m) { return rows(m.data && m.data.publicParticipants).some(function (x) { return x.id === a.thirdPartyId; }); }) ? a.thirdPartyId : '',
      intent: p.intent, stage: k.stage, nextPhase: phase, revision: a.revision, termsVersion: a.termsVersion,
      topicId: a.topicId || '', question: a.question || '', exchange: visibleExchange, questionAnswer: copy(answerVisible ? a.questionAnswer : null), result: visibleResult, followUp: copy(followUpVisible ? a.followUp : null), shortPlan: visibleShortPlan(a, p, key, messages),
      expiresDay: knownDeadline, messages: visibleMessages, documents: copy(permittedDocuments),
      contact: a.contact && a.contact.participants.indexOf(key) >= 0 && k.stage === 'done' ? copy(a.contact) : null,
      canCancel: !terminal(p) && a.cancelSenderId !== key, factStatus: 'own_activity_view',
      sourceOpportunity: key === p.actorId ? copy(a.sourceOpportunity || null) : null };
  }
  var tickets = new Map(), ticketSequence = 0;
  function ticket(ch, request) {
    if (!controlled(ch) || person(id(ch)) !== ch) return '';
    var p = request.planId && get(request.planId), v = p && view(p, ch);
    if (request.planId && !v) return '';
    var key = 'daily-ui:' + Date.now() + ':' + (++ticketSequence);
    tickets.set(key, { actorId: id(ch), request: copy(request), revision: v && v.revision, termsVersion: v && v.termsVersion, lease: ledger().capture() });
    return key;
  }
  function submitHuman(key, selection) {
    var t = tickets.get(key); if (!t || !ledger().current(t.lease)) return result('expired', 'stale_activity_button');
    var actor = person(t.actorId); if (!controlled(actor)) return result('blocked', 'player_choice_required');
    var migration = migrate(); if (!migration.ok) return result('blocked', migration.reason);
    var existing = t.request.planId && get(t.request.planId);
    var d = Object.assign({}, t.request, { activityKind: t.request.activityKind || existing && existing.localActivity.kind, actorId: t.actorId, behaviorType: 'ordinary_interaction', actionId: key, source: 'daily-human' });
    ['response', 'task', 'meeting', 'consultation', 'exchangeChoice'].forEach(function (field) { if (selection && selection[field] != null) d[field] = copy(selection[field]); });
    if (d.planId) { d.expectedRevision = t.revision; d.termsVersion = t.termsVersion; }
    issued.add(d);
    var receipt;
    try { receipt = ledger().executeHuman(actor, d, { _npcLease: t.lease }, commit); }
    finally { issued.delete(d); }
    if (/^(submitted|completed|noop)$/.test(receipt.outcome)) tickets.delete(key);
    return receipt;
  }
  var api = { config: config, day: day, migrate: migrate, readState: readState, budget: budget, controlled: controlled,
    isPlan: isPlan, get: get, plans: plans, terminal: terminal, knownIds: knownIds, knows: knows, relation: relation, relationKind: relationKind, contactFor: contactFor,
    material: material, materialOptions: materialOptions, selectMaterial: selectMaterial, relationshipIds: relationshipIds, exactLocation: exactLocation, canDeliver: canDeliver,
    topicInfo: topicInfo, consultationHistory: consultationHistory, consultationOpportunities: consultationOpportunities, consultationBasis: consultationBasis,
    person: person, spend: spend, relationshipRefs: relationshipRefs, commit: commit, submitNPC: submitNPC, afterVerifiedCommit: afterVerifiedCommit, verifyEvidence: verifyEvidence, needsAdvance: needsAdvance, advanceWithin: advanceWithin,
    view: view, ticket: ticket, submitHuman: submitHuman, withIndex: withIndex, revokeTickets: function () { tickets.clear(); } };
  TM.NPC.DailyActivities = api;
  if (root.NpcBehaviorRegistry) root.NpcBehaviorRegistry.register('ordinary_interaction', commit);
})(typeof window !== 'undefined' ? window : globalThis);
