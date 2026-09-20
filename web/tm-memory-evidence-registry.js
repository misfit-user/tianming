(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryEvidenceRegistry = root.TM.MemoryEvidenceRegistry || {};
  var SCHEMA_VERSION = 'memoryEvidence.v1';

  var AUTHORITY_RANK = {
    engine_state: 100,
    player_pin: 90,
    rule_validated: 80,
    internal_sim_state: 78,
    official_record: 72,
    court_report: 66,
    structured_chronicle: 60,
    event_log: 58,
    rule_validated_summary: 55,
    raw_narrative: 50,
    ai_extracted: 45,
    ai_analysis: 40,
    ai_summary: 30,
    vector: 28,
    procedural: 26,
    reflection: 24,
    later_commentary: 22,
    rumor: 20,
    unknown: 0
  };

  function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function clean(value, maxLen) {
    var text = toText(value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.slice(0, maxLen || 240);
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function keys(value) {
    return value && typeof value === 'object' ? Object.keys(value) : [];
  }

  function getAuthorityRank(authority) {
    var key = clean(authority, 60) || 'unknown';
    return AUTHORITY_RANK[key] != null ? AUTHORITY_RANK[key] : AUTHORITY_RANK.unknown;
  }

  function clamp01(value, fallback) {
    var n = Number(value);
    if (!isFinite(n)) return fallback == null ? null : fallback;
    return Math.max(0, Math.min(1, n));
  }

  function normalizeRef(ref, fallback) {
    ref = ref || {};
    fallback = fallback || {};
    var authority = clean(ref.authority || fallback.authority, 60) || 'unknown';
    var out = {
      type: clean(ref.type || fallback.type, 60) || 'unknown',
      id: clean(ref.id || fallback.id, 120) || 'unknown',
      authority: authority,
      authorityRank: ref.authorityRank != null ? Number(ref.authorityRank) : getAuthorityRank(authority)
    };
    if (ref.turn != null || fallback.turn != null) out.turn = Number(ref.turn != null ? ref.turn : fallback.turn || 0);
    if (ref.visibility || fallback.visibility) out.visibility = clean(ref.visibility || fallback.visibility, 80);
    if (ref.lane || fallback.lane) out.lane = clean(ref.lane || fallback.lane, 80);
    if (ref.role || fallback.role) out.role = clean(ref.role || fallback.role, 80);
    return out;
  }

  function getChronicleSystem() {
    if (root.ChronicleSystem) return root.ChronicleSystem;
    return null;
  }

  function chronicleSystemState(GM) {
    var live = getChronicleSystem();
    if (live) return live;
    return GM && GM._chronicleSysState || {};
  }

  function openLike(status) {
    var s = clean(status, 40).toLowerCase();
    return !s || s === 'active' || s === 'pending' || s === 'executing' || s === 'partial' || s === 'obstructed' || s === 'delayed';
  }

  function trackAuthority(track) {
    track = track || {};
    var sourceType = clean(track.sourceType || track.type, 40).toLowerCase();
    if (track.hidden === true || sourceType === 'scheme' || sourceType === 'plot') return 'internal_sim_state';
    if (sourceType === 'edict' || sourceType === 'project' || sourceType === 'keju' || sourceType === 'memorial' || sourceType === 'pendingmemorial') return 'rule_validated';
    return 'structured_chronicle';
  }

  function qijuAuthority(item) {
    item = item || {};
    if (item.edicts || item.xinglu || item.memorials || item.edictsSource) return 'player_pin';
    if (item.zhengwen) return 'official_record';
    return 'event_log';
  }

  function qijuBody(item) {
    item = item || {};
    var parts = [];
    if (item.edicts) parts.push(toText(item.edicts));
    if (item.xinglu) parts.push(item.xinglu);
    if (item.memorials) parts.push(toText(item.memorials));
    if (item.zhengwen) parts.push(item.zhengwen);
    if (item.content) parts.push(item.content);
    if (item.category) parts.push(item.category);
    return parts.filter(Boolean).join(' ');
  }

  function defCopy(def) {
    var out = {};
    Object.keys(def).forEach(function(k) {
      if (typeof def[k] !== 'function') out[k] = def[k];
    });
    return out;
  }

  var DEFINITIONS = [
    { id:'npcPersonalMemory', label:'Personal original memories', path:'GM._memoryArchiveFull', category:'structured_memory', authority:'event_log', role:'record', visibility:'mixed', lane:'L6_retrieved_evidence', promptConsumers:['SC1','SC_RECALL','MemoryEnvelope','dialogue'], memoryEnvelope:true, count:function(GM){return arr(GM&&GM._memoryArchiveFull).length;}, riskFlags:['personal_claims_are_not_world_truth'] },
    {
      id: 'chars',
      label: 'Character hard state',
      path: 'GM.chars',
      category: 'world_state',
      authority: 'engine_state',
      role: 'constraint',
      visibility: 'world_truth',
      lane: 'L1_world_truth',
      promptConsumers: ['SC1', 'SC_RECALL', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM.chars).length; },
      sampleRefs: function(GM) {
        return arr(GM && GM.chars).slice(0, 3).map(function(ch, i) {
          return normalizeRef({ type: 'char', id: ch && (ch.id || ch.name) || ('char-' + i), turn: ch && (ch.lastUpdateTurn || ch.updatedTurn) }, this);
        }, this);
      }
    },
    {
      id: 'activeEdicts',
      label: 'Active edicts',
      path: 'GM.activeEdicts',
      category: 'player_order',
      authority: 'player_pin',
      role: 'command',
      visibility: 'world_truth',
      lane: 'L2_active_law_commitment',
      promptConsumers: ['SC1', 'SC_RECALL', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM.activeEdicts).filter(function(e) { return openLike(e && e.status); }).length; }
    },
    {
      id: 'edictTracker',
      label: 'Tracked edict execution',
      path: 'GM._edictTracker',
      category: 'player_order',
      authority: 'player_pin',
      role: 'command',
      visibility: 'world_truth',
      lane: 'L2_active_law_commitment',
      promptConsumers: ['SC1', 'SC_RECALL', 'apply', 'render'],
      memoryEnvelope: true,
      riskFlags: ['multi_writer_order_sensitive'],
      count: function(GM) { return arr(GM && GM._edictTracker).filter(function(e) { return openLike(e && e.status); }).length; }
    },
    {
      id: 'memTables',
      label: 'Memory tables',
      path: 'GM._memTables',
      category: 'structured_memory',
      authority: 'rule_validated',
      role: 'constraint',
      visibility: 'mixed',
      lane: 'L2_active_law_commitment',
      promptConsumers: ['SC1', 'MemTables'],
      memoryEnvelope: true,
      riskFlags: ['dual_write_channel'],
      count: function(GM) {
        var tables = GM && GM._memTables || {};
        return keys(tables).reduce(function(sum, k) {
          return sum + arr(tables[k] && tables[k].rows).length;
        }, 0);
      }
    },
    {
      id: 'currentIssues',
      label: 'Current political issues',
      path: 'GM.currentIssues',
      category: 'agenda',
      authority: 'ai_analysis',
      role: 'advisory',
      visibility: 'public',
      lane: 'L5_advisory_context',
      promptConsumers: ['SC1 sysP'],
      memoryEnvelope: true,
      riskFlags: ['advisory_can_gain_fact_inertia'],
      count: function(GM) { return arr(GM && GM.currentIssues).length; }
    },
    {
      id: 'shijiHistory',
      label: 'Turn history records',
      path: 'GM.shijiHistory',
      category: 'official_record',
      authority: 'raw_narrative',
      role: 'record',
      visibility: 'public',
      lane: 'L6_retrieved_evidence',
      promptConsumers: ['SC0', 'SC0.5', 'SC_RECALL', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM.shijiHistory).length; }
    },
    {
      id: 'qijuHistory',
      label: 'Court diary',
      path: 'GM.qijuHistory',
      category: 'official_record',
      authority: 'official_record',
      role: 'record',
      visibility: 'public',
      lane: 'L6_retrieved_evidence',
      promptConsumers: ['qiju fragment', 'MemoryEnvelope'],
      memoryEnvelope: true,
      riskFlags: ['mixed_schema', 'partial_prompt_read'],
      count: function(GM) { return arr(GM && GM.qijuHistory).length; }
    },
    {
      id: 'jishiRecords',
      label: 'Audience records',
      path: 'GM.jishiRecords',
      category: 'dialogue',
      authority: 'court_report',
      role: 'reported_input',
      visibility: 'mixed',
      lane: 'L4_dialogue_evidence',
      promptConsumers: ['SC1q', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM.jishiRecords).length; }
    },
    {
      id: 'npcRelationEvents',
      label: 'NPC relation event ledger',
      path: 'GM._npcRelationEvents',
      category: 'relationship',
      authority: 'event_log',
      role: 'record',
      visibility: 'internal',
      lane: 'L4_dialogue_evidence',
      promptConsumers: ['MemoryEnvelope', 'SC_RECALL'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM._npcRelationEvents).length; }
    },
    {
      id: 'biannianItems',
      label: 'Chronicle items',
      path: 'GM.biannianItems',
      category: 'chronicle',
      authority: 'structured_chronicle',
      role: 'record',
      visibility: 'public',
      lane: 'L7_chronicle_context',
      promptConsumers: ['records UI', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM.biannianItems).length; }
    },
    {
      id: 'chronicleTracks',
      label: 'Long-running affairs',
      path: 'GM._chronicleTracks',
      category: 'long_term_affair',
      authority: 'rule_validated',
      role: 'constraint',
      visibility: 'mixed',
      lane: 'L3_long_term_affair',
      promptConsumers: ['SC1', 'SC1b', 'SC1c', 'SC_RECALL', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM._chronicleTracks).length; },
      hiddenCount: function(GM) { return arr(GM && GM._chronicleTracks).filter(function(t) { return t && t.hidden === true; }).length; }
    },
    {
      id: 'chronicleSystem',
      label: 'Chronicle summaries',
      path: 'ChronicleSystem.monthDrafts/yearChronicles',
      category: 'historiography',
      authority: 'ai_summary',
      role: 'summary',
      visibility: 'public',
      lane: 'L7_chronicle_context',
      promptConsumers: ['records UI', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) {
        var cs = chronicleSystemState(GM);
        return keys(cs.monthDrafts).length + keys(cs.yearChronicles).length;
      }
    },
    {
      id: 'foreshadows',
      label: 'Foreshadows',
      path: 'GM._foreshadows',
      category: 'narrative_thread',
      authority: 'ai_extracted',
      role: 'narrative_thread',
      visibility: 'mixed',
      lane: 'L8_narrative_threads',
      promptConsumers: ['SC0', 'SC_RECALL', 'MemoryEnvelope'],
      memoryEnvelope: true,
      count: function(GM) { return arr(GM && GM._foreshadows).length; }
    },
    {
      id: 'stateBoard',
      label: 'State board',
      path: 'GM._stateBoard',
      category: 'cross_turn_summary',
      authority: 'rule_validated_summary',
      role: 'constraint',
      visibility: 'internal',
      lane: 'L5_advisory_context',
      promptConsumers: ['SC1'],
      memoryEnvelope: false,
      count: function(GM) { return GM && GM._stateBoard ? 1 : 0; }
    },
    {
      id: 'proceduralLessons',
      label: 'Procedural lessons',
      path: 'GM._proceduralLessons',
      category: 'procedural_memory',
      authority: 'procedural',
      role: 'procedural',
      visibility: 'internal',
      lane: 'L5_advisory_context',
      promptConsumers: ['MemoryEnvelope', 'SC_RECALL'],
      memoryEnvelope: true,
      riskFlags: ['must_not_promote_to_fact'],
      count: function(GM) { return arr(GM && GM._proceduralLessons).length; }
    },
    {
      id: 'aiReflections',
      label: 'AI reflection lessons',
      path: 'GM._aiReflections',
      category: 'procedural_memory',
      authority: 'reflection',
      role: 'procedural',
      visibility: 'internal',
      lane: 'L5_advisory_context',
      promptConsumers: ['MemoryEnvelope', 'SC_RECALL'],
      memoryEnvelope: true,
      riskFlags: ['ai_advice_not_fact'],
      count: function(GM) { return arr(GM && GM._aiReflections).length; }
    },
    {
      id: 'lastSc28Snapshot',
      label: 'Last sc28 snapshot',
      path: 'GM._lastSc28Snapshot',
      category: 'cross_turn_summary',
      authority: 'ai_summary',
      role: 'background',
      visibility: 'internal',
      lane: 'L5_advisory_context',
      promptConsumers: ['SC1'],
      memoryEnvelope: false,
      count: function(GM) { return GM && GM._lastSc28Snapshot ? 1 : 0; }
    },
    {
      id: 'consolidatedMemory',
      label: 'Consolidated memory',
      path: 'GM._consolidatedMemory',
      category: 'cross_turn_summary',
      authority: 'ai_summary',
      role: 'background',
      visibility: 'internal',
      lane: 'L8_narrative_threads',
      promptConsumers: ['SC1'],
      memoryEnvelope: false,
      count: function(GM) { return GM && GM._consolidatedMemory ? 1 : 0; }
    },
    {
      id: 'turnAiResults',
      label: 'Turn AI result bus',
      path: 'GM._turnAiResults',
      category: 'ephemeral',
      authority: 'ai_summary',
      role: 'ephemeral_bus',
      visibility: 'internal',
      lane: 'diagnostics',
      promptConsumers: ['followup', 'render', 'post-turn jobs'],
      memoryEnvelope: false,
      riskFlags: ['ephemeral_bus', 'lineage_hotspot'],
      count: function(GM) { return GM && GM._turnAiResults ? keys(GM._turnAiResults).length : 0; }
    }
  ];

  function scanSource(def, GM) {
    var count = 0;
    var hiddenCount = 0;
    var sampleRefs = [];
    try { count = Number(def.count ? def.count(GM) : 0) || 0; } catch (_) { count = 0; }
    try { hiddenCount = Number(def.hiddenCount ? def.hiddenCount(GM) : 0) || 0; } catch (_) { hiddenCount = 0; }
    try { sampleRefs = def.sampleRefs ? def.sampleRefs(GM) : []; } catch (_) { sampleRefs = []; }
    return {
      id: def.id,
      label: def.label,
      path: def.path,
      category: def.category,
      authority: def.authority,
      authorityRank: getAuthorityRank(def.authority),
      role: def.role,
      visibility: def.visibility,
      lane: def.lane,
      promptConsumers: arr(def.promptConsumers).slice(),
      memoryEnvelope: def.memoryEnvelope === true,
      count: count,
      hiddenCount: hiddenCount,
      present: count > 0,
      sampleRefs: arr(sampleRefs).slice(0, 5),
      riskFlags: arr(def.riskFlags).slice()
    };
  }

  function buildEvidenceSnapshot(GM, opts) {
    opts = opts || {};
    var sources = DEFINITIONS.map(function(def) { return scanSource(def, GM || {}); });
    var byAuthority = {};
    var byRole = {};
    sources.forEach(function(src) {
      if (!src.present) return;
      byAuthority[src.authority] = (byAuthority[src.authority] || 0) + src.count;
      byRole[src.role] = (byRole[src.role] || 0) + src.count;
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      turn: Number((GM && GM.turn) || opts.turn || 0),
      sources: sources,
      byAuthority: byAuthority,
      byRole: byRole,
      counts: {
        sources: sources.length,
        present: sources.filter(function(s) { return s.present; }).length,
        memoryEnvelopeSources: sources.filter(function(s) { return s.memoryEnvelope; }).length,
        hidden: sources.reduce(function(sum, s) { return sum + Number(s.hiddenCount || 0); }, 0)
      }
    };
  }

  function pushBasisRef(out, seen, ref, maxRefs) {
    if (!ref || out.length >= maxRefs) return;
    var item = normalizeRef(ref);
    var key = item.type + ':' + item.id;
    if (seen[key]) return;
    seen[key] = true;
    out.push(item);
  }

  function buildBasisRefs(GM, opts) {
    opts = opts || {};
    GM = GM || {};
    var maxRefs = Math.max(1, Number(opts.maxRefs || 24));
    var out = [];
    var seen = {};
    arr(GM._edictTracker).slice(-10).forEach(function(e, i) {
      if (!e || !openLike(e.status)) return;
      pushBasisRef(out, seen, { type: 'edictTracker', id: e.id || ('tracked-edict-' + i), turn: e.turn || GM.turn, authority: 'player_pin', visibility: 'world_truth', lane: 'L2_active_law_commitment', role: 'command' }, maxRefs);
    });
    arr(GM.qijuHistory).slice(-10).forEach(function(q, i) {
      if (!q) return;
      var authority = qijuAuthority(q);
      pushBasisRef(out, seen, { type: 'qijuHistory', id: q.id || ('qiju-' + (q.turn || i) + '-' + i), turn: q.turn || GM.turn, authority: authority, visibility: 'public', lane: authority === 'player_pin' ? 'L2_active_law_commitment' : 'L6_retrieved_evidence', role: authority === 'player_pin' ? 'command' : 'record' }, maxRefs);
    });
    arr(GM.currentIssues).slice(-10).forEach(function(issue, i) {
      if (!issue) return;
      pushBasisRef(out, seen, { type: 'currentIssues', id: issue.id || ('issue-' + i), turn: issue.raisedTurn || issue.turn || GM.turn, authority: issue.authorityLevel || 'ai_analysis', visibility: 'public', lane: 'L5_advisory_context', role: 'advisory' }, maxRefs);
    });
    arr(GM.jishiRecords).slice(-10).forEach(function(r, i) {
      if (!r) return;
      pushBasisRef(out, seen, { type: 'jishiRecords', id: r.id || ('jishi-' + (r.turn || GM.turn) + '-' + (r.char || i) + '-' + i), turn: r.turn || GM.turn, authority: 'court_report', visibility: 'mixed', lane: 'L4_dialogue_evidence', role: 'reported_input' }, maxRefs);
    });
    arr(GM._chronicleTracks).slice(-10).forEach(function(t, i) {
      if (!t) return;
      var authority = trackAuthority(t);
      pushBasisRef(out, seen, { type: 'chronicleTrack', id: t.id || t.sourceId || ('track-' + i), turn: t.turn || t.startedTurn || GM.turn, authority: authority, visibility: t.hidden ? 'gm_hidden' : 'public', lane: 'L3_long_term_affair', role: 'constraint' }, maxRefs);
    });
    arr(GM.shijiHistory).slice(-8).forEach(function(sh, i) {
      if (!sh) return;
      pushBasisRef(out, seen, { type: 'shijiHistory', id: sh.id || ('shiji-' + (sh.turn || i)), turn: sh.turn, authority: sh.authorityLevel || sh.authority || 'raw_narrative', visibility: sh.visibility || 'public', lane: 'L6_retrieved_evidence', role: 'record' }, maxRefs);
    });
    return out.slice(0, maxRefs);
  }

  ns.AUTHORITY_RANK = AUTHORITY_RANK;
  ns.getDefinitions = function() { return DEFINITIONS.map(defCopy); };
  ns.getAuthorityRank = getAuthorityRank;
  ns.normalizeRef = normalizeRef;
  ns.trackAuthority = trackAuthority;
  ns.qijuAuthority = qijuAuthority;
  ns.qijuBody = qijuBody;
  ns.buildEvidenceSnapshot = buildEvidenceSnapshot;
  ns.buildBasisRefs = buildBasisRefs;
  ns.clampConfidence = clamp01;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
