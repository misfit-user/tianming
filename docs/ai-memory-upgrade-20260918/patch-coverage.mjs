import { edit } from './patch-utils.mjs';
edit('web/tm-memory-context-compiler.js', (s, r) => {
  s = r(s, '    var sectionPlans = {};', `    // Keep a representative current fact, live order and promise before the long character roster.
    var coreCandidates = sections.coreFacts;
    var coreLeads = [];
    [function(h) { return h.source === 'hard_state'; }, function(h) { return h.source === 'activeEdict' || h.source === 'imperialEdict'; }, function(h) { return h.source === 'commitment'; }, function(h) { return h.pinned === true; }].forEach(function(matches) {
      var lead = coreCandidates.find(matches);
      if (lead && coreLeads.indexOf(lead) < 0) coreLeads.push(lead);
    });
    sections.coreFacts = coreLeads.concat(coreCandidates.filter(function(h) { return coreLeads.indexOf(h) < 0; }));
    var sectionPlans = {};`);
  s = r(s, "        if (key === 'coreFacts') z.mustKeep = true;", `        if (key === 'coreFacts') {
          z.mustKeep = true;
          var hasOtherEvidence = SECTION_ORDER.some(function(other) { return other !== 'coreFacts' && other !== 'warnings' && sections[other].length > 0; });
          if (maxTokens >= 600 && hasOtherEvidence) z.maxTokens = Math.max(Math.floor(maxTokens * 0.65), CZ.estimateTokens(plan.textForCount(1)));
        }`);
  return s;
});
edit('web/tm-memory-envelope.js', (s, r) => {
  s = r(s, '        saveId: item.saveId,\n        worldId: item.worldId,', '        saveId: item.saveId,\n        worldId: item.worldId,\n        campaignId: item.campaignId,\n        timelineId: item.timelineId,\n        reviewStatus: item.reviewStatus,\n        validFromTurn: item.validFromTurn,\n        validToTurn: item.validToTurn,\n        expiredAtTurn: item.expiredAtTurn,\n        learnedAtTurn: item.learnedAtTurn,');
  s = r(s, '        turn: item.turn || item.enqueuedAtTurn || item.acceptedAtTurn || turn,', '        turn: item.turn != null ? item.turn : (item.enqueuedAtTurn != null ? item.enqueuedAtTurn : (item.acceptedAtTurn != null ? item.acceptedAtTurn : turn)),');
  return s;
});
edit('web/tm-memory-context-compiler.js', (s, r) => {
  s = r(s, '    out._compilerScore = normalizedScore(out, opts);', `    if (opts && opts.turn != null) {
      var currentTurn = Number(opts.turn);
      if ((out.validToTurn != null && Number(out.validToTurn) < currentTurn) || (out.expiredAtTurn != null && Number(out.expiredAtTurn) <= currentTurn)) out.temporalUse = 'historical_only';
      if (out.validFromTurn != null && Number(out.validFromTurn) > currentTurn) out.temporalUse = 'not_yet_effective';
    }
    out._compilerScore = normalizedScore(out, opts);`);
  s = r(s, '    var sourceRefs = compactRefList(hit.sourceRefs);', `    if (hit.temporalUse) attrs.push('temporal-use="' + xml(hit.temporalUse) + '"');
    if (hit.staleStatus) attrs.push('stale-status="' + xml(hit.staleStatus) + '"');
    if (hit.validFromTurn != null) attrs.push('valid-from="' + xml(hit.validFromTurn) + '"');
    if (hit.validToTurn != null) attrs.push('valid-to="' + xml(hit.validToTurn) + '"');
    if (hit.expiredAtTurn != null) attrs.push('expired-at="' + xml(hit.expiredAtTurn) + '"');
    var sourceRefs = compactRefList(hit.sourceRefs);`);
  return s;
});
