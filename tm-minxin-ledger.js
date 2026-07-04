// @ts-check
/*
 * tm-minxin-ledger.js
 * Unified minxin ledger and reducer. Keeps regional truth, court perception,
 * class matrix, uprising chain, and prompt/debug evidence in one account.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_ITEMS = 160;

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

  // P-ZV7·民心按源差异化封顶 profile（每源累计 mx.sources[key] 锁在 [floor, ceiling]）·misfit 2026-05-31 拍定。
  //   天意类卡紧（绝不许主导民心）/玩家治理类放宽（治世苛政都在此兑现）/君德战事居中。
  //   对冲铁律：正项 ceiling ≥ 对应负项 |floor|（灾恤 +20 ≥ 天象 12，赈灾兜得住天灾）。表外源走 _default ±20。常数可调。
  var MINXIN_SOURCE_CAP = {
    heavenSign: [-12, 4], prophecy: [-10, 3], auspicious: [-2, 8],
    taxation: [-25, 12], corvee: [-20, 8], disasterRelief: [-25, 20], judicialFairness: [-20, 15],
    localOfficial: [-18, 12], priceStability: [-18, 10], security: [-18, 10], socialMobility: [-8, 15], culturalPolicy: [-8, 12],
    imperialVirtue: [-15, 15], warResult: [-18, 8],
    _default: [-20, 20]
  };

  function round2(n) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return Math.round(n * 100) / 100;
  }

  function textOf(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(' ');
    if (typeof v === 'object') {
      var keys = ['name', 'className', 'region', 'regionName', 'id', 'title', 'reason', 'text', 'summary'];
      for (var i = 0; i < keys.length; i += 1) {
        if (v[keys[i]] !== undefined && v[keys[i]] !== null && v[keys[i]] !== '') return textOf(v[keys[i]]);
      }
    }
    return '';
  }

  function compact(v, maxLen) {
    var text = String(textOf(v) || '').replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 160;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function explicitKey(v) {
    return String(v || '').replace(/\s+/g, '').toLowerCase().trim();
  }

  function keyOf(v, fallback) {
    var raw = v && typeof v === 'object' ? (v.id || v.key || v.classKey || v.regionId || v.name || v.region || v.className) : v;
    return explicitKey(raw) || normalizeName(raw) || fallback || 'item';
  }

  function ensureMinxin(root) {
    root = pickRoot(root);
    if (!root.minxin || typeof root.minxin !== 'object' || Array.isArray(root.minxin)) {
      var old = Number(root.minxin);
      if (!isFinite(old)) old = 60;
      root.minxin = { trueIndex: old, perceivedIndex: old, phase: getPhase(old), trend: 'stable', sources: {}, byRegion: {}, byClass: {}, matrix: {}, uprisingCandidates: [], uprisingChain: [] };
    }
    var mx = root.minxin;
    if (!mx.sources || typeof mx.sources !== 'object' || Array.isArray(mx.sources)) mx.sources = {};
    if (!mx.byRegion || typeof mx.byRegion !== 'object' || Array.isArray(mx.byRegion)) mx.byRegion = {};
    if (!mx.byClass || typeof mx.byClass !== 'object' || Array.isArray(mx.byClass)) mx.byClass = {};
    if (!mx.matrix || typeof mx.matrix !== 'object' || Array.isArray(mx.matrix)) mx.matrix = {};
    if (!Array.isArray(mx.uprisingCandidates)) mx.uprisingCandidates = [];
    if (!Array.isArray(mx.uprisingChain)) mx.uprisingChain = [];
    if (!Array.isArray(mx.revolts)) mx.revolts = [];
    if (typeof mx.trueIndex !== 'number' || !isFinite(mx.trueIndex)) mx.trueIndex = Number(mx.index != null ? mx.index : mx.value);
    if (!isFinite(mx.trueIndex)) mx.trueIndex = 60;
    if (typeof mx.perceivedIndex !== 'number' || !isFinite(mx.perceivedIndex)) mx.perceivedIndex = mx.trueIndex;
    if (!mx.phase) mx.phase = getPhase(mx.trueIndex);
    return mx;
  }

  function ensureStore(root) {
    root = pickRoot(root);
    var mx = ensureMinxin(root);
    if (!root._minxinLedger || typeof root._minxinLedger !== 'object' || Array.isArray(root._minxinLedger)) {
      root._minxinLedger = { turn: Number(root.turn) || 0, seq: 0, items: [], stats: { recorded: 0, applied: 0 } };
    }
    if (!Array.isArray(root._minxinLedger.items)) root._minxinLedger.items = [];
    if (!root._minxinLedger.stats) root._minxinLedger.stats = { recorded: 0, applied: 0 };
    mx.ledger = root._minxinLedger.items;
    return root._minxinLedger;
  }

  function getPhase(idx) {
    idx = Number(idx);
    if (!isFinite(idx)) idx = 60;
    if (idx >= 80) return 'adoring';
    if (idx >= 60) return 'peaceful';
    if (idx >= 40) return 'uneasy';
    if (idx >= 20) return 'angry';
    return 'revolt';
  }

  function phaseName(phase) {
    return ({ adoring: 'adoring', peaceful: 'peaceful', uneasy: 'uneasy', angry: 'angry', revolt: 'revolt' })[phase] || phase || '';
  }

  function getClasses(root) {
    root = pickRoot(root);
    if (Array.isArray(root.classes)) return root.classes;
    if (Array.isArray(root.socialClasses)) return root.socialClasses;
    if (root.scriptData && Array.isArray(root.scriptData.classes)) return root.scriptData.classes;
    if (global.P && Array.isArray(global.P.classes)) return global.P.classes;
    if (global.scriptData && Array.isArray(global.scriptData.classes)) return global.scriptData.classes;
    return [];
  }

  function classKeyOf(cls) {
    cls = cls || {};
    var explicit = cls.classKey || cls.key || cls.id || cls.classId;
    if (!explicit && Array.isArray(cls.populationKeys) && cls.populationKeys[0]) explicit = cls.populationKeys[0];
    if (explicit) return explicitKey(explicit) || 'class';
    return normalizeName(cls.name || cls.className || cls.class || cls.title || 'class') || 'class';
  }

  function classNameOf(cls) {
    return compact(cls && (cls.name || cls.className || cls.class || cls.title || cls.id || cls.key), 80);
  }

  function classSatisfaction(cls, fallback) {
    var n = Number(cls && (cls.satisfaction != null ? cls.satisfaction : (cls.support != null ? cls.support : cls.mood)));
    return isFinite(n) ? clamp(n, 0, 100) : (fallback == null ? 50 : fallback);
  }

  function classInfluence(cls) {
    var n = Number(cls && (cls.influence != null ? cls.influence : cls.classInfluence));
    return isFinite(n) ? clamp(n, 0, 100) : 50;
  }

  function classShare(cls) {
    var direct = Number(cls && (cls._populationShare != null ? cls._populationShare : cls.populationShare));
    if (isFinite(direct) && direct > 0) return clamp(direct, 0, 1);
    var size = cls && cls.size;
    if (typeof size === 'number' && isFinite(size)) return size > 1 ? clamp(size / 100, 0, 1) : clamp(size, 0, 1);
    if (typeof size === 'string') {
      var m = size.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
      if (m) return clamp(Number(m[1]) / 100, 0, 1);
      var n = Number(size);
      if (isFinite(n)) return n > 1 ? clamp(n / 100, 0, 1) : clamp(n, 0, 1);
    }
    return 0.08;
  }

  function regionIdOf(div) {
    return keyOf(div && (div.id || div.regionId || div.mapRegionId || div.name), 'region');
  }

  function regionNameOf(div) {
    return compact(div && (div.name || div.id || div.regionId || div.mapRegionId), 100);
  }

  function getPopulation(div) {
    if (!div || typeof div !== 'object') return 1;
    if (div.population && typeof div.population === 'object') {
      var mouths = Number(div.population.mouths != null ? div.population.mouths : div.population.count);
      if (isFinite(mouths) && mouths > 0) return mouths;
    }
    var pop = Number(div.population);
    if (isFinite(pop) && pop > 0) return pop;
    var pd = div.populationDetail || {};
    var pdPop = Number(pd.mouths != null ? pd.mouths : pd.population);
    if (isFinite(pdPop) && pdPop > 0) return pdPop;
    return 1;
  }

  function getLeafDivisions(root) {
    root = pickRoot(root);
    var bridge = global.IntegrationBridge || (global.window && global.window.IntegrationBridge);
    if (bridge && typeof bridge.getLeafDivisions === 'function' && root.adminHierarchy) {
      try { return bridge.getLeafDivisions(root.adminHierarchy, 'player') || []; } catch (_) {}
    }
    var leaves = [];
    function walk(nodes) {
      toArray(nodes).forEach(function(node) {
        if (!node || typeof node !== 'object') return;
        var kids = toArray(node.children || node.divisions || node.subs);
        if (kids.length) walk(kids);
        else leaves.push(node);
      });
    }
    var ah = root.adminHierarchy;
    if (ah && typeof ah === 'object') {
      if (Array.isArray(ah.divisions)) walk(ah.divisions);
      else Object.keys(ah).forEach(function(k) {
        var fac = ah[k];
        walk(fac && (fac.divisions || fac.children || fac.subs));
      });
    }
    return leaves;
  }

  function matchRegion(div, wanted) {
    var n = normalizeName(wanted);
    if (!n || !div) return false;
    var names = [div.id, div.name, div.regionId, div.mapRegionId, div.officialName, div.title].map(normalizeName).filter(Boolean);
    return names.some(function(x) { return x === n || x.indexOf(n) >= 0 || n.indexOf(x) >= 0; });
  }

  function targetRegionRows(raw) {
    var rows = [];
    toArray(raw && (raw.targetRegions || raw.regions || raw.regionWeights || raw.affectedRegions)).forEach(function(r) {
      if (!r) return;
      var region = compact(r.region || r.regionName || r.name || r.id || r.division || r, 120);
      if (!region) return;
      var weight = Number(r.weight != null ? r.weight : r.share);
      if (!isFinite(weight) || weight <= 0) weight = 1;
      // 行未显式给 delta 就留 null → apply 端按权重摊「削顶后」的信号 delta。
      // （旧写法回退到 raw.deltaTrue：每个命中区各吃全额未封顶原始值·权重拆分成死路·P-ZV7 封顶被架空·2026-07-04 审查定罪）
      var delta = Number(r.deltaTrue != null ? r.deltaTrue : (r.delta != null ? r.delta : NaN));
      rows.push({ region: region, weight: weight, deltaTrue: isFinite(delta) ? delta : null });
    });
    return rows;
  }

  function targetClassRows(raw) {
    var rows = [];
    toArray(raw && (raw.targetClasses || raw.classes || raw.affectedClasses || raw.classImpacts)).forEach(function(c) {
      if (!c) return;
      var name = compact(c.className || c.name || c.class || c.id || c, 100);
      if (!name) return;
      var weight = Number(c.weight != null ? c.weight : c.share);
      if (!isFinite(weight) || weight <= 0) weight = 1;
      rows.push({ name: name, classKey: keyOf(c.classKey || c.key || c.id || name, 'class'), weight: weight });
    });
    return rows;
  }

  function signalDelta(raw) {
    var n = Number(raw && (raw.deltaTrue != null ? raw.deltaTrue : (raw.trueDelta != null ? raw.trueDelta : (raw.minxinDelta != null ? raw.minxinDelta : raw.delta))));
    return isFinite(n) ? round2(clamp(n, -30, 30)) : 0;
  }

  function buildSignal(root, raw, seq) {
    raw = raw || {};
    var sourceSystem = compact(raw.sourceSystem || raw.system || raw.source || 'unknown', 80);
    var kind = compact(raw.kind || raw.type || raw.action || raw.event || sourceSystem, 80);
    var turn = Number(raw.turn != null ? raw.turn : root.turn) || 0;
    return {
      id: compact(raw.id || ('mxsig-' + turn + '-' + seq), 80),
      turn: turn,
      seq: seq,
      sourceSystem: sourceSystem,
      kind: kind,
      tags: toArray(raw.tags || raw.policyTags || raw.labels).map(function(x) { return compact(x, 60); }).filter(Boolean).slice(0, 12),
      targetRegions: targetRegionRows(raw),
      targetClasses: targetClassRows(raw),
      deltaTrue: signalDelta(raw),
      deltaPerceived: Number(raw.deltaPerceived != null ? raw.deltaPerceived : 0) || 0,
      intensity: clamp(raw.intensity != null ? raw.intensity : 0.5, 0, 1),
      confidence: clamp(raw.confidence != null ? raw.confidence : 0.7, 0, 1),
      reason: compact(raw.reason || raw.text || raw.summary || raw.detail || raw.title || kind, 240),
      linkedIssue: compact(raw.linkedIssue || raw.issueId || raw.topicId || raw.chaoyiTrackId || '', 100),
      policyActionId: compact(raw.policyActionId || raw.actionId || raw.edictId || '', 100),
      courtIssueId: compact(raw.courtIssueId || raw.tinyiId || raw.issueId || raw.linkedIssue || '', 100),
      decay: Number(raw.decay) || 0,
      expiry: raw.expiry != null ? Number(raw.expiry) : null,
      applied: false,
      at: Date.now()
    };
  }

  function record(root, raw) {
    root = pickRoot(root);
    var store = ensureStore(root);
    store.turn = Number(root.turn) || store.turn || 0;
    store.seq = (Number(store.seq) || 0) + 1;
    store.stats.recorded = (Number(store.stats.recorded) || 0) + 1;
    var signal = buildSignal(root, raw || {}, store.seq);
    store.items.push(signal);
    if (store.items.length > MAX_ITEMS) store.items = store.items.slice(-MAX_ITEMS);
    ensureMinxin(root).ledger = store.items;
    return signal;
  }

  function writeDivisionMinxin(div, next) {
    if (!div || typeof div !== 'object') return;
    next = round2(clamp(next, 0, 100));
    div.minxin = next;
    if (div.minxinLocal !== undefined) div.minxinLocal = next;
    if (div.minxinDetails && typeof div.minxinDetails === 'object') {
      div.minxinDetails.trueIndex = next;
      div.minxinDetails.index = next;
    }
  }

  function aggregateTrue(root) {
    root = pickRoot(root);
    var mx = ensureMinxin(root);
    var leaves = getLeafDivisions(root).filter(function(d) { return d && typeof d.minxin === 'number'; });
    if (!leaves.length) {
      mx.trueIndex = round2(clamp(mx.trueIndex, 0, 100));
      mx.phase = getPhase(mx.trueIndex);
      return mx.trueIndex;
    }
    var sum = 0;
    var weight = 0;
    leaves.forEach(function(div) {
      var w = getPopulation(div);
      sum += clamp(div.minxin, 0, 100) * w;
      weight += w;
    });
    var prev = Number(mx.trueIndex);
    mx.trueIndex = round2(sum / Math.max(1, weight));
    mx.trend = isFinite(prev) ? (mx.trueIndex > prev ? 'rising' : (mx.trueIndex < prev ? 'falling' : 'stable')) : mx.trend || 'stable';
    mx.phase = getPhase(mx.trueIndex);
    return mx.trueIndex;
  }

  function findClassByTarget(root, target) {
    var wanted = normalizeName(target && (target.name || target.className || target.classKey || target));
    var key = explicitKey(target && (target.classKey || target.key || target.id));
    var list = getClasses(root);
    for (var i = 0; i < list.length; i += 1) {
      var cls = list[i];
      if (!cls) continue;
      if (key && classKeyOf(cls) === key) return cls;
      if (wanted && normalizeName(classNameOf(cls)) === wanted) return cls;
    }
    return null;
  }

  function applyToMatrix(root, signal, regionDivs, gatedDelta) {
    var mx = ensureMinxin(root);
    if (!mx.matrix || typeof mx.matrix !== 'object') mx.matrix = {};
    var classes = signal.targetClasses.length ? signal.targetClasses : getClasses(root).slice(0, 12).map(function(cls) {
      return { name: classNameOf(cls), classKey: classKeyOf(cls), weight: classShare(cls) };
    });
    if (!classes.length) return;
    regionDivs.forEach(function(div) {
      var rid = regionIdOf(div);
      if (!mx.matrix[rid]) mx.matrix[rid] = {};
      classes.forEach(function(target) {
        var cls = findClassByTarget(root, target) || target;
        var ck = target.classKey || classKeyOf(cls);
        var prev = mx.matrix[rid][ck] || {};
        var base = Number(prev.true != null ? prev.true : (prev.index != null ? prev.index : div.minxin));
        if (!isFinite(base)) base = Number(div.minxin);
        if (!isFinite(base)) base = mx.trueIndex;
        // 矩阵细项与叶子同口径：吃「削顶后」delta（旧写法吃原始 signal.deltaTrue·越触顶越漂移·2026-07-04 审查定罪）
        var next = round2(clamp(base + (gatedDelta != null ? gatedDelta : signal.deltaTrue), 0, 100));
        mx.matrix[rid][ck] = {
          regionId: rid,
          regionName: regionNameOf(div),
          classKey: ck,
          className: target.name || classNameOf(cls) || ck,
          true: next,
          index: next,
          perceived: prev.perceived != null ? prev.perceived : next,
          weight: Number(target.weight) || classShare(cls) || 0.08,
          lastTurn: signal.turn,
          lastReason: signal.reason,
          linkedIssue: signal.linkedIssue || ''
        };
      });
    });
  }

  function apply(root, signal, options) {
    root = pickRoot(root);
    options = options || {};
    var mx = ensureMinxin(root);
    if (!signal || typeof signal !== 'object') return { applied: false, reason: 'missing-signal' };
    if (signal.applied && !options.force) return { applied: false, duplicate: true };
    var delta = Number(signal.deltaTrue) || 0;
    var leaves = getLeafDivisions(root);
    var targetRows = signal.targetRegions || [];
    var affected = [];
    // P-ZV7·按源封顶 delta-gate：delta 落叶子 / 写细项前，按该源剩余 headroom 削这笔——
    //   使 mx.sources[源] 累计锁在 profile 区间内、trueIndex(叶子聚合)与细项同口径不再无限滑。
    //   削后 delta 同时喂叶子(:下)和 sources(:lower)，三者一致；源已到顶则 delta→0、本笔被吸收不动账。
    if (delta) {
      var _zvKey = signal.kind || signal.sourceSystem || 'minxin';
      var _zvCap = MINXIN_SOURCE_CAP[_zvKey] || MINXIN_SOURCE_CAP._default;
      if (_zvCap) {
        var _zvCur = Number(mx.sources[_zvKey]) || 0;
        var _zvGd = round2(clamp(_zvCur + delta, _zvCap[0], _zvCap[1]) - _zvCur);
        // 越界旧账防翻转：削顶只许缩量/归零·不许把小额同号 delta 翻成拉回边界的大额反号 delta(2026-07-04 审查定罪)
        if (_zvGd !== 0 && (_zvGd > 0) !== (delta > 0)) _zvGd = 0;
        else if (Math.abs(_zvGd) > Math.abs(delta)) _zvGd = delta;
        delta = _zvGd;
      }
    }
    if (delta) {
      if (targetRows.length && leaves.length) {
        var total = targetRows.reduce(function(sum, r) { return sum + Math.max(0, Number(r.weight) || 0); }, 0) || 1;
        targetRows.forEach(function(r) {
          var matched = leaves.filter(function(div) { return matchRegion(div, r.region); });
          var perRegionDelta = r.deltaTrue != null ? Number(r.deltaTrue) : delta * ((Number(r.weight) || 1) / total);
          matched.forEach(function(div) {
            var before = Number(div.minxin != null ? div.minxin : div.minxinLocal);
            if (!isFinite(before)) return;
            writeDivisionMinxin(div, before + perRegionDelta);
            affected.push({ region: regionNameOf(div), regionId: regionIdOf(div), before: round2(before), after: round2(div.minxin), delta: round2(div.minxin - before) });
          });
        });
        if (!affected.length) {
          // 目标区域全失配（跨剧本别名/AI 生成地名）：全国兜底摊布——旧行为是静默丢弃效果却仍烧封顶额度(2026-07-04 审查定罪)
          leaves.forEach(function(div) {
            var before = Number(div.minxin != null ? div.minxin : div.minxinLocal);
            if (!isFinite(before)) return;
            writeDivisionMinxin(div, before + delta);
            affected.push({ region: regionNameOf(div), regionId: regionIdOf(div), before: round2(before), after: round2(div.minxin), delta: round2(div.minxin - before) });
          });
        }
      } else if (leaves.length) {
        leaves.forEach(function(div) {
          var before = Number(div.minxin != null ? div.minxin : div.minxinLocal);
          if (!isFinite(before)) return;
          writeDivisionMinxin(div, before + delta);
          affected.push({ region: regionNameOf(div), regionId: regionIdOf(div), before: round2(before), after: round2(div.minxin), delta: round2(div.minxin - before) });
        });
      } else {
        var old = Number(mx.trueIndex);
        mx.trueIndex = round2(clamp(old + delta, 0, 100));
        affected.push({ region: 'global', before: round2(old), after: mx.trueIndex, delta: round2(mx.trueIndex - old) });
      }
      var sourceKey = signal.kind || signal.sourceSystem || 'minxin';
      mx.sources[sourceKey] = round2((Number(mx.sources[sourceKey]) || 0) + delta);
    }
    if (affected.length) applyToMatrix(root, signal, affected.map(function(a) {
      return leaves.filter(function(div) { return regionIdOf(div) === a.regionId; })[0] || { id: a.regionId, name: a.region, minxin: a.after };
    }));
    if (options.deferFinalize === true) {
      // 2026-06-10·性能:批量路径下整体级收口(aggregateTrue/rebuildMatrix/updatePerception)挪到批末
      // finalizeBatch 一次。原先每笔 apply 都全量重建 叶子×阶层 矩阵+两次全树聚合——真存档实测
      // applyPending 107 笔×59ms = 6.7s 主线程冻结(与 1.3.3.1 rebuildMirrors 逐项重建同病同治)。
      // 叶子写入/封顶/矩阵触点(applyToMatrix)仍逐笔做·只有派生缓存收口推迟·欠账由 WeakMap 标脏。
      if (_deferredFinalize) _deferredFinalize.set(root, true);
    } else {
      aggregateTrue(root);
      rebuildMatrix(root, { preserveExisting: true, source: options.source || signal.sourceSystem });
      updatePerception(root, options);
    }
    signal.applied = true;
    signal.appliedTurn = Number(options.turn != null ? options.turn : root.turn) || signal.turn || 0;
    signal.appliedSource = options.source || 'minxin-ledger';
    signal.affectedRegions = affected;
    ensureStore(root).stats.applied = (Number(ensureStore(root).stats.applied) || 0) + 1;
    return { applied: true, signal: signal, affectedRegions: affected, trueIndex: mx.trueIndex };
  }

  function recordAndApply(root, raw, options) {
    var signal = record(root, raw);
    var result = apply(root, signal, options || {});
    return { recorded: signal, applied: result.applied, result: result };
  }

  // 2026-06-10·批量收口:与 apply({deferFinalize:true}) 配对。无欠账时 no-op(幂等·调多无害)。
  // 不持久化欠账标记(WeakMap·会话内有效)——即便批中途异常漏收口,叶子真值已写对,
  // 派生缓存(trueIndex/matrix/perception)至迟在下一笔非 defer 的 apply 或回合末聚合时追平。
  var _deferredFinalize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  function finalizeBatch(root, options) {
    root = pickRoot(root);
    options = options || {};
    if (_deferredFinalize && _deferredFinalize.get(root) !== true && options.force !== true) return false;
    aggregateTrue(root);
    rebuildMatrix(root, { preserveExisting: true, source: options.source || 'minxin-ledger-batch' });
    updatePerception(root, options);
    if (_deferredFinalize) _deferredFinalize.delete(root);
    return true;
  }

  function regionalVariantSatisfaction(cls, div) {
    var nRegion = normalizeName(regionNameOf(div));
    var vars = toArray(cls && (cls.regionalVariants || cls.regionWeights || cls.regions));
    for (var i = 0; i < vars.length; i += 1) {
      var rv = vars[i];
      if (!rv) continue;
      var name = rv.region || rv.regionName || rv.name || rv.id;
      if (name && (normalizeName(name) === nRegion || nRegion.indexOf(normalizeName(name)) >= 0 || normalizeName(name).indexOf(nRegion) >= 0)) {
        var sat = Number(rv.satisfaction != null ? rv.satisfaction : rv.true);
        if (isFinite(sat)) return clamp(sat, 0, 100);
      }
    }
    return null;
  }

  function rebuildMatrix(root, options) {
    root = pickRoot(root);
    options = options || {};
    var mx = ensureMinxin(root);
    var old = options.preserveExisting === false ? {} : (mx.matrix || {});
    var matrix = {};
    var leaves = getLeafDivisions(root);
    var classes = getClasses(root);
    leaves.forEach(function(div) {
      if (!div || typeof div !== 'object') return;
      var rid = regionIdOf(div);
      var regionTrue = Number(div.minxin != null ? div.minxin : div.minxinLocal);
      if (!isFinite(regionTrue)) regionTrue = mx.trueIndex;
      matrix[rid] = matrix[rid] || {};
      classes.forEach(function(cls) {
        if (!cls) return;
        var ck = classKeyOf(cls);
        var prev = old[rid] && old[rid][ck] || {};
        var regionalSat = regionalVariantSatisfaction(cls, div);
        var sat = regionalSat != null ? regionalSat : classSatisfaction(cls, 50);
        var bias = (sat - 50) * 0.18;
        var trueValue = prev.true != null ? Number(prev.true) : regionTrue + bias;
        if (!isFinite(trueValue)) trueValue = regionTrue;
        matrix[rid][ck] = {
          regionId: rid,
          regionName: regionNameOf(div),
          classKey: ck,
          className: classNameOf(cls) || ck,
          true: round2(clamp(trueValue, 0, 100)),
          index: round2(clamp(trueValue, 0, 100)),
          perceived: prev.perceived != null ? prev.perceived : round2(clamp(trueValue, 0, 100)),
          weight: classShare(cls),
          satisfaction: round2(sat),
          influence: round2(classInfluence(cls)),
          lastReason: prev.lastReason || (regionalSat != null ? 'regionalVariant' : 'dynamic-inference'),
          linkedIssue: prev.linkedIssue || ''
        };
      });
    });
    mx.matrix = matrix;
    aggregateViews(root);
    return matrix;
  }

  function aggregateViews(root) {
    root = pickRoot(root);
    var mx = ensureMinxin(root);
    var leaves = getLeafDivisions(root);
    var byRegion = {};
    leaves.forEach(function(div) {
      var rid = regionIdOf(div);
      var truth = Number(div.minxin != null ? div.minxin : div.minxinLocal);
      if (!isFinite(truth)) truth = mx.trueIndex;
      byRegion[rid] = {
        regionId: rid,
        regionName: regionNameOf(div),
        true: round2(clamp(truth, 0, 100)),
        index: round2(clamp(truth, 0, 100)),
        perceived: mx.byRegion && mx.byRegion[rid] && mx.byRegion[rid].perceived != null ? mx.byRegion[rid].perceived : round2(clamp(truth, 0, 100)),
        phase: getPhase(truth),
        visibilityTier: mx.byRegion && mx.byRegion[rid] && mx.byRegion[rid].visibilityTier || mx.visibilityTier || 'moderate',
        population: getPopulation(div)
      };
    });
    var byClassAcc = {};
    Object.keys(mx.matrix || {}).forEach(function(rid) {
      Object.keys(mx.matrix[rid] || {}).forEach(function(ck) {
        var row = mx.matrix[rid][ck] || {};
        var w = Math.max(0.01, Number(row.weight) || 0.08) * Math.max(1, byRegion[rid] && byRegion[rid].population || 1);
        byClassAcc[ck] = byClassAcc[ck] || { sum: 0, perceivedSum: 0, weight: 0, className: row.className, classKey: ck, lastReason: row.lastReason, linkedIssue: row.linkedIssue };
        byClassAcc[ck].sum += (Number(row.true) || 0) * w;
        byClassAcc[ck].perceivedSum += (Number(row.perceived != null ? row.perceived : row.true) || 0) * w;
        byClassAcc[ck].weight += w;
        if (row.lastReason) byClassAcc[ck].lastReason = row.lastReason;
        if (row.linkedIssue) byClassAcc[ck].linkedIssue = row.linkedIssue;
      });
    });
    var byClass = {};
    Object.keys(byClassAcc).forEach(function(ck) {
      var acc = byClassAcc[ck];
      byClass[ck] = {
        classKey: ck,
        className: acc.className || ck,
        true: round2(acc.sum / Math.max(1, acc.weight)),
        index: round2(acc.sum / Math.max(1, acc.weight)),
        perceived: round2(acc.perceivedSum / Math.max(1, acc.weight)),
        weight: round2(acc.weight),
        phase: getPhase(acc.sum / Math.max(1, acc.weight)),
        lastReason: acc.lastReason || '',
        linkedIssue: acc.linkedIssue || ''
      };
    });
    mx.byRegion = byRegion;
    mx.byClass = byClass;
    return { byRegion: byRegion, byClass: byClass };
  }

  function corruptionIndex(root) {
    var c = root && root.corruption;
    if (typeof c === 'number') return clamp(c, 0, 100);
    if (!c || typeof c !== 'object') return 30;
    var n = Number(c.trueIndex != null ? c.trueIndex : (c.overall != null ? c.overall : c.index));
    return isFinite(n) ? clamp(n, 0, 100) : 30;
  }

  function auditStrength(root, options) {
    options = options || {};
    var direct = Number(options.auditStrength != null ? options.auditStrength : (root.auditSystem && root.auditSystem.strength));
    if (isFinite(direct)) return clamp(direct, 0, 1);
    var sup = Number(root.corruption && root.corruption.supervision && root.corruption.supervision.level);
    if (isFinite(sup)) return clamp(sup / 100, 0, 1);
    return 0.35;
  }

  function visibilityTierFromBias(bias) {
    bias = Math.abs(Number(bias) || 0);
    if (bias <= 3) return 'accurate';
    if (bias <= 9) return 'moderate';
    if (bias <= 16) return 'vague';
    return 'blind';
  }

  function updatePerception(root, options) {
    root = pickRoot(root);
    options = options || {};
    var mx = ensureMinxin(root);
    aggregateTrue(root);
    var corr = corruptionIndex(root);
    var audit = auditStrength(root, options);
    var baseBias = corr * 0.22 * (1 - audit);
    var rumor = Number(mx.prophecy && mx.prophecy.intensity) || 0;
    var bias = round2(baseBias - rumor * 5);
    mx.perceivedIndex = round2(clamp(mx.trueIndex + bias, 0, 100));
    mx.visibilityTier = visibilityTierFromBias(mx.perceivedIndex - mx.trueIndex);
    mx.perception = { turn: Number(options.turn != null ? options.turn : root.turn) || 0, corruption: corr, auditStrength: round2(audit), bias: bias, visibilityTier: mx.visibilityTier };
    Object.keys(mx.byRegion || {}).forEach(function(rid) {
      var row = mx.byRegion[rid];
      var localBias = bias;
      row.perceived = round2(clamp((Number(row.true) || 0) + localBias, 0, 100));
      row.visibilityTier = visibilityTierFromBias(row.perceived - row.true);
    });
    Object.keys(mx.matrix || {}).forEach(function(rid) {
      Object.keys(mx.matrix[rid] || {}).forEach(function(ck) {
        var row = mx.matrix[rid][ck];
        row.perceived = round2(clamp((Number(row.true) || 0) + bias, 0, 100));
      });
    });
    aggregateViews(root);
    return clone(mx.perception);
  }

  var UPRISING_LEVELS = [
    { level: 1, name: 'rumor', threshold: 42, momentum: 18 },
    { level: 2, name: 'gathering', threshold: 32, momentum: 34 },
    { level: 3, name: 'riot', threshold: 24, momentum: 50 },
    { level: 4, name: 'rebellion', threshold: 16, momentum: 70 },
    { level: 5, name: 'dynasty-change', threshold: 8, momentum: 90 }
  ];

  function chainId(region, className) {
    return ['mxchain', normalizeName(region || 'general'), normalizeName(className || 'common')].join('-');
  }

  function levelForTruth(truth, momentum) {
    truth = Number(truth);
    momentum = Number(momentum) || 0;
    var level = 1;
    UPRISING_LEVELS.forEach(function(def) {
      if ((isFinite(truth) && truth <= def.threshold) || momentum >= def.momentum) level = Math.max(level, def.level);
    });
    return level;
  }

  function upsertChain(mx, raw, options) {
    raw = raw || {};
    options = options || {};
    var id = raw.id || chainId(raw.region, raw.className);
    var found = mx.uprisingChain.filter(function(x) { return x && x.id === id; })[0];
    var momentum = round2(clamp(raw.momentum != null ? raw.momentum : 20, 0, 100));
    var level = raw.level || levelForTruth(raw.true, momentum);
    if (!found) {
      found = {
        _touchedTurn: Number(options.turn) || 0,
        id: id,
        turn: Number(options.turn) || 0,
        region: raw.region || '',
        className: raw.className || '',
        classKey: raw.classKey || '',
        level: level,
        stage: (UPRISING_LEVELS[level - 1] || UPRISING_LEVELS[0]).name,
        momentum: momentum,
        cause: compact(raw.cause || raw.reason || 'low minxin pressure', 180),
        linkedIssue: raw.linkedIssue || '',
        sourceType: raw.sourceType || 'minxin-ledger',
        status: 'brewing',
        hidden: raw.hidden !== false
      };
      mx.uprisingChain.push(found);
    } else {
      found.momentum = round2(clamp(Math.max(found.momentum || 0, momentum), 0, 100));
      found.level = Math.max(found.level || 1, level);
      found.stage = (UPRISING_LEVELS[found.level - 1] || UPRISING_LEVELS[0]).name;
      found.cause = compact(raw.cause || raw.reason || found.cause, 180);
      found.linkedIssue = raw.linkedIssue || found.linkedIssue || '';
      found.lastTurn = Number(options.turn) || found.lastTurn || 0;
      found._touchedTurn = Number(options.turn) || 0; // 本回合被压力刷新·免于衰减
    }
    return found;
  }

  function syncRevoltFromChain(root, chain) {
    var mx = ensureMinxin(root);
    if (!chain || chain.level < 3) return null;
    var existing = mx.revolts.filter(function(r) { return r && r.sourceChainId === chain.id && r.status === 'ongoing'; })[0];
    if (existing) return existing;
    var _t = Number(root.turn) || 0;
    // 复燃冷却：同链上一场民变结束后 12 回合内不自动补位——旧行为=镇压次回合原地复活成永动民变(2026-07-04 审查定罪)
    if (chain._lastSpawnTurn != null && (_t - chain._lastSpawnTurn) < 12) return null;
    var scale = chain.level >= 4 ? 200000 : 30000;
    var revolt = {
      id: 'revolt-' + chain.id + '-t' + _t, // 带回合号唯一 id·旧写法复用同 id 令镇压 find 命中旧尸体(按 id 镇不掉复燃场)
      turn: chain.turn || root.turn || 0,
      region: chain.region || 'unknown',
      className: chain.className || '',
      level: chain.level,
      scale: scale,
      status: 'ongoing',
      cause: chain.cause,
      linkedIssue: chain.linkedIssue || '',
      sourceChainId: chain.id
    };
    mx.revolts.push(revolt);
    chain._lastSpawnTurn = _t;
    return revolt;
  }

  function advanceUprisingChain(root, options) {
    root = pickRoot(root);
    options = options || {};
    if (options.turn == null) options.turn = Number(root.turn) || 0; // 统一回合锚·upsert 的 _touchedTurn 与下方衰减判据同源
    var mx = ensureMinxin(root);
    if (!Array.isArray(mx.uprisingChain)) mx.uprisingChain = [];
    toArray(mx.uprisingCandidates).forEach(function(c) {
      if (!c) return;
      upsertChain(mx, {
        id: c.id ? 'mxchain-' + c.id : '',
        region: c.region || '',
        className: c.className || '',
        classKey: c.classKey || '',
        momentum: c.momentum || 25,
        level: c.level || 1,
        cause: c.cause || c.reason || '',
        linkedIssue: c.linkedIssue || '',
        hidden: c.hidden,
        sourceType: c.sourceType || 'class_minxin_bridge'
      }, options);
    });
    Object.keys(mx.byRegion || {}).forEach(function(rid) {
      var row = mx.byRegion[rid] || {};
      var truth = Number(row.true != null ? row.true : row.index);
      if (!isFinite(truth) || truth > 35) return;
      upsertChain(mx, {
        region: row.regionName || rid,
        className: 'common',
        momentum: round2((45 - truth) * 1.2),
        level: levelForTruth(truth, (45 - truth) * 1.2),
        true: truth,
        cause: 'low regional minxin',
        sourceType: 'regional_minxin'
      }, options);
    });
    // 链条衰减/退场：本回合未被压力刷新(候选与低民心区皆无)的链·势头逐回合消退·消尽除名——
    // 旧行为 momentum/level 只涨不落+每回合补 ongoing=民心恢复后民变仍永动(2026-07-04 审查定罪)
    var _nowTurn = Number(options.turn) || 0;
    mx.uprisingChain = mx.uprisingChain.filter(function(chain) {
      if (!chain) return false;
      if (chain._touchedTurn === _nowTurn) return true;
      chain.momentum = round2(Math.max(0, (Number(chain.momentum) || 0) - 12));
      if (chain.momentum < 30 && (chain.level || 1) > 1) {
        chain.level = (chain.level || 1) - 1;
        chain.stage = (UPRISING_LEVELS[chain.level - 1] || UPRISING_LEVELS[0]).name;
      }
      return chain.momentum > 0;
    });
    mx.uprisingChain = mx.uprisingChain.slice(-80);
    mx.uprisingChain.forEach(function(chain) { syncRevoltFromChain(root, chain); });
    root._minxinLedgerUprising = { turn: Number(options.turn != null ? options.turn : root.turn) || 0, chains: mx.uprisingChain.length, revolts: toArray(mx.revolts).filter(function(r) { return r && r.status === 'ongoing'; }).length };
    return clone(root._minxinLedgerUprising);
  }

  function maintain(root, options) {
    root = pickRoot(root);
    options = options || {};
    ensureStore(root);
    rebuildMatrix(root, { preserveExisting: true, source: options.source || 'minxin-ledger-maintain' });
    updatePerception(root, options);
    var uprising = advanceUprisingChain(root, options);
    root._minxinLedgerMaintenance = {
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      source: options.source || 'minxin-ledger-maintain',
      ledger: ensureStore(root).items.length,
      regions: Object.keys(ensureMinxin(root).byRegion || {}).length,
      classes: Object.keys(ensureMinxin(root).byClass || {}).length,
      uprisingChains: uprising.chains || 0,
      revolts: uprising.revolts || 0
    };
    return clone(root._minxinLedgerMaintenance);
  }

  function recordFromSocialSignal(root, signal, options) {
    root = pickRoot(root);
    signal = signal || {};
    var classes = toArray(signal.affectedClasses).map(function(c) { return c && (c.name || c.className || c.class || c); }).filter(Boolean);
    if (!classes.length && !toArray(signal.targetClasses).length) return null;
    return record(root, {
      turn: signal.turn,
      sourceSystem: signal.sourceSystem || 'social-political-signal',
      kind: 'social-evidence',
      targetClasses: classes,
      deltaTrue: 0,
      intensity: signal.intensity,
      confidence: signal.confidence,
      reason: signal.reason || signal.kind,
      linkedIssue: signal.linkedIssue || '',
      tags: signal.tags || []
    }, options);
  }

  function recentCauses(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(30, Number(options.limit || 8) || 8));
    var target = normalizeName(options.region || options.className || options.target || '');
    return toArray(ensureStore(root).items).slice().reverse().filter(function(row) {
      if (!target) return true;
      var hay = [row.reason, row.linkedIssue, row.kind, row.sourceSystem].concat(toArray(row.targetRegions).map(function(r) { return r.region; })).concat(toArray(row.targetClasses).map(function(c) { return c.name || c.classKey; })).join(' ');
      return normalizeName(hay).indexOf(target) >= 0;
    }).slice(0, limit).map(clone);
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(60, Number(options.limit || 12) || 12));
    var mx = ensureMinxin(root);
    return {
      trueIndex: mx.trueIndex,
      perceivedIndex: mx.perceivedIndex,
      phase: mx.phase,
      visibilityTier: mx.visibilityTier || '',
      maintenance: clone(root._minxinLedgerMaintenance || null),
      perception: clone(mx.perception || null),
      recent: recentCauses(root, { limit: limit }),
      byRegion: clone(mx.byRegion || {}),
      byClass: clone(mx.byClass || {}),
      uprisingChain: toArray(mx.uprisingChain).slice(-limit).reverse().map(clone)
    };
  }

  function formatLedgerLine(row) {
    var regions = toArray(row.targetRegions).map(function(r) { return r.region; }).filter(Boolean).join('/');
    var classes = toArray(row.targetClasses).map(function(c) { return c.name || c.classKey; }).filter(Boolean).join('/');
    return '- T' + (row.turn || '') + ' [' + (row.sourceSystem || '') + '/' + (row.kind || '') + '] delta=' + (row.deltaTrue || 0)
      + (regions ? ' regions=' + regions : '')
      + (classes ? ' classes=' + classes : '')
      + (row.linkedIssue ? ' issue=' + row.linkedIssue : '')
      + ' reason=' + compact(row.reason || '', 140);
  }

  function formatChainLine(chain) {
    return '- uprisingChain ' + (chain.region || '')
      + (chain.className ? ' class=' + chain.className : '')
      + ' level=' + (chain.level || 1)
      + ' momentum=' + (chain.momentum || 0)
      + (chain.linkedIssue ? ' issue=' + chain.linkedIssue : '')
      + ' cause=' + compact(chain.cause || '', 120);
  }

  function formatForPrompt(root, options) {
    var snap = snapshot(root, options || {});
    if (!snap.recent.length && !snap.uprisingChain.length) return '';
    var lines = ['\n\n=== Minxin Ledger ==='];
    lines.push('truth=' + Math.round(snap.trueIndex || 0) + ' perceived=' + Math.round(snap.perceivedIndex || 0) + ' phase=' + phaseName(snap.phase) + ' visibility=' + (snap.visibilityTier || ''));
    if (snap.perception) lines.push('perception bias=' + snap.perception.bias + ' corruption=' + snap.perception.corruption + ' audit=' + snap.perception.auditStrength);
    if (snap.recent.length) lines.push('recent:\n' + snap.recent.map(formatLedgerLine).join('\n'));
    if (snap.uprisingChain.length) lines.push('uprising:\n' + snap.uprisingChain.map(formatChainLine).join('\n'));
    return lines.join('\n');
  }

  function diagnosticsText(root, options) {
    var snap = snapshot(root, options || {});
    var store = ensureStore(root);
    var lines = ['=== Minxin Ledger Diagnostics ==='];
    lines.push('truth=' + Math.round(snap.trueIndex || 0) + ' perceived=' + Math.round(snap.perceivedIndex || 0) + ' phase=' + phaseName(snap.phase) + ' visibility=' + (snap.visibilityTier || ''));
    lines.push('ledger recorded=' + (store.stats.recorded || 0) + ' applied=' + (store.stats.applied || 0) + ' stored=' + store.items.length);
    if (snap.maintenance) lines.push('maintenance turn=' + snap.maintenance.turn + ' regions=' + snap.maintenance.regions + ' classes=' + snap.maintenance.classes + ' uprisingChains=' + snap.maintenance.uprisingChains);
    if (snap.perception) lines.push('perception corruption=' + snap.perception.corruption + ' audit=' + snap.perception.auditStrength + ' bias=' + snap.perception.bias);
    if (snap.recent.length) lines.push('recent:\n' + snap.recent.map(formatLedgerLine).join('\n'));
    if (snap.uprisingChain.length) lines.push('uprisingChain:\n' + snap.uprisingChain.map(formatChainLine).join('\n'));
    return lines.join('\n');
  }

  // P-ZV7·⑤读档削平：把各源累计一次性夹进 MINXIN_SOURCE_CAP 封顶内（历史超额账规整）。
  //   对越界源发一笔"规整 delta"经 recordAndApply→gate→摊叶子·trueIndex 随之回正（非只动显示细项）。
  //   由 tm-migration v4 读档时调一次（幂等·只跑一遍）。返回规整明细供邸报。
  function regularizeSourceCaps(root) {
    if (!root || !root.minxin || !root.minxin.sources) return { regularized: [] };
    var src = root.minxin.sources;
    var out = [];
    Object.keys(src).forEach(function(key) {
      var cap = MINXIN_SOURCE_CAP[key] || MINXIN_SOURCE_CAP._default; // 表外源同样按 _default 削平·否则越界旧账永不规整
      if (!cap) return;
      var cur = Number(src[key]) || 0;
      var target = clamp(cur, cap[0], cap[1]);
      var recovery = round2(target - cur);
      if (recovery !== 0) {
        recordAndApply(root, { sourceSystem: 'pzv7-regularize', kind: key, deltaTrue: recovery, reason: '账目规整·历史超额削平', confidence: 1 }, { source: 'pzv7-regularize', turn: root.turn });
        out.push({ source: key, from: round2(cur), to: round2(target), recovery: recovery });
      }
    });
    return { regularized: out };
  }

  TM.MinxinLedger = {
    record: record,
    apply: apply,
    recordAndApply: recordAndApply,
    finalizeBatch: finalizeBatch,
    regularizeSourceCaps: regularizeSourceCaps,
    maintain: maintain,
    rebuildMatrix: rebuildMatrix,
    updatePerception: updatePerception,
    advanceUprisingChain: advanceUprisingChain,
    aggregateTrue: aggregateTrue,
    recordFromSocialSignal: recordFromSocialSignal,
    recentCauses: recentCauses,
    snapshot: snapshot,
    formatForPrompt: formatForPrompt,
    diagnosticsText: diagnosticsText,
    _getLeafDivisions: getLeafDivisions,
    _getPhase: getPhase
  };

  global.MinxinLedger = TM.MinxinLedger;
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.MinxinLedger;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
