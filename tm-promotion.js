/*
 * ============================================================
 *  天命 · 功名升迁系统 — 常量与纯函数层 (tm-promotion.js)
 *  -----------------------------------------------------------
 *  功名(virtueMerit) = 累积政绩·升迁凭据(资历)·不扣减·能力×勤政×政绩攒得。
 *  真源字段: char.resources.virtueMerit (数字) + char.resources.virtueStage (1-6 数字阶)。
 *
 *  设计(owner 2026-06-04 逐条锁定):
 *   · 尺度: 0 ~ 15000(正一品)。历史名臣 ≈ 一品级。迁移倍率 SCALE=15(旧 0~1000 尺度 ×15)。
 *   · 18 级品级各设功名 floor(正/从分开·从九品也设门槛·big growing gaps)。
 *   · 两层升迁: 正四品及以下=自动铨选升(功名达标即自动晋); 从三品及以上=政治擢升(功名仅门槛之一·须皇帝特简/廷推+皇权皇威+派系+出缺·不自动)。
 *   · 科举按名次注入功名(入仕的功名来源·跨过从九品门槛)。
 *   · 挣取挂八维能臣度(能者多得·庸者趋零) + 高位递减 + 单回合封顶。
 *   · 玩家可越级强擢(无视门槛)·按缺口分三档惩罚(走皇威/民心/清议)。
 *
 *  本文件只放常量 + 纯函数(零副作用·不碰 GM)。接线在后续刀(onAppointment / endturn / keju / AI context)。
 *  品级 level 对齐 RANK_HIERARCHY: 1=正一品(最高) ... 18=从九品(最低)。
 * ============================================================
 */
(function (global) {
  'use strict';

  // 旧 0~1000 尺度 → 新 0~15000 尺度的迁移倍率
  var SCALE = 15;

  // 18 级品级功名 floor(达到该品级所需功名·level→threshold)
  var VIRTUE_THRESHOLDS = {
    18: 70,    // 从九品
    17: 150,   // 正九品
    16: 260,   // 从八品
    15: 400,   // 正八品
    14: 580,   // 从七品
    13: 810,   // 正七品
    12: 1100,  // 从六品
    11: 1460,  // 正六品
    10: 1920,  // 从五品
    9:  2500,  // 正五品
    8:  3220,  // 从四品
    7:  4120,  // 正四品  ← 自动区顶
    6:  5250,  // 从三品  ← 政治线起
    5:  6650,  // 正三品
    4:  8400,  // 从二品
    3:  10550, // 正二品
    2:  12700, // 从一品
    1:  15000  // 正一品
  };

  // 政治线: level <= POLITICAL_LINE_LEVEL(从三品=6) 为政治擢升区·非自动
  var POLITICAL_LINE_LEVEL = 6;

  // 六阶名(沿用 economy-engine VIRTUE_STAGES 的名)·阈值按 SCALE 放大
  var VIRTUE_STAGES = [
    { stage: 1, name: '未识', min: 0 },
    { stage: 2, name: '有闻', min: 50 * SCALE },   // 750
    { stage: 3, name: '清誉', min: 150 * SCALE },  // 2250
    { stage: 4, name: '儒望', min: 300 * SCALE },  // 4500
    { stage: 5, name: '朝宗', min: 500 * SCALE },  // 7500
    { stage: 6, name: '师表', min: 800 * SCALE }   // 12000
  ];

  // 科举授予功名(按出身名次·入仕的功名注入)。武举/特科按对应名次同构。
  //   placement: 'zhuangyuan'状元 / 'bangyan'榜眼 / 'tanhua'探花 / 'jinshi_2'二甲进士 / 'jinshi_3'三甲 / 'juren'举人
  var KEJU_VIRTUE_GRANT = {
    zhuangyuan: 1100,  // 直够正七品
    bangyan:    850,   // 从七品
    tanhua:     700,   // 从七品
    jinshi_2:   430,   // 正八品
    jinshi_3:   280,   // 从八品
    juren:      90     // 从九品(刚过门槛)
  };

  // 玩家越级强擢的缺口惩罚三档(缺口 = 目标品级 floor − 该员实际功名)
  var PENALTY_TIERS = [
    { key: 'minor',  maxGap: 800,      label: '微擢',     severity: 1 },  // 缺口<800
    { key: 'lucky',  maxGap: 2500,     label: '幸进',     severity: 2 },  // 800~2500
    { key: 'leap',   maxGap: Infinity, label: '骤升破格', severity: 3 }   // >2500
  ];

  // 八维能臣度权重(按职类)。八维键: intelligence/valor/military/administration/management/diplomacy/charisma/benevolence
  var CAPABILITY_WEIGHTS = {
    civil:   { administration: 0.40, management: 0.25, intelligence: 0.25, benevolence: 0.10 },
    martial: { military: 0.40, valor: 0.35, intelligence: 0.15, management: 0.10 },
    envoy:   { diplomacy: 0.40, charisma: 0.30, intelligence: 0.20, benevolence: 0.10 },
    general: { administration: 0.30, management: 0.25, intelligence: 0.25, military: 0.20 }
  };

  // 失败/案发 减功名表(15000 尺度·绝对值·#owner4「应有减功名内容」+ #3「贪腐被发现才扣」)
  //   功名=政绩表现·与道德廉洁无关·只因「办砸事」或「贪腐案发」而减。
  var FAILURE_DELTA = {
    task_botched:      -60,   // 处理事务失败(一般·能力不足办砸)
    relief_failure:    -120,  // 救灾不力
    admin_failure:     -150,  // 地方失政(灾不救/治不善)
    reform_failure:    -450,  // 改革失败(推动者担责)
    grave_injustice:   -300,  // 重大冤案(主审失误)
    delay_military:    -400,  // 贻误军机
    military_defeat:   -600,  // 军事溃败
    military_rout:    -1000,  // 大败/丧师
    corruption_exposed:-750   // 贪腐案发(#3·唯一与廉洁相关·且仅"被发现"才扣)
  };

  // 高阶差遣/勋衔补充表(officeTree 编制常漏的临时差遣与加衔·关键字→level·resolveRankLevel 末级兜底)。
  //   按通用概念给近似品(剧本可覆盖)；只兜 officeTree 查不到的，正常官职走 officeTree。
  // 官衔关键字→品级 level(1-18)。补充表·配合「最长关键字匹配」(右副都御史取「副都御史」不被「都御史」截胡)。
  //   大学士本官正五品(owner 决策:本官+识别加衔·加衔靠拆段取最高·见 _rankFromTitleStr)。
  var SUPPLEMENTARY_OFFICE_RANK = {
    '太师': 1, '太傅': 1, '太保': 1, '宗人令': 1, '左宗正': 1, '右宗正': 1,
    '少师': 2, '少傅': 2, '少保': 2,
    '太子太师': 2, '太子太傅': 2, '太子太保': 2, '太子少师': 3, '太子少傅': 3, '太子少保': 3,
    '尚书': 3, '经略': 3, '督师': 3, '总督': 3, '总制': 3, '都御史': 3, '詹事': 5, '太常寺卿': 5, '大理寺卿': 5,
    '巡抚': 4, '提督': 4, '总兵': 4, '布政使': 4, '少詹事': 7,
    '大学士': 9, '学士': 9, '侍郎': 5, '通政使': 5, '副都御史': 5, '佥都御史': 7, '按察使': 5, '参将': 5, '指挥使': 5,
    '祭酒': 8, '太仆寺卿': 6, '光禄寺卿': 6, '鸿胪寺卿': 7, '苑马寺卿': 6,
    '参政': 6, '游击': 6, '参议': 8, '兵备': 7, '知府': 7,
    '少卿': 9, '司业': 11, '都给事中': 13, '给事中': 14,
    '同知': 9, '副将': 8, '知州': 10, '通判': 11, '守备': 9,
    '推官': 13, '知县': 13, '县丞': 15, '主簿': 17
  };

  // 挣取节流参数(可调)
  var EARN = {
    capPivot: 55,        // 能臣度因子 = capability / capPivot
    capFactorMin: 0.5,   // 庸才下限(抬高·庸臣也有基本积累·非趋零)
    capFactorMax: 1.8,   // 能臣上限(拉大能力差距)
    diminishStart: 9000, // 功名超此后增量递减(高位难滚雪球)
    diminishFloor: 0.35, // 递减最低系数
    perTurnCapBase: 120  // 单回合单人功名增量上限(×monthRatio 前的基数)
  };

  // ───────── 纯函数 ─────────

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // 该品级 floor 功名
  function meritFloor(level) {
    return VIRTUE_THRESHOLDS[level] != null ? VIRTUE_THRESHOLDS[level] : 0;
  }

  // 给定功名·算「资格可达的最高品级 level」(返回最小 level 数字=最高品)
  function rankForMerit(merit) {
    var m = merit || 0, best = 18;
    for (var lv = 18; lv >= 1; lv--) {
      if (m >= VIRTUE_THRESHOLDS[lv]) best = lv; else break;
    }
    return best;
  }

  // 是否自动铨选区(正四品及以下·level>=7)
  function isAutoZone(level) { return level >= 7; }
  // 是否政治擢升区(从三品及以上·level<=6)
  function isPoliticalZone(level) { return level <= POLITICAL_LINE_LEVEL; }

  // 功名→阶名
  function stageName(stage) {
    var s = VIRTUE_STAGES[(stage || 1) - 1];
    return s ? s.name : '未识';
  }
  // 功名→阶数(1-6)
  function stageForMerit(merit) {
    var m = merit || 0, s = 1;
    for (var i = VIRTUE_STAGES.length - 1; i >= 0; i--) {
      if (m >= VIRTUE_STAGES[i].min) { s = VIRTUE_STAGES[i].stage; break; }
    }
    return s;
  }

  // 科举授予功名(名次→功名)
  function kejuGrant(placement) {
    return KEJU_VIRTUE_GRANT[placement] != null ? KEJU_VIRTUE_GRANT[placement] : 0;
  }

  // 越级惩罚档(缺口→{key,label,severity})·gap<=0 表示功名达标无惩罚
  function penaltyForGap(gap) {
    if (!(gap > 0)) return { key: 'none', label: '名实相副', severity: 0 };
    for (var i = 0; i < PENALTY_TIERS.length; i++) {
      if (gap <= PENALTY_TIERS[i].maxGap) {
        return { key: PENALTY_TIERS[i].key, label: PENALTY_TIERS[i].label, severity: PENALTY_TIERS[i].severity, gap: gap };
      }
    }
    return { key: 'leap', label: '骤升破格', severity: 3, gap: gap };
  }

  // 职类判定(按 role/officialTitle 关键字)→ civil/martial/envoy/general
  function classOf(ch) {
    var t = String((ch && (ch.role || ch.officialTitle || ch.title)) || '');
    if (/将|帅|都督|总兵|参将|游击|提督|武|军|卫|戎|镇/.test(t)) return 'martial';
    if (/使|鸿胪|主客|译|藩|外交|宣慰/.test(t)) return 'envoy';
    if (/学士|尚书|侍郎|郎中|主事|知府|知县|巡抚|总督|御史|给事中|翰林|布政|按察|文/.test(t)) return 'civil';
    return 'general';
  }

  // 能臣度(0-100·按职类加权八维)。attrFn(ch,key) 由调用方传入(运行时用 getEffectiveAttr·测试用裸读)
  function capability(ch, attrFn) {
    if (!ch) return 50;
    var get = attrFn || function (c, k) { return c[k] || 0; };
    var w = CAPABILITY_WEIGHTS[classOf(ch)] || CAPABILITY_WEIGHTS.general;
    var sum = 0, wsum = 0;
    Object.keys(w).forEach(function (k) { sum += (get(ch, k) || 0) * w[k]; wsum += w[k]; });
    return wsum ? sum / wsum : 50;
  }

  // 能臣度因子(挣取速率乘数)
  function capabilityFactor(cap) {
    return clamp((cap || 0) / EARN.capPivot, EARN.capFactorMin, EARN.capFactorMax);
  }

  // 失败扣分(key→负 delta)
  function failureDelta(key) {
    return FAILURE_DELTA[key] != null ? FAILURE_DELTA[key] : 0;
  }

  // 按「品级所在功名区间 + 八维能力」拨发功名(#owner1 旧档 / #owner2 剧本初始)
  //   level 区间 = [本品 floor, 上一品 floor]·能力 cap 决定区间内位置(庸者近下界·能臣近上界)。
  function meritForRankBand(level, cap) {
    level = clamp(level || 18, 1, 18);
    var lo = meritFloor(level);
    var hi = (level > 1) ? meritFloor(level - 1) : Math.round(lo * 1.12); // 正一品无上界·给缓冲
    var frac = clamp(((cap == null ? 50 : cap) - 20) / 70, 0, 0.9);        // cap20→下界·cap≥83→0.9(不触顶·开局无人立即够升·防通胀)
    return Math.round(lo + frac * (hi - lo));
  }

  // 单段官衔→品级 level(officeTree 职位名表 + SUPPLEMENTARY 最长关键字匹配)·去状态/括注·非官名返 99。
  function _rankOfSeg(seg, nameRank) {
    seg = String(seg || '').replace(/[（(].*?[)）]/g, '')
      .replace(/南京|留都|已罢归|已罢|罢归|罢免|罢|致仕|丁忧|守制|待召还|待召|养病|归乡|赋闲|原任|前任|前|署理|署|权|试|赠|追|候起|候简|闲居|闲住/g, '')
      .replace(/\s/g, '').trim();
    if (seg.length < 2) return 99;
    var best = 99, i;
    for (i = 0; i < nameRank.length; i += 1) {
      var nr = nameRank[i];
      if (nr.name && (seg.indexOf(nr.name) >= 0 || nr.name.indexOf(seg) >= 0) && nr.level < best) best = nr.level;
    }
    // 最长关键字匹配：右副都御史取「副都御史」(正三品)而非被「都御史」(正二品)截胡
    var hitKw = '', hitLv = 99, keys = Object.keys(SUPPLEMENTARY_OFFICE_RANK);
    for (i = 0; i < keys.length; i += 1) {
      if (seg.indexOf(keys[i]) >= 0 && keys[i].length > hitKw.length) { hitKw = keys[i]; hitLv = SUPPLEMENTARY_OFFICE_RANK[keys[i]]; }
    }
    if (hitKw && hitLv < best) best = hitLv;
    return best;
  }
  // 复合官衔串→最高品。按「·兼加」等拆段·逐段取品·跨段取最高(min level)→ 本官+加衔自然合流。
  function _rankFromTitleStr(raw, nameRank) {
    if (!raw) return 99;
    var segs = String(raw).split(/[·、，,；;\/]|兼署|兼理|兼管|兼|加授|加官|加衔|加|带管|协理/);
    var best = 99;
    for (var i = 0; i < segs.length; i += 1) {
      var lv = _rankOfSeg(segs[i], nameRank);
      if (lv < best) best = lv;
    }
    return best;
  }

  // 解析角色实际品级 level(1-18)·单一真相源=实职官衔串(officialTitle∪title)。
  //   ① officeTree holder 命中职位→其 rank ② 官衔串拆段·最长匹配 officeTree 名表+SUPPLEMENTARY(本官+加衔取最高)
  //   ③ 存的 rankLevel(1-17 真值·18 默认堆不认)散阶候选 ④末 18。多源取最高(level 最小)。
  function resolveRankLevel(ch, G) {
    if (!ch) return 18;
    G = G || (typeof GM !== 'undefined' ? GM : null);
    var gRL = (typeof getRankLevel === 'function') ? getRankLevel : null;
    var best = 99, nameRank = [];
    var ot = G && G.officeTree;
    if (ot) {
      var poss = [];
      (function walk(ns) { (ns || []).forEach(function (n) { if (!n) return; if (Array.isArray(n.positions)) n.positions.forEach(function (p) { if (p) poss.push(p); }); if (n.subs) walk(n.subs); if (n.children) walk(n.children); if (n.depts) walk(n.depts); }); })(Array.isArray(ot) ? ot : [ot]);
      poss.forEach(function (p) {
        var lv = (gRL && p.rank) ? gRL(p.rank) : 99;
        if (lv < 99 && p.name) nameRank.push({ name: String(p.name).replace(/[（(].*?[)）]/g, ''), level: lv });
        var isH = p.holder === ch.name
          || (Array.isArray(p.actualHolders) && p.actualHolders.some(function (h) { return h && (h === ch.name || h.name === ch.name); })) // actualHolders 是 {name,generated} 对象数组·indexOf(串)恒 miss=兜底源死代码(2026-07-04 审查定罪)
          || (Array.isArray(p.additionalHolders) && p.additionalHolders.some(function (h) { return h && (h === ch.name || h.name === ch.name); }));
        if (isH && lv < best) best = lv;
      });
    }
    // 官衔解析（单一真相源·实职复合串 officialTitle∪title 拆段·最长匹配·总参与不依赖 holder）。
    //   功名=累积资历·不因免职蒸发·故已罢官仍按其官职解析（复出凭据）。officeTree holder 漏掉的（如阁臣）靠此救回。
    //   合并 officialTitle 与 title：title 常含 officialTitle 缺的兼职（如张瑞图 title 含礼部尚书、officialTitle 不含）。
    var _t2 = Math.min(_rankFromTitleStr(ch.officialTitle, nameRank), _rankFromTitleStr(ch.title, nameRank));
    if (_t2 < best) best = _t2;
    // 散阶:ch.rankLevel(累积晋升品级·自动升迁/任免写入·1-17)算候选·取最高(可高于实职=加衔晋阶·自动引擎靠此被认到)
    if (ch.rankLevel != null && ch.rankLevel >= 1 && ch.rankLevel <= 17 && ch.rankLevel < best) best = ch.rankLevel;
    return best < 99 ? best : 18;
  }

  // 从角色实际品级 + 能臣度 → 初始功名。
  function deriveInitialMerit(ch, attrFn, G) {
    if (!ch) return 0;
    var lv = resolveRankLevel(ch, G);
    return meritForRankBand(lv, capability(ch, attrFn));
  }

  // 功名重标定迁移 pass(幂等)·按品级+能力 derive 拨发给「未迁移」角色(开局预设/读档老值/新 spawn)。
  //   标 ch.resources._meritScale = SCALE 防重跑·SCALE 变则自动重迁。运行时全局缺省取 GM/getEffectiveAttr/getRankLevel。
  function migrateAllMerit(G, attrFn, levelFn) {
    G = G || (typeof GM !== 'undefined' ? GM : null);
    if (!G || !Array.isArray(G.chars)) return 0;
    attrFn = attrFn || (typeof getEffectiveAttr === 'function' ? getEffectiveAttr : null);
    levelFn = levelFn || (typeof getRankLevel === 'function' ? getRankLevel : null);
    var n = 0;
    G.chars.forEach(function (ch) {
      if (!ch) return;
      if (!ch.resources) ch.resources = {};
      if (ch.resources._meritScale === SCALE) return; // 已迁移·跳过(保留累积值)
      var m = deriveInitialMerit(ch, attrFn, G);
      ch.resources.virtueMerit = m;
      ch.resources.virtueStage = stageForMerit(m);
      ch.resources._meritScale = SCALE;
      n++;
    });
    return n;
  }

  // 自动升迁引擎(只跑自动区·正四品及下)·每回合 endTurn 功名结算后调。
  //   升:calcPromotionChance(功名达下一阶门槛+皇权皇威忠诚调·政治区自返0)概率×monthRatio→散阶晋一阶。
  //   降:自动区内功名跌破本阶 floor 半档→散阶降一阶(实职由 officeTree 兜底·不破实职)。封顶每回合 ~3×mr。
  //   返 {promoted,demoted}·调用方出纪事/邸报。
  function runAutoPromotion(G, mr) {
    G = G || (typeof GM !== 'undefined' ? GM : null);
    if (!G || !Array.isArray(G.chars)) return { promoted: [], demoted: [] };
    mr = mr || 1;
    var glob = (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
    var calcP = (typeof glob.calcPromotionChance === 'function') ? glob.calcPromotionChance : null;
    var promoted = [], demoted = [];
    var cap = Math.max(1, Math.round(3 * mr));
    for (var i = 0; i < G.chars.length; i++) {
      var ch = G.chars[i];
      if (!ch || ch.isPlayer || ch.alive === false || !ch.resources) continue;
      var lv = resolveRankLevel(ch, G);
      var merit = ch.resources.virtueMerit || 0;
      if (lv >= 7 && lv <= 17) {
        var fl = meritFloor(lv), pf = meritFloor(Math.min(18, lv + 1));
        if (merit < fl - (fl - pf) * 0.5) {
          // 降叙幂等(2026-07-04 审查定罪)：实职衔锁定 lv 时 rankLevel+1 不改有效品级·条件持续成立曾
          // 每回合重复刷「功微降叙」邸报并把散阶一路推到 18 清空累积晋升。一年(12回合)至多降一次·只在有效品级真降时记事。
          if ((G.turn || 0) - (ch._lastDemoteTurn || -99) >= 12) {
            ch.rankLevel = Math.min(18, (ch.rankLevel || lv) + 1);
            ch._lastDemoteTurn = G.turn || 0;
            var _lvAfter = resolveRankLevel(ch, G);
            if (_lvAfter > lv) demoted.push({ name: ch.name, from: lv, to: _lvAfter });
          }
          continue;
        }
      }
      if (promoted.length >= cap) continue;
      // 出身天花板：循资自动升迁不得逾出身典型上限(举人/监生/生员/捐纳止步·须特简恩擢方破)
      if (glob.TMGongming && glob.TMGongming.canReach && !glob.TMGongming.canReach(ch, lv - 1, G)) continue;
      if (calcP) {
        var p = calcP(ch) * mr;
        if (p > 0 && Math.random() < Math.min(0.9, p)) {
          ch.rankLevel = lv - 1;
          ch.resources.virtueStage = stageForMerit(merit);
          promoted.push({ name: ch.name, from: lv, to: lv - 1 });
        }
      }
    }
    return { promoted: promoted, demoted: demoted };
  }

  // level→品级名(复用 RANK 概念·给纪事用)·走 getRankLevel 的反查 RANK_HIERARCHY(运行时)·缺则数字
  function rankNameOf(level) {
    try { if (typeof RANK_HIERARCHY !== 'undefined' && RANK_HIERARCHY) { for (var i = 0; i < RANK_HIERARCHY.length; i++) if (RANK_HIERARCHY[i].level === level) return RANK_HIERARCHY[i].label; } } catch (e) {}
    return level + '品';
  }

  // 高位递减系数(当前功名越高·增量越打折)
  function diminishFactor(curMerit) {
    var m = curMerit || 0;
    if (m <= EARN.diminishStart) return 1;
    // 线性逼近 diminishFloor·到 15000 时约触底
    var t = (m - EARN.diminishStart) / (15000 - EARN.diminishStart);
    return clamp(1 - t * (1 - EARN.diminishFloor), EARN.diminishFloor, 1);
  }

  global.TMPromotion = {
    SCALE: SCALE,
    VIRTUE_THRESHOLDS: VIRTUE_THRESHOLDS,
    POLITICAL_LINE_LEVEL: POLITICAL_LINE_LEVEL,
    VIRTUE_STAGES: VIRTUE_STAGES,
    KEJU_VIRTUE_GRANT: KEJU_VIRTUE_GRANT,
    PENALTY_TIERS: PENALTY_TIERS,
    FAILURE_DELTA: FAILURE_DELTA,
    CAPABILITY_WEIGHTS: CAPABILITY_WEIGHTS,
    EARN: EARN,
    meritFloor: meritFloor,
    rankForMerit: rankForMerit,
    failureDelta: failureDelta,
    meritForRankBand: meritForRankBand,
    resolveRankLevel: resolveRankLevel,
    deriveInitialMerit: deriveInitialMerit,
    migrateAllMerit: migrateAllMerit,
    runAutoPromotion: runAutoPromotion,
    rankNameOf: rankNameOf,
    isAutoZone: isAutoZone,
    isPoliticalZone: isPoliticalZone,
    stageName: stageName,
    stageForMerit: stageForMerit,
    kejuGrant: kejuGrant,
    penaltyForGap: penaltyForGap,
    classOf: classOf,
    capability: capability,
    capabilityFactor: capabilityFactor,
    diminishFactor: diminishFactor
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
