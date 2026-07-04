// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-tongzi.js — Phase G·G5·童子科主 runner + 御前问对 + 抚摩大典 + 两 archetype 长尾
 *
 * paradigm·跟 G4 fanyi.js 同·更小 (G5 罕见性·1-3 人/cohort)
 *   - 自然 trigger (G1 tongzi 已 ship·5% prob·10 年 cooldown) / Path B 礼部 wendui / Path C 诏令
 *   - 1 试·御前问对 (背诵/默写/即兴)·spawn 童子进士入翰林见习
 *   - 抚摩大典 LLM·温情·皇帝亲抚发顶·赐金钏 (跟其他 3 大典风格完全不同)
 *   - 两 archetype 长尾·early_genius_died (40%/turn health -30) / late_bloomer (career +10 年)
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuG5=false 全 no-op
 *   - 神童年龄 9-14·跟 G2/G3/G4 成人 (20+) 完全不同
 *   - 童子不入党·mentor=''·不入 _discipleGraph
 *
 * Public API·
 *   _kjG5OnTongziApproved / Rejected / Deferred
 *   _kjG5PickTongziChiefExaminer
 *   _kjG5MarkTongzijinshi / SpawnTongzijinshiPool
 *   _kjG5DecorateSpawnedEntryForKeyi
 *   _kjG5InitTongziFamilies / DetectTongziFamily
 *   _kjG5RunFumoCeremony / ResumeIfPending
 *   _kjG5TongziHealthTick (long-tail)
 *   _kjG5GetTongziToneHint / ParseTongziFromEdictText / ScanCtxInputEdictsForTongzi
 *   _kjG5OnTongziApprovedViaEdict / MaybeResetCrossScenarioFields
 */
(function() {
  'use strict';

  var FUMO_TIMEOUT_TURNS = 3;
  var POOL_MIN = 1;
  var POOL_MAX = 3;
  var EARLY_GENIUS_DEATH_PROB = 0.40;  // 40%/turn health -30

  function _isG5Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuG5 !== false; // 默认开·2026-06-14·童子科解锁
  }

  function _getCurYear() {
    if (typeof GM === 'undefined' || !GM) return 0;
    return GM.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  function _logChronicleSafe(entry) {
    if (typeof _logChronicle === 'function') {
      try { _logChronicle(entry); return; } catch (_) { /* fall through */ }
    }
    if (typeof GM !== 'undefined' && GM) {
      GM._chronicle = GM._chronicle || [];
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: entry.type || 'tongzi',
        text: entry.text || '',
        tags: entry.tags || ['科举', '童子科']
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §1·主考 pick·朝代-aware (秘书省 / 翰林系)
  // ════════════════════════════════════════════════════════════════

  var TONGZI_CHIEF_EXAMINER_TITLE_REGEX = {
    tang:    /秘书省|翰林学士|国子祭酒/,
    song:    /国子监|秘书省|翰林学士|侍读学士/,
    ming:    /翰林学士|侍读|国子监|礼部尚书/,
    qing:    /翰林学士|侍讲|国子监|礼部尚书/,
    default: /翰林|秘书|国子/
  };

  function _kjG5GetChiefExaminerRegex() {
    if (typeof P === 'undefined' || !P || !P.scenario) return TONGZI_CHIEF_EXAMINER_TITLE_REGEX.default;
    var era = String(P.scenario.era || '').toLowerCase();
    if (/唐|tang/i.test(era)) return TONGZI_CHIEF_EXAMINER_TITLE_REGEX.tang;
    if (/宋|song/i.test(era)) return TONGZI_CHIEF_EXAMINER_TITLE_REGEX.song;
    if (/明|ming/i.test(era)) return TONGZI_CHIEF_EXAMINER_TITLE_REGEX.ming;
    if (/清|qing/i.test(era)) return TONGZI_CHIEF_EXAMINER_TITLE_REGEX.qing;
    return TONGZI_CHIEF_EXAMINER_TITLE_REGEX.default;
  }

  function _kjG5PickTongziChiefExaminer() {
    if (typeof GM === 'undefined' || !GM) return null;
    var chars = GM.chars || [];
    var regex = _kjG5GetChiefExaminerRegex();
    var matching = chars.filter(function(c) {
      if (!c || c.alive === false) return false;
      var t = String(c.officialTitle || c.title || '');
      return regex.test(t);
    });
    if (matching.length === 0) return null;
    matching.sort(function(a, b) { return (b.intelligence || 50) - (a.intelligence || 50); });
    return matching[0];
  }

  // ════════════════════════════════════════════════════════════════
  // §2·主入口 + reject / defer handlers
  // ════════════════════════════════════════════════════════════════

  function _kjG5OnTongziApproved(subtype, td) {
    if (!_isG5Enabled()) return;
    td = td || {};
    td.subtype = subtype || td.subtype || 'recommendation';
    var examiner = _kjG5PickTongziChiefExaminer();
    if (!examiner) {
      _logChronicleSafe({
        type: 'tongzi_no_examiner',
        text: _getCurYear() + '年·朝中无翰林学士主童子科·此次免开',
        tags: ['科举', '童子科']
      });
      // F5·toast 提示玩家 (诏书走完了·但童子科没启用)
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        try {
          window.toast('⚠ 陛下下诏开童子科·然朝中无翰林学士可主考·童子科无法启用·请先任命翰林学士再下诏');
        } catch(_) {}
      }
      return;
    }
    var pool = _kjG5SpawnTongzijinshiPool(td, examiner);
    if (!Array.isArray(pool) || pool.length === 0) return;
    // G5 v2·跨系统 wire·民心 +3*poolSize·birthplace 解额 +1 perm
    _kjG5ApplyMinxinBoostOnSpawn(pool.length);
    pool.forEach(function(tj) {
      if (tj && tj.birthplace) _kjG5ApplyQuotaBoostOnSpawn(tj.birthplace);
    });
    _kjG5RunFumoCeremony(pool, examiner, td, function() {
      _kjG5DetectTongziFamily();
    });
  }

  function _kjG5OnTongziRejected(td) {
    if (!_isG5Enabled()) return;
    _logChronicleSafe({
      type: 'tongzi_rejected',
      text: _getCurYear() + '年·议罢童子科·清议失望·' + ((td && td.reason) || '礼部默'),
      tags: ['科举', '童子科', '驳']
    });
  }

  function _kjG5OnTongziDeferred(td) {
    if (!_isG5Enabled()) return;
    GM._tongziDeferredQueue = GM._tongziDeferredQueue || [];
    GM._tongziDeferredQueue.push({ td: td, deferTurn: (GM.turn || 0) + 2 });
  }

  // ════════════════════════════════════════════════════════════════
  // §3·童子进士标记 + archetype 派生
  // ════════════════════════════════════════════════════════════════

  function _kjG5MarkTongzijinshi(tj, examYear, examiner, td, scores) {
    if (!tj) return;
    tj._specialExamType = 'tongzi';
    tj._tongziYear = examYear;
    tj._tongziExaminer = examiner ? examiner.name : '';
    tj._tongziInitiative = (td && td.initiative) || 'passive';
    tj._tongziSubtype = (td && td.subtype) || 'recommendation';
    tj._reciteScore = scores.recite || 0;
    tj._writeScore = scores.write || 0;
    tj._impromptuScore = scores.impromptu || 0;
    tj.graduateTitle = _kjG5DeriveTongziTitle(scores);
    tj.keju_status = '童子进士';
    // G5 v2·archetype 不 re-derive·若 spawn 内 already set 则保留 (init/derive 不再错位)
    if (!tj._tongziArchetype) tj._tongziArchetype = _kjG5DeriveTongziArchetype(tj);
    tj.memorySeed = '蒙陛下钦点·童子科入翰林见习·愿不负圣望';
    tj._origin = 'tongzi';
    tj.officialTitle = '翰林见习童子';
    tj.location = '京师';
    tj.stance = '见习·跟读';
    tj._careerLongTail = false;
    tj._diedYoung = false;
    // G5 v2·留位·user 钦点状态 (spawn 后 user modal 选 '留京'/'遣乡'·影响后续 archetype 漂)
    tj._tongziDecreeMode = td && td._userDecreeMode || 'default';
  }

  function _kjG5DeriveTongziTitle(scores) {
    var total = (scores.recite || 0) + (scores.write || 0) + (scores.impromptu || 0);
    if (total >= 270) return '童子进士第一名';
    if (total >= 200) return '童子进士';
    return '童子';   // 荣誉童子·非真进士衔
  }

  function _kjG5DeriveTongziArchetype(tj) {
    if (!tj.resources) return 'early_genius_died';
    if ((tj.resources.health || 80) >= 90 && (tj.resources.stress || 30) <= 20) {
      return 'late_bloomer';
    }
    return 'early_genius_died';
  }

  // ════════════════════════════════════════════════════════════════
  // §3a·G5 v2·archetype helpers
  // ════════════════════════════════════════════════════════════════

  function _kjG5GetArchetypeSpawnProfile(archetype) {
    var PROFILES = {
      early_genius_died: {
        health: [60, 75],   stress: [50, 70],
        traits: ['frail', 'high-stress'],
        stressSources: ['压力过大', '年小体弱', '学业重'],
        bioTag: '体弱'
      },
      late_bloomer: {
        health: [90, 98],   stress: [15, 25],
        traits: ['healthy', 'resilient'],
        stressSources: ['学业重'],
        bioTag: '健朗'
      },
      turned_eccentric: {
        health: [80, 92],   stress: [25, 40],
        traits: ['iconoclast', 'free-spirited'],
        stressSources: ['学业重', '思想独立·与师不合'],
        bioTag: '清狂'
      },
      burned_out: {
        health: [70, 85],   stress: [40, 60],
        traits: ['talented-but-fragile', 'high-stress'],
        stressSources: ['学业重', '心力俱疲'],
        bioTag: '颓气'
      }
    };
    return PROFILES[archetype] || PROFILES.early_genius_died;
  }

  function _kjG5DeriveInitArchetype(isHist, scores) {
    if (isHist && Math.random() < 0.75) return 'late_bloomer';
    var mode = (typeof GM !== 'undefined' && GM && GM._tongziUserDecreeMode) || 'default';
    var r = Math.random();
    if (mode === 'liujing') {
      if (r < 0.45) return 'early_genius_died';
      if (r < 0.70) return 'burned_out';
      if (r < 0.88) return 'late_bloomer';
      return 'turned_eccentric';
    }
    if (mode === 'qianxiang') {
      if (r < 0.40) return 'late_bloomer';
      if (r < 0.70) return 'turned_eccentric';
      if (r < 0.88) return 'early_genius_died';
      return 'burned_out';
    }
    if (r < 0.30) return 'early_genius_died';
    if (r < 0.55) return 'late_bloomer';
    if (r < 0.80) return 'turned_eccentric';
    return 'burned_out';
  }

  // ════════════════════════════════════════════════════════════════
  // §4·spawn pool·1-3 人 (罕见)
  // ════════════════════════════════════════════════════════════════

  // G5 v2·历史名臣 pool 扩 5→15·draw prob 15%→30%
  var HISTORICAL_TONGZIJINSHI = {
    tang:    ['李泌', '刘晏'],                                      // 李泌 7 岁见玄宗·刘晏 8 岁中神童举
    song:    ['晏殊', '朱虎臣', '寇准', '范仲淹', '王禹偁', '杨亿'],   // 晏殊 14 / 朱虎臣 9 / 寇准 14 / 王禹偁 9·楚州神童
    ming:    ['杨慎', '李东阳', '张居正'],                          // 杨慎 4 岁能背汉书 / 李东阳 8 岁神童 / 张居正 13 岁中举
    qing:    ['纪昀', '钱大昕', '邹一桂', '袁枚']                   // 纪昀 / 钱大昕 12 岁中秀才 / 袁枚 12 岁中秀才
  };

  var TONGZI_SURNAMES = ['李', '王', '张', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '朱'];
  var TONGZI_GIVEN_NAMES = ['昭', '聪', '慧', '智', '颖', '骏', '俊', '才', '彦', '清', '澄', '明'];
  var TONGZI_PROVINCES = ['江南', '浙江', '直隶', '山东', '河南', '湖广', '四川', '福建', '广东'];

  function _kjG5GenTongziName(seed, i, surname) {
    surname = surname || TONGZI_SURNAMES[(seed + i) % TONGZI_SURNAMES.length];
    return surname + TONGZI_GIVEN_NAMES[(seed * 3 + i) % TONGZI_GIVEN_NAMES.length];
  }

  function _kjG5GetEraKey() {
    if (typeof P === 'undefined' || !P || !P.scenario) return 'default';
    var era = String(P.scenario.era || '');
    if (/唐|tang/i.test(era)) return 'tang';   // G5 v2·加唐 (李泌/刘晏)
    if (/宋/.test(era)) return 'song';
    if (/明/.test(era)) return 'ming';
    if (/清/.test(era)) return 'qing';
    return 'default';
  }

  function _kjG5SpawnTongzijinshiPool(td, examiner) {
    if (typeof GM === 'undefined' || !GM) return [];
    if (!Array.isArray(GM.chars)) GM.chars = [];
    var examYear = _getCurYear();
    var seed = examYear + (GM.turn || 0);
    var rng = function() { return Math.random(); };
    var poolSize = POOL_MIN + Math.floor(rng() * (POOL_MAX - POOL_MIN + 1));
    if (td && td.subtype === '_player_edict') poolSize = 1;
    var pool = [];
    var eraKey = _kjG5GetEraKey();
    var histPool = HISTORICAL_TONGZIJINSHI[eraKey] || [];
    for (var i = 0; i < poolSize; i++) {
      var surname = TONGZI_SURNAMES[(seed + i) % TONGZI_SURNAMES.length];
      var age = 9 + Math.floor(rng() * 6);  // 9-14
      var name = _kjG5GenTongziName(seed, i, surname);
      var isHist = false;
      // 历史名臣 draw·**G5 v2·15%→30%·pool 扩 15 人**·童子科罕见·提高真历史 anchor 见率
      if (histPool.length > 0 && i === 0 && Math.random() < 0.30) {
        var used = (GM.chars || []).map(function(c) { return c && c.name; });
        var avail = histPool.filter(function(n) { return used.indexOf(n) === -1; });
        if (avail.length > 0) {
          name = avail[Math.floor(Math.random() * avail.length)];
          isHist = true;
        }
      }
      var scores = {
        recite:    70 + Math.floor(rng() * 30),
        write:     65 + Math.floor(rng() * 30),
        impromptu: 60 + Math.floor(rng() * 30)
      };
      if (isHist) {
        scores.recite = Math.min(100, scores.recite + 15);
        scores.write = Math.min(100, scores.write + 15);
        scores.impromptu = Math.min(100, scores.impromptu + 15);
      }
      // G5 v2·archetype 派生扩 4 类·按 user 钦点 (_kjG5UserDecreeMode) + 历史名臣 + 出题表现
      // 历史名臣 75% late_bloomer (历史上确实长寿成大才)·非历史名臣按 mode
      var initArchetype = _kjG5DeriveInitArchetype(isHist, scores);
      var tj = {
        id:        'tongzi_' + examYear + '_' + i + '_' + Date.now(),
        name:      name,
        age:       age,
        gender:    '男',
        birthYear: examYear - age,
        birthplace: TONGZI_PROVINCES[Math.floor(rng() * TONGZI_PROVINCES.length)],
        ethnicity: '汉',
        faith:     '儒',
        culture:   '汉',
        learning:  '童子科·御前问对',
        appearance: '童子·身长四尺·目如朗星·言辞清越',
        diction:   '童子口吻·**"小子"自称**·应对从容',
        personality: '聪慧·害羞 / 早熟',
        location:  '京师',
        // 11 维·童子高 int/charisma·低 valor/military/administration
        loyalty:        70 + Math.floor(rng() * 20),
        ambition:       30 + Math.floor(rng() * 20),
        intelligence:   85 + Math.floor(rng() * 10),
        valor:          10 + Math.floor(rng() * 10),
        military:       10 + Math.floor(rng() * 10),
        administration: 20 + Math.floor(rng() * 20),
        management:     20 + Math.floor(rng() * 20),
        charisma:       70 + Math.floor(rng() * 20),
        diplomacy:      30 + Math.floor(rng() * 20),
        benevolence:    60 + Math.floor(rng() * 20),
        integrity:      80 + Math.floor(rng() * 15),
        resources: (function() {
          // G5 v2·4 archetype·health/stress profile
          var profile = _kjG5GetArchetypeSpawnProfile(initArchetype);
          return {
            privateWealth: { money: 50, grain: 10, cloth: 5 },
            publicPurse:   { money: 0,  grain: 0,  cloth: 0 },
            fame:          30 + Math.floor(rng() * 20),
            virtue:        50 + Math.floor(rng() * 20),
            health:        profile.health[0] + Math.floor(rng() * (profile.health[1] - profile.health[0])),
            stress:        profile.stress[0] + Math.floor(rng() * (profile.stress[1] - profile.stress[0]))
          };
        })(),
        traits: ['child:prodigy', 'literate', 'precocious'].concat(_kjG5GetArchetypeSpawnProfile(initArchetype).traits),
        faction: (typeof P !== 'undefined' && P && P.player && P.player.faction) || '',
        party: '',
        partyRank: '',
        family: surname + '氏',
        familyTier: 'commoner-prodigy',
        familyRole: '童子',
        clanPrestige: 40,
        mentor: '',
        hobbies: '诵诗·习字·闻乐',
        innerThought: '小子愿勤学·不负陛下知遇之恩。',
        personalGoal: '长成入朝·报陛下抚顶之恩',
        stressSources: _kjG5GetArchetypeSpawnProfile(initArchetype).stressSources,
        career: [{
          year:      examYear,
          title:     '童子进士',
          note:      examYear + '年·童子科·州县荐举·' + age + ' 岁赐进士',
          date:      examYear + '年',
          desc:      '童子科·入翰林见习',
          milestone: true
        }],
        rankLevel:    1,
        title:        '童子进士',
        bio:          examYear + '年童子科·' + age + ' 岁神童·' + _kjG5GetArchetypeSpawnProfile(initArchetype).bioTag,
        class:        'commoner-prodigy',
        source:       '童子科',
        recruitTurn:  GM.turn || 0,
        isHistorical: isHist,
        alive:        true,
        stance:       '见习·跟读',
        officialTitle: '翰林见习童子',
        // G5 v2·初始 archetype 直接 set·_kjG5MarkTongzijinshi 内不 re-derive
        _tongziArchetype: initArchetype
      };
      _kjG5MarkTongzijinshi(tj, examYear, examiner, td, scores);
      (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(tj);
      pool.push(tj);
    }
    GM._tongziHistory = GM._tongziHistory || [];
    GM._tongziHistory.push({
      year:    examYear,
      poolSize: pool.length,
      subtype: (td && td.subtype) || 'recommendation',
      examiner: examiner ? examiner.name : ''
    });
    return pool;
  }

  // ════════════════════════════════════════════════════════════════
  // §5·decorate spawn → keyi promote
  // ════════════════════════════════════════════════════════════════

  function _kjG5DecorateSpawnedEntryForKeyi(entry) {
    if (!entry || entry.type !== 'tongzi') return entry;
    entry._kjPromoteToKeyi = true;
    entry._kjKeyiTopicType = 'special_exam';
    entry._kjKeyiTopicData = {
      examType:    'tongzi',
      subtype:     entry.detail && entry.detail.subtype,
      reason:      entry.reason,
      spawnYear:   entry.spawnedYear,
      detail:      entry.detail,
      initiative:  entry._kjInitiative || 'passive',
      historyPath: (entry.detail && entry.detail.historyPath) || ''
    };
    return entry;
  }

  // ════════════════════════════════════════════════════════════════
  // §6·背诵默写题目
  // ════════════════════════════════════════════════════════════════

  var TONGZI_QUESTION_THEMES = {
    'recommendation': [
      { type: 'recite',    topic: '《诗经》七首',     hint: '背诗经选段·按年龄递增·9 岁 3 首·14 岁 7 首' },
      { type: 'write',     topic: '《千字文》默',     hint: '默写千字文一段·100-200 字' },
      { type: 'impromptu', topic: '即兴问对',         hint: '皇帝亲问·随机经典·神童即答' }
    ],
    '_player_edict': [
      { type: 'recite',    topic: '强发故·略背',      hint: '5 句简易' },
      { type: 'write',     topic: '强发故·略默',      hint: '50 字基础默写' },
      { type: 'impromptu', topic: '强发故·略问',      hint: '简易问对' }
    ]
  };

  function _kjG5GetTongziQuestionThemes(subtype) {
    return TONGZI_QUESTION_THEMES[subtype] || TONGZI_QUESTION_THEMES.recommendation;
  }

  function _kjG5BuildTongziQuestionPrompt(td, examiner, age) {
    var subtype = (td && td.subtype) || 'recommendation';
    var difficulty = age <= 10 ? '易' : (age <= 12 ? '中' : '难');
    var themes = _kjG5GetTongziQuestionThemes(subtype);
    return '【特科·童子科·题目】\n' +
      '主考·' + (examiner ? examiner.name : '翰林学士') + '·童子年 ' + age + '·难度 ' + difficulty + '\n' +
      '【题目体例】**童子科·背诵 + 默写 + 即兴问对**·按年龄调难·涉经典·9 岁《诗经》/ 14 岁《左传》。\n' +
      '请生 ' + themes.length + ' 题·\n' +
      themes.map(function(t) {
        return '- ' + t.type + '·' + t.topic + ' (' + t.hint + ')';
      }).join('\n') + '\n\n' +
      '返 JSON·{questions: [{type, topic, body: "100 字题面"}]}';
  }

  // ════════════════════════════════════════════════════════════════
  // §7·神童家族 (≥ 2 同姓·罕见)
  // ════════════════════════════════════════════════════════════════

  function _kjG5InitTongziFamilies() {
    if (typeof GM === 'undefined' || !GM) return;
    if (GM._tongziFamilies) return;
    GM._tongziFamilies = {
      members:      [],
      bySurname:    {},
      totalCohorts: 0
    };
  }

  function _kjG5DetectTongziFamily() {
    _kjG5InitTongziFamilies();
    var fams = GM._tongziFamilies;
    var allTongzi = (GM.chars || []).filter(function(c) { return c && c._origin === 'tongzi'; });
    var bySurname = {};
    allTongzi.forEach(function(c) {
      var s = c.name.charAt(0);
      if (!bySurname[s]) bySurname[s] = [];
      bySurname[s].push(c.name);
    });
    Object.keys(bySurname).forEach(function(s) {
      if (bySurname[s].length >= 2 && !fams.bySurname[s]) {
        fams.bySurname[s] = {
          surname: s,
          members: bySurname[s],
          formedYear: _getCurYear()
        };
        _logChronicleSafe({
          type: 'tongzi_family_formed',
          text: _getCurYear() + '年·' + s + '家神童·' + bySurname[s].join('、') + '·人称神童世家',
          tags: ['科举', '童子科', '世家']
        });
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §8·E·抚摩大典 LLM (温情体)
  // ════════════════════════════════════════════════════════════════

  function _kjG5BuildFumoCeremonyPrompt(list, examiner, td) {
    if (!list || !list.length) return '';   // M2 fix·空 guard
    var tj = list[0];
    var name = tj && tj.name;
    var age = tj && tj.age;
    return '【抚摩大典·御前问对】\n' +
      '童子·' + name + '·年 ' + age + '·主考·' + (examiner ? examiner.name : '翰林学士') + '\n\n' +
      '请以养心殿太监记口吻·写一份抚摩大典记 (温情体·150-200 字)·\n' +
      '- 描小童子御前从容应对\n' +
      '- 皇帝亲抚发顶·赐金钏 / 玉璧 / 御书匾\n' +
      '- 朝臣无不动容·叹"此真天授"\n' +
      '- 童子叩谢·眼有泪光\n' +
      '风格·**温情·亲昵·非威仪**·**跟谢恩大典 + 校阅大典 + 召见大典 完全不同**\n\n' +
      '只返抚摩记正文·不要标题。';
  }

  function _kjG5GenFumoFallback(list, examiner) {
    if (!list || !list.length) return '';
    var tj = list[0];
    return '抚摩大典·' + _getCurYear() + '年·养心殿·' + tj.name + ' 年 ' + tj.age +
           '·背诗对答从容·圣上亲抚发顶·赐金钏·朝臣动容·叹"此真天授"·童子叩谢·眼有泪光。';
  }

  function _kjG5RunFumoCeremony(list, examiner, td, cb) {
    if (!_isG5Enabled()) { if (cb) cb(); return; }
    if (!list || !list.length) { if (cb) cb(); return; }
    var prompt = _kjG5BuildFumoCeremonyPrompt(list, examiner, td);
    var pendingNames = list.map(function(j) { return j.name; });
    GM._tongziCeremonyQueue = GM._tongziCeremonyQueue || [];
    var queueEntry = {
      pending:      true,
      enqueuedTurn: GM.turn || 0,
      examYear:     _getCurYear(),
      tongziNames:  pendingNames,
      examinerName: examiner ? examiner.name : '',
      td:           td
    };
    GM._tongziCeremonyQueue.push(queueEntry);
    var done = false;
    function finalize(text) {
      if (done) return; done = true;
      queueEntry.pending = false;
      queueEntry.completedTurn = GM.turn || 0;
      _logChronicleSafe({
        type: 'tongzi_fumo',
        text: text,
        tags: ['科举', '童子科', '抚摩大典']
      });
      if (cb) cb();
    }
    if (typeof callAI === 'function') {
      try {
        callAI(prompt, function(err, text) {
          if (err || !text) { finalize(_kjG5GenFumoFallback(list, examiner)); return; }
          finalize(String(text).trim());
        });
      } catch (_) {
        finalize(_kjG5GenFumoFallback(list, examiner));
      }
    } else {
      finalize(_kjG5GenFumoFallback(list, examiner));
    }
  }

  function _kjG5ResumeFumoCeremonyIfPending() {
    if (!_isG5Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!Array.isArray(GM._tongziCeremonyQueue)) return;
    var curTurn = GM.turn || 0;
    GM._tongziCeremonyQueue.forEach(function(entry) {
      if (!entry || !entry.pending) return;
      if ((curTurn - (entry.enqueuedTurn || 0)) < FUMO_TIMEOUT_TURNS) return;
      entry.pending = false;
      entry.completedTurn = curTurn;
      var list = (entry.tongziNames || []).map(function(nm) {
        return (GM.chars || []).find(function(c) { return c && c.name === nm; });
      }).filter(Boolean);
      _logChronicleSafe({
        type: 'tongzi_fumo',
        text: _kjG5GenFumoFallback(list, { name: entry.examinerName }),
        tags: ['科举', '童子科', '抚摩大典', 'fallback']
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §9·F·long-tail health tick (early_genius_died 40%/turn -30)
  // ════════════════════════════════════════════════════════════════

  // G5 v2·healthTick 扩 4 archetype·钦点 mode 漂移
  // early_genius_died: 40%/turn -30 health 殁
  // late_bloomer: health 不变·career +10 年·50 岁真入会试 hook
  // turned_eccentric: 15-25 岁 5% prob 拒朝官入山长 lineage (H wire)
  // burned_out: 20-30 岁 8% prob 才尽辍考·officialTitle 改 X 县学正
  var TURNED_ECCENTRIC_PROB = 0.05;   // per turn·age 15-25 时
  var BURNED_OUT_PROB       = 0.08;   // per turn·age 20-30 时
  var LATE_BLOOMER_HUISHI_AGE = 50;   // late_bloomer 50 岁入会试

  function _kjG5TongziHealthTick() {
    if (!_isG5Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    (GM.chars || []).forEach(function(c) {
      if (!c || c.alive === false) return;
      if (c._origin !== 'tongzi') return;
      var curY = GM.year || 0;
      var age = curY - (c.birthYear || 0);
      var arch = c._tongziArchetype;
      if (arch === 'early_genius_died') {
        if (Math.random() < EARLY_GENIUS_DEATH_PROB) {
          if (!c.resources) return;
          c.resources.health = Math.max(0, (c.resources.health || 80) - 30);
          if (c.resources.health <= 0) {
            c.alive = false;
            c._diedYoung = true;
            _logChronicleSafe({
              type: 'tongzi_died_young',
              text: curY + '年·童子 ' + c.name + ' 殁·年仅 ' + age + '·英才早凋',
              tags: ['科举', '童子科', '殁']
            });
            // G5 v2·殁 → 跨系统 wire·民心 -3·礼部 affinity -5·1% F4c 言官天意 event
            _kjG5OnTongziMartyred(c);
          }
        }
      } else if (arch === 'late_bloomer') {
        c._careerLongTail = true;
        // G5 v2·50 岁真入会试·跟 G2 enke pool 联动
        if (age >= LATE_BLOOMER_HUISHI_AGE && !c._tongziEnteredHuishi) {
          _kjG5LateBloomerEnterHuishi(c);
        }
      } else if (arch === 'turned_eccentric') {
        // G5 v2·15-25 岁奇行·拒朝官·入 H 山长 lineage (若 H active)
        if (age >= 15 && age <= 25 && !c._tongziTurnedEccentric &&
            Math.random() < TURNED_ECCENTRIC_PROB) {
          _kjG5OnTongziTurnedEccentric(c);
        }
      } else if (arch === 'burned_out') {
        // G5 v2·20-30 岁才尽辍考·officialTitle 改 X 县学正
        if (age >= 20 && age <= 30 && !c._tongziBurnedOut &&
            Math.random() < BURNED_OUT_PROB) {
          _kjG5OnTongziBurnedOut(c);
        }
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §10·LLM tone hint (2 archetype)
  // ════════════════════════════════════════════════════════════════

  // G5 v2·tone 扩 4 archetype
  var TONGZI_TONES = {
    'early_genius_died': '童子口吻·**"小子"自称**·害羞 / 紧张·"小子愚见·恭请陛下教诲"·略带稚气·避之乎者也',
    'late_bloomer':      '童子口吻·**"小子"自称**·从容 / 早熟·"小子以为·圣意如此"·气定神闲·略胜其年',
    'turned_eccentric':  '童子口吻·**"小子"自称**·清狂 / 不羁·"小子无意于朝·愿事山林"·言辞奇崛·略带书院气',
    'burned_out':        '童子口吻·**"小子"自称**·黯然 / 自嘲·"小子愚钝·辜负圣恩"·语带颓气'
  };

  function _kjG5GetTongziToneHint(ch) {
    if (!ch || ch._origin !== 'tongzi') return '';
    return TONGZI_TONES[ch._tongziArchetype || 'early_genius_died'] || TONGZI_TONES.early_genius_died;
  }

  // ════════════════════════════════════════════════════════════════
  // §11·诏令 parser (Path C)
  // ════════════════════════════════════════════════════════════════

  function _kjG5ParseTongziFromEdictText(text) {
    if (!text) return null;
    // F4·放宽·加 早慧/英才科/少年科/童试·全含"童/慧/少年/才"·避撞日常奖励诏书
    if (!/童子科|神童|荐神童|童子荐举|童试|早慧|早惠|少年科|英才科/.test(text)) return null;
    // F6·negative gate·扫时政记时 AI 可能写"议罢童子科/未开/搁置"·skip
    if (/议罢童子科|罢童子科|未开童子科|停童子科|废童子科|搁置童子科|驳童子科|不准开童子科|反对童子科|拒开童子科/.test(text)) {
      return null;
    }
    var subtype = '_player_edict';
    if (/州县|荐举|藩司|府县/.test(text)) subtype = 'recommendation';
    else if (/钦点|圣恩|亲擢/.test(text)) subtype = 'royal-recognition';
    return {
      type: 'tongzi',
      category: 'tongzi',
      subtype: subtype,
      text: text,
      historyPath: ({
        'recommendation':    '州县荐举',
        'royal-recognition': '钦点神童',
        '_player_edict':     '无故强荐'
      })[subtype]
    };
  }

  function _kjG5ScanCtxInputEdictsForTongzi(edicts) {
    if (!edicts) return [];
    var out = [];
    if (typeof edicts === 'string') {
      var a = _kjG5ParseTongziFromEdictText(edicts);
      if (a) out.push(a);
    } else if (typeof edicts === 'object') {
      // F1·加 'other'·御案"其他"栏的童子科诏书也要扫
      ['political', 'military', 'diplomatic', 'economic', 'other'].forEach(function(key) {
        var t = edicts[key];
        if (t && typeof t === 'string') {
          var a2 = _kjG5ParseTongziFromEdictText(t);
          if (a2) { a2._sourceCategory = key; out.push(a2); }
        }
      });
      if (Array.isArray(edicts)) {
        edicts.forEach(function(e) {
          var t2 = (typeof e === 'string') ? e : (e && e.text);
          if (!t2) return;
          var a3 = _kjG5ParseTongziFromEdictText(t2);
          if (a3) out.push(a3);
        });
      }
    }
    return out;
  }

  function _kjG5OnTongziApprovedViaEdict(action) {
    if (!_isG5Enabled()) return;
    var td = {
      examType:    'tongzi',
      subtype:     action.subtype || '_player_edict',
      reason:      '陛下下诏·' + (action.historyPath || ''),
      initiative:  'edict',
      historyPath: action.historyPath
    };
    _kjG5OnTongziApproved(td.subtype, td);
  }

  // ════════════════════════════════════════════════════════════════
  // §12·cross-scenario reset
  // ════════════════════════════════════════════════════════════════

  function _kjG5MaybeResetCrossScenarioFields() {
    if (typeof GM === 'undefined' || !GM) return;
    if (typeof P === 'undefined' || !P || !P.scenario) return;
    // 全清·童子科罕见·跨剧本不继承
    // **G5 audit Fix 5·v2 加 4 字段** (_tongziLastAnnualY / _tongziUserDecreeMode / _tongziPlatformDisasterFired + 原 4)
    ['_tongziCeremonyQueue', '_tongziDeferredQueue', '_tongziHistory',
     '_tongziFamilies', '_tongziLastAnnualY', '_tongziUserDecreeMode',
     '_tongziPlatformDisasterFired'].forEach(function(k) {
      if (GM[k] !== undefined) delete GM[k];
    });
  }

  // L1·DEFERRED·跟 G3/G4 同
  function _kjG5GetTongziFamilyTinyiAffinityBonus(charName, topic) {
    return 0;
  }

  // ════════════════════════════════════════════════════════════════
  // §13·G5 v2·跨系统 wire (民心 / 礼部 affinity / F4c 言官 / paradigm.quota)
  // ════════════════════════════════════════════════════════════════

  /** spawn 时·民心 +3·跟 H7 paradigm 同 (天降祥瑞·儒林感) */
  function _kjG5ApplyMinxinBoostOnSpawn(poolSize) {
    if (typeof GM === 'undefined' || !GM) return;
    var delta = 3 * Math.min(poolSize, 3);   // 1 童子 +3·2 童子 +6·max +9
    // 民心走总闸(2026-07-04 守卫v3.1定罪)：vars['民心'].value=已退役镜像·直写被 aggregateTrue 冲掉=祥瑞从未落地
    if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
      try { TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'keju-tongzi', kind: 'socialMobility', delta: delta, reason: '童子科开·天降祥瑞·儒林感' }); } catch (_e) {}
    } else if (GM.vars && GM.vars['民心']) { // 沙箱兜底
      GM.vars['民心'].value = Math.min(100, (parseInt(GM.vars['民心'].value, 10) || 50) + delta);
    }
    _logChronicleSafe({
      type: 'tongzi_minxin_boost',
      text: _getCurYear() + '年·童子科开·天降祥瑞·民心 +' + delta + '·儒林感'
    });
  }

  /** 殁时·民心 -3·礼部 affinity -5·1% F4c 言官 "天意" event */
  function _kjG5OnTongziMartyred(c) {
    if (typeof GM === 'undefined' || !GM) return;
    // 同上·走总闸
    if (typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
      try { TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'keju-tongzi', kind: 'socialMobility', delta: -3, reason: '神童早殁·朝野恸惜' }); } catch (_e) {}
    } else if (GM.vars && GM.vars['民心']) { // 沙箱兜底
      GM.vars['民心'].value = Math.max(0, (parseInt(GM.vars['民心'].value, 10) || 50) - 3);
    }
    // 礼部 affinity -5
    (GM.chars || []).forEach(function(ch) {
      if (!ch || ch.alive === false) return;
      if (/礼部|翰林|国子/.test(String(ch.officialTitle || ''))) {
        ch._tongziAffinity = (ch._tongziAffinity || 0) - 5;
      }
    });
    // 1% prob trigger F4c 言官 "天降神童·非陛下不恭·实天意"
    if (typeof window !== 'undefined' && typeof window._kjSpawnYanguanQingyi === 'function' &&
        Math.random() < 0.01) {
      try {
        window._kjSpawnYanguanQingyi('清议', c.name,
          '童子' + c.name + '殁·年' + ((GM.year || 0) - (c.birthYear || 0)) +
          '·天降神童·实天意·非陛下不恭');
      } catch (_) {}
    }
  }

  /** spawn 时·birthplace 解额 +1 perm (跟 H7 prov._bonusInfra.kejuQuota paradigm 同) */
  function _kjG5ApplyQuotaBoostOnSpawn(birthplace) {
    if (typeof GM === 'undefined' || !GM) return;
    if (!birthplace) return;
    // 优先·province level (若 P.scenario 有 prov 结构)
    var found = false;
    if (typeof P !== 'undefined' && P && P.scenario && Array.isArray(P.scenario.provinces)) {
      for (var i = 0; i < P.scenario.provinces.length; i++) {
        var prov = P.scenario.provinces[i];
        if (prov && prov.name === birthplace) {
          if (!prov._bonusInfra) prov._bonusInfra = {};
          prov._bonusInfra.kejuQuota = (prov._bonusInfra.kejuQuota || 0) + 1;
          found = true;
          break;
        }
      }
    }
    // fallback·paradigm.quota.geo (跟 L7 paradigm 同)
    if (!found && GM._kejuParadigm && GM._kejuParadigm.quota) {
      if (!GM._kejuParadigm.quota.geo) GM._kejuParadigm.quota.geo = {};
      var key = /北|京|河|山东|直隶/.test(birthplace) ? '北' :
                /南|江|浙|湖广|福建|广东/.test(birthplace) ? '南' : '中';
      GM._kejuParadigm.quota.geo[key] = (GM._kejuParadigm.quota.geo[key] || 0) + 1;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §14·G5 v2·late_bloomer 50 岁真入会试 hook
  // ════════════════════════════════════════════════════════════════

  /** late_bloomer 50 岁时·真触·跟 G2 enke pool 联动·中进士率 +20% */
  function _kjG5LateBloomerEnterHuishi(c) {
    if (!c || c._tongziEnteredHuishi) return;
    c._tongziEnteredHuishi = true;
    var curY = GM.year || 0;
    // 50% prob 中进士·跟 G2 enke spawn paradigm 同 (历史晏殊后真中进士 paradigm)
    var passed = Math.random() < 0.5;
    if (passed) {
      c.graduateTitle = '童子进士·复中会试进士';
      c.career = c.career || [];
      c.career.push({
        year:      curY,
        title:     '会试进士',
        note:      curY + '年·昔年童子' + c.name + '·入会试·复中进士',
        date:      curY + '年',
        desc:      '昔年童子·五十入会试·士林叹神童得证',
        milestone: true
      });
      c.rankLevel = 3;   // 真进士 rank
      c.officialTitle = '翰林修撰';   // 升真职
      c.title = '翰林修撰';
      c._tongziHuishiPassed = true;
      // **G5 audit Fix 3·真入 G2 enke 系列联动 (非装饰 chronicle)**
      // 1·标进士字段·跟 G2 enke jinshi schema 同
      c._specialExamType = 'enke';   // 复合身份·童子 + 恩科进士
      c.keju_status = '进士·昔年童子';
      c.source = '童子科·后中会试';
      // 2·真入 G2 恩科党 (若 G2 active 且 helper exposed)
      if (typeof window !== 'undefined' && typeof window._kjG2EnkeJinshiJoinParty === 'function') {
        try { window._kjG2EnkeJinshiJoinParty(c, curY); } catch(_) {}
      }
      // 3·若 GM._enkeHistory 存·push 入历史 (让 enkeAbuseCounter / chronicle aware)
      if (GM._enkeHistory && Array.isArray(GM._enkeHistory)) {
        GM._enkeHistory.push({
          year:    curY,
          source:  'tongzi-late-bloomer',
          jinshi:  c.name,
          subtype: 'late-bloomer-conversion'
        });
      }
      _logChronicleSafe({
        type: 'tongzi_late_bloomer_passed',
        text: curY + '年·昔年童子 ' + c.name + ' 入会试·复中进士·授翰林修撰·士林叹"神童得证"',
        tags: ['科举', '童子科', '会试', '神童得证']
      });
    } else {
      c._tongziHuishiPassed = false;
      c.career = c.career || [];
      c.career.push({
        year:      curY,
        title:     '会试·不第',
        note:      curY + '年·昔年童子' + c.name + '·入会试不第',
        date:      curY + '年',
        desc:      '神童入会试·不第·士论惜之',
        milestone: true
      });
      _logChronicleSafe({
        type: 'tongzi_late_bloomer_failed',
        text: curY + '年·昔年童子 ' + c.name + ' 入会试·不第·士论惜之',
        tags: ['科举', '童子科', '会试', '不第']
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §15·G5 v2·turned_eccentric 入 H 山长 lineage (若 H active)
  // ════════════════════════════════════════════════════════════════

  function _kjG5OnTongziTurnedEccentric(c) {
    if (!c || c._tongziTurnedEccentric) return;
    c._tongziTurnedEccentric = true;
    var curY = GM.year || 0;
    c.officialTitle = '隐士·' + (c.birthplace || '山林');
    c.stance = '隐·讲学';
    c.career = c.career || [];
    c.career.push({
      year:      curY,
      title:     '隐士',
      note:      curY + '年·童子' + c.name + '·拒朝官·隐于' + (c.birthplace || '山林'),
      desc:      '清狂·不仕·开馆讲学',
      milestone: true
    });
    _logChronicleSafe({
      type: 'tongzi_turned_eccentric',
      text: curY + '年·童子 ' + c.name + ' 弃官隐 ' + (c.birthplace || '山林') + '·开馆讲学·清议叹"奇士不仕"',
      tags: ['科举', '童子科', '奇行', '隐']
    });
    // **G5 audit Fix 4·若 H active·真调 _kjpSpawnShanzhang 入山长 lineage** (非装饰 mark)
    if (typeof window !== 'undefined' && typeof window._isHEnabled === 'function' &&
        window._isHEnabled() && typeof window._kjpSpawnShanzhang === 'function') {
      try {
        var academyConfig = {
          founder:     c.name,                                 // 童子本人成山长
          name:        c.birthplace + '私学',
          foundedYear: curY,
          faction:     '在野儒',
          type:        '私学',
          learning:    '心学'                                  // 隐士·清狂·心学倾
        };
        // _kjpSpawnShanzhang 内 existing char path·真 mark 为山长 + _academyName/_academyType/_lectureLearning
        window._kjpSpawnShanzhang(academyConfig);
        c._academyOrigin = academyConfig.name;
        c._inFaction = 'literati';
        c._joinedHShanzhang = true;   // audit 标·真联动
      } catch (_) {}
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §16·G5 v2·burned_out 才尽辍考·改 officialTitle 县学正
  // ════════════════════════════════════════════════════════════════

  function _kjG5OnTongziBurnedOut(c) {
    if (!c || c._tongziBurnedOut) return;
    c._tongziBurnedOut = true;
    var curY = GM.year || 0;
    c.officialTitle = (c.birthplace || '县') + '县学正';
    c.stance = '退·教谕';
    c.rankLevel = 0;
    c.career = c.career || [];
    c.career.push({
      year:      curY,
      title:     '县学正',
      note:      curY + '年·童子' + c.name + '·辍考·任' + c.officialTitle,
      desc:      '才尽·辍考·退县教谕·士论惜之',
      milestone: true
    });
    _logChronicleSafe({
      type: 'tongzi_burned_out',
      text: curY + '年·童子 ' + c.name + ' 才尽·辍考·任 ' + c.officialTitle + '·士论叹"神童不副"',
      tags: ['科举', '童子科', '辍考', '退']
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §17·G5 v2·chronicle 长尾 annual tick (每年 chronicle 跟踪存活神童)
  // ════════════════════════════════════════════════════════════════

  function _kjG5TongziAnnualTick() {
    if (!_isG5Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    var curY = GM.year || 0;
    if (!GM._tongziLastAnnualY) GM._tongziLastAnnualY = curY;
    // 每 5 年 chronicle 1 行 (避免 spam)
    if (curY - GM._tongziLastAnnualY < 5) return;
    GM._tongziLastAnnualY = curY;
    var alive = (GM.chars || []).filter(function(c) {
      return c && c.alive !== false && c._origin === 'tongzi' &&
             !c._tongziHuishiPassed && !c._tongziTurnedEccentric && !c._tongziBurnedOut;
    });
    if (alive.length === 0) return;
    var summaries = alive.slice(0, 3).map(function(c) {
      var age = curY - (c.birthYear || 0);
      return c.name + ' (' + age + '岁·' +
             (c._tongziArchetype === 'late_bloomer' ? '健习' :
              c._tongziArchetype === 'turned_eccentric' ? '将隐' :
              c._tongziArchetype === 'burned_out' ? '渐倦' : '体弱') + ')';
    }).join('·');
    _logChronicleSafe({
      type: 'tongzi_annual_status',
      text: curY + '年·童子见习近况·' + summaries + (alive.length > 3 ? '等' + alive.length + '人' : ''),
      tags: ['科举', '童子科', '长尾']
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §18·G5 v2·Path B·礼部 wendui (跟 G2 _kjG2OpenLibuEnkeWendui paradigm 同)
  // ════════════════════════════════════════════════════════════════

  function _kjG5PickLibuLeader() {
    if (typeof GM === 'undefined' || !GM) return null;
    var chars = GM.chars || [];
    var cands = chars.filter(function(c) {
      if (!c || c.alive === false || c._retired) return false;
      var t = String(c.officialTitle || c.title || '');
      return /礼部|翰林|国子|秘书/.test(t);
    });
    // F3·parity G2/G3·title 没人 → 退化用 prestige≥60
    if (!cands.length) {
      cands = chars.filter(function(c) {
        if (!c || c.alive === false || c._retired) return false;
        return (c.prestige || 0) >= 60;
      });
    }
    if (!cands.length) return null;
    cands.sort(function(a, b) {
      return (b.intelligence || 50) - (a.intelligence || 50);
    });
    return cands[0];
  }

  function _kjG5OpenLibuTongziWendui() {
    if (!_isG5Enabled()) return false;
    if (typeof GM === 'undefined' || !GM) return false;
    var thisYear = GM.year || 0;
    if (GM._tongziLibuWenduiLastYear === thisYear) {
      try {
        if (typeof _toast === 'function') _toast('本年已问过礼部·明岁再议');
      } catch (_) {}
      return false;
    }
    var leader = _kjG5PickLibuLeader();
    if (!leader) {
      try {
        if (typeof _toast === 'function') _toast('朝中无主礼部 / 翰林之人·童子科不可议');
      } catch (_) {}
      return false;
    }
    // 调 wendui cedui mode (跟 G2/G3 同 paradigm)·若 _kjpOpenWendui 真存
    if (typeof window !== 'undefined' && typeof window._kjpOpenWendui === 'function') {
      try {
        window._kjpOpenWendui({
          mode: 'cedui',
          advisor: leader,
          topic: '议·童子科荐举',
          archetype: '礼部',
          topicContext: {
            subtype: '_player_initiated',
            reason: '陛下问·今岁可开童子科否',
            historyPath: 'libu-backed'
          },
          onOutcome: function(result) {
            _kjG5HandleLibuWenduiOutcome(leader, result);
          }
        });
        GM._tongziLibuWenduiLastYear = thisYear;
        return true;
      } catch (e) {
        try { console.warn('[G5.PathB] wendui open failed', e); } catch (_) {}
      }
    }
    return false;
  }

  function _kjG5HandleLibuWenduiOutcome(leader, result) {
    if (!result) return;
    if (result.stance === 'support') {
      // 礼部背书·spawn 童子科·走 path B
      if (typeof window !== 'undefined' && typeof window._kjSpawnSpecialExam === 'function') {
        try {
          window._kjSpawnSpecialExam('tongzi',
            '礼部 (' + leader.name + ') 议·' + (result.reason || '可开'),
            { subtype: 'libu-backed', libuLeader: leader.name, _playerInitiated: true });
        } catch (_) {}
      }
    } else if (result.stance === 'oppose') {
      leader._tongziAffinity = (leader._tongziAffinity || 0) - 5;
      _logChronicleSafe({
        type: 'tongzi_libu_oppose',
        text: '礼部劝阻·' + leader.name + '·' + (result.reason || '今岁不宜'),
        tags: ['科举', '童子科', '礼部', '劝阻']
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §19·G5 v2·desk template suggestion (5 类·跟 G2/G3 paradigm 同)
  // ════════════════════════════════════════════════════════════════

  function _kjG5GetTongziEdictTemplate(subtype, detail) {
    var TEMPLATES = {
      'recommendation': {
        label: '州县荐神童',
        path: '州县荐举',
        body: '朕念天下士林·州县藩司有奇童·智识超伦·特准开童子科·荐举入翰林·钦此。'
      },
      'reign-change': {
        label: '改元荐神童',
        path: '改元荐举',
        body: '朕初膺天命·登基改元·开童子科·荐天下神童入翰林见习·以示文教·钦此。'
      },
      'birthday': {
        label: '寿诞荐神童',
        path: '寿诞荐举',
        body: '朕躬康健·恭逢圣寿' + ((detail && detail.age) || 60) + '·特开童子科·士林同贺·钦此。'
      },
      'amnesty': {
        label: '平乱荐神童',
        path: '平乱荐举',
        body: '朕赖天地祖宗保佑·' + ((detail && detail.disasterType) || '逆乱') + '已平·四海升平·特开童子科·示天瑞·钦此。'
      },
      '_player_edict': {
        label: '⚠ 无故强荐神童',
        path: '无故强荐',
        body: '朕意已决·开童子科·礼部速办·勿议·钦此。'
      }
    };
    return TEMPLATES[subtype] || TEMPLATES.recommendation;
  }

  function _kjG5OnTongziTriggerEnqueueDeskSuggestion(subtype, detail) {
    if (!_isG5Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    var template = _kjG5GetTongziEdictTemplate(subtype, detail);
    GM._edictSuggestions.push({
      category: 'tongzi',
      badge: '👶',
      label: template.label,
      body:  template.body,
      severity: subtype === '_player_edict' ? 'warning' : 'normal',
      historyPath: template.path,
      _tongziSubtype: subtype,
      expireAtYear: (GM.year || 0) + 2
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §20·G5 v2·user 钦点 mode helper (留京 / 遣乡·影响 archetype 派生)
  // ════════════════════════════════════════════════════════════════

  function _kjG5SetUserDecreeMode(mode) {
    if (typeof GM === 'undefined' || !GM) return;
    if (['liujing', 'qianxiang', 'default'].indexOf(mode) === -1) return;
    GM._tongziUserDecreeMode = mode;
  }

  function _kjG5GetUserDecreeMode() {
    return (typeof GM !== 'undefined' && GM && GM._tongziUserDecreeMode) || 'default';
  }

  // ════════════════════════════════════════════════════════════════
  // §13·expose
  // ════════════════════════════════════════════════════════════════

  if (typeof window !== 'undefined') {
    window._isG5Enabled                       = _isG5Enabled;
    window._kjG5OnTongziApproved              = _kjG5OnTongziApproved;
    window._kjG5OnTongziRejected              = _kjG5OnTongziRejected;
    window._kjG5OnTongziDeferred              = _kjG5OnTongziDeferred;
    window._kjG5PickTongziChiefExaminer       = _kjG5PickTongziChiefExaminer;
    window._kjG5MarkTongzijinshi              = _kjG5MarkTongzijinshi;
    window._kjG5SpawnTongzijinshiPool         = _kjG5SpawnTongzijinshiPool;
    window._kjG5DecorateSpawnedEntryForKeyi   = _kjG5DecorateSpawnedEntryForKeyi;
    window._kjG5InitTongziFamilies            = _kjG5InitTongziFamilies;
    window._kjG5DetectTongziFamily            = _kjG5DetectTongziFamily;
    window._kjG5BuildTongziQuestionPrompt     = _kjG5BuildTongziQuestionPrompt;
    window._kjG5GetTongziQuestionThemes       = _kjG5GetTongziQuestionThemes;
    window._kjG5BuildFumoCeremonyPrompt       = _kjG5BuildFumoCeremonyPrompt;
    window._kjG5RunFumoCeremony               = _kjG5RunFumoCeremony;
    window._kjG5ResumeFumoCeremonyIfPending   = _kjG5ResumeFumoCeremonyIfPending;
    window._kjG5TongziHealthTick              = _kjG5TongziHealthTick;
    window._kjG5GetTongziToneHint             = _kjG5GetTongziToneHint;
    window._kjG5ParseTongziFromEdictText      = _kjG5ParseTongziFromEdictText;
    window._kjG5ScanCtxInputEdictsForTongzi   = _kjG5ScanCtxInputEdictsForTongzi;
    window._kjG5OnTongziApprovedViaEdict      = _kjG5OnTongziApprovedViaEdict;
    window._kjG5MaybeResetCrossScenarioFields = _kjG5MaybeResetCrossScenarioFields;
    window._kjG5GetTongziFamilyTinyiAffinityBonus = _kjG5GetTongziFamilyTinyiAffinityBonus;
    window._kjG5DeriveTongziTitle             = _kjG5DeriveTongziTitle;
    window._kjG5DeriveTongziArchetype         = _kjG5DeriveTongziArchetype;
    // G5 v2·新 expose
    window._kjG5GetArchetypeSpawnProfile      = _kjG5GetArchetypeSpawnProfile;
    window._kjG5DeriveInitArchetype           = _kjG5DeriveInitArchetype;
    window._kjG5ApplyMinxinBoostOnSpawn       = _kjG5ApplyMinxinBoostOnSpawn;
    window._kjG5OnTongziMartyred              = _kjG5OnTongziMartyred;
    window._kjG5ApplyQuotaBoostOnSpawn        = _kjG5ApplyQuotaBoostOnSpawn;
    window._kjG5LateBloomerEnterHuishi        = _kjG5LateBloomerEnterHuishi;
    window._kjG5OnTongziTurnedEccentric       = _kjG5OnTongziTurnedEccentric;
    window._kjG5OnTongziBurnedOut             = _kjG5OnTongziBurnedOut;
    window._kjG5TongziAnnualTick              = _kjG5TongziAnnualTick;
    window._kjG5PickLibuLeader                = _kjG5PickLibuLeader;
    window._kjG5OpenLibuTongziWendui          = _kjG5OpenLibuTongziWendui;
    window._kjG5HandleLibuWenduiOutcome       = _kjG5HandleLibuWenduiOutcome;
    window._kjG5GetTongziEdictTemplate        = _kjG5GetTongziEdictTemplate;
    window._kjG5OnTongziTriggerEnqueueDeskSuggestion = _kjG5OnTongziTriggerEnqueueDeskSuggestion;
    window._kjG5SetUserDecreeMode             = _kjG5SetUserDecreeMode;
    window._kjG5GetUserDecreeMode             = _kjG5GetUserDecreeMode;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _isG5Enabled:                       _isG5Enabled,
      _kjG5OnTongziApproved:              _kjG5OnTongziApproved,
      _kjG5OnTongziRejected:              _kjG5OnTongziRejected,
      _kjG5OnTongziDeferred:              _kjG5OnTongziDeferred,
      _kjG5PickTongziChiefExaminer:       _kjG5PickTongziChiefExaminer,
      _kjG5MarkTongzijinshi:              _kjG5MarkTongzijinshi,
      _kjG5SpawnTongzijinshiPool:         _kjG5SpawnTongzijinshiPool,
      _kjG5DecorateSpawnedEntryForKeyi:   _kjG5DecorateSpawnedEntryForKeyi,
      _kjG5InitTongziFamilies:            _kjG5InitTongziFamilies,
      _kjG5DetectTongziFamily:            _kjG5DetectTongziFamily,
      _kjG5BuildTongziQuestionPrompt:     _kjG5BuildTongziQuestionPrompt,
      _kjG5GetTongziQuestionThemes:       _kjG5GetTongziQuestionThemes,
      _kjG5BuildFumoCeremonyPrompt:       _kjG5BuildFumoCeremonyPrompt,
      _kjG5RunFumoCeremony:               _kjG5RunFumoCeremony,
      _kjG5ResumeFumoCeremonyIfPending:   _kjG5ResumeFumoCeremonyIfPending,
      _kjG5TongziHealthTick:              _kjG5TongziHealthTick,
      _kjG5GetTongziToneHint:             _kjG5GetTongziToneHint,
      _kjG5ParseTongziFromEdictText:      _kjG5ParseTongziFromEdictText,
      _kjG5ScanCtxInputEdictsForTongzi:   _kjG5ScanCtxInputEdictsForTongzi,
      _kjG5OnTongziApprovedViaEdict:      _kjG5OnTongziApprovedViaEdict,
      _kjG5MaybeResetCrossScenarioFields: _kjG5MaybeResetCrossScenarioFields,
      _kjG5GetTongziFamilyTinyiAffinityBonus: _kjG5GetTongziFamilyTinyiAffinityBonus,
      _kjG5DeriveTongziTitle:             _kjG5DeriveTongziTitle,
      _kjG5DeriveTongziArchetype:         _kjG5DeriveTongziArchetype,
      _kjG5GetArchetypeSpawnProfile:      _kjG5GetArchetypeSpawnProfile,
      _kjG5DeriveInitArchetype:           _kjG5DeriveInitArchetype,
      _kjG5ApplyMinxinBoostOnSpawn:       _kjG5ApplyMinxinBoostOnSpawn,
      _kjG5OnTongziMartyred:              _kjG5OnTongziMartyred,
      _kjG5ApplyQuotaBoostOnSpawn:        _kjG5ApplyQuotaBoostOnSpawn,
      _kjG5LateBloomerEnterHuishi:        _kjG5LateBloomerEnterHuishi,
      _kjG5OnTongziTurnedEccentric:       _kjG5OnTongziTurnedEccentric,
      _kjG5OnTongziBurnedOut:             _kjG5OnTongziBurnedOut,
      _kjG5TongziAnnualTick:              _kjG5TongziAnnualTick,
      _kjG5PickLibuLeader:                _kjG5PickLibuLeader,
      _kjG5OpenLibuTongziWendui:          _kjG5OpenLibuTongziWendui,
      _kjG5HandleLibuWenduiOutcome:       _kjG5HandleLibuWenduiOutcome,
      _kjG5GetTongziEdictTemplate:        _kjG5GetTongziEdictTemplate,
      _kjG5OnTongziTriggerEnqueueDeskSuggestion: _kjG5OnTongziTriggerEnqueueDeskSuggestion,
      _kjG5SetUserDecreeMode:             _kjG5SetUserDecreeMode,
      _kjG5GetUserDecreeMode:             _kjG5GetUserDecreeMode
    };
  }
})();
