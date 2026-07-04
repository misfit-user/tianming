// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（§ 已在正文标注·此处为顶层索引；grep §N 跳转）──
//   武举主 runner + 校阅大典 + 派镇 + 战功 + 武勋世家（Phase G·G3·standalone mini-runner）
//   §1-5   主考 pick / 元朝 gate / 和平期贬值 / pool count / 武进士字段（5 archetype）
//   §6-9   外场成绩 / 赐物（校阅大典）/ 派镇（scan officeTree 非硬编 9 边镇）/ mark+spawn
//   §10-13 校阅大典 LLM / 武勋派 / 兵谏黑天鹅 / 兵议体题目
//   §14-17 主入口 _kjG3OnWujuApproved / 武勋世家 / 战功联动 / 长尾（health 损耗·战死·荫袭）
//   §18-22 清末废武举 / LLM dialog tone / G1→keyi promote bridge / EDICT parser（Path C）/ RAA fixes
// ─────────────────────────────────────────────
/**
 * tm-keju-wuju.js — Phase G·G3·武举主 runner + 校阅大典 + 派镇 + 战功 + 武勋世家
 *
 * paradigm·跟 G2 enke.js 同·standalone mini-runner·不嵌进 9-tier 常科 runtime
 *   - 自然 trigger (G1 wuju 已 ship) / Path B 兵部 wendui / Path C 诏令 三路径
 *   - 跳过童试·直接 3 试 + 校阅大典·spawn 武进士入兵部 / 边镇
 *   - 校阅大典 LLM·跟 G2 谢恩大典完全不同风格 (御前演武 + 赐物)
 *   - 派镇·scan GM.officeTree 找 镇/营/卫 office nodes (C2 fix·非 hard-code 9 边镇)
 *   - 战功·war_state + valor + military + era 加权·dynamic 概率
 *   - 武勋世家·≥2 同姓 → 杨家将/岳家军 paradigm + 荫袭
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuG3=false 全 no-op
 *   - 不发 modal (chronicle + suggestion 为主)
 *   - 严禁玄幻·全自然军政后果
 *
 * Public API·
 *   _kjG3OnWujuApproved(subtype, td)           — 主入口·三路径汇合
 *   _kjG3OnWujuRejected(td)                    — keyi reject·军心动摇
 *   _kjG3OnWujuDeferred(td)                    — 推迟 2 turn re-spawn
 *   _kjG3PickWujuChiefExaminer()               — 主考·朝代 regex
 *   _kjG3RunWuJiaoyueDaCeremony(list, cb)      — 校阅大典 LLM
 *   _kjG3ResumeWuJiaoyueDaIfPending()          — resume hook
 *   _kjG3MarkWujinshi(wujinshi, ...)           — 武进士标记 + multiplier apply
 *   _kjG3SpawnWujinshiPool(td, examiner)       — 生 N 名 stub 武进士入 GM.chars
 *   _kjG3DecorateSpawnedEntryForKeyi(entry)    — G1 spawn → keyi promote
 *   _kjG3InitPeacefulCounter()                 — peaceful counter init
 *   _kjG3TickPeacefulCounter()                 — peaceful counter +1 year
 *   _kjG3ResetPeacefulCounter()                — peaceful counter reset (war back)
 *   _kjG3CalcWujuPeacefulMultiplier()          — 4 档·1.0/0.8/0.5/0.3
 *   _kjG3CalcEnkeJinshiQualityProfile()         (武进士也有 quality profile·按 peaceful)
 *   _kjG3ApplyWuxiangshiRewards(wujinshi)       — 赐物 explicit resources.privateWealth
 *   _kjG3GetAvailableDepots()                   — scan GM.officeTree 边镇 (C2 fix)
 *   _kjG3AssignWujinshiToDepot(wujinshi, scores) — 派镇·跟现 char.officialTitle 一致
 *   _kjG3MaybeAddBattleRecord(wujinshi)         — 战功·dynamic prob
 *   _kjG3DetectMartialClan()                    — 世家检测·≥2 同姓
 *   _kjG3IsQingLateEra()                        — 清末 1898+ gate
 *   _kjG3CheckWujuAbolitionTrigger()            — 废武举 keyi 议程
 *   _kjG3GetWuToneHint(ch)                      — LLM dialog 5 archetype tone
 *   _kjG3MaybeFireMilitaryCoupRisk()            — 兵谏黑天鹅 (复用 _kjSpawnYanguanQingyi 3-arg)
 *   _kjG3ParseWujuFromEdictText(text)           — 诏令 parser (strong keyword)
 *   _kjG3OnWujuApprovedViaEdict(action)         — Path C edict hook
 *   _kjG3WujinshiHealthTick()                   — 长尾·health 损耗 + 战死
 *
 * 依赖·
 *   - GM (mutate _wujuHistory / _wujuParty / _martialClans / _wujuPeacefulCounter / chars)
 *   - P.conf.useNewKejuG3 (gate)
 *   - GM.vars['边事'] (war_state read)
 *   - GM.officeTree (派镇 scan)
 *   - _kjSpawnYanguanQingyi(party, attackedMember, eventDetail) (兵谏·real signature)
 *   - openKeyiSession(topicType, topicData) (清末废武举·positional)
 *   - callAI (LLM·optional·fallback)
 *   - findCharByName / _logChronicle
 */
(function() {
  'use strict';

  var XIEENDA_TIMEOUT_TURNS = 3;
  var WUJU_HEALTH_TICK_PROB = 0.05;       // 5%/turn·war_state≥60 时 health -5

  function _isG3Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuG3 !== false; // 默认开·2026-06-14·武举解锁
  }

  function _getCurYear() {
    if (typeof GM === 'undefined' || !GM) return 0;
    return GM.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  function _getWarState() {
    if (typeof GM === 'undefined' || !GM || !GM.vars) return 0;
    var v = GM.vars['边事'];
    if (!v) return 0;
    return parseInt(v.value, 10) || 0;
  }

  // ─── §1·主考 pick·朝代-aware 兵系 regex ───

  var WUJU_CHIEF_EXAMINER_TITLE_REGEX = {
    tang:    /兵部尚书|大将军|节度使|招讨使/,
    song:    /枢密使|签书枢密院事|兵部尚书|经略安抚使/,
    ming:    /兵部尚书|总督|提督|总兵|协办大学士/,
    qing:    /兵部尚书|大学士|军机大臣|提督|总督/,
    default: /兵部|枢密|总督|提督|总兵|大将军/
  };

  function _kjG3GetChiefExaminerRegex() {
    if (typeof P === 'undefined' || !P || !P.scenario) return WUJU_CHIEF_EXAMINER_TITLE_REGEX.default;
    var era = String(P.scenario.era || '').toLowerCase();
    if (/唐|tang/i.test(era)) return WUJU_CHIEF_EXAMINER_TITLE_REGEX.tang;
    if (/宋|song/i.test(era)) return WUJU_CHIEF_EXAMINER_TITLE_REGEX.song;
    if (/明|ming/i.test(era)) return WUJU_CHIEF_EXAMINER_TITLE_REGEX.ming;
    if (/清|qing/i.test(era)) return WUJU_CHIEF_EXAMINER_TITLE_REGEX.qing;
    return WUJU_CHIEF_EXAMINER_TITLE_REGEX.default;
  }

  function _kjG3PickWujuChiefExaminer() {
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return null;
    var rx = _kjG3GetChiefExaminerRegex();
    var cands = GM.chars.filter(function(c) {
      if (!c || c.alive === false || c._retired) return false;
      var t = c.officialTitle || c.title || '';
      return rx.test(t);
    });
    if (!cands.length) {
      // 退化·valor 高的 chars
      cands = GM.chars.filter(function(c) {
        if (!c || c.alive === false || c._retired) return false;
        return (c.valor || 0) >= 60 || (c.military || 0) >= 60;
      });
    }
    if (!cands.length) return null;
    cands.sort(function(a, b) {
      return ((b.military || 0) + (b.valor || 0)) - ((a.military || 0) + (a.valor || 0));
    });
    return cands[0];
  }

  // ─── §2·元朝 era gate (元无武举) ───

  function _kjG3IsYuanEra() {
    if (typeof P === 'undefined' || !P || !P.scenario) return false;
    var era = String(P.scenario.era || '');
    return /元|yuan/i.test(era);
  }

  // ─── §3·peaceful counter (B 和平期贬值) ───

  function _kjG3InitPeacefulCounter() {
    if (typeof GM === 'undefined' || !GM) return;
    if (GM._wujuPeacefulCounter) return;   // 幂等
    GM._wujuPeacefulCounter = {
      reignStartYear: _getCurYear(),
      peacefulYears:  0,
      lastEvalYear:   _getCurYear(),
      reignName:      (GM._currentReignName || '')
    };
  }

  function _kjG3TickPeacefulCounter() {
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._wujuPeacefulCounter) _kjG3InitPeacefulCounter();
    var pc = GM._wujuPeacefulCounter;
    var curY = _getCurYear();
    if (curY > pc.lastEvalYear) {
      pc.peacefulYears += (curY - pc.lastEvalYear);
      pc.lastEvalYear = curY;
    }
  }

  function _kjG3ResetPeacefulCounter() {
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._wujuPeacefulCounter) _kjG3InitPeacefulCounter();
    GM._wujuPeacefulCounter.peacefulYears = 0;
    GM._wujuPeacefulCounter.lastEvalYear = _getCurYear();
  }

  function _kjG3CalcWujuPeacefulMultiplier() {
    var n = (GM._wujuPeacefulCounter && GM._wujuPeacefulCounter.peacefulYears) || 0;
    if (n < 5)  return 1.0;
    if (n < 10) return 0.8;
    if (n < 20) return 0.5;
    return 0.3;
  }

  // ─── §4·pool count by era ───

  function _kjG3GetWujuPoolCountForEra() {
    if (typeof P === 'undefined' || !P || !P.scenario) return 15;
    var era = String(P.scenario.era || '').toLowerCase();
    if (/唐|tang/i.test(era)) return 8;
    if (/宋|song/i.test(era)) return 12;
    if (/明|ming/i.test(era)) return 15;
    if (/清|qing/i.test(era)) return 20;
    if (/元|yuan/i.test(era)) return 0;   // 元无武举
    return 12;
  }

  // ─── §5·武进士字段·5 archetype + 4 武origin + 历史武状元 ───

  var WUJU_SURNAMES = ['杨','岳','韩','戚','俞','马','李','王','赵','张','刘','陈',
                       '黄','邓','秦','吴','郑','邵','安','哈','邸','汪','范','宋',
                       '徐','姚','沈','薛','石','尹','袁','卢','史','傅','贺'];
  var WUJU_GIVEN_MID = ['崇','明','应','成','怀','士','子','克','尚','志','以','希',
                        '德','仁','克','道','宝','文','武','元','光','宗','华','建'];
  var WUJU_GIVEN_END = ['昌','英','贤','明','正','华','瑞','璋','麟','勇','武','虎',
                        '龙','彪','刚','烈','忠','义','忍','谦','峰','岭','峡','江'];

  var HISTORICAL_WUJUYUAN = {
    tang: ['郭子仪', '徐茂功', '李存孝'],
    song: ['狄青', '徐徽言', '岳云', '韩世忠'],
    yuan: [],
    ming: ['徐文炜', '俞大猷', '戚景通'],
    qing: ['马全', '邸飞', '杨谦光', '李宝盛', '汪鸣相',
           '裕昌', '张鸿翥', '黄继昌', '马鸿图', '徐华清',
           '邸建昌', '哈丹巴特尔', '安朝湘', '范廷瑞', '李振祥']
  };

  function _kjG3GenWuName(seed, i) {
    var rng = function() { return (Math.sin(seed * 17 + i * 31) + 1) / 2; };
    var s = WUJU_SURNAMES[Math.floor(rng() * WUJU_SURNAMES.length)] || '杨';
    var m = WUJU_GIVEN_MID[Math.floor(rng() * WUJU_GIVEN_MID.length)] || '武';
    var e = WUJU_GIVEN_END[Math.floor(rng() * WUJU_GIVEN_END.length)] || '英';
    return s + m + e;
  }

  function _kjG3GetNumberSuffix(i) {
    var SUFFIXES = ['二','三','四','五','六','七','八','九','十'];
    return SUFFIXES[i % SUFFIXES.length];
  }

  function _kjG3MaybeDrawHistoricalWujuyuan(era, rng) {
    var pool = HISTORICAL_WUJUYUAN[era] || [];
    if (!pool.length) return null;
    if (rng() > 0.3) return null;   // 30% 概率 draw
    var name = pool[Math.floor(rng() * pool.length)];
    // 避重·若 chars 已有同名
    if (typeof findCharByName === 'function') {
      try { if (findCharByName(name)) return null; } catch(_) {}
    }
    return name;
  }

  function _kjG3DeriveWuArchetype(wujinshi) {
    var v = wujinshi.valor || 50;
    var m = wujinshi.military || 50;
    var l = wujinshi.loyalty || 50;
    if (v >= 75 && m < 50) return 'brave_brash';
    if (m >= 75 && v < 60) return 'tactician';
    if (l >= 70 && v >= 60) return 'loyalist';
    if (v < 50 && m >= 60) return 'coward_clever';
    return 'mercenary';
  }

  function _kjG3DeriveMartialOrigin(rng) {
    var r = rng();
    if (r < 0.4) return 'commoner-warrior';
    if (r < 0.7) return '行伍';
    if (r < 0.9) return 'army-line';
    return 'martial-clan';
  }

  function _kjG3GenWuAppearance(archetype) {
    var POOL = {
      brave_brash:   '身长八尺·虎背熊腰·目如朗星·须如戟',
      tactician:     '身长七尺·气宇轩昂·目光深邃·寡言',
      loyalist:      '身长八尺·肩宽体壮·目正气朗·端严',
      coward_clever: '身材中等·容貌平常·目光闪烁',
      mercenary:     '身材彪悍·脸有刀疤·目锐如鹰'
    };
    return POOL[archetype] || POOL.mercenary;
  }

  function _kjG3GenWuPersonality(archetype) {
    var POOL = {
      brave_brash:   '勇猛·寡言·重义·急躁',
      tactician:     '智谋·内敛·深沉·谨慎',
      loyalist:      '忠勇·正直·死战·重义',
      coward_clever: '圆滑·机变·避险·重利',
      mercenary:     '直接·重利·实际·勇悍'
    };
    return POOL[archetype] || POOL.mercenary;
  }

  function _kjG3GenWuDiction(archetype) {
    var POOL = {
      brave_brash:   '辞令直爽·声若洪钟·偶有粗语',
      tactician:     '辞令沉稳·引经据典·偶用兵法',
      loyalist:      '辞令庄严·言必效死·重义',
      coward_clever: '辞令圆滑·闪烁其辞',
      mercenary:     '辞令直接·只论利害'
    };
    return POOL[archetype] || POOL.mercenary;
  }

  function _kjG3PickWuTraits(archetype) {
    var COMMON = {
      brave_brash:   ['martial:cavalry', 'martial:archery', 'brave', 'wrathful', 'impatient'],
      tactician:     ['martial:tactics', 'martial:strategy', 'cunning', 'patient', 'cold'],
      loyalist:      ['martial:command', 'martial:archery', 'loyal', 'just', 'honorable'],
      coward_clever: ['martial:archery', 'cunning', 'cautious', 'opportunistic'],
      mercenary:     ['martial:cavalry', 'martial:cavalry', 'greedy', 'practical', 'opportunistic']
    };
    return COMMON[archetype] || COMMON.mercenary;
  }

  function _kjG3DeriveStance(archetype) {
    if (archetype === 'brave_brash' || archetype === 'loyalist') return '保边';
    if (archetype === 'tactician') return '建功';
    return '安平';
  }

  function _kjG3DeriveClass(martialOrigin) {
    var MAP = {
      'commoner-warrior': '寒门',
      '行伍':             '行伍',
      'army-line':        '军门',
      'martial-clan':     '武勋世家'
    };
    return MAP[martialOrigin] || '寒门';
  }

  // ─── §6·外场考成绩生成 ───

  function _kjG3GenExteriorScores(seed, i, archetype) {
    var rng = function() { return (Math.sin(seed * 13 + i * 19) + 1) / 2; };
    // 不同 archetype 不同 bias
    var arrowBias = (archetype === 'tactician' || archetype === 'loyalist') ? 0.2 : 0;
    var arrowHits3 = Math.min(3, Math.floor(rng() * 4 + arrowBias * 4));
    var bowStr = [1, 3, 5][Math.floor(rng() * 3 + (archetype === 'brave_brash' ? 0.5 : 0))] || 3;
    var stoneL = [100, 200, 300][Math.floor(rng() * 3 + (archetype === 'brave_brash' ? 0.5 : 0))] || 200;
    var ridingTiers = ['下', '中', '上'];
    var riding = ridingTiers[Math.floor(rng() * 3 + (archetype === 'loyalist' || archetype === 'mercenary' ? 0.4 : 0))] || '中';
    return { arrowHits3: arrowHits3, bowStrength: bowStr, stoneLift: stoneL, horseRiding: riding };
  }

  function _kjG3DeriveWujuTitle(scores) {
    var score = (scores.arrowHits3 || 0) * 10 + (scores.bowStrength || 0) * 8 + (scores.stoneLift || 0) / 30;
    if (score >= 65) return '武状元';
    if (score >= 55) return '武榜眼';
    if (score >= 45) return '武探花';
    return '武进士';
  }

  // ─── §7·赐物 (校阅大典)·explicit resources.privateWealth ───

  function _kjG3ApplyWuxiangshiRewards(wujinshi) {
    if (!wujinshi) return;
    if (!wujinshi.resources) {
      wujinshi.resources = {
        privateWealth: { money:0, grain:0, cloth:0 },
        publicPurse:   { money:0, grain:0, cloth:0 },
        fame:0, virtue:0, health:80, stress:0
      };
    }
    var t = wujinshi.graduateTitle;
    if (t === '武状元') {
      wujinshi.resources.privateWealth.money += 500;
      wujinshi.resources.fame = (wujinshi.resources.fame || 0) + 30;
      wujinshi._gifts = ['金甲', '玉弓', '战马', '银符'];
    } else if (t === '武榜眼') {
      wujinshi.resources.privateWealth.money += 300;
      wujinshi.resources.fame = (wujinshi.resources.fame || 0) + 20;
      wujinshi._gifts = ['银甲', '角弓', '战马'];
    } else if (t === '武探花') {
      wujinshi.resources.privateWealth.money += 200;
      wujinshi.resources.fame = (wujinshi.resources.fame || 0) + 15;
      wujinshi._gifts = ['皮甲', '步弓', '战马'];
    } else {
      wujinshi.resources.privateWealth.money += 100;
      wujinshi.resources.fame = (wujinshi.resources.fame || 0) + 8;
      wujinshi._gifts = ['皮甲'];
    }
  }

  // ─── §8·派镇·scan GM.officeTree ───

  function _kjG3GetAvailableDepots() {
    var depots = [];
    function _scan(nodes) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(function(n) {
        if (!n) return;
        var nm = n.name || '';
        if (/镇|营|卫|关|塞/.test(nm) && /兵|军|武|戍|防|守/.test(nm + (n.desc || ''))) {
          depots.push({
            name: nm,
            region: n.region || nm,
            tier: n.tier || (/京|京营/.test(nm) ? '营卫' : '边镇'),
            source: 'officeTree',
            node: n
          });
        }
        if (n.subs) _scan(n.subs);
      });
    }
    if (typeof GM !== 'undefined' && GM && Array.isArray(GM.officeTree)) {
      _scan(GM.officeTree);
    }
    // fallback stub·若 scan 0
    if (depots.length === 0) {
      depots.push({ name: '京营', region: '京师', tier: '营卫', source: 'stub' });
    }
    return depots;
  }

  function _kjG3DeriveRankFromGraduateTitle(graduateTitle) {
    var MAP = {
      '武状元': '都司',
      '武榜眼': '游击',
      '武探花': '守备',
      '武进士': '把总'
    };
    return MAP[graduateTitle] || '把总';
  }

  function _kjG3AssignWujinshiToDepot(wujinshi, exteriorScores) {
    if (!wujinshi || !exteriorScores) return;
    var score = (exteriorScores.arrowHits3 || 0) * 10 +
                (exteriorScores.bowStrength || 0) * 8 +
                (exteriorScores.stoneLift || 0) / 30;
    var depots = _kjG3GetAvailableDepots();
    // L2·分散逻辑·同 turn 多 wuju·按 _wujuAssignSpinIdx rotate·防全堆同镇
    if (typeof GM._wujuAssignSpinIdx !== 'number') GM._wujuAssignSpinIdx = 0;
    var spin = GM._wujuAssignSpinIdx++;
    var tierFilter;
    if (score >= 50) tierFilter = function(d) { return d.tier === '边镇'; };
    else if (score >= 30) tierFilter = function(d) { return /要塞|边镇/.test(d.tier); };
    else tierFilter = function(d) { return d.tier === '营卫'; };
    var pool = depots.filter(tierFilter);
    if (!pool.length) pool = depots;
    var depot = pool[spin % pool.length] || depots[0];
    // M5·user 手选 override (UI 真 wire 入口·见 _kjG3SetUserDepotOverride 全局)
    if (GM._wujuPendingDepotAssignments && GM._wujuPendingDepotAssignments[wujinshi.name]) {
      depot = GM._wujuPendingDepotAssignments[wujinshi.name];
    }
    wujinshi._assignedDepot = depot.name;
    wujinshi.location = depot.region;
    var rank = _kjG3DeriveRankFromGraduateTitle(wujinshi.graduateTitle);
    wujinshi.officialTitle = depot.name + rank;
    wujinshi.stance = '保边·' + depot.region;
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'wuju_depot_assignment',
        text: _getCurYear() + '年·' + wujinshi.name + '·' + wujinshi.graduateTitle +
              '·派 ' + depot.name + '·任 ' + wujinshi.officialTitle,
        tags: ['科举', '武举', '派镇']
      });
    }
  }

  // ─── §9·武进士 mark + spawn ───

  function _kjG3MarkWujinshi(wujinshi, examYear, examiner, td, exteriorScores) {
    if (!wujinshi) return;
    wujinshi._specialExamType = 'wuju';
    wujinshi._wujuYear = examYear || _getCurYear();
    wujinshi._wujuExaminer = examiner ? examiner.name : '';
    wujinshi._wujuInitiative = (td && td.initiative) || 'passive';
    wujinshi._wujuSubtype = (td && td.subtype) || 'periodic';
    // 外场成绩
    wujinshi._arrowHits3 = exteriorScores.arrowHits3;
    wujinshi._bowStrength = exteriorScores.bowStrength;
    wujinshi._stoneLift = exteriorScores.stoneLift;
    wujinshi._horseRiding = exteriorScores.horseRiding;
    // graduateTitle
    wujinshi.graduateTitle = _kjG3DeriveWujuTitle(exteriorScores);
    wujinshi.keju_status = '武进士';
    wujinshi.title = wujinshi.graduateTitle;
    // archetype 派生
    wujinshi._wuArchetype = _kjG3DeriveWuArchetype(wujinshi);
    // peaceful mult·应用 fame/virtue (替 G2 enkeAbuseCounter)
    var mult = _kjG3CalcWujuPeacefulMultiplier();
    wujinshi._wujuMultiplier = mult;
    if (wujinshi.resources) {
      if (typeof wujinshi.resources.fame === 'number') {
        wujinshi.resources.fame = Math.round(wujinshi.resources.fame * mult);
      }
    }
    // 赐物
    _kjG3ApplyWuxiangshiRewards(wujinshi);
    // 派镇 (F·走 GM.officeTree scan)
    _kjG3AssignWujinshiToDepot(wujinshi, exteriorScores);
    // 武勋派 join (D·复用 G2 paradigm)
    _kjG3WujinshiJoinParty(wujinshi, wujinshi._wujuYear);
    // memorySeed
    wujinshi.memorySeed = '蒙陛下钦点·武科及第·誓效死命·镇守 ' + wujinshi.location;
    if (mult <= 0.5) {
      wujinshi.memorySeed = '武人不为时所重·闲职边镇·愿效死命 (和平期武举·士论已轻)';
    }
  }

  function _kjG3SpawnWujinshiPool(td, examiner) {
    if (typeof GM === 'undefined' || !GM) return [];
    if (!Array.isArray(GM.chars)) GM.chars = [];
    if (_kjG3IsYuanEra()) return [];   // 元无武举·skip
    var examYear = _getCurYear();
    var count = _kjG3GetWujuPoolCountForEra();
    if (count === 0) return [];
    var mult = _kjG3CalcWujuPeacefulMultiplier();
    // Path C player_edict·peacefulMult 低·名额减
    if (td && td.initiative === 'edict' && td.detail && td.detail._forceWujinshiHalf) {
      count = Math.max(5, Math.round(count * 0.7));
    }
    if (mult <= 0.3) count = Math.max(5, Math.round(count * 0.5));
    var wujinshiList = [];
    var seed = examYear + (examiner ? examiner.name.length : 0) * 11;
    var era = (P && P.scenario && P.scenario.era || '').toLowerCase().match(/(唐|tang|宋|song|明|ming|清|qing|元|yuan)/);
    era = era ? (era[1].match(/[a-z]/i) ? era[1].toLowerCase() : { '唐':'tang','宋':'song','明':'ming','清':'qing','元':'yuan' }[era[1]]) : 'ming';
    var rng = function() { return (Math.sin(seed + Math.random() * 1000) + 1) / 2; };
    for (var i = 0; i < count; i++) {
      var archetype = ['brave_brash','tactician','loyalist','coward_clever','mercenary'][Math.floor(rng() * 5)];
      var martialOrigin = _kjG3DeriveMartialOrigin(rng);
      // M3·历史武状元 draw·扩 i<3 (前 3 名都可 draw·非仅 i=0)·i>0 50% gate
      var name = null;
      var isHist = false;
      if (i < 3 && mult >= 0.8) {
        if (i === 0 || rng() < 0.5) {
          name = _kjG3MaybeDrawHistoricalWujuyuan(era, rng);
          if (name) {
            // 防同 pool 内重名 historical
            if (GM.chars.find(function(c) { return c && c.name === name; }) ||
                wujinshiList.find(function(j) { return j && j.name === name; })) {
              name = null;
            } else {
              isHist = true;
            }
          }
        }
      }
      if (!name) {
        name = _kjG3GenWuName(seed, i);
        var attempt = 0;
        while (GM.chars.find(function(c) { return c && c.name === name; }) && attempt < 50) {
          name = _kjG3GenWuName(seed, i) + _kjG3GetNumberSuffix(attempt);
          attempt++;
        }
        if (attempt >= 50) name = _kjG3GenWuName(seed, i) + String(examYear);
      }
      var ageBase = 22 + Math.floor(rng() * 23);   // 22-45 武人偏年轻
      var exteriorScores = _kjG3GenExteriorScores(seed, i, archetype);
      var wujinshi = {
        id:        'wuju_' + examYear + '_' + i + '_' + Date.now(),
        name:      name,
        age:       ageBase,
        gender:    '男',
        birthYear: examYear - ageBase,
        birthplace: '京师',
        ethnicity: (era === 'qing' && rng() < 0.3) ? '满' : '汉',
        faith:     '儒',
        culture:   '汉',
        learning:  '武举·三试',
        appearance: _kjG3GenWuAppearance(archetype),
        diction:    _kjG3GenWuDiction(archetype),
        personality: _kjG3GenWuPersonality(archetype),
        location:  '京师',                   // mark 时 reset to depot region
        // ─── top-level 11 维·武人偏 valor / military / integrity ───
        loyalty:        50 + Math.floor(rng() * 20),
        ambition:       40 + Math.floor(rng() * 30),
        intelligence:   30 + Math.floor(rng() * 40),
        valor:          60 + Math.floor(rng() * 30),
        military:       50 + Math.floor(rng() * 40),
        administration: 20 + Math.floor(rng() * 30),
        management:     30 + Math.floor(rng() * 30),
        charisma:       40 + Math.floor(rng() * 30),
        diplomacy:      20 + Math.floor(rng() * 30),
        benevolence:    30 + Math.floor(rng() * 40),
        integrity:      50 + Math.floor(rng() * 30),
        // ─── 嵌套 resources (真 schema) ───
        resources: {
          privateWealth: { money: 200, grain: 50, cloth: 10 },
          publicPurse:   { money: 0, grain: 0, cloth: 0 },
          fame:          20 + Math.floor(rng() * 20),
          virtue:        10 + Math.floor(rng() * 15),
          health:        80 + Math.floor(rng() * 15),
          stress:        20 + Math.floor(rng() * 20)
        },
        // ─── traits·武人特有·_kjG3PickWuTraits 返 5 ID array ───
        traits: _kjG3PickWuTraits(archetype),
        // ─── 派系 / 家族·C2 fix·party 设 '武勋派' (string·非 GM.parties entry) ───
        faction:    'XX 朝廷',
        party:      '武勋派',                  // C2 fix·user 见 chars 面板有派系
        partyRank:  '末等',
        family:     name.charAt(0) + '氏',
        familyTier: martialOrigin === 'martial-clan' ? 'martial-lineage' : 'common',
        familyRole: '武进士',
        clanPrestige: 30,
        mentor:     '',
        hobbies:    '骑射·习兵·研武经',
        innerThought: '末将虽小·愿效犬马于陛下·死战不退。',
        personalGoal: '保边镇·扬威漠北',
        stressSources: ['边事吃紧', '武人不为文官所重'],
        // ─── career·array of {year, title, ...} ───
        career: [{
          year:      examYear,
          title:     '武进士',
          note:      examYear + '年·武科及第',
          date:      examYear + '年',
          desc:      '中武进士·钦点',
          milestone: true
        }],
        // ─── meta ───
        title:       '武进士',
        bio:         '本科武进士·' + (td && td.historyPath ? td.historyPath : '武举'),
        class:       _kjG3DeriveClass(martialOrigin),
        source:      '武举',
        recruitTurn: GM.turn || 0,
        isHistorical: isHist,                  // M4·canonical (game-wide)·_historicalFigure 已 drop
        alive:       true,
        // ─── G3 私有 _ 字段 ───
        _origin:           'wuju',
        _martialOrigin:    martialOrigin,
        _wuArchetype:      archetype,
        _battleRecord:     [],
        _isFamousGeneral:  false,
        _wuPartyLineage:   null
      };
      // M1 fix·历史武将 boost·valor / military 拉到 85-95 (真实战将水平)
      if (isHist) {
        wujinshi.valor = 85 + Math.floor(rng() * 10);
        wujinshi.military = 80 + Math.floor(rng() * 15);
        wujinshi.intelligence = 70 + Math.floor(rng() * 15);
        wujinshi.loyalty = 75 + Math.floor(rng() * 20);
        wujinshi.resources.fame = 50 + Math.floor(rng() * 20);
      }
      _kjG3MarkWujinshi(wujinshi, examYear, examiner, td, exteriorScores);
      (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(wujinshi);
      wujinshiList.push(wujinshi);
    }
    return wujinshiList;
  }

  // ─── §10·校阅大典 LLM (queue 同 G2 BB4 paradigm) ───

  function _kjG3BuildWuJiaoyueDaPrompt(wujinshiList, examiner, td) {
    var names = (wujinshiList || []).slice(0, 5).map(function(j) { return j.name; }).join('、');
    var year = _getCurYear();
    var path = td && td.historyPath || '武举';
    return '【校阅大典·御前演武】\n' +
      '年·' + year + '·路径·' + path + '·主考·' + (examiner ? examiner.name : '兵部') + '\n' +
      '武进士代表·' + names + (wujinshiList && wujinshiList.length > 5 ? '等' + wujinshiList.length + '人' : '') + '\n\n' +
      '请以御前校阅书记官口吻·写一份校阅记 (古文铺陈体·200-300 字)·\n' +
      '- 描武进士演武·箭中红心·开弓负重·骑射纵横\n' +
      '- 圣上点评·赐甲胄/弓矢/战马/兵符\n' +
      '- 京营观礼·百官失色\n' +
      '风格·铺陈式·避白话·不可批评朝政·**跟谢恩大典叩拜风格完全相反**\n\n' +
      '只返校阅记正文·不要标题。';
  }

  function _kjG3GenWuJiaoyueDaFallback(wujinshiList, examiner, td) {
    var year = _getCurYear();
    var path = td && td.historyPath || '武举';
    var examName = examiner ? examiner.name : '兵部';
    return '校阅大典之日·圣上御文德殿·百官观礼·京营整列。' +
           '新科武进士' + (wujinshiList ? wujinshiList.length : '若干') + '人·依次演武。' +
           '骑射纵横·箭中红心·开弓负重·虎虎生威。圣上颜悦·赐甲胄弓矢·' +
           '钦点武状元 ' + (wujinshiList && wujinshiList[0] ? wujinshiList[0].name : '某甲') + '·' +
           '赐金甲玉弓战马银符。校阅记·' + path + '·主考' + examName + '。';
  }

  function _kjG3RunWuJiaoyueDaCeremony(wujinshiList, examiner, td, cb) {
    if (typeof GM === 'undefined' || !GM) { if (cb) cb(null); return; }
    if (!Array.isArray(GM._wujuCeremonyQueue)) GM._wujuCeremonyQueue = [];
    var pendingKey = (td && td.subtype || 'wuju') + ':' + _getCurYear();
    if (GM._wujuCeremonyQueue.find(function(p) { return p.key === pendingKey; })) {
      if (cb) cb(null);
      return;
    }
    var pending = {
      key:          pendingKey,
      wujinshiNames: (wujinshiList || []).map(function(j) { return j.name; }),
      startTurn:    GM.turn || 0,
      examinerName: examiner ? examiner.name : '',
      subtype:      td && td.subtype,
      historyPath:  td && td.historyPath,
      year:         _getCurYear()
    };
    GM._wujuCeremonyQueue.push(pending);

    function _finalize(memorial) {
      // BB4·闭包 wujinshiList 跨 save/load 丢失保险·从 pending.wujinshiNames 重建
      var liveList = wujinshiList;
      if (!Array.isArray(liveList) || !liveList.length) {
        liveList = (pending.wujinshiNames || []).map(function(nm) {
          if (typeof findCharByName === 'function') {
            try { return findCharByName(nm); } catch(_) { return null; }
          }
          return null;
        }).filter(function(c) { return !!c; });
      }
      if (Array.isArray(GM._chronicle)) {
        var body = memorial || _kjG3GenWuJiaoyueDaFallback(liveList, examiner, td);
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_jiaoyueda',
          text: pending.year + '年·' + (pending.historyPath || '武举') + '·校阅大典·' +
                '主考 ' + (pending.examinerName || '兵部') + '·' +
                '武进士 ' + (pending.wujinshiNames || []).length + ' 名',
          tags: ['科举', '武举', '校阅'],
          body: body,
          wujinshiNames: pending.wujinshiNames || []
        });
      }
      (liveList || []).forEach(function(j) {
        if (j) j._wuJiaoyueDaAt = _getCurYear();
      });
      if (Array.isArray(GM._wujuCeremonyQueue)) {
        GM._wujuCeremonyQueue = GM._wujuCeremonyQueue.filter(function(p) { return p.key !== pendingKey; });
      }
      if (cb) cb(memorial);
    }

    if (typeof window !== 'undefined' && typeof window.callAI === 'function' &&
        typeof P !== 'undefined' && P.ai && P.ai.key) {
      try {
        var prompt = _kjG3BuildWuJiaoyueDaPrompt(wujinshiList, examiner, td);
        window.callAI(prompt, 600).then(function(text) {
          var memorial = (typeof text === 'string') ? text.trim() : '';
          if (!memorial) memorial = _kjG3GenWuJiaoyueDaFallback(wujinshiList, examiner, td);
          _finalize(memorial);
        }).catch(function() {
          _finalize(_kjG3GenWuJiaoyueDaFallback(wujinshiList, examiner, td));
        });
        return;
      } catch(_) {}
    }
    _finalize(_kjG3GenWuJiaoyueDaFallback(wujinshiList, examiner, td));
  }

  function _kjG3ResumeWuJiaoyueDaIfPending() {
    if (typeof GM === 'undefined' || !GM) return;
    if (!Array.isArray(GM._wujuCeremonyQueue) || !GM._wujuCeremonyQueue.length) return;
    var curTurn = GM.turn || 0;
    GM._wujuCeremonyQueue = GM._wujuCeremonyQueue.filter(function(pending) {
      var staleTurns = curTurn - (pending.startTurn || 0);
      if (staleTurns > XIEENDA_TIMEOUT_TURNS) {
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: curTurn,
            type: 'wuju_jiaoyueda',
            text: pending.year + '年·' + (pending.historyPath || '武举') + '·校阅大典 (记略散佚)',
            tags: ['科举', '武举', '校阅'],
            body: '(校阅记·LLM 失败·兵部代呈)',
            wujinshiNames: pending.wujinshiNames || []
          });
        }
        return false;
      }
      return true;
    });
  }

  // ─── §11·武勋派 (D·复用 G2 paradigm·G3 自创·不动 GM.parties) ───

  function _kjG3InitWujuParty() {
    if (typeof GM === 'undefined' || !GM) return;
    if (GM._wujuParty) return;
    GM._wujuParty = {
      members:        [],
      cohorts:        {},
      totalCohorts:   0,
      prestige:       0,
      lastCohortYear: 0,
      tier:           'nascent'
    };
  }

  function _kjG3WujinshiJoinParty(wujinshi, examYear) {
    if (!wujinshi || !wujinshi.name) return;
    if (!GM._wujuParty) _kjG3InitWujuParty();
    var wp = GM._wujuParty;
    if (wp.members.indexOf(wujinshi.name) >= 0) return;
    wp.members.push(wujinshi.name);
    var year = examYear || _getCurYear();
    if (!wp.cohorts[year]) {
      wp.cohorts[year] = [];
      wp.totalCohorts++;
    }
    wp.cohorts[year].push(wujinshi.name);
    wp.lastCohortYear = year;
    if (wp.totalCohorts >= 5) wp.tier = 'dominant';
    else if (wp.totalCohorts >= 3) wp.tier = 'established';
  }

  function _kjG3IsWujuMember(name) {
    if (!name || typeof GM === 'undefined' || !GM || !GM._wujuParty) return false;
    if (GM._wujuParty.members.indexOf(name) < 0) return false;
    if (typeof findCharByName === 'function') {
      try {
        var ch = findCharByName(name);
        if (ch && (ch.alive === false || ch._retired)) return false;
      } catch(_) {}
    }
    return true;
  }

  // L1·_wujuParty tinyi affinity bonus·跟 G2 enkeParty affinity 平行
  // **DEFERRED·F6 audit 标 LOW**·tinyi v3 现未真 read 此 helper·跟 G2 enke L1 同类 dead expose·
  // backlog 待 tinyi v3 prompt 注入时整合 (跟 G2 enkeParty 一同处理·两个 G2/G3 paradigm 对称留)·
  // call site grep 0·smoke 调用仅验函数行为·非验 tinyi 集成
  function _kjG3GetWujuPartyTinyiAffinityBonus(charName, topicOrText) {
    if (!_kjG3IsWujuMember(charName)) return 0;
    if (!topicOrText) return 0;
    var s = String(topicOrText);
    if (/反武举|罢武人|裁武|节军费/.test(s)) return -30;
    if (/武举|武进士|边事|兵|武勋/.test(s)) return +25;
    return 0;
  }

  // ─── §12·兵谏黑天鹅 (H2 fix·真函数 _kjSpawnYanguanQingyi 3 positional) ───
  // BB3·fire 后 reset _wenguanImpeachmentCount·防同状态下 turn 后再 fire (兵谏后文官已退·counter 应清)
  // M6·同 turn 互斥·_kjG3ApplyWujuLifecycleCost 跟独立 fire 不重 (GM._wujuCoupFiredTurn guard)

  function _kjG3MaybeFireMilitaryCoupRisk() {
    if (!_isG3Enabled()) return false;
    if (!GM._wujuParty || (GM._wujuParty.prestige || 0) < 80) return false;
    if (typeof GM._wenguanImpeachmentCount !== 'number' || GM._wenguanImpeachmentCount < 10) return false;
    // M6·同 turn 互斥·已 fire 跳过
    var curTurn = GM.turn || 0;
    if (GM._wujuCoupFiredTurn === curTurn) return false;
    if (Math.random() > 0.02) return false;   // 2%/turn
    var fired = false;
    if (typeof window !== 'undefined' && typeof window._kjSpawnYanguanQingyi === 'function') {
      try {
        fired = !!window._kjSpawnYanguanQingyi(
          '武勋派',
          '',
          '武勋派威胁带兵进京·' + (GM._wujuParty.members || []).length + ' 武进士联名·兵谏请罢文官'
        );
      } catch(_) {}
    }
    if (!fired) {
      // fallback chronicle (即视为 fire·进度状态变)
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_military_coup_risk',
          text: _getCurYear() + '年·武勋派威胁带兵进京·清议讥滥',
          tags: ['科举', '武举', '黑天鹅', '兵谏']
        });
      }
      fired = true;
    }
    // BB3·fire 后 counter reset + 标 GM._wujuCoupFiredTurn
    GM._wenguanImpeachmentCount = 0;
    GM._wujuCoupFiredTurn = curTurn;
    return fired;
  }

  // ─── §13·兵议体题目 (C·跟 G2 歌颂体反向) ───

  var WUJU_QUESTION_THEMES = {
    'war-crisis': [
      { type: 'cefū',  topic: '边事策',  hint: '议边镇危急·守城/出击/和谈·涉敌情·100-150 字' },
      { type: 'mowrite', topic: '孙吴默', hint: '默孙子兵法/吴起兵法节选·考兵法熟练度' }
    ],
    'general-shortage': [
      { type: 'cefū',  topic: '将才论',  hint: '论选将之道·吕望/韩信典·100-150 字' },
      { type: 'mowrite', topic: '孙吴默', hint: '默孙子' }
    ],
    'periodic': [
      { type: 'cefū',  topic: '守城议',  hint: '议守城之法·瓮城/曦门/壕沟·100-150 字' },
      { type: 'mowrite', topic: '孙吴默', hint: '默兵法' }
    ],
    '_player_edict': [
      { type: 'cefū',  topic: '兵议',    hint: '议兵事·100 字·强发故' },
      { type: 'mowrite', topic: '孙吴默', hint: '默兵法节选' }
    ]
  };

  function _kjG3GetWujuQuestionThemes(subtype) {
    return WUJU_QUESTION_THEMES[subtype] || WUJU_QUESTION_THEMES['periodic'];
  }

  function _kjG3GenWujuQuestionsFallback(td) {
    var subtype = (td && td.subtype) || 'periodic';
    var themes = _kjG3GetWujuQuestionThemes(subtype);
    return themes.map(function(t) {
      return {
        type:  t.type,
        topic: t.topic,
        body:  '【' + t.topic + '】' + t.hint + ' (题面未由 LLM 生成·兵部代拟)'
      };
    });
  }

  // ─── §14·主入口·_kjG3OnWujuApproved ───

  function _kjG3OnWujuApproved(subtype, td) {
    if (!_isG3Enabled()) return null;
    if (typeof GM === 'undefined' || !GM) return null;
    if (_kjG3IsYuanEra()) return null;   // 元朝无武举·skip
    if (!GM._wujuHistory) GM._wujuHistory = [];
    td = td || { subtype: subtype, examType: 'wuju' };
    var curYear = _getCurYear();
    // 防重
    var dup = GM._wujuHistory.find(function(h) {
      return h && h.year === curYear && h.subtype === (td.subtype || subtype);
    });
    if (dup) return dup;
    var examiner = _kjG3PickWujuChiefExaminer();
    if (!examiner) {
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_abort',
          text: curYear + '年·欲开 ' + (td.historyPath || '武举') + '·朝中无主兵部之将·罢',
          tags: ['科举', '武举']
        });
      }
      // F5·toast 提示玩家 (诏书走完了·但武举没启用·让 user 知道下一步)
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        try {
          window.toast('⚠ 陛下下诏开' + (td.historyPath || '武举') + '·然朝中无主兵部之将 (亦无 valor/military≥60 武将)·武举无法启用·请先任命兵部尚书 / 兵部侍郎再下诏');
        } catch(_) {}
      }
      return null;
    }
    if (!GM._wujuPeacefulCounter) _kjG3InitPeacefulCounter();
    if (!GM._wujuParty) _kjG3InitWujuParty();
    var wujinshiList = _kjG3SpawnWujinshiPool(td, examiner);
    var fallbackQuestions = _kjG3GenWujuQuestionsFallback(td);
    var entry = {
      year:        curYear,
      subtype:     td.subtype || subtype,
      historyPath: td.historyPath || '',
      examiner:    examiner.name,
      initiative:  td.initiative || 'passive',
      wujinshiCount: wujinshiList.length,
      wujinshiNames: wujinshiList.map(function(j) { return j.name; }),
      multiplier:  _kjG3CalcWujuPeacefulMultiplier(),
      questions:   fallbackQuestions,
      themeStyle:  '兵议体'
    };
    GM._wujuHistory.push(entry);
    // chronicle 开榜
    if (Array.isArray(GM._chronicle)) {
      var initiativeLabel = ({
        passive:       '兵部具题',
        libu_wendui:   '兵部背书',
        edict:         '陛下下诏',
        keyi:          '议政通过'
      })[entry.initiative] || '';
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'wuju_open',
        text: curYear + '年·' + (entry.historyPath || '武举') + '·' + initiativeLabel + '·' +
              '主考 ' + examiner.name + '·武进士 ' + wujinshiList.length + ' 名',
        tags: ['科举', '武举', entry.initiative],
        examiner: examiner.name,
        wujinshiNames: entry.wujinshiNames
      });
    }
    // 校阅大典 async
    _kjG3RunWuJiaoyueDaCeremony(wujinshiList, examiner, entry, null);
    // 武勋哗变 risk (D)
    _kjG3MaybeFireMilitaryCoupRisk();
    // 世家检测 (H)
    _kjG3DetectMartialClan();
    // H3·apply EDICT lifecycle cost (跟 G2 同 paradigm)
    _kjG3ApplyWujuLifecycleCost(entry);
    // H4·tier update on prestige (整批 join 完后 update)
    _kjG3MaybeUpdatePartyTier();
    return entry;
  }

  function _kjG3OnWujuRejected(td) {
    if (!_isG3Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    td = td || {};
    var curYear = _getCurYear();
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'wuju_rejected',
        text: curYear + '年·议罢' + (td.historyPath || '武举') + '·军心动摇·边镇怒',
        tags: ['科举', '武举', 'reject'],
        reason: td.reason || ''
      });
    }
    // war_state 高时·reject 边镇怒·war_state +5 (历史 paradigm)
    if (typeof GM.vars !== 'undefined' && GM.vars && GM.vars['边事']) {
      var warVar = GM.vars['边事'];
      var warVal = parseInt(warVar.value, 10) || 0;
      if (warVal >= 50) {
        warVar.value = warVal + 5;
      }
    }
  }

  function _kjG3OnWujuDeferred(td) {
    if (!_isG3Enabled()) return;
    if (typeof GM === 'undefined' || !GM || !GM._specialExamCalendar) return;
    td = td || {};
    var entry = {
      type:         'wuju',
      reason:       (td.reason || '推迟') + ' (推迟·' + _getCurYear() + ')',
      detail:       td.detail || {},
      spawnedTurn:  (GM.turn || 0) + 2,
      spawnedYear:  _getCurYear() + 2,
      _deferred:    true
    };
    GM._specialExamCalendar.spawned.push(entry);
  }

  // ─── §15·武勋世家 (H·≥2 同姓 → 世家·杨家将/岳家军) ───

  function _kjG3DetectMartialClan() {
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._wujuParty || !GM._wujuParty.members) return;
    var bySurname = {};
    GM._wujuParty.members.forEach(function(name) {
      var surname = name.charAt(0);
      if (!bySurname[surname]) bySurname[surname] = [];
      bySurname[surname].push(name);
    });
    Object.keys(bySurname).forEach(function(s) {
      if (bySurname[s].length < 2) return;
      var clanName = s + '家';
      if (!GM._martialClans) GM._martialClans = {};
      if (!GM._martialClans[clanName]) {
        GM._martialClans[clanName] = {
          surname: s,
          members: bySurname[s].slice(),
          formedYear: GM.year || 0
        };
        // 给 members mark _wuPartyLineage
        if (Array.isArray(GM.chars)) {
          bySurname[s].forEach(function(nm) {
            var ch = GM.chars.find(function(c) { return c && c.name === nm; });
            if (ch) ch._wuPartyLineage = clanName;
          });
        }
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1,
            type: 'martial_clan_formed',
            text: (GM.year || 0) + '年·' + clanName + '将形成·' + bySurname[s].length + ' 人·' +
                  (s === '杨' ? '杨家将复出' : (s === '岳' ? '岳家军再续' : (clanName + '世为武勋'))),
            tags: ['科举', '武举', '世家']
          });
        }
      } else {
        // 更新 members (累加)
        var existing = GM._martialClans[clanName];
        bySurname[s].forEach(function(nm) {
          if (existing.members.indexOf(nm) < 0) existing.members.push(nm);
        });
      }
    });
  }

  // ─── §16·战功联动 (G·dynamic prob·war_state + valor + military + era) ───

  function _kjG3CalcBattleAchievementProb(wujinshi, warVal, era) {
    var base = 0.05;
    var warMul = warVal >= 60 ? 1.5 : (warVal >= 30 ? 1.0 : 0.5);
    var martialMul = ((wujinshi.valor || 50) + (wujinshi.military || 50)) / 100;
    var eraMul = /唐|tang/.test(era) ? 1.2 : 1.0;
    return Math.min(0.25, base * warMul * martialMul * eraMul);
  }

  function _kjG3GenAchievement(wujinshi) {
    var v = wujinshi.valor || 50;
    var m = wujinshi.military || 50;
    if (v >= 80 && m >= 70) return '破贼数千·斩首百级·亲擒贼酋';
    if (v >= 70) return '冲锋陷阵·斩首数十';
    if (m >= 70) return '统兵守城·智退贼军';
    return '协同破贼·斩首十数';
  }

  function _kjG3MaybeAddBattleRecord(wujinshi) {
    if (!_isG3Enabled()) return false;
    if (!wujinshi || wujinshi.alive === false) return false;
    if (wujinshi._origin !== 'wuju') return false;
    if (!wujinshi._battleRecord) wujinshi._battleRecord = [];
    var warVal = _getWarState();
    var era = (P && P.scenario && P.scenario.era) || '';
    var prob = _kjG3CalcBattleAchievementProb(wujinshi, warVal, era);
    if (Math.random() >= prob) return false;
    var achievement = _kjG3GenAchievement(wujinshi);
    wujinshi._battleRecord.push({
      year:          GM.year || 0,
      location:      wujinshi._assignedDepot || '',
      achievement:   achievement,
      casualtyEnemy: Math.floor(Math.random() * 1000) + 100
    });
    // L2·cap _battleRecord 50·防内存
    if (wujinshi._battleRecord.length > 50) {
      wujinshi._battleRecord = wujinshi._battleRecord.slice(-50);
    }
    if (GM._wujuParty) {
      GM._wujuParty.prestige = (GM._wujuParty.prestige || 0) + 5;
      _kjG3MaybeUpdatePartyTier();   // H4 fix
    }
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'wuju_battle_achievement',
        text: (GM.year || 0) + '年·' + (wujinshi._assignedDepot || '') + '·' +
              (wujinshi.officialTitle || '武进士') + ' ' + wujinshi.name + '·' + achievement,
        tags: ['科举', '武举', '战功']
      });
    }
    // 名将 event·累计 3 战功
    if (wujinshi._battleRecord.length >= 3 && !wujinshi._isFamousGeneral) {
      wujinshi._isFamousGeneral = true;
      if (GM._wujuParty) {
        GM._wujuParty.prestige += 20;
        _kjG3MaybeUpdatePartyTier();   // H4 fix
      }
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_famous_general',
          text: (GM.year || 0) + '年·名将·' + wujinshi.name + '·累战功 ' + wujinshi._battleRecord.length + ' 次·' + (wujinshi._assignedDepot || '') + '威震',
          tags: ['科举', '武举', '名将']
        });
      }
    }
    return true;
  }

  // ─── §17·长尾·health 损耗 + 战死 + 荫袭 ───

  function _kjG3WujinshiHealthTick() {
    if (!_isG3Enabled()) return;
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return;
    var warVal = _getWarState();
    if (warVal < 60) return;   // 仅 war_state 高时损耗
    GM.chars.forEach(function(ch) {
      if (!ch || ch.alive === false) return;
      if (ch._origin !== 'wuju') return;
      if (Math.random() >= WUJU_HEALTH_TICK_PROB) return;
      if (!ch.resources) ch.resources = { health: 80 };
      ch.resources.health = (ch.resources.health || 80) - 5;
      if (ch.resources.health <= 0) {
        ch.alive = false;
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1,
            type: 'wuju_battle_death',
            text: (GM.year || 0) + '年·' + (ch._assignedDepot || '') + '·' +
                  (ch.officialTitle || '武进士') + ' ' + ch.name + '·阵亡',
            tags: ['科举', '武举', '战死']
          });
        }
        // 荫袭子·若 _wuPartyLineage 存在
        _kjG3MaybeInheritOffice(ch);
      }
    });
  }

  function _kjG3MaybeInheritOffice(deadWujinshi) {
    if (!deadWujinshi || !deadWujinshi._wuPartyLineage) return;
    // 简版荫袭·spawn 子 char·继承军职降一档·M2·name chain 限制
    var sonName = _kjG3GenInheritedName(deadWujinshi.name);
    if (typeof findCharByName === 'function') {
      try { if (findCharByName(sonName)) return; } catch(_) {}
    }
    // M2 fix·birthYear / age 加 ±2 扰动·避同年荫袭子全 18 岁集体出生
    var sonAge = 16 + Math.floor(Math.random() * 5);   // 16-20
    var son = {
      id:        'wuju_inherit_' + Date.now(),
      name:      sonName,
      age:       sonAge,
      gender:    '男',
      birthYear: (GM.year || 0) - sonAge,
      family:    deadWujinshi.family,
      familyTier: 'martial-lineage',
      _wuPartyLineage: deadWujinshi._wuPartyLineage,
      _origin:   'wuju-inherit',
      officialTitle: deadWujinshi.officialTitle + '·继任',
      stance:    '保边·' + (deadWujinshi.location || ''),
      _assignedDepot: deadWujinshi._assignedDepot,
      location:  deadWujinshi.location,
      loyalty:   60,
      valor:     50,
      military:  40,
      intelligence: 40,
      resources: { privateWealth:{money:50,grain:10,cloth:5}, publicPurse:{money:0,grain:0,cloth:0}, fame:5, virtue:5, health:80, stress:30 },
      traits:    ['martial:cavalry', 'loyal'],
      career:    [{ year: GM.year||0, title:'武勋荫袭', note: '父辈阵亡·继任军职', date: (GM.year||0)+'年', desc:'荫袭', milestone: true }],
      alive:     true
    };
    if (!Array.isArray(GM.chars)) GM.chars = [];
    (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(son);
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'wuju_inherit',
        text: (GM.year || 0) + '年·' + deadWujinshi._wuPartyLineage + '·荫袭·' + sonName + '·' + son.officialTitle,
        tags: ['科举', '武举', '荫袭', '世家']
      });
    }
  }

  // ─── §18·清末废武举 (I) ───

  function _kjG3IsQingLateEra() {
    if (!P || !P.scenario) return false;
    var era = String(P.scenario.era || '');
    if (!/清|qing/i.test(era)) return false;
    return (GM.year || 0) >= 1898;
  }

  function _kjG3CheckWujuAbolitionTrigger() {
    if (!_isG3Enabled()) return null;
    if (!_kjG3IsQingLateEra()) return null;
    if (GM._wujuAbolished) return null;
    if (Math.random() > 0.05) return null;
    // C1·真签名 positional
    if (typeof openKeyiSession === 'function') {
      try {
        openKeyiSession('reform', {
          theme:    '废武举·改新军',
          reason:   '火器化·武举形式化·宜废',
          callback: '_kjG3OnWujuAbolitionKeyiCallback'
        });
        return true;
      } catch(_) {}
    }
    return false;
  }

  function _kjG3OnWujuAbolitionKeyiCallback(method, opts) {
    if (!_isG3Enabled()) return;
    var outcome = (opts && opts.outcome) || (method === 'council' ? 'approve' : 'reject');
    if (outcome === 'approve') {
      GM._wujuAbolished = true;
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_abolished',
          text: (GM.year || 0) + '年·废武举·设新军',
          tags: ['科举', '武举', '维新']
        });
      }
    }
  }

  // ─── §19·LLM dialog tone (K) ───

  function _kjG3GetWuToneHint(ch) {
    if (!ch || ch._origin !== 'wuju') return '';
    var TONES = {
      brave_brash:     '军人口吻·直爽 / 武断·"末将" / "末将不才"·偶有粗语·**避之乎者也**',
      tactician:       '军人口吻·沉稳 / 谋略·"末将以为" / "依末将拙见"·偶用兵法典',
      loyalist:        '军人口吻·忠义 / 死战·"末将愿效死命" / "末将不敢辱命"',
      coward_clever:   '军人口吻·圆滑 / 闪烁·"末将不才·恐难胜任"',
      mercenary:       '军人口吻·直接 / 利益·"末将愿效力·只求赏厚"'
    };
    return TONES[ch._wuArchetype || 'mercenary'] || TONES.mercenary;
  }

  // ─── §20·G1 spawn → keyi promote bridge (跟 G2 paradigm 同) ───

  function _kjG3DecorateSpawnedEntryForKeyi(entry) {
    if (!entry) return entry;
    if (entry.type !== 'wuju') return entry;   // 仅 wuju
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

  // ─── §21·EDICT parser (Path C·M4·strong keyword required) ───

  function _kjG3ParseWujuFromEdictText(text) {
    if (!text || typeof text !== 'string') return null;
    // F4·放宽·加 武状元/拣武/择武/比武取士·全含"武"字·避撞日常派将诏书
    if (!/武举|武科|募将|设武科|钦点武状元|武状元|拣武|择武|比武取士/.test(text)) return null;
    // F6·negative gate·扫时政记时 AI 可能写"议罢武举/未开/废武举"·skip
    if (/议罢武举|罢武举|未开武举|停武举|废武举|搁置武举|驳武举|不准开武举|反对开武举|拒开武举/.test(text)) {
      return null;
    }
    var subtype = '_player_edict';
    if (/边镇危急|敌寇|寇至|边事|战急/.test(text)) subtype = 'war-crisis';
    else if (/缺将|无将|乏将|武将不济|募将|乏帅|乏材/.test(text)) subtype = 'general-shortage';
    else if (/三年一科|武举之期|按例|常例/.test(text)) subtype = 'periodic';
    var PATH_LABELS = {
      'war-crisis':         '危急武举',
      'general-shortage':   '缺将武举',
      'periodic':           '常例武举',
      '_player_edict':      '无故强发武举'
    };
    return {
      type:        'wuju',
      category:    'wuju',
      subtype:     subtype,
      text:        text,
      historyPath: PATH_LABELS[subtype],
      year:        _getCurYear()
    };
  }

  function _kjG3OnWujuApprovedViaEdict(action) {
    if (!_isG3Enabled()) return;
    if (!action || action.type !== 'wuju') return;
    var td = {
      examType:    'wuju',
      subtype:     action.subtype || '_player_edict',
      historyPath: action.historyPath,
      initiative:  'edict',
      reason:      '陛下下诏·' + (action.historyPath || ''),
      detail: {
        _forceWujinshiHalf: action.subtype === '_player_edict'
      }
    };
    _kjG3OnWujuApproved(action.subtype, td);
  }

  // ─── §22·RAA fixes·新加 ───

  // H4 fix·tier update on prestige (跟 join 时 tier 同 paradigm·prestige >= 80 → dominant)
  // M1·双标 paradigm·prestige OR cohort 任一达档·tier 升·OR 而非 AND·读作"声望 ≥ X 或科次 ≥ Y 即升档"
  //   - dominant: prestige≥80 OR cohorts≥5
  //   - established: prestige≥40 OR cohorts≥3
  //   - nascent: 其余
  //   - 设计·哪一维先达·tier 即升·防 single-cohort 突破不算 (prestige 强烈 dominant)
  function _kjG3MaybeUpdatePartyTier() {
    if (typeof GM === 'undefined' || !GM || !GM._wujuParty) return;
    var p = GM._wujuParty.prestige || 0;
    var prev = GM._wujuParty.tier;
    var newTier = prev;
    if (p >= 80 || GM._wujuParty.totalCohorts >= 5) newTier = 'dominant';
    else if (p >= 40 || GM._wujuParty.totalCohorts >= 3) newTier = 'established';
    else newTier = 'nascent';
    if (newTier !== prev) {
      GM._wujuParty.tier = newTier;
      // L3 fix·tier promotion chronicle
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_party_tier_change',
          text: (GM.year || 0) + '·武勋派 tier ' + prev + ' → ' + newTier +
                ' (prestige ' + p + ', cohorts ' + (GM._wujuParty.totalCohorts || 0) + ')',
          tags: ['科举', '武举', '武勋派']
        });
      }
    }
  }

  // C3 fix·SET _wenguanImpeachmentCount (供兵谏黑天鹅读)
  function _kjG3RecordWenguanImpeachment() {
    if (typeof GM === 'undefined' || !GM) return;
    GM._wenguanImpeachmentCount = (GM._wenguanImpeachmentCount || 0) + 1;
  }

  // H3 fix·apply EDICT_TYPES.wuju lifecycle cost (跟 G2 _kjG2ApplyEnkeLifecycleCost paradigm)
  function _kjG3ApplyWujuLifecycleCost(td) {
    if (!_isG3Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (typeof window === 'undefined' || !window.EDICT_TYPES || !window.EDICT_TYPES.wuju) return;
    var wc = window.EDICT_TYPES.wuju;
    var ac = wc.affectedClasses || {};
    // 国库代价（修：原 typeof GM.guoku === 'number' 恒假——guoku 是对象，扣费从未发生·死火）。
    // affectedClasses['国库'] 抽象点数→按每点≈3000 两走真账本 spendFromGuoku 扣减·武举约 45000 两·可调。
    if (typeof ac['国库'] === 'number' && ac['国库'] < 0) {
      var _wjCost = Math.abs(ac['国库']) * 3000;
      var _FE_wj = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || (typeof FiscalEngine !== 'undefined' && FiscalEngine) || null;
      if (_FE_wj && typeof _FE_wj.spendFromGuoku === 'function') _FE_wj.spendFromGuoku({ money: _wjCost }, '武举开科');
    }
    // 军 +15 → war_state 缓和 (军心振)
    if (GM.vars && GM.vars['边事'] && typeof ac['军'] === 'number') {
      var warVal = parseInt(GM.vars['边事'].value, 10) || 0;
      GM.vars['边事'].value = Math.max(0, warVal - Math.round(ac['军'] * 0.2));
    }
    if (Array.isArray(GM._chronicle)) {
      if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
        turn: GM.turn || 1,
        type: 'wuju_lifecycle_cost',
        text: _getCurYear() + '年·诏令·武举·apply lifecycle cost (军+15·士林-3·国库-15)',
        tags: ['科举', '武举', '诏令', 'cost'],
        resistanceTotal: Object.keys(wc.resistance || {}).reduce(function(s, k) { return s + (wc.resistance[k] || 0); }, 0),
        affectedClasses: ac,
        unintendedRisk:  wc.unintendedRisk
      });
    }
    // unintendedRisk·military_coup_risk·跟 _kjG3MaybeFireMilitaryCoupRisk 同位
    // M6·同 turn 互斥·_kjG3MaybeFireMilitaryCoupRisk 内部 GM._wujuCoupFiredTurn guard·此 5% prob 不会双 fire
    if (wc.unintendedRisk === 'military_coup_risk' && (GM._wujuParty && (GM._wujuParty.prestige || 0) >= 50)) {
      if (Math.random() < 0.05) _kjG3MaybeFireMilitaryCoupRisk();
    }
  }

  // C1 fix·scan ctx.input.edicts for wuju (跟 G2 _kjG2ScanCtxInputEdictsForEnke 同 paradigm)
  function _kjG3ScanCtxInputEdictsForWuju(edicts) {
    if (!edicts) return [];
    var out = [];
    if (typeof edicts === 'string') {
      var a = _kjG3ParseWujuFromEdictText(edicts);
      if (a) out.push(a);
    } else if (typeof edicts === 'object') {
      // F1·加 'other'·御案"其他"栏的武举诏书也要扫
      ['political', 'military', 'diplomatic', 'economic', 'other'].forEach(function(key) {
        var t = edicts[key];
        if (t && typeof t === 'string') {
          var a2 = _kjG3ParseWujuFromEdictText(t);
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
          var a3 = _kjG3ParseWujuFromEdictText(t2);
          if (a3) out.push(a3);
        });
      }
    }
    return out;
  }

  // H1 fix·desk template suggestion push (跟 G2 _kjG2OnNaturalTriggerEnqueueDeskSuggestion 同)
  function _kjG3GetWujuEdictTemplate(subtype, detail) {
    detail = detail || {};
    var TEMPLATES = {
      'war-crisis': {
        label: '危急武举',
        body:  '朕念边镇危急·' + (detail.disasterType || '边事告急') + '·特开武举一科·募天下武士·钦此。'
      },
      'general-shortage': {
        label: '缺将武举',
        body:  '朕念军中乏将·特设武举·募天下武勇之士·钦此。'
      },
      'periodic': {
        label: '常例武举',
        body:  '武举之期已至·朕特命兵部主之·三年一科·钦此。'
      },
      '_player_edict': {
        label: '⚠ 无故强发武举',
        body:  '朕意已决·开武举一科·兵部速办·勿议。钦此。'
      }
    };
    return TEMPLATES[subtype] || TEMPLATES['_player_edict'];
  }

  function _kjG3OnWujuTriggerEnqueueDeskSuggestion(subtype, detail) {
    if (!_isG3Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    var curY = _getCurYear();
    var curTurn = GM.turn || 1;
    // 幂等·同 subtype + 同年 不重 push
    var existing = GM._edictSuggestions.find(function(s) {
      return s && s._wujuSubtype === subtype && s._wujuEnqueuedYear === curY;
    });
    if (existing) return;
    var template = _kjG3GetWujuEdictTemplate(subtype, detail);
    GM._edictSuggestions.push({
      source:           subtype === '_player_edict' ? '武举·⚠强发' : '武举·建议',
      from:             '兵部',
      topic:            template.label,
      content:          template.body,
      turn:             curTurn,
      used:             false,
      _wujuSubtype:     subtype,
      _wujuBadge:       '⚔',
      _wujuEnqueuedYear: curY
    });
  }

  // H2 fix·Path B 兵部 wendui (跟 G2 _kjG2OpenLibuEnkeWendui 同 paradigm)
  function _kjG3OpenBingbuWujuWendui() {
    if (!_isG3Enabled()) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('武举系统未开 (G3 flag off)');
      }
      return false;
    }
    var thisYear = _getCurYear();
    if (GM._wujuBingbuWenduiLastYear === thisYear) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('本年已问过兵部·明岁再议');
      }
      return false;
    }
    var bingbuLeader = _kjG3PickWujuChiefExaminer();
    if (!bingbuLeader) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('朝中无主兵部之将·武举不可议');
      }
      return false;
    }
    GM._wujuBingbuWenduiLastYear = thisYear;
    if (typeof window === 'undefined' || typeof window.openWenduiModal !== 'function') {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('问对系统未 ship·可于御案下诏');
      }
      return false;
    }
    var warVal = _getWarState();
    window._kjG3WujuWenduiContext = {
      bingbuLeaderName: bingbuLeader.name,
      year:             thisYear,
      warState:         warVal,
      openedAtTurn:     (GM.turn || 1)
    };
    var prefillStr = '【陛下密召】今岁可开武举否·边事' +
      (warVal >= 60 ? '吃紧·宜募将' : (warVal < 30 ? '太平·武人闲置' : '中等')) +
      '·朕欲闻卿之见。';
    try {
      window.openWenduiModal(bingbuLeader.name, 'cedui', prefillStr);
      return true;
    } catch(e) {
      try { console.warn('[G3·H2] openWenduiModal 失败', e); } catch(_) {}
      window._kjG3WujuWenduiContext = null;
      return false;
    }
  }

  function _kjG3OnWujuWenduiClose(npcName) {
    if (typeof GM === 'undefined' || !GM) return false;
    var ctx = (typeof window !== 'undefined') ? window._kjG3WujuWenduiContext : null;
    if (!ctx) return false;
    if (ctx.bingbuLeaderName !== npcName) return false;
    var bingbuLeader = (typeof findCharByName === 'function') ? findCharByName(npcName) : null;
    if (!bingbuLeader) { window._kjG3WujuWenduiContext = null; return false; }
    // 派生 stance·loyalty + military + warState
    var loy = bingbuLeader.loyalty || 50;
    var mil = bingbuLeader.military || 50;
    var warVal = ctx.warState || 0;
    var combined = loy + mil + (warVal >= 60 ? 20 : (warVal < 30 ? -20 : 0));
    var stance = combined >= 130 ? 'support' : (combined <= 80 ? 'oppose' : 'caveat');
    if (stance === 'support') {
      if (typeof window !== 'undefined' && typeof window._kjSpawnSpecialExam === 'function') {
        window._kjSpawnSpecialExam('wuju', '兵部 (' + bingbuLeader.name + ') 议·可开', {
          subtype:        'bingbu-backed',
          bingbuLeader:   bingbuLeader.name,
          _playerInitiated: true
        });
      }
    } else if (stance === 'oppose') {
      if (Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'wuju_bingbu_oppose',
          text: _getCurYear() + '年·兵部 ' + bingbuLeader.name + ' 劝阻开武举·affinity -10',
          tags: ['科举', '武举', '兵部', '劝阻']
        });
      }
    }
    window._kjG3WujuWenduiContext = null;
    return true;
  }

  // M2 fix·荫袭子 name 限制 1 代 + 数字序号 (避无限 chain)
  function _kjG3GenInheritedName(parentName) {
    // 若 parentName 已含 "之子"·改用数字序号
    if (/之子/.test(parentName)) {
      var match = parentName.match(/之子(\d*)$/);
      var seq = match && match[1] ? parseInt(match[1], 10) : 0;
      return parentName.replace(/之子\d*$/, '之子' + (seq + 1));
    }
    return parentName + '之子';
  }

  // M7 fix·G1 spawn → keyi promote queue 加 wuju
  function _kjG3PushWujuKeyiPromoteQueue(spawnedEntry) {
    if (typeof GM === 'undefined' || !GM) return;
    if (!spawnedEntry || spawnedEntry.type !== 'wuju') return;
    if (!spawnedEntry._kjPromoteToKeyi) return;
    if (!GM._kjG2PendingKeyiPromote) GM._kjG2PendingKeyiPromote = [];
    GM._kjG2PendingKeyiPromote.push({
      topicType:    spawnedEntry._kjKeyiTopicType || 'special_exam',
      topicData:    spawnedEntry._kjKeyiTopicData || { examType: 'wuju' },
      queuedTurn:   GM.turn || 1,
      queuedYear:   spawnedEntry.spawnedYear || 0,
      sourceRef:    'kjSpecialExam:wuju:' + (spawnedEntry.spawnedYear || 0)
    });
  }

  // BB1·init/resume·nuke _kjG3WujuWenduiContext (transient·不应跨 save/load 持久化)
  function _kjG3NukeStaleWujuWenduiContext() {
    if (typeof window === 'undefined') return;
    if (!window._kjG3WujuWenduiContext) return;
    if (typeof document !== 'undefined') {
      try {
        if (!document.getElementById('wendui-modal')) {
          window._kjG3WujuWenduiContext = null;
        }
      } catch(_) {
        window._kjG3WujuWenduiContext = null;
      }
    } else {
      window._kjG3WujuWenduiContext = null;
    }
  }

  // M5·user 手选派镇 override helper (UI 真 wire 入口·目前 panel 未 build 时 program 可调)
  // 入参·{ wujinshiName: depotObj } 或 (name, depot)·覆盖 _kjG3AssignWujinshiToDepot 默认逻辑
  function _kjG3SetUserDepotOverride(nameOrMap, depot) {
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._wujuPendingDepotAssignments) GM._wujuPendingDepotAssignments = {};
    if (typeof nameOrMap === 'string' && depot) {
      GM._wujuPendingDepotAssignments[nameOrMap] = depot;
    } else if (nameOrMap && typeof nameOrMap === 'object') {
      Object.keys(nameOrMap).forEach(function(n) {
        GM._wujuPendingDepotAssignments[n] = nameOrMap[n];
      });
    }
  }

  // C4·元朝 G1 wuju trigger spawn·若 spawn 已成且元朝·清掉 + chronicle 一笔
  function _kjG3CleanupYuanStuckWujuSpawn() {
    if (!_isG3Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!_kjG3IsYuanEra()) return;
    if (!GM._specialExamCalendar || !Array.isArray(GM._specialExamCalendar.spawned)) return;
    var before = GM._specialExamCalendar.spawned.length;
    GM._specialExamCalendar.spawned = GM._specialExamCalendar.spawned.filter(function(e) {
      if (e && e.type === 'wuju') {
        if (Array.isArray(GM._chronicle)) {
          if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
            turn: GM.turn || 1,
            type: 'wuju_yuan_skip',
            text: '元朝无武举制·G1 spawn 之 wuju entry 清除',
            tags: ['科举', '武举', 'yuan-skip']
          });
        }
        return false;
      }
      return true;
    });
    return before - GM._specialExamCalendar.spawned.length;
  }

  // wire C2·入党自动 set party (虽 spawn 时已 set·此处再确保)
  // Hook 进 _kjG3WujinshiJoinParty·已 ok·略

  // ─── expose ───
  if (typeof window !== 'undefined') {
    window._kjG3OnWujuApproved             = _kjG3OnWujuApproved;
    window._kjG3OnWujuRejected             = _kjG3OnWujuRejected;
    window._kjG3OnWujuDeferred             = _kjG3OnWujuDeferred;
    window._kjG3PickWujuChiefExaminer      = _kjG3PickWujuChiefExaminer;
    window._kjG3RunWuJiaoyueDaCeremony     = _kjG3RunWuJiaoyueDaCeremony;
    window._kjG3ResumeWuJiaoyueDaIfPending = _kjG3ResumeWuJiaoyueDaIfPending;
    window._kjG3MarkWujinshi               = _kjG3MarkWujinshi;
    window._kjG3SpawnWujinshiPool          = _kjG3SpawnWujinshiPool;
    window._kjG3DecorateSpawnedEntryForKeyi = _kjG3DecorateSpawnedEntryForKeyi;
    window._kjG3InitPeacefulCounter        = _kjG3InitPeacefulCounter;
    window._kjG3TickPeacefulCounter        = _kjG3TickPeacefulCounter;
    window._kjG3ResetPeacefulCounter       = _kjG3ResetPeacefulCounter;
    window._kjG3CalcWujuPeacefulMultiplier = _kjG3CalcWujuPeacefulMultiplier;
    window._kjG3GetWujuPoolCountForEra     = _kjG3GetWujuPoolCountForEra;
    window._kjG3ApplyWuxiangshiRewards     = _kjG3ApplyWuxiangshiRewards;
    window._kjG3GetAvailableDepots         = _kjG3GetAvailableDepots;
    window._kjG3AssignWujinshiToDepot      = _kjG3AssignWujinshiToDepot;
    window._kjG3InitWujuParty              = _kjG3InitWujuParty;
    window._kjG3WujinshiJoinParty          = _kjG3WujinshiJoinParty;
    window._kjG3IsWujuMember               = _kjG3IsWujuMember;
    window._kjG3GetWujuPartyTinyiAffinityBonus = _kjG3GetWujuPartyTinyiAffinityBonus;
    window._kjG3MaybeFireMilitaryCoupRisk  = _kjG3MaybeFireMilitaryCoupRisk;
    window._kjG3GetWujuQuestionThemes      = _kjG3GetWujuQuestionThemes;
    window._kjG3GenWujuQuestionsFallback   = _kjG3GenWujuQuestionsFallback;
    window._kjG3DetectMartialClan          = _kjG3DetectMartialClan;
    window._kjG3MaybeAddBattleRecord       = _kjG3MaybeAddBattleRecord;
    window._kjG3WujinshiHealthTick         = _kjG3WujinshiHealthTick;
    window._kjG3MaybeInheritOffice         = _kjG3MaybeInheritOffice;
    window._kjG3IsQingLateEra              = _kjG3IsQingLateEra;
    window._kjG3CheckWujuAbolitionTrigger  = _kjG3CheckWujuAbolitionTrigger;
    window._kjG3OnWujuAbolitionKeyiCallback = _kjG3OnWujuAbolitionKeyiCallback;
    window._kjG3GetWuToneHint              = _kjG3GetWuToneHint;
    window._kjG3ParseWujuFromEdictText     = _kjG3ParseWujuFromEdictText;
    window._kjG3OnWujuApprovedViaEdict     = _kjG3OnWujuApprovedViaEdict;
    window._kjG3DeriveWuArchetype          = _kjG3DeriveWuArchetype;
    window._kjG3DeriveWujuTitle            = _kjG3DeriveWujuTitle;
    window._kjG3IsYuanEra                  = _kjG3IsYuanEra;
    // RAA fixes
    window._kjG3MaybeUpdatePartyTier       = _kjG3MaybeUpdatePartyTier;
    window._kjG3RecordWenguanImpeachment   = _kjG3RecordWenguanImpeachment;
    window._kjG3ApplyWujuLifecycleCost     = _kjG3ApplyWujuLifecycleCost;
    window._kjG3ScanCtxInputEdictsForWuju  = _kjG3ScanCtxInputEdictsForWuju;
    window._kjG3GetWujuEdictTemplate       = _kjG3GetWujuEdictTemplate;
    window._kjG3OnWujuTriggerEnqueueDeskSuggestion = _kjG3OnWujuTriggerEnqueueDeskSuggestion;
    window._kjG3OpenBingbuWujuWendui       = _kjG3OpenBingbuWujuWendui;
    window._kjG3OnWujuWenduiClose          = _kjG3OnWujuWenduiClose;
    window._kjG3GenInheritedName           = _kjG3GenInheritedName;
    window._kjG3PushWujuKeyiPromoteQueue   = _kjG3PushWujuKeyiPromoteQueue;
    window._kjG3CleanupYuanStuckWujuSpawn  = _kjG3CleanupYuanStuckWujuSpawn;
    // RBB fixes
    window._kjG3NukeStaleWujuWenduiContext = _kjG3NukeStaleWujuWenduiContext;
    window._kjG3SetUserDepotOverride       = _kjG3SetUserDepotOverride;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjG3OnWujuApproved: _kjG3OnWujuApproved,
      _kjG3OnWujuRejected: _kjG3OnWujuRejected,
      _kjG3OnWujuDeferred: _kjG3OnWujuDeferred,
      _kjG3PickWujuChiefExaminer: _kjG3PickWujuChiefExaminer,
      _kjG3RunWuJiaoyueDaCeremony: _kjG3RunWuJiaoyueDaCeremony,
      _kjG3ResumeWuJiaoyueDaIfPending: _kjG3ResumeWuJiaoyueDaIfPending,
      _kjG3MarkWujinshi: _kjG3MarkWujinshi,
      _kjG3SpawnWujinshiPool: _kjG3SpawnWujinshiPool,
      _kjG3DecorateSpawnedEntryForKeyi: _kjG3DecorateSpawnedEntryForKeyi,
      _kjG3InitPeacefulCounter: _kjG3InitPeacefulCounter,
      _kjG3TickPeacefulCounter: _kjG3TickPeacefulCounter,
      _kjG3ResetPeacefulCounter: _kjG3ResetPeacefulCounter,
      _kjG3CalcWujuPeacefulMultiplier: _kjG3CalcWujuPeacefulMultiplier,
      _kjG3GetWujuPoolCountForEra: _kjG3GetWujuPoolCountForEra,
      _kjG3ApplyWuxiangshiRewards: _kjG3ApplyWuxiangshiRewards,
      _kjG3GetAvailableDepots: _kjG3GetAvailableDepots,
      _kjG3AssignWujinshiToDepot: _kjG3AssignWujinshiToDepot,
      _kjG3InitWujuParty: _kjG3InitWujuParty,
      _kjG3WujinshiJoinParty: _kjG3WujinshiJoinParty,
      _kjG3IsWujuMember: _kjG3IsWujuMember,
      _kjG3GetWujuPartyTinyiAffinityBonus: _kjG3GetWujuPartyTinyiAffinityBonus,
      _kjG3MaybeFireMilitaryCoupRisk: _kjG3MaybeFireMilitaryCoupRisk,
      _kjG3GetWujuQuestionThemes: _kjG3GetWujuQuestionThemes,
      _kjG3GenWujuQuestionsFallback: _kjG3GenWujuQuestionsFallback,
      _kjG3DetectMartialClan: _kjG3DetectMartialClan,
      _kjG3MaybeAddBattleRecord: _kjG3MaybeAddBattleRecord,
      _kjG3WujinshiHealthTick: _kjG3WujinshiHealthTick,
      _kjG3MaybeInheritOffice: _kjG3MaybeInheritOffice,
      _kjG3IsQingLateEra: _kjG3IsQingLateEra,
      _kjG3CheckWujuAbolitionTrigger: _kjG3CheckWujuAbolitionTrigger,
      _kjG3OnWujuAbolitionKeyiCallback: _kjG3OnWujuAbolitionKeyiCallback,
      _kjG3GetWuToneHint: _kjG3GetWuToneHint,
      _kjG3ParseWujuFromEdictText: _kjG3ParseWujuFromEdictText,
      _kjG3OnWujuApprovedViaEdict: _kjG3OnWujuApprovedViaEdict,
      _kjG3DeriveWuArchetype: _kjG3DeriveWuArchetype,
      _kjG3DeriveWujuTitle: _kjG3DeriveWujuTitle,
      _kjG3IsYuanEra: _kjG3IsYuanEra
    };
  }
})();
