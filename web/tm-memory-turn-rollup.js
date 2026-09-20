(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryTurnRollup = root.TM.MemoryTurnRollup || {};
  var SCHEMA_VERSION = 'memory-turn-rollup/v0';
  var PROJECTION_VERSION = 1;
  var DEFAULT_CAP = 80;

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function clean(value, maxLen) {
    var s = toText(value).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.slice(0, maxLen || 400);
  }

  function slug(value, fallback) {
    var s = clean(value, 160).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return s || fallback || 'item';
  }

  function sourceRef(type, id, body, extra) {
    var ME = root.TM && root.TM.MemoryEnvelope;
    if (ME && typeof ME.sourceRef === 'function') return ME.sourceRef(type, id, body, extra || {});
    var ref = { type: clean(type, 60) || 'unknown', id: clean(id, 120) || 'unknown' };
    if (extra && extra.turn != null) ref.turn = Number(extra.turn || 0);
    return ref;
  }

  function compactRefs(list, fallbackTurn) {
    var seen = {};
    var out = [];
    arr(list).forEach(function(ref) {
      if (!ref) return;
      var type = clean(ref.type, 60);
      var id = clean(ref.id, 120);
      if (!type || !id) return;
      var key = type + ':' + id;
      if (seen[key]) return;
      seen[key] = true;
      var item = { type: type, id: id };
      if (ref.turn != null || fallbackTurn != null) item.turn = Number(ref.turn != null ? ref.turn : fallbackTurn);
      if (ref.authority) item.authority = clean(ref.authority, 80);
      if (ref.lane) item.lane = clean(ref.lane, 80);
      if (ref.role) item.role = clean(ref.role, 80);
      out.push(item);
    });
    return out.slice(0, 16);
  }

  function archiveBundles(GM) {
    return arr(GM && GM._turnMemoryArchive).filter(function(bundle) {
      return bundle && bundle.schemaVersion === 'memory-turn-archive/v0';
    }).slice().sort(function(a, b) {
      return Number(a.turn || 0) - Number(b.turn || 0);
    });
  }

  function deriveYearKey(GM, bundle, opts) {
    opts = opts || {};
    var explicit = bundle && (bundle.year || bundle.currentYear || bundle.yearKey) || opts.year;
    if (explicit) return String(explicit);
    var gmYear = GM && (GM.currentYear || GM.year || GM.displayYear);
    if (gmYear) return String(gmYear);
    var turn = Number(bundle && bundle.turn || 0);
    var turnsPerYear = Math.max(1, Number(opts.turnsPerYear || 12));
    var start = Math.floor(Math.max(0, turn - 1) / turnsPerYear) * turnsPerYear + 1;
    return 'turns-' + start + '-' + (start + turnsPerYear - 1);
  }

  function itemTurn(item, bundle) {
    return Number((item && item.turn) || (bundle && bundle.turn) || 0);
  }

  function itemBody(item, maxLen) {
    return clean(item && (item.safeBody || item.body || item.text || item.content), maxLen || 300);
  }

  function timelineLine(item, bundle, maxLen) {
    var turn = itemTurn(item, bundle);
    var body = itemBody(item, maxLen || 180);
    return body ? ('T' + turn + ' ' + body) : '';
  }

  function joinLines(lines, maxLen) {
    var seen = {};
    var out = [];
    arr(lines).forEach(function(line) {
      line = clean(line, 260);
      var key = line.toLowerCase();
      if (!line || seen[key]) return;
      seen[key] = true;
      out.push(line);
    });
    return clean(out.join(' | '), maxLen || 1200);
  }

  function mergeSourceRefs(items, fallbackTurn) {
    var refs = [];
    arr(items).forEach(function(item) {
      refs = refs.concat(arr(item && item.sourceRefs), arr(item && item.basisRefs));
    });
    return compactRefs(refs, fallbackTurn);
  }

  function groupChronicles(GM, bundles, opts) {
    var groups = {};
    bundles.forEach(function(bundle) {
      var key = deriveYearKey(GM, bundle, opts);
      if (!groups[key]) groups[key] = { yearKey: key, bundles: [], items: [] };
      groups[key].bundles.push(bundle);
      arr(bundle.chronicle).forEach(function(item) {
        if (itemBody(item)) groups[key].items.push({ item: item, bundle: bundle });
      });
    });
    return Object.keys(groups).sort().map(function(key) { return groups[key]; });
  }

  function buildChronicleRollups(GM, bundles, opts) {
    var out = [];
    groupChronicles(GM, bundles, opts).forEach(function(group) {
      if (!group.items.length) return;
      var turns = group.items.map(function(row) { return itemTurn(row.item, row.bundle); }).filter(Boolean);
      var startTurn = turns.length ? Math.min.apply(Math, turns) : 0;
      var endTurn = turns.length ? Math.max.apply(Math, turns) : 0;
      var lines = group.items.map(function(row) { return timelineLine(row.item, row.bundle, 180); });
      var body = group.yearKey + ' chronicle rollup: ' + joinLines(lines, 1100);
      var refs = group.bundles.map(function(bundle) {
        return sourceRef('turnArchive', bundle.id || ('turn-' + bundle.turn), body, { turn: bundle.turn });
      });
      out.push({
        id: 'chronicle-rollup-' + slug(group.yearKey, 'year'),
        schemaVersion: SCHEMA_VERSION,
        projectionVersion: PROJECTION_VERSION,
        type: 'historiography_summary',
        yearKey: group.yearKey,
        body: body,
        authority: 'structured_chronicle',
        visibility: 'public',
        turn: endTurn,
        startTurn: startTurn,
        endTurn: endTurn,
        lane: 'L7_chronicle_context',
        factStatus: 'historiography_summary',
        role: 'rollup',
        sourceRefs: compactRefs(refs, endTurn),
        basisRefs: mergeSourceRefs(group.items.map(function(row) { return row.item; }), endTurn),
        extra: { stream: 'chronicleRollup', bundleCount: group.bundles.length, itemCount: group.items.length }
      });
    });
    return out.slice(-DEFAULT_CAP);
  }

  function issueIdOf(item, index) {
    item = item || {};
    return clean(item.issueId || item.issueID || item.id || item.key, 120) || ('issue-' + index);
  }

  function groupIssues(bundles) {
    var groups = {};
    bundles.forEach(function(bundle) {
      arr(bundle.stateAffairs).forEach(function(item, index) {
        if (!itemBody(item)) return;
        var id = issueIdOf(item, index);
        if (!groups[id]) groups[id] = { issueId: id, rows: [] };
        groups[id].rows.push({ item: item, bundle: bundle });
      });
    });
    return Object.keys(groups).sort().map(function(key) {
      groups[key].rows.sort(function(a, b) { return itemTurn(a.item, a.bundle) - itemTurn(b.item, b.bundle); });
      return groups[key];
    });
  }

  function issueResolved(rows) {
    return arr(rows).some(function(row) {
      var item = row && row.item || {};
      return item.type === 'issue_resolution' || item.factStatus === 'issue_resolution' || clean(item.role, 40) === 'resolution';
    });
  }

  function buildIssueChains(GM, bundles, opts) {
    var out = [];
    groupIssues(bundles).forEach(function(group) {
      if (!group.rows.length) return;
      var first = group.rows[0].item || {};
      var last = group.rows[group.rows.length - 1].item || {};
      var turns = group.rows.map(function(row) { return itemTurn(row.item, row.bundle); }).filter(Boolean);
      var startTurn = turns.length ? Math.min.apply(Math, turns) : 0;
      var endTurn = turns.length ? Math.max.apply(Math, turns) : 0;
      var resolved = issueResolved(group.rows);
      var lines = group.rows.map(function(row) { return timelineLine(row.item, row.bundle, 180); });
      var title = clean((last.extra && last.extra.title) || last.title || first.title || group.issueId, 120);
      var body = title + ' issue chain: ' + joinLines(lines, 1100);
      var refs = group.rows.map(function(row) {
        return sourceRef('turnArchive', row.bundle.id || ('turn-' + row.bundle.turn), body, { turn: row.bundle.turn });
      });
      out.push({
        id: 'issue-chain-' + slug(group.issueId, 'issue'),
        schemaVersion: SCHEMA_VERSION,
        projectionVersion: PROJECTION_VERSION,
        type: 'ongoing_affair',
        issueId: group.issueId,
        body: body,
        authority: resolved ? 'rule_validated' : 'ai_analysis',
        visibility: 'public',
        status: 'active',
        turn: endTurn,
        startTurn: startTurn,
        endTurn: endTurn,
        lane: 'L3_long_term_affair',
        factStatus: resolved ? 'issue_chain_resolved' : 'issue_chain_active',
        role: resolved ? 'resolved_chain' : 'active_chain',
        sourceRefs: compactRefs(refs, endTurn),
        basisRefs: mergeSourceRefs(group.rows.map(function(row) { return row.item; }), endTurn),
        entities: [].concat(arr(first.entities), arr(last.entities)),
        extra: { stream: 'issueChain', itemCount: group.rows.length, issueStatus: resolved ? 'resolved' : 'active' }
      });
    });
    return out.slice(-DEFAULT_CAP);
  }

  function actorScope(actor) {
    actor = clean(actor, 120);
    if (!actor) return '';
    return /^npc:/i.test(actor) ? actor : ('npc:' + actor);
  }

  function actorNames(item) {
    item = item || {};
    var names = [];
    if (item.extra) {
      names.push(item.extra.actor, item.extra.target);
    }
    names = names.concat(arr(item.entities));
    var seen = {};
    return names.map(function(name) { return clean(name, 120); }).filter(function(name) {
      var key = name.toLowerCase();
      if (!name || seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 4);
  }

  function groupCharacters(bundles) {
    var groups = {};
    bundles.forEach(function(bundle) {
      arr(bundle.characterEvents).forEach(function(item) {
        if (!itemBody(item)) return;
        actorNames(item).forEach(function(actor) {
          if (!groups[actor]) groups[actor] = { actor: actor, rows: [] };
          groups[actor].rows.push({ item: item, bundle: bundle });
        });
      });
    });
    return Object.keys(groups).sort().map(function(key) {
      groups[key].rows.sort(function(a, b) { return itemTurn(a.item, a.bundle) - itemTurn(b.item, b.bundle); });
      return groups[key];
    });
  }

  function dossierReadScope(actor, rows) {
    var privateScope = '';
    arr(rows).forEach(function(row) {
      var scope = clean(row && row.item && row.item.readScope, 120).toLowerCase();
      if (scope && scope !== 'public' && scope !== 'world' && scope !== 'all') privateScope = actorScope(actor);
    });
    return privateScope || 'public';
  }

  function buildCharacterDossiers(GM, bundles, opts) {
    var out = [];
    groupCharacters(bundles).forEach(function(group) {
      if (!group.rows.length) return;
      var turns = group.rows.map(function(row) { return itemTurn(row.item, row.bundle); }).filter(Boolean);
      var startTurn = turns.length ? Math.min.apply(Math, turns) : 0;
      var endTurn = turns.length ? Math.max.apply(Math, turns) : 0;
      var lines = group.rows.map(function(row) { return timelineLine(row.item, row.bundle, 160); });
      var body = group.actor + ' character dossier: ' + joinLines(lines, 900);
      var refs = group.rows.map(function(row) {
        return sourceRef('turnArchive', row.bundle.id || ('turn-' + row.bundle.turn), body, { turn: row.bundle.turn });
      });
      out.push({
        id: 'character-dossier-' + slug(group.actor, 'actor'),
        schemaVersion: SCHEMA_VERSION,
        projectionVersion: PROJECTION_VERSION,
        type: 'character_memory',
        actor: group.actor,
        body: body,
        authority: 'event_log',
        visibility: 'internal',
        ownerScope: actorScope(group.actor),
        readScope: dossierReadScope(group.actor, group.rows),
        status: 'active',
        turn: endTurn,
        startTurn: startTurn,
        endTurn: endTurn,
        lane: 'L6_retrieved_evidence',
        factStatus: 'character_event_rollup',
        role: 'rollup',
        sourceRefs: compactRefs(refs, endTurn),
        basisRefs: mergeSourceRefs(group.rows.map(function(row) { return row.item; }), endTurn),
        entities: [group.actor],
        extra: { stream: 'characterDossier', itemCount: group.rows.length, actor: group.actor }
      });
    });
    return out.slice(-DEFAULT_CAP);
  }

  function cap(list, limit) {
    if (!Array.isArray(list)) return [];
    limit = Math.max(1, Number(limit || DEFAULT_CAP));
    return list.length > limit ? list.slice(list.length - limit) : list;
  }

  // S7(2026-06-03): 第二层折叠——把多个「年」chronicle rollup 折成「era 大略」高层 recap(RAPTOR collapsed-tree:
  // 年=细节 / era=数年大略·两层并存·检索层按预算取合适粒度)。治"v6 仅 turn->year 单层、3 层金字塔只在 legacy anchors 喂 sc05"。
  function buildEraRollups(GM, chronicleRollups, opts) {
    opts = opts || {};
    var eraSize = Math.max(2, Number(opts.eraSize || 4));
    var rolls = (Array.isArray(chronicleRollups) ? chronicleRollups.slice() : [])
      .filter(function(r) { return r && (r.body || r.text); })
      .sort(function(a, b) { return Number(a.startTurn || a.turn || 0) - Number(b.startTurn || b.turn || 0); });
    if (rolls.length < 2) return []; // 不足两年·无需折叠
    var out = [];
    for (var g = 0; g < rolls.length; g += eraSize) {
      var group = rolls.slice(g, g + eraSize);
      if (group.length < 2) continue; // 单年不折(避免与年 rollup 重复)
      var startTurns = group.map(function(r) { return Number(r.startTurn || r.turn || 0); });
      var endTurns = group.map(function(r) { return Number(r.endTurn || r.turn || 0); });
      var startTurn = Math.min.apply(Math, startTurns);
      var endTurn = Math.max.apply(Math, endTurns);
      var firstYear = group[0].yearKey || ('T' + startTurn);
      var lastYear = group[group.length - 1].yearKey || ('T' + endTurn);
      var lines = group.map(function(r) {
        var yk = r.yearKey || ('T' + (r.startTurn || r.turn || 0));
        var b = String(r.body || r.text || '').replace(/^.*?chronicle rollup[:：]\s*/i, '');
        return yk + '：' + clean(b, 110);
      });
      var body = '编年大略 ' + firstYear + '–' + lastYear + '：' + joinLines(lines, 1000);
      var refs = group.map(function(r) {
        return sourceRef('memoryChronicleRollup', r.id || ('chronicle-rollup-' + slug(r.yearKey || (r.startTurn || r.turn), 'year')), body, { turn: r.endTurn || r.turn });
      });
      out.push({
        id: 'era-rollup-' + slug(firstYear, 'era') + '-' + slug(lastYear, 'era'),
        schemaVersion: SCHEMA_VERSION,
        projectionVersion: PROJECTION_VERSION,
        type: 'historiography_summary',
        body: body,
        authority: 'structured_chronicle',
        visibility: 'public',
        turn: endTurn,
        startTurn: startTurn,
        endTurn: endTurn,
        lane: 'L7_chronicle_context',
        factStatus: 'historiography_summary',
        role: 'rollup',
        sourceRefs: compactRefs(refs, endTurn),
        extra: { stream: 'eraRollup', tier: 2, yearCount: group.length, firstYear: firstYear, lastYear: lastYear }
      });
    }
    return out.slice(-DEFAULT_CAP);
  }

  function rebuildFromArchive(GM, opts) {
    opts = opts || {};
    if (!GM) return { schemaVersion: SCHEMA_VERSION, rebuilt: false, reason: 'missing_gm', chronicleRollups: 0, issueChains: 0, characterDossiers: 0 };
    var bundles = archiveBundles(GM);
    var chronicle = buildChronicleRollups(GM, bundles, opts);
    var issues = buildIssueChains(GM, bundles, opts);
    var characters = buildCharacterDossiers(GM, bundles, opts);
    GM._memoryChronicleRollups = cap(chronicle, opts.chronicleCap || DEFAULT_CAP);
    GM._memoryIssueChains = cap(issues, opts.issueCap || DEFAULT_CAP);
    GM._memoryCharacterDossiers = cap(characters, opts.characterCap || DEFAULT_CAP);
    GM._memoryEraRollups = cap(buildEraRollups(GM, GM._memoryChronicleRollups, opts), opts.eraCap || DEFAULT_CAP); // S7: 第二层 era 折叠
    var result = {
      schemaVersion: SCHEMA_VERSION,
      projectionVersion: PROJECTION_VERSION,
      rebuilt: true,
      archiveBundles: bundles.length,
      chronicleRollups: GM._memoryChronicleRollups.length,
      issueChains: GM._memoryIssueChains.length,
      characterDossiers: GM._memoryCharacterDossiers.length,
      eraRollups: GM._memoryEraRollups.length
    };
    if (Array.isArray(GM._memoryAuditEvents)) {
      GM._memoryAuditEvents.push({
        id: 'memory-turn-rollup-' + Number((opts && opts.turn) || (GM && GM.turn) || 0),
        action: 'rebuild_turn_rollup',
        turn: Number((opts && opts.turn) || (GM && GM.turn) || 0),
        counts: {
          chronicleRollups: result.chronicleRollups,
          issueChains: result.issueChains,
          characterDossiers: result.characterDossiers
        }
      });
    }
    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.harvest) result.longTerm = root.TM.MemoryLongTerm.harvest(GM);
    return result;
  }

  ns.SCHEMA_VERSION = SCHEMA_VERSION;
  ns.PROJECTION_VERSION = PROJECTION_VERSION;
  ns.rebuildFromArchive = rebuildFromArchive;
  ns.buildEraRollups = buildEraRollups;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
