// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-reform-evolution.js — Stage 2·Phase L·Slice L8·LLM 演化推演 + 改革志 + 跨代承袭
 *
 * 职责·
 *   AI·4·改革后 1-2y 年度 LLM 推演·写入 _reformChronicle[histId][year] ~150 字古文
 *   AI·8·朝代过渡时 LLM 推三态 (inherit/reject/compromise) + 旨意 200 字
 *   persistence·localStorage 'tm_keju_inheritance_archive' 跨剧本 ledger·LRU 50
 *
 * 暴露·_kjpL8LlmEvolveYear / _kjpL8LlmInheritanceVerdict / _kjpL8EvolveTick /
 *      _kjpL8MaybeApplyInheritance / _kjpL8ArchiveMatured / _kjpL8FindMatchingArchive /
 *      _kjpL8ApplyInheritanceMode / _kjpL8ApplyEvolutionDeltas /
 *      _kjpL8NormalizeEvolution / _kjpL8NormalizeInheritance /
 *      _kjpL8EvolveFallback / _kjpL8InheritanceFallback /
 *      _kjpMigrateReformChronicleV1 (migration helper)
 *
 * 调用 budget·每年 evolve ~800-1500 token·30y matured ~24-45k / reform·flag gate
 *   P.conf.useNewKejuL8 !== false（默认开）·仅显式设 =false 才全 no-op
 *
 * red line·
 *   - 全 LLM 容错·失败 fallback·panel 不崩
 *   - 真历史素材·非天命扣 / 玄幻惩罚
 *   - npcReact 必绑 entry.supportNpcs/opposeNpcs pool·post-validate filter
 *   - throttle·一 endTurn 1 LLM call·round-robin reform·防 token 燃爆
 *   - flag off 全 noop·零成本
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·shared helpers (复用 L3 paradigm·but local 防 IIFE coupling)
  // ════════════════════════════════════════════════════════════════

  function _hasAI() {
    return typeof callAISmart === 'function' &&
           typeof P !== 'undefined' && P && P.ai && P.ai.key;
  }

  function _parseJson(raw) {
    if (!raw) return null;
    try {
      var s = String(raw).replace(/```json|```/g, '').trim();
      var jm = s.match(/[\{\[][\s\S]*[\}\]]/);
      if (jm) s = jm[0];
      return JSON.parse(s);
    } catch (e) {
      try { console.warn('[L8·parse] fail·raw=', String(raw).slice(0, 200), e); } catch(_){}
      return null;
    }
  }

  function _kjpAliveNpcName(n) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
    return ch && !ch._retired && ch.alive !== false;
  }

  // 朝代承袭顺序·han < tang < song < yuan < ming < qing
  var ERA_ORDER = ['han', 'tang', 'song', 'yuan', 'ming', 'qing'];
  var INHERITANCE_LS_KEY = 'tm_keju_inheritance_archive';
  var INHERITANCE_LRU_MAX = 50;

  // RAA·C1+C2·中文 era (`明末·天启朝尾`) → pinyin key·非凭推 .toLowerCase()
  // (toLowerCase 不动汉字·ERA_ORDER.indexOf 永 -1·persistence 永不触发)
  function _kjpL8EraToKey(eraStr) {
    if (!eraStr) return '';
    var s = String(eraStr).toLowerCase().trim();
    if (ERA_ORDER.indexOf(s) >= 0) return s;     // 已是 pinyin·直返
    // 中文 substring 匹配 (覆历史 + 末·北 + 南 等前缀朝代字符串)
    if (eraStr.indexOf('汉') >= 0) return 'han';
    if (eraStr.indexOf('唐') >= 0) return 'tang';
    if (eraStr.indexOf('宋') >= 0) return 'song';
    if (eraStr.indexOf('元') >= 0) return 'yuan';
    if (eraStr.indexOf('明') >= 0) return 'ming';
    if (eraStr.indexOf('清') >= 0) return 'qing';
    return '';
  }

  // ════════════════════════════════════════════════════════════════
  // §1·fallback + normalize (RBB·B5·全 body)
  // ════════════════════════════════════════════════════════════════

  function _kjpL8EvolveFallback(entry, year) {
    var elapsed = year - ((entry && entry.year) || year);
    return {
      text: '(无 LLM·' + ((entry && entry.magnitudeDescriptor) || '改革') +
            '·施行第 ' + elapsed + ' 年·朝野循常·待真演化)',
      snippets: [],
      dimDelta: { loyaltyAccum: 0, corruptionAccum: 0, civilianReact: 0, factionTension: 0 },
      npcReact: []
    };
  }

  function _kjpL8InheritanceFallback(archive, currentScenario) {
    var subs = (archive && archive.addedSubjectNames) || [];
    return {
      mode: 'compromise',
      edict: '诏曰·前朝改革有得有失·朕酌行之·钦此',
      keepSubjects: subs.slice(0, Math.ceil(subs.length / 2)),
      removeSubjects: [],
      rationale: '(无 LLM·默 compromise·留半数)',
      fromArchive: (archive && archive.archiveKey) || '',
      by: (currentScenario && currentScenario.emperor) || '陛下',
      year: (typeof GM !== 'undefined' && GM && GM.year) ||
            (currentScenario && currentScenario.startYear) || 0
    };
  }

  function _kjpL8NormalizeEvolution(p, entry, year) {
    var allowedActions = ['劾', '议', '辞', '贺', '默'];
    var supOpp = ((entry && entry.supportNpcs) || []).concat((entry && entry.opposeNpcs) || []);
    var supOppSet = {};
    supOpp.forEach(function(n) { if (n) supOppSet[n] = true; });
    var dd = (p && p.dimDelta) || {};
    function clampDim(v) {
      var n = parseInt(v, 10);
      if (!Number.isFinite(n)) return 0;
      return Math.max(-10, Math.min(10, n));
    }
    return {
      text: String((p && p.text) || '').slice(0, 300),
      snippets: (Array.isArray(p && p.snippets) ? p.snippets : []).slice(0, 3)
                .map(function(s) { return String(s || '').slice(0, 30); }),
      dimDelta: {
        loyaltyAccum: clampDim(dd.loyaltyAccum),
        corruptionAccum: clampDim(dd.corruptionAccum),
        civilianReact: clampDim(dd.civilianReact),
        factionTension: clampDim(dd.factionTension)
      },
      // RBB·B3·post-validate·LLM 返 npc 不在 pool·skip
      npcReact: (Array.isArray(p && p.npcReact) ? p.npcReact : []).slice(0, 2)
                .filter(function(r) { return r && r.name && supOppSet[r.name]; })
                .map(function(r) {
                  return {
                    name: r.name,
                    reaction: String(r.reaction || '').slice(0, 20),
                    action: allowedActions.indexOf(r.action) >= 0 ? r.action : '默'
                  };
                })
    };
  }

  function _kjpL8NormalizeInheritance(p, archive, currentScenario) {
    var allowedModes = ['inherit', 'reject', 'compromise'];
    var availSubjects = (archive && archive.addedSubjectNames) || [];
    return {
      mode: allowedModes.indexOf(p && p.mode) >= 0 ? p.mode : 'compromise',
      edict: String((p && p.edict) || '').slice(0, 400),
      keepSubjects: (Array.isArray(p && p.keepSubjects) ? p.keepSubjects : [])
                    .filter(function(n) { return availSubjects.indexOf(n) >= 0; }),
      removeSubjects: (Array.isArray(p && p.removeSubjects) ? p.removeSubjects : [])
                      .filter(function(n) { return availSubjects.indexOf(n) >= 0; }),
      rationale: String((p && p.rationale) || '').slice(0, 200),
      fromArchive: (archive && archive.archiveKey) || '',
      by: (currentScenario && currentScenario.emperor) || '陛下',
      year: (typeof GM !== 'undefined' && GM && GM.year) ||
            (currentScenario && currentScenario.startYear) || 0
    };
  }

  // ════════════════════════════════════════════════════════════════
  // §2·LLM helpers
  // ════════════════════════════════════════════════════════════════

  // L8·a·LLM 推该年改革实施 1 事·150 字古文
  // RBB·B2 dim enum 4 类·B3 npc 必绑 pool·B7 typeof defensive·B8 historicalAnalog 入 prompt
  async function _kjpL8LlmEvolveYear(histEntry, year) {
    if (!histEntry || !year) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    var fallback = _kjpL8EvolveFallback(histEntry, year);
    if (!_hasAI()) return fallback;

    var paradigm = GM._kejuParadigm || {};
    var diffSnippet = histEntry.magnitudeDescriptor || '改革';
    // L9·C4·filter _retired / dead NPC·避免 L8 prompt 含已退人物
    var sup = (histEntry.supportNpcs || []).filter(_kjpAliveNpcName).slice(0, 3);
    var opp = (histEntry.opposeNpcs || []).filter(_kjpAliveNpcName).slice(0, 3);
    var allNpcsForReact = sup.concat(opp);
    var elapsedYears = year - (histEntry.year || year);
    var stage = (paradigm._reformInProgress && paradigm._reformInProgress.stage) || 'unknown';

    // RBB·B8·新 subjects 历史出处入 prompt
    var newSubjectsLine = '';
    var addedSubjects = (histEntry.diff && histEntry.diff.subjects && histEntry.diff.subjects.added) || [];
    if (addedSubjects.length) {
      newSubjectsLine = '【新科出处】' + addedSubjects.slice(0, 3).map(function(s) {
        return (s.name || '') + '·' + (s.historicalAnalog || '无先例');
      }).join('·') + '\n';
    }

    var prompt =
      '【改革】' + diffSnippet + '·' + (histEntry.method || '') + '\n' +
      '【支持】' + (sup.join('、') || '无') + '\n' +
      '【反对】' + (opp.join('、') || '无') + '\n' +
      newSubjectsLine +
      '【施行】第 ' + elapsedYears + ' 年·阶段·' + stage + '\n' +
      '【当年】' + year + '·朝代·' + (paradigm.initEra || '') + '\n\n' +
      '请按真历史 paradigm·写该年改革实施 1 事·\n' +
      '- 150 字古文·叙事简练·若新政见效写 1 喜·若反弹写 1 事·若顺则写 1 衍\n' +
      '- 真历史素材·王安石青苗法第 2 年河北饥 / 张相考成第 3 年御史劾 / 戊戌第 100 日变\n' +
      '- 不写未发生事·只写该年实情\n' +
      '- npcReact 只可用·' + (allNpcsForReact.join('、') || '(无)') + '·不可凭空起人名\n\n' +
      '返 JSON·{\n' +
      '  text: "150 字古文",\n' +
      '  snippets: ["人 + 事 + 地·15 字 / 条·1-3 条"],\n' +
      '  dimDelta: {\n' +
      '    loyaltyAccum: -10~10,\n' +
      '    corruptionAccum: -10~10,\n' +
      '    civilianReact: -10~10,\n' +
      '    factionTension: -10~10\n' +
      '  },\n' +
      '  npcReact: [{name, reaction, action: "劾/议/辞/贺/默"}]\n' +
      '}';

    try {
      var raw = await callAISmart(prompt, 1000, { maxRetries: 1, priority: 'low', timeoutMs: 25000 });
      var parsed = _parseJson(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.text) return fallback;
      return _kjpL8NormalizeEvolution(parsed, histEntry, year);
    } catch (e) {
      try { console.warn('[L8·a] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  // L8·c·LLM 跨代承袭推三态 + 200 字旨意
  // RBB·C3·用真存在字段·P.playerInfo.coreContradictions + scenario.dynastyPhaseHint
  async function _kjpL8LlmInheritanceVerdict(archive, currentScenario) {
    if (!archive || !currentScenario) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    var fallback = _kjpL8InheritanceFallback(archive, currentScenario);
    if (!_hasAI()) return fallback;

    var prevEra = archive.era || '';
    var newEra = currentScenario.era || currentScenario.dynasty || '';
    var lastInfo = archive.magnitudeDescriptor || '前朝改革';

    var newIdeologyHints = [];
    try {
      var cc = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.coreContradictions) || [];
      cc.slice(0, 2).forEach(function(c) {
        if (c) newIdeologyHints.push((c.dimension || '') + ':' + (c.title || ''));
      });
      var dph = currentScenario.dynastyPhaseHint || '';
      if (dph) newIdeologyHints.push('期·' + dph);
    } catch(_){}

    var prompt =
      '【前朝】' + prevEra + '·已成改革·' + lastInfo + '\n' +
      '【新朝】' + newEra + '·' + (newIdeologyHints.join('·') || '(无 hint)') + '\n' +
      '【前朝新加科】' + ((archive.addedSubjectNames || []).join('·') || '(无)') + '\n\n' +
      '请按真历史 paradigm·新朝看前朝改革·推三态·\n' +
      '- mode·"inherit" (承袭·清承明八股) / "reject" (反对·明罢宋经义考) / "compromise" (折中·汉折秦三公九卿)\n' +
      '- 旨意·200 字古文·诏书风·头"诏曰"·尾"钦此"\n' +
      '- compromise 时·指 keep / remove 哪几科·只可从【前朝新加科】选\n\n' +
      '返 JSON·{\n' +
      '  mode: "inherit" / "reject" / "compromise",\n' +
      '  edict: "200 字诏书",\n' +
      '  keepSubjects: ["科名"],\n' +
      '  removeSubjects: ["科名"],\n' +
      '  rationale: "100 字解读"\n' +
      '}';

    try {
      var raw = await callAISmart(prompt, 1500, { maxRetries: 1, priority: 'low', timeoutMs: 30000 });
      var parsed = _parseJson(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.mode) return fallback;
      return _kjpL8NormalizeInheritance(parsed, archive, currentScenario);
    } catch (e) {
      try { console.warn('[L8·c] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §3·endTurn evolution tick·B1 schema/B4 throttle/B6 cooldown/B7 defensive
  // ════════════════════════════════════════════════════════════════

  function _kjpL8EvolveTick() {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL8 === false) return;
    var year = GM.year || 0;
    if (!year) return;
    // RBB·BB-A1·idempotent guard·防 endTurn pipeline 两路 (deferred phase5 + render-finalize) 双跑
    // (跟 L7 _lastL7TickTurn 同 paradigm·否则 _l8RoundRobinIdx 双 +1 跳半数 reform)
    var curTurn = GM.turn || 0;
    if (GM._kejuParadigm._lastL8TickTurn === curTurn) return;
    GM._kejuParadigm._lastL8TickTurn = curTurn;

    var history = GM._kejuParadigm.history || [];
    // RBB·B1·schema v1·_reformChronicle[histId][year]
    var chronicle = (GM._kejuParadigm._reformChronicle = GM._kejuParadigm._reformChronicle || {});
    // RBB·BB-B3·schema sanity·若 chronicle 看起来是旧 schema (top-key 是 year number)·skip 写
    // 避污染未 migrate 的 v1 数据 (migrator failed silently 时的兜底)
    var topKeys = Object.keys(chronicle);
    if (topKeys.length) {
      var allYearKeys = topKeys.every(function(k) {
        var n = parseInt(k, 10);
        return n >= 1000 && n <= 3000;
      });
      if (allYearKeys) {
        try { console.warn('[L8·EvolveTick] _reformChronicle 仍 v1 schema·skip 写·检查 migrator'); } catch(_){}
        return;
      }
    }

    var activeReforms = history.filter(function(e) {
      return e && (e.status === 'ramping' || e.status === 'active');
    });
    // RAA·B4·explicit length===0 early return (避 idx % 0 = NaN 语义)
    if (activeReforms.length === 0) return;

    // RBB·B4·throttle·round-robin·一 tick 1 reform·防 token 燃爆
    GM._kejuParadigm._l8RoundRobinIdx = ((GM._kejuParadigm._l8RoundRobinIdx || 0) + 1) % activeReforms.length;
    var entry = activeReforms[GM._kejuParadigm._l8RoundRobinIdx];
    if (!entry || !entry.id) return;

    // RBB·B6·cooldown·同年只 1 次 (检查在写 chronicle 前·否则会留空 dict)
    var lastYear = entry._lastEvolveYear || 0;
    if (lastYear === year) return;
    // RAA·B1·fail backoff·若连续 3 次 fail·当作已处理 (避每 tick 重打 LLM)
    // RBB·BB-B1·backoff 后必 reset failCount=0·否则下年仍 ≥3·永 backoff·永不再试 (forever skip)
    var failCount = entry._l8FailCount || 0;
    if (failCount >= 3) {
      entry._lastEvolveYear = year;       // skip 本年
      entry._l8FailCount = 0;              // RBB·BB-B1·reset·下年 fresh attempt·非永 backoff
      return;
    }
    // 该年已写真 (非 stub)·skip
    if (chronicle[entry.id] && chronicle[entry.id][year] && !chronicle[entry.id][year]._stub) return;
    // 初始化 sub-dict (cooldown / dup-skip 都过了·才建)
    if (!chronicle[entry.id]) chronicle[entry.id] = {};

    _kjpL8LlmEvolveYear(entry, year).then(function(evo) {
      if (!evo) {
        // RAA·B1·null evo·当作 fail·累计
        entry._l8FailCount = (entry._l8FailCount || 0) + 1;
        return;
      }
      // 守 evo 写 chronicle 前·若 specialEvent 已先于 evo 写 (L9 sync probe 并行)·preserve
      // RBB·BB-C1·若 L9 写过 stub text (_textFromL9)·L8 evo 真 text 覆盖·清 _textFromL9 标记
      var existingEvent = (chronicle[entry.id][year] && chronicle[entry.id][year].specialEvent) || null;
      chronicle[entry.id][year] = Object.assign({}, evo, {
        histId: entry.id, by: entry.by, _stub: false
      });
      if (existingEvent) chronicle[entry.id][year].specialEvent = existingEvent;
      entry._lastEvolveYear = year;
      entry._l8FailCount = 0;   // 成功·清 fail count
      _kjpL8ApplyEvolutionDeltas(entry, evo);
      try {
        if (Array.isArray(GM._chronicle) && evo.text) {
          GM._chronicle.push({
            turn: GM.turn || 1, type: 'keju-reform-evolution',
            text: year + '年·改革志·' + evo.text.slice(0, 60) + '…',
            tags: ['科举', 'reform', 'evolution'],
            reformId: entry.id
          });
        }
      } catch(_){}
    }).catch(function() {
      // RAA·B1·真 exception·fail count++
      entry._l8FailCount = (entry._l8FailCount || 0) + 1;
    });

    // L9·C3·sync probe·async LLM·跟 evolve 并行 (写 chronicle 不同字段·non-race)
    if (typeof _kjpL9MaybeSpawnBlackSwan === 'function') {
      try { _kjpL9MaybeSpawnBlackSwan(entry, year); } catch(_){}
    }
  }

  // §3.1·apply dimDelta 入 game state
  // RAA·C3·corruption 真路径 GM.corruption.trueIndex (非 GM.vars['corruption'])
  // RAA·C4·_factionTension 真是 number (非 object·见 tm-keju-reform-apply.js:695)
  // RAA·C5·民心 真路径 GM.minxin.trueIndex (非 GM.vars['民心'])
  function _kjpL8ApplyEvolutionDeltas(entry, evo) {
    if (!evo || !evo.dimDelta) return;
    if (typeof GM === 'undefined' || !GM) return;
    var d = evo.dimDelta;
    try {
      // loyaltyAccum → support NPC ch.loyalty
      if (d.loyaltyAccum && entry && Array.isArray(entry.supportNpcs)) {
        entry.supportNpcs.forEach(function(n) {
          var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
          if (ch) ch.loyalty = Math.max(0, Math.min(100,
            (parseInt(ch.loyalty, 10) || 50) + d.loyaltyAccum));
        });
      }
      // RAA·C3·真路径·GM.corruption.trueIndex (CorruptionEngine 管)
      if (d.corruptionAccum && GM.corruption && typeof GM.corruption.trueIndex === 'number') {
        GM.corruption.trueIndex = Math.max(0, Math.min(100,
          GM.corruption.trueIndex + d.corruptionAccum));
      }
      // RAA·C5·真路径·GM.minxin.trueIndex
      if (d.civilianReact && GM.minxin && typeof GM.minxin.trueIndex === 'number') {
        GM.minxin.trueIndex = Math.max(0, Math.min(100,
          GM.minxin.trueIndex + d.civilianReact));
      }
      // RAA·C4·_factionTension 是 number·直加·clamp -100~100
      if (d.factionTension) {
        var ft = parseInt(GM._factionTension, 10) || 0;
        GM._factionTension = Math.max(-100, Math.min(100, ft + d.factionTension));
      }
    } catch(_){}
  }

  // ════════════════════════════════════════════════════════════════
  // §4·cross-scenario persistence·C1 全设计
  // ════════════════════════════════════════════════════════════════

  // L7·matured 时调·archive 入 localStorage·LRU 50
  function _kjpL8ArchiveMatured(entry) {
    if (typeof localStorage === 'undefined') return;
    if (!entry || typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    var paradigm = GM._kejuParadigm;
    var added = (entry.diff && entry.diff.subjects && entry.diff.subjects.added) || [];
    var dimChanges = entry._dimVar && Object.keys(entry._dimVar).length;
    // 仅 archive 有 subject 或 dim 变化的 reform·空 reform 不存
    if (!added.length && !dimChanges) return;

    // RAA·C1+C2·写 eraKey (规范化 pinyin)·find 用 eraKey·非生 era 字符串
    var eraKey = _kjpL8EraToKey(paradigm.initEra);
    var key = (eraKey || 'unknown') + '_' + (entry.by || '陛下') + '_' +
              (entry.magnitudeDescriptor || 'reform').slice(0, 10) + '_' + (entry.year || 0);
    var snapshot = {
      archiveKey: key,
      ts: Date.now(),
      era: paradigm.initEra || '',
      eraKey: eraKey,
      emperor: entry.by || '',
      year: entry.year || 0,
      magnitudeDescriptor: entry.magnitudeDescriptor || '',
      // L9·RBB·BB-A1·archive 加 canonicalName + historicalEvaluation·跨剧本 inherit 时 user 见前朝改革名
      canonicalName: entry.canonicalName || '',
      historicalEvaluation: entry.historicalEvaluation || '',
      ideology: paradigm.ideology || '',
      mode: entry.method || '',
      addedSubjectNames: added.map(function(s) { return s.name; }),
      subjectsSnapshot: added.map(function(s) { return Object.assign({}, s); }),
      examInterval: paradigm.examInterval,
      retakePolicy: paradigm.retakePolicy,
      ideologyShift: paradigm.ideology
    };
    try {
      var raw = localStorage.getItem(INHERITANCE_LS_KEY);
      var ledger = raw ? JSON.parse(raw) : { entries: [] };
      if (!Array.isArray(ledger.entries)) ledger.entries = [];
      // dedup by key·重存覆盖
      ledger.entries = ledger.entries.filter(function(e) { return e.archiveKey !== key; });
      ledger.entries.push(snapshot);
      if (ledger.entries.length > INHERITANCE_LRU_MAX) {
        // RBB·BB-B4·LRU evict·但每 era 至少保留 1 个 (最新)·避同 era 长期改革刷掉所有前朝
        var byEra = {};
        ledger.entries.forEach(function(e) {
          var eKey = e.eraKey || _kjpL8EraToKey(e.era) || 'unknown';
          if (!byEra[eKey] || byEra[eKey].ts < e.ts) byEra[eKey] = e;
        });
        var perEraLatest = {};
        Object.keys(byEra).forEach(function(k) { perEraLatest[byEra[k].archiveKey] = true; });
        // sort by ts desc·保 LRU_MAX·但 perEraLatest 必留
        var sorted = ledger.entries.slice().sort(function(a, b) { return b.ts - a.ts; });
        var kept = [];
        var keptKeys = {};
        // 先 keep per-era latest
        sorted.forEach(function(e) {
          if (perEraLatest[e.archiveKey]) {
            kept.push(e); keptKeys[e.archiveKey] = true;
          }
        });
        // 再 fill 剩余 (ts desc) 到 LRU_MAX
        for (var i = 0; i < sorted.length && kept.length < INHERITANCE_LRU_MAX; i++) {
          if (!keptKeys[sorted[i].archiveKey]) {
            kept.push(sorted[i]); keptKeys[sorted[i].archiveKey] = true;
          }
        }
        ledger.entries = kept;
      }
      localStorage.setItem(INHERITANCE_LS_KEY, JSON.stringify(ledger));
    } catch (e) { try { console.warn('[L8·archive write]', e); } catch(_){} }
  }

  // 找时间序上严格前朝的最近 archive·按 ts desc
  function _kjpL8FindMatchingArchive() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(INHERITANCE_LS_KEY);
      if (!raw) return null;
      var ledger = JSON.parse(raw);
      if (!ledger || !Array.isArray(ledger.entries) || !ledger.entries.length) return null;
      if (typeof GM === 'undefined' || !GM) return null;
      var paradigm = GM._kejuParadigm || {};
      // RAA·C1+C2·走 _kjpL8EraToKey 规范化·支持中文 era
      var currentKey = _kjpL8EraToKey(paradigm.initEra);
      var currentIdx = ERA_ORDER.indexOf(currentKey);
      if (currentIdx < 0) return null;
      var candidates = ledger.entries.filter(function(e) {
        // 兼容旧 archive·若无 eraKey·实时算
        var prevKey = e.eraKey || _kjpL8EraToKey(e.era);
        var prevIdx = ERA_ORDER.indexOf(prevKey);
        return prevIdx >= 0 && prevIdx < currentIdx;
      });
      if (!candidates.length) return null;
      candidates.sort(function(a, b) { return b.ts - a.ts; });
      return candidates[0];
    } catch (e) {
      try { console.warn('[L8·archive read]', e); } catch(_){}
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §5·跨代承袭 hook·C1/C2/C4/C5
  // ════════════════════════════════════════════════════════════════

  function _kjpL8MaybeApplyInheritance() {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL8 === false) return;
    var archive = _kjpL8FindMatchingArchive();
    if (!archive) return;
    var scenario = (P && P.scenario) || {};
    // 已 apply 过·跨 reload 防重
    if (GM._kejuParadigm._inheritance &&
        GM._kejuParadigm._inheritance.fromArchive === archive.archiveKey) return;

    _kjpL8LlmInheritanceVerdict(archive, scenario).then(function(verdict) {
      if (!verdict) return;
      if (!GM._kejuParadigm) return;
      GM._kejuParadigm._inheritance = verdict;
      var prevLen = (GM._kejuParadigm.subjects || []).length;
      _kjpL8ApplyInheritanceMode(verdict, archive);
      var newLen = (GM._kejuParadigm.subjects || []).length;
      var added = newLen - prevLen;
      try {
        if (Array.isArray(GM._chronicle)) {
          GM._chronicle.push({
            turn: GM.turn || 1, type: 'keju-reform-inheritance',
            text: '新朝承前·' + verdict.mode + '·' + (verdict.edict || '').slice(0, 60) + '…',
            tags: ['科举', 'reform', 'inheritance'],
            mode: verdict.mode
          });
        }
      } catch(_){}
      // RAA·C6·user feedback·toast 新加几科 + mode
      try {
        if (typeof toast === 'function') {
          var label = ({ inherit: '承袭', reject: '反对', compromise: '折中' })[verdict.mode] || verdict.mode;
          toast('📜 新朝承前·' + label + (added > 0 ? '·加 ' + added + ' 科' : ''));
        }
      } catch(_){}
      // L11·D3·async hook·spawn UI announce modal (跟 toast 互补·modal 给 user 细节展示)
      try {
        if (typeof window !== 'undefined' && typeof window._kjpL11RenderInheritanceModal === 'function') {
          window._kjpL11RenderInheritanceModal(verdict, archive);
        }
      } catch(_){}
    }).catch(function(){});
  }

  // RBB·C5·apply mode 3 路径·dedup against 现 subjects
  function _kjpL8ApplyInheritanceMode(verdict, archive) {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    if (!verdict || !archive) return;
    var subjects = (GM._kejuParadigm.subjects = GM._kejuParadigm.subjects || []);
    var existingNames = {};
    var existingIds = {};
    subjects.forEach(function(s) {
      if (s && s.name) existingNames[s.name] = true;
      if (s && s.id) existingIds[s.id] = true;
    });
    var year = GM.year || 0;

    function pushIfNew(s, byPrefix) {
      if (!s || !s.name) return;
      if (existingNames[s.name]) return;
      var newId = s.id;
      // RAA·B2·do-while·防二次撞 (跟 L6 BB-B2 同 paradigm)
      if (!newId || existingIds[newId]) {
        var tries = 0;
        do {
          newId = 'subject_inh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          tries++;
        } while (existingIds[newId] && tries < 5);
      }
      var copy = Object.assign({}, s, {
        id: newId,
        introducedYear: year,
        introducedBy: byPrefix + '·' + (s.introducedBy || '前朝'),
        _inheritedFrom: archive.archiveKey
      });
      subjects.push(copy);
      existingNames[s.name] = true;
      existingIds[newId] = true;
    }

    if (verdict.mode === 'inherit') {
      (archive.subjectsSnapshot || []).forEach(function(s) { pushIfNew(s, '新朝承前'); });
    } else if (verdict.mode === 'compromise') {
      var keep = verdict.keepSubjects || [];
      // RBB·BB-B2·LLM 真返 empty keepSubjects·fallback to all archive subjects (避静默零 inherit)
      // (跟 _kjpL8InheritanceFallback 半数 default 同 spirit·但 LLM 既然 mode='compromise' 必有意 keep)
      if (!keep.length) keep = (archive.addedSubjectNames || []).slice();
      (archive.subjectsSnapshot || []).forEach(function(s) {
        if (s && s.name && keep.indexOf(s.name) >= 0) pushIfNew(s, '新朝折中');
      });
    }
    // 'reject' 路径·不动 subjects·只记 verdict.edict (已入 GM._chronicle)
  }

  // ════════════════════════════════════════════════════════════════
  // §6·migration v0 → v1·_reformChronicle schema
  //   v0·{year: {histId, text, ...}}
  //   v1·{histId: {year: {text, ...}}}
  // ════════════════════════════════════════════════════════════════

  function _kjpMigrateReformChronicleV1(paradigm) {
    if (!paradigm || !paradigm._reformChronicle) return;
    var keys = Object.keys(paradigm._reformChronicle);
    if (!keys.length) return;
    // detect v0·若全 key 是 year-like (1000-3000)
    var isV0 = keys.every(function(k) {
      var n = parseInt(k, 10);
      return n >= 1000 && n <= 3000;
    });
    if (!isV0) return;   // 已 v1 / 空·skip
    var migrated = {};
    keys.forEach(function(yearStr) {
      var e = paradigm._reformChronicle[yearStr];
      if (!e || !e.histId) return;
      if (!migrated[e.histId]) migrated[e.histId] = {};
      migrated[e.histId][yearStr] = e;
    });
    paradigm._reformChronicle = migrated;
  }

  // ════════════════════════════════════════════════════════════════
  // §7·init hook·runtime 调
  // ════════════════════════════════════════════════════════════════

  function _initKejuL8Hook() {
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL8 === false) return;
    // setTimeout 0·让 init 同步链完成后再异步调
    setTimeout(function() {
      try { _kjpL8MaybeApplyInheritance(); }
      catch (e) { try { console.warn('[L8·init]', e); } catch(_){} }
    }, 0);
  }

  // ════════════════════════════════════════════════════════════════
  // §L9·LLM 命名 (AI·6) + 黑天鹅 (AI·7)
  //   完全 piggyback L7 commit + L8 EvolveTick·non-new tick·non-new modal
  //   net-new·2 LLM helper + dispatcher + apply·复用率 ~92%
  // ════════════════════════════════════════════════════════════════

  var BLACK_SWAN_TYPE_LABEL = {
    examiner_corrupt:  '主考贿赂',
    student_boycott:   '考生罢考',
    reformer_illness:  '改革者病',
    finance_diversion: '财政挪用'
  };
  var BLACK_SWAN_TYPES = Object.keys(BLACK_SWAN_TYPE_LABEL);
  var BLACK_SWAN_SEVERITY = ['low', 'mid', 'high'];

  // L9·a·命名 fallback (无 LLM 时)·年 + method + 简描
  function _kjpL9NameFallback(entry) {
    if (!entry) return null;
    var yr = entry.year ? (entry.year + '年') : '';
    var mid = entry.method === 'edict' ? '诏行'
            : entry.method === 'defy'  ? '强推'
            : '议定';
    return {
      canonicalName: (yr + mid + String(entry.magnitudeDescriptor || '改革').slice(0, 4)).slice(0, 12),
      historicalEvaluation: '(无 LLM·simple naming·' + (entry.magnitudeDescriptor || '改革') + ')'
    };
  }

  // L9·b·黑天鹅 fallback·默 low + examiner_corrupt·corruption +3
  function _kjpL9BlackSwanFallback(entry, year) {
    return {
      type: 'examiner_corrupt',
      severity: 'low',
      target: '(unknown)',
      narrative: '(无 LLM·' + year + '年·改革施行中·偶有舞弊·朝中议)',
      dimDelta: { corruption: 3, civilianReact: 0, factionTension: 0 },
      npcImpact: null,
      memorialTrigger: null
    };
  }

  // L9·normalize naming·slice + sanitize
  function _kjpL9NormalizeNaming(p) {
    if (!p || typeof p !== 'object') return null;
    var name = String(p.canonicalName || '').trim().slice(0, 12);
    return {
      canonicalName: name || '未名改革',
      historicalEvaluation: String(p.historicalEvaluation || '').slice(0, 100)
    };
  }

  // L9·normalize black swan·enum + pool filter + cross-type guard
  function _kjpL9NormalizeBlackSwan(p, entry) {
    if (!p || typeof p !== 'object') return null;
    var pool = ((entry && entry.supportNpcs) || []).concat((entry && entry.opposeNpcs) || []);
    var poolSet = {}; pool.forEach(function(n) { if (n) poolSet[n] = true; });
    var type = BLACK_SWAN_TYPES.indexOf(p.type) >= 0 ? p.type : 'examiner_corrupt';
    var severity = BLACK_SWAN_SEVERITY.indexOf(p.severity) >= 0 ? p.severity : 'low';
    var target = (p.target && poolSet[p.target]) ? p.target : '(unknown)';
    function clampDim(v) {
      var n = parseInt(v, 10);
      if (!Number.isFinite(n)) return 0;
      return Math.max(-15, Math.min(15, n));
    }
    var dd = p.dimDelta || {};
    var dimDelta = {
      corruption: clampDim(dd.corruption),
      civilianReact: clampDim(dd.civilianReact),
      factionTension: clampDim(dd.factionTension)
    };
    // npcImpact 仅 reformer_illness·post-validate name in pool
    var npcImpact = null;
    if (type === 'reformer_illness' && p.npcImpact && p.npcImpact.name && poolSet[p.npcImpact.name]) {
      var hd = parseInt(p.npcImpact.healthDelta, 10);
      npcImpact = {
        name: p.npcImpact.name,
        healthDelta: Number.isFinite(hd) ? Math.max(-30, Math.min(0, hd)) : -10,
        retire: !!p.npcImpact.retire
      };
    }
    // memorialTrigger 仅 examiner_corrupt + student_boycott
    var memorialTrigger = null;
    if ((type === 'examiner_corrupt' || type === 'student_boycott') && p.memorialTrigger) {
      memorialTrigger = {
        topic: String((p.memorialTrigger || {}).topic || '').slice(0, 30),
        ideologyHint: String((p.memorialTrigger || {}).ideologyHint || 'traditional').slice(0, 20)
      };
    }
    return {
      type: type, severity: severity, target: target,
      narrative: String(p.narrative || '').slice(0, 200),
      dimDelta: dimDelta, npcImpact: npcImpact, memorialTrigger: memorialTrigger
    };
  }

  // L9·a·LLM 命名 + 史评·5-12 字 canonicalName + 50 字 historicalEvaluation
  async function _kjpL9LlmNameReform(entry) {
    if (!entry || !entry.magnitudeDescriptor) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    var fallback = _kjpL9NameFallback(entry);
    if (!_hasAI()) return fallback;

    var paradigm = GM._kejuParadigm || {};
    var added = (entry.diff && entry.diff.subjects && entry.diff.subjects.added) || [];
    var addedLine = added.length ? added.map(function(s) {
      return (s.name || '') + (s.historicalAnalog ? '·' + s.historicalAnalog : '');
    }).join('·') : '(无新科)';

    // L11·B2·命名 prompt 加【性质】+ intent-specific hint·rollback 自动取"X 更化 / X 罢法"
    var natureLbl = entry.intent === 'rollback'    ? '废止 / 复旧'
                  : entry.intent === 'restoration' ? '复古'
                                                    : '改新';
    var prompt =
      '【改革】' + entry.magnitudeDescriptor + '·' + (entry.method || '') + '\n' +
      '【性质】' + natureLbl + '\n' +
      '【朝代】' + (paradigm.initEra || '') + '·年 ' + (entry.year || '') + '\n' +
      '【主导】' + (entry.by || '陛下') + '\n' +
      '【新加科】' + addedLine + '\n\n' +
      '请按真历史命名 paradigm 起改革之名 (5-12 字)·\n' +
      '- 改新风格·"熙宁变法" / "张居正考成法" / "戊戌新政" / "百日维新" / "庆历新政"\n' +
      '- 废止 / 复旧风格·"元祐更化" / "绍圣绍述" / "崇宁党禁" / "X 罢法"\n' +
      '- 复古风格·"X 复古" / "X 还古制"\n' +
      '- 若主导有名·头冠主导者姓 (如 "张居正X")·若年号·冠年号 (如 "熙宁X")·若核心方·冠"X 法"\n' +
      '- 史评·客观持中·50 字·非褒非贬·叙方向 + 后世评价倾向\n\n' +
      '返 JSON·{canonicalName: "5-12 字", historicalEvaluation: "50 字 史评"}';
    try {
      var raw = await callAISmart(prompt, 600, { maxRetries: 1, priority: 'low', timeoutMs: 20000 });
      var parsed = _parseJson(raw);
      if (!parsed || !parsed.canonicalName) return fallback;
      return _kjpL9NormalizeNaming(parsed);
    } catch (e) {
      try { console.warn('[L9·a] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  // L9·b·LLM 黑天鹅·4 type·真历史 grounded
  async function _kjpL9LlmBlackSwan(entry, year) {
    if (!entry || !year) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    var fallback = _kjpL9BlackSwanFallback(entry, year);
    if (!_hasAI()) return fallback;

    var paradigm = GM._kejuParadigm || {};
    var sup = (entry.supportNpcs || []).filter(_kjpAliveNpcName).slice(0, 3);
    var opp = (entry.opposeNpcs || []).filter(_kjpAliveNpcName).slice(0, 3);
    var pool = sup.concat(opp);
    var elapsed = year - (entry.year || year);
    var stage = (paradigm._reformInProgress && paradigm._reformInProgress.stage) || 'unknown';

    var typeMapLine = BLACK_SWAN_TYPES.map(function(t) {
      return t + ' (' + BLACK_SWAN_TYPE_LABEL[t] + ')';
    }).join(' / ');

    var prompt =
      '【改革】' + (entry.magnitudeDescriptor || '改革') + '·施行第 ' + elapsed +
        ' 年·阶段 ' + stage + '\n' +
      '【支持】' + (sup.join('、') || '无') + '\n' +
      '【反对】' + (opp.join('、') || '无') + '\n' +
      '【朝代】' + (paradigm.initEra || '') + '·年 ' + year + '\n\n' +
      '请按真历史 paradigm·推该年 1 个改革实施意外·\n' +
      '- type 4 选·' + typeMapLine + '\n' +
      '- severity·low / mid / high\n' +
      '- target·若 npc 类·必从·' + (pool.join('、') || '(无)') + '·选\n' +
      '- narrative·80 字古文叙事·非玄幻 (无彗星天命)·真政治事件\n' +
      '- dimDelta·按 type·corruption / civilianReact / factionTension·-15~15\n' +
      '- npcImpact·仅 reformer_illness type·{name, healthDelta:-30~-10, retire:bool}\n' +
      '- memorialTrigger·examiner_corrupt + student_boycott·{topic, ideologyHint}\n\n' +
      '返 JSON·{type, severity, target, narrative, dimDelta?, npcImpact?, memorialTrigger?}';
    try {
      var raw = await callAISmart(prompt, 900, { maxRetries: 1, priority: 'low', timeoutMs: 25000 });
      var parsed = _parseJson(raw);
      if (!parsed || !parsed.type) return fallback;
      return _kjpL9NormalizeBlackSwan(parsed, entry);
    } catch (e) {
      try { console.warn('[L9·b] LLM fail', e); } catch(_){}
      return fallback;
    }
  }

  // L9·dispatcher·L7 commit chain·async·non-block·写 entry.canonicalName + historicalEvaluation
  function _kjpL9MaybeNameReform(entry) {
    if (!entry) return;
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL9 === false) return;
    if (entry.canonicalName) return;   // 已命名·skip (idempotent)
    _kjpL9LlmNameReform(entry).then(function(named) {
      if (!named) return;
      entry.canonicalName = named.canonicalName;
      entry.historicalEvaluation = named.historicalEvaluation;
      try {
        if (Array.isArray(GM._chronicle)) {
          GM._chronicle.push({
            turn: GM.turn || 1, type: 'keju-reform-named',
            text: '改革命名·' + named.canonicalName + (named.historicalEvaluation ? '·' + named.historicalEvaluation.slice(0, 40) + '…' : ''),
            tags: ['科举', 'reform', 'named'], reformId: entry.id
          });
        }
      } catch(_){}
    }).catch(function(){});
  }

  // L9·dispatcher·EvolveTick 内 probe·概率 gate·async LLM·1/year/reform
  function _kjpL9MaybeSpawnBlackSwan(entry, year) {
    if (!entry || !year) return;
    if (typeof P === 'undefined' || !P || !P.conf || P.conf.useNewKejuL9 === false) return;
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    // 一 reform 一年 1 个·检 chronicle.specialEvent
    var chronicle = (GM._kejuParadigm._reformChronicle = GM._kejuParadigm._reformChronicle || {});
    var yearEntry = chronicle[entry.id] && chronicle[entry.id][year];
    if (yearEntry && yearEntry.specialEvent) return;

    // 概率·基础 5% + stage/radical/factionTension 累加·max 18%
    var prob = 0.05;
    var stage = (GM._kejuParadigm._reformInProgress && GM._kejuParadigm._reformInProgress.stage) || '';
    if (stage === 'ramping') prob += 0.03;
    var radical = (entry.magnitudeParsed && entry.magnitudeParsed.radical) || 0;
    if (radical > 70) prob += 0.05;
    var ft = parseInt(GM._factionTension, 10) || 0;
    if (ft > 50) prob += 0.05;
    prob = Math.min(0.18, prob);
    // 注·Math.random non-seedable·跨 save/load 不一致·跟其他 game state 同 paradigm
    if (Math.random() > prob) return;

    // RBB·BB-B3·capture paradigm ref·若 LLM resolve 时 paradigm 已 swap (reload / 切剧本)·skip apply
    var paradigmRef = GM._kejuParadigm;
    _kjpL9LlmBlackSwan(entry, year).then(function(event) {
      if (!event) return;
      // stale guard·若 reload·paradigm 已不是当时的 ref·skip
      if (typeof GM === 'undefined' || !GM || GM._kejuParadigm !== paradigmRef) return;
      _kjpL9ApplyBlackSwan(entry, year, event);
    }).catch(function(){});
  }

  // L9·apply·复用 L7 + L8 + L5 既有路径
  function _kjpL9ApplyBlackSwan(entry, year, event) {
    if (!entry || !event || typeof GM === 'undefined' || !GM) return;
    if (!GM._kejuParadigm) return;
    var chronicle = (GM._kejuParadigm._reformChronicle = GM._kejuParadigm._reformChronicle || {});
    if (!chronicle[entry.id]) chronicle[entry.id] = {};
    if (!chronicle[entry.id][year]) chronicle[entry.id][year] = {};
    var ce = chronicle[entry.id][year];
    // 写 specialEvent·跟 L8 evo 同 chronicle entry 不同字段·non-race
    ce.specialEvent = {
      type: event.type, severity: event.severity, target: event.target,
      narrative: event.narrative
    };
    // RBB·BB-C1·若该年 L8 evolve 还没 fire (text 缺)·inject stub text·避免 render 显得稀薄
    if (!ce.text) {
      ce.text = '(' + year + '年·改革施行·黑天鹅·' +
        (BLACK_SWAN_TYPE_LABEL[event.type] || event.type) +
        '·见下方 narrative)';
      ce._textFromL9 = true;   // 标记·L8 evolve 后到时覆盖
    }

    // 1·dimDelta·真路径·corruption.trueIndex / minxin.trueIndex / _factionTension number
    if (event.dimDelta) {
      try {
        var d = event.dimDelta;
        if (d.corruption && GM.corruption && typeof GM.corruption.trueIndex === 'number') {
          GM.corruption.trueIndex = Math.max(0, Math.min(100,
            GM.corruption.trueIndex + d.corruption));
        }
        if (d.civilianReact && GM.minxin && typeof GM.minxin.trueIndex === 'number') {
          GM.minxin.trueIndex = Math.max(0, Math.min(100,
            GM.minxin.trueIndex + d.civilianReact));
        }
        if (d.factionTension) {
          var ft2 = parseInt(GM._factionTension, 10) || 0;
          GM._factionTension = Math.max(-100, Math.min(100, ft2 + d.factionTension));
        }
      } catch(_){}
    }

    // 2.5·finance_diversion·真延 reform·set entry._extraDelay (severity 加成)·
    // RAA·B1·非名实不符·财政挪用真影响 timing
    // RBB·BB-A2·active phase·_applyDelay 已 0·无效·必须推 _reformInProgress.matureYear (active 真延)
    if (event.type === 'finance_diversion') {
      var delayBy = ({ low: 1, mid: 3, high: 5 })[event.severity] || 1;
      entry._extraDelay = (entry._extraDelay || 0) + delayBy;
      var ip = GM._kejuParadigm._reformInProgress;
      if (ip && ip.histId === entry.id) {
        // ramping phase·推 _applyDelay (L7 TickRampingReform 递减)
        if (ip.stage === 'ramping' && GM._kejuParadigm._applyDelay != null) {
          GM._kejuParadigm._applyDelay = (parseInt(GM._kejuParadigm._applyDelay, 10) || 0) + delayBy;
        }
        // active phase·推 matureYear·L7 active→matured check `curYear >= ip.matureYear`
        if (ip.stage === 'active' && typeof ip.matureYear === 'number') {
          ip.matureYear += delayBy;
        }
      }
    }

    // 2·npcImpact·reformer_illness·复用 L7 _retired pattern + NpcMemorySystem
    if (event.npcImpact && event.npcImpact.name) {
      try {
        var ch = (typeof findCharByName === 'function') ? findCharByName(event.npcImpact.name) : null;
        if (ch) {
          ch.health = Math.max(0, (parseInt(ch.health, 10) || 50) + event.npcImpact.healthDelta);
          if (event.npcImpact.retire || ch.health === 0) {
            ch._retired = true;
            ch._retiredReason = event.narrative;
          }
          if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
            NpcMemorySystem.remember(ch.name,
              '改革 ' + (entry.magnitudeDescriptor || '') + '·' + (event.narrative || '').slice(0, 60),
              '哀', Math.max(1, Math.abs(event.npcImpact.healthDelta) | 0),
              'L9-blackswan');
          }
        }
      } catch(_){}
    }

    // 3·memorialTrigger·examiner_corrupt + student_boycott·走 _kjSpawnReformMemorial bypass cooldown
    // RAA·C3·L9 自己 cap·一 turn 最多 2 个 L9-blackswan memorial·防 multi-reform flood
    // RBB·BB-B1·_l9SpawnTurn save/load 持久·load 后 turn 已变·必 reset (turn !== 时已 reset·OK·无 stale 风险)
    if (event.memorialTrigger) {
      try {
        var curTurn = GM.turn || 0;
        // 严格 reset·若 turn 跟存的不同 (含 save/load 后 turn 变)·count 清 0
        if (GM._kejuParadigm._l9SpawnTurn !== curTurn) {
          GM._kejuParadigm._l9SpawnTurn = curTurn;
          GM._kejuParadigm._l9SpawnCount = 0;
        }
        var L9_MAX_SPAWN_PER_TURN = 2;
        if (GM._kejuParadigm._l9SpawnCount < L9_MAX_SPAWN_PER_TURN &&
            typeof window !== 'undefined' && typeof window._kjSpawnReformMemorial === 'function') {
          var sp = window._kjSpawnReformMemorial(entry, {
            source: 'L9-blackswan',
            bypassCooldown: true,
            forcedTopic: event.memorialTrigger.topic,
            forcedIdeology: event.memorialTrigger.ideologyHint
          });
          if (sp) GM._kejuParadigm._l9SpawnCount = (GM._kejuParadigm._l9SpawnCount || 0) + 1;
        }
      } catch(_){}
    }

    // 4·push GM._chronicle 邸报可见
    try {
      if (Array.isArray(GM._chronicle)) {
        GM._chronicle.push({
          turn: GM.turn || 1, type: 'keju-reform-blackswan',
          text: year + '年·改革黑天鹅·' + (BLACK_SWAN_TYPE_LABEL[event.type] || event.type) +
                '·' + (event.narrative || '').slice(0, 40) + '…',
          tags: ['科举', 'reform', 'blackswan'],
          reformId: entry.id, severity: event.severity
        });
      }
    } catch(_){}
  }

  // ════════════════════════════════════════════════════════════════
  // §8·expose
  // ════════════════════════════════════════════════════════════════

  global._kjpL8EraToKey                 = _kjpL8EraToKey;
  global._kjpL8LlmEvolveYear            = _kjpL8LlmEvolveYear;
  global._kjpL8LlmInheritanceVerdict    = _kjpL8LlmInheritanceVerdict;
  global._kjpL8EvolveTick               = _kjpL8EvolveTick;
  global._kjpL8ApplyEvolutionDeltas     = _kjpL8ApplyEvolutionDeltas;
  global._kjpL8MaybeApplyInheritance    = _kjpL8MaybeApplyInheritance;
  global._kjpL8ApplyInheritanceMode     = _kjpL8ApplyInheritanceMode;
  global._kjpL8ArchiveMatured           = _kjpL8ArchiveMatured;
  global._kjpL8FindMatchingArchive      = _kjpL8FindMatchingArchive;
  global._kjpL8EvolveFallback           = _kjpL8EvolveFallback;
  global._kjpL8InheritanceFallback      = _kjpL8InheritanceFallback;
  global._kjpL8NormalizeEvolution       = _kjpL8NormalizeEvolution;
  global._kjpL8NormalizeInheritance     = _kjpL8NormalizeInheritance;
  global._kjpMigrateReformChronicleV1   = _kjpMigrateReformChronicleV1;
  global._initKejuL8Hook                = _initKejuL8Hook;

  // L9·LLM 命名 + 黑天鹅
  global._kjpL9LlmNameReform            = _kjpL9LlmNameReform;
  global._kjpL9LlmBlackSwan             = _kjpL9LlmBlackSwan;
  global._kjpL9MaybeNameReform          = _kjpL9MaybeNameReform;
  global._kjpL9MaybeSpawnBlackSwan      = _kjpL9MaybeSpawnBlackSwan;
  global._kjpL9ApplyBlackSwan           = _kjpL9ApplyBlackSwan;
  global._kjpL9NormalizeNaming          = _kjpL9NormalizeNaming;
  global._kjpL9NormalizeBlackSwan       = _kjpL9NormalizeBlackSwan;
  global._kjpL9NameFallback             = _kjpL9NameFallback;
  global._kjpL9BlackSwanFallback        = _kjpL9BlackSwanFallback;

  // namespace 友好暴露
  global.TM = global.TM || {};
  global.TM.Keju = global.TM.Keju || {};
  global.TM.Keju.L8 = {
    eraToKey: _kjpL8EraToKey,
    llmEvolveYear: _kjpL8LlmEvolveYear,
    llmInheritanceVerdict: _kjpL8LlmInheritanceVerdict,
    evolveTick: _kjpL8EvolveTick,
    applyEvolutionDeltas: _kjpL8ApplyEvolutionDeltas,
    maybeApplyInheritance: _kjpL8MaybeApplyInheritance,
    applyInheritanceMode: _kjpL8ApplyInheritanceMode,
    archiveMatured: _kjpL8ArchiveMatured,
    findMatchingArchive: _kjpL8FindMatchingArchive,
    migrateReformChronicleV1: _kjpMigrateReformChronicleV1,
    initHook: _initKejuL8Hook,
    ERA_ORDER: ERA_ORDER,
    INHERITANCE_LS_KEY: INHERITANCE_LS_KEY,
    INHERITANCE_LRU_MAX: INHERITANCE_LRU_MAX
  };

  global.TM.Keju.L9 = {
    llmNameReform: _kjpL9LlmNameReform,
    llmBlackSwan: _kjpL9LlmBlackSwan,
    maybeNameReform: _kjpL9MaybeNameReform,
    maybeSpawnBlackSwan: _kjpL9MaybeSpawnBlackSwan,
    applyBlackSwan: _kjpL9ApplyBlackSwan,
    normalizeNaming: _kjpL9NormalizeNaming,
    normalizeBlackSwan: _kjpL9NormalizeBlackSwan,
    nameFallback: _kjpL9NameFallback,
    blackSwanFallback: _kjpL9BlackSwanFallback,
    BLACK_SWAN_TYPES: BLACK_SWAN_TYPES,
    BLACK_SWAN_TYPE_LABEL: BLACK_SWAN_TYPE_LABEL,
    BLACK_SWAN_SEVERITY: BLACK_SWAN_SEVERITY
  };

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
