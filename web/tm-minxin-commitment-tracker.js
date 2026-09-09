// @ts-check
/*
 * tm-minxin-commitment-tracker.js
 * Tracks governance promises created by formal minxin responses and settles
 * their execution over turns under fiscal, corruption, route, and war pressure.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_ITEMS = 140;

  function clone(v) {
    if (v === undefined || v === null) return v;
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) {
      if (Array.isArray(v)) return v.slice();
      if (typeof v === 'object') {
        var out = {};
        Object.keys(v).forEach(function(k) { out[k] = v[k]; });
        return out;
      }
      return v;
    }
  }

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function textOf(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(' ');
    if (typeof v === 'object') {
      var keys = ['text', 'content', 'summary', 'desc', 'description', 'reason', 'topic', 'title', 'name', 'demand'];
      for (var i = 0; i < keys.length; i += 1) {
        if (v[keys[i]] !== undefined && v[keys[i]] !== null && v[keys[i]] !== '') return textOf(v[keys[i]]);
      }
    }
    return '';
  }

  function compact(v, maxLen) {
    var text = String(textOf(v) || '').replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 180;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function ensureStore(root) {
    root = pickRoot(root);
    if (!root._minxinCommitments || typeof root._minxinCommitments !== 'object' || Array.isArray(root._minxinCommitments)) {
      root._minxinCommitments = {
        turn: Number(root.turn) || 0,
        seq: 0,
        items: [],
        settlements: [],
        stats: { recorded: 0, settled: 0, resolved: 0, stalled: 0, failed: 0 }
      };
    }
    var store = root._minxinCommitments;
    if (!Array.isArray(store.items)) store.items = [];
    if (!Array.isArray(store.settlements)) store.settlements = [];
    if (!store.stats) store.stats = { recorded: 0, settled: 0, resolved: 0, stalled: 0, failed: 0 };
    return store;
  }

  function unique(list) {
    var seen = {};
    var out = [];
    toArray(list).forEach(function(v) {
      var text = compact(v, 60);
      if (!text || seen[text]) return;
      seen[text] = true;
      out.push(text);
    });
    return out;
  }

  function inferMeasures(raw) {
    raw = raw || {};
    var explicit = unique(raw.measures || raw.measure || raw.policyTypes || []);
    var hay = [raw.text, raw.reply, raw.content, raw.reason, raw.decision, raw.channel].map(textOf).join(' ').toLowerCase();
    function add(name, re) {
      if (re.test(hay) && explicit.indexOf(name) < 0) explicit.push(name);
    }
    add('relief', /relief|grain|赈|粟|粮|济|恤/);
    add('tax_remission', /remission|tax|免|蠲|赋|税|租/);
    add('audit', /audit|investigat|inspect|verify|查|核|巡|勘|察/);
    add('corvee_reduction', /corvee|役|徭|夫/);
    add('security', /bandit|suppress|pacify|盗|匪|乱|捕|剿|安抚/);
    add('resettlement', /resettle|迁|流民|安插|招抚/);
    if (!explicit.length) explicit.push('administrative');
    return explicit;
  }

  function measureDifficulty(measures) {
    var weights = {
      relief: 1.15,
      tax_remission: 0.95,
      audit: 0.9,
      corvee_reduction: 0.8,
      security: 1.25,
      resettlement: 1.3,
      administrative: 0.7
    };
    return toArray(measures).reduce(function(sum, m) {
      return sum + (weights[m] || 0.85);
    }, 0.2);
  }

  function treasury(root) {
    var vals = [
      root && root.guoku && root.guoku.money,
      root && root.fiscal && root.fiscal.treasury,
      root && root.treasury,
      root && root.money
    ];
    for (var i = 0; i < vals.length; i += 1) {
      var n = Number(vals[i]);
      if (isFinite(n)) return n;
    }
    return 60000;
  }

  function corruption(root) {
    var vals = [
      root && root.corruption && root.corruption.trueIndex,
      root && root.corruption && root.corruption.index,
      root && root.corruption
    ];
    for (var i = 0; i < vals.length; i += 1) {
      var n = Number(vals[i]);
      if (isFinite(n)) return clamp(n, 0, 100);
    }
    return 50;
  }

  function localCorruption(root, regionName) {
    var n = Number(root && root.corruption && root.corruption.subDepts && root.corruption.subDepts.provincial && root.corruption.subDepts.provincial.true);
    if (isFinite(n)) return clamp(n, 0, 100);
    var regionN = normalizeName(regionName);
    var bridge = global.IntegrationBridge || (global.window && global.window.IntegrationBridge);
    var leaves = [];
    try {
      if (bridge && typeof bridge.getLeafDivisions === 'function' && root.adminHierarchy) leaves = bridge.getLeafDivisions(root.adminHierarchy, 'player') || [];
    } catch (_) {}
    var hit = leaves.find(function(div) {
      return div && regionN && normalizeName([div.name, div.id, div.regionId, div.mapRegionId].join(' ')).indexOf(regionN) >= 0;
    });
    var c = Number(hit && (hit.corruption != null ? hit.corruption : hit.corruptionLocal));
    return isFinite(c) ? clamp(c, 0, 100) : corruption(root);
  }

  function routePenalty(root, regionName) {
    var regionN = normalizeName(regionName);
    var rows = toArray(root && (root._routeDisruptions || root.routeDisruptions || root.blockedRoutes));
    var max = 0;
    rows.forEach(function(r) {
      var hay = normalizeName([r && r.region, r && r.regionName, r && r.name, r && r.route, r].map(textOf).join(' '));
      if (!regionN || !hay || hay.indexOf(regionN) >= 0 || regionN.indexOf(hay) >= 0) {
        var s = Number(r && (r.severity != null ? r.severity : r.level));
        if (!isFinite(s)) s = 0.6;
        if (s > 1) s = s / 100;
        max = Math.max(max, clamp(s, 0, 1));
      }
    });
    return max;
  }

  function warPenalty(root, regionName) {
    var wars = toArray(root && root.war_state && root.war_state.activeWars || root && root.activeWars);
    var regionN = normalizeName(regionName);
    var n = 0;
    wars.forEach(function(w) {
      if (!w) return;
      var hay = normalizeName([w.region, w.regionName, w.front, w.name, w.location].map(textOf).join(' '));
      if (w.inTerritory || !regionN || (hay && (hay.indexOf(regionN) >= 0 || regionN.indexOf(hay) >= 0))) n += 1;
    });
    return Math.min(0.5, n * 0.22);
  }

  function executionContext(root, item) {
    var money = treasury(root);
    var corr = corruption(root);
    var local = localCorruption(root, item.regionName);
    var route = routePenalty(root, item.regionName);
    var war = warPenalty(root, item.regionName);
    var financeScore = money <= 0 ? 0.05 : money < 20000 ? 0.25 : money < 80000 ? 0.65 : 1;
    var integrityScore = 1 - clamp((corr * 0.45 + local * 0.55) / 100, 0, 0.92);
    var logisticsScore = clamp(1 - route - war, 0.05, 1);
    var difficulty = measureDifficulty(item.measures);
    var score = clamp((financeScore * 0.36 + integrityScore * 0.34 + logisticsScore * 0.30) / Math.max(0.55, difficulty / 2.2), 0, 1);
    var reasons = [];
    if (financeScore < 0.45) reasons.push('finance');
    if (integrityScore < 0.45) reasons.push('corruption');
    if (route > 0.25) reasons.push('route');
    if (war > 0.05) reasons.push('war');
    return {
      money: money,
      corruption: Math.round(corr),
      localCorruption: Math.round(local),
      routePenalty: Math.round(route * 100) / 100,
      warPenalty: Math.round(war * 100) / 100,
      financeScore: Math.round(financeScore * 100) / 100,
      integrityScore: Math.round(integrityScore * 100) / 100,
      logisticsScore: Math.round(logisticsScore * 100) / 100,
      difficulty: Math.round(difficulty * 100) / 100,
      executionScore: Math.round(score * 100) / 100,
      blockingReasons: reasons
    };
  }

  function commitmentId(root, seq) {
    return 'mxcm-' + (Number(root.turn) || 0) + '-' + seq;
  }

  function record(root, raw, options) {
    root = pickRoot(root);
    raw = raw || {};
    options = options || {};
    var measures = inferMeasures(raw);
    var decision = compact(raw.decision || raw.status || raw.action || raw.channel || 'commitment', 60);
    var channel = compact(raw.channel || raw.kind || 'formal', 40);
    if (/reject|blocked|deny|驳|拒|阻/.test(String(decision).toLowerCase())) {
      return null;
    }
    var store = ensureStore(root);
    store.seq = (Number(store.seq) || 0) + 1;
    store.stats.recorded = (Number(store.stats.recorded) || 0) + 1;
    var turn = Number(options.turn != null ? options.turn : raw.turn != null ? raw.turn : root.turn) || 0;
    var item = {
      id: commitmentId(root, store.seq),
      turn: turn,
      createdTurn: turn,
      dueTurn: turn + Math.max(2, toArray(measures).length + 1),
      linkedIssue: compact(raw.linkedIssue || raw.issueId || '', 100),
      sourceSystem: raw.sourceSystem || 'minxin-commitment',
      sourceResponseId: raw.sourceResponseId || raw.responseId || '',
      channel: channel,
      decision: decision,
      actor: compact(raw.actor || raw.from || 'player', 80),
      regionName: compact(raw.regionName || raw.region || '', 100),
      className: compact(raw.className || raw.sourceClass || raw.class || '', 100),
      classKey: compact(raw.classKey || '', 80),
      measures: measures,
      text: compact(raw.text || raw.reply || raw.content || raw.reason || decision, 240),
      status: 'active',
      progress: 0,
      expectedEffect: Math.round((2 + measures.length * 1.2) * 10) / 10,
      risk: 'normal',
      history: [],
      at: Date.now()
    };
    if (!item.regionName && raw.pressureItem) item.regionName = compact(raw.pressureItem.regionName || '', 100);
    if (!item.className && raw.pressureItem) item.className = compact(raw.pressureItem.className || '', 100);
    if (!item.classKey && raw.pressureItem) item.classKey = compact(raw.pressureItem.classKey || '', 80);
    store.items.push(item);
    if (store.items.length > MAX_ITEMS) store.items = store.items.slice(-MAX_ITEMS);
    return clone(item);
  }

  function recordFromPressureResponse(root, pressureItem, response, payload, options) {
    root = pickRoot(root);
    pressureItem = pressureItem || {};
    response = response || {};
    payload = payload || {};
    if (!response.deltaTrue || Number(response.deltaTrue) <= 0) return null;
    return record(root, {
      linkedIssue: pressureItem.id || response.linkedIssue || payload.linkedIssue || '',
      sourceResponseId: response.id || '',
      channel: response.channel || payload.channel || '',
      decision: response.decision || payload.decision || '',
      actor: response.actor || payload.actor || '',
      regionName: pressureItem.regionName,
      className: pressureItem.className,
      classKey: pressureItem.classKey,
      text: response.text || payload.text || '',
      pressureItem: pressureItem
    }, options || {});
  }

  function settlementDelta(item, ctx, status) {
    if (status === 'backlash') return -Math.max(1.2, Math.round((1.2 + item.measures.length * 0.45) * 10) / 10);
    if (status === 'resolved') return Math.max(2.5, Math.round((item.expectedEffect || 3) * 10) / 10);
    return Math.max(0.6, Math.round((ctx.executionScore * (item.expectedEffect || 3) * 0.45) * 10) / 10);
  }

  function pushSettlement(root, item, settlement) {
    var store = ensureStore(root);
    store.settlements.push(clone(settlement));
    if (store.settlements.length > MAX_ITEMS) store.settlements = store.settlements.slice(-MAX_ITEMS);
    store.stats.settled = (Number(store.stats.settled) || 0) + 1;
    if (settlement.status === 'resolved') store.stats.resolved = (Number(store.stats.resolved) || 0) + 1;
    if (settlement.status === 'stalled') store.stats.stalled = (Number(store.stats.stalled) || 0) + 1;
    if (settlement.status === 'failed') store.stats.failed = (Number(store.stats.failed) || 0) + 1;
    item.history = toArray(item.history);
    item.history.push(clone(settlement));
    if (item.history.length > 18) item.history = item.history.slice(-18);
    item.lastSettlement = clone(settlement);
  }

  function writeSignals(root, item, settlement) {
    var kind = settlement.status === 'progress' || settlement.status === 'resolved' ? 'commitment-progress' : 'commitment-backlash';
    var delta = settlement.deltaTrue || 0;
    try {
      if (TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.record === 'function') {
        TM.SocialPoliticalSignals.record(root, {
          sourceSystem: 'minxin-commitment',
          kind: kind,
          tags: ['minxin', 'commitment', settlement.status].concat(item.measures || []),
          intensity: Math.min(1, Math.max(0.35, Math.abs(delta) / 5)),
          confidence: 0.78,
          linkedIssue: item.id,
          reason: settlement.reason,
          affectedClasses: [{
            name: item.className,
            satisfactionDelta: delta,
            demand: item.text,
            unrestDelta: { momentum: delta > 0 ? -Math.abs(delta) : Math.abs(delta), reason: settlement.reason },
            reason: settlement.reason
          }],
          affectedParties: [],
          evidence: [item.channel, item.decision, item.regionName, item.className].concat(item.measures || [])
        });
      }
    } catch (_) {}
    try {
      if (TM.MinxinLedger && typeof TM.MinxinLedger.recordAndApply === 'function') {
        TM.MinxinLedger.recordAndApply(root, {
          sourceSystem: 'minxin-commitment',
          kind: kind === 'commitment-progress' ? 'commitment-settlement' : 'commitment-backlash',
          targetRegions: [{ region: item.regionName, weight: 1 }],
          targetClasses: [{ name: item.className, classKey: item.classKey, weight: 0.08 }],
          deltaTrue: delta,
          intensity: Math.min(1, Math.max(0.35, Math.abs(delta) / 5)),
          confidence: 0.78,
          reason: settlement.reason,
          linkedIssue: item.id,
          tags: ['minxin', 'commitment', settlement.status].concat(item.measures || [])
        }, {
          turn: settlement.turn,
          source: 'minxin-commitment'
        });
      }
    } catch (_) {}
  }

  function settleOne(root, item, options) {
    options = options || {};
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    if (!item || item.status === 'resolved' || item.status === 'failed') return null;
    // Unreleased standalone pilot data is retained, not reinterpreted as a normal fulfilled promise.
    if (item.linkedIssue && (root.currentIssues || []).some(function(i){return i && i.id === item.linkedIssue && i.relief && i.relief.version === 1;})) return null;
    if (turn <= Number(item.lastSettlementTurn || item.createdTurn || item.turn || 0)) return null;
    var ctx = executionContext(root, item);
    var status = 'progress';
    var gain = Math.round((16 + ctx.executionScore * 34) / Math.max(0.85, measureDifficulty(item.measures) / 2.6));
    var reason = 'commitment progress score=' + ctx.executionScore;
    if (ctx.executionScore < 0.22) {
      status = Number(item.stallCount || 0) >= 1 ? 'failed' : 'stalled';
      gain = -Math.max(6, Math.round(12 * (1 - ctx.executionScore)));
      reason = 'blocked by ' + (ctx.blockingReasons.length ? ctx.blockingReasons.join('/') : 'execution') + ' score=' + ctx.executionScore;
      item.stallCount = (Number(item.stallCount) || 0) + 1;
    } else if (ctx.executionScore < 0.42) {
      status = 'stalled';
      gain = Math.max(0, Math.round(ctx.executionScore * 14));
      reason = 'slow progress: ' + (ctx.blockingReasons.length ? ctx.blockingReasons.join('/') : 'weak execution') + ' score=' + ctx.executionScore;
      item.stallCount = (Number(item.stallCount) || 0) + 1;
    } else {
      item.stallCount = 0;
    }
    if (status === 'progress') {
      item.progress = clamp((Number(item.progress) || 0) + gain, 0, 100);
      if (item.progress >= 100) {
        item.status = 'resolved';
        status = 'resolved';
        reason = 'commitment fulfilled score=' + ctx.executionScore;
      } else {
        item.status = 'active';
      }
    } else if (status === 'failed') {
      item.status = 'failed';
    } else {
      item.status = 'stalled';
      item.progress = clamp((Number(item.progress) || 0) + Math.max(0, gain), 0, 95);
    }
    item.lastSettlementTurn = turn;
    var delta = settlementDelta(item, ctx, status === 'progress' || status === 'resolved' ? status : 'backlash');
    var settlement = {
      id: 'mxcm-settle-' + turn + '-' + item.id,
      commitmentId: item.id,
      linkedIssue: item.linkedIssue,
      turn: turn,
      status: status === 'resolved' ? 'resolved' : status,
      progress: Math.round(item.progress || 0),
      deltaTrue: delta,
      reason: reason,
      context: ctx
    };
    pushSettlement(root, item, settlement);
    writeSignals(root, item, settlement);
    return settlement;
  }

  function tick(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var settlements = [];
    store.items.forEach(function(item) {
      var s = settleOne(root, item, options);
      if (s) settlements.push(s);
    });
    root._minxinCommitmentsMaintenance = {
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      source: options.source || 'minxin-commitment-tick',
      active: store.items.filter(function(x) { return x && x.status === 'active'; }).length,
      stalled: store.items.filter(function(x) { return x && x.status === 'stalled'; }).length,
      resolved: store.items.filter(function(x) { return x && x.status === 'resolved'; }).length,
      settled: settlements.length
    };
    return { settled: settlements.length, settlements: settlements.map(clone), maintenance: clone(root._minxinCommitmentsMaintenance) };
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(60, Number(options.limit || 12) || 12));
    var store = ensureStore(root);
    return {
      turn: Number(root.turn) || 0,
      maintenance: clone(root._minxinCommitmentsMaintenance || null),
      active: store.items.filter(function(x) { return x && (x.status === 'active' || x.status === 'stalled'); }).slice(-limit).reverse().map(clone),
      recent: store.items.slice(-limit).reverse().map(clone),
      settlements: store.settlements.slice(-limit).reverse().map(clone),
      stats: clone(store.stats)
    };
  }

  function itemLine(item) {
    return '- ' + item.id + ' ' + item.regionName + ' / ' + item.className
      + ' status=' + item.status
      + ' progress=' + Math.round(item.progress || 0)
      + ' measures=' + toArray(item.measures).join('/')
      + ' due=' + (item.dueTurn || '')
      + ' text=' + compact(item.text || '', 90);
  }

  function settlementLine(s) {
    return '- T' + (s.turn || '') + ' ' + s.commitmentId
      + ' status=' + (s.status || '')
      + ' progress=' + (s.progress || 0)
      + ' delta=' + (s.deltaTrue || 0)
      + ' reason=' + compact(s.reason || '', 110);
  }

  function formatForPrompt(root, options) {
    var snap = snapshot(root, options || {});
    if (!snap.active.length && !snap.settlements.length) return '';
    var lines = ['\n\n=== Minxin Commitments ==='];
    lines.push('Formal replies can become governance commitments. Their effects depend on treasury, corruption, route access, and war pressure; stalled promises create backlash.');
    if (snap.active.length) lines.push('active:\n' + snap.active.map(itemLine).join('\n'));
    if (snap.settlements.length) lines.push('settlements:\n' + snap.settlements.map(settlementLine).join('\n'));
    return lines.join('\n');
  }

  function diagnosticsText(root, options) {
    var snap = snapshot(root, options || {});
    var lines = ['=== Minxin Commitments Diagnostics ==='];
    lines.push('active=' + snap.active.length + ' recent=' + snap.recent.length + ' settlements=' + snap.settlements.length);
    if (snap.maintenance) lines.push('maintenance turn=' + snap.maintenance.turn + ' active=' + snap.maintenance.active + ' stalled=' + snap.maintenance.stalled + ' resolved=' + snap.maintenance.resolved + ' settled=' + snap.maintenance.settled);
    if (snap.recent.length) lines.push('recent:\n' + snap.recent.map(itemLine).join('\n'));
    if (snap.settlements.length) lines.push('settlements:\n' + snap.settlements.map(settlementLine).join('\n'));
    return lines.join('\n');
  }

  TM.MinxinCommitmentTracker = {
    record: record,
    recordFromPressureResponse: recordFromPressureResponse,
    tick: tick,
    snapshot: snapshot,
    formatForPrompt: formatForPrompt,
    diagnosticsText: diagnosticsText,
    _executionContext: executionContext,
    _inferMeasures: inferMeasures
  };

  global.MinxinCommitmentTracker = TM.MinxinCommitmentTracker;
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.MinxinCommitmentTracker;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
