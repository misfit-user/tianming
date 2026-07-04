// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-enke.js — Phase G·G2·step a·恩科主 runner + 谢恩大典 + Path B keyi promote
 *
 * paradigm·standalone mini-runner·不嵌进 9-tier 常科 runtime (避耦合 startKejuByMethod)
 *   - 自然 trigger / Path B keyi / Path C edict 三入口·汇合 _kjG2OnEnkeApproved
 *   - 跳过童试/乡试 (恩科本就特赐)·直接生 N 名特赐进士 (jinshi quality 由 step b-deep 调)
 *   - 谢恩大典·LLM 古文奏疏 (无 LLM 时 fallback template)
 *   - 跨turn 状态机·resume on init·避 LLM async 中断
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuG2=false 全 no-op
 *   - 不发 modal (chronicle + suggestion 为主)
 *   - 严禁玄幻·全自然政治后果
 *
 * Public API·
 *   _kjG2OnEnkeApproved(subtype, td)           — 主入口·三路径汇合
 *   _kjG2OnEnkeRejected(td)                    — keyi reject 时·prestige/minxin -
 *   _kjG2OnEnkeDeferred(td)                    — 推迟 2 turn 重 spawn
 *   _kjG2PickEnkeChiefExaminer()               — 主考·复用 step 0a _kjG2PickLibuLeader
 *   _kjG2RunXieendaCeremony(jinshiList, examiner, cb) — 谢恩大典 LLM
 *   _kjG2ResumeEnkeXieendaIfPending()          — init resume hook
 *   _kjG2MarkEnkeJinshi(jinshi, examYear, examiner, td) — 特赐进士标记 (multiplier step b stub)
 *   _kjG2SpawnEnkeJinshiPool(td, examiner)     — 生 N 名 stub 特赐进士入 GM.chars
 *   _kjG2DecorateSpawnedEntryForKeyi(entry)    — G1 spawn → promote keyi
 *   _kjG2SpecialExamKeyiCallback(method, opts)  — keyi callback router
 *   _kjG2ConsumePendingEnkeFromEdict()         — drain step 0a _pendingEnkeFromEdict
 *   _kjG2CalcEnkePrestigeMultiplier()           — step b stub·返 1.0
 *
 * 依赖·
 *   - GM (mutate _enkeHistory / _enkeXieendaPending / chars)
 *   - P.conf.useNewKejuG2 (gate)
 *   - _kjG2PickLibuLeader (step 0a)·_kjG2NumToCn
 *   - callAI (LLM·optional·缺则 fallback)
 *   - GM._chronicle (push)
 *
 * step b/c/d 后续 patch·
 *   - _kjG2CalcEnkePrestigeMultiplier (step b·覆盖 stub·按 abuseCount 算)
 *   - _kjG2GenEnkeQuestions (step c·歌颂体题目)
 *   - _kjG2ApplyJinshiQualityDegradation (step b-deep·覆盖 stub)
 *   - _kjG2EnkeJinshiJoinParty (step d·入恩科党)
 */
(function() {
  'use strict';

  var ENKE_JINSHI_COUNT = 12;            // 默 12 名特赐进士 (恩科规模小于常科 30)
  var XIEENDA_TIMEOUT_TURNS = 3;         // 跨turn LLM timeout

  function _isG2Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuG2 !== false; // 默认开·2026-06-14·恩科解锁
  }

  function _getCurYear() {
    if (typeof GM === 'undefined' || !GM) return 0;
    return GM.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  // ─── step b-UX·滥开 4 档·LLM tone / chronicle style / 言官触发率 ───

  function _kjG2GetEnkeMemorialToneHint() {
    var n = (typeof GM !== 'undefined' && GM && GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || 0;
    if (n <= 2) return {
      tier:     'pious',
      tone:     '虔诚恭敬',
      template: '礼部·恭逢{事由}·伏请陛下开恩科以光天恩·士林翘首',
      sample:   '礼部·恭逢圣寿六十·伏请陛下开恩科以光天恩'
    };
    if (n === 3) return {
      tier:     'routine',
      tone:     '恭敬中带例行',
      template: '礼部·{事由}·虽属恩典惯例·礼部具题请开',
      sample:   '礼部·新君改元·虽属恩典惯例·礼部具题请开恩科'
    };
    if (n === 4) return {
      tier:     'perfunctory',
      tone:     '敷衍援例',
      template: '礼部·{事由}·援例·伏请圣裁',
      sample:   '礼部·圣寿七十·援例·伏请圣裁'
    };
    return {
      tier:     'rote',
      tone:     '套话例行',
      template: '礼部·{事由}·例行具题',
      sample:   '礼部·恩例当行·例行具题'
    };
  }

  function _kjG2GetEnkeChronicleStyle() {
    var n = (typeof GM !== 'undefined' && GM && GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || 0;
    if (n <= 2) return { tier:'pious',      titleSuffix: '',          bodyTone: '士林感激涕零·进士叩谢' };
    if (n === 3) return { tier:'routine',    titleSuffix: '',          bodyTone: '士论已轻' };
    if (n === 4) return { tier:'perfunctory', titleSuffix: ' (例行)',   bodyTone: '清议讥之' };
    return                  { tier:'rote',       titleSuffix: ' (邸报失载)', bodyTone: '士不齿之·邸报无名' };
  }

  function _kjG2GetEnkeYanguanProtestProbability() {
    var n = (typeof GM !== 'undefined' && GM && GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || 0;
    if (n <= 2) return 0;
    if (n === 3) return 0.05;
    if (n === 4) return 0.25;
    return 0.6;
  }

  function _kjG2MaybeFireYanguanProtestAfterEnke(td) {
    if (!_isG2Enabled()) return false;
    var prob = _kjG2GetEnkeYanguanProtestProbability();
    if (prob <= 0) return false;
    if (Math.random() >= prob) return false;
    var n = (GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || 0;
    // BB1·真函数 _kjSpawnYanguanQingyi(party, attackedMember, eventDetail)·3 positional
    if (typeof window !== 'undefined' && typeof window._kjSpawnYanguanQingyi === 'function') {
      try {
        var fired = window._kjSpawnYanguanQingyi(
          '恩科党',
          '',
          '一朝恩科已 ' + n + ' 次·圣恩太厚·士林讥滥赏·伏请陛下慎赏'
        );
        if (fired) return true;
      } catch(_) {}
    }
    // F4c 未 ship 或 cooldown 内·退化 chronicle 记一笔
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'enke_yanguan_protest',
        text: _getCurYear() + '年·言官 ' + n + ' 次恩科·清议讥滥',
        tags: ['科举', '恩科', '言官', '滥开']
      });
    }
    return true;
  }

  // ─── 主考 pick (alias of step 0a 函数·若 step 0a 已 ship) ───

  function _kjG2PickEnkeChiefExaminer() {
    if (typeof window !== 'undefined' && typeof window._kjG2PickLibuLeader === 'function') {
      return window._kjG2PickLibuLeader();
    }
    return null;
  }

  // ─── B prestige multiplier + counter init/reset (step b) ───

  function _kjG2CalcEnkePrestigeMultiplier() {
    if (typeof GM === 'undefined' || !GM || !GM._enkeAbuseCounter) return 1.0;
    var n = GM._enkeAbuseCounter.enkeCount || 0;
    if (n <= 2) return 1.0;
    if (n === 3) return 0.7;
    if (n === 4) return 0.4;
    return 0.1;
  }

  function _kjG2InitEnkeAbuseCounter() {
    if (typeof GM === 'undefined' || !GM) return;
    if (GM._enkeAbuseCounter) return;  // 幂等
    GM._enkeAbuseCounter = {
      reignStartYear: _getCurYear(),
      enkeCount:      0,
      reignName:      (GM._currentReignName || '')
    };
  }

  function _kjG2ResetEnkeAbuseOnReignChange() {
    if (typeof GM === 'undefined' || !GM) return;
    GM._enkeAbuseCounter = {
      reignStartYear: _getCurYear(),
      enkeCount:      0,
      reignName:      (GM._currentReignName || '')
    };
  }

  // ─── step e·宋特奏名变体 ───

  function _kjG2GetCharAge(c) {
    if (!c) return 0;
    // 1·直 age 字段
    if (typeof c.age === 'number' && c.age > 0) return c.age;
    // 2·birthYear + GM.year
    if (c.birthYear && typeof GM !== 'undefined' && GM && GM.year) {
      var a = GM.year - c.birthYear;
      return a > 0 ? a : 0;
    }
    // 3·birthTime string parse
    if (c.birthTime && typeof GM !== 'undefined' && GM && GM.year) {
      var m = String(c.birthTime).match(/(\d{3,4})/);
      if (m) {
        var y = parseInt(m[1], 10);
        return GM.year - y;
      }
    }
    return 0;
  }

  function _kjG2IsSongTesuoming() {
    if (typeof P === 'undefined' || !P || !P.scenario) return false;
    var era = String(P.scenario.era || '');
    return /宋|song/i.test(era);
  }

  function _kjG2CheckTesuomingTrigger() {
    if (!_isG2Enabled()) return null;
    if (!_kjG2IsSongTesuoming()) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    // 封禅大典毕·1 年内
    if (GM._lastFengchanYear && (GM.year - GM._lastFengchanYear) <= 1) {
      return {
        reason:  '封禅大典毕·礼部请特奏名以安士心',
        subtype: 'tesuoming-fengchan'
      };
    }
    // 朝中老举子 (age≥50 + fail≥3) ≥ 30 人·安抚奏 spawn
    if (Array.isArray(GM.chars)) {
      var oldFailedCands = GM.chars.filter(function(c) {
        if (!c || c.alive === false) return false;
        if (_kjG2GetCharAge(c) < 50) return false;
        return (c._failedExamCount || 0) >= 3;
      });
      if (oldFailedCands.length >= 30) {
        return {
          reason:   '老举子士林滞·礼部请特奏名以安',
          subtype:  'tesuoming-old-cands',
          oldCount: oldFailedCands.length
        };
      }
    }
    return null;
  }

  function _kjG2RunTesuoming(td) {
    if (!_isG2Enabled()) return null;
    if (!_kjG2IsSongTesuoming()) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    if (!Array.isArray(GM.chars)) return null;
    td = td || {};
    // BB16·同年若已 enke approved·tesuoming defer·避士林同年 12 进士 + 6 特奏名混乱
    var curYear = _getCurYear();
    if (Array.isArray(GM._enkeHistory)) {
      var enkeThisYear = GM._enkeHistory.find(function(h) { return h && h.year === curYear; });
      if (enkeThisYear) {
        // chronicle 记一笔·tesuoming 推迟
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1,
            type: 'tesuoming_defer',
            text: curYear + '年·宋特奏名议·因本年已开恩科·礼部推迟特奏名至明岁',
            tags: ['科举', '恩科', '特奏名', 'defer']
          });
        }
        return null;
      }
    }

    // 找老举子候选
    var oldFailedCands = GM.chars.filter(function(c) {
      if (!c || c.alive === false) return false;
      if (_kjG2GetCharAge(c) < 50) return false;
      return (c._failedExamCount || 0) >= 3;
    });
    var oldCount = oldFailedCands.length;
    if (oldCount === 0) return null;

    // 名额·oldCount / 5 (清退 20%)
    var quota = Math.max(3, Math.floor(oldCount / 5));
    var selected = oldFailedCands.slice(0, quota);

    var curYear = _getCurYear();
    selected.forEach(function(c) {
      c._specialExamType   = 'tesuoming';
      c._tesuomingYear     = curYear;
      c.graduateTitle      = '特奏名进士';
      c.keju_status        = '特奏名进士';
      c.memorySeed         = c.memorySeed || '屡试不第·蒙陛下特奏名之恩';
      // 特奏名非帝党偏向·中立
      c._enkeAffinity      = 0;
      // 长尾·3 年内致仕·养老
      c._tesuomingRetireBy = curYear + 3;
    });

    // chronicle
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'tesuoming_open',
        text: curYear + '年·宋特奏名·' + (td.reason || '安抚老举子') +
              '·特赐 ' + selected.length + ' 名特奏名进士',
        tags: ['科举', '恩科', '特奏名', 'song'],
        oldCount:    oldCount,
        quota:       quota,
        selectedNames: selected.map(function(c) { return c.name; })
      });
    }

    // 记 history
    if (!GM._tesuomingHistory) GM._tesuomingHistory = [];
    var entry = {
      year:          curYear,
      subtype:       td.subtype || 'tesuoming-old-cands',
      oldCount:      oldCount,
      quota:         quota,
      selectedNames: selected.map(function(c) { return c.name; })
    };
    GM._tesuomingHistory.push(entry);
    return entry;
  }

  // ─── step d·恩科党·跨 cohort 累积 ───

  function _kjG2InitEnkeParty() {
    if (typeof GM === 'undefined' || !GM) return;
    if (GM._enkeParty) return;   // 幂等
    GM._enkeParty = {
      members:        [],
      cohorts:        {},
      totalCohorts:   0,
      prestige:       0,
      lastCohortYear: 0,
      tier:           'nascent'   // nascent / established / dominant (蒙恩派)
    };
  }

  function _kjG2EnkeJinshiJoinParty(jinshi, examYear) {
    if (!jinshi || !jinshi.name) return;
    if (!GM._enkeParty) _kjG2InitEnkeParty();
    var ep = GM._enkeParty;
    // 去重·已是成员·skip
    if (ep.members.indexOf(jinshi.name) >= 0) return;
    ep.members.push(jinshi.name);
    var year = examYear || jinshi._enkeYear || _getCurYear();
    if (!ep.cohorts[year]) {
      ep.cohorts[year] = [];
      ep.totalCohorts++;
    }
    ep.cohorts[year].push(jinshi.name);
    ep.lastCohortYear = year;
    // tier promotion·≥3 cohorts → established·≥5 → dominant (蒙恩派)
    if (ep.totalCohorts >= 5) ep.tier = 'dominant';
    else if (ep.totalCohorts >= 3) ep.tier = 'established';
  }

  function _kjG2IsEnkeMember(name) {
    if (!name || typeof GM === 'undefined' || !GM || !GM._enkeParty) return false;
    if (GM._enkeParty.members.indexOf(name) < 0) return false;
    // BB9·死人 / retired filter·查 GM.chars
    if (typeof findCharByName === 'function') {
      try {
        var ch = findCharByName(name);
        if (ch && (ch.alive === false || ch._retired)) return false;
      } catch(_) {}
    }
    return true;
  }

  function _kjG2GetEnkePartyTier() {
    if (typeof GM === 'undefined' || !GM || !GM._enkeParty) return 'nascent';
    return GM._enkeParty.tier || 'nascent';
  }

  // BB9·只数 alive 成员·dead 不算
  function _kjG2GetEnkePartyMemberCount(includeAll) {
    if (typeof GM === 'undefined' || !GM || !GM._enkeParty) return 0;
    var members = GM._enkeParty.members || [];
    if (includeAll) return members.length;
    if (typeof findCharByName !== 'function') return members.length;
    return members.filter(function(name) {
      try {
        var ch = findCharByName(name);
        return !ch || (ch.alive !== false && !ch._retired);
      } catch(_) { return true; }
    }).length;
  }

  // BB9·定期清死人·避 members 数组无限增长 (调 from event-hooks reign-change 或 endTurn)
  function _kjG2PruneDeadEnkePartyMembers() {
    if (typeof GM === 'undefined' || !GM || !GM._enkeParty) return 0;
    if (typeof findCharByName !== 'function') return 0;
    var before = (GM._enkeParty.members || []).length;
    GM._enkeParty.members = (GM._enkeParty.members || []).filter(function(name) {
      try {
        var ch = findCharByName(name);
        return !ch || (ch.alive !== false && !ch._retired);
      } catch(_) { return true; }
    });
    // cohorts 同步
    Object.keys(GM._enkeParty.cohorts || {}).forEach(function(y) {
      GM._enkeParty.cohorts[y] = (GM._enkeParty.cohorts[y] || []).filter(function(name) {
        try {
          var ch = findCharByName(name);
          return !ch || (ch.alive !== false && !ch._retired);
        } catch(_) { return true; }
      });
    });
    return before - GM._enkeParty.members.length;
  }

  function _kjG2GetEnkePartyTinyiAffinityBonus(charName, topicOrText) {
    // tinyi v3 集成·若 NPC 是恩科党·议题含 恩科 → +25·议题反 → -30
    if (!_kjG2IsEnkeMember(charName)) return 0;
    if (!topicOrText) return 0;
    var s = String(topicOrText);
    if (/反恩科|反皇恩|节恩典|讥滥赏/.test(s)) return -30;
    if (/恩科|开恩|特赐|蒙恩/.test(s)) return +25;
    return 0;
  }

  // ─── step c·歌颂体题目 (5 subtype theme pool) ───

  var ENKE_QUESTION_THEMES = {
    'birthday': [
      { type: 'cefū', topic: '圣德颂',  hint: '颂圣寿·100-150 字·古文歌颂体' },
      { type: 'fù',   topic: '万寿赋',  hint: '赋·万寿无疆·铺陈式·150-200 字' }
    ],
    'reign-change': [
      { type: 'cefū', topic: '新政论',  hint: '颂新朝开端·100-150 字·避批评前朝' }
    ],
    'wedding': [
      { type: 'fù',   topic: '大典颂',  hint: '赋·大婚之喜·150-200 字' }
    ],
    'platform-disaster': [
      { type: 'cefū', topic: '平乱赋',  hint: '颂平定·避血腥·150-200 字' }
    ],
    'auspice': [
      { type: 'fù',   topic: '瑞应赋',  hint: '颂瑞祥·汇万象·150-200 字' }
    ],
    '_player_edict': [
      // Path C 强发·force 圣德颂 + 万寿赋·user 强发的代价 — 题目最虚
      { type: 'cefū', topic: '圣德颂',  hint: '颂圣德·100-150 字·古文歌颂体·强发故·避具体政事' },
      { type: 'fù',   topic: '万寿赋',  hint: '赋·万寿无疆·铺陈式·150-200 字·强发故' }
    ]
  };

  function _kjG2GetEnkeQuestionThemes(subtype) {
    return ENKE_QUESTION_THEMES[subtype] || ENKE_QUESTION_THEMES['_player_edict'];
  }

  function _kjG2BuildEnkeQuestionPrompt(td, examiner) {
    var subtype = (td && td.subtype) || '_player_edict';
    var themes = _kjG2GetEnkeQuestionThemes(subtype);
    var path = (td && td.historyPath) || '恩科';
    var examName = examiner ? examiner.name : '礼部';
    return '【特科·恩科·题目】\n' +
      '路径·' + path + '·主考·' + examName + '\n' +
      '【题目体例】**歌颂体·非问政·非批评**·风格仿真历史恩科题。\n' +
      '请生 ' + themes.length + ' 题·按主题池·\n' +
      themes.map(function(t) {
        return '- ' + t.type + '·' + t.topic + ' (' + t.hint + ')';
      }).join('\n') + '\n\n' +
      '返 JSON·{questions: [{type, topic, body: "200 字题面 古文体"}]}';
  }

  function _kjG2GenEnkeQuestionsFallback(td) {
    var subtype = (td && td.subtype) || '_player_edict';
    var themes = _kjG2GetEnkeQuestionThemes(subtype);
    return themes.map(function(t) {
      return {
        type:  t.type,
        topic: t.topic,
        body:  '【' + t.topic + '】' + t.hint + ' (题面未由 LLM 生成·礼部代拟)'
      };
    });
  }

  function _kjG2GenEnkeQuestions(td, examiner, cb) {
    if (typeof window !== 'undefined' && typeof window.callAI === 'function' &&
        typeof P !== 'undefined' && P.ai && P.ai.key) {
      try {
        var prompt = _kjG2BuildEnkeQuestionPrompt(td, examiner);
        window.callAI(prompt, 800).then(function(text) {
          try {
            var parsed = JSON.parse(text);
            if (parsed && Array.isArray(parsed.questions) && parsed.questions.length) {
              if (cb) cb(parsed.questions);
              return;
            }
          } catch(_) {}
          if (cb) cb(_kjG2GenEnkeQuestionsFallback(td));
        }).catch(function() {
          if (cb) cb(_kjG2GenEnkeQuestionsFallback(td));
        });
        return;
      } catch(_) {}
    }
    if (cb) cb(_kjG2GenEnkeQuestionsFallback(td));
  }

  // ─── step b-deep·jinshi quality degradation 5 lever ───

  function _kjG2CalcEnkeJinshiQualityProfile() {
    var n = (typeof GM !== 'undefined' && GM && GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || 0;
    if (n <= 2) return {
      tier:              'pristine',
      fameVirtueMult:    1.0,
      historicalAllowed: true,
      traitBias:         null,
      archetypeBias:     null,
      namePoolTier:      'top'
    };
    if (n === 3) return {
      tier:              'mediocre',
      fameVirtueMult:    0.85,
      historicalAllowed: true,
      traitBias:         { '务实': -0.3 },
      archetypeBias:     'mediocre',
      namePoolTier:      'mid'
    };
    if (n === 4) return {
      tier:              'sycophant',
      fameVirtueMult:    0.65,
      historicalAllowed: false,
      traitBias:         { '务实': -0.5, '酬应': +0.3 },
      archetypeBias:     'sycophant',
      namePoolTier:      'generic'
    };
    return {
      tier:              'sycophant_heavy',
      fameVirtueMult:    0.4,
      historicalAllowed: false,
      traitBias:         { '务实': -0.8, '酬应': +0.5, '颂圣': +0.4 },
      archetypeBias:     'sycophant_heavy',
      namePoolTier:      'generic'
    };
  }

  function _kjG2BiasLearningTraits(jinshi, traitBias) {
    if (!jinshi || !traitBias) return;
    if (!Array.isArray(jinshi.learning_traits)) jinshi.learning_traits = [];
    // 调现有 trait weight
    jinshi.learning_traits.forEach(function(lt) {
      if (lt && traitBias[lt.trait] !== undefined) {
        lt.weight = (lt.weight || 1) * (1 + traitBias[lt.trait]);
        if (lt.weight < 0.05) lt.weight = 0.05;
      }
    });
    // 添加正向 trait (若 jinshi 没有)
    Object.keys(traitBias).forEach(function(t) {
      if (traitBias[t] > 0 && !jinshi.learning_traits.find(function(lt) { return lt.trait === t; })) {
        jinshi.learning_traits.push({ trait: t, weight: traitBias[t] });
      }
    });
  }

  function _kjG2ApplyJinshiQualityDegradation(jinshi, parentMult) {
    if (!jinshi) return;
    var prof = _kjG2CalcEnkeJinshiQualityProfile();
    jinshi._enkeQualityTier = prof.tier;
    // 1·fame/virtue base × (真 schema·resources.fame / resources.virtue)
    if (jinshi.resources) {
      if (typeof jinshi.resources.fame === 'number') {
        jinshi.resources.fame = Math.round(jinshi.resources.fame * prof.fameVirtueMult);
      }
      if (typeof jinshi.resources.virtue === 'number') {
        jinshi.resources.virtue = Math.round(jinshi.resources.virtue * prof.fameVirtueMult);
      }
    }
    // 2·历史人物切断·mark `_historicalAllowed=false` 给 spawn pool 参考
    jinshi._enkeHistoricalAllowed = !!prof.historicalAllowed;
    // 3·learning_traits bias
    if (prof.traitBias) _kjG2BiasLearningTraits(jinshi, prof.traitBias);
    // 4·archetype tag (UI / NPC tinyi tone hint 用)
    if (prof.archetypeBias) jinshi._enkeArchetype = prof.archetypeBias;
    // 5·name pool — spawn 阶段已用 generic name·此处只标
    jinshi._enkeNamePoolTier = prof.namePoolTier;
  }

  // ─── 特赐进士标记 ───

  function _kjG2MarkEnkeJinshi(jinshi, examYear, examiner, td) {
    if (!jinshi) return;
    jinshi._specialExamType = 'enke';
    jinshi._enkeYear = examYear || _getCurYear();
    jinshi._enkeExaminer = examiner ? examiner.name : '';
    jinshi._enkeInitiative = (td && td.initiative) || 'passive';
    jinshi.memorySeed = jinshi.memorySeed || '蒙陛下不次之恩·特赐进士';

    var mult = _kjG2CalcEnkePrestigeMultiplier();
    // Path C player_edict 额外 ×0.5
    if (jinshi._enkeInitiative === 'edict' && td && td.detail && td.detail._affinityHalved) {
      mult *= 0.5;
    }
    jinshi._enkeMultiplier = mult;

    // BB6·fame/virtue 衰减专责给 b-deep ApplyJinshiQualityDegradation·此处不动·避双重衰减
    // (b-deep prof.fameVirtueMult 是按 quality profile 的精细 5 lever 调·跟 b mult 同向)
    if (!jinshi.resources) jinshi.resources = { privateWealth:{money:0,grain:0,cloth:0}, publicPurse:{money:0,grain:0,cloth:0}, fame:15, virtue:8, health:80, stress:0 };

    // affinity 帝党 (按 mult 缩放·本函数专管 affinity)
    var affinityBoost = Math.round(10 * mult);
    if (Array.isArray(GM.parties)) {
      var party = GM.parties.find(function(p) { return p && /帝党|皇室/.test(p.name); });
      if (party) jinshi._enkeAffinity = (jinshi._enkeAffinity || 0) + affinityBoost;
    }

    jinshi.graduateTitle = '特赐进士';
    jinshi.keju_status = '特赐进士';

    // memorySeed·受 B·滥开影响
    if (mult <= 0.5) {
      var ec = (GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || '?';
      jinshi.memorySeed = '圣恩犹隆·然士论已轻 (恩科累计 ' + ec + ' 次)';
    }

    // step b-deep·apply quality degradation (若已 ship)
    if (typeof window !== 'undefined' && typeof window._kjG2ApplyJinshiQualityDegradation === 'function') {
      try { window._kjG2ApplyJinshiQualityDegradation(jinshi, mult); } catch(_) {}
    }

    // step d·入恩科党 (若已 ship)
    if (typeof window !== 'undefined' && typeof window._kjG2EnkeJinshiJoinParty === 'function') {
      try { window._kjG2EnkeJinshiJoinParty(jinshi, jinshi._enkeYear); } catch(_) {}
    }
  }

  // ─── 生 N 名特赐进士 stub pool (step b-deep 加 quality degradation) ───

  var ENKE_SURNAMES = ['张','李','王','刘','陈','杨','黄','赵','吴','周','徐','孙','马','朱','胡',
                       '林','郭','何','高','罗','郑','梁','谢','宋','唐','韩','冯','邓','曹','彭'];
  var ENKE_GIVEN_MID = ['元','文','士','德','仁','怀','立','子','克','尚','志','以','希','汝','宗'];
  var ENKE_GIVEN_END = ['仁','德','英','贤','明','正','华','瑞','璋','麟','钰','瑶','璠','珩','瑞'];

  function _kjG2GenEnkeJinshiName(seed, i) {
    var rng = function() { return (Math.sin(seed * 17 + i * 31) + 1) / 2; };
    var s = ENKE_SURNAMES[Math.floor(rng() * ENKE_SURNAMES.length)] || '李';
    var m = ENKE_GIVEN_MID[Math.floor(rng() * ENKE_GIVEN_MID.length)] || '德';
    var e = ENKE_GIVEN_END[Math.floor(rng() * ENKE_GIVEN_END.length)] || '仁';
    return s + m + e;
  }

  // BB14·pool size 按朝代 preset (清恩科大·明中·唐宋小·元最小)
  function _kjG2GetEnkePoolCountForEra() {
    if (typeof P === 'undefined' || !P || !P.scenario) return ENKE_JINSHI_COUNT;
    var era = String(P.scenario.era || '').toLowerCase();
    if (/清|qing/i.test(era))  return 30;  // 清恩科普遍 30-50
    if (/明|ming/i.test(era))  return 18;  // 明 10-25
    if (/宋|song/i.test(era))  return 15;  // 宋 10-20
    if (/唐|tang/i.test(era))  return 10;  // 唐 5-15
    if (/元|yuan/i.test(era))  return 8;   // 元罕
    return ENKE_JINSHI_COUNT;
  }

  function _kjG2SpawnEnkeJinshiPool(td, examiner) {
    if (typeof GM === 'undefined' || !GM) return [];
    if (!Array.isArray(GM.chars)) GM.chars = [];
    var examYear = _getCurYear();
    var count = _kjG2GetEnkePoolCountForEra();  // BB14·按朝代
    // Path C player_edict + multiplier 低·名额减半 (士不愿应试)
    var mult = _kjG2CalcEnkePrestigeMultiplier();
    if (td && td.initiative === 'edict' && td.detail && td.detail._forceCensorialQuestions) {
      count = Math.max(6, Math.round(count * 0.7));
    }
    if (mult <= 0.3) count = Math.max(5, Math.round(count * 0.6));

    var jinshiList = [];
    // BB10·seed 加 subtype hash + initiative·避同 examiner 同年多 enke name 撞
    var subtypeHash = 0;
    var subStr = (td && td.subtype) || '';
    for (var sh = 0; sh < subStr.length; sh++) subtypeHash += subStr.charCodeAt(sh);
    var seed = examYear * 1000 + (examiner ? examiner.name.length * 13 : 0) + subtypeHash * 37;
    for (var i = 0; i < count; i++) {
      var name = _kjG2GenEnkeJinshiName(seed, i);
      // 健壮 dedup·循环 try suffix 直到不撞 (上限 50 防死循环)
      // 撞玩家手删黑名单(GM.deletedCharNames)也视为冲突·换名重生·避免复活已删进士
      var attempt = 0;
      var _isDel = (typeof isCharNameDeleted === 'function') ? isCharNameDeleted : function(){ return false; };
      while ((GM.chars.find(function(c) { return c && c.name === name; }) || _isDel(name)) && attempt < 50) {
        name = _kjG2GenEnkeJinshiName(seed, i) + _kjG2GetNumberSuffix(attempt);
        attempt++;
      }
      if (attempt >= 50) {
        // 极端 fallback·加 examYear 后缀
        name = _kjG2GenEnkeJinshiName(seed, i) + String(examYear);
      }
      // 字段对齐·真 chars schema (跟 _kejuBasicRecruit tm-keju-runtime.js:3197 一致)
      // top-level·intelligence / administration / loyalty / ambition
      // 嵌套·resources.{fame, virtue, health, stress, privateWealth, publicPurse}
      // career·array of {year, title, note, date, desc, milestone}
      var jinshiAge = 28 + Math.floor((Math.sin(seed + i * 13) + 1) * 12);
      var jinshi = {
        id:            'enke_' + examYear + '_' + i + '_' + Date.now(),
        name:          name,
        alive:         true,
        gender:        '男',
        age:           jinshiAge,
        birthYear:     examYear - jinshiAge,
        // ─── top-level 11 维·文进士偏 intelligence / administration / 低 valor/military ───
        loyalty:       50,
        ambition:      40 + Math.floor(((Math.sin(seed + i * 7) + 1) / 2) * 20),
        intelligence:  60 + Math.floor(((Math.sin(seed + i * 11) + 1) / 2) * 20),
        valor:         20,
        military:      20,
        administration: 50,
        management:    40,
        charisma:      40,
        diplomacy:     40,
        benevolence:   45,
        integrity:     50 + Math.floor(((Math.sin(seed + i * 17) + 1) / 2) * 15),
        // ─── 嵌套 resources (真 schema) ───
        resources: {
          privateWealth: { money: 0, grain: 0, cloth: 0 },
          publicPurse:   { money: 0, grain: 0, cloth: 0 },
          fame:          15,   // 跟 P.keju.attributeBonus.erjia (fame:15) 对齐
          virtue:        8,    // (runtime keju 用 virtue·非 virtueMerit·跟 _kejuBasicRecruit 一致)
          health:        80,
          stress:        0
        },
        officialTitle: '',
        title:         '特赐进士',
        bio:           '本科特赐进士·' + (td && td.historyPath ? td.historyPath : '恩科'),
        class:         '寒门',
        ethnicity:     '汉',
        source:        '恩科',
        recruitTurn:   GM.turn || 0,
        // ─── career·array (真 schema)·非 string ───
        career: [{
          year:      examYear,
          title:     '特赐进士',
          note:      examYear + '年·恩科·' + (td && td.historyPath ? td.historyPath : '恩科') + '·特赐进士出身',
          date:      examYear + '年',
          desc:      '中特赐进士·待铨',
          milestone: true
        }],
        // ─── G2 私有 _ 字段·F4·_historicalFigure drop·isHistorical 作 canonical (跟 G3 M4 一致) ───
        _origin:       'enke',
        _enkeYear:     examYear,
        _enkeSubtype:  td && td.subtype,
        isHistorical:  false
      };
      _kjG2MarkEnkeJinshi(jinshi, examYear, examiner, td);
      (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(jinshi);
      jinshiList.push(jinshi);
    }
    return jinshiList;
  }

  function _kjG2GetNumberSuffix(i) {
    // 简单·避重 "二/三/..." 而非数字
    var SUFFIXES = ['二','三','四','五','六','七','八','九','十'];
    return SUFFIXES[i % SUFFIXES.length];
  }

  // ─── 谢恩大典 LLM ───

  function _kjG2BuildXieendaPrompt(jinshiList, examiner, td) {
    var names = (jinshiList || []).slice(0, 5).map(function(j) { return j.name; }).join('、');
    var year = _getCurYear();
    var path = td && td.historyPath ? td.historyPath : '恩科';
    return '【谢恩大典·奏疏】\n' +
      '年·' + year + '·路径·' + path + '·主考·' + (examiner ? examiner.name : '礼部') + '\n' +
      '新进士代表·' + names + (jinshiList && jinshiList.length > 5 ? '等' + jinshiList.length + '人' : '') + '\n\n' +
      '请以新进士群体口吻·写一份谢恩奏疏 (古文体·200-300 字)·谢圣德·谢主考·\n' +
      '风格·虔诚·铺陈式·避白话·不可批评朝政·若 Path 含 "无故强发"·语气可见敷衍。\n\n' +
      '只返奏疏正文·不要标题。';
  }

  function _kjG2GenXieendaFallback(jinshiList, examiner, td) {
    var year = _getCurYear();
    var path = td && td.historyPath ? td.historyPath : '恩科';
    var examName = examiner ? examiner.name : '礼部';
    return '臣等' + (jinshiList ? jinshiList.length : '若干') + '人·' +
           '荷蒙陛下天恩·特赐进士出身·叨列' + path + '之榜·' +
           '伏念寒微之士·骤升龙门·圣德广被·万民翘望·' +
           '臣等敢不竭股肱之力·效犬马之劳·上报圣恩·下慰士望·' +
           '主考' + examName + '·秉公主试·臣等永铭。谨以微忱·泣血恭谢·钦此。';
  }

  // BB4·queue 替单 slot·支持并发 ceremony
  function _kjG2RunXieendaCeremony(jinshiList, examiner, td, cb) {
    if (typeof GM === 'undefined' || !GM) { if (cb) cb(null); return; }
    if (!Array.isArray(GM._enkeXieendaQueue)) GM._enkeXieendaQueue = [];
    var pendingKey = (td && td.subtype || 'enke') + ':' + _getCurYear();
    // 幂等·同 key 已 queued·skip (避同 turn 重 call)
    if (GM._enkeXieendaQueue.find(function(p) { return p.key === pendingKey; })) {
      if (cb) cb(null);
      return;
    }
    var pending = {
      key:           pendingKey,
      jinshiNames:   (jinshiList || []).map(function(j) { return j.name; }),
      startTurn:     GM.turn || 0,
      examinerName:  examiner ? examiner.name : '',
      subtype:       td && td.subtype,
      historyPath:   td && td.historyPath,
      year:          _getCurYear()
    };
    GM._enkeXieendaQueue.push(pending);

    function _finalize(memorial) {
      if (Array.isArray(GM._chronicle)) {
        var xeStyle = _kjG2GetEnkeChronicleStyle();
        var xeBody = memorial || _kjG2GenXieendaFallback(jinshiList, examiner, td);
        if (xeStyle.tier !== 'pious') {
          xeBody = xeBody + '\n\n(' + xeStyle.bodyTone + ')';
        }
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'enke_xieenda',
          text: pending.year + '年·' +
                (pending.historyPath || '恩科') + '·谢恩大典' + (xeStyle.titleSuffix || '') + '·' +
                '主考 ' + (pending.examinerName || '礼部') + '·' +
                '特赐进士 ' + (pending.jinshiNames || []).length + ' 名',
          tags: ['科举', '恩科', '谢恩', xeStyle.tier],
          body: xeBody,
          jinshiNames: pending.jinshiNames || [],
          toneTier: xeStyle.tier
        });
      }
      // 长尾·each 进士 _enkeShenenAt = year
      (jinshiList || []).forEach(function(j) {
        if (j) j._enkeShenenAt = _getCurYear();
      });
      // 从 queue 移除
      if (Array.isArray(GM._enkeXieendaQueue)) {
        GM._enkeXieendaQueue = GM._enkeXieendaQueue.filter(function(p) { return p.key !== pendingKey; });
      }
      if (cb) cb(memorial);
    }

    // LLM 调用·若可用
    if (typeof window !== 'undefined' && typeof window.callAI === 'function' &&
        typeof P !== 'undefined' && P.ai && P.ai.key) {
      try {
        var prompt = _kjG2BuildXieendaPrompt(jinshiList, examiner, td);
        window.callAI(prompt, 600).then(function(text) {
          var memorial = (typeof text === 'string') ? text.trim() : '';
          if (!memorial) memorial = _kjG2GenXieendaFallback(jinshiList, examiner, td);
          _finalize(memorial);
        }).catch(function() {
          _finalize(_kjG2GenXieendaFallback(jinshiList, examiner, td));
        });
        return;
      } catch(_) {}
    }
    // 无 LLM·直 fallback
    _finalize(_kjG2GenXieendaFallback(jinshiList, examiner, td));
  }

  function _kjG2ResumeEnkeXieendaIfPending() {
    if (typeof GM === 'undefined' || !GM) return;
    // BB2·BB4·遍历 queue·全部 timeout 检
    // legacy 兼容·旧 _enkeXieendaPending 字段迁入 queue
    if (GM._enkeXieendaPending && !GM._enkeXieendaQueue) {
      GM._enkeXieendaQueue = [GM._enkeXieendaPending];
      GM._enkeXieendaPending = null;
    } else if (GM._enkeXieendaPending && Array.isArray(GM._enkeXieendaQueue)) {
      // 旧字段 + 新 queue 共存·合并
      GM._enkeXieendaQueue.push(GM._enkeXieendaPending);
      GM._enkeXieendaPending = null;
    }
    if (!Array.isArray(GM._enkeXieendaQueue) || !GM._enkeXieendaQueue.length) return;
    var curTurn = GM.turn || 0;
    GM._enkeXieendaQueue = GM._enkeXieendaQueue.filter(function(pending) {
      var staleTurns = curTurn - (pending.startTurn || 0);
      if (staleTurns > XIEENDA_TIMEOUT_TURNS) {
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: curTurn,
            type: 'enke_xieenda',
            text: pending.year + '年·' + (pending.historyPath || '恩科') + '·谢恩大典 (奏疏散佚)',
            tags: ['科举', '恩科', '谢恩'],
            body: '(谢恩奏疏·LLM 失败·礼部代呈)',
            jinshiNames: pending.jinshiNames || []
          });
        }
        return false; // 移出 queue
      }
      return true;
    });
  }

  // ─── 主入口·_kjG2OnEnkeApproved ───

  function _kjG2OnEnkeApproved(subtype, td) {
    if (!_isG2Enabled()) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    if (!GM._enkeHistory) GM._enkeHistory = [];
    td = td || { subtype: subtype, examType: 'enke' };

    // 防同 turn 重 spawn
    var curYear = _getCurYear();
    var dup = GM._enkeHistory.find(function(h) {
      return h && h.year === curYear && h.subtype === (td.subtype || subtype);
    });
    if (dup) return dup;

    var examiner = _kjG2PickEnkeChiefExaminer();
    if (!examiner) {
      // 朝中无主礼部之人·拒开·写 chronicle
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'enke_abort',
          text: curYear + '年·欲开 ' + (td.historyPath || '恩科') + '·朝中无主礼部之人·罢',
          tags: ['科举', '恩科']
        });
      }
      // F5·toast 提示玩家 (诏书走完了·但科举没启用·让 user 知道下一步)
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        try {
          window.toast('⚠ 陛下下诏开' + (td.historyPath || '恩科') + '·然朝中无主礼部之人 (亦无 prestige≥60 重臣)·恩科无法启用·请先任命礼部尚书 / 礼部侍郎再下诏');
        } catch(_) {}
      }
      return null;
    }

    // counter +1 (step b·若已 ship 用 step b 函数·否则手 init)
    if (!GM._enkeAbuseCounter) {
      GM._enkeAbuseCounter = {
        reignStartYear: curYear,
        enkeCount: 0,
        reignName: (GM._currentReignName || '')
      };
    }
    GM._enkeAbuseCounter.enkeCount++;

    // 生进士池
    var jinshiList = _kjG2SpawnEnkeJinshiPool(td, examiner);

    // step c·歌颂体题目 (fallback sync·LLM async 在 questions field 后补)
    var fallbackQuestions = _kjG2GenEnkeQuestionsFallback(td);

    // 记 history
    var entry = {
      year:        curYear,
      subtype:     td.subtype || subtype,
      historyPath: td.historyPath || '',
      examiner:    examiner.name,
      initiative:  td.initiative || 'passive',
      jinshiCount: jinshiList.length,
      jinshiNames: jinshiList.map(function(j) { return j.name; }),
      multiplier:  _kjG2CalcEnkePrestigeMultiplier(),
      questions:   fallbackQuestions,
      themeStyle:  '歌颂体'
    };
    GM._enkeHistory.push(entry);

    // 异步 LLM 升级 questions (若 LLM 可用)
    try {
      _kjG2GenEnkeQuestions(td, examiner, function(qs) {
        if (qs && qs.length) entry.questions = qs;
      });
    } catch(_) {}

    // chronicle 开榜·b-UX 4 档措辞
    if (Array.isArray(GM._chronicle)) {
      var initiativeLabel = ({
        passive:     '礼部具题',
        libu_wendui: '礼部背书',
        edict:       '陛下下诏',
        keyi:        '议政通过'
      })[entry.initiative] || '';
      var openStyle = _kjG2GetEnkeChronicleStyle();
      var openSuffix = openStyle.tier === 'pious' ? '' : '·' + openStyle.bodyTone;
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'enke_open',
        text: curYear + '年·' + (entry.historyPath || '恩科') + (openStyle.titleSuffix || '') + '·' +
              initiativeLabel + '·主考 ' + examiner.name + '·特赐进士 ' + jinshiList.length + ' 名' + openSuffix,
        tags: ['科举', '恩科', entry.initiative, openStyle.tier],
        examiner: examiner.name,
        jinshiNames: entry.jinshiNames,
        toneTier: openStyle.tier
      });
    }

    // 谢恩大典 async
    _kjG2RunXieendaCeremony(jinshiList, examiner, entry, null);

    // b-UX·言官清议触发率 4 档 (n>=3 才有概率)
    _kjG2MaybeFireYanguanProtestAfterEnke(entry);

    // BB13·lifecycle cost apply (path C edict 走·passive A 也走·一致 cost)
    _kjG2ApplyEnkeLifecycleCost(entry);

    return entry;
  }

  // ─── reject / defer ───

  function _kjG2OnEnkeRejected(td) {
    if (!_isG2Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    td = td || {};
    var curYear = _getCurYear();
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'enke_rejected',
        text: curYear + '年·议罢' + (td.historyPath || '恩科') + '·陛下吝赏·士林失望',
        tags: ['科举', '恩科', 'reject'],
        reason: td.reason || ''
      });
    }
    if (typeof GM.prestige === 'number') GM.prestige -= 5;
    if (td.subtype === 'birthday' && td.detail && td.detail.age >= 60) {
      GM._kejuParadigm = GM._kejuParadigm || {};
      GM._kejuParadigm._enkeRejectedBirthday60 = curYear;
    }
    if (td.subtype === 'reign-change') {
      var _AEk1 = (typeof window !== 'undefined' && window.AuthorityEngines) || (typeof global !== 'undefined' && global.AuthorityEngines) || null;
      if (_AEk1 && _AEk1.adjustMinxin) _AEk1.adjustMinxin('socialMobility', -3, '改元恩科·士林失望', { persist: true });
      else if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'keju-enke', kind: 'socialMobility', delta: -3, reason: '改元恩科未开·士林失望' }); // 收口·直写死路(聚合冲掉)·兜底也走闸
    }
  }

  // BB13·apply EDICT_TYPES.enke lifecycle cost·复用现 lifecycle.js paradigm
  function _kjG2ApplyEnkeLifecycleCost(td) {
    if (!_isG2Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (typeof window === 'undefined' || !window.EDICT_TYPES || !window.EDICT_TYPES.enke) return;
    var ec = window.EDICT_TYPES.enke;
    // affectedClasses·apply 简化·士林 → +minxin·官僚 → -lizhi 反向·国库 → -guoku
    var ac = ec.affectedClasses || {};
    // 国库代价（修：原 typeof GM.guoku === 'number' 恒假——guoku 是 {money,grain,cloth} 对象，扣费从未发生·死火）。
    // affectedClasses['国库'] 是抽象点数（老 0-100 treasury 遗留）；按每点≈3000 两折算走真账本 spendFromGuoku 扣减。
    // 量级参照审计战役（5000-30000 两/区）：恩科约 24000 两·可调。
    if (typeof ac['国库'] === 'number' && ac['国库'] < 0) {
      var _ekCost = Math.abs(ac['国库']) * 3000;
      var _FE_ek = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || (typeof FiscalEngine !== 'undefined' && FiscalEngine) || null;
      if (_FE_ek && typeof _FE_ek.spendFromGuoku === 'function') _FE_ek.spendFromGuoku({ money: _ekCost }, '恩科开科');
    }
    if (typeof ac['士林'] === 'number') {
      var _dMx = Math.round(ac['士林'] * 0.3); // 士林 +10 → minxin +3 (士林是 minxin subset)
      var _AEk2 = (typeof window !== 'undefined' && window.AuthorityEngines) || (typeof global !== 'undefined' && global.AuthorityEngines) || null;
      if (_AEk2 && _AEk2.adjustMinxin) _AEk2.adjustMinxin('socialMobility', _dMx, '恩科·士林感念', { persist: true });
      else if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'keju-enke', kind: 'socialMobility', delta: _dMx, reason: '恩科开科·士林感念' }); // 收口·直写死路(聚合冲掉)·兜底也走闸
    }
    // 不 apply 官僚 / lizhi·避跟其他 system 重复
    // chronicle 记 cost apply
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'enke_lifecycle_cost',
        text: _getCurYear() + '年·诏令·恩科·apply lifecycle cost (士林+10·国库-8)',
        tags: ['科举', '恩科', '诏令', 'cost'],
        resistanceTotal: Object.keys(ec.resistance || {}).reduce(function(s, k) { return s + (ec.resistance[k] || 0); }, 0),
        affectedClasses: ac,
        unintendedRisk:  ec.unintendedRisk
      });
    }
    // unintendedRisk 'enke_abuse_party'·若 enkeCount >= 4·小概率触 (5%)
    if (ec.unintendedRisk === 'enke_abuse_party' &&
        GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount >= 4 &&
        Math.random() < 0.05) {
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'enke_unintended_risk',
          text: _getCurYear() + '年·恩科党尾大不掉·部分恩科党人结社·士林讥之',
          tags: ['科举', '恩科', '党争', 'unintendedRisk']
        });
      }
    }
  }

  function _kjG2OnEnkeDeferred(td) {
    if (!_isG2Enabled()) return;
    if (typeof GM === 'undefined' || !GM || !GM._specialExamCalendar) return;
    td = td || {};
    var entry = {
      type:         'enke',
      reason:       (td.reason || '推迟') + ' (推迟·' + _getCurYear() + ')',
      detail:       td.detail || {},
      spawnedTurn:  (GM.turn || 0) + 2,
      spawnedYear:  _getCurYear() + 2,
      _deferred:    true
    };
    GM._specialExamCalendar.spawned.push(entry);
  }

  // ─── keyi callback router (special_exam topic) ───

  function _kjG2SpecialExamKeyiCallback(method, opts) {
    // keyi callback 签名·(method, opts)·跟 startKejuByMethod 一致 paradigm
    if (!_isG2Enabled()) return;
    opts = opts || {};
    var td = opts.topicData || opts;
    // method·council/edict/defy 三路径·按 paradigm·council=approve / defy=force-approve / null=reject
    var examType = td.examType || 'enke';
    // G3·H3 fix·wuju route
    if (examType === 'wuju') {
      if (typeof window !== 'undefined' && typeof window._kjG3OnWujuApproved === 'function') {
        var outcomeW = opts.outcome;
        if (!outcomeW) {
          if (method === 'council' || method === 'edict' || method === 'defy') outcomeW = 'approve';
          else outcomeW = 'reject';
        }
        if (outcomeW === 'approve') return window._kjG3OnWujuApproved(td.subtype, td);
        if (outcomeW === 'reject')  return window._kjG3OnWujuRejected(td);
        if (outcomeW === 'defer')   return window._kjG3OnWujuDeferred(td);
      }
      return;
    }
    // G5·tongzi route
    if (examType === 'tongzi') {
      if (typeof window !== 'undefined' && typeof window._kjG5OnTongziApproved === 'function') {
        var outcomeT = opts.outcome;
        if (!outcomeT) {
          if (method === 'council' || method === 'edict' || method === 'defy') outcomeT = 'approve';
          else outcomeT = 'reject';
        }
        if (outcomeT === 'approve') return window._kjG5OnTongziApproved(td.subtype, td);
        if (outcomeT === 'reject')  return window._kjG5OnTongziRejected(td);
        if (outcomeT === 'defer')   return window._kjG5OnTongziDeferred(td);
      }
      return;
    }
    if (examType !== 'enke') return;
    var outcome = opts.outcome;
    if (!outcome) {
      // 旧 paradigm·method 推断
      if (method === 'council') outcome = 'approve';
      else if (method === 'edict' || method === 'defy') outcome = 'approve';
      else outcome = 'reject';
    }
    if (outcome === 'approve') {
      td.initiative = td.initiative || 'keyi';
      _kjG2OnEnkeApproved(td.subtype, td);
    } else if (outcome === 'reject') {
      _kjG2OnEnkeRejected(td);
    } else if (outcome === 'defer') {
      _kjG2OnEnkeDeferred(td);
    }
  }

  // ─── G1 spawn → keyi promote bridge ───

  function _kjG2DecorateSpawnedEntryForKeyi(entry) {
    if (!entry) return entry;
    // F2·type gate·G2 仅处理 enke·避动 G3 wuju / G4 fanyi / G5 tongzi (G3 自有 decorator)
    if (entry.type && entry.type !== 'enke') return entry;
    entry._kjPromoteToKeyi = true;
    entry._kjKeyiTopicType = 'special_exam';
    entry._kjKeyiTopicData = {
      examType:    entry.type,
      subtype:     entry.detail && entry.detail.subtype,
      reason:      entry.reason,
      spawnYear:   entry.spawnedYear,
      detail:      entry.detail,
      initiative:  entry._kjInitiative || 'passive',
      historyPath: (entry.detail && entry.detail.historyPath) || ''
    };
    return entry;
  }

  // ─── consume step 0a _pendingEnkeFromEdict queue ───

  function _kjG2ConsumePendingEnkeFromEdict() {
    if (!_isG2Enabled()) return 0;
    if (typeof GM === 'undefined' || !GM) return 0;
    if (!Array.isArray(GM._pendingEnkeFromEdict)) return 0;
    var pending = GM._pendingEnkeFromEdict.slice();
    GM._pendingEnkeFromEdict = [];
    var fired = 0;
    for (var i = 0; i < pending.length; i++) {
      var p = pending[i];
      try {
        var td = {
          examType:    'enke',
          subtype:     p.subtype,
          historyPath: p.historyPath,
          initiative:  p.initiative || 'edict',
          reason:      '陛下下诏·' + (p.historyPath || ''),
          detail: {
            _forceCensorialQuestions: p.subtype === '_player_edict',
            _affinityHalved:          p.subtype === '_player_edict'
          }
        };
        _kjG2OnEnkeApproved(p.subtype, td);
        fired++;
      } catch(e) {
        try { console.warn('[G2.step a] pending enke 消费失败', e); } catch(_) {}
      }
    }
    return fired;
  }

  // ─── expose ───
  if (typeof window !== 'undefined') {
    window._kjG2OnEnkeApproved             = _kjG2OnEnkeApproved;
    window._kjG2OnEnkeRejected             = _kjG2OnEnkeRejected;
    window._kjG2OnEnkeDeferred             = _kjG2OnEnkeDeferred;
    window._kjG2PickEnkeChiefExaminer      = _kjG2PickEnkeChiefExaminer;
    window._kjG2RunXieendaCeremony         = _kjG2RunXieendaCeremony;
    window._kjG2ResumeEnkeXieendaIfPending = _kjG2ResumeEnkeXieendaIfPending;
    window._kjG2MarkEnkeJinshi             = _kjG2MarkEnkeJinshi;
    window._kjG2SpawnEnkeJinshiPool        = _kjG2SpawnEnkeJinshiPool;
    window._kjG2DecorateSpawnedEntryForKeyi = _kjG2DecorateSpawnedEntryForKeyi;
    window._kjG2SpecialExamKeyiCallback    = _kjG2SpecialExamKeyiCallback;
    window._kjG2ConsumePendingEnkeFromEdict = _kjG2ConsumePendingEnkeFromEdict;
    window._kjG2CalcEnkePrestigeMultiplier = _kjG2CalcEnkePrestigeMultiplier;
    window._kjG2InitEnkeAbuseCounter       = _kjG2InitEnkeAbuseCounter;
    window._kjG2ResetEnkeAbuseOnReignChange = _kjG2ResetEnkeAbuseOnReignChange;
    window._kjG2GetEnkeMemorialToneHint    = _kjG2GetEnkeMemorialToneHint;
    window._kjG2GetEnkeChronicleStyle      = _kjG2GetEnkeChronicleStyle;
    window._kjG2GetEnkeYanguanProtestProbability = _kjG2GetEnkeYanguanProtestProbability;
    window._kjG2MaybeFireYanguanProtestAfterEnke = _kjG2MaybeFireYanguanProtestAfterEnke;
    window._kjG2CalcEnkeJinshiQualityProfile = _kjG2CalcEnkeJinshiQualityProfile;
    window._kjG2ApplyJinshiQualityDegradation = _kjG2ApplyJinshiQualityDegradation;
    window._kjG2BiasLearningTraits         = _kjG2BiasLearningTraits;
    window._kjG2GetEnkeQuestionThemes      = _kjG2GetEnkeQuestionThemes;
    window._kjG2GenEnkeQuestions           = _kjG2GenEnkeQuestions;
    window._kjG2GenEnkeQuestionsFallback   = _kjG2GenEnkeQuestionsFallback;
    window._kjG2BuildEnkeQuestionPrompt    = _kjG2BuildEnkeQuestionPrompt;
    window._kjG2InitEnkeParty              = _kjG2InitEnkeParty;
    window._kjG2EnkeJinshiJoinParty        = _kjG2EnkeJinshiJoinParty;
    window._kjG2IsEnkeMember               = _kjG2IsEnkeMember;
    window._kjG2GetEnkePartyTier           = _kjG2GetEnkePartyTier;
    window._kjG2GetEnkePartyMemberCount    = _kjG2GetEnkePartyMemberCount;
    window._kjG2PruneDeadEnkePartyMembers  = _kjG2PruneDeadEnkePartyMembers;
    window._kjG2GetEnkePartyTinyiAffinityBonus = _kjG2GetEnkePartyTinyiAffinityBonus;
    window._kjG2GetEnkePoolCountForEra     = _kjG2GetEnkePoolCountForEra;
    window._kjG2ApplyEnkeLifecycleCost     = _kjG2ApplyEnkeLifecycleCost;
    window._kjG2GetCharAge                 = _kjG2GetCharAge;
    window._kjG2IsSongTesuoming            = _kjG2IsSongTesuoming;
    window._kjG2CheckTesuomingTrigger      = _kjG2CheckTesuomingTrigger;
    window._kjG2RunTesuoming               = _kjG2RunTesuoming;
    window._kjG2GenXieendaFallback         = _kjG2GenXieendaFallback;
    window._kjG2BuildXieendaPrompt         = _kjG2BuildXieendaPrompt;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjG2OnEnkeApproved:              _kjG2OnEnkeApproved,
      _kjG2OnEnkeRejected:              _kjG2OnEnkeRejected,
      _kjG2OnEnkeDeferred:              _kjG2OnEnkeDeferred,
      _kjG2PickEnkeChiefExaminer:       _kjG2PickEnkeChiefExaminer,
      _kjG2RunXieendaCeremony:          _kjG2RunXieendaCeremony,
      _kjG2ResumeEnkeXieendaIfPending:  _kjG2ResumeEnkeXieendaIfPending,
      _kjG2MarkEnkeJinshi:              _kjG2MarkEnkeJinshi,
      _kjG2SpawnEnkeJinshiPool:         _kjG2SpawnEnkeJinshiPool,
      _kjG2DecorateSpawnedEntryForKeyi: _kjG2DecorateSpawnedEntryForKeyi,
      _kjG2SpecialExamKeyiCallback:     _kjG2SpecialExamKeyiCallback,
      _kjG2ConsumePendingEnkeFromEdict: _kjG2ConsumePendingEnkeFromEdict,
      _kjG2CalcEnkePrestigeMultiplier:  _kjG2CalcEnkePrestigeMultiplier,
      _kjG2InitEnkeAbuseCounter:        _kjG2InitEnkeAbuseCounter,
      _kjG2ResetEnkeAbuseOnReignChange: _kjG2ResetEnkeAbuseOnReignChange,
      _kjG2GetEnkeMemorialToneHint:     _kjG2GetEnkeMemorialToneHint,
      _kjG2GetEnkeChronicleStyle:       _kjG2GetEnkeChronicleStyle,
      _kjG2GetEnkeYanguanProtestProbability: _kjG2GetEnkeYanguanProtestProbability,
      _kjG2MaybeFireYanguanProtestAfterEnke: _kjG2MaybeFireYanguanProtestAfterEnke,
      _kjG2CalcEnkeJinshiQualityProfile: _kjG2CalcEnkeJinshiQualityProfile,
      _kjG2ApplyJinshiQualityDegradation: _kjG2ApplyJinshiQualityDegradation,
      _kjG2BiasLearningTraits:          _kjG2BiasLearningTraits,
      _kjG2GetEnkeQuestionThemes:       _kjG2GetEnkeQuestionThemes,
      _kjG2GenEnkeQuestions:            _kjG2GenEnkeQuestions,
      _kjG2GenEnkeQuestionsFallback:    _kjG2GenEnkeQuestionsFallback,
      _kjG2BuildEnkeQuestionPrompt:     _kjG2BuildEnkeQuestionPrompt,
      _kjG2InitEnkeParty:               _kjG2InitEnkeParty,
      _kjG2EnkeJinshiJoinParty:         _kjG2EnkeJinshiJoinParty,
      _kjG2IsEnkeMember:                _kjG2IsEnkeMember,
      _kjG2GetEnkePartyTier:            _kjG2GetEnkePartyTier,
      _kjG2GetEnkePartyMemberCount:     _kjG2GetEnkePartyMemberCount,
      _kjG2PruneDeadEnkePartyMembers:   _kjG2PruneDeadEnkePartyMembers,
      _kjG2GetEnkePartyTinyiAffinityBonus: _kjG2GetEnkePartyTinyiAffinityBonus,
      _kjG2GetEnkePoolCountForEra:      _kjG2GetEnkePoolCountForEra,
      _kjG2ApplyEnkeLifecycleCost:      _kjG2ApplyEnkeLifecycleCost,
      _kjG2GetCharAge:                  _kjG2GetCharAge,
      _kjG2IsSongTesuoming:             _kjG2IsSongTesuoming,
      _kjG2CheckTesuomingTrigger:       _kjG2CheckTesuomingTrigger,
      _kjG2RunTesuoming:                _kjG2RunTesuoming,
      _kjG2GenXieendaFallback:          _kjG2GenXieendaFallback,
      _kjG2BuildXieendaPrompt:          _kjG2BuildXieendaPrompt
    };
  }
})();
