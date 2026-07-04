// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-reform-apply.js — Phase L·L7·改革 apply diff + 延迟生效 + 反弹 + L4·g1 backfill
 *
 * paradigm·复用·非自建
 *   - L1 留 3 字段·_reformInProgress / _applyDelay / _reformChronicle (全 ship)
 *   - L1 _kjpResetToPreset / _kjpValidateParadigm / _kjpLintAgainstStage1 (lint 本文件 fill)
 *   - L2 _kjpComputeDiff / _kjpSummarizeDiff / _kjpClassifyDiffTags / _kjpDiffMagnitude
 *   - L4 _kjpAccumReformLean / _kjpAuditForecastAccuracy stub (本文件 fill)
 *   - F2 paradigm·tm-keju-reform-memorial.js·L7 反弹走奏疏 source pool
 *   - F4 _kjSpawnYanguanQingyi (extreme path·非常态)
 *   - Stage 1·NpcMemorySystem.remember / findCharByName / _retired field
 *
 * Public API·
 *   _kjReformKeyiCallback(method, ctx)              — B3 entry·KEYI_TOPIC_TYPES.reform.callback
 *   _kjpL7DeriveOutcome(method, passed, intent, mag, pilot) — pure derive
 *   _kjpL7TickRampingReform()                       — endTurn 调
 *   _kjpL7TickReformLeanDecay(turn)                 — endTurn 调
 *
 * red line·flag gate / 失败禁玄幻 / 不重写 keyi 800 行 / 9 朝代 preset / 党争走 GM.parties
 */
(function() {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·gate
  // ════════════════════════════════════════════════════════════════

  function _isL7Enabled() {
    if (typeof P === 'undefined' || !P) return false;
    var conf = P.conf || {};
    if (conf.useNewKejuL === false) return false;
    return conf.useNewKejuL7 !== false;
  }

  // ════════════════════════════════════════════════════════════════
  // §1·B3 entry·_kjReformKeyiCallback(method, ctx)
  // ════════════════════════════════════════════════════════════════

  function _kjReformKeyiCallback(method, ctx) {
    if (!_isL7Enabled()) {
      try { console.log('[L7·a] flag off·skip apply'); } catch(_){}
      try { if (typeof toast === 'function') toast('⚠️ 科举改革落地模块未开启·议政结果未写入范式'); } catch(_){}
      return;
    }
    ctx = ctx || {};
    try {
      var topicData = ctx.topicData || {};
      var diff   = topicData.paradigmDiff;
      var intent = topicData.intent || 'reform';
      var mag    = topicData.magnitudeParsed || {};
      var pilot  = topicData.pilotScope || {};

      // 1·derive outcome·2 axis (method × passed × intent)
      var outcome = _kjpL7DeriveOutcome(method, !!ctx.passed, intent, mag, pilot);

      // 2·overlap detect (深扩 h)·boost resistance·或 user cancel
      // RBB·BB-B1·overlap rejected·user 取消的操作·全 zero impact (无 chars / chronicle / memorial)
      // L11·B1·rollback target===ip.histId 时·_kjpL7CheckOverlapAccept 内部 bypass·见 §3
      if (outcome.passed) {
        var overlapOk = _kjpL7CheckOverlapAccept(outcome, ctx);
        if (!overlapOk) {
          // overlap cancel·early return·非"改革失败"·只是 user 取消·不 punish chars
          try {
            if (Array.isArray(GM._chronicle)) {
              if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
                turn: GM.turn || 1,
                type: 'keju-reform-cancel-overlap',
                text: '改革议·' + (ctx.topicData.topic || '').slice(0, 40) + '·user 取消叠加 (前改未稳)',
                tags: ['科举', 'paradigm', 'cancel']
              });
            }
          } catch(_){}
          return;
        }
      }

      // 3·apply diff (内含 lint + post-validate)
      var applyResult = outcome.passed
        ? _kjpL7ApplyDiffToParadigm(diff, intent, outcome, ctx)
        : { applied: false, reason: 'not_passed', lintWarnings: [] };
      // lint fatal·blocked apply
      if (outcome.passed && !applyResult.applied && applyResult.reason === 'lint_failed') {
        outcome.passed = false;
        outcome.kind = 'rejected_lint';
      }

      // 4·history append (复用 L1 paradigm.history schema)
      var histEntry = _kjpL7AppendHistory(diff, intent, mag, pilot, method, outcome, ctx, applyResult);

      // 4.5·L10 preset shortcircuit OR L9 LLM 命名 (strict gate·outcome.passed + applied)
      // L10·若 topicData 含 l10PresetId·直 set canonicalName·skip L9 LLM (0 LLM cost)
      // L9·non-preset·走 LLM 命名 (现 path·async non-block)
      if (outcome && outcome.passed === true && applyResult && applyResult.applied) {
        var l10topicData = (ctx && ctx.topicData) || {};
        if (l10topicData.l10PresetId && l10topicData.l10PresetCanonicalName) {
          histEntry.canonicalName = l10topicData.l10PresetCanonicalName;
          histEntry.historicalEvaluation = l10topicData.l10PresetHistoricalEvaluation || '';
          histEntry._l10PresetId = l10topicData.l10PresetId;
          if (l10topicData.l10PresetBy) histEntry.by = l10topicData.l10PresetBy;
        } else if (typeof window !== 'undefined' && typeof window._kjpL9MaybeNameReform === 'function') {
          try { window._kjpL9MaybeNameReform(histEntry); } catch(_){}
        }
      }

      // 5·start ramping (写 L1 _reformInProgress + _applyDelay)
      if (outcome.passed && applyResult.applied) {
        _kjpL7StartRamping(histEntry, outcome);
      }

      // 6·chars impact·复用 _kjpAccumReformLean + NpcMemorySystem + _retired field
      // L11·rollback 分支·调 _kjpL11ApplyRollbackCharsImpact mirror (原 support→反对·原 oppose→支持)
      //         + _kjpL11FlipTargetReform 标 target 'rolled_back' + clear ip
      if (intent === 'rollback' && topicData.rollbackTargetId &&
          typeof window !== 'undefined' &&
          typeof window._kjpL11ApplyRollbackCharsImpact === 'function') {
        var targetEntry = null;
        var histList = (GM._kejuParadigm && GM._kejuParadigm.history) || [];
        for (var ti = 0; ti < histList.length; ti++) {
          if (histList[ti] && histList[ti].id === topicData.rollbackTargetId) {
            targetEntry = histList[ti]; break;
          }
        }
        if (targetEntry && outcome.passed && applyResult.applied) {
          try { window._kjpL11ApplyRollbackCharsImpact(targetEntry, outcome, histEntry); } catch(_){}
          try { window._kjpL11FlipTargetReform(targetEntry, histEntry.id); } catch(_){}
          // 双向 link·newEntry.rollbackTargetId 已在 entry 字段 (C3)
          if (histEntry) histEntry.rollbackTargetId = targetEntry.id;
        } else {
          _kjpL7ApplyCharsImpact(ctx, outcome, histEntry);
        }
      } else {
        _kjpL7ApplyCharsImpact(ctx, outcome, histEntry);
      }

      // 7·反弹 dispatch·Layer 1 memorial + Layer 2 F4 极端
      if (outcome.passed && applyResult.applied) {
        _kjpL7MaybeTriggerReformReaction(histEntry, ctx);
      }

      // 8·chronicle 邸报 cosmetic
      _kjpL7WriteChronicleSummary(histEntry, ctx);
    } catch(e) {
      try { console.warn('[L7·a] _kjReformKeyiCallback fail', e); } catch(_){}
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §2·outcome derive·method × passed × intent (L7·b)
  // ════════════════════════════════════════════════════════════════

  function _kjpL7DeriveOutcome(method, passed, intent, mag, pilot) {
    var basePassed = passed || method === 'edict' || method === 'defy';
    var resistanceMultiplier = ({ council:1, edict:1.5, defy:2 })[method] || 1;
    var radical = parseInt(mag && mag.radical, 10) || 0;
    var pilotShrink = (pilot && pilot.kind && pilot.kind !== 'national') ? 0.7 : 1.0;

    // ramp-up·radical/15 × resistance·1-10 年·写 L1 _applyDelay
    var rampUpYears = basePassed
      ? Math.max(1, Math.min(10, Math.round((radical / 15) * resistanceMultiplier)))
      : 0;

    return {
      kind: !basePassed ? 'rejected_court'
          : intent === 'restoration' ? 'restoration_passed'
          : 'reform_passed',
      passed: basePassed,
      method: method,
      intent: intent,
      resistanceMultiplier: resistanceMultiplier,
      pilotShrink: pilotShrink,
      rampUpYears: rampUpYears,

      // 3 layer prestige delta·写 GM.prestige·非 P.playerInfo.prestige
      prestigeDelta: {
        immediate: _kjpL7CalcImmediatePrestige(method, basePassed, intent),
        onMatured: _kjpL7CalcMaturedPrestige(method, basePassed, radical),
        historical: null   // L8 LLM 演化推后填
      },

      factionTensionDelta: _kjpL7CalcFactionTension(method, mag, intent),

      forecastsSettled: false
    };
  }

  function _kjpL7CalcImmediatePrestige(method, passed, intent) {
    if (!passed)                  return -3;
    if (method === 'defy')        return -3;
    if (method === 'edict')       return +2;
    if (intent === 'restoration') return +5;
    return +3;
  }
  function _kjpL7CalcMaturedPrestige(method, passed, radical) {
    if (!passed) return 0;
    var base = Math.round(radical / 5);
    if (method === 'defy')  return base + 10;
    if (method === 'edict') return base + 5;
    return base;
  }
  function _kjpL7CalcFactionTension(method, mag, intent) {
    var base = (mag && typeof mag.radical === 'number') ? Math.round(mag.radical / 10) : 0;
    if (method === 'edict')         base += 5;
    if (method === 'defy')          base += 15;
    if (intent === 'restoration')   base -= 3;
    return base;
  }

  // ════════════════════════════════════════════════════════════════
  // §3·overlap detect (L7·h·深扩)·复用 L1 _reformInProgress
  // ════════════════════════════════════════════════════════════════

  function _kjpL7CheckOverlapAccept(outcome, ctx) {
    var paradigm = (typeof GM !== 'undefined' && GM) ? GM._kejuParadigm : null;
    var ip = paradigm && paradigm._reformInProgress;
    if (!ip) return true;
    // L11·B1·rollback 之 target === ip.histId 时·bypass overlap·rollback 本质是答案
    // 注·_beingRolledBack 标实际短命·step 5 _kjpL7StartRamping 会 overwrite 整个 ip 为 newEntry·
    //   target 不再 in ip·tick filter 自动 skip rolled_back status·所以 tick safe·
    //   保留此标·为 sync-callback 中间步骤防御 (RAA·C4/C5 verified·doc 已收回过度宣传)
    if (outcome && outcome.intent === 'rollback' &&
        ctx && ctx.topicData && ctx.topicData.rollbackTargetId === ip.histId) {
      ip._beingRolledBack = true;
      return true;
    }
    // RAA·A1+C5·snapshot before boost·reject 时 restore (boost 不残留)
    var snapshotResistance = outcome.resistanceMultiplier;
    var snapshotRampUp = outcome.rampUpYears;
    // 有重叠·confirm·C5·confirm 失败 (异常 / 无 confirm) fallback reject + restore
    var userOk = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      var msg = '前次改革仍在生效（剩 ' + (paradigm._applyDelay || 0) + ' 年至稳定）·新改革叠加·阻力 ×1.5·确定?';
      try { userOk = !!window.confirm(msg); }
      catch(_) { userOk = false; }   // C5·confirm throw → reject + restore
    }
    if (!userOk) {
      outcome.resistanceMultiplier = snapshotResistance;   // A1·restore·非残留
      outcome.rampUpYears = snapshotRampUp;
      return false;
    }
    outcome.resistanceMultiplier *= 1.5;
    outcome.rampUpYears = Math.max(1, Math.min(10, Math.round(outcome.rampUpYears * 1.3)));
    return true;
  }

  // ════════════════════════════════════════════════════════════════
  // §4·apply diff to paradigm (L7·c)
  // ════════════════════════════════════════════════════════════════

  function _kjpL7ApplyDiffToParadigm(diff, intent, outcome, ctx) {
    if (!GM._kejuParadigm) return { applied: false, reason: 'no_paradigm', lintWarnings: [] };
    var paradigm = GM._kejuParadigm;

    // 0·lint·_kjpLintAgainstStage1 (L1 stub·本 sprint 替换为真 body·见 §4.3)
    var lintResult = (typeof _kjpLintAgainstStage1 === 'function')
      ? _kjpLintAgainstStage1(paradigm, diff)
      : { ok: true, warnings: [] };

    if (!lintResult.ok) {
      try {
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1,
            type: 'keju-reform-lint-fail',
            text: '改革议过·但 lint 不通·' + (lintResult.warnings || []).map(function(w) { return w.msg; }).join('·').slice(0, 200),
            tags: ['科举', 'paradigm', 'lint-fail']
          });
        }
      } catch(_){}
      return { applied: false, reason: 'lint_failed', lintWarnings: lintResult.warnings || [] };
    }

    // 1·restoration·复用 L1 _kjpResetToPreset
    if (intent === 'restoration') {
      var targetEra = (ctx && ctx.topicData && ctx.topicData.restorationDynasty) || paradigm.initEra || 'tang';
      try {
        if (typeof _kjpResetToPreset === 'function') {
          _kjpResetToPreset(targetEra);
          paradigm = GM._kejuParadigm;   // re-grab post reset
          // RAA·A3+B3·restoration 后·若 _reformInProgress 指 stale histId·clear·避免后续 tick 串
          var ip = paradigm._reformInProgress;
          if (ip && ip.histId) {
            var stillExists = (paradigm.history || []).some(function(h) { return h.id === ip.histId; });
            if (!stillExists) {
              paradigm._reformInProgress = null;
              paradigm._applyDelay = 0;
            }
          }
        }
      } catch(e) { try { console.warn('[L7·c] _kjpResetToPreset fail', e); } catch(_){} }
    }

    // 2·apply diff·22+ flat field shallow merge
    _kjpL7MergeDiff(paradigm, diff);

    // 3·post-apply sanity check·复用 L1 _kjpValidateParadigm
    try {
      if (typeof _kjpValidateParadigm === 'function') {
        var v = _kjpValidateParadigm(paradigm);
        if (v && v.ok === false) {
          try { console.warn('[L7·c] post-apply validate warn', v); } catch(_){}
        }
      }
    } catch(_){}

    return { applied: true, reason: 'ok', lintWarnings: lintResult.warnings || [] };
  }

  // §4.2·merge diff·按 _kjpComputeDiff 真 shape (22+ flat fields)
  function _kjpL7MergeDiff(paradigm, diff) {
    if (!paradigm || !diff) return;

    // subjects·{added[], removed[], weightChanged[]}
    if (diff.subjects) {
      if (!Array.isArray(paradigm.subjects)) paradigm.subjects = [];
      (diff.subjects.added || []).forEach(function(s) {
        if (!s || !s.id) return;
        var exists = paradigm.subjects.some(function(x) { return x.id === s.id; });
        if (!exists) {
          // RBB·BB-A1·preserve L6 rich metadata (ideology/format/historicalAnalog/rationale/introducedBy/customFields)
          // RBB·BB-A3·introducedYear 用 L7 apply-time GM.year·覆 L6·click-time draft year
          paradigm.subjects.push({
            id: s.id,
            name: s.name || s.id,
            weight: parseInt(s.weight, 10) || 0,
            ideology: s.ideology || 'reformist',
            format: s.format || '',
            historicalAnalog: s.historicalAnalog || '',
            rationale: s.rationale || '',
            maxScore: s.maxScore || 100,
            introducedYear: (GM && GM.year) || s.introducedYear || 0,
            introducedBy: s.introducedBy || ((typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '陛下'),
            customFields: (s.customFields && typeof s.customFields === 'object') ? s.customFields : {}
          });
        }
      });
      (diff.subjects.removed || []).forEach(function(s) {
        if (!s || !s.id) return;
        var idx = -1;
        for (var i = 0; i < paradigm.subjects.length; i++) {
          if (paradigm.subjects[i].id === s.id) { idx = i; break; }
        }
        if (idx >= 0) paradigm.subjects.splice(idx, 1);
      });
      (diff.subjects.weightChanged || []).forEach(function(s) {
        if (!s || !s.id) return;
        var subj = null;
        for (var j = 0; j < paradigm.subjects.length; j++) {
          if (paradigm.subjects[j].id === s.id) { subj = paradigm.subjects[j]; break; }
        }
        if (subj && typeof s.newW === 'number') subj.weight = s.newW;
      });
    }

    // examInterval / retakePolicy·{old, new}
    if (diff.examInterval && diff.examInterval.new != null) paradigm.examInterval = diff.examInterval.new;
    if (diff.retakePolicy && diff.retakePolicy.new) paradigm.retakePolicy = diff.retakePolicy.new;

    // tiers·{changed, oldCount, ...}·L3 panel readonly·_kjpLintAgainstStage1 已 warn·此处 noop·留 L20 国子监做
    // (intentional·非 forget)

    // examinerRules·flat keys + nested type[] + avoidanceRules{}
    if (diff.examinerRules) {
      if (!paradigm.examinerRules || typeof paradigm.examinerRules !== 'object') paradigm.examinerRules = {};
      Object.keys(diff.examinerRules).forEach(function(k) {
        if (k === 'type' && Array.isArray(diff.examinerRules.type)) {
          paradigm.examinerRules.type = diff.examinerRules.type.slice();
        } else if (k === 'avoidanceRules' && diff.examinerRules.avoidanceRules) {
          if (!paradigm.examinerRules.avoidanceRules) paradigm.examinerRules.avoidanceRules = {};
          Object.keys(diff.examinerRules.avoidanceRules).forEach(function(ak) {
            paradigm.examinerRules.avoidanceRules[ak] = diff.examinerRules.avoidanceRules[ak];
          });
        } else {
          paradigm.examinerRules[k] = diff.examinerRules[k];
        }
      });
    }

    // candidateRules·flat keys + nested excludedClasses{added, removed}
    if (diff.candidateRules) {
      if (!paradigm.candidateRules || typeof paradigm.candidateRules !== 'object') paradigm.candidateRules = {};
      Object.keys(diff.candidateRules).forEach(function(k) {
        if (k === 'excludedClasses' && diff.candidateRules.excludedClasses) {
          var cur = (paradigm.candidateRules.excludedClasses || []).slice();
          (diff.candidateRules.excludedClasses.added || []).forEach(function(c) {
            if (cur.indexOf(c) < 0) cur.push(c);
          });
          (diff.candidateRules.excludedClasses.removed || []).forEach(function(c) {
            var i = cur.indexOf(c); if (i >= 0) cur.splice(i, 1);
          });
          paradigm.candidateRules.excludedClasses = cur;
        } else {
          paradigm.candidateRules[k] = diff.candidateRules[k];
        }
      });
    }

    // quota·{total:{old,new}, ratios:{geo, class, ...}}
    if (diff.quota) {
      if (!paradigm.quota || typeof paradigm.quota !== 'object') paradigm.quota = { ratios: {} };
      if (diff.quota.total && diff.quota.total.new != null) paradigm.quota.total = diff.quota.total.new;
      if (diff.quota.ratios) {
        paradigm.quota.ratios = paradigm.quota.ratios || {};
        Object.keys(diff.quota.ratios).forEach(function(dim) {
          paradigm.quota.ratios[dim] = diff.quota.ratios[dim];
        });
      }
    }

    // rankingRule·{old, new}
    if (diff.rankingRule && diff.rankingRule.new) paradigm.rankingRule = diff.rankingRule.new;

    // allocationRules·firstClass / secondClass / thirdClass / waitingYears / imperialReviewRequired / posthumousAdjustment
    if (diff.allocationRules) {
      if (!paradigm.allocationRules || typeof paradigm.allocationRules !== 'object') paradigm.allocationRules = {};
      Object.keys(diff.allocationRules).forEach(function(k) {
        if (k === 'waitingYears' && diff.allocationRules.waitingYears && diff.allocationRules.waitingYears.new != null) {
          paradigm.allocationRules.waitingYears = diff.allocationRules.waitingYears.new;
        } else {
          paradigm.allocationRules[k] = diff.allocationRules[k];
        }
      });
    }

    // 9 top-level flat (subset use .new shape·subset bool 直 assign)
    ['ideology','graduateTitle','cohortBondStrength','schoolIntegration','shadow','language'].forEach(function(k) {
      if (diff[k] && typeof diff[k] === 'object' && diff[k].new !== undefined) paradigm[k] = diff[k].new;
    });
    if (typeof diff.mentorLineage === 'boolean') paradigm.mentorLineage = diff.mentorLineage;
    if (typeof diff.clanPrivilege === 'boolean') paradigm.clanPrivilege = diff.clanPrivilege;

    // taxPrivilege·flat·jinshi/juren/xiucai
    if (diff.taxPrivilege) {
      if (!paradigm.taxPrivilege || typeof paradigm.taxPrivilege !== 'object') paradigm.taxPrivilege = {};
      Object.keys(diff.taxPrivilege).forEach(function(k) {
        paradigm.taxPrivilege[k] = diff.taxPrivilege[k];
      });
    }

    // ceremony·flat·palaceTest/rosterRelease/...
    if (diff.ceremony) {
      if (!paradigm.ceremony || typeof paradigm.ceremony !== 'object') paradigm.ceremony = {};
      Object.keys(diff.ceremony).forEach(function(k) {
        paradigm.ceremony[k] = diff.ceremony[k];
      });
    }

    // penalties·flat·cheating/leak/taboo/bribery
    if (diff.penalties) {
      if (!paradigm.penalties || typeof paradigm.penalties !== 'object') paradigm.penalties = {};
      Object.keys(diff.penalties).forEach(function(k) {
        paradigm.penalties[k] = diff.penalties[k];
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §5·history + state (L7·d)·用 L1 _reformInProgress / _applyDelay / history
  // ════════════════════════════════════════════════════════════════

  function _kjpL7AppendHistory(diff, intent, mag, pilot, method, outcome, ctx, applyResult) {
    if (!GM._kejuParadigm) return null;
    if (!Array.isArray(GM._kejuParadigm.history)) GM._kejuParadigm.history = [];
    var hist = GM._kejuParadigm.history;

    var paradigmDigest = (typeof _kjpSummarizeDiff === 'function')
      ? String(_kjpSummarizeDiff(diff) || '').slice(0, 100)
      : '';
    var tags = (typeof _kjpClassifyDiffTags === 'function') ? _kjpClassifyDiffTags(diff) : ['reform'];

    var entry = {
      // L1 schema 必填·{year, by, field, oldValue, newValue, reason}
      year: GM.year || 0,
      by: (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '陛下',
      field: tags.join('·'),
      oldValue: '...',                         // 摘要·非全 paradigm copy
      newValue: paradigmDigest,
      reason: (ctx && ctx.topicData && ctx.topicData.topic) || (intent === 'restoration' ? '复古' : '改革'),

      // L7 扩 (不破 L1)
      id: 'reform_' + (GM.year || 0) + '_' + hist.length,
      turn: GM.turn || 1,
      intent: intent,
      method: method,
      magnitudeDescriptor: (ctx && ctx.topicData && ctx.topicData.magnitudeDescriptor) || '',
      magnitudeParsed: mag || {},
      pilotScope: pilot || {},
      paradigmDigest: paradigmDigest,
      tags: tags,
      diff: diff || null,
      supportNpcs: _kjpL7ListFromBreakdown(ctx && ctx.breakdown, 'support'),
      opposeNpcs: _kjpL7ListFromBreakdown(ctx && ctx.breakdown, 'oppose'),
      cedui: _kjpL7ListCeduiAdvisorsForDigest(paradigmDigest),
      outcome: outcome,
      status: outcome.passed && (applyResult && applyResult.applied) ? 'ramping' : 'rejected',
      rampUpStartYear: outcome.passed ? (GM.year || 0) : null,
      matureYear: outcome.passed ? (GM.year || 0) + outcome.rampUpYears + 30 : null,
      applied: !!(applyResult && applyResult.applied),
      lintWarnings: (applyResult && applyResult.lintWarnings) || [],
      prev: _kjpL7FindPrevReformId(),
      next: null,
      memorialId: null,
      yanguanReactionId: null,
      forecastsSettled: false
    };
    hist.push(entry);

    // 反向 link prev.next
    if (entry.prev) {
      var prev = null;
      for (var i = 0; i < hist.length - 1; i++) {
        if (hist[i].id === entry.prev) { prev = hist[i]; break; }
      }
      if (prev) prev.next = entry.id;
    }
    return entry;
  }

  function _kjpL7ListFromBreakdown(breakdown, stanceKind) {
    if (!breakdown || typeof breakdown !== 'object') return [];
    var out = [];
    Object.keys(breakdown).forEach(function(name) {
      var s = breakdown[name];
      if (!s) return;
      var stance = s.stance || '';
      if (stanceKind === 'support' && stance === 'support') out.push(name);
      else if (stanceKind === 'oppose' && stance === 'oppose') out.push(name);
    });
    return out;
  }

  function _kjpL7ListCeduiAdvisorsForDigest(paradigmDigest) {
    if (!paradigmDigest) return [];
    var key = paradigmDigest.slice(0, 40);
    var entries = [];
    try {
      if (typeof window !== 'undefined' && window.ChronicleTracker && window.ChronicleTracker.listVisible) {
        entries = window.ChronicleTracker.listVisible();
      }
    } catch(_){}
    var advisors = [];
    entries.forEach(function(e) {
      if (e.sourceType !== 'kjp-cedui') return;
      if ((e.sourceId || '').indexOf(key) < 0) return;
      if (e.actor && advisors.indexOf(e.actor) < 0) advisors.push(e.actor);
    });
    return advisors;
  }

  function _kjpL7FindPrevReformId() {
    if (!GM._kejuParadigm || !Array.isArray(GM._kejuParadigm.history)) return null;
    var hist = GM._kejuParadigm.history;
    for (var i = hist.length - 1; i >= 0; i--) {
      var s = hist[i].status;
      if (s === 'ramping' || s === 'active' || s === 'matured') return hist[i].id;
    }
    return null;
  }

  function _kjpL7StartRamping(histEntry, outcome) {
    if (!GM._kejuParadigm || !histEntry) return;
    GM._kejuParadigm._reformInProgress = {
      stage: 'ramping',
      startYear: GM.year || 0,
      startTurn: GM.turn || 1,
      rampUpYears: outcome.rampUpYears,
      matureYear: (GM.year || 0) + outcome.rampUpYears + 30,
      histId: histEntry.id,
      method: outcome.method,
      intent: outcome.intent,
      forecastsSettled: false
    };
    GM._kejuParadigm._applyDelay = outcome.rampUpYears;
  }

  // ════════════════════════════════════════════════════════════════
  // §6·endTurn tick·ramping state machine
  // ════════════════════════════════════════════════════════════════

  function _kjpL7TickRampingReform() {
    if (!_isL7Enabled()) return;
    if (typeof GM === 'undefined' || !GM || !GM._kejuParadigm) return;
    // RAA·B1·idempotent guard·防 endTurn pipeline 两路 (deferred phase5 + render-finalize) 双跑
    var curTurn = (GM.turn || 0);
    if (GM._kejuParadigm._lastL7TickTurn === curTurn) return;
    GM._kejuParadigm._lastL7TickTurn = curTurn;

    var ip = GM._kejuParadigm._reformInProgress;
    if (!ip) return;
    // L11·B1·若 target 正被 rollback (但 rollback 还没正式 flip)·skip tick·防 target 异常 mature
    if (ip._beingRolledBack) return;

    // 推 _applyDelay
    if (GM._kejuParadigm._applyDelay > 0) GM._kejuParadigm._applyDelay--;

    var hist = GM._kejuParadigm.history || [];
    var entry = null;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].id === ip.histId) { entry = hist[i]; break; }
    }
    if (!entry) { GM._kejuParadigm._reformInProgress = null; return; }

    var curYear = GM.year || 0;

    // ramping → active·RAA·B2·status guard·防双写 (若 ip.stage 已 active·entry.status 也 active·skip)
    if (ip.stage === 'ramping' && entry.status === 'ramping' && curYear >= ip.startYear + ip.rampUpYears) {
      ip.stage = 'active';
      entry.status = 'active';
      try {
        if (Array.isArray(GM._chronicle)) {
          // RBB·BB-D3·chronicle text 中文化·非英文 ID·"X 年改科举"
          var startYearLbl = entry.year ? (entry.year + '年') : '';
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1, type: 'keju-reform-active',
            text: startYearLbl + '改科举·' + (entry.magnitudeDescriptor || '') + '·已稳定施行',
            tags: ['科举', 'reform', 'active'],
            reformId: entry.id   // 内部 ref 留·non-text
          });
        }
      } catch(_){}
    }

    // active → matured·RAA·B2·status guard·防双写
    if (ip.stage === 'active' && entry.status === 'active' && curYear >= ip.matureYear) {
      ip.stage = 'matured';
      entry.status = 'matured';
      // 1·onMatured prestige delta·B4·防重写·若 _maturedPrestigeApplied 标·skip
      if (!entry._maturedPrestigeApplied) {
        var bonus = (entry.outcome && entry.outcome.prestigeDelta && entry.outcome.prestigeDelta.onMatured) || 0;
        if (typeof GM.prestige === 'number') GM.prestige += bonus;
        else GM.prestige = bonus;
        entry._maturedPrestigeApplied = true;
        entry._maturedBonus = bonus;
      }
      // 2·trigger L4·g1 backfill (forecast 准度真填)·已有 forecastsSettled guard
      try { _kjpL7BackfillForecastsForReform(entry); } catch(_){}
      // 3·_reformChronicle stub (L8 LLM 真填)
      try { _kjpL7AppendReformChronicleStub(entry); } catch(_){}
      // 4·done·clear _reformInProgress + C3·clear _applyDelay (残留阻力 → 0)
      GM._kejuParadigm._reformInProgress = null;
      GM._kejuParadigm._applyDelay = 0;
      // 5·RBB·BB-C2·matured 后 prune entry.diff·保 digest/tags/outcome·防 save size 涨
      // diff 保留 30 天内访问·之后清·留 _dimVar 用于 L11 rollback / L18 visualization 时按需 reconstruct
      // L11·B3·snapshot reverse 数据入 entry·prune 后 _kjpL11BuildReverseDiff 才有据
      // RAA·B1·加 weightChangedOld·防 weightChanged 丢失
      try {
        if (entry.diff && !entry._reverseSnapshot) {
          entry._reverseSnapshot = {
            addedSubjectIds: ((entry.diff.subjects && entry.diff.subjects.added) || [])
              .map(function(s){ return s && s.id; }).filter(Boolean),
            addedSubjectNames: ((entry.diff.subjects && entry.diff.subjects.added) || [])
              .map(function(s){ return s && (s.name || s.id); }).filter(Boolean),
            removedSubjectSnapshots: ((entry.diff.subjects && entry.diff.subjects.removed) || [])
              .map(function(s){ return Object.assign({}, s || {}); }),
            weightChangedOld: ((entry.diff.subjects && entry.diff.subjects.weightChanged) || [])
              .map(function(w){ return Object.assign({}, w || {}); }),
            ideologyOld: (entry.diff.ideology && entry.diff.ideology.old) || null,
            examIntervalOld: (entry.diff.examInterval && entry.diff.examInterval.old != null)
              ? entry.diff.examInterval.old : null,
            retakePolicyOld: (entry.diff.retakePolicy && entry.diff.retakePolicy.old) || null
          };
        }
      } catch(_){}
      entry._diffPruned = true;
      entry.diff = null;
      try {
        if (Array.isArray(GM._chronicle)) {
          // RBB·BB-D3·中文化
          var matureLbl = entry.year ? (entry.year + '年') : '';
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1, type: 'keju-reform-matured',
            text: matureLbl + '改科举·' + (entry.magnitudeDescriptor || '') + '·施行 30 年·朝野稳·名望 +' + (entry._maturedBonus || 0),
            tags: ['科举', 'reform', 'matured'],
            reformId: entry.id
          });
        }
      } catch(_){}
    }
  }

  function _kjpL7AppendReformChronicleStub(entry) {
    if (!GM._kejuParadigm) return;
    if (!GM._kejuParadigm._reformChronicle || typeof GM._kejuParadigm._reformChronicle !== 'object') {
      GM._kejuParadigm._reformChronicle = {};
    }
    var year = GM.year || 0;
    // L8·schema v1·[histId][year]·改 stub 写入新 schema·L8 evolve 读 same path 覆盖
    if (!entry || !entry.id) return;
    var chronicle = GM._kejuParadigm._reformChronicle;
    if (!chronicle[entry.id]) chronicle[entry.id] = {};
    // L11·RBB·I2·intent='rollback'·"施行" 改 "罢行"·更准
    var stubVerb = (entry.intent === 'rollback') ? '罢行已' : '施行已';
    chronicle[entry.id][year] = {
      histId: entry.id,
      text: (entry.magnitudeDescriptor || '改革') + '·' + stubVerb + ' 30 年·朝野稳·待后世评',
      by: entry.by,
      _stub: true   // L8 evolve tick 检 _stub·覆盖为真 LLM 文
    };
    // L8·persistence·archive matured reform 入 localStorage·跨剧本承袭用
    try {
      if (typeof window !== 'undefined' && typeof window._kjpL8ArchiveMatured === 'function') {
        window._kjpL8ArchiveMatured(entry);
      } else if (typeof _kjpL8ArchiveMatured === 'function') {
        _kjpL8ArchiveMatured(entry);
      }
    } catch (e) { try { console.warn('[L7→L8·archive]', e); } catch(_){} }
  }

  // ════════════════════════════════════════════════════════════════
  // §7·chars impact·复用 _kjpAccumReformLean + NpcMemorySystem + _retired
  // ════════════════════════════════════════════════════════════════

  function _kjpL7ApplyCharsImpact(ctx, outcome, histEntry) {
    if (!histEntry) return;
    var deltas = _kjpL7DeriveCharsDeltas(outcome);
    var turn = GM.turn || 0;

    (histEntry.supportNpcs || []).forEach(function(name) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (!ch) return;
      ch.loyalty = Math.max(0, Math.min(100, (parseInt(ch.loyalty, 10) || 50) + deltas.supLoyalty));
      if (typeof _kjpAccumReformLean === 'function') {
        try { _kjpAccumReformLean(ch, deltas.supLean, turn); } catch(_){}
      }
      _kjpL7RememberNpc(name,
        '陛下采纳·' + _kjpL7MethodLabel(histEntry.method) + '·' + (histEntry.magnitudeDescriptor || ''),
        deltas.supLoyalty > 0 ? '喜' : '敬',
        Math.abs(deltas.supLoyalty));
    });

    (histEntry.opposeNpcs || []).forEach(function(name) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (!ch) return;
      ch.loyalty = Math.max(0, Math.min(100, (parseInt(ch.loyalty, 10) || 50) + deltas.oppLoyalty));
      if (typeof _kjpAccumReformLean === 'function') {
        try { _kjpAccumReformLean(ch, deltas.oppLean, turn); } catch(_){}
      }
      _kjpL7RememberNpc(name,
        '陛下不顾老臣议·' + (histEntry.magnitudeDescriptor || ''),
        '怨',
        Math.abs(deltas.oppLoyalty));

      // 致仕·复用 _retired·非自建
      if (outcome.passed && outcome.resistanceMultiplier >= 1.5 && parseInt(ch.loyalty, 10) < 20) {
        if (Math.random() < 0.1) {
          ch._retired = true;
          ch._retireReason = '不忍见祖制更易';
          ch._retiredTurn = turn;
          try {
            if (Array.isArray(GM._chronicle)) {
              // RBB·BB-D3·中文化·非英文 reformId·留内部 ref
              if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
                turn: turn, type: 'reform-retirement',
                text: ch.name + '·' + (ch.officialTitle || ch.title || '') + '·致仕·疏曰"老臣不忍见祖制更易"',
                tags: ['科举', 'reform', 'retirement'],
                reformId: histEntry.id
              });
            }
          } catch(_){}
        }
      }
    });

    // GM.prestige·immediate layer (matured 时 §6 加 onMatured)
    if (typeof GM.prestige === 'number') GM.prestige += (outcome.prestigeDelta.immediate || 0);
    else GM.prestige = (outcome.prestigeDelta.immediate || 0);
    // GM._factionTension
    GM._factionTension = (GM._factionTension || 0) + (outcome.factionTensionDelta || 0);
  }

  function _kjpL7DeriveCharsDeltas(outcome) {
    // RAA·B6·显式 5 分支·council/edict/defy/restoration/default·避免落入未知 method 走 default
    if (!outcome.passed)                  return { supLoyalty:-2, supLean:+5,  oppLoyalty:+3,  oppLean:-5  };
    if (outcome.intent === 'restoration') return { supLoyalty:+20, supLean:-20, oppLoyalty:-25, oppLean:+20 };
    if (outcome.method === 'edict')       return { supLoyalty: 0, supLean:+15, oppLoyalty:-15, oppLean:-20 };
    if (outcome.method === 'defy')        return { supLoyalty:+10, supLean:+20, oppLoyalty:-25, oppLean:-30 };
    if (outcome.method === 'council')     return { supLoyalty:+5, supLean:+10, oppLoyalty:-5, oppLean:-10 };
    return { supLoyalty:+5, supLean:+10, oppLoyalty:-5, oppLean:-10 };   // default·未知 method fallback
  }

  function _kjpL7RememberNpc(name, text, emotion, weight) {
    if (typeof NpcMemorySystem === 'undefined' || !NpcMemorySystem.remember) return;
    try {
      NpcMemorySystem.remember(
        name,
        text,
        emotion,
        Math.max(1, weight | 0),
        (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.characterName) || '陛下'
      );
    } catch(_){}
  }

  function _kjpL7MethodLabel(method) {
    // RBB·BB-D2·对齐 _keyiPersistToCourtRecords·本文件用改革纪事简版标签
    // L7 chronicle 用简版·council='依议' edict='下诏' defy='逆众议'
    return ({ council:'依议', edict:'下诏', defy:'逆众议' })[method] || method;
  }

  // ════════════════════════════════════════════════════════════════
  // §8·反弹·走奏疏 source pool (Layer 1) + F4 极端 (Layer 2)
  // ════════════════════════════════════════════════════════════════

  function _kjpL7MaybeTriggerReformReaction(histEntry, ctx) {
    if (!histEntry) return;

    // Layer 1·所有反弹·走奏疏
    try {
      if (typeof window !== 'undefined' && typeof window._kjSpawnReformMemorial === 'function') {
        var memorial = window._kjSpawnReformMemorial(histEntry, ctx);
        if (memorial) histEntry.memorialId = memorial.reformId + '_T' + memorial.spawnedTurn;
      }
    } catch(_){}

    // Layer 2·极端·F4 直 spawn·绕过 source pool
    var extremeProb = 0;
    var radical = (histEntry.magnitudeParsed && histEntry.magnitudeParsed.radical) || 0;
    if (histEntry.method === 'defy' && radical >= 80) extremeProb = 0.4;
    else if (histEntry.method === 'edict' && radical >= 90) extremeProb = 0.2;
    if (Math.random() < extremeProb) {
      var leadingOpposerName = (histEntry.opposeNpcs || [])[0] || '';
      var ch = (leadingOpposerName && typeof findCharByName === 'function') ? findCharByName(leadingOpposerName) : null;
      var leadingOpposerParty = (ch && ch.party) || '';
      var detail = {
        source: 'L7-reform-extreme-reaction',
        reformId: histEntry.id,
        reformText: (ctx && ctx.topicData && ctx.topicData.topic) || '',
        method: histEntry.method,
        magnitudeDescriptor: histEntry.magnitudeDescriptor || ''
      };
      try {
        if (typeof window !== 'undefined' && typeof window._kjSpawnYanguanQingyi === 'function') {
          window._kjSpawnYanguanQingyi(leadingOpposerParty, leadingOpposerName, detail);
          histEntry.yanguanReactionId = 'extreme_T' + (GM.turn || 0);
        }
      } catch(_){}
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §9·chronicle 邸报 cosmetic·朝代 voice
  // ════════════════════════════════════════════════════════════════

  function _kjpL7WriteChronicleSummary(histEntry, ctx) {
    if (!histEntry || !Array.isArray(GM._chronicle)) return;
    var era = (GM._kejuParadigm && GM._kejuParadigm.initEra) || '';
    var voice = _kjpL7GetEmperorVoice(era);
    var verb = histEntry.outcome && histEntry.outcome.passed
      ? '准'
      : (histEntry.outcome && histEntry.outcome.kind === 'rejected_overlap' ? '搁议·前改未稳' : '罢议');
    // L11·C2·intent='rollback' 加 branch·非落入'改科举·'误导
    // L11·RBB·I1·若 magnitudeDescriptor 头已"罢"·verbPrefix 改"科举·"·避双"罢"重复
    var rawMag = histEntry.magnitudeDescriptor || '';
    var verbPrefix;
    if (histEntry.intent === 'restoration') {
      verbPrefix = '复古·';
    } else if (histEntry.intent === 'rollback') {
      verbPrefix = (rawMag.charAt(0) === '罢') ? '科举·' : '罢科举·';
    } else {
      verbPrefix = '改科举·';
    }
    var text = voice + '·' + verb + '·' + verbPrefix +
               rawMag + '·' + _kjpL7MethodLabel(histEntry.method);
    if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
      turn: GM.turn || 1,
      date: GM._gameDate || '',
      type: histEntry.outcome && histEntry.outcome.passed ? 'keju-reform-applied' : 'keju-reform-rejected',
      text: text,
      tags: ['科举', 'paradigm', histEntry.intent, (histEntry.outcome && histEntry.outcome.kind) || 'unknown'],
      reformId: histEntry.id,
      rampUpYears: histEntry.outcome ? histEntry.outcome.rampUpYears : 0
    });
  }

  function _kjpL7GetEmperorVoice(era) {
    var voiceMap = {
      han:'诏曰', tang:'敕命', song:'圣旨', yuan:'圣旨', ming:'谕旨',
      qing:'上谕', jin:'诏曰', sui:'敕命', zhou:'王命', shang:'王命', xia:'王命'
    };
    return voiceMap[era] || '上谕';
  }

  // ════════════════════════════════════════════════════════════════
  // §10·L4·g1 backfill·matured 时调·真填 _kjpAuditForecastAccuracy stub
  //     (本文件提供 backfill orchestration·_kjpAuditForecastAccuracy 真填在 panel.js L7·g)
  // ════════════════════════════════════════════════════════════════

  function _kjpL7BackfillForecastsForReform(histEntry) {
    if (!histEntry || histEntry.forecastsSettled) return;
    // L11·RAA·D1·rolled_back entry·forecast 已无意义·skip·防写假 reputation
    if (histEntry.status === 'rolled_back') {
      histEntry.forecastsSettled = true;
      return;
    }
    var actualOutcome = {
      diffApplied: histEntry.diff || null,
      method: histEntry.method,
      passed: histEntry.status !== 'rejected',
      prestigeDelta: ((histEntry.outcome && histEntry.outcome.prestigeDelta &&
        (histEntry.outcome.prestigeDelta.immediate || 0) + (histEntry.outcome.prestigeDelta.onMatured || 0)) || 0),
      factionTensionDelta: (histEntry.outcome && histEntry.outcome.factionTensionDelta) || 0,
      yanguanSpawned: !!(histEntry.memorialId || histEntry.yanguanReactionId),
      rampUpYears: histEntry.outcome ? histEntry.outcome.rampUpYears : 0
    };

    // RBB·BB-A1/C1·digest slice 40 → 80·防 multi-reform 同前 40 char collision
    var key = (histEntry.paradigmDigest || '').slice(0, 80);
    var entries = [];
    try {
      if (typeof window !== 'undefined' && window.ChronicleTracker && window.ChronicleTracker.listVisible) {
        entries = window.ChronicleTracker.listVisible();
      }
    } catch(_){}

    (histEntry.cedui || []).forEach(function(advisorName) {
      var npc = (typeof findCharByName === 'function') ? findCharByName(advisorName) : null;
      if (!npc) return;
      // RBB·BB-A3·skip dead / 状态不在朝·dead/exile/imprison 不该写 forecast reputation
      if (npc.alive === false || npc._exiled || npc._imprisoned) return;
      entries.forEach(function(entry) {
        if (entry.sourceType !== 'kjp-cedui') return;
        if (entry.actor !== advisorName) return;
        if ((entry.sourceId || '').indexOf(key) < 0) return;
        // call·_kjpAuditForecastAccuracy (panel.js L7·g 真填)·返 score 0-100
        var score = 0;
        try {
          if (typeof _kjpAuditForecastAccuracy === 'function') {
            score = _kjpAuditForecastAccuracy(entry, actualOutcome) | 0;
          }
        } catch(_){}
        _kjpL7WriteNpcReputationFromScore(npc, score);
      });
    });
    histEntry.forecastsSettled = true;
  }

  function _kjpL7WriteNpcReputationFromScore(npc, score) {
    if (!npc || !npc._forecastReputation) return;
    var rep = npc._forecastReputation;
    rep.accurateForecasts = (parseInt(rep.accurateForecasts, 10) || 0) + (score >= 60 ? 1 : 0);
    var prevTotal = (parseInt(rep.averageScore, 10) || 0) * Math.max(1, (parseInt(rep.totalForecasts, 10) || 1) - 1);
    rep.averageScore = Math.round((prevTotal + score) / Math.max(1, parseInt(rep.totalForecasts, 10) || 1));
    var t = parseInt(rep.totalForecasts, 10) || 0;
    var a = parseInt(rep.accurateForecasts, 10) || 0;
    var avg = parseInt(rep.averageScore, 10) || 0;
    if (t === 0) rep.reputation = 'new';
    else if (avg === 0 && a === 0) rep.reputation = 'unaudited';
    else if (avg >= 70 && (a / t) >= 0.6) rep.reputation = 'reliable';
    else if (avg >= 40) rep.reputation = 'mixed';
    else rep.reputation = 'unreliable';
  }

  // ════════════════════════════════════════════════════════════════
  // §11·reformLean decay endTurn (L7·i·深扩)
  // ════════════════════════════════════════════════════════════════

  function _kjpL7TickReformLeanDecay(turn) {
    if (!_isL7Enabled()) return;
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return;
    var DECAY_PER_TURN = 0.5;
    GM.chars.forEach(function(ch) {
      if (!ch || !ch._kjpReformLean) return;
      var lean = ch._kjpReformLean;
      var turnDist = (parseInt(turn, 10) || 0) - (parseInt(lean.lastTurn, 10) || 0);
      if (turnDist <= 0) return;
      var val = parseInt(lean.value, 10) || 0;
      if (val === 0) return;
      var decay = Math.min(Math.abs(val), DECAY_PER_TURN * turnDist);
      if (typeof _kjpAccumReformLean === 'function') {
        try {
          if (val > 0) _kjpAccumReformLean(ch, -decay, turn);
          else _kjpAccumReformLean(ch, decay, turn);
        } catch(_){}
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §12·暴露
  // ════════════════════════════════════════════════════════════════

  if (typeof window !== 'undefined') {
    window._kjReformKeyiCallback        = _kjReformKeyiCallback;
    window._kjpL7DeriveOutcome          = _kjpL7DeriveOutcome;
    window._kjpL7ApplyDiffToParadigm    = _kjpL7ApplyDiffToParadigm;
    window._kjpL7MergeDiff              = _kjpL7MergeDiff;
    window._kjpL7AppendHistory          = _kjpL7AppendHistory;
    window._kjpL7StartRamping           = _kjpL7StartRamping;
    window._kjpL7TickRampingReform      = _kjpL7TickRampingReform;
    window._kjpL7ApplyCharsImpact       = _kjpL7ApplyCharsImpact;
    window._kjpL7MaybeTriggerReformReaction = _kjpL7MaybeTriggerReformReaction;
    window._kjpL7WriteChronicleSummary  = _kjpL7WriteChronicleSummary;
    window._kjpL7BackfillForecastsForReform = _kjpL7BackfillForecastsForReform;
    window._kjpL7TickReformLeanDecay    = _kjpL7TickReformLeanDecay;
    window._kjpL7CheckOverlapAccept     = _kjpL7CheckOverlapAccept;
    window._kjpL7GetEmperorVoice        = _kjpL7GetEmperorVoice;
    window._kjpL7DeriveCharsDeltas      = _kjpL7DeriveCharsDeltas;
    window._kjpL7CalcImmediatePrestige  = _kjpL7CalcImmediatePrestige;
    window._kjpL7CalcMaturedPrestige    = _kjpL7CalcMaturedPrestige;
    window._kjpL7CalcFactionTension     = _kjpL7CalcFactionTension;
    window._kjpL7MethodLabel            = _kjpL7MethodLabel;
    window._kjpL7ListFromBreakdown      = _kjpL7ListFromBreakdown;
    window._kjpL7ListCeduiAdvisorsForDigest = _kjpL7ListCeduiAdvisorsForDigest;
    window._kjpL7FindPrevReformId       = _kjpL7FindPrevReformId;
    window._kjpL7AppendReformChronicleStub = _kjpL7AppendReformChronicleStub;
    window._kjpL7WriteNpcReputationFromScore = _kjpL7WriteNpcReputationFromScore;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjReformKeyiCallback: _kjReformKeyiCallback,
      _kjpL7DeriveOutcome: _kjpL7DeriveOutcome,
      _kjpL7ApplyDiffToParadigm: _kjpL7ApplyDiffToParadigm,
      _kjpL7MergeDiff: _kjpL7MergeDiff,
      _kjpL7AppendHistory: _kjpL7AppendHistory,
      _kjpL7StartRamping: _kjpL7StartRamping,
      _kjpL7TickRampingReform: _kjpL7TickRampingReform,
      _kjpL7ApplyCharsImpact: _kjpL7ApplyCharsImpact,
      _kjpL7MaybeTriggerReformReaction: _kjpL7MaybeTriggerReformReaction,
      _kjpL7WriteChronicleSummary: _kjpL7WriteChronicleSummary,
      _kjpL7BackfillForecastsForReform: _kjpL7BackfillForecastsForReform,
      _kjpL7TickReformLeanDecay: _kjpL7TickReformLeanDecay,
      _kjpL7CheckOverlapAccept: _kjpL7CheckOverlapAccept,
      _kjpL7GetEmperorVoice: _kjpL7GetEmperorVoice,
      _kjpL7DeriveCharsDeltas: _kjpL7DeriveCharsDeltas,
      _kjpL7CalcImmediatePrestige: _kjpL7CalcImmediatePrestige,
      _kjpL7CalcMaturedPrestige: _kjpL7CalcMaturedPrestige,
      _kjpL7CalcFactionTension: _kjpL7CalcFactionTension,
      _kjpL7MethodLabel: _kjpL7MethodLabel,
      _kjpL7ListFromBreakdown: _kjpL7ListFromBreakdown,
      _kjpL7ListCeduiAdvisorsForDigest: _kjpL7ListCeduiAdvisorsForDigest,
      _kjpL7FindPrevReformId: _kjpL7FindPrevReformId,
      _kjpL7AppendReformChronicleStub: _kjpL7AppendReformChronicleStub,
      _kjpL7WriteNpcReputationFromScore: _kjpL7WriteNpcReputationFromScore
    };
  }
})();
