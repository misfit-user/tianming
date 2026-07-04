// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   私学/书院 mini-system 主 runner（Phase H·跟 G3 wuju 同 standalone paradigm·读 9 朝代 preset）
//   §1 lifecycle   5 阶段 founding/flourishing/official/banned/restored/abolished（_kjpOn* 钩子）
//   §2 山长 NPC    真 spawn 山长（_kjpSpawnShanzhang·G2/G3 jinshi schema 同深度·11 维/resources/career）
//   §3 层级        5 类 academy（太学/郡学/私学/书院/讲会）· _kjpCalcSchoolNetworkTier
//   §4 联动        真上人物面板 / 被弹劾·押·赐死（F4c）· _kjpMaybeSpawnSchoolParty · 山长世系
// ─────────────────────────────────────────────
/**
 * tm-keju-school-network.js — Phase H·私学/书院 mini-system 主 runner
 *
 * paradigm·跟 G3 wuju.js 同·standalone mini-runner·读 9 朝代 preset schoolNetworkInit
 *   - founding event·真 spawn 山长 NPC (跟 G2/G3 jinshi schema 同深度)
 *   - 5 类 academy 层级 (太学/郡学/私学/书院/讲会)
 *   - lifecycle 5 阶段 (founding/flourishing/official/banned/restored/abolished)
 *   - 真上人物面板·真被弹劾 / 押 / 赐死 (跟 F4c 联动)
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuH=false 全 no-op
 *   - 山长是真 NPC·非字段·走 GM.chars
 *   - 党派走 _ty3_partySpawn 真进 GM.parties (H2 sprint)
 *   - 严禁玄幻·founding 由 NPC 学术声望 + 时代驱动·禁讲学由 corruption / 党争触
 *
 * Public API (本 sub-slice·H0 + H1)·
 *   _isHEnabled()                                    — flag gate (H0)
 *   _kjpInitSchoolNetwork()                          — GM._schoolNetwork init
 *   _kjpOnSchoolFounding(academyConfig)              — 主入口·founding event
 *   _kjpOnSchoolBanned(academyName, reason)          — 禁讲学
 *   _kjpOnSchoolRestored(academyName)                — 复立
 *   _kjpOnSchoolOfficialized(academyName)            — 官化 (元 1290)
 *   _kjpSpawnShanzhang(academyConfig)                — spawn 山长 NPC (跟 G2 jinshi 同深度)
 *   _kjpCalcSchoolNetworkTier()                      — nascent/active/dominant/banned
 *   _kjpGetActiveAcademies()
 *   _kjpResumeIfPending()                            — resume hook (pipeline 调)
 *   _kjpHEventOnSchoolFounding(academyName, year)    — event hook·SET _lastSchoolFoundedYear (H0)
 *   _kjpHEventOnSchoolBanned(academyName, year)      — event hook·SET _lastSchoolBannedYear (H0)
 *
 * 依赖·
 *   - GM (mutate _schoolNetwork / chars / _chronicle)
 *   - P.conf.useNewKejuH (gate)
 *   - P.keju.schoolNetworkInit (9 朝代 preset·tm-keju-presets.js 已 setup)
 *   - findCharByName (global)
 *   - GM.vars['民心'] (H0·book flourishing/banned ±5)
 */
(function() {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·gate (H0·M7 fix)
  // ════════════════════════════════════════════════════════════════

  function _isHEnabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuH !== false;
  }

  function _getCurYear() {
    if (typeof GM === 'undefined' || !GM) return 0;
    return GM.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  // ════════════════════════════════════════════════════════════════
  // §1·init·GM._schoolNetwork (从 preset copy)
  // ════════════════════════════════════════════════════════════════

  function _kjpInitSchoolNetwork() {
    if (typeof GM === 'undefined' || !GM) return;
    if (GM._schoolNetwork) return;   // 幂等
    var preset = (P && P.keju && P.keju.schoolNetworkInit) || {};
    GM._schoolNetwork = {
      academies:           Array.isArray(preset.academies) ? preset.academies.map(_cloneAcademy) : [],
      private_schools_active: !!preset.private_schools_active,
      note:                preset.note || '',
      // 运行时·tier / shanzhang index / lifecycle / etc
      tier:                'nascent',                // nascent/active/dominant/banned
      shanzhangByAcademy:  {},                      // {academyName: shanzhangCharName}
      _lastFoundedYear:    0,
      _lastBannedYear:     0,
      _lastTierChange:     0
    };
  }

  function _cloneAcademy(a) {
    if (!a) return null;
    return {
      name:        a.name || '',
      founder:     a.founder || '',
      foundedYear: a.foundedYear || 0,
      faction:     a.faction || '',
      // 运行时补字段 (H1·H7·H10)
      type:        a.type || _inferAcademyType(a),       // 太学/郡学/私学/书院/讲会
      learning:    a.learning || _inferLearning(a.faction),
      region:      a.region || '',                       // H7 attach
      lifecycle:   a.lifecycle || 'founding',
      influence:   a.influence || 30,
      prestige:    a.prestige || 50,
      _shanzhangSpawned: false,
      _discipleCount:    0,
      events:      []
    };
  }

  function _inferAcademyType(a) {
    var n = String(a.name || '');
    if (/太学|国子/.test(n)) return '太学';
    if (/郡学|府学/.test(n)) return '郡学';
    if (/书院/.test(n)) return '书院';
    if (/精舍|讲学/.test(n)) return '私学';
    if (/复社|讲会/.test(n)) return '讲会';
    return '私学';
  }

  function _inferLearning(faction) {
    var MAP = {
      '理学':  '理学',
      '心学':  '心学',
      '东林':  '实学',
      '关学':  '关学·实学',
      '复社':  '实学',
      '官学':  '官学',
      '官学化': '官学·理学化',
      '中立':  '理学'
    };
    return MAP[faction] || '杂学';
  }

  // ════════════════════════════════════════════════════════════════
  // §2·山长 NPC spawn (H1·v2 核心)·跟 G2/G3 jinshi schema 同深度
  // ════════════════════════════════════════════════════════════════

  function _kjpSpawnShanzhang(academyConfig) {
    if (!_isHEnabled()) return null;
    if (!academyConfig || !academyConfig.founder) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    if (!Array.isArray(GM.chars)) GM.chars = [];

    // 防重·若 founder 已在 chars (historical 名臣)·只 mark + 不重 spawn
    if (typeof findCharByName === 'function') {
      try {
        var existing = findCharByName(academyConfig.founder);
        if (existing) {
          // H1·skip dead char·避复活
          if (existing.alive === false) return null;
          // mark existing char as shanzhang
          // H2·preserve original _origin (若已为 enke/wuju/disciple·不 override)
          if (!existing._origin) existing._origin = 'shanzhang';
          existing._academyName = academyConfig.name;
          existing._academyType = academyConfig.type || '书院';
          existing._lectureLearning = academyConfig.learning || _inferLearning(academyConfig.faction);
          if (!existing._disciples) existing._disciples = [];
          existing._academyLifecycle = 'founding';
          return existing;
        }
      } catch(_) {}
    }

    var foundedYear = academyConfig.foundedYear || _getCurYear();
    var ageBase = 50 + Math.floor(Math.random() * 15);   // 50-64 学者偏长

    var shanzhang = {
      id:         'shanzhang_' + foundedYear + '_' + Date.now(),
      name:       academyConfig.founder,
      alive:      true,
      gender:     '男',
      age:        ageBase,
      birthYear:  foundedYear - ageBase,
      birthplace: academyConfig.region || '京师',
      ethnicity:  '汉',
      faith:      '儒',
      culture:    '汉',
      learning:   academyConfig.learning || _inferLearning(academyConfig.faction),
      appearance: '清癯·须长·目有神光',
      diction:    '引经据典·必称圣贤·语必中规',
      personality: '刚毅 / 守道 / 不容奸',
      // ─── top-level 11 维·儒者偏 intelligence/integrity/charisma·低 valor/military ───
      loyalty:        50,
      ambition:       30,
      intelligence:   85 + Math.floor(Math.random() * 10),
      valor:          20,
      military:       20,
      administration: 40,
      management:     60,
      charisma:       70 + Math.floor(Math.random() * 15),
      diplomacy:      50,
      benevolence:    70,
      integrity:      80 + Math.floor(Math.random() * 15),
      // ─── resources·学术 fame 高·virtue 高 ───
      resources: {
        privateWealth: { money: 500, grain: 100, cloth: 50 },
        publicPurse:   { money: 0, grain: 0, cloth: 0 },
        fame:          60 + Math.floor(Math.random() * 20),
        virtue:        70 + Math.floor(Math.random() * 20),
        health:        70 + Math.floor(Math.random() * 20),
        stress:        20
      },
      traits: ['scholar'],
      // H1 fix·faction 空·非"在野"·避无效 GM.factions key
      faction: (P && P.player && P.player.faction) || '',
      _inFaction: 'literati',                              // H 自定标签
      party:      '',                                       // H2 sprint·真 _ty3_partySpawn 时填
      partyRank:  '首领',
      family:     academyConfig.founder.charAt(0) + '氏',
      familyTier: 'scholar-lineage',
      familyRole: '山长',
      clanPrestige: 70,
      mentor:     '',
      hobbies:    '讲学 / 著书 / 游学',
      innerThought: '愿以一书院之力·正士林·振世道。',
      personalGoal: '复古道·正学风',
      stressSources: ['朝政日非', '阉党当道', '学说不行'],
      // ─── 职衔·non-朝廷 special ───
      officialTitle: '致仕·' + (academyConfig.name || '书院') + '山长',
      title:         '山长',
      bio:           foundedYear + '年立 ' + (academyConfig.name || '书院') + '·主讲' + (academyConfig.learning || _inferLearning(academyConfig.faction)),
      class:         'scholar-lineage',
      source:        '私学',
      recruitTurn:   GM.turn || 0,
      isHistorical:  _isHistoricalFounder(academyConfig.founder),
      // ─── career·array ───
      career: [{
        year:      foundedYear,
        title:     '山长',
        note:      foundedYear + '年·' + (academyConfig.name || '书院') + '·立',
        date:      foundedYear + '年',
        desc:      '创' + (academyConfig.name || '书院'),
        milestone: true
      }],
      // ─── H 私有 _ 字段·M3 fix·_origin 枚举 shanzhang ───
      _origin:           'shanzhang',
      _academyName:      academyConfig.name || '',
      _academyType:      academyConfig.type || '书院',
      _lectureLearning:  academyConfig.learning || _inferLearning(academyConfig.faction),
      _disciples:        [],
      _academyLifecycle: 'founding'
    };
    (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(shanzhang);
    return shanzhang;
  }

  var HISTORICAL_FOUNDERS_EXTRA = [
    '王守仁', '王畿', '王艮', '高攀龙', '钱一本', '邹元标', '冯从吾',
    '张采', '颜元', '李塨', '阮元', '焦循', '智璿', '胡瑗', '程颢', '程颐'
  ];
  // M4·HISTORICAL_LINEAGE keys 自动入 founders·避手动维护两表
  // (HISTORICAL_LINEAGE 定义在 §10·var hoist OK)
  function _isHistoricalFounder(name) {
    if (HISTORICAL_FOUNDERS_EXTRA.indexOf(String(name)) >= 0) return true;
    if (typeof HISTORICAL_LINEAGE === 'object' && HISTORICAL_LINEAGE &&
        HISTORICAL_LINEAGE.hasOwnProperty(name)) return true;
    return false;
  }

  // ════════════════════════════════════════════════════════════════
  // §3·founding event·主入口
  // ════════════════════════════════════════════════════════════════

  function _kjpOnSchoolFounding(academyConfig) {
    if (!_isHEnabled()) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    if (!academyConfig || !academyConfig.name) return null;
    if (!GM._schoolNetwork) _kjpInitSchoolNetwork();
    var sn = GM._schoolNetwork;
    // 防重 (按 name)
    if (sn.academies.find(function(a) { return a && a.name === academyConfig.name; })) {
      return null;
    }
    var year = academyConfig.foundedYear || _getCurYear();
    var academy = _cloneAcademy({
      name:        academyConfig.name,
      founder:     academyConfig.founder || '',
      foundedYear: year,
      faction:     academyConfig.faction || '',
      type:        academyConfig.type,
      learning:    academyConfig.learning,
      region:      academyConfig.region || '',
      lifecycle:   'founding',
      influence:   academyConfig.influence || 30,
      prestige:    academyConfig.prestige || 50
    });
    sn.academies.push(academy);
    sn._lastFoundedYear = year;

    // R1·F2 fix·founding 时自动 enrich academy fields (跟 H10 §22 同 paradigm)
    if (typeof _kjpHEnrichAcademyFields === 'function') {
      try { _kjpHEnrichAcademyFields(academy); } catch(_) {}
    }
    // R1·M4 fix·founding 时自动 apply region effects (地理 + 民心)
    if (typeof _kjpHApplyRegionEffects === 'function') {
      try { _kjpHApplyRegionEffects(academy); } catch(_) {}
    }

    // 真 spawn 山长 NPC (若 founder 非空)
    var shanzhang = null;
    if (academy.founder) {
      shanzhang = _kjpSpawnShanzhang(academy);
      if (shanzhang) {
        academy._shanzhangSpawned = true;
        sn.shanzhangByAcademy[academy.name] = shanzhang.name;
      }
    }

    // chronicle
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_founding',
        text: year + '年·' + academy.name + ' 立·主讲 ' + (academy.learning || '杂学') +
              (shanzhang ? '·山长 ' + shanzhang.name : ''),
        tags: ['书院', '立', academy.faction || ''],
        academyName: academy.name,
        founder: academy.founder
      });
    }

    // H0·event hook·SET _lastSchoolFoundedYear
    _kjpHEventOnSchoolFounding(academy.name, year);

    // H2 fix·book flourishing → 民心 ±5
    _kjpAdjustMinxin(+5, '书院新立');

    // tier check
    _kjpUpdateTier();

    return academy;
  }

  // ════════════════════════════════════════════════════════════════
  // §4·banned / restored / officialized
  // ════════════════════════════════════════════════════════════════

  function _kjpOnSchoolBanned(academyName, reason) {
    if (!_isHEnabled()) return false;
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return false;
    var academy = GM._schoolNetwork.academies.find(function(a) { return a && a.name === academyName; });
    if (!academy) return false;
    if (academy.lifecycle === 'banned') return false;
    academy.lifecycle = 'banned';
    if (!Array.isArray(academy.events)) academy.events = [];
    academy.events.push({ year: _getCurYear(), type: 'banned', text: reason || '' });
    GM._schoolNetwork._lastBannedYear = _getCurYear();

    // chronicle
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_banned',
        text: _getCurYear() + '年·' + academyName + '·禁讲学·' + (reason || ''),
        tags: ['书院', '禁'],
        academyName: academyName,
        reason: reason || ''
      });
    }

    // H0·event hook
    _kjpHEventOnSchoolBanned(academyName, _getCurYear());

    // H2 fix·book banned → 民心 -5
    _kjpAdjustMinxin(-5, '禁讲学');

    // R1·M3 fix·banned → 自动 impeach 山长 (若 shanzhang 存)
    var shanzhangName = null;
    if (GM._schoolNetwork && GM._schoolNetwork.shanzhangByAcademy) {
      shanzhangName = GM._schoolNetwork.shanzhangByAcademy[academyName];
    }
    if (!shanzhangName && academy.founder) shanzhangName = academy.founder;
    if (shanzhangName && typeof _kjpHOnShanzhangImpeached === 'function') {
      try { _kjpHOnShanzhangImpeached(shanzhangName, reason || '禁讲学'); } catch(_) {}
    }

    // R1·M4·banned 也 reapply region effects (kejuQuota -1)
    if (typeof _kjpHApplyRegionEffects === 'function') {
      try { _kjpHApplyRegionEffects(academy); } catch(_) {}
    }

    // tier check
    _kjpUpdateTier();

    return true;
  }

  function _kjpOnSchoolRestored(academyName) {
    if (!_isHEnabled()) return false;
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return false;
    var academy = GM._schoolNetwork.academies.find(function(a) { return a && a.name === academyName; });
    if (!academy) return false;
    if (academy.lifecycle !== 'banned') return false;
    academy.lifecycle = 'restored';
    if (!Array.isArray(academy.events)) academy.events = [];
    academy.events.push({ year: _getCurYear(), type: 'restored' });
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_restored',
        text: _getCurYear() + '年·' + academyName + '·复立',
        tags: ['书院', '复立'],
        academyName: academyName
      });
    }
    _kjpUpdateTier();
    return true;
  }

  function _kjpOnSchoolOfficialized(academyName) {
    if (!_isHEnabled()) return false;
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return false;
    var academy = GM._schoolNetwork.academies.find(function(a) { return a && a.name === academyName; });
    if (!academy) return false;
    if (academy.lifecycle === 'official') return false;
    academy.lifecycle = 'official';
    if (!Array.isArray(academy.events)) academy.events = [];
    academy.events.push({ year: _getCurYear(), type: 'officialized' });
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_officialized',
        text: _getCurYear() + '年·' + academyName + '·官化·山长朝廷指派',
        tags: ['书院', '官化'],
        academyName: academyName
      });
    }
    _kjpUpdateTier();
    return true;
  }

  // ════════════════════════════════════════════════════════════════
  // §5·tier 派生·nascent/active/dominant/banned
  // ════════════════════════════════════════════════════════════════

  function _kjpCalcSchoolNetworkTier() {
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return 'nascent';
    var sn = GM._schoolNetwork;
    var active = sn.academies.filter(function(a) {
      return a && a.lifecycle !== 'banned' && a.lifecycle !== 'abolished';
    });
    var bannedCount = sn.academies.filter(function(a) {
      return a && a.lifecycle === 'banned';
    }).length;
    // 若 active 0 且 banned ≥1·tier='banned'
    if (active.length === 0 && bannedCount > 0) return 'banned';
    if (active.length >= 5) return 'dominant';
    if (active.length >= 2) return 'active';
    return 'nascent';
  }

  function _kjpUpdateTier() {
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return;
    var newTier = _kjpCalcSchoolNetworkTier();
    var oldTier = GM._schoolNetwork.tier;
    if (newTier === oldTier) return;
    GM._schoolNetwork.tier = newTier;
    GM._schoolNetwork._lastTierChange = _getCurYear();
    // M3·per-turn dedupe·同 turn 多 tier change·chronicle 仅写一次
    var curTurn = GM.turn || 0;
    if (GM._kjpHTierChangeFiredTurn === curTurn) return;
    GM._kjpHTierChangeFiredTurn = curTurn;
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_tier_change',
        text: _getCurYear() + '·书院网络·tier ' + oldTier + ' → ' + newTier,
        tags: ['书院', 'tier']
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §6·helpers
  // ════════════════════════════════════════════════════════════════

  function _kjpGetActiveAcademies() {
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return [];
    return GM._schoolNetwork.academies.filter(function(a) {
      return a && a.lifecycle !== 'banned' && a.lifecycle !== 'abolished';
    });
  }

  function _kjpResumeIfPending() {
    if (!_isHEnabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._schoolNetwork) _kjpInitSchoolNetwork();
    // H4·讲会 queue resume (跟 G3 _kjG3ResumeWuJiaoyueDaIfPending 同 paradigm)
    if (typeof _kjpHResumeLectureIfPending === 'function') _kjpHResumeLectureIfPending();
  }

  // H2 fix·影响 GM.vars['民心']·真接口 (民心(士) 不存)
  function _kjpAdjustMinxin(delta, reason) {
    if (typeof GM === 'undefined' || !GM || !GM.vars) return;
    var v = GM.vars['民心'];
    if (!v) return;   // 剧本可能无此 var·跳
    var cur = parseInt(v.value, 10) || 0;
    v.value = Math.max(0, Math.min(100, cur + delta));
    // 不写 chronicle (调用方已 chronicle)
  }

  // ════════════════════════════════════════════════════════════════
  // §7·H0·event hook·SET field (跟 G2 _kjEventOnReignChange 同 paradigm)
  // ════════════════════════════════════════════════════════════════

  function _kjpHEventOnSchoolFounding(academyName, year) {
    if (typeof GM === 'undefined' || !GM) return;
    GM._lastSchoolFoundedYear = year || _getCurYear();
  }

  function _kjpHEventOnSchoolBanned(academyName, year) {
    if (typeof GM === 'undefined' || !GM) return;
    GM._lastSchoolBannedYear = year || _getCurYear();
  }

  // ════════════════════════════════════════════════════════════════
  // §9·H2·党派真 spawn 进 GM.parties (走 _ty3_partySpawn)
  // ════════════════════════════════════════════════════════════════

  // 5 类党派触发 + ideology + policyStances·跟 v2 doc §H2 表对齐
  var SCHOOL_PARTY_TRIGGERS = {
    '东林':  { name: '东林党',  ideology: '实学·议政清议',     stances: ['anti-阉党', 'pro-清议', 'pro-民意'], agenda: '正士风·清浊流',     desc: '东林学派议政·讥时清议' },
    '复社':  { name: '复社',     ideology: '实学·复古·讥时',   stances: ['anti-阉党', 'pro-清议', 'pro-改革'], agenda: '兴复古学·改良政治', desc: '张溥 1629 立·明末士林联社' },
    '理学':  { name: '理学派',   ideology: '理学·格物致知',     stances: ['pro-传统', 'pro-礼制'],             agenda: '尊朱子·明伦正名',   desc: '朱熹理学派·官学化载体' },
    '心学':  { name: '心学派',   ideology: '心学·知行合一',     stances: ['pro-自省', 'pro-革新'],             agenda: '致良知·明心见性',   desc: '王阳明心学派·反传统' },
    '关学':  { name: '关学',     ideology: '关中学派·实学',     stances: ['pro-实学', 'pro-礼制'],             agenda: '关中讲学·养实学',   desc: '冯从吾关中书院·关学' }
  };

  // founding 时·若 faction 是已知党派·_ty3_partySpawn 真 spawn 进 GM.parties
  // 山长 char.party 自动 set
  function _kjpMaybeSpawnSchoolParty(academy, shanzhang) {
    if (!_isHEnabled()) return null;
    if (!academy || !academy.faction) return null;
    var trigger = SCHOOL_PARTY_TRIGGERS[academy.faction];
    if (!trigger) return null;   // faction 非已知党派 (官学/官学化/中立 等·skip)
    if (typeof GM === 'undefined' || !GM) return null;
    if (!Array.isArray(GM.parties)) GM.parties = [];
    // 防重·若已存·skip spawn·但仍 set 山长 char.party (跟现党挂)
    var existing = GM.parties.find(function(p) { return p && p.name === trigger.name; });
    var newParty = null;
    var founders = shanzhang ? [shanzhang.name] : [];
    if (existing) {
      // 仅 set 山长 party + add to party.members
      if (shanzhang && existing.members) {
        var memberList = String(existing.members || '').split(',').filter(Boolean);
        if (memberList.indexOf(shanzhang.name) < 0) {
          memberList.push(shanzhang.name);
          existing.members = memberList.join(',');
          existing.memberCount = memberList.length;
        }
      }
      newParty = existing;
    } else {
      // 真 spawn·走 _ty3_partySpawn (跟 v2 doc M4 完整 opts)
      if (typeof window !== 'undefined' && typeof window._ty3_partySpawn === 'function') {
        try {
          newParty = window._ty3_partySpawn({
            name:              trigger.name,
            founders:          founders,
            leaderName:        shanzhang ? shanzhang.name : '',
            faction:           '',                       // H1 fix·空·tinyi v3 内自动 fallback
            initialInfluence:  30,
            initialCohesion:   85,
            ideology:          trigger.ideology,
            policyStances:     trigger.stances.slice(),
            parentParty:       null,
            reason:            academy.name + ' ' + (academy.foundedYear || _getCurYear()) + '·学派结党',
            agenda:            trigger.agenda,
            desc:              trigger.desc,
            status:            'active'
          });
        } catch(_) {}
      }
      // fallback·若 _ty3_partySpawn 未 load·直 push (smoke env)
      if (!newParty) {
        newParty = {
          name:        trigger.name,
          leader:      shanzhang ? shanzhang.name : '',
          faction:     '',
          influence:   30,
          cohesion:    85,
          ideology:    trigger.ideology,
          members:     founders.join(','),
          memberCount: founders.length,
          policyStance: trigger.stances.slice(),
          foundYear:   academy.foundedYear || _getCurYear(),
          foundTurn:   GM.turn || 0,
          status:      'active',
          desc:        trigger.desc,
          currentAgenda: trigger.agenda,
          _kjpHCreated: true
        };
        GM.parties.push(newParty);
        // H3·fallback 也补 chronicle 一笔 (跟 _ty3_partySpawn paradigm 一致)
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1,
            type: '党祸·新党生',
            text: '新党·' + newParty.name + (newParty.leader ? '·' + newParty.leader : '') + '·' + (newParty.desc || ''),
            tags: ['党派', '新党', newParty.name, 'school-fallback'],
            partyName: newParty.name
          });
        }
      }
    }
    // 山长 char.party 真 set (覆盖空值)
    if (shanzhang && newParty) {
      shanzhang.party = newParty.name;
      shanzhang._partyOrigin = 'school:' + academy.name;
    }
    return newParty;
  }

  // ════════════════════════════════════════════════════════════════
  // §10·H2·lineage chain (复用 F1 disciple-graph)
  // ════════════════════════════════════════════════════════════════

  // 历史 mentor → disciples 表·F1 disciple-graph 真 wire
  var HISTORICAL_LINEAGE = {
    '顾宪成': ['高攀龙', '钱一本'],
    '朱熹':   ['黄榦', '蔡元定'],
    '王守仁': ['王畿', '王艮', '钱德洪'],
    '王阳明': ['王畿', '王艮', '钱德洪'],
    '陆九渊': ['杨简'],
    '张栻':   ['彭龟年'],
    '冯从吾': ['张舜典'],
    '张溥':   ['张采', '吴伟业'],
    '黄宗羲': ['万斯同', '万斯大'],
    '范仲淹': ['富弼', '韩琦']
  };

  function _kjpBuildShanzhangLineage(shanzhang, academy) {
    if (!_isHEnabled()) return 0;
    if (!shanzhang || !shanzhang.name) return 0;
    var disciples = HISTORICAL_LINEAGE[shanzhang.name];
    if (!Array.isArray(disciples) || !disciples.length) return 0;
    var cohortYear = academy ? (academy.foundedYear || _getCurYear()) : _getCurYear();
    var addedTurn = (GM && GM.turn) || 0;
    var count = 0;
    disciples.forEach(function(d) {
      // 走 F1 真签名 _kjAddDiscipleEdge(disciple, mentor, cohortYear, addedTurn)
      if (typeof window !== 'undefined' && typeof window._kjAddDiscipleEdge === 'function') {
        try {
          window._kjAddDiscipleEdge(d, shanzhang.name, cohortYear, addedTurn);
          count++;
        } catch(_) {}
      }
      // 同时 mark shanzhang._disciples list (H 私有)
      if (!shanzhang._disciples) shanzhang._disciples = [];
      if (shanzhang._disciples.indexOf(d) < 0) shanzhang._disciples.push(d);
    });
    return count;
  }

  // ════════════════════════════════════════════════════════════════
  // §11·H2·5 archetype 山长 LLM dialog tone (跟 G3 5 archetype 同 paradigm)
  // ════════════════════════════════════════════════════════════════

  var SHANZHANG_TONES = {
    'traditional_lixue':   '儒者口吻·平和·讲究·"格物致知"·必称"圣贤"·"愚以为·..."·**避白话**',
    'radical_xinxue':      '儒者口吻·反传统·"知行合一"·"心即理"·激辩·"诸君·..."',
    'reformist_shixue':    '儒者口吻·议政清议·"风声雨声读书声"·"国家兴亡·匹夫有责"·凛然',
    'yimin_skeptic':       '儒者口吻·遗民·悲愤·"明儒之痛"·"老朽不忍"·孤介',
    'pragmatic_guanxue':   '儒者口吻·实学·"以礼为先"·"养之有素"·**避空谈**'
  };

  // M2·抽 YIMIN_SCHOLARS 配置表 (非 hardcode)
  var YIMIN_SCHOLARS = ['黄宗羲', '王夫之', '顾炎武', '颜元', '朱舜水'];

  function _kjpInferShanzhangArchetype(ch) {
    if (!ch || ch._origin !== 'shanzhang') return null;
    var learning = String(ch._lectureLearning || '');
    if (/心学/.test(learning))     return 'radical_xinxue';
    if (/实学.*议政|议政.*实学|实学/.test(learning))   return 'reformist_shixue';
    if (/关学/.test(learning))     return 'pragmatic_guanxue';
    if (/反思|遗民/.test(learning) || YIMIN_SCHOLARS.indexOf(ch.name) >= 0) return 'yimin_skeptic';
    return 'traditional_lixue';
  }

  function _kjpGetShanzhangToneHint(ch) {
    var archetype = _kjpInferShanzhangArchetype(ch);
    if (!archetype) return '';
    return SHANZHANG_TONES[archetype] || SHANZHANG_TONES.traditional_lixue;
  }

  // ════════════════════════════════════════════════════════════════
  // §12·H2·tinyi affinity helper (DEFERRED·跟 G3 wuju L1 同·dead expose backlog)
  // ════════════════════════════════════════════════════════════════

  // tinyi v3 现未真 read 此 helper·跟 G2 enkeParty / G3 wujuParty affinity 平行
  // 真效·NPC ch.party='东林党' 走 GM.parties·tinyi v3 NPC 真见 (走 _ty3_partyMetrics)
  // 此 helper 仅作 backlog·tinyi v3 prompt 注入时整合
  function _kjpGetSchoolPartyTinyiAffinityBonus(charName, topicOrText) {
    if (!charName || !topicOrText) return 0;
    if (typeof findCharByName !== 'function') return 0;
    var ch = findCharByName(charName);
    if (!ch || !ch.party) return 0;
    var pty = ch.party;
    var s = String(topicOrText);
    // 东林党·anti-阉党 议题加分·**ban 类先检 (避"禁讲学"先 match "讲学")**
    if (pty === '东林党' || pty === '复社') {
      if (/禁讲学|禁书院|罢讲会/.test(s))   return -40;   // ban 优先
      if (/阉党|魏珰|魏忠贤|司礼监/.test(s)) return -30;
      if (/清议|议政|讲学|书院/.test(s))    return +25;
    }
    // 理学派·守正
    if (pty === '理学派') {
      if (/格物|理学|程朱|圣贤/.test(s))     return +20;
      if (/异端|心学|王阳明/.test(s))         return -20;
    }
    // 心学派·反传统
    if (pty === '心学派') {
      if (/知行|致良知|王阳明|心学/.test(s)) return +20;
      if (/拘古|墨守|教条/.test(s))           return +15;
    }
    return 0;
  }

  // 修改 _kjpOnSchoolFounding·founding 时 trigger 党派 spawn + lineage build
  // (此处用 wrapper 而非直改 §3·避 §3 长函数膨胀)
  // 通过 alias·exposed _kjpOnSchoolFounding 仍调原·但 alias 新增 hook
  // M1·guard·已 wrap 时 skip (defensive·防多次 require 无限递归)
  if (!_kjpOnSchoolFounding._kjpHWrapped) {
    var _origOnSchoolFounding = _kjpOnSchoolFounding;
    _kjpOnSchoolFounding = function(academyConfig) {
      var academy = _origOnSchoolFounding(academyConfig);
      if (!academy) return academy;
      // H2·trigger 党派 spawn + lineage
      var shanzhang = null;
      if (academy.founder && typeof findCharByName === 'function') {
        try { shanzhang = findCharByName(academy.founder); } catch(_) {}
      }
      if (shanzhang) {
        _kjpMaybeSpawnSchoolParty(academy, shanzhang);
        _kjpBuildShanzhangLineage(shanzhang, academy);
      }
      return academy;
    };
    _kjpOnSchoolFounding._kjpHWrapped = true;
  }

  // ════════════════════════════════════════════════════════════════
  // §13·H3·学说改 paradigm.subjects (CR1 拆 2 路)
  // ════════════════════════════════════════════════════════════════

  // 学派 → subject id / name / ideology 映射 (跟 L7 reform-apply diff shape 对齐)
  var LEARNING_TO_SUBJECT = {
    '理学':   { id: 'lixue',  name: '理学', ideology: 'traditional', format: '论述', historicalAnalog: '朱熹格物' },
    '心学':   { id: 'xinxue', name: '心学', ideology: 'reformist',   format: '论述', historicalAnalog: '王阳明致良知' },
    '实学':   { id: 'shixue', name: '实学', ideology: 'reformist',   format: '论述', historicalAnalog: '东林经世' },
    '关学':   { id: 'guanxue',name: '关学', ideology: 'reformist',   format: '论述', historicalAnalog: '冯从吾礼学' },
    '朴学':   { id: 'puxue',  name: '朴学', ideology: 'practical',   format: '考据', historicalAnalog: '乾嘉考据' }
  };

  function _kjpMapLearningToSubject(learning) {
    if (!learning) return null;
    var s = String(learning);
    var keys = Object.keys(LEARNING_TO_SUBJECT);
    for (var i = 0; i < keys.length; i++) {
      if (s.indexOf(keys[i]) >= 0) return LEARNING_TO_SUBJECT[keys[i]];
    }
    return null;
  }

  // Path β·隐式 weight tick (小幅 ±2·绕 keyi·school-driven)·endTurn 调
  // 上限·±10 / 朝代 (避无限漂)
  function _kjpHTickSubjectWeightDrift() {
    if (!_isHEnabled()) return 0;
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return 0;
    if (!GM._kejuParadigm || !Array.isArray(GM._kejuParadigm.subjects)) return 0;
    if (!GM._kjpHWeightDriftAccum) GM._kjpHWeightDriftAccum = {};
    var active = _kjpGetActiveAcademies();
    var driftMap = {};
    active.forEach(function(a) {
      if (!a.learning) return;
      if (a.lifecycle !== 'flourishing' && a.lifecycle !== 'founding') return;
      var subj = _kjpMapLearningToSubject(a.learning);
      if (!subj) return;
      if (!driftMap[subj.id]) driftMap[subj.id] = { subj: subj, count: 0 };
      driftMap[subj.id].count++;
    });
    var driftedCount = 0;
    Object.keys(driftMap).forEach(function(id) {
      var info = driftMap[id];
      if (info.count < 1) return;   // 至少 1 学派书院·才漂
      // 累计上限 ±10
      var accum = GM._kjpHWeightDriftAccum[id] || 0;
      if (Math.abs(accum) >= 10) return;
      // 找 subject·若不存·尝试 add (β 路径·小幅添·非 paradigm shift event)
      var subj = GM._kejuParadigm.subjects.find(function(s) { return s && s.id === id; });
      if (!subj) {
        // β 路径不 add subject (那是 α 路径职责)·skip 增长
        return;
      }
      // 漂 +2
      subj.weight = Math.min(100, (subj.weight || 0) + 2);
      GM._kjpHWeightDriftAccum[id] = accum + 2;
      driftedCount++;
    });
    return driftedCount;
  }

  // Path α·显式 paradigm shift·spawn keyi 议程·走 L7 callback chain
  // 不直 call _kjpL7ApplyDiffToParadigm·而 enqueue 进 keyi 等待 user 议
  function _kjpHEnqueueParadigmShiftKeyi(academy, shiftType) {
    if (!_isHEnabled()) return null;
    if (!academy || !academy.learning) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    var subj = _kjpMapLearningToSubject(academy.learning);
    if (!subj) return null;
    var existing = GM._kejuParadigm && Array.isArray(GM._kejuParadigm.subjects) &&
                   GM._kejuParadigm.subjects.find(function(s) { return s && s.id === subj.id; });
    var paradigmDiff;
    var topicLabel;
    if (shiftType === 'add' || (!existing && shiftType !== 'weight')) {
      // 加新 subject (跟 L7 diff added shape)
      paradigmDiff = {
        subjects: {
          added: [{
            id:       subj.id,
            name:     subj.name,
            weight:   5,
            ideology: subj.ideology,
            format:   subj.format,
            historicalAnalog: subj.historicalAnalog,
            rationale: academy.name + ' 主讲·' + subj.name + '影响日深·士林讨论',
            maxScore: 100,
            introducedYear: academy.foundedYear || _getCurYear(),
            introducedBy:   academy.founder + ' / ' + academy.name + ' ' + (academy.foundedYear || _getCurYear()),
            customFields:   { _academyOrigin: academy.name }
          }],
          weightChanged: [],
          removed: []
        }
      };
      topicLabel = subj.name + '·' + academy.name + ' 显学起·议入科举';
    } else {
      // weight 调 (跟 L7 diff weightChanged shape)·+20
      var newW = Math.min(100, (existing && existing.weight || 0) + 20);
      paradigmDiff = {
        subjects: {
          added: [],
          weightChanged: [{ id: subj.id, newW: newW }],
          removed: []
        }
      };
      topicLabel = subj.name + '·' + academy.name + ' 学派显学化·议增 weight';
    }
    // 真 spawn keyi (走 KEYI_TOPIC_TYPES.reform·callback=_kjReformKeyiCallback)
    // 此处仅 prep + enqueue 进 GM._kjpHPendingParadigmShifts·实施 keyi UI 时拉起
    if (!Array.isArray(GM._kjpHPendingParadigmShifts)) GM._kjpHPendingParadigmShifts = [];
    var entry = {
      academyName: academy.name,
      topic:       topicLabel,
      intent:      'reform',
      paradigmDiff: paradigmDiff,
      magnitudeParsed: { magnitude: 'medium', impact: 'subjects-shift' },
      pilotScope: {},
      _sourceSchoolH: { academyName: academy.name, shanzhang: academy.founder, year: academy.foundedYear || _getCurYear() },
      enqueuedYear: _getCurYear(),
      enqueuedTurn: GM.turn || 0
    };
    GM._kjpHPendingParadigmShifts.push(entry);
    // chronicle
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_paradigm_shift_enqueued',
        text: _getCurYear() + '·' + topicLabel + ' (待议政)',
        tags: ['书院', '改革', 'enqueue', academy.faction || ''],
        academyName: academy.name
      });
    }
    return entry;
  }

  // 检测书院 dominant tier + 学派显学化候选
  // (实施时由 H8 反馈循环或 H9 watershed 调·当前作 helper)
  function _kjpHDetectParadigmShiftCandidate() {
    if (!_isHEnabled()) return [];
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return [];
    var tier = GM._schoolNetwork.tier;
    if (tier !== 'dominant') return [];
    // 同学派 ≥2 书院 + flourishing → 候选
    var active = _kjpGetActiveAcademies();
    var byLearning = {};
    active.forEach(function(a) {
      if (a.lifecycle !== 'flourishing' && a.lifecycle !== 'founding') return;
      if (!a.learning) return;
      var subj = _kjpMapLearningToSubject(a.learning);
      if (!subj) return;
      if (!byLearning[subj.id]) byLearning[subj.id] = [];
      byLearning[subj.id].push(a);
    });
    var candidates = [];
    Object.keys(byLearning).forEach(function(id) {
      if (byLearning[id].length >= 2) {
        // 取最早立·作 leader academy
        var leader = byLearning[id].slice().sort(function(a, b) {
          return (a.foundedYear || 0) - (b.foundedYear || 0);
        })[0];
        candidates.push({ subjectId: id, academy: leader, count: byLearning[id].length });
      }
    });
    return candidates;
  }

  // ════════════════════════════════════════════════════════════════
  // §14·H4·讲会 event LLM (跟 G2 谢恩大典 / G3 校阅大典 paradigm)
  // ════════════════════════════════════════════════════════════════

  // 5 类历史名场面·按 academy.learning 或 founder name 匹配
  var LECTURE_TEMPLATES = {
    '鹅湖之会':       { mainLearning: '理学', topic: '道问学 vs 尊德性',          year: 1175, venue: '鹅湖寺' },
    '白鹿洞讲会':     { mainLearning: '理学', topic: '学规·四书·读书法',         year: 1180, venue: '白鹿洞书院' },
    '东林讲会':       { mainLearning: '实学', topic: '讽议朝政·风声雨声读书声',   year: 1604, venue: '东林书院' },
    '泰州学派讲会':   { mainLearning: '心学', topic: '百姓日用即道',              year: 1530, venue: '泰州学派' },
    '复社虎丘大会':   { mainLearning: '实学', topic: '复古·讥时·改良政治',       year: 1630, venue: '虎丘' }
  };

  var LECTURE_QUEUE_TIMEOUT_TURNS = 3;

  function _kjpHPickLectureTemplate(academy) {
    if (!academy) return null;
    // 按 academy name 匹配
    var name = String(academy.name || '');
    if (/白鹿洞/.test(name)) return LECTURE_TEMPLATES['白鹿洞讲会'];
    if (/东林/.test(name))   return LECTURE_TEMPLATES['东林讲会'];
    if (/复社/.test(name))   return LECTURE_TEMPLATES['复社虎丘大会'];
    if (/泰州/.test(name) || /阳明/.test(name)) return LECTURE_TEMPLATES['泰州学派讲会'];
    // fallback by learning
    var lr = String(academy.learning || '');
    if (/心学/.test(lr)) return LECTURE_TEMPLATES['泰州学派讲会'];
    if (/实学/.test(lr)) return LECTURE_TEMPLATES['东林讲会'];
    if (/理学/.test(lr)) return LECTURE_TEMPLATES['鹅湖之会'];
    return LECTURE_TEMPLATES['鹅湖之会'];
  }

  function _kjpHBuildLectureMeetingPrompt(academy, opposingAcademy, template) {
    var year = _getCurYear();
    var sh = academy.founder || (academy._shanzhangName || '山长');
    var opp = opposingAcademy ? (opposingAcademy.founder || '客') : '';
    var count = academy._discipleCount || (academy.founder && HISTORICAL_LINEAGE[academy.founder] ? HISTORICAL_LINEAGE[academy.founder].length * 5 : 20);
    return '【讲会·' + (academy.name || template.venue) + '·' + year + '年】\n' +
      '主讲·' + sh + '·' + (academy.learning || template.mainLearning) + '派\n' +
      (opp ? '客·' + opp + '·辩学说\n' : '') +
      '听讲·' + count + ' 人\n' +
      '讲题·' + template.topic + '\n\n' +
      '请以书院讲会记口吻·写 200-300 字·古文体·\n' +
      '- 描讲会景·' + (opp ? '两方辩学说' : '主讲铺陈学说') + '\n' +
      '- 听众反应·或服或惑\n' +
      '- 收尾点出本场学术成果\n\n' +
      '风格·儒林讲学 + 微议政\n' +
      '**禁玄幻**·非天降神物·非异象\n\n' +
      '只返讲会记正文·不要标题。';
  }

  function _kjpHGenLectureMeetingFallback(academy, opposingAcademy, template) {
    var year = _getCurYear();
    var sh = academy.founder || '山长';
    var opp = opposingAcademy ? (opposingAcademy.founder || '客') : '';
    return year + '年·' + (academy.name || template.venue) + '讲会。' +
      '主讲 ' + sh + '·议 ' + template.topic + '。' +
      (opp ? '客 ' + opp + ' 至·两方辩学说·或服或惑。' : '听众肃然·或服或惑。') +
      '是日讲毕·' + (academy.learning || template.mainLearning) + '学派传布日远。';
  }

  function _kjpHRunLectureMeetingLLM(academy, opposingAcademy, cb) {
    if (!_isHEnabled()) { if (cb) cb(null); return; }
    if (typeof GM === 'undefined' || !GM) { if (cb) cb(null); return; }
    if (!academy) { if (cb) cb(null); return; }
    if (!Array.isArray(GM._kjpHLectureQueue)) GM._kjpHLectureQueue = [];
    var template = _kjpHPickLectureTemplate(academy);
    var pendingKey = academy.name + ':' + _getCurYear();
    if (GM._kjpHLectureQueue.find(function(p) { return p.key === pendingKey; })) {
      if (cb) cb(null);
      return;
    }
    var pending = {
      key:          pendingKey,
      academyName:  academy.name,
      opposingName: opposingAcademy ? opposingAcademy.name : '',
      template:     template,
      startTurn:    GM.turn || 0,
      year:         _getCurYear()
    };
    GM._kjpHLectureQueue.push(pending);

    function _finalize(record) {
      // BB4-style·LLM async 闭包 academy 跨 save/load 丢失·reFind from name
      var liveAcademy = academy;
      if (!liveAcademy || !liveAcademy.name) {
        if (GM._schoolNetwork && Array.isArray(GM._schoolNetwork.academies)) {
          liveAcademy = GM._schoolNetwork.academies.find(function(a) { return a && a.name === pending.academyName; });
        }
      }
      var liveOpposing = opposingAcademy;
      if (pending.opposingName && (!liveOpposing || !liveOpposing.name)) {
        if (GM._schoolNetwork && Array.isArray(GM._schoolNetwork.academies)) {
          liveOpposing = GM._schoolNetwork.academies.find(function(a) { return a && a.name === pending.opposingName; });
        }
      }
      var body = record || _kjpHGenLectureMeetingFallback(liveAcademy || { name: pending.academyName }, liveOpposing, template);
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'lecture_meeting',
          text: pending.year + '·' + pending.academyName + '·讲会·' + template.topic,
          tags: ['书院', '讲会', template.mainLearning],
          academyName: pending.academyName,
          body: body
        });
      }
      // mark academy._lastLectureYear (供 H8 反馈循环用)
      if (liveAcademy) {
        liveAcademy._lastLectureYear = pending.year;
        liveAcademy._discipleCount = (liveAcademy._discipleCount || 0) + 5;
      }
      if (Array.isArray(GM._kjpHLectureQueue)) {
        GM._kjpHLectureQueue = GM._kjpHLectureQueue.filter(function(p) { return p.key !== pendingKey; });
      }
      if (cb) cb(record);
    }

    // 真 LLM async (若 callAI exposed + AI key)
    if (typeof window !== 'undefined' && typeof window.callAI === 'function' &&
        typeof P !== 'undefined' && P.ai && P.ai.key) {
      try {
        var prompt = _kjpHBuildLectureMeetingPrompt(academy, opposingAcademy, template);
        window.callAI(prompt, 600).then(function(text) {
          var record = (typeof text === 'string') ? text.trim() : '';
          if (!record) record = _kjpHGenLectureMeetingFallback(academy, opposingAcademy, template);
          _finalize(record);
        }).catch(function() {
          _finalize(_kjpHGenLectureMeetingFallback(academy, opposingAcademy, template));
        });
        return;
      } catch(_) {}
    }
    _finalize(_kjpHGenLectureMeetingFallback(academy, opposingAcademy, template));
  }

  // R1·M2 fix·讲会 endTurn 自动 trigger (每 5 年 + flourishing academy + 5% prob)
  function _kjpHMaybeAutoTriggerLecture() {
    if (!_isHEnabled()) return 0;
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return 0;
    var curY = _getCurYear();
    if (!GM._kjpHLastAutoLectureYear) GM._kjpHLastAutoLectureYear = {};
    var fired = 0;
    var active = _kjpGetActiveAcademies();
    for (var i = 0; i < active.length; i++) {
      var a = active[i];
      if (a.lifecycle !== 'flourishing' && a.lifecycle !== 'founding') continue;
      var lastY = GM._kjpHLastAutoLectureYear[a.name] || (a.foundedYear || 0);
      if (curY - lastY < 5) continue;
      // 5% prob·避连续 fire
      if (Math.random() > 0.05) continue;
      _kjpHRunLectureMeetingLLM(a, null, null);
      GM._kjpHLastAutoLectureYear[a.name] = curY;
      fired++;
      if (fired >= 1) break;   // 每 turn 最多 1 个讲会·避刷屏
    }
    return fired;
  }

  function _kjpHResumeLectureIfPending() {
    if (typeof GM === 'undefined' || !GM) return;
    if (!Array.isArray(GM._kjpHLectureQueue) || !GM._kjpHLectureQueue.length) return;
    var curTurn = GM.turn || 0;
    GM._kjpHLectureQueue = GM._kjpHLectureQueue.filter(function(pending) {
      var staleTurns = curTurn - (pending.startTurn || 0);
      if (staleTurns > LECTURE_QUEUE_TIMEOUT_TURNS) {
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: curTurn,
            type: 'lecture_meeting',
            text: pending.year + '·' + pending.academyName + '·讲会 (记略散佚·LLM 失败)',
            tags: ['书院', '讲会', 'fallback'],
            academyName: pending.academyName
          });
        }
        return false;
      }
      return true;
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §15·H5·desk template suggestion (5 subtype·跟 G2/G3 paradigm 同)
  // ════════════════════════════════════════════════════════════════

  var SCHOOL_EDICT_TEMPLATES = {
    'ban':      { label: '⚠ 禁讲学',   body: '朕念书院讲学日炽·议政讥时·特禁讲学·钦此。' },
    'restore':  { label: '复立书院',   body: '朕念 {academy} 昔为正学渊薮·准复立·钦此。' },
    'found':    { label: '立官学',     body: '朕念兴学育才·立 {academy} 一所·特命学政主之·钦此。' },
    'promote':  { label: '扶书院',     body: '朕念 {academy} 学行可嘉·特赐田产·助其讲学·钦此。' },
    'lecture':  { label: '讲会',       body: '(讲会驱动·non-edict)' }
  };

  function _kjpHGetSchoolEdictTemplate(subtype, detail) {
    detail = detail || {};
    var tpl = SCHOOL_EDICT_TEMPLATES[subtype] || SCHOOL_EDICT_TEMPLATES['ban'];
    var academy = detail.academyName || detail.academy || 'X 书院';
    return {
      label: tpl.label,
      body:  tpl.body.replace('{academy}', academy)
    };
  }

  // S1 fix·UI label 朝代差异·汉/唐 礼部·宋后 学政·清 督学使
  function _kjpHGetXuezhengLabel() {
    var era = (P && P.scenario && P.scenario.era) || '';
    var s = String(era);
    if (/汉|tang|唐/i.test(s) || /^汉/.test(s)) return '礼部·议讲学';
    if (/清|qing/i.test(s) || /^清/.test(s)) return '督学使';
    if (/宋|song|明|ming/i.test(s) || /^宋|^明/.test(s)) return '学政';
    return '礼部·议讲学';
  }

  function _kjpHOnSchoolTriggerEnqueueDeskSuggestion(subtype, detail) {
    if (!_isHEnabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    var curY = _getCurYear();
    var curTurn = GM.turn || 1;
    // 幂等·同 subtype + 同年 + 同 academy·不重 push
    var detailKey = (detail && (detail.academyName || detail.academy)) || '';
    var existing = GM._edictSuggestions.find(function(s) {
      return s && s._schoolSubtype === subtype &&
             s._schoolEnqueuedYear === curY &&
             (s._schoolAcademyName || '') === detailKey;
    });
    if (existing) return;
    var template = _kjpHGetSchoolEdictTemplate(subtype, detail);
    GM._edictSuggestions.push({
      source:           subtype === 'ban' ? '书院·⚠禁讲' : '书院·建议',
      from:             _kjpHGetXuezhengLabel(),
      topic:            template.label,
      content:          template.body,
      turn:             curTurn,
      used:             false,
      // H supplemental (render 不读·内部 dup detect)
      _schoolSubtype:    subtype,
      _schoolBadge:      '🏛',
      _schoolEnqueuedYear: curY,
      _schoolAcademyName: detailKey
    });
  }

  // ════════════════════════════════════════════════════════════════
  // §16·H5·Path B·礼部/学政 wendui (跟 G2 _kjG2OpenLibuEnkeWendui paradigm)
  // ════════════════════════════════════════════════════════════════

  function _kjpHPickXuezhengLeader() {
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return null;
    // pick 礼部尚书 / 国子监祭酒 / 翰林学士 等
    var rx = /礼部尚书|国子监祭酒|翰林学士|学政|侍读学士|督学使/;
    var leader = GM.chars.find(function(c) {
      if (!c || c.alive === false) return false;
      var t = c.officialTitle || c.title || '';
      return rx.test(t);
    });
    if (leader) return leader;
    // fallback·任 high integrity scholar
    return GM.chars.find(function(c) {
      return c && c.alive !== false && c.intelligence >= 70 && (c.integrity || 0) >= 70;
    });
  }

  function _kjpHOpenLibuSchoolWendui() {
    if (!_isHEnabled()) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('书院系统未开 (H flag off)');
      }
      return false;
    }
    var thisYear = _getCurYear();
    if (GM._kjpHLibuWenduiLastYear === thisYear) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('本年已问过 ' + _kjpHGetXuezhengLabel() + '·明岁再议');
      }
      return false;
    }
    var leader = _kjpHPickXuezhengLeader();
    if (!leader) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('朝中无主学政之人·书院不可议');
      }
      return false;
    }
    GM._kjpHLibuWenduiLastYear = thisYear;
    if (typeof window === 'undefined' || typeof window.openWenduiModal !== 'function') {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('问对系统未 ship·可于御案下诏');
      }
      return false;
    }
    var tier = (GM._schoolNetwork && GM._schoolNetwork.tier) || 'nascent';
    var prefillStr = '【陛下密召】今日士林书院 ' + (
      tier === 'dominant' ? '尚盛·讲会议政日炽' :
      tier === 'active'   ? '中振·讲学有所议' :
      tier === 'banned'   ? '禁后·遗党犹聚' :
                            '初萌·宜扶宜禁'
    ) + '·卿之见?';
    window._kjpHSchoolWenduiContext = {
      leaderName:    leader.name,
      year:          thisYear,
      schoolTier:    tier,
      openedAtTurn:  (GM.turn || 1)
    };
    try {
      window.openWenduiModal(leader.name, 'cedui', prefillStr);
      return true;
    } catch(e) {
      try { console.warn('[H5] openWenduiModal 失败', e); } catch(_) {}
      window._kjpHSchoolWenduiContext = null;
      return false;
    }
  }

  function _kjpHOnSchoolWenduiClose(npcName) {
    if (typeof GM === 'undefined' || !GM) return false;
    var ctx = (typeof window !== 'undefined') ? window._kjpHSchoolWenduiContext : null;
    if (!ctx) return false;
    if (ctx.leaderName !== npcName) return false;
    var leader = (typeof findCharByName === 'function') ? findCharByName(npcName) : null;
    if (!leader) { window._kjpHSchoolWenduiContext = null; return false; }
    // 派生 stance·integrity + tier
    var integ = leader.integrity || 50;
    var tier = ctx.schoolTier;
    var combined = integ + (tier === 'dominant' ? -10 : tier === 'banned' ? +20 : 0);
    var stance = combined >= 80 ? 'support_school' :
                 combined <= 40 ? 'oppose_school' : 'caveat';
    if (stance === 'support_school') {
      _kjpHOnSchoolTriggerEnqueueDeskSuggestion('promote', {
        academyName: '上引书院',
        wenduiLeader: leader.name
      });
    } else if (stance === 'oppose_school') {
      _kjpHOnSchoolTriggerEnqueueDeskSuggestion('ban', {
        academyName: '议禁书院',
        wenduiLeader: leader.name
      });
    }
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_wendui_close',
        text: _getCurYear() + '·' + leader.name + '·议书院·stance=' + stance,
        tags: ['书院', '问对', stance]
      });
    }
    window._kjpHSchoolWenduiContext = null;
    return true;
  }

  // BB1-style nuke (跟 G2 / G3 同 paradigm)
  function _kjpHNukeStaleSchoolWenduiContext() {
    if (typeof window === 'undefined') return;
    if (!window._kjpHSchoolWenduiContext) return;
    if (typeof document !== 'undefined') {
      try {
        if (!document.getElementById('wendui-modal')) {
          window._kjpHSchoolWenduiContext = null;
        }
      } catch(_) {
        window._kjpHSchoolWenduiContext = null;
      }
    } else {
      window._kjpHSchoolWenduiContext = null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §17·H5·Path C·EDICT parser (诏令集成·strong keyword)
  // ════════════════════════════════════════════════════════════════

  function _kjpHParseSchoolFromEdictText(text) {
    if (!text || typeof text !== 'string') return null;
    // gate·loose match·任一 keyword + 书院/讲学 上下文 OR strong action
    var gate = /兴学|建学|禁讲|禁书院|立书院|扶书院|官化|复立|赐田.*书院|扶.*书院|书院.*禁|书院.*立|讲学/;
    if (!gate.test(text)) return null;
    var subtype = 'found';
    if (/禁讲|禁书院|罢讲会/.test(text))   subtype = 'ban';
    else if (/复立|复兴|重开/.test(text))    subtype = 'restore';
    else if (/官化|纳入官学/.test(text))    subtype = 'official';
    else if (/扶|赐田|助讲学/.test(text))   subtype = 'promote';
    else if (/立|建|兴学/.test(text))       subtype = 'found';
    var PATH_LABELS = {
      'ban':      '禁讲学',
      'restore':  '复立书院',
      'found':    '立官学',
      'official': '官化书院',
      'promote':  '扶书院'
    };
    return {
      type:        'school',
      category:    'school',
      subtype:     subtype,
      text:        text,
      historyPath: PATH_LABELS[subtype],
      year:        _getCurYear()
    };
  }

  function _kjpHScanCtxInputEdictsForSchool(edicts) {
    if (!edicts) return [];
    var out = [];
    if (typeof edicts === 'string') {
      var a = _kjpHParseSchoolFromEdictText(edicts);
      if (a) out.push(a);
    } else if (typeof edicts === 'object') {
      ['political', 'military', 'diplomatic', 'economic'].forEach(function(key) {
        var t = edicts[key];
        if (t && typeof t === 'string') {
          var a2 = _kjpHParseSchoolFromEdictText(t);
          if (a2) {
            a2._sourceCategory = key;
            out.push(a2);
          }
        }
      });
      if (Array.isArray(edicts)) {
        edicts.forEach(function(e) {
          var t2 = (typeof e === 'string') ? e : (e && e.text);
          if (!t2) return;
          var a3 = _kjpHParseSchoolFromEdictText(t2);
          if (a3) out.push(a3);
        });
      }
    }
    return out;
  }

  // KEYI_TOPIC_TYPES.school_ban callback·H3 接·禁/容/扶 3 路径
  function _kjSchoolBanKeyiCallback(method, ctx) {
    if (!_isHEnabled()) return;
    ctx = ctx || {};
    var td = ctx.topicData || {};
    var school = td.school || td.academyName || '';
    var outcome = method;   // ban / tolerate / promote
    if (!ctx.passed) return;
    if (outcome === 'ban' || method === 'ban') {
      _kjpOnSchoolBanned(school, td.reason || '议罢讲学');
    } else if (outcome === 'promote' || method === 'promote') {
      // 通过·扶书院·影响力 +10·若 banned 自动 restore
      var academies = (GM._schoolNetwork && GM._schoolNetwork.academies) || [];
      var ax = academies.find(function(a) { return a && a.name === school; });
      if (ax) {
        if (ax.lifecycle === 'banned') {
          _kjpOnSchoolRestored(school);
        }
        ax.influence = Math.min(100, (ax.influence || 30) + 10);
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1, type: 'school_promoted',
            text: _getCurYear() + '·议·扶' + school + '·influence +10',
            tags: ['书院', '扶'], academyName: school
          });
        }
      }
    }
    // tolerate (容)·noop·chronicle 一笔
    else if (outcome === 'tolerate' || method === 'tolerate' || method === 'council') {
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1, type: 'school_tolerated',
          text: _getCurYear() + '·议·容' + school + '·维持现状',
          tags: ['书院', '容'], academyName: school
        });
      }
    }
  }

  function _kjpHOnSchoolApprovedViaEdict(action) {
    if (!_isHEnabled()) return null;
    if (!action || action.type !== 'school') return null;
    var subtype = action.subtype || 'found';
    // dispatch to lifecycle handler (复用 §3/§4 主入口)
    if (subtype === 'ban') {
      // 默认 ban 最旧 active academy (real impl·user 选)
      var academies = _kjpGetActiveAcademies();
      if (academies.length > 0) _kjpOnSchoolBanned(academies[0].name, '诏令禁讲学');
    } else if (subtype === 'restore') {
      var banned = (GM._schoolNetwork && GM._schoolNetwork.academies || []).find(function(a) {
        return a && a.lifecycle === 'banned';
      });
      if (banned) _kjpOnSchoolRestored(banned.name);
    } else if (subtype === 'official') {
      var activeA = _kjpGetActiveAcademies();
      if (activeA.length > 0) _kjpOnSchoolOfficialized(activeA[0].name);
    } else if (subtype === 'found') {
      _kjpOnSchoolFounding({
        name: '官立书院 ' + _getCurYear(),
        founder: '',
        foundedYear: _getCurYear(),
        faction: '官学化',
        region: '京师'
      });
    }
    return action;
  }

  // ════════════════════════════════════════════════════════════════
  // §18·H6·incident hookup 深·山长被押 → F4c yanguan-qingyi 真触
  // ════════════════════════════════════════════════════════════════

  // 禁讲学 → 山长被押·走 _kjSpawnYanguanQingyi (跟 G3 BB·真签名 3 positional)
  function _kjpHOnShanzhangImpeached(shanzhangName, reason) {
    if (!_isHEnabled()) return false;
    if (!shanzhangName) return false;
    if (typeof GM === 'undefined' || !GM) return false;
    // 找山长 char + party
    var ch = (typeof findCharByName === 'function') ? findCharByName(shanzhangName) : null;
    if (!ch || ch._origin !== 'shanzhang') return false;
    var party = ch.party || '';
    if (!party) return false;
    // 真触 F4c·复用 _kjSpawnYanguanQingyi
    var fired = false;
    if (typeof window !== 'undefined' && typeof window._kjSpawnYanguanQingyi === 'function') {
      try {
        fired = !!window._kjSpawnYanguanQingyi(
          party,
          shanzhangName,
          (reason || '禁讲学') + '·山长 ' + shanzhangName + ' 被押·清议大起'
        );
      } catch(_) {}
    }
    // fallback chronicle
    if (!fired && Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'shanzhang_impeached',
        text: _getCurYear() + '·' + shanzhangName + '·被押 (' + (reason || '禁讲学') + ')·' + party + '·清议',
        tags: ['书院', '山长', '被押', party]
      });
    }
    return true;
  }

  // 山长被赐死/狱死 → spawn 反弹党·M1·max 1 per watershed·merge 同期
  function _kjpHOnShanzhangMartyred(shanzhangName, watershedKey) {
    if (!_isHEnabled()) return null;
    if (!shanzhangName) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    var ch = (typeof findCharByName === 'function') ? findCharByName(shanzhangName) : null;
    if (!ch) return null;
    // mark dead
    ch.alive = false;
    var party = ch.party || '';
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'shanzhang_martyred',
        text: _getCurYear() + '·' + shanzhangName + '·狱死·' + party,
        tags: ['书院', '山长', '殉党', party]
      });
    }
    // H5 cap·spawn 反弹党 per watershed
    var wsKey = watershedKey || ('shanzhang-died:' + _getCurYear());
    if (!GM._kjpHRebelPartySpawnedThisWatershed) GM._kjpHRebelPartySpawnedThisWatershed = {};
    if (GM._kjpHRebelPartySpawnedThisWatershed[wsKey]) return null;   // 已 spawn·skip
    GM._kjpHRebelPartySpawnedThisWatershed[wsKey] = true;
    var rebelName = (party || '士林') + '遗党';
    if (Array.isArray(GM.parties) && GM.parties.some(function(p) { return p.name === rebelName; })) {
      return null;
    }
    // 走 _ty3_partySpawn
    var rebelParty = null;
    if (typeof window !== 'undefined' && typeof window._ty3_partySpawn === 'function') {
      try {
        rebelParty = window._ty3_partySpawn({
          name:    rebelName,
          founders: [],
          leaderName: '',
          faction:  '',
          initialInfluence: 15,
          initialCohesion:  90,
          ideology: '反正统·复义·遗党',
          policyStances: ['anti-当朝', 'pro-书院', 'pro-清议'],
          reason: shanzhangName + ' 殉党·遗党自结',
          agenda: '复正学·复君子',
          desc: shanzhangName + ' 死·士林遗党凝聚',
          status: 'underground'
        });
      } catch(_) {}
    }
    // fallback
    if (!rebelParty) {
      if (!Array.isArray(GM.parties)) GM.parties = [];
      rebelParty = {
        name: rebelName, leader: '', faction: '',
        influence: 15, cohesion: 90,
        ideology: '反正统·复义·遗党',
        members: '', memberCount: 0,
        policyStance: ['anti-当朝', 'pro-书院', 'pro-清议'],
        foundYear: _getCurYear(), foundTurn: GM.turn || 0,
        status: 'underground', desc: shanzhangName + ' 死·遗党',
        currentAgenda: '复正学'
      };
      GM.parties.push(rebelParty);
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: '党祸·遗党生',
          text: _getCurYear() + '·' + rebelName + ' 起·' + shanzhangName + ' 殉党',
          tags: ['党派', '遗党', rebelName]
        });
      }
    }
    return rebelParty;
  }

  // ════════════════════════════════════════════════════════════════
  // §19·H7·地理 attach + 民心扩
  // ════════════════════════════════════════════════════════════════

  // academy.region → 影响 prov._bonusInfra.kejuQuota (province level) + 民心
  function _kjpHApplyRegionEffects(academy) {
    if (!_isHEnabled()) return;
    if (!academy || !academy.region) return;
    if (typeof GM === 'undefined' || !GM) return;
    // 找 prov (若 GM.provinces 存)·真接 eb.kejuQuota
    if (Array.isArray(GM.provinces)) {
      var prov = GM.provinces.find(function(p) { return p && p.name === academy.region; });
      if (prov) {
        if (!prov._bonusInfra) prov._bonusInfra = {};
        if (typeof prov._bonusInfra.kejuQuota !== 'number') prov._bonusInfra.kejuQuota = 0;
        if (academy.lifecycle === 'flourishing' || academy.lifecycle === 'founding') {
          prov._bonusInfra.kejuQuota += 1;
        } else if (academy.lifecycle === 'banned') {
          prov._bonusInfra.kejuQuota = Math.max(0, prov._bonusInfra.kejuQuota - 1);
        }
      }
    }
    // 派生·academy.region attach 到 paradigm.quota.geo
    if (GM._kejuParadigm && GM._kejuParadigm.quota && GM._kejuParadigm.quota.geo) {
      var geoMap = { '南': /南|江|杭|无锡|苏|长沙|庐山|商丘/, '北': /北|京|燕|蓟|关中|西安|登封/ };
      var geo = '中';
      if (geoMap['南'].test(academy.region)) geo = '南';
      else if (geoMap['北'].test(academy.region)) geo = '北';
      if (typeof GM._kejuParadigm.quota.geo[geo] === 'number') {
        if (academy.lifecycle === 'flourishing' || academy.lifecycle === 'founding') {
          GM._kejuParadigm.quota.geo[geo] = Math.min(99, GM._kejuParadigm.quota.geo[geo] + 1);
        } else if (academy.lifecycle === 'banned') {
          GM._kejuParadigm.quota.geo[geo] = Math.max(0, GM._kejuParadigm.quota.geo[geo] - 1);
        }
      }
    }
  }

  // G2 enke jinshi spawn 时·跟 academy.region 匹配·set _academyOrigin
  function _kjpHTagJinshiFromRegion(jinshi) {
    if (!_isHEnabled()) return;
    if (!jinshi || !jinshi.birthplace) return;
    if (typeof GM === 'undefined' || !GM || !GM._schoolNetwork) return;
    var matchedAcademy = GM._schoolNetwork.academies.find(function(a) {
      return a && a.region && (a.region === jinshi.birthplace || jinshi.birthplace.indexOf(a.region) >= 0);
    });
    if (matchedAcademy) {
      jinshi._academyOrigin = matchedAcademy.name;
      if (matchedAcademy.associatedParty || matchedAcademy.faction) {
        // 若 jinshi 无党·入 academy 党
        if (!jinshi.party && matchedAcademy.faction) {
          var partyTrigger = SCHOOL_PARTY_TRIGGERS[matchedAcademy.faction];
          if (partyTrigger) jinshi.party = partyTrigger.name;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §20·H8·反馈循环闭环·朝廷腐败 ↔ 书院兴
  // ════════════════════════════════════════════════════════════════

  var FEEDBACK_COOLDOWNS = {
    'literati-academy-rise': 10,
    'student-protest':       5,
    'school-faction-spike':  5
  };

  function _kjpHCheckFeedbackTrigger(triggerKey, currentYear) {
    if (!GM._kjpHFeedbackCooldown) GM._kjpHFeedbackCooldown = {};
    var lastFire = GM._kjpHFeedbackCooldown[triggerKey] || 0;
    var cd = FEEDBACK_COOLDOWNS[triggerKey] || 5;
    if (lastFire && (currentYear - lastFire) < cd) return false;
    // per-turn guard
    if (!GM._kjpHFeedbackFiredThisTurn) GM._kjpHFeedbackFiredThisTurn = {};
    var curTurn = GM.turn || 0;
    if (GM._kjpHFeedbackFiredThisTurn._turn !== curTurn) {
      GM._kjpHFeedbackFiredThisTurn = { _turn: curTurn };
    }
    if (GM._kjpHFeedbackFiredThisTurn[triggerKey]) return false;
    GM._kjpHFeedbackFiredThisTurn[triggerKey] = true;
    GM._kjpHFeedbackCooldown[triggerKey] = currentYear;
    return true;
  }

  // 朝廷腐败 + 党争 → 民间书院兴
  function _kjpHTickFeedbackLoop() {
    if (!_isHEnabled()) return 0;
    if (typeof GM === 'undefined' || !GM) return 0;
    var fired = 0;
    // R1·F1·真接口·GM.corruption.subDepts.* 派生·非 GM._corruption (不存)
    var corruption = 0;
    if (typeof GM._corruption === 'number') corruption = GM._corruption;
    else if (GM.corruption && GM.corruption.subDepts) {
      var subs = GM.corruption.subDepts;
      var fc = (subs.fiscal && subs.fiscal.true) || 0;
      var pc = (subs.provincial && subs.provincial.true) || 0;
      var mc = (subs.military && subs.military.true) || 0;
      corruption = Math.round((fc + pc + mc) / 3);
    } else if (GM.vars && GM.vars['吏治']) {
      corruption = 100 - (parseInt(GM.vars['吏治'].value, 10) || 50);
    }
    var tension = (typeof GM.partyStrife === 'number') ? GM.partyStrife :
                  ((typeof GM._factionTension === 'number') ? GM._factionTension : 0);
    var curY = _getCurYear();
    // 民间书院兴·corruption ≥60 + tension ≥70
    if (corruption >= 60 && tension >= 70) {
      if (_kjpHCheckFeedbackTrigger('literati-academy-rise', curY)) {
        var spawnedAcademy = _kjpOnSchoolFounding({
          name: '民间书院·' + curY,
          founder: '',
          foundedYear: curY,
          faction: '实学',
          region: '',
          influence: 25
        });
        if (spawnedAcademy && Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1, type: 'feedback_literati_rise',
            text: curY + '·朝政腐·士林讥·民间书院兴 (corruption ' + corruption + ', tension ' + tension + ')',
            tags: ['书院', '反馈', '腐败', '党争']
          });
        }
        fired++;
      }
    }
    return fired;
  }

  // ════════════════════════════════════════════════════════════════
  // §21·H9·watershed event·5 historical watershed·按年触
  // ════════════════════════════════════════════════════════════════

  var WATERSHED_EVENTS = [
    { year: 1190, name: '朱熹理学官学化', action: 'subject-boost', subjectId: 'lixue', delta: 30 },
    { year: 1290, name: '元至元 27 年·书院官化', action: 'officialize-all', triggerEra: /元|yuan/ },
    { year: 1500, name: '王阳明心学起', action: 'subject-add', subjectId: 'xinxue' },
    { year: 1604, name: '东林书院·顾宪成立', action: 'party-spawn', partyName: '东林党' },
    { year: 1622, name: '首善书院禁', action: 'ban-academy', academyName: '首善书院' },
    { year: 1625, name: '东林六君子狱', action: 'rebel-party' },
    { year: 1629, name: '复社·张溥立', action: 'party-spawn', partyName: '复社' },
    { year: 1654, name: '顺治禁讲学', action: 'ban-all', triggerEra: /清|qing/ },
    { year: 1742, name: '乾隆重立省城书院', action: 'restore-all', triggerEra: /清|qing/ }
  ];

  function _kjpHCheckWatershedEvents() {
    if (!_isHEnabled()) return 0;
    if (typeof GM === 'undefined' || !GM) return 0;
    var curY = _getCurYear();
    if (!GM._kjpHWatershedFired) GM._kjpHWatershedFired = {};
    var fired = 0;
    var era = (P && P.scenario && P.scenario.era) || '';
    WATERSHED_EVENTS.forEach(function(ws) {
      // 仅当年触
      if (curY !== ws.year) return;
      if (GM._kjpHWatershedFired[ws.name]) return;
      // era gate
      if (ws.triggerEra && !ws.triggerEra.test(String(era))) return;
      GM._kjpHWatershedFired[ws.name] = true;
      _kjpHApplyWatershed(ws);
      fired++;
    });
    return fired;
  }

  function _kjpHApplyWatershed(ws) {
    var curY = _getCurYear();
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'school_watershed',
        text: curY + '·watershed·' + ws.name,
        tags: ['书院', 'watershed', ws.action || '']
      });
    }
    if (ws.action === 'officialize-all') {
      var active = _kjpGetActiveAcademies();
      active.forEach(function(a) { _kjpOnSchoolOfficialized(a.name); });
    } else if (ws.action === 'ban-all') {
      var active2 = _kjpGetActiveAcademies();
      active2.forEach(function(a) { _kjpOnSchoolBanned(a.name, ws.name); });
    } else if (ws.action === 'restore-all') {
      if (GM._schoolNetwork && Array.isArray(GM._schoolNetwork.academies)) {
        GM._schoolNetwork.academies.forEach(function(a) {
          if (a && a.lifecycle === 'banned') _kjpOnSchoolRestored(a.name);
        });
      }
    } else if (ws.action === 'ban-academy' && ws.academyName) {
      _kjpOnSchoolBanned(ws.academyName, ws.name);
    } else if (ws.action === 'party-spawn' && ws.partyName) {
      // H6 dedupe·若 party 已存·skip
      if (Array.isArray(GM.parties) && GM.parties.some(function(p) { return p.name === ws.partyName; })) {
        return;
      }
      if (typeof window !== 'undefined' && typeof window._ty3_partySpawn === 'function') {
        try {
          window._ty3_partySpawn({
            name: ws.partyName, founders: [],
            ideology: '历史·watershed', reason: ws.name,
            agenda: '历史 watershed event·' + ws.name,
            status: 'active'
          });
        } catch(_) {}
      }
    } else if (ws.action === 'subject-boost' && ws.subjectId) {
      if (GM._kejuParadigm && Array.isArray(GM._kejuParadigm.subjects)) {
        var subj = GM._kejuParadigm.subjects.find(function(s) { return s && s.id === ws.subjectId; });
        if (subj) subj.weight = Math.min(100, (subj.weight || 0) + (ws.delta || 10));
      }
    } else if (ws.action === 'subject-add' && ws.subjectId) {
      if (GM._kejuParadigm && Array.isArray(GM._kejuParadigm.subjects)) {
        var existing = GM._kejuParadigm.subjects.find(function(s) { return s && s.id === ws.subjectId; });
        if (!existing) {
          var subjMap = LEARNING_TO_SUBJECT[ws.subjectId === 'xinxue' ? '心学' : ws.subjectId === 'lixue' ? '理学' : ws.subjectId];
          if (subjMap) {
            GM._kejuParadigm.subjects.push({
              id: subjMap.id, name: subjMap.name, weight: 10,
              ideology: subjMap.ideology, format: subjMap.format,
              historicalAnalog: subjMap.historicalAnalog,
              introducedYear: curY, introducedBy: 'watershed·' + ws.name,
              maxScore: 100, customFields: {}
            });
          }
        }
      }
    } else if (ws.action === 'rebel-party') {
      _kjpHOnShanzhangMartyred('东林六君子', 'watershed:' + ws.name);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // §22·H10·字段深生成·5 archetype + LLM tone 配置 (已有 §11·H10 加 academy 字段深)
  // ════════════════════════════════════════════════════════════════

  // 已 done·§11 archetype·此 slot 加 academy schema 深字段填 (founding 时补)
  function _kjpHEnrichAcademyFields(academy) {
    if (!academy) return;
    // 详细 schema (跟 v2 doc §H10 对齐)
    if (academy.ideology == null) {
      academy.ideology = academy.faction === '东林' ? 'reformist' :
                         academy.faction === '复社' ? 'reformist' :
                         academy.faction === '心学' ? 'reformist' :
                         academy.faction === '理学' ? 'traditional' : 'practical';
    }
    if (!academy.curriculum) {
      academy.curriculum = academy.faction === '东林' ? ['四书', '五经', '时务'] :
                           academy.faction === '心学' ? ['传习录', '大学问'] :
                           academy.faction === '理学' ? ['四书', '五经', '近思录'] :
                           ['四书', '五经'];
    }
    if (academy.historicalNote == null) {
      academy.historicalNote = '';
    }
    if (!Array.isArray(academy.events)) academy.events = [];
    if (academy._discipleCount == null) academy._discipleCount = 0;
  }

  // ════════════════════════════════════════════════════════════════
  // §8·expose
  // ════════════════════════════════════════════════════════════════

  if (typeof window !== 'undefined') {
    window._isHEnabled                 = _isHEnabled;
    window._kjpInitSchoolNetwork       = _kjpInitSchoolNetwork;
    window._kjpOnSchoolFounding        = _kjpOnSchoolFounding;
    window._kjpOnSchoolBanned          = _kjpOnSchoolBanned;
    window._kjpOnSchoolRestored        = _kjpOnSchoolRestored;
    window._kjpOnSchoolOfficialized    = _kjpOnSchoolOfficialized;
    window._kjpSpawnShanzhang          = _kjpSpawnShanzhang;
    window._kjpCalcSchoolNetworkTier   = _kjpCalcSchoolNetworkTier;
    window._kjpGetActiveAcademies      = _kjpGetActiveAcademies;
    window._kjpResumeIfPending         = _kjpResumeIfPending;
    window._kjpHEventOnSchoolFounding  = _kjpHEventOnSchoolFounding;
    window._kjpHEventOnSchoolBanned    = _kjpHEventOnSchoolBanned;
    // H2 (Slice 9-12)
    window._kjpMaybeSpawnSchoolParty   = _kjpMaybeSpawnSchoolParty;
    window._kjpBuildShanzhangLineage   = _kjpBuildShanzhangLineage;
    window._kjpGetShanzhangToneHint    = _kjpGetShanzhangToneHint;
    window._kjpInferShanzhangArchetype = _kjpInferShanzhangArchetype;
    window._kjpGetSchoolPartyTinyiAffinityBonus = _kjpGetSchoolPartyTinyiAffinityBonus;
    // H3 (Slice 13)·学说改 paradigm.subjects
    window._kjpMapLearningToSubject      = _kjpMapLearningToSubject;
    window._kjpHTickSubjectWeightDrift   = _kjpHTickSubjectWeightDrift;
    window._kjpHEnqueueParadigmShiftKeyi = _kjpHEnqueueParadigmShiftKeyi;
    window._kjpHDetectParadigmShiftCandidate = _kjpHDetectParadigmShiftCandidate;
    // H4 (Slice 14)·讲会 LLM
    window._kjpHPickLectureTemplate      = _kjpHPickLectureTemplate;
    window._kjpHBuildLectureMeetingPrompt = _kjpHBuildLectureMeetingPrompt;
    window._kjpHGenLectureMeetingFallback = _kjpHGenLectureMeetingFallback;
    window._kjpHRunLectureMeetingLLM     = _kjpHRunLectureMeetingLLM;
    window._kjpHResumeLectureIfPending   = _kjpHResumeLectureIfPending;
    window._kjpHMaybeAutoTriggerLecture  = _kjpHMaybeAutoTriggerLecture;
    // H5 (Slice 15-17)·玩家 4 路径议政
    window._kjpHGetSchoolEdictTemplate   = _kjpHGetSchoolEdictTemplate;
    window._kjpHGetXuezhengLabel         = _kjpHGetXuezhengLabel;
    window._kjpHOnSchoolTriggerEnqueueDeskSuggestion = _kjpHOnSchoolTriggerEnqueueDeskSuggestion;
    window._kjpHPickXuezhengLeader       = _kjpHPickXuezhengLeader;
    window._kjpHOpenLibuSchoolWendui     = _kjpHOpenLibuSchoolWendui;
    window._kjpHOnSchoolWenduiClose      = _kjpHOnSchoolWenduiClose;
    window._kjpHNukeStaleSchoolWenduiContext = _kjpHNukeStaleSchoolWenduiContext;
    window._kjpHParseSchoolFromEdictText = _kjpHParseSchoolFromEdictText;
    window._kjpHScanCtxInputEdictsForSchool = _kjpHScanCtxInputEdictsForSchool;
    window._kjpHOnSchoolApprovedViaEdict = _kjpHOnSchoolApprovedViaEdict;
    window._kjSchoolBanKeyiCallback      = _kjSchoolBanKeyiCallback;
    // H6·incident hookup
    window._kjpHOnShanzhangImpeached     = _kjpHOnShanzhangImpeached;
    window._kjpHOnShanzhangMartyred      = _kjpHOnShanzhangMartyred;
    // H7·地理 + 民心
    window._kjpHApplyRegionEffects       = _kjpHApplyRegionEffects;
    window._kjpHTagJinshiFromRegion      = _kjpHTagJinshiFromRegion;
    // H8·反馈循环
    window._kjpHCheckFeedbackTrigger     = _kjpHCheckFeedbackTrigger;
    window._kjpHTickFeedbackLoop         = _kjpHTickFeedbackLoop;
    // H9·watershed
    window._kjpHCheckWatershedEvents     = _kjpHCheckWatershedEvents;
    window._kjpHApplyWatershed           = _kjpHApplyWatershed;
    // H10·字段深
    window._kjpHEnrichAcademyFields      = _kjpHEnrichAcademyFields;
    // re-expose wrapper (覆 §3 原)
    window._kjpOnSchoolFounding        = _kjpOnSchoolFounding;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _isHEnabled:                _isHEnabled,
      _kjpInitSchoolNetwork:      _kjpInitSchoolNetwork,
      _kjpOnSchoolFounding:       _kjpOnSchoolFounding,
      _kjpOnSchoolBanned:         _kjpOnSchoolBanned,
      _kjpOnSchoolRestored:       _kjpOnSchoolRestored,
      _kjpOnSchoolOfficialized:   _kjpOnSchoolOfficialized,
      _kjpSpawnShanzhang:         _kjpSpawnShanzhang,
      _kjpCalcSchoolNetworkTier:  _kjpCalcSchoolNetworkTier,
      _kjpGetActiveAcademies:     _kjpGetActiveAcademies,
      _kjpResumeIfPending:        _kjpResumeIfPending,
      _kjpHEventOnSchoolFounding: _kjpHEventOnSchoolFounding,
      _kjpHEventOnSchoolBanned:   _kjpHEventOnSchoolBanned,
      _kjpMaybeSpawnSchoolParty:  _kjpMaybeSpawnSchoolParty,
      _kjpBuildShanzhangLineage:  _kjpBuildShanzhangLineage,
      _kjpGetShanzhangToneHint:   _kjpGetShanzhangToneHint,
      _kjpInferShanzhangArchetype: _kjpInferShanzhangArchetype,
      _kjpGetSchoolPartyTinyiAffinityBonus: _kjpGetSchoolPartyTinyiAffinityBonus,
      _kjpMapLearningToSubject:    _kjpMapLearningToSubject,
      _kjpHTickSubjectWeightDrift: _kjpHTickSubjectWeightDrift,
      _kjpHEnqueueParadigmShiftKeyi: _kjpHEnqueueParadigmShiftKeyi,
      _kjpHDetectParadigmShiftCandidate: _kjpHDetectParadigmShiftCandidate,
      _kjpHPickLectureTemplate:    _kjpHPickLectureTemplate,
      _kjpHBuildLectureMeetingPrompt: _kjpHBuildLectureMeetingPrompt,
      _kjpHGenLectureMeetingFallback: _kjpHGenLectureMeetingFallback,
      _kjpHRunLectureMeetingLLM:   _kjpHRunLectureMeetingLLM,
      _kjpHResumeLectureIfPending: _kjpHResumeLectureIfPending,
      _kjpHGetSchoolEdictTemplate: _kjpHGetSchoolEdictTemplate,
      _kjpHGetXuezhengLabel:       _kjpHGetXuezhengLabel,
      _kjpHOnSchoolTriggerEnqueueDeskSuggestion: _kjpHOnSchoolTriggerEnqueueDeskSuggestion,
      _kjpHPickXuezhengLeader:     _kjpHPickXuezhengLeader,
      _kjpHOpenLibuSchoolWendui:   _kjpHOpenLibuSchoolWendui,
      _kjpHOnSchoolWenduiClose:    _kjpHOnSchoolWenduiClose,
      _kjpHNukeStaleSchoolWenduiContext: _kjpHNukeStaleSchoolWenduiContext,
      _kjpHParseSchoolFromEdictText: _kjpHParseSchoolFromEdictText,
      _kjpHScanCtxInputEdictsForSchool: _kjpHScanCtxInputEdictsForSchool,
      _kjpHOnSchoolApprovedViaEdict: _kjpHOnSchoolApprovedViaEdict,
      _kjSchoolBanKeyiCallback:     _kjSchoolBanKeyiCallback,
      _kjpHOnShanzhangImpeached:    _kjpHOnShanzhangImpeached,
      _kjpHOnShanzhangMartyred:     _kjpHOnShanzhangMartyred,
      _kjpHApplyRegionEffects:      _kjpHApplyRegionEffects,
      _kjpHTagJinshiFromRegion:     _kjpHTagJinshiFromRegion,
      _kjpHCheckFeedbackTrigger:    _kjpHCheckFeedbackTrigger,
      _kjpHTickFeedbackLoop:        _kjpHTickFeedbackLoop,
      _kjpHCheckWatershedEvents:    _kjpHCheckWatershedEvents,
      _kjpHApplyWatershed:          _kjpHApplyWatershed,
      _kjpHEnrichAcademyFields:     _kjpHEnrichAcademyFields
    };
  }
})();
