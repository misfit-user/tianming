import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-memory-retrieval.js', (s, r) => {
  s = r(s, '  function suppressionReason(hit, opts) {', fs.readFileSync('docs/ai-memory-upgrade-20260918/retrieval-scope.fragment.txt', 'utf8') + '  function suppressionReason(hit, opts) {');
  s = r(s, "    if (!hit) return 'empty';", "    if (!hit) return 'empty';\n    var boundary = memoryBoundaryReason(hit, opts);\n    if (boundary) return boundary;");
  s = r(s, "    var intent = String(opts.intent || 'current_fact').toLowerCase();", "    var eventTurn = numberOrNull(hit.turn);\n    var learnedTurn = numberOrNull(hit.learnedAtTurn);\n    if ((eventTurn != null && eventTurn > turn) || (learnedTurn != null && learnedTurn > turn)) return 'future_memory';\n    var intent = String(opts.intent || 'current_fact').toLowerCase();");
  s = r(s, "      text: textOf({ text: env.safeBody || env.body }),\n      safeBody: env.safeBody || '',", "      text: textOf({ text: env.safeBody != null ? env.safeBody : env.body }),\n      safeBody: env.safeBody != null ? env.safeBody : (env.body || ''),\n      reviewStatus: env.reviewStatus || '',\n      campaignId: env.campaignId || '',\n      timelineId: env.timelineId || '',\n      entities: Array.isArray(env.entities) ? env.entities.slice() : [],");
  s = r(s, "      turn: opts.turn,\n      intent: opts.intent || opts.retrievalIntent || 'current_fact',", "      turn: opts.turn,\n      includeFuture: opts.includeFuture,\n      intent: opts.intent || opts.retrievalIntent || 'current_fact',");
  s = r(s, "      status: hit.status || 'active',", "      status: hit.status || 'active',\n      reviewStatus: hit.reviewStatus || '',\n      turn: hit.turn,\n      learnedAtTurn: hit.learnedAtTurn,");
  return s;
});
edit('web/tm-memory-envelope.js', (s, r) => {
  s = r(s, "    if (s === 'stale' || s === 'superseded') return s;", "    if (s === 'draft' || s === 'pending_review' || s === 'rejected') return s;\n    if (s === 'accepted') return 'active';\n    if (s === 'stale' || s === 'superseded') return s;");
  s = r(s, 'safeBody: safeBodyText(input.safeBody || body,', 'safeBody: safeBodyText(input.safeBody != null ? input.safeBody : body,');
  s = r(s, "      readScope: clean(input.readScope || input.visibilityScope || input.audienceScope, 120),", "      readScope: clean(Array.isArray(input.readScope) ? input.readScope.join(' ') : (input.readScope || input.visibilityScope || input.audienceScope), 120),");
  s = r(s, "      status: normalizeStatus(input.status, input.statusFallback || 'active'),", "      status: normalizeStatus(input.status, input.statusFallback || 'active'),\n      reviewStatus: clean(input.reviewStatus, 40),\n      campaignId: clean(input.campaignId || input._campaignId, 120),\n      timelineId: clean(input.timelineId || input._timelineId, 120),");
  return s;
});
edit('web/tm-memory-envelope.js', (s, r) => r(s, '    return dedupe(out);', `    out.forEach(function(env) {
      if (!GM) return;
      if (!env.worldId) env.worldId = clean(GM.worldId || GM._worldId || GM.scenarioId || GM.scenarioKey, 120);
      if (!env.saveId) env.saveId = clean(GM.saveId || GM._saveId || GM.runId || GM.campaignId || GM._campaignId, 120);
      if (!env.campaignId) env.campaignId = clean(GM.campaignId || GM._campaignId, 120);
      if (!env.timelineId) env.timelineId = clean(GM.timelineId || GM._timelineId, 120);
    });
    return dedupe(out);`));
edit('web/tm-memory-governance.js', (s, r) => {
  s = r(s, "    if (status === 'deleted' || status === 'deleted_tombstone' || status === 'redacted') return 'deleted';", "    var review = clean(env && env.reviewStatus).toLowerCase();\n    if (status === 'draft' || status === 'pending_review' || review === 'pending_review') return 'pending_review';\n    if (status === 'rejected' || review === 'rejected') return 'rejected';\n    if (status === 'deleted' || status === 'deleted_tombstone' || status === 'redacted') return 'deleted';");
  s = r(s, "    var intent = clean(ctx.intent).toLowerCase();\n    var validFrom", "    var eventTurn = numberOrNull(env.turn);\n    var learnedTurn = numberOrNull(env.learnedAtTurn);\n    if (ctx.includeFuture !== true && ((eventTurn != null && eventTurn > turn) || (learnedTurn != null && learnedTurn > turn))) return 'future_memory';\n    var intent = clean(ctx.intent).toLowerCase();\n    var validFrom");
  s = r(s, "    if (statusReason === 'deleted') add(reasons, 'deleted',", "    if (statusReason === 'pending_review' || statusReason === 'rejected') add(reasons, statusReason, 'unaccepted memory cannot be injected');\n    if (statusReason === 'deleted') add(reasons, 'deleted',");
  s = r(s, "    if (temporalReason === 'not_yet_valid')", "    if (temporalReason === 'future_memory') add(reasons, 'future_memory', 'memory belongs to a future turn');\n    if (temporalReason === 'not_yet_valid')");
  return s;
});
