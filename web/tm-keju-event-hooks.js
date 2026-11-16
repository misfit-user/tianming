// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-event-hooks.js — Phase G·G2·step 0·event hook 前置 (CRITICAL B1 fix)
 *
 * paradigm·event-driven·5 类政治事件源在固定 hook 点 SET 字段·供 G1 _kjCheckEnkeTriggers 读
 *
 * 背景·v1/v2 audit B1·G1 `_lastReignChangeYear` / `_lastImperialWeddingYear` 只读·零处 SET·
 *      4 of 5 enke trigger 永远死。v3 §2.0 修·event hook 模块前置·6 hook 点统一管。
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuG2=false 全 no-op (gate G2 整体·此模块不独立 gate)
 *   - 不发 modal·不发邸报·只 SET 字段
 *   - 严禁玄幻·瑞祥也是政治表演 (天降甘露 / 麒麟现等)·非天命惩罚
 *   - 全幂等·重复 call 不破坏 state
 *
 * Public API·
 *   _kjEventOnReignChange(newEmperorName, year)          — 登基/改元·SET _lastReignChangeYear
 *   _kjEventOnImperialWedding(year, spouseName)          — 大婚·SET _lastImperialWeddingYear
 *   _kjEventOnPlatformDisasterResolved(year, type)        — 平大乱·SET _lastPlatformDisasterYear
 *   _kjEventOnAuspicePortent(year, portentDesc)           — 瑞祥·SET _lastAuspicePortentYear
 *   _kjG2GetEmperorBirthYear()                            — emperor birthYear 三层 fallback
 *   _kjEventCheckReignTransition()                        — endTurn 调·探 emperor.alive=false → 触 ReignChange
 *   _kjEventCheckWarStateRecovery()                       — endTurn 调·war_state 从 ≥60 降 <30 → 触 PlatformDisasterResolved
 *
 * 依赖·
 *   - GM (mutate _last*Year fields)
 *   - P.scenario / P.playerInfo (birthYear fallback)
 *   - findCharByName (global·index world)
 *   - GM.chars (查 emperor / war chars)
 *   - GM.vars['边事'] (war state·若有)
 *
 * 不依赖 (clean module)·
 *   - 不调 _logChronicle / _toast / UI
 *   - 不调 LLM
 */
(function() {
  'use strict';

  function _getCurYear() {
    if (typeof GM === 'undefined' || !GM) return 0;
    return GM.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  // ─── 5 SET hooks ───

  /** 登基 / 改元·SET _lastReignChangeYear·触发 enke 滥开 counter reset + desk suggestion */
  function _kjEventOnReignChange(newEmperorName, year) {
    if (typeof GM === 'undefined' || !GM) return;
    var y = year || _getCurYear();
    GM._lastReignChangeYear = y;
    if (newEmperorName) GM._currentReignName = String(newEmperorName);
    // 触发 B·滥开 counter reset (若 step b 已 ship·此函数已 expose)
    try {
      if (typeof window !== 'undefined' && typeof window._kjG2ResetEnkeAbuseOnReignChange === 'function') {
        window._kjG2ResetEnkeAbuseOnReignChange();
      }
    } catch(_) {}
    // G2·step 0a·push desk suggestion·让 user 在御案见 "登基恩科 template"
    try {
      if (typeof window !== 'undefined' && typeof window._kjG2OnNaturalTriggerEnqueueDeskSuggestion === 'function') {
        window._kjG2OnNaturalTriggerEnqueueDeskSuggestion('reign-change', { reignName: newEmperorName });
      }
    } catch(_) {}
  }

  /** 大婚·SET _lastImperialWeddingYear + desk suggestion */
  function _kjEventOnImperialWedding(year, spouseName) {
    if (typeof GM === 'undefined' || !GM) return;
    GM._lastImperialWeddingYear = year || _getCurYear();
    if (spouseName) GM._lastImperialSpouse = String(spouseName);
    try {
      if (typeof window !== 'undefined' && typeof window._kjG2OnNaturalTriggerEnqueueDeskSuggestion === 'function') {
        window._kjG2OnNaturalTriggerEnqueueDeskSuggestion('wedding', { spouse: spouseName });
      }
    } catch(_) {}
  }

  /** 平大乱·SET _lastPlatformDisasterYear + desk suggestion */
  function _kjEventOnPlatformDisasterResolved(year, disasterType) {
    if (typeof GM === 'undefined' || !GM) return;
    GM._lastPlatformDisasterYear = year || _getCurYear();
    if (disasterType) GM._lastPlatformDisasterType = String(disasterType);
    try {
      if (typeof window !== 'undefined' && typeof window._kjG2OnNaturalTriggerEnqueueDeskSuggestion === 'function') {
        window._kjG2OnNaturalTriggerEnqueueDeskSuggestion('platform-disaster', { disasterType: disasterType });
      }
    } catch(_) {}
  }

  /** 瑞祥·SET _lastAuspicePortentYear·非玄幻·政治表演 + desk suggestion */
  function _kjEventOnAuspicePortent(year, portentDesc) {
    if (typeof GM === 'undefined' || !GM) return;
    GM._lastAuspicePortentYear = year || _getCurYear();
    if (portentDesc) GM._lastAuspicePortentDesc = String(portentDesc);
    try {
      if (typeof window !== 'undefined' && typeof window._kjG2OnNaturalTriggerEnqueueDeskSuggestion === 'function') {
        window._kjG2OnNaturalTriggerEnqueueDeskSuggestion('auspice', { portentDesc: portentDesc });
      }
    } catch(_) {}
  }

  // ─── emperor birthYear 三层 fallback ───

  function _kjG2GetEmperorBirthYear() {
    if (typeof GM === 'undefined' || !GM) return null;
    // 1·current emperor char 的 birthYear (优先)
    if (Array.isArray(GM.chars)) {
      for (var i = 0; i < GM.chars.length; i++) {
        var c = GM.chars[i];
        if (!c) continue;
        if (c.alive === false) continue;
        if (c._isPlayerEmperor || c._isCurrentEmperor) {
          if (c.birthYear) return c.birthYear;
        }
      }
    }
    // 2·运行态唯一玩家角色 → birthYear（P.playerInfo 是只读剧本模板，不参与运行身份选择）
    var pch = (typeof TM !== 'undefined' && TM.Player && typeof TM.Player.getCharacter === 'function')
      ? TM.Player.getCharacter(GM)
      : ((GM.chars || []).find(function(c) { return c && c.isPlayer === true; }) || null);
    if (pch && pch.birthYear) return pch.birthYear;
    // 3·BB11·player char.age 反推 (P.playerInfo.startAge / .birthYear 都 grep 0·改用 char.age)
    if (pch && typeof pch.age === 'number' && pch.age > 0) {
      var curY = _getCurYear();
      if (curY) return curY - pch.age;
    }
    return null;
  }

  // BB15·跨剧本 reset·若 P.scenario.startYear 跟当 GM.year 接近·清旧 _last*Year 字段
  function _kjG2MaybeResetCrossScenarioFields() {
    if (typeof GM === 'undefined' || !GM) return;
    if (typeof P === 'undefined' || !P || !P.scenario) return;
    var startY = P.scenario.startYear;
    if (!startY) return;
    var curY = _getCurYear();
    // 若 GM.year 跟 scenario.startYear 一致 (新剧本起手)·且 _last*Year > startY·旧剧本残留·清
    var thresholdYears = 10; // 偏差 10 年内算"新剧本起手"
    if (Math.abs(curY - startY) <= thresholdYears) {
      ['_lastReignChangeYear', '_lastImperialWeddingYear',
       '_lastPlatformDisasterYear', '_lastAuspicePortentYear',
       '_lastWarStateValForRecoveryWatch', '_reignTransitionFiredFor',
       '_wujuPeacefulCounter'].forEach(function(k) {                  // G3·M7·跨剧本 reset 加 wuju
        if (GM[k] != null) {
          // 若值远 > startY (历史·非本剧本)·清
          if (typeof GM[k] === 'number' && GM[k] > startY + thresholdYears) {
            delete GM[k];
          }
        }
      });
      // G3·RBB·M7·额外 transient·一刀切清 (跨剧本永远应清·非 year-aware)
      ['_wujuCeremonyQueue', '_wujuPendingDepotAssignments',
       '_wenguanImpeachmentCount', '_wujuCoupFiredTurn',
       '_wujuAssignSpinIdx', '_wujuBingbuWenduiLastYear',
       // Phase H·C1·school-network 跨剧本 transient
       '_schoolNetwork', '_lastSchoolFoundedYear', '_lastSchoolBannedYear',
       '_kjpHFeedbackCooldown', '_kjpHRebelPartySpawnedThisWatershed',
       '_kjpHTierChangeFiredTurn',
       // R4·补·H4/H5/H8/H9/H3 跨剧本 transient
       '_kjpHWatershedFired', '_kjpHLastAutoLectureYear',
       '_kjpHLectureQueue', '_kjpHPendingParadigmShifts',
       '_kjpHLibuWenduiLastYear', '_kjpHWeightDriftAccum',
       '_kjpHFeedbackFiredThisTurn'].forEach(function(k) {
        if (GM[k] != null) delete GM[k];
      });
      // window 上的 transient context·跨剧本应 nuke
      if (typeof window !== 'undefined') {
        try { window._kjpHSchoolWenduiContext = null; } catch(_) {}
      }
    }
  }

  // ─── endTurn watchers ───

  /** 探 emperor.alive=false (帝崩) → 触发 ReignChange·一次性 */
  function _kjEventCheckReignTransition() {
    if (typeof GM === 'undefined' || !GM) return;
    var emp = (typeof TM !== 'undefined' && TM.Player && typeof TM.Player.getCharacter === 'function')
      ? TM.Player.getCharacter(GM)
      : ((GM.chars || []).find(function(c) { return c && c.isPlayer === true; }) || null);
    if (!emp) return;
    var empName = emp.name;
    // 帝崩 (alive=false)·一次性·按 emperor name guard·防 alive=false 持续状态每年重触
    if (emp.alive === false) {
      if (!GM._reignTransitionFiredFor) GM._reignTransitionFiredFor = {};
      if (GM._reignTransitionFiredFor[empName]) return;
      GM._reignTransitionFiredFor[empName] = true;
      var y = _getCurYear();
      GM._lastReignTransitionDetectedAt = y;
      // 新帝名·若 chars 中有 _isSuccessor 或 alive 太子·picked·否则 unknown
      var newEmp = null;
      if (Array.isArray(GM.chars)) {
        newEmp = GM.chars.find(function(c) {
          return c && c.alive !== false && (c._isSuccessor || c._isCrownPrince);
        });
      }
      _kjEventOnReignChange(newEmp ? newEmp.name : '(继位)', y);
    }
  }

  /** war_state delta watcher·从 ≥60 降到 <30·触发 PlatformDisasterResolved + G3 peaceful counter */
  function _kjEventCheckWarStateRecovery() {
    if (typeof GM === 'undefined' || !GM || !GM.vars) return;
    var warVar = GM.vars['边事'];
    if (!warVar) return;
    var curVal = parseInt(warVar.value, 10) || 0;
    var lastVal = (typeof GM._lastWarStateValForRecoveryWatch === 'number') ? GM._lastWarStateValForRecoveryWatch : -1;
    // 首次 init·记录
    if (lastVal < 0) {
      GM._lastWarStateValForRecoveryWatch = curVal;
      // G3·首次 init peaceful counter (若不存)
      if (typeof window !== 'undefined' && typeof window._kjG3InitPeacefulCounter === 'function') {
        try { window._kjG3InitPeacefulCounter(); } catch(_) {}
      }
      return;
    }
    // 从 ≥60 降到 <30·触发
    if (lastVal >= 60 && curVal < 30) {
      _kjEventOnPlatformDisasterResolved(_getCurYear(), '边事告平');
    }
    GM._lastWarStateValForRecoveryWatch = curVal;
    // G3·peaceful counter·若 war_state <30·累计 peaceful year
    if (curVal < 30 && typeof window !== 'undefined' && typeof window._kjG3TickPeacefulCounter === 'function') {
      try { window._kjG3TickPeacefulCounter(); } catch(_) {}
    } else if (curVal >= 30 && typeof window !== 'undefined' && typeof window._kjG3ResetPeacefulCounter === 'function') {
      // war 升·peaceful reset (战时不算和平)
      try { window._kjG3ResetPeacefulCounter(); } catch(_) {}
    }
    // F1·event-driven desk suggestion·war_state 跃至 ≥60 时·立即 push desk suggestion (跟 G2 paradigm 对称)
    // 跨 cooldown·spawn-driven 漏的情况下·desk 仍见"边镇危急·请开武举"建议
    if (curVal >= 60 && lastVal < 60 && typeof window !== 'undefined' &&
        typeof window._kjG3OnWujuTriggerEnqueueDeskSuggestion === 'function') {
      try {
        window._kjG3OnWujuTriggerEnqueueDeskSuggestion('war-crisis', {
          disasterType: '边镇危急',
          warLevel:     curVal
        });
      } catch(_) {}
    }
  }

  // ─── expose ───
  if (typeof window !== 'undefined') {
    window._kjEventOnReignChange              = _kjEventOnReignChange;
    window._kjEventOnImperialWedding          = _kjEventOnImperialWedding;
    window._kjEventOnPlatformDisasterResolved = _kjEventOnPlatformDisasterResolved;
    window._kjEventOnAuspicePortent           = _kjEventOnAuspicePortent;
    window._kjG2GetEmperorBirthYear           = _kjG2GetEmperorBirthYear;
    window._kjEventCheckReignTransition       = _kjEventCheckReignTransition;
    window._kjEventCheckWarStateRecovery      = _kjEventCheckWarStateRecovery;
    window._kjG2MaybeResetCrossScenarioFields = _kjG2MaybeResetCrossScenarioFields;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjEventOnReignChange:              _kjEventOnReignChange,
      _kjEventOnImperialWedding:          _kjEventOnImperialWedding,
      _kjEventOnPlatformDisasterResolved: _kjEventOnPlatformDisasterResolved,
      _kjEventOnAuspicePortent:           _kjEventOnAuspicePortent,
      _kjG2GetEmperorBirthYear:           _kjG2GetEmperorBirthYear,
      _kjEventCheckReignTransition:       _kjEventCheckReignTransition,
      _kjEventCheckWarStateRecovery:      _kjEventCheckWarStateRecovery,
      _kjG2MaybeResetCrossScenarioFields: _kjG2MaybeResetCrossScenarioFields
    };
  }
})();
