// @ts-check
/*
 * tm-huji-governance-loop.js
 * Turns formal player operations into governable hukou/corvee/military commitments.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_COMMITMENTS = 80;
  var MAX_EVENTS = 120;
  var DEFAULT_MOUTHS_PER_HOUSEHOLD = 5;

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

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

  function number(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (Number(fallback) || 0);
  }

  function round(v) {
    return Math.max(0, Math.round(number(v, 0)));
  }

  function round2(v) {
    return Math.round(number(v, 0) * 100) / 100;
  }

  function clamp(n, min, max) {
    n = number(n, min);
    return Math.max(min, Math.min(max, n));
  }

  function textOf(raw) {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) return raw.map(textOf).filter(Boolean).join(' ');
    if (typeof raw === 'object') {
      var keys = ['text', 'content', 'summary', 'desc', 'description', 'agenda', 'goal', 'objective', 'topic', 'title', 'name', 'action', 'targetText', 'reason'];
      for (var i = 0; i < keys.length; i += 1) {
        if (raw[keys[i]] !== undefined && raw[keys[i]] !== null && raw[keys[i]] !== '') return textOf(raw[keys[i]]);
      }
    }
    return '';
  }

  function compact(v, maxLen) {
    var text = textOf(v).replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 180;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function unique(list) {
    var seen = {};
    var out = [];
    toArray(list).forEach(function(v) {
      var key = String(v || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function ensureStore(root) {
    root = pickRoot(root);
    if (!root._hujiGovernanceLoop || typeof root._hujiGovernanceLoop !== 'object' || Array.isArray(root._hujiGovernanceLoop)) {
      root._hujiGovernanceLoop = {
        turn: Number(root.turn) || 0,
        seq: 0,
        lastPlayerActionSeq: 0,
        events: [],
        stats: {
          ingested: 0,
          created: 0,
          duplicates: 0,
          ticked: 0,
          completed: 0,
          stalled: 0
        }
      };
    }
    var store = root._hujiGovernanceLoop;
    if (!Array.isArray(store.events)) store.events = [];
    if (!store.stats) store.stats = {};
    return store;
  }

  function ensureCommitments(root) {
    root = pickRoot(root);
    if (!Array.isArray(root._hujiCommitments)) root._hujiCommitments = [];
    return root._hujiCommitments;
  }

  function ensureCauseStore(root) {
    root = pickRoot(root);
    if (!root._hujiGovernanceCauses || typeof root._hujiGovernanceCauses !== 'object' || Array.isArray(root._hujiGovernanceCauses)) {
      root._hujiGovernanceCauses = { items: [], stats: { recorded: 0 } };
    }
    if (!Array.isArray(root._hujiGovernanceCauses.items)) root._hujiGovernanceCauses.items = [];
    if (!root._hujiGovernanceCauses.stats) root._hujiGovernanceCauses.stats = { recorded: 0 };
    return root._hujiGovernanceCauses;
  }

  function recordCause(root, commitment, raw, options) {
    root = pickRoot(root);
    raw = raw || {};
    commitment = commitment || {};
    options = options || {};
    var store = ensureCauseStore(root);
    store.stats.recorded = (Number(store.stats.recorded) || 0) + 1;
    var row = {
      id: 'huji-cause-' + (Number(options.turn != null ? options.turn : root.turn) || 0) + '-' + store.stats.recorded,
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      type: raw.type || 'cause',
      source: raw.source || options.source || 'huji-governance-loop',
      commitmentId: commitment.id || raw.commitmentId || '',
      commitmentType: commitment.type || raw.commitmentType || '',
      linkedIssue: commitment.linkedIssue || raw.linkedIssue || '',
      executorOffice: commitment.executorOffice || raw.executorOffice || '',
      executorHolder: commitment.executorHolder || raw.executorHolder || '',
      executorReliability: commitment.executorReliability != null ? commitment.executorReliability : raw.executorReliability,
      reason: compact(raw.reason || commitment.title || commitment.text || '', 220),
      effects: clone(raw.effects || raw.applied || null),
      at: Date.now()
    };
    store.items.push(row);
    if (store.items.length > 120) store.items = store.items.slice(-120);
    return clone(row);
  }

  function getCauseLedger(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureCauseStore(root);
    var limit = Math.max(1, Math.min(60, Number(options.limit || 12) || 12));
    return {
      count: store.items.length,
      items: store.items.slice(-limit).map(clone),
      stats: clone(store.stats)
    };
  }

  function pushEvent(root, type, payload, options) {
    root = pickRoot(root);
    var store = ensureStore(root);
    var event = {
      type: type || 'event',
      turn: Number(options && options.turn != null ? options.turn : root.turn) || 0,
      source: options && options.source || 'huji-governance-loop',
      payload: clone(payload || {}),
      at: Date.now()
    };
    store.events.push(event);
    if (store.events.length > MAX_EVENTS) store.events = store.events.slice(-MAX_EVENTS);
    return clone(event);
  }

  function walkAdminNode(node, out) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(function(child) { walkAdminNode(child, out); });
      return;
    }
    if (typeof node !== 'object') return;
    var kids = node.children || node.divisions || node.subs || node.subdivisions || node.items || [];
    if (Array.isArray(kids) && kids.length) {
      kids.forEach(function(child) { walkAdminNode(child, out); });
      return;
    }
    if (node.id || node.name || node.populationDetail || node.population || node.mouths || node.households) out.push(node);
  }

  function getLeafRegions(root) {
    root = pickRoot(root);
    var leaves = [];
    if (root.adminHierarchy) {
      if (global.IntegrationBridge && typeof global.IntegrationBridge.getLeafDivisions === 'function') {
        try { leaves = global.IntegrationBridge.getLeafDivisions(root.adminHierarchy) || []; } catch (_) { leaves = []; }
      }
      if (!leaves.length) {
        Object.keys(root.adminHierarchy || {}).forEach(function(k) {
          walkAdminNode(root.adminHierarchy[k], leaves);
        });
      }
    }
    if (!leaves.length && Array.isArray(root.regions)) leaves = root.regions.slice();
    return leaves.filter(function(row) { return row && typeof row === 'object'; });
  }

  function walkOfficeNode(node, out, parentName) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(function(child) { walkOfficeNode(child, out, parentName); });
      return;
    }
    if (typeof node !== 'object') return;
    var deptName = compact(node.name || node.title || node.id || parentName || '', 120);
    var positions = toArray(node.positions || node.posts || node.offices);
    if (!positions.length && (node.holder || node.actualHolders || node.authority || node.duties)) positions = [node];
    positions.forEach(function(pos) {
      if (!pos || typeof pos !== 'object') return;
      out.push({
        deptName: deptName,
        officeName: compact(pos.name || pos.title || pos.id || deptName, 120),
        holder: compact(pos.holder || pos.official || pos.currentHolder || (toArray(pos.actualHolders)[0] && (toArray(pos.actualHolders)[0].name || toArray(pos.actualHolders)[0].holder)) || '', 120),
        authority: compact(pos.authority || pos.power || '', 80),
        duties: compact(pos.duties || pos.desc || pos.description || node.functions || node.desc || '', 260),
        raw: pos
      });
    });
    toArray(node.subs || node.children || node.divisions || node.nodes).forEach(function(child) {
      walkOfficeNode(child, out, deptName);
    });
  }

  function collectOffices(root) {
    root = pickRoot(root);
    var rows = [];
    var candidates = [
      root.government && root.government.nodes,
      root.government && root.government.officeTree,
      root.officeTree,
      root.offices,
      root.scriptData && root.scriptData.government && root.scriptData.government.nodes,
      root.scriptData && root.scriptData.officeTree
    ];
    candidates.forEach(function(list) { walkOfficeNode(list, rows, ''); });
    return rows;
  }

  function allCharacters(root) {
    return toArray(root.characters).concat(toArray(root.chars), toArray(root.allCharacters), toArray(root.people));
  }

  function findCharacter(root, name) {
    var wanted = compact(name || '', 120).toLowerCase();
    if (!wanted) return null;
    return allCharacters(root).filter(function(ch) { return ch && typeof ch === 'object'; }).find(function(ch) {
      return compact(ch.name || ch.id || ch.fullName || '', 120).toLowerCase() === wanted;
    }) || null;
  }

  function executorPattern(type) {
    if (type === 'hukou_census') return /户部|民部|度支|版籍|户口|户籍|黄册|税|revenue|population|census|household/i;
    if (type === 'corvee_commutation') return /工部|营缮|水利|河工|徭役|役|工役|works|labor|labour|corvee/i;
    if (type === 'military_register') return /兵部|枢密|军|卫所|五军|兵源|募兵|war|military|defen[cs]e|garrison/i;
    return /户部|工部|兵部|revenue|works|war/i;
  }

  function defaultExecutor(type, root) {
    var corruption = number(root && root.corruption && (root.corruption.trueIndex || root.corruption.index || root.corruption.value), 42);
    var reliability = round2(clamp(0.72 - corruption / 260, 0.28, 0.78));
    var name = type === 'hukou_census' ? 'Household registration office'
      : type === 'corvee_commutation' ? 'Public works and corvee office'
      : type === 'military_register' ? 'Military registration office'
      : 'Huji governance office';
    return {
      executorOffice: name,
      executorDept: name,
      executorHolder: '',
      executorAuthority: 'execution',
      executorReliability: reliability,
      executorReason: 'fallback executor from scenario runtime data'
    };
  }

  function reliabilityForOffice(root, office, type) {
    var ch = findCharacter(root, office && office.holder);
    var raw = office && office.raw || {};
    var loyalty = number(ch && (ch.loyalty || ch.loyal), number(raw.loyalty, 58));
    var corruption = number(ch && (ch.corruption || ch.corrupt), number(raw.corruption, number(root.corruption && (root.corruption.trueIndex || root.corruption.index || root.corruption.value), 42)));
    var competence = type === 'military_register'
      ? number(ch && (ch.military || ch.command || ch.war), number(raw.military, 60))
      : number(ch && (ch.administration || ch.politics || ch.intelligence || ch.ability), number(raw.administration, 60));
    var vacancyPenalty = office && office.holder ? 0 : 0.18;
    var authorityBonus = /decision|execution|决策|执行|尚书|侍郎|minister|secretary/i.test(String((office && office.authority) + ' ' + (office && office.officeName))) ? 0.06 : 0;
    return round2(clamp(0.42 + competence / 260 + loyalty / 520 - corruption / 260 + authorityBonus - vacancyPenalty, 0.22, 0.96));
  }

  function assignExecutor(root, type) {
    root = pickRoot(root);
    var pattern = executorPattern(type);
    var offices = collectOffices(root);
    var scored = offices.map(function(office) {
      var hay = [office.deptName, office.officeName, office.duties, office.authority].join(' ');
      var score = pattern.test(hay) ? 10 : 0;
      if (/decision|execution|决策|执行/i.test(office.authority)) score += 2;
      if (office.holder) score += 2;
      if (/尚书|侍郎|minister|secretary|卿|令/i.test(office.officeName)) score += 1;
      return { office: office, score: score };
    }).filter(function(row) { return row.score > 0; }).sort(function(a, b) { return b.score - a.score; });
    if (!scored.length) return defaultExecutor(type, root);
    var office = scored[0].office;
    return {
      executorOffice: office.officeName || office.deptName,
      executorDept: office.deptName || office.officeName,
      executorHolder: office.holder || '',
      executorAuthority: office.authority || '',
      executorReliability: reliabilityForOffice(root, office, type),
      executorReason: 'matched government office by huji commitment type'
    };
  }

  function detailValue(region, field) {
    if (!region || typeof region !== 'object') return 0;
    var detail = region.populationDetail || region.population || region.hukou || {};
    if (field === 'hiddenCount') return round(detail.hiddenCount || detail.hidden || detail.hiddenPopulation || detail.unregistered || region.hiddenCount || region.hidden || 0);
    if (field === 'fugitives') return round(detail.fugitives || detail.refugees || detail.escapees || detail.taoohu || region.fugitives || region.refugees || 0);
    return round(detail[field] || region[field] || 0);
  }

  function sumRegional(root, field) {
    return getLeafRegions(root).reduce(function(sum, region) {
      return sum + detailValue(region, field);
    }, 0);
  }

  function syncPopulationCaches(root) {
    root = pickRoot(root);
    if (global.HujiEngine && global.HujiEngine.isPopulationLedgerV2 && global.HujiEngine.isPopulationLedgerV2(root) && TM.HujiRuntimeBridge) {
      var maintained = TM.HujiRuntimeBridge.maintain(root,{source:'hukou-governance-ledger',applyHardEffects:false});
      return maintained.snapshot.hukou;
    }
    root.population = root.population && typeof root.population === 'object' ? root.population : {};
    root.population.national = root.population.national && typeof root.population.national === 'object' ? root.population.national : {};
    root.hukou = root.hukou && typeof root.hukou === 'object' ? root.hukou : {};

    var hidden = sumRegional(root, 'hiddenCount');
    var fugitives = sumRegional(root, 'fugitives');
    if (!hidden && root.population.hiddenCount) hidden = round(root.population.hiddenCount);
    if (!fugitives && (root.population.fugitives || root.hukou.fugitives || root.hukou.refugees)) fugitives = round(root.population.fugitives || root.hukou.fugitives || root.hukou.refugees);

    var households = round(root.hukou.registeredHouseholds || root.population.national.households || 0);
    var mouths = round(root.hukou.registeredMouths || root.population.national.mouths || households * DEFAULT_MOUTHS_PER_HOUSEHOLD);
    var mouthsPerHousehold = households ? mouths / Math.max(1, households) : DEFAULT_MOUTHS_PER_HOUSEHOLD;
    var hiddenHouseholds = round(hidden / Math.max(2.5, mouthsPerHousehold || DEFAULT_MOUTHS_PER_HOUSEHOLD));
    var fugitiveHouseholds = round(fugitives / Math.max(2.5, mouthsPerHousehold || DEFAULT_MOUTHS_PER_HOUSEHOLD));
    var hiddenTaxCap = round(households * 0.65);
    var taxHiddenHouseholds = Math.min(hiddenTaxCap, hiddenHouseholds + fugitiveHouseholds);
    var effectiveTaxHouseholds = Math.max(0, households - taxHiddenHouseholds);

    root.population.hiddenCount = hidden;
    root.population.fugitives = fugitives;
    root.population.national.hiddenCount = hidden;
    root.population.national.fugitives = fugitives;
    root.population.national.hiddenHouseholds = hiddenHouseholds;
    root.population.national.fugitiveHouseholds = fugitiveHouseholds;
    root.population.national.effectiveTaxHouseholds = effectiveTaxHouseholds;
    root.hukou.estimatedHidden = hidden;
    root.hukou.hiddenHouseholds = hiddenHouseholds;
    root.hukou.refugees = fugitives;
    root.hukou.fugitives = fugitives;
    root.hukou.fugitiveHouseholds = fugitiveHouseholds;
    root.hukou.effectiveTaxHouseholds = effectiveTaxHouseholds;
    root.hukou.taxBaseRatio = households ? Number((effectiveTaxHouseholds / Math.max(1, households)).toFixed(3)) : 0;
    return {
      hiddenCount: hidden,
      fugitives: fugitives,
      effectiveTaxHouseholds: effectiveTaxHouseholds,
      taxBaseRatio: root.hukou.taxBaseRatio
    };
  }

  function applyRegionalPopulationDelta(root, field, reduction) {
    root = pickRoot(root);
    reduction = round(reduction);
    if (reduction <= 0) return 0;
    var leaves = getLeafRegions(root);
    var total = leaves.reduce(function(sum, region) { return sum + detailValue(region, field); }, 0);
    if (total <= 0) {
      if (global.HujiEngine && global.HujiEngine.isPopulationLedgerV2 && global.HujiEngine.isPopulationLedgerV2(root)) return 0;
      if (field === 'hiddenCount') {
        root.population = root.population || {};
        root.population.hiddenCount = Math.max(0, round(root.population.hiddenCount) - reduction);
        root.hukou = root.hukou || {};
        root.hukou.estimatedHidden = Math.max(0, round(root.hukou.estimatedHidden) - reduction);
      } else if (field === 'fugitives') {
        root.population = root.population || {};
        root.population.fugitives = Math.max(0, round(root.population.fugitives) - reduction);
        root.hukou = root.hukou || {};
        root.hukou.fugitives = Math.max(0, round(root.hukou.fugitives) - reduction);
        root.hukou.refugees = Math.max(0, round(root.hukou.refugees) - reduction);
      }
      syncPopulationCaches(root);
      return reduction;
    }
    var remaining = Math.min(reduction, total);
    var applied = 0;
    leaves.forEach(function(region, idx) {
      var current = detailValue(region, field);
      if (current <= 0 || remaining <= 0) return;
      var share = idx === leaves.length - 1 ? remaining : Math.min(current, Math.round(reduction * (current / Math.max(1, total))));
      if (share <= 0 && current > 0 && remaining > 0) share = 1;
      share = Math.min(current, remaining, share);
      var detail = region.populationDetail || region.population || region.hukou || {};
      if (!region.populationDetail || typeof region.populationDetail !== 'object') {
        region.populationDetail = Object.assign({}, typeof detail === 'object' ? detail : {});
        detail = region.populationDetail;
      }
      if (global.HujiEngine && global.HujiEngine.isPopulationLedgerV2 && global.HujiEngine.isPopulationLedgerV2(root)) {
        var changed = global.HujiEngine.applyRegistrationStatusChange({root:root,detail:detail,region:region,status:field === 'hiddenCount' ? 'hidden' : 'fled',deltaMouths:-share,cause:'hukou-governance'});
        if (changed.ok) { var recovered = Math.max(0,-changed.appliedMouths); remaining -= recovered; applied += recovered; }
        return;
      }
      if (field === 'hiddenCount') {
        detail.hiddenCount = Math.max(0, current - share);
        if (detail.hidden !== undefined) detail.hidden = detail.hiddenCount;
        if (detail.hiddenPopulation !== undefined) detail.hiddenPopulation = detail.hiddenCount;
        if (detail.unregistered !== undefined) detail.unregistered = detail.hiddenCount;
        if (region.hiddenCount !== undefined) region.hiddenCount = detail.hiddenCount;
        if (region.hidden !== undefined) region.hidden = detail.hiddenCount;
      } else if (field === 'fugitives') {
        detail.fugitives = Math.max(0, current - share);
        if (detail.refugees !== undefined) detail.refugees = detail.fugitives;
        if (detail.escapees !== undefined) detail.escapees = detail.fugitives;
        if (detail.taoohu !== undefined) detail.taoohu = detail.fugitives;
        if (region.fugitives !== undefined) region.fugitives = detail.fugitives;
        if (region.refugees !== undefined) region.refugees = detail.fugitives;
      }
      remaining -= share;
      applied += share;
    });
    syncPopulationCaches(root);
    return applied;
  }

  function getTreasury(root) {
    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    var v = root.guoku.balance;
    if (v === undefined || v === null) v = root.guoku.money;
    if (v === undefined || v === null) v = root.guoku.cash;
    return Math.max(0, number(v, 0));
  }

  function spendTreasury(root, amount) {
    root = pickRoot(root);
    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    amount = Math.max(0, round2(amount));
    if (!amount) return 0;
    var available = getTreasury(root);
    var paid = Math.min(available, amount);
    if (root.guoku.balance !== undefined) root.guoku.balance = round2(Math.max(0, number(root.guoku.balance, 0) - paid));
    if (root.guoku.money !== undefined) root.guoku.money = round2(Math.max(0, number(root.guoku.money, 0) - paid));
    if (root.guoku.cash !== undefined) root.guoku.cash = round2(Math.max(0, number(root.guoku.cash, 0) - paid));
    return paid;
  }

  function operationText(raw) {
    raw = raw || {};
    return [
      raw.channel,
      raw.kind,
      raw.action,
      raw.topic,
      raw.title,
      raw.linkedIssue,
      raw.issueId,
      raw.text,
      raw.content,
      raw.targetText,
      toArray(raw.policyTags || raw.tags).join(' ')
    ].map(textOf).filter(Boolean).join(' ');
  }

  function isFormalOperation(raw) {
    var lower = operationText(raw).toLowerCase();
    return /formal|edict|decree|memorial|petition|reply|court|debate|tinyi|chaoyi|audience|wendui|hongyan|letter|\u8bcf\u4e66|\u8bcf\u4ee4|\u594f\u758f|\u6279\u590d|\u5ef7\u8bae|\u671d\u8bae|\u95ee\u5bf9|\u9e3f\u96c1|\u4f20\u4e66/.test(lower);
  }

  function localTags(raw) {
    var lower = operationText(raw).toLowerCase();
    var tags = [];
    function add(tag, re) {
      if (re.test(lower) && tags.indexOf(tag) < 0) tags.push(tag);
    }
    add('hukou', /hukou|census|household|population|registry|register|yellow\s*book|hidden|fugitive|refugee|resettle|unregistered|\u6237\u53e3|\u6237\u7c4d|\u9ec4\u518c|\u767d\u518c|\u9690\u6237|\u9003\u6237|\u6d41\u6c11|\u62db\u629a|\u4fdd\u7532|\u91cc\u7532|\u6e05\u4e08|\u6e05\u67e5/);
    add('corvee', /corvee|labor|labour|service|commutation|commute|silver|tax\s*labor|public\s*works|\u5fAD\u5F79|\u5F79\u6CD5|\u4E00\u6761\u97AD|\u6298\u94F6|\u5DE5\u5F79|\u6CB3\u5DE5|\u5927\u5DE5/);
    add('military', /military|army|soldier|draft|recruit|garrison|border|frontier|service\s*pool|\u519b\u6237|\u536B\u6240|\u52DF\u5175|\u5F81\u5175|\u5175\u6E90|\u5B88\u8FB9|\u8FB9\u9632/);
    return tags;
  }

  function classifyOperation(raw) {
    raw = raw || {};
    var bridgeClassified = null;
    try {
      if (TM.HujiRuntimeBridge && typeof TM.HujiRuntimeBridge.classifyPlayerOperation === 'function') {
        bridgeClassified = TM.HujiRuntimeBridge.classifyPlayerOperation(raw);
      }
    } catch (_) {}
    var tags = unique(toArray(raw.tags || raw.policyTags).concat(localTags(raw)).concat(bridgeClassified && bridgeClassified.tags || []));
    var text = compact(raw.text || raw.content || raw.targetText || (bridgeClassified && bridgeClassified.text) || operationText(raw), 260);
    return {
      text: text,
      tags: tags,
      actionTypes: unique(toArray(raw.actionTypes).concat(bridgeClassified && bridgeClassified.actionTypes || [])),
      linkedIssue: raw.linkedIssue || raw.issueId || raw.chaoyiTrackId || (bridgeClassified && bridgeClassified.linkedIssue) || '',
      confidence: bridgeClassified && bridgeClassified.confidence ? bridgeClassified.confidence : (tags.length ? 0.76 : 0)
    };
  }

  function socialLinkedIssueForSignal(root, signal) {
    if (!root || !signal) return '';
    var direct = signal.linkedIssue || signal.issueId || signal.chaoyiTrackId || '';
    if (direct) return direct;
    var items = root._socialPoliticalSignals && Array.isArray(root._socialPoliticalSignals.items) ? root._socialPoliticalSignals.items : [];
    var text = compact(signal.text || signal.content || signal.targetText || '', 120);
    var turn = Number(signal.turn) || Number(root.turn) || 0;
    for (var i = items.length - 1; i >= 0; i -= 1) {
      var row = items[i];
      if (!row || !row.linkedIssue) continue;
      if (row.sourceSystem !== 'player-action') continue;
      if (turn && row.turn && Number(row.turn) !== turn) continue;
      var reason = compact(row.reason || '', 160);
      if (!text || reason.indexOf(text.slice(0, 80)) >= 0 || text.indexOf(reason.slice(0, 80)) >= 0) return row.linkedIssue;
    }
    return '';
  }

  function commitmentTitle(type) {
    if (type === 'hukou_census') return 'Hukou census and resettlement';
    if (type === 'corvee_commutation') return 'Corvee commutation and relief';
    if (type === 'military_register') return 'Military household audit and recruitment';
    return 'Huji governance commitment';
  }

  function commitmentTarget(type) {
    if (type === 'hukou_census') return 'hidden households / fugitives / tax base';
    if (type === 'corvee_commutation') return 'corvee gap / labor burden / commutation';
    if (type === 'military_register') return 'service pool / garrison households / recruits';
    return 'hukou governance';
  }

  function currentHidden(root) {
    return round(root.population && root.population.hiddenCount || root.hukou && root.hukou.estimatedHidden || sumRegional(root, 'hiddenCount'));
  }

  function currentFugitives(root) {
    return round(root.population && root.population.fugitives || root.hukou && (root.hukou.fugitives || root.hukou.refugees) || sumRegional(root, 'fugitives'));
  }

  function currentCorveeGap(root) {
    return round(root.corvee && root.corvee.ledger && root.corvee.ledger.summary && root.corvee.ledger.summary.gapDays || 0);
  }

  function currentRecruitShortfall(root) {
    var pool = root.military && root.military.servicePool || {};
    var requested = round(pool.requestedRecruits || root.military && (root.military.pendingRecruitment || root.military.draftQuota || root.military.requestedRecruits) || 0);
    var available = round(pool.availableRecruits || root.military && root.military.availableRecruits || 0);
    return Math.max(0, requested - available);
  }

  function commitmentEffects(root, type, intensity) {
    intensity = clamp(intensity != null ? intensity : 0.65, 0.2, 1);
    var hidden = currentHidden(root);
    var fugitives = currentFugitives(root);
    var gap = currentCorveeGap(root);
    var shortfall = currentRecruitShortfall(root);
    var effects = {};
    if (type === 'hukou_census') {
      effects.hiddenReduction = Math.min(hidden, Math.max(10, round(hidden * (0.08 + intensity * 0.06))));
      effects.fugitiveReduction = Math.min(fugitives, Math.max(5, round(fugitives * (0.06 + intensity * 0.04))));
      effects.minxinDelta = round2(0.6 + intensity * 0.8);
      effects.cost = 2200 + round((effects.hiddenReduction + effects.fugitiveReduction) * 3);
      effects.expectedTurns = 4;
    } else if (type === 'corvee_commutation') {
      effects.corveeGapReduction = Math.min(gap, Math.max(30, round(gap * (0.08 + intensity * 0.08))));
      effects.minxinDelta = round2(0.8 + intensity * 1.1);
      effects.cost = 2600 + round(effects.corveeGapReduction * 0.035);
      effects.expectedTurns = 3;
    } else if (type === 'military_register') {
      effects.recruitGain = Math.max(25, round(Math.max(shortfall, 300) * (0.05 + intensity * 0.05)));
      effects.minxinDelta = round2(0.3 + intensity * 0.5);
      effects.cost = 2400 + round(effects.recruitGain * 1.2);
      effects.expectedTurns = 3;
    }
    return effects;
  }

  function resistanceFor(root, type) {
    var corruption = number(root.corruption && (root.corruption.trueIndex || root.corruption.index || root.corruption.value), 40);
    var minxin = number(root.minxin && (root.minxin.trueIndex != null ? root.minxin.trueIndex : root.minxin.index || root.minxin.value), 50);
    var base = clamp(corruption / 180, 0.05, 0.65);
    if (type === 'hukou_census') base += 0.08;
    if (type === 'corvee_commutation') base += minxin < 45 ? 0.04 : 0;
    if (type === 'military_register') base += 0.06;
    return round2(clamp(base, 0.04, 0.85));
  }

  function typesForTags(tags) {
    tags = toArray(tags);
    var out = [];
    if (tags.indexOf('hukou') >= 0) out.push('hukou_census');
    if (tags.indexOf('corvee') >= 0) out.push('corvee_commutation');
    if (tags.indexOf('military') >= 0) out.push('military_register');
    return out;
  }

  function hasCommitment(root, key, linkedIssue, type) {
    return ensureCommitments(root).some(function(c) {
      if (!c) return false;
      if (key && c.key === key) return true;
      if (linkedIssue && c.linkedIssue === linkedIssue && c.type === type && c.status !== 'cancelled') return true;
      return false;
    });
  }

  function createCommitment(root, raw, options) {
    root = pickRoot(root);
    raw = raw || {};
    options = options || {};
    var classified = classifyOperation(raw);
    if (!classified.tags.length) return { created: 0, duplicate: 0, commitments: [], reason: 'not-huji-related' };
    if (!isFormalOperation(raw)) return { created: 0, duplicate: 0, commitments: [], reason: 'not-formal-operation' };
    var types = typesForTags(classified.tags);
    if (!types.length) return { created: 0, duplicate: 0, commitments: [], reason: 'no-commitment-type' };
    var store = ensureStore(root);
    var list = ensureCommitments(root);
    var created = [];
    var duplicate = 0;
    var sourceActionId = compact(options.sourceActionId || raw.sourceActionId || raw.id || raw.signalId || raw.actionId || (raw.seq ? 'seq-' + raw.seq : ''), 120);
    var linkedIssue = compact(options.linkedIssue || classified.linkedIssue || socialLinkedIssueForSignal(root, raw) || '', 120);
    var intensity = clamp(raw.intensity != null ? raw.intensity : 0.65, 0.2, 1);
    types.forEach(function(type) {
      var key = [
        sourceActionId || linkedIssue || compact(classified.text, 80),
        type
      ].join('|');
      if (hasCommitment(root, key, linkedIssue, type)) {
        duplicate += 1;
        return;
      }
      store.seq = (Number(store.seq) || 0) + 1;
      var effects = commitmentEffects(root, type, intensity);
      var executor = assignExecutor(root, type);
      var c = {
        id: 'huji-gov-' + (Number(options.turn != null ? options.turn : root.turn) || 0) + '-' + store.seq,
        key: key,
        turn: Number(options.turn != null ? options.turn : root.turn) || 0,
        createdTurn: Number(root.turn) || 0,
        source: options.source || raw.source || 'player-formal-operation',
        sourceActionId: sourceActionId,
        linkedIssue: linkedIssue,
        type: type,
        title: commitmentTitle(type),
        target: commitmentTarget(type),
        text: classified.text,
        status: 'active',
        progress: 0,
        expectedTurns: effects.expectedTurns || 3,
        cost: round2(effects.cost || 0),
        paidCost: 0,
        executionRate: 0,
        executorOffice: executor.executorOffice || '',
        executorDept: executor.executorDept || '',
        executorHolder: executor.executorHolder || '',
        executorAuthority: executor.executorAuthority || '',
        executorReliability: executor.executorReliability,
        executorReason: executor.executorReason || '',
        responsibilityKey: compact((executor.executorOffice || executor.executorDept || 'executor') + '|' + type + '|' + (linkedIssue || sourceActionId || key), 180),
        resistance: resistanceFor(root, type),
        failureRisk: 0,
        stalledTurns: 0,
        effects: effects,
        applied: {
          hiddenReduction: 0,
          fugitiveReduction: 0,
          corveeGapReduction: 0,
          recruitGain: 0,
          minxinDelta: 0
        },
        tags: classified.tags,
        confidence: classified.confidence || 0.72,
        history: []
      };
      list.push(c);
      created.push(clone(c));
      pushEvent(root, 'commitment-created', { id: c.id, type: c.type, linkedIssue: c.linkedIssue, text: c.text }, options);
      recordCause(root, c, {
        type: 'commitment-created',
        reason: c.title + ' assigned to ' + (c.executorOffice || 'executor'),
        effects: c.effects
      }, options);
      recordSocial(root, c, 'created', options);
    });
    if (list.length > MAX_COMMITMENTS) root._hujiCommitments = list.slice(-MAX_COMMITMENTS);
    store.stats.created = (Number(store.stats.created) || 0) + created.length;
    store.stats.duplicates = (Number(store.stats.duplicates) || 0) + duplicate;
    return { created: created.length, duplicate: duplicate, commitments: created };
  }

  function recordSocial(root, commitment, phase, options) {
    if (!TM.SocialPoliticalSignals || typeof TM.SocialPoliticalSignals.record !== 'function') return null;
    var typeTags = commitment.type === 'hukou_census' ? ['hukou', 'census', 'taxbase'] :
      commitment.type === 'corvee_commutation' ? ['corvee', 'labor', 'minxin'] :
      ['military', 'draft', 'service-pool'];
    try {
      return TM.SocialPoliticalSignals.record(root, {
        sourceSystem: 'huji-governance-loop',
        kind: 'commitment-' + phase + '-' + commitment.type,
        tags: typeTags,
        affectedClasses: [
          { name: 'registered-households', deltaSatisfaction: phase === 'tick' ? 0.2 : 0, deltaPressure: commitment.type === 'hukou_census' ? 0.2 : 0, reason: commitment.title },
          { name: 'labor-households', deltaSatisfaction: commitment.type === 'corvee_commutation' ? 0.4 : 0, deltaPressure: commitment.type === 'corvee_commutation' ? -0.2 : 0, reason: commitment.title },
          { name: 'military-households', deltaSatisfaction: commitment.type === 'military_register' ? 0.2 : 0, deltaPressure: commitment.type === 'military_register' ? 0.1 : 0, reason: commitment.title }
        ],
        affectedParties: [],
        intensity: clamp((commitment.progress || 0) + 0.35, 0.25, 0.95),
        confidence: commitment.confidence || 0.74,
        linkedIssue: commitment.linkedIssue || commitment.id,
        reason: commitment.title + ' ' + phase + ': ' + compact(commitment.text, 140)
      });
    } catch (_) {
      return null;
    }
  }

  function targetRegions(root) {
    var leaves = getLeafRegions(root);
    var rows = leaves.map(function(region) {
      var detail = region.populationDetail || region.population || {};
      return {
        region: region.id || region.name,
        weight: Math.max(1, number(detail.mouths || region.mouths || 1, 1))
      };
    });
    return rows.slice(0, 8);
  }

  function recordMinxin(root, commitment, delta, options) {
    if (!delta) return null;
    if (TM.MinxinLedger && typeof TM.MinxinLedger.recordAndApply === 'function') {
      try {
        return TM.MinxinLedger.recordAndApply(root, {
          sourceSystem: 'huji-governance-loop',
          kind: 'commitment-progress-' + commitment.type,
          tags: ['hukou-governance', commitment.type],
          targetRegions: targetRegions(root),
          targetClasses: [
            { name: 'registered-households', weight: 0.45 },
            { name: 'labor-households', weight: commitment.type === 'corvee_commutation' ? 0.45 : 0.2 },
            { name: 'military-households', weight: commitment.type === 'military_register' ? 0.35 : 0.15 }
          ],
          deltaTrue: delta,
          intensity: clamp(Math.abs(delta) / 3, 0.08, 0.8),
          confidence: 0.78,
          linkedIssue: commitment.linkedIssue || commitment.id,
          policyActionId: commitment.sourceActionId || commitment.id,
          reason: commitment.title + ' progressed'
        }, {
          turn: Number(options && options.turn != null ? options.turn : root.turn) || 0,
          source: options && options.source || 'huji-governance-loop'
        });
      } catch (_) {}
    }
    root.minxin = root.minxin && typeof root.minxin === 'object' ? root.minxin : { trueIndex: number(root.minxin, 50) };
    root.minxin.trueIndex = clamp(number(root.minxin.trueIndex, 50) + delta, 0, 100);
    return null;
  }

  function applyCorveeGapReduction(root, amount, options) {
    root = pickRoot(root);
    amount = round(amount);
    if (!amount) return 0;
    root.corvee = root.corvee && typeof root.corvee === 'object' ? root.corvee : {};
    root.population = root.population && typeof root.population === 'object' ? root.population : {};
    root.population.corvee = root.population.corvee && typeof root.population.corvee === 'object' ? root.population.corvee : {};
    var ledger = root.corvee.ledger || root.population.corvee.runtimeLedger;
    var applied = 0;
    if (ledger && ledger.summary) {
      var beforeGap = round(ledger.summary.gapDays);
      applied = Math.min(beforeGap, amount);
      ledger.summary.gapDays = Math.max(0, beforeGap - applied);
      ledger.summary.fulfilledDays = round(ledger.summary.fulfilledDays || 0) + applied;
      if (ledger.summary.totalDemandDays) ledger.summary.fulfillmentRate = round2((ledger.summary.fulfilledDays || 0) / Math.max(1, ledger.summary.totalDemandDays));
      var remaining = applied;
      var rows = Array.isArray(ledger.byRegion) ? ledger.byRegion : [];
      var totalGap = rows.reduce(function(sum, row) { return sum + round(row && row.gapDays); }, 0);
      rows.forEach(function(row, idx) {
        if (!row || remaining <= 0) return;
        var current = round(row.gapDays);
        if (!current) return;
        var share = idx === rows.length - 1 ? remaining : Math.min(current, Math.round(applied * current / Math.max(1, totalGap)));
        if (share <= 0 && current > 0 && remaining > 0) share = 1;
        share = Math.min(current, remaining, share);
        row.gapDays = Math.max(0, current - share);
        row.fulfilledDays = round(row.fulfilledDays || 0) + share;
        remaining -= share;
      });
      root.corvee.ledger = ledger;
      root.population.corvee.runtimeLedger = ledger;
    } else {
      applied = amount;
    }
    root.corvee.governanceRelief = root.corvee.governanceRelief && typeof root.corvee.governanceRelief === 'object' ? root.corvee.governanceRelief : {};
    root.corvee.governanceRelief.turn = Number(options && options.turn != null ? options.turn : root.turn) || 0;
    root.corvee.governanceRelief.gapReduction = round((root.corvee.governanceRelief.gapReduction || 0) + applied);
    root.corvee.governanceRelief.source = 'huji-governance-loop';
    return applied;
  }

  function applyRecruitGain(root, amount, options) {
    root = pickRoot(root);
    amount = round(amount);
    if (!amount) return 0;
    root.military = root.military && typeof root.military === 'object' ? root.military : {};
    root.population = root.population && typeof root.population === 'object' ? root.population : {};
    root.population.military = root.population.military && typeof root.population.military === 'object' ? root.population.military : {};
    root.military.availableRecruits = round(root.military.availableRecruits || 0) + amount;
    root.military.recruitmentCapacity = round(root.military.recruitmentCapacity || 0) + amount;
    if (root.military.servicePool && typeof root.military.servicePool === 'object') {
      root.military.servicePool.availableRecruits = round(root.military.servicePool.availableRecruits || 0) + amount;
      root.military.servicePool.shortfall = Math.max(0, round(root.military.servicePool.requestedRecruits || 0) - root.military.servicePool.availableRecruits);
    }
    root.population.military.availableRecruits = round(root.population.military.availableRecruits || 0) + amount;
    if (root.population.military.servicePool && typeof root.population.military.servicePool === 'object') {
      root.population.military.servicePool.availableRecruits = round(root.population.military.servicePool.availableRecruits || 0) + amount;
      root.population.military.servicePool.shortfall = Math.max(0, round(root.population.military.servicePool.requestedRecruits || 0) - root.population.military.servicePool.availableRecruits);
    }
    root.military.governanceServiceBoost = root.military.governanceServiceBoost && typeof root.military.governanceServiceBoost === 'object' ? root.military.governanceServiceBoost : {};
    root.military.governanceServiceBoost.turn = Number(options && options.turn != null ? options.turn : root.turn) || 0;
    root.military.governanceServiceBoost.availableRecruits = round((root.military.governanceServiceBoost.availableRecruits || 0) + amount);
    root.military.governanceServiceBoost.source = 'huji-governance-loop';
    return amount;
  }

  function applyCommitmentEffects(root, commitment, share, options) {
    var effects = commitment.effects || {};
    var applied = {
      hiddenReduction: 0,
      fugitiveReduction: 0,
      corveeGapReduction: 0,
      recruitGain: 0,
      minxinDelta: 0
    };
    if (commitment.type === 'hukou_census') {
      applied.hiddenReduction = applyRegionalPopulationDelta(root, 'hiddenCount', round((effects.hiddenReduction || 0) * share));
      applied.fugitiveReduction = applyRegionalPopulationDelta(root, 'fugitives', round((effects.fugitiveReduction || 0) * share));
    } else if (commitment.type === 'corvee_commutation') {
      applied.corveeGapReduction = applyCorveeGapReduction(root, round((effects.corveeGapReduction || 0) * share), options);
    } else if (commitment.type === 'military_register') {
      applied.recruitGain = applyRecruitGain(root, round((effects.recruitGain || 0) * share), options);
    }
    applied.minxinDelta = round2((effects.minxinDelta || 0) * share);
    if (applied.minxinDelta) recordMinxin(root, commitment, applied.minxinDelta, options);
    Object.keys(applied).forEach(function(k) {
      commitment.applied[k] = round2((number(commitment.applied[k], 0)) + number(applied[k], 0));
    });
    recordCause(root, commitment, {
      type: 'commitment-effect',
      reason: commitment.title + ' applied runtime effects',
      applied: applied
    }, options);
    return applied;
  }

  function executionRateFor(root, commitment) {
    var corruption = number(root.corruption && (root.corruption.trueIndex || root.corruption.index || root.corruption.value), 40);
    var authorityRate = root.huangquan && root.huangquan.executionRate != null ? number(root.huangquan.executionRate, 0.65) : null;
    var localRate = root.localExecution && (root.localExecution.edictExecutionRate || (root.localExecution.minxinHardLinks && root.localExecution.minxinHardLinks.avgExecutionRate));
    var base = authorityRate != null ? authorityRate : (localRate != null ? number(localRate, 0.65) : clamp(1 - corruption / 190, 0.25, 0.95));
    var treasury = getTreasury(root);
    var remainingCost = Math.max(1, (commitment.cost || 0) - (commitment.paidCost || 0));
    var funding = clamp(treasury / Math.max(1, remainingCost * 2.5), 0.18, 1);
    var courtBoost = clamp(commitment.courtExecutionBoost || 0, 0, 0.35);
    var executorReliability = commitment.executorReliability != null ? clamp(commitment.executorReliability, 0.15, 1) : 0.62;
    var executorFactor = clamp(0.62 + executorReliability * 0.48, 0.45, 1.08);
    var rate = (base + courtBoost) * funding * executorFactor * (1 - clamp(commitment.resistance || 0, 0, 0.85) * 0.45);
    return round2(clamp(rate, 0.08, 1));
  }

  function ensureTinyiArray(root) {
    if (!Array.isArray(root._pendingTinyiTopics)) root._pendingTinyiTopics = [];
    return root._pendingTinyiTopics;
  }

  function spawnGovernanceTinyi(root, commitment, reason, options) {
    var list = ensureTinyiArray(root);
    var id = 'huji-gov-tinyi-' + commitment.id;
    if (list.some(function(row) { return row && (row.id === id || row.sourceId === commitment.id); })) return null;
    var topic = commitment.title + ' execution review';
    var row = {
      id: id,
      issueId: id,
      linkedIssue: commitment.linkedIssue || id,
      topic: topic,
      title: topic,
      from: 'huji-governance-loop',
      sourceType: 'huji_governance_commitment',
      sourceId: commitment.id,
      commitmentId: commitment.id,
      commitmentType: commitment.type,
      turn: Number(options && options.turn != null ? options.turn : root.turn) || 0,
      priority: commitment.status === 'stalled' ? 82 : 74,
      status: 'pending',
      reason: reason || 'Huji governance commitment needs court review',
      proposerReason: 'Formal operation generated a commitment whose execution now needs court handling',
      origin: {
        sourceType: 'huji_governance_commitment',
        sourceId: commitment.id,
        sourceName: commitment.title
      }
    };
    list.unshift(row);
    if (list.length > 100) root._pendingTinyiTopics = list.slice(0, 100);
    pushEvent(root, 'commitment-tinyi', { id: commitment.id, topic: topic, linkedIssue: row.linkedIssue }, options);
    return row;
  }

  function ensureMemorialArray(root) {
    if (!Array.isArray(root._pendingMemorials)) root._pendingMemorials = [];
    return root._pendingMemorials;
  }

  function recordBacklashSignal(root, commitment, reason) {
    if (TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.record === 'function') {
      try {
        TM.SocialPoliticalSignals.record(root, {
          sourceSystem: 'huji-governance-backlash',
          kind: 'commitment-backlash-' + (commitment.type || 'huji'),
          tags: ['hukou-governance', 'backlash', commitment.type || 'huji'],
          affectedClasses: [
            { name: 'registered-households', deltaSatisfaction: -0.5, deltaPressure: 0.7, reason: reason },
            { name: 'labor-households', deltaSatisfaction: commitment.type === 'corvee_commutation' ? -0.8 : -0.3, deltaPressure: commitment.type === 'corvee_commutation' ? 1.0 : 0.4, reason: reason },
            { name: 'military-households', deltaSatisfaction: commitment.type === 'military_register' ? -0.6 : -0.2, deltaPressure: commitment.type === 'military_register' ? 0.8 : 0.3, reason: reason }
          ],
          affectedParties: [],
          intensity: clamp((commitment.failureRisk || 0.7), 0.35, 1),
          confidence: 0.78,
          linkedIssue: commitment.linkedIssue || commitment.id,
          reason: reason
        });
      } catch (_) {}
    }
    recordMinxin(root, commitment, -0.45, { source: 'huji-governance-backlash', turn: root.turn });
  }

  function spawnGovernanceBacklash(root, commitment, reason, options) {
    root = pickRoot(root);
    options = options || {};
    if (!commitment || !commitment.id) return null;
    reason = compact(reason || 'huji governance commitment triggered backlash', 220);
    var memorials = ensureMemorialArray(root);
    var id = 'huji-gov-memorial-' + commitment.id;
    var existing = memorials.find(function(m) { return m && (m.id === id || m.commitmentId === commitment.id) && m.sourceType === 'huji_governance_backlash'; });
    if (!existing) {
      existing = {
        id: id,
        title: commitment.title + ' execution backlash',
        topic: commitment.title,
        from: 'huji-governance-loop',
        sourceType: 'huji_governance_backlash',
        sourceId: commitment.id,
        commitmentId: commitment.id,
        commitmentType: commitment.type,
        linkedIssue: commitment.linkedIssue || commitment.id,
        status: 'drafted',
        turn: Number(options.turn != null ? options.turn : root.turn) || 0,
        priority: commitment.status === 'blocked' ? 88 : 76,
        reason: reason,
        suggestedChannels: ['memorial_reply', 'court_debate', 'wendui', 'hongyan'],
        executorOffice: commitment.executorOffice || '',
        executorHolder: commitment.executorHolder || ''
      };
      memorials.unshift(existing);
      if (memorials.length > 100) root._pendingMemorials = memorials.slice(0, 100);
    }
    spawnGovernanceTinyi(root, commitment, reason, options);
    recordBacklashSignal(root, commitment, reason);
    recordCause(root, commitment, {
      type: 'backlash',
      reason: reason,
      effects: { memorialId: existing.id, status: commitment.status, failureRisk: commitment.failureRisk || 0 }
    }, options);
    pushEvent(root, 'commitment-backlash', { id: commitment.id, memorialId: existing.id, reason: reason }, options);
    return existing;
  }

  function courtRecordKey(row, idx) {
    return compact(row && (row.id || row.recordId || row.sealId || row.issueId || row.linkedIssue || row.sourceId || row.topic || row.title) || ('court-row-' + idx), 140);
  }

  function collectCourtRows(root) {
    root = pickRoot(root);
    var rows = [];
    function add(list, source) {
      toArray(list).forEach(function(row, idx) {
        if (!row || typeof row !== 'object') return;
        rows.push(Object.assign({ _courtFeedbackSource: source, _courtFeedbackIndex: idx }, row));
      });
    }
    add(root._courtRecords, 'court-records');
    add(root.courtRecords, 'court-records');
    add(root.tinyiSeals, 'tinyi-seals');
    add(root._tinyiSeals, 'tinyi-seals');
    add(root._pendingTinyiTopics, 'pending-tinyi');
    add(root.pendingTinyiTopics, 'pending-tinyi');
    add(root.tinyi && root.tinyi.pendingTopics, 'pending-tinyi');
    add(root.tinyi && root.tinyi.records, 'tinyi-records');
    add(root.chaoyiRecords, 'chaoyi-records');
    return rows;
  }

  function decisionText(row) {
    row = row || {};
    return [
      row.decision,
      row.ruling,
      row.result,
      row.outcome,
      row.verdict,
      row.resolution,
      row.finalDecision,
      row.status,
      row.seal,
      row.action,
      row.reason,
      row.summary,
      row.title,
      row.topic
    ].map(textOf).filter(Boolean).join(' ').toLowerCase();
  }

  function normalizeCourtDecision(row) {
    var text = decisionText(row);
    if (!text) return null;
    if (/pending|planned|draft|open|待办|待议题|未决/.test(text) && !/resolved|approved|rejected|deferred|通过|议准|驳回|缓议/.test(text)) return null;
    if (/reject|rejected|deny|denied|block|blocked|veto|failed|oppose|驳回|否决|不准|阻断|阻止|未准/.test(text)) return 'rejected';
    if (/defer|deferred|delay|delayed|postpone|postponed|table|tabled|hold|缓议|暂缓|延期|延议|复议|搁置/.test(text)) return 'deferred';
    if (/approve|approved|pass|passed|accept|accepted|resolve|resolved|enact|enacted|adopt|adopted|support|grant|granted|通过|议准|裁可|准行|采纳|施行|已决/.test(text)) return 'approved';
    return null;
  }

  function courtRowIds(row) {
    row = row || {};
    return unique([
      row.commitmentId,
      row.sourceId,
      row.linkedCommitment,
      row.id,
      row.issueId,
      row.linkedIssue,
      row.topicId,
      row.chaoyiTrackId,
      row.courtIssueId
    ].map(textOf).filter(Boolean));
  }

  function courtRowMatchesCommitment(row, commitment) {
    if (!row || !commitment) return false;
    var ids = courtRowIds(row);
    var wanted = unique([
      commitment.id,
      commitment.linkedIssue,
      commitment.sourceActionId,
      'huji-gov-tinyi-' + commitment.id
    ].map(textOf).filter(Boolean));
    for (var i = 0; i < ids.length; i += 1) {
      if (wanted.indexOf(ids[i]) >= 0) return true;
    }
    var topic = compact(row.topic || row.title || row.reason || '', 160).toLowerCase();
    if (!topic) return false;
    return !!(commitment.linkedIssue && topic.indexOf(String(commitment.linkedIssue).toLowerCase()) >= 0)
      || !!(commitment.title && topic.indexOf(String(commitment.title).toLowerCase()) >= 0);
  }

  function applyCourtDecision(root, commitment, row, decision, key, options) {
    commitment.courtFeedbackAppliedKeys = toArray(commitment.courtFeedbackAppliedKeys);
    if (commitment.courtFeedbackAppliedKeys.indexOf(key) >= 0) return null;
    commitment.courtFeedbackAppliedKeys.push(key);
    if (commitment.courtFeedbackAppliedKeys.length > 20) commitment.courtFeedbackAppliedKeys = commitment.courtFeedbackAppliedKeys.slice(-20);

    var before = {
      status: commitment.status,
      progress: number(commitment.progress, 0),
      resistance: number(commitment.resistance, 0),
      expectedTurns: number(commitment.expectedTurns, 0)
    };
    commitment.courtDecision = decision;
    commitment.lastCourtFeedback = {
      key: key,
      source: row._courtFeedbackSource || 'court',
      decision: decision,
      turn: Number(options && options.turn != null ? options.turn : root.turn) || 0,
      reason: compact(row.reason || row.result || row.decision || row.status || row.topic || '', 180)
    };
    if (decision === 'approved') {
      commitment.status = commitment.status === 'blocked' || commitment.status === 'stalled' ? 'active' : commitment.status;
      commitment.progress = round2(clamp(number(commitment.progress, 0) + 0.12, 0, 1));
      commitment.resistance = round2(clamp(number(commitment.resistance, 0) - 0.08, 0, 1));
      commitment.courtExecutionBoost = round2(clamp(number(commitment.courtExecutionBoost, 0) + 0.16, 0, 0.35));
      commitment.stalledTurns = 0;
      commitment.failureRisk = round2(clamp(number(commitment.failureRisk, 0) - 0.12, 0, 1));
    } else if (decision === 'rejected') {
      commitment.status = 'blocked';
      commitment.resistance = round2(clamp(number(commitment.resistance, 0) + 0.18, 0, 1));
      commitment.courtExecutionBoost = 0;
      commitment.failureRisk = 1;
      commitment.stalledTurns = Math.max(1, Number(commitment.stalledTurns) || 0);
      spawnGovernanceBacklash(root, commitment, 'court rejected or blocked ' + commitment.title, options);
    } else if (decision === 'deferred') {
      if (commitment.status !== 'blocked' && commitment.status !== 'completed') commitment.status = 'active';
      commitment.expectedTurns = Math.max(1, number(commitment.expectedTurns, 3) + 1);
      commitment.resistance = round2(clamp(number(commitment.resistance, 0) + 0.06, 0, 1));
      commitment.failureRisk = round2(clamp(number(commitment.failureRisk, 0) + 0.08, 0, 1));
      commitment.stalledTurns = Math.max(1, Number(commitment.stalledTurns) || 0);
    }
    commitment.history = toArray(commitment.history);
    commitment.history.push({
      turn: Number(options && options.turn != null ? options.turn : root.turn) || 0,
      source: options && options.source || 'huji-governance-court-feedback',
      courtDecision: decision,
      courtKey: key,
      before: before,
      after: {
        status: commitment.status,
        progress: commitment.progress,
        resistance: commitment.resistance,
        expectedTurns: commitment.expectedTurns
      }
    });
    if (commitment.history.length > 20) commitment.history = commitment.history.slice(-20);
    recordCause(root, commitment, {
      type: 'court-feedback',
      reason: 'court feedback ' + decision + ' changed ' + commitment.title,
      effects: {
        decision: decision,
        courtKey: key,
        before: before,
        status: commitment.status,
        progress: commitment.progress,
        resistance: commitment.resistance
      }
    }, options);
    pushEvent(root, 'court-feedback-applied', {
      id: commitment.id,
      type: commitment.type,
      decision: decision,
      courtKey: key,
      linkedIssue: commitment.linkedIssue || '',
      status: commitment.status,
      progress: commitment.progress
    }, options);
    return commitment.lastCourtFeedback;
  }

  function applyCourtFeedbacks(root, options) {
    root = pickRoot(root);
    options = options || {};
    var rows = collectCourtRows(root);
    var commitments = ensureCommitments(root);
    var applied = 0;
    var scanned = 0;
    rows.forEach(function(row, idx) {
      var decision = normalizeCourtDecision(row);
      if (!decision) return;
      scanned += 1;
      var key = courtRecordKey(row, idx) + ':' + decision;
      commitments.forEach(function(commitment) {
        if (!commitment || commitment.status === 'completed' || !courtRowMatchesCommitment(row, commitment)) return;
        var result = applyCourtDecision(root, commitment, row, decision, key, options);
        if (result) applied += 1;
      });
    });
    var store = ensureStore(root);
    store.stats.courtFeedbacks = (Number(store.stats.courtFeedbacks) || 0) + applied;
    if (applied) pushEvent(root, 'court-feedback-scan', { scanned: scanned, applied: applied }, options);
    return { scanned: scanned, applied: applied };
  }

  function settleCommitment(root, commitment, options) {
    options = options || {};
    var monthRatio = clamp(options.monthRatio != null ? options.monthRatio : 1, 0.05, 4);
    if (!commitment || commitment.status !== 'active') return null;
    var executionRate = executionRateFor(root, commitment);
    commitment.executionRate = executionRate;
    commitment.failureRisk = round2(clamp((commitment.resistance || 0) + (1 - executionRate) * 0.55, 0, 1));
    var remaining = Math.max(0, 1 - number(commitment.progress, 0));
    var progressStep = clamp((0.16 + executionRate * 0.28 - (commitment.resistance || 0) * 0.08) * monthRatio, 0.02, 0.42);
    progressStep = Math.min(remaining, progressStep);
    var plannedCost = round2((commitment.cost || 0) * progressStep);
    var paid = spendTreasury(root, plannedCost);
    var fundingScale = plannedCost > 0 ? clamp(paid / plannedCost, 0.15, 1) : 1;
    var effectiveShare = round2(progressStep * fundingScale);
    if (effectiveShare <= 0.01) {
      commitment.stalledTurns = (Number(commitment.stalledTurns) || 0) + 1;
      if (commitment.stalledTurns >= 2) {
        commitment.status = 'stalled';
        spawnGovernanceTinyi(root, commitment, 'insufficient funding or execution capacity stalled commitment', options);
        spawnGovernanceBacklash(root, commitment, 'insufficient funding or execution capacity stalled ' + commitment.title, options);
      }
      return { commitment: commitment, applied: null, paid: paid, progressStep: 0 };
    }
    var applied = applyCommitmentEffects(root, commitment, effectiveShare, options);
    commitment.paidCost = round2((commitment.paidCost || 0) + paid);
    commitment.progress = round2(clamp(number(commitment.progress, 0) + effectiveShare, 0, 1));
    commitment.stalledTurns = fundingScale < 0.35 || executionRate < 0.22 ? ((Number(commitment.stalledTurns) || 0) + 1) : 0;
    commitment.history = toArray(commitment.history);
    commitment.history.push({
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      source: options.source || 'huji-governance-loop',
      progress: commitment.progress,
      executionRate: executionRate,
      paidCost: paid,
      applied: clone(applied)
    });
    if (commitment.history.length > 20) commitment.history = commitment.history.slice(-20);
    if (commitment.progress >= 0.999) {
      commitment.progress = 1;
      commitment.status = 'completed';
      ensureStore(root).stats.completed = (Number(ensureStore(root).stats.completed) || 0) + 1;
      pushEvent(root, 'commitment-completed', { id: commitment.id, type: commitment.type, applied: clone(commitment.applied) }, options);
    } else if (commitment.stalledTurns >= 2) {
      spawnGovernanceTinyi(root, commitment, 'low execution rate is turning this commitment into court pressure', options);
      spawnGovernanceBacklash(root, commitment, 'low execution rate is turning ' + commitment.title + ' into formal pressure', options);
      ensureStore(root).stats.stalled = (Number(ensureStore(root).stats.stalled) || 0) + 1;
    }
    recordSocial(root, commitment, 'tick', options);
    pushEvent(root, 'commitment-tick', { id: commitment.id, type: commitment.type, progress: commitment.progress, executionRate: executionRate, applied: clone(applied) }, options);
    return { commitment: commitment, applied: applied, paid: paid, progressStep: effectiveShare };
  }

  function ingestPlayerSignals(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var playerStore = root._playerActionSignals || {};
    var items = Array.isArray(playerStore.items) ? playerStore.items : [];
    var lastSeq = Number(store.lastPlayerActionSeq) || 0;
    var maxSeq = lastSeq;
    var scanned = 0;
    var created = 0;
    var duplicate = 0;
    items.forEach(function(signal) {
      var seq = Number(signal && signal.seq) || 0;
      if (seq <= lastSeq) return;
      if (seq > maxSeq) maxSeq = seq;
      scanned += 1;
      var result = createCommitment(root, Object.assign({}, signal || {}, {
        linkedIssue: socialLinkedIssueForSignal(root, signal)
      }), {
        turn: Number(options.turn != null ? options.turn : signal && signal.turn) || Number(root.turn) || 0,
        source: options.source || 'huji-governance-player-signal',
        sourceActionId: 'player-signal-' + seq
      });
      created += Number(result.created) || 0;
      duplicate += Number(result.duplicate) || 0;
    });
    store.lastPlayerActionSeq = maxSeq;

    var bridgeOps = [];
    try {
      bridgeOps = toArray(root._hujiRuntimeBridge && root._hujiRuntimeBridge.operations).concat(toArray(root.huji_actions));
    } catch (_) { bridgeOps = []; }
    bridgeOps.slice(-20).forEach(function(op) {
      if (!op) return;
      scanned += 1;
      var result = createCommitment(root, op, {
        turn: Number(options.turn != null ? options.turn : op.turn) || Number(root.turn) || 0,
        source: options.source || 'huji-governance-bridge-operation',
        sourceActionId: op.id || op.sourceActionId || ('huji-op-' + (op.seq || ''))
      });
      created += Number(result.created) || 0;
      duplicate += Number(result.duplicate) || 0;
    });

    store.turn = Number(options.turn != null ? options.turn : root.turn) || store.turn || 0;
    store.stats.ingested = (Number(store.stats.ingested) || 0) + 1;
    store.stats.created = (Number(store.stats.created) || 0);
    store.stats.duplicates = (Number(store.stats.duplicates) || 0);
    if (created || duplicate || scanned) pushEvent(root, 'ingest', { scanned: scanned, created: created, duplicate: duplicate }, options);
    return { scanned: scanned, created: created, duplicate: duplicate };
  }

  function tick(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var ingest = ingestPlayerSignals(root, options);
    var courtFeedbacks = applyCourtFeedbacks(root, options);
    var commitments = ensureCommitments(root);
    var results = [];
    commitments.forEach(function(commitment) {
      var result = settleCommitment(root, commitment, options);
      if (result) results.push(result);
    });
    store.turn = Number(options.turn != null ? options.turn : root.turn) || store.turn || 0;
    store.stats.ticked = (Number(store.stats.ticked) || 0) + 1;
    return {
      ok: true,
      ingested: ingest,
      courtFeedbacks: courtFeedbacks,
      active: commitments.filter(function(c) { return c && c.status === 'active'; }).length,
      completed: commitments.filter(function(c) { return c && c.status === 'completed'; }).length,
      results: results.map(function(x) { return { id: x.commitment && x.commitment.id, type: x.commitment && x.commitment.type, applied: clone(x.applied), progress: x.commitment && x.commitment.progress }; })
    };
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(40, Number(options.limit || 10) || 10));
    var store = ensureStore(root);
    var commitments = ensureCommitments(root);
    var causes = getCauseLedger(root, { limit: limit });
    return {
      turn: Number(root.turn) || 0,
      count: commitments.length,
      active: commitments.filter(function(c) { return c && c.status === 'active'; }).length,
      completed: commitments.filter(function(c) { return c && c.status === 'completed'; }).length,
      commitments: commitments.slice(-limit).map(clone),
      nearCauses: causes.items,
      events: store.events.slice(-limit).map(clone),
      stats: clone(store.stats)
    };
  }

  function formatForPrompt(root, options) {
    var snap = snapshot(root, options || {});
    if (!snap.commitments.length && !snap.events.length) return '';
    var lines = [];
    lines.push('\n\n=== Huji Governance Loop ===');
    lines.push('Formal player operations may create hukou/corvee/military commitments. Treat progress, cost, execution rate, and stalled court pressure as deterministic state for this turn.');
    lines.push('summary: active=' + snap.active + ' completed=' + snap.completed + ' total=' + snap.count);
    var executorLines = snap.commitments.filter(function(c) { return c && (c.executorOffice || c.executorHolder); }).map(function(c) {
      return '- ' + (c.type || '') + ' -> ' + (c.executorOffice || c.executorDept || 'executor')
        + (c.executorHolder ? ' holder=' + c.executorHolder : '')
        + ' reliability=' + (c.executorReliability != null ? c.executorReliability : '');
    });
    if (executorLines.length) lines.push('executors:\n' + executorLines.join('\n'));
    snap.commitments.forEach(function(c) {
      var eff = c.effects || {};
      var app = c.applied || {};
      lines.push('- T' + (c.turn || '') + ' [' + (c.status || '') + '/' + (c.type || '') + '] progress=' + (c.progress || 0)
        + ' exec=' + (c.executionRate || 0)
        + ' paid=' + (c.paidCost || 0) + '/' + (c.cost || 0)
        + (c.linkedIssue ? ' issue=' + c.linkedIssue : '')
        + (c.courtDecision ? ' court=' + c.courtDecision : '')
        + (c.courtExecutionBoost ? ' courtBoost=' + c.courtExecutionBoost : '')
        + ' target=' + compact(c.target, 90));
      lines.push('  effects planned hidden=' + (eff.hiddenReduction || 0)
        + ' fugitives=' + (eff.fugitiveReduction || 0)
        + ' corveeGap=' + (eff.corveeGapReduction || 0)
        + ' recruits=' + (eff.recruitGain || 0)
        + ' minxin=' + (eff.minxinDelta || 0));
      lines.push('  effects applied hidden=' + (app.hiddenReduction || 0)
        + ' fugitives=' + (app.fugitiveReduction || 0)
        + ' corveeGap=' + (app.corveeGapReduction || 0)
        + ' recruits=' + (app.recruitGain || 0)
        + ' minxin=' + (app.minxinDelta || 0));
    });
    if (snap.events.length) {
      lines.push('hujiGovernanceEvents:');
      snap.events.slice(-6).forEach(function(e) {
        var p = e.payload || {};
        lines.push('- T' + (e.turn || '') + ' [' + (e.type || '') + '] ' + compact(p.type || p.id || p.topic || JSON.stringify(p), 140));
      });
    }
    if (snap.nearCauses && snap.nearCauses.length) {
      lines.push('hujiGovernanceCauses:');
      snap.nearCauses.slice(-8).forEach(function(cause) {
        lines.push('- T' + (cause.turn || '') + ' [' + (cause.type || '') + '] ' + compact(cause.reason || '', 130)
          + (cause.executorOffice ? ' executor=' + cause.executorOffice : '')
          + (cause.executorHolder ? ' holder=' + cause.executorHolder : '')
          + (cause.linkedIssue ? ' issue=' + cause.linkedIssue : ''));
      });
    }
    return lines.join('\n');
  }

  function diagnosticsText(root, options) {
    return formatForPrompt(root, options);
  }

  TM.HujiGovernanceLoop = {
    ingestPlayerSignals: ingestPlayerSignals,
    createCommitment: createCommitment,
    applyCourtFeedbacks: applyCourtFeedbacks,
    assignExecutor: assignExecutor,
    getCauseLedger: getCauseLedger,
    tick: tick,
    snapshot: snapshot,
    formatForPrompt: formatForPrompt,
    diagnosticsText: diagnosticsText,
    VERSION: 1
  };

  global.HujiGovernanceLoop = TM.HujiGovernanceLoop;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = TM.HujiGovernanceLoop;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
