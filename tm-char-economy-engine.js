// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 角色经济系统 · 核心引擎
// 设计方案：设计方案-角色经济.md（3100 行）
//
// 本文件实现：
//   - 6 资源保障：公库（只读镜像）/ 私产（5 类）/ 名望 / 贤能 / 健康 / 压力
//   - 14 类收入 / 14 类支出计算
//   - 阶层分化（8 类独立经济逻辑）
//   - 家族共财两层（core/extended）
//   - 每回合 tick（俸禄发放 + 贪腐积累 + 经营收益 + 消费 + 压力/健康动态）
//   - 抄家清算（含隐匿挖掘 + 株连）
//   - 「字」(courtesy name) 系统
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  // ═════════════════════════════════════════════════════════════
  // 资源模型保障
  // ═════════════════════════════════════════════════════════════

  // 推算角色初始名望（-100 ~ +100）
  //   依据：品级 + 廉洁 + 五常五(信礼义) + 传记光环 + 阵营
  function _inferInitialFame(ch) {
    if (!ch) return 0;
    var f = 0;
    // 官品越高，默认公众认知越广（但不一定正面）
    var rank = 9 - (ch.rankLevel || 9);  // 1-9，越小越高
    if (rank > 0) f += rank * 2;  // 正一品约 +18
    // 廉洁度高 → 正向声望
    if (ch.integrity != null) f += (ch.integrity - 50) * 0.4;  // +/- 20
    // 五常之"信"影响名望
    if (ch.wuchang && ch.wuchang['信']) f += (ch.wuchang['信'] - 50) * 0.25;  // +/- 12
    // 五常之"义"也有贡献
    if (ch.wuchang && ch.wuchang['义']) f += (ch.wuchang['义'] - 50) * 0.15;
    // 皇族 / 勋贵底蕴
    if (ch.familyTier === 'imperial' || ch.isRoyal) f += 20;
    else if (ch.familyTier === 'noble' || /公|侯|伯/.test(ch.title || '')) f += 12;
    // 历史光环：已有 clanPrestige → 直接加成
    if (ch.clanPrestige != null) f += (ch.clanPrestige - 50) * 0.15;
    // 朝派：阉党首恶/逆党等负面
    if (/阉党|逆党/.test(ch.party || '')) f -= 15;
    // 特殊 trait
    var tr = ch.traits || [];
    if (tr.indexOf('benevolent') >= 0 || tr.indexOf('honorable') >= 0) f += 10;
    if (tr.indexOf('cruel') >= 0 || tr.indexOf('corrupt') >= 0 || tr.indexOf('wrathful') >= 0) f -= 8;
    if (tr.indexOf('scholar') >= 0 || tr.indexOf('wise') >= 0) f += 8;
    // 剧本传记光环：fameInit（如有）
    if (ch.fameInit != null) return clamp(ch.fameInit, -100, 100);
    // 限幅 -60..+85（初始不给极值）
    return Math.round(clamp(f, -60, 85));
  }

  // 推算角色初始贤能（数值，按六阶阈值）
  //   六阶阈值：0 / 50 / 150 / 300 / 500 / 800
  function _inferInitialVirtue(ch) {
    if (!ch) return 0;
    var v = 0;
    // 五常均值加成
    if (ch.wuchang) {
      var wsum = 0, wn = 0;
      ['仁','义','礼','智','信'].forEach(function(k){
        if (ch.wuchang[k] != null) { wsum += ch.wuchang[k]; wn++; }
      });
      if (wn > 0) {
        var wavg = wsum / wn;
        v += Math.max(0, (wavg - 50)) * 3;  // 50→0 · 80→90 · 90→120
      }
    }
    // 政务/管理才能
    if (ch.administration) v += Math.max(0, (ch.administration - 50)) * 1.2;
    if (ch.management) v += Math.max(0, (ch.management - 50)) * 0.6;
    // 整廉
    if (ch.integrity > 70) v += 30;
    else if (ch.integrity < 30) v -= 20;  // 贪墨→贤能低
    // 官品
    var rankN = 10 - (ch.rankLevel || 9);
    if (rankN > 0 && rankN <= 9) v += rankN * 8;  // 正一品约 +72
    // 学识/科举
    if (ch.background && /进士/.test(ch.background)) v += 30;
    else if (ch.background && /举人/.test(ch.background)) v += 12;
    // 剧本直接指定
    if (ch.virtueMeritInit != null) return Math.max(0, ch.virtueMeritInit);
    return Math.max(0, Math.round(v));
  }

  function isEmperor(ch) {
    if (!ch) return false;
    if (ch.role === '皇帝' || ch.officialTitle === '皇帝') return true;
    if (ch.isPlayer && ch.royalRelation === 'emperor_family' && ch.isRoyal) return true;
    if (ch.title && /明思宗|崇祯帝|庄烈帝|皇帝/.test(ch.title)) return true;
    return false;
  }

  // 返回 { type:'emperor'|'factionLeader'|null, faction }
  //   emperor: 该角色是玩家皇帝 → 用 GM.guoku / GM.neitang
  //   factionLeader: 该角色是某势力的 leader（非玩家势力）→ 用 faction.treasury / faction.leaderPrivate
  function getFactionLeaderContext(ch) {
    if (!ch) return { type: null };
    if (isEmperor(ch)) return { type: 'emperor' };
    // 在 GM.facs 中查 leader === ch.name
    // leadership 5 字段 schema:{ruler/regent/general/chancellor/spy}·当前 ruler 是公库主·
    // regent(摄政)在 ruler 缺/幼弱时也算 factionLeader·其余 3 字段(general/chancellor/spy)
    // 走专属 contextRole 标记·不让其私产=领袖私库·避免普通将领被误识别
    var factions = (global.GM && global.GM.facs) || [];
    for (var i = 0; i < factions.length; i++) {
      var f = factions[i];
      if (!f) continue;
      var lh = f.leadership || {};
      // 主人/摄政 → factionLeader
      if (f.leader === ch.name || lh.ruler === ch.name || lh.regent === ch.name) {
        return { type: 'factionLeader', faction: f, role: lh.ruler === ch.name ? 'ruler' : (lh.regent === ch.name ? 'regent' : 'leader') };
      }
      // 重臣 → factionMinister(non-leader 但有标识) — 留作未来扩展
      if (lh.chancellor === ch.name || lh.general === ch.name || lh.spy === ch.name) {
        return { type: 'factionMinister', faction: f, role: lh.chancellor === ch.name ? 'chancellor' : (lh.general === ch.name ? 'general' : 'spy') };
      }
    }
    return { type: null };
  }

  // 初始化势力领袖私库（内帑模型）· 首次调用按 treasury 5% 拨入
  function _initFactionLeaderPrivate(faction) {
    if (!faction) return null;
    if (!faction.leaderPrivate) {
      var t = faction.treasury || {};
      faction.leaderPrivate = {
        money: Math.round((t.money || 0) * 0.05),
        grain: Math.round((t.grain || 0) * 0.05),
        cloth: Math.round((t.cloth || 0) * 0.05),
        note: '领袖私库（自 treasury 5% 初始化）'
      };
    }
    return faction.leaderPrivate;
  }

  function ensureCharResources(ch) {
    if (!ch) return;
    if (!ch.resources) ch.resources = {};
    var r = ch.resources;
    var ctx = getFactionLeaderContext(ch);
    var isLeader = (ctx.type === 'emperor' || ctx.type === 'factionLeader');
    var leaderLabel = ctx.type === 'emperor' ? '帑廪'
                    : ctx.type === 'factionLeader' ? (ctx.faction && (ctx.faction.name + '·国库') || '国库')
                    : null;

    // 1) 公库（机构绑定 · 只读镜像）—— 由地方/中央财政系统更新
    //    势力领袖特例：linkedPost=<帑廪/势力国库> · 镜像 GM.guoku 或 faction.treasury 三列（money/grain/cloth）
    if (!r.publicTreasury) r.publicTreasury = {
      linkedPost: isLeader ? leaderLabel : null,
      linkedRegion: null,
      balance: 0,          // 镜像余额（两）
      grain: 0,            // 粮 stock（石）
      cloth: 0,            // 布 stock（匹）
      isReadOnly: true,
      isGuoku: !!isLeader, // 统一标记：领袖公库=国帑/国库
      leaderScope: ctx.type || null, // 'emperor' / 'factionLeader'
      factionName: (ctx.faction && ctx.faction.name) || null,
      handoverLog: [],
      lastHandoverDeficit: 0
    };
    if (isLeader) {
      if (!r.publicTreasury.isGuoku) r.publicTreasury.isGuoku = true;
      if (!r.publicTreasury.linkedPost) r.publicTreasury.linkedPost = leaderLabel;
      r.publicTreasury.leaderScope = ctx.type;
      r.publicTreasury.factionName = (ctx.faction && ctx.faction.name) || r.publicTreasury.factionName;
    }

    // 2) 私产
    //    领袖特例：isNeitang=true · 镜像 GM.neitang / faction.leaderPrivate 三列
    //    其他角色：五大类（money/land/treasure/slaves/commerce）
    if (!r.privateWealth) {
      if (isLeader) {
        r.privateWealth = {
          isNeitang: true,
          leaderScope: ctx.type,
          factionName: (ctx.faction && ctx.faction.name) || null,
          money: 0, grain: 0, cloth: 0,           // 内帑三列
          land: 0, treasure: 0, slaves: 0, commerce: 0  // 保持 schema 以兼容抄家等
        };
      } else {
        r.privateWealth = {
          money: 0, land: 0, treasure: 0, slaves: 0, commerce: 0
        };
      }
    } else if (isLeader && !r.privateWealth.isNeitang) {
      r.privateWealth.isNeitang = true;
      r.privateWealth.leaderScope = ctx.type;
      r.privateWealth.factionName = (ctx.faction && ctx.faction.name) || null;
      if (r.privateWealth.money == null) r.privateWealth.money = 0;
      if (r.privateWealth.grain == null) r.privateWealth.grain = 0;
      if (r.privateWealth.cloth == null) r.privateWealth.cloth = 0;
    }
    if (!r.hiddenWealth) r.hiddenWealth = 0;  // 隐匿藏款（抄家时可能挖出）

    // 3) 名望（-100 ~ +100）—— 按品级/整廉/阵营/历史光环推算初值
    if (r.fame === undefined) r.fame = _inferInitialFame(ch);

    // 4) 贤能（六阶累积型）—— 按能力/品级推算初值
    if (r.virtueMerit === undefined) r.virtueMerit = _inferInitialVirtue(ch);
    if (!r.virtueStage) r.virtueStage = 1;               // 1-6 阶
    updateVirtueStage(ch);

    // 5) 健康（0-100）
    if (ch.health === undefined) ch.health = 70 + Math.floor(Math.random() * 20);

    // 6) 压力（0-100）
    if (ch.stress === undefined) ch.stress = 20;

    // integrity（廉洁度）0-100
    if (ch.integrity === undefined) ch.integrity = 50 + Math.floor((Math.random() - 0.5) * 40);

    // 社会阶层
    if (!ch.socialClass) ch.socialClass = inferSocialClass(ch);

    // 家族
    if (!ch.family) ch.family = { clanId: null, headId: null, role: 'member' };
  }

  function inferSocialClass(ch) {
    // 根据职位 / 出身推测
    if (ch.familyTier === 'imperial' || ch.title === '太子' || ch.title === '王')   return 'imperial';
    if (ch.familyTier === 'noble' || /公|侯|伯/.test(ch.title || '')) return 'noble';
    if (ch.officialTitle && /尚书|侍郎|学士/.test(ch.officialTitle))   return 'civilOfficial';
    if (ch.officialTitle && /将军|提督|统领/.test(ch.officialTitle))   return 'militaryOfficial';
    if (/商/.test(ch.background || ''))     return 'merchant';
    if (/地主|乡绅/.test(ch.background || '')) return 'landlord';
    if (/僧|道|尼|觊/.test(ch.background || '')) return 'clergy';
    return 'commoner';
  }

  // ═════════════════════════════════════════════════════════════
  // 八大阶层参数表
  // ═════════════════════════════════════════════════════════════

  var CLASS_PARAMS = {
    imperial:     { salaryMult: 10, corruptionAccept: 0.3, prestigeDecay: 0.01, consumptionBase: 5000 },
    noble:        { salaryMult:  5, corruptionAccept: 0.4, prestigeDecay: 0.02, consumptionBase: 2000 },
    civilOfficial:{ salaryMult:  1, corruptionAccept: 0.5, prestigeDecay: 0.03, consumptionBase: 500 },
    militaryOfficial:{ salaryMult: 1.2, corruptionAccept: 0.6, prestigeDecay: 0.02, consumptionBase: 400 },
    merchant:     { salaryMult:  0, corruptionAccept: 0.7, prestigeDecay: 0.01, consumptionBase: 800, commerceYield: 0.08 },
    landlord:     { salaryMult:  0, corruptionAccept: 0.6, prestigeDecay: 0.02, consumptionBase: 500, landYield: 0.05 },
    clergy:       { salaryMult:  0.3, corruptionAccept: 0.2, prestigeDecay: 0.005, consumptionBase: 200, tributeFromFaithful: 0.3 },
    commoner:     { salaryMult:  0, corruptionAccept: 0.3, prestigeDecay: 0.04, consumptionBase: 50 }
  };

  // ═════════════════════════════════════════════════════════════
  // 14 类收入
  // ═════════════════════════════════════════════════════════════

  var Income = {
    // 1. 俸禄
    salary: function(ch) {
      if (!ch.officialTitle) return 0;
      var rank = ch.rankLevel || 5;
      var base = rank * 15;  // 每阶 15 两/月
      var classMult = (CLASS_PARAMS[ch.socialClass] || {}).salaryMult || 1;
      // 养廉银
      var reformMult = 1;
      if (GM.corruption && GM.corruption.countermeasures && GM.corruption.countermeasures.salaryReform > 0) {
        reformMult = 1 + GM.corruption.countermeasures.salaryReform * 0.5;
      }
      return base * classMult * reformMult;
    },
    // 2. 俸米
    salaryGrain: function(ch) {
      if (!ch.officialTitle) return 0;
      var rank = ch.rankLevel || 5;
      return rank * 2;  // 石/月
    },
    // 3. 赏赐
    imperialReward: function(ch) {
      // 被皇帝宠信时概率性得赏
      if (ch.isImperialFavorite && Math.random() < 0.05) return 500 + Math.random() * 5000;
      return 0;
    },
    // 4. 经营（商人/地主）
    commerce: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.commerceYield) return (ch.resources.privateWealth.commerce || 0) * cls.commerceYield / 12;
      return 0;
    },
    // 5. 田租（地主）
    rent: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.landYield) return (ch.resources.privateWealth.land || 0) * cls.landYield / 12;
      return 0;
    },
    // 6. 贿赂（腐败收入）
    bribes: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (!cls.corruptionAccept) return 0;
      if (!ch.officialTitle) return 0;
      // 收贿倾向 = (100 - integrity) × corruptionAccept × 机构权力
      var deptCorr = 0;
      if (GM.corruption && ch.department && GM.corruption.subDepts[ch.department]) {
        deptCorr = GM.corruption.subDepts[ch.department].true;
      }
      var rate = (100 - (ch.integrity || 50)) / 100 * cls.corruptionAccept * (deptCorr / 100) * 0.2;
      var rank = ch.rankLevel || 5;
      return rank * 30 * rate;  // 每月
    },
    // 7. 挪用（侵公）
    embezzle: function(ch) {
      if (!ch.officialTitle || ch.integrity > 50) return 0;
      var pt = ch.resources.publicTreasury;
      if (!pt || !pt.balance) return 0;
      var rate = (50 - ch.integrity) / 50 * 0.02;  // 最多 2%/月
      var amt = pt.balance * rate;
      return Math.min(amt, pt.balance * 0.05);
    },
    // 8. 勒索（下属/商人）
    extortion: function(ch) {
      if (ch.integrity > 40) return 0;
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.corruptionAccept < 0.4) return 0;
      return (ch.rankLevel || 1) * 8 * (50 - (ch.integrity||50)) / 50;
    },
    // 9. 继承
    inheritance: function(ch) {
      // 触发式：由死亡事件推入 _inheritanceThisTurn
      return safe(ch._inheritanceThisTurn, 0);
    },
    // 10. 贡物分肥（清中盐政献纳等）
    tributeShare: function(ch) {
      // 由 ceremonialPayout 推入
      return safe(ch._tributeShareThisTurn, 0);
    },
    // 11. 科举中第赏银
    examReward: function(ch) {
      return safe(ch._examRewardThisTurn, 0);
    },
    // 12. 寺院香火（僧道）
    templeDonation: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (!cls.tributeFromFaithful) return 0;
      var faithful = safe((GM.temples && GM.temples.faithful), 10000);
      return faithful * cls.tributeFromFaithful / 12 * 0.01;
    },
    // 13. 军功赏（武将）
    militaryReward: function(ch) {
      return safe(ch._militaryRewardThisTurn, 0);
    },
    // 14. 投献（族人/门生孝敬）
    personalTribute: function(ch) {
      if ((ch.rankLevel || 0) < 15) return 0;  // 高官才有
      return (ch.rankLevel || 0) * (ch.influence || 50) / 50 * 5;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 14 类支出
  // ═════════════════════════════════════════════════════════════

  var Expenses = {
    // 1. 基本生活消费
    livingCost: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      return (cls.consumptionBase || 100) * (1 + (ch.family ? 0.3 : 0));  // 有家庭加成
    },
    // 2. 家丁/家仆
    servants: function(ch) {
      var slaves = (ch.resources.privateWealth.slaves || 0);
      return slaves * 2;  // 月 2 两/人
    },
    // 3. 迎来送往（社交）
    socialFee: function(ch) {
      return (ch.influence || 0) * 0.5;  // 月
    },
    // 4. 宴饮
    feasts: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.salaryMult > 2) return cls.consumptionBase * 0.3;
      return cls.consumptionBase * 0.1;
    },
    // 5. 宅第修缮
    estate: function(ch) {
      var land = ch.resources.privateWealth.land || 0;
      return land * 0.01;  // 亩 0.01 两/月修缮
    },
    // 6. 驭下（塞银/孝敬上司）
    patronage: function(ch) {
      if (!ch.officialTitle) return 0;
      var rank = ch.rankLevel || 1;
      return rank * 10;  // 低阶官员孝敬多
    },
    // 7. 扶亲
    clanSupport: function(ch) {
      if (!ch.family || !ch.family.clanId) return 0;
      return (ch.rankLevel || 1) * 5;
    },
    // 8. 香火供奉（宗教）
    religiousOffering: function(ch) {
      return ch.resources.privateWealth.money > 10000 ? 20 : 5;
    },
    // 9. 教育子弟
    education: function(ch) {
      return (ch.family && ch.family.children) ? ch.family.children * 30 : 0;
    },
    // 10. 医药
    medicine: function(ch) {
      if ((ch.health || 100) < 60) return 100 + (60 - ch.health) * 10;
      return 20;
    },
    // 11. 罚款/赎罪
    fines: function(ch) {
      return safe(ch._finesThisTurn, 0);
    },
    // 12. 嫁娶丧葬
    lifeEvents: function(ch) {
      return safe(ch._lifeEventCostThisTurn, 0);
    },
    // 13. 借款利息
    debtInterest: function(ch) {
      if (!ch.resources.privateWealth.money || ch.resources.privateWealth.money >= 0) return 0;
      return Math.abs(ch.resources.privateWealth.money) * 0.02;  // 2%/月
    },
    // 14. 赌博挥霍
    gambling: function(ch) {
      // traits 含"贪玩"或 stress > 70 时可能
      if ((ch.stress || 0) > 70 && Math.random() < 0.1) return 100 + Math.random() * 500;
      return 0;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 六阶贤能
  // ═════════════════════════════════════════════════════════════

  var VIRTUE_STAGES = [
    { stage: 1, name: '未识', min:   0 },
    { stage: 2, name: '有闻', min:  50 },
    { stage: 3, name: '清誉', min: 150 },
    { stage: 4, name: '儒望', min: 300 },
    { stage: 5, name: '朝宗', min: 500 },
    { stage: 6, name: '师表', min: 800 }
  ];

  function updateVirtueStage(ch) {
    var merit = ch.resources.virtueMerit || 0;
    var s = 1;
    for (var i = VIRTUE_STAGES.length - 1; i >= 0; i--) {
      if (merit >= VIRTUE_STAGES[i].min) { s = VIRTUE_STAGES[i].stage; break; }
    }
    ch.resources.virtueStage = s;
  }

  function getVirtueStageName(stage) {
    var s = VIRTUE_STAGES[(stage || 1) - 1];
    return s ? s.name : '未识';
  }

  // ═════════════════════════════════════════════════════════════
  // 月度 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tickCharacter(ch, mr, fiscalCtx) {
    if (!ch) return;
    if (ch.retired || ch.dead) return;
    ensureCharResources(ch);

    var r = ch.resources;

    // ─ 收入 ─
    var totalIncome = 0;
    var incomeDetail = {};
    for (var k in Income) {
      var v = 0;
      try { v = Income[k](ch) || 0; } catch(e) { v = 0; }
      if (v !== 0) incomeDetail[k] = v * mr;
      totalIncome += v * mr;
    }

    // 贿赂/挪用→增加 integrity 下降 + 贪腐贡献
    if (incomeDetail.bribes) {
      r.privateWealth.money += incomeDetail.bribes;
      r.hiddenWealth += incomeDetail.bribes * 0.4;  // 部分隐匿
      ch.integrity = Math.max(0, ch.integrity - 0.2 * mr);
      if (ch.department && GM.corruption && GM.corruption.subDepts[ch.department]) {
        GM.corruption.subDepts[ch.department].true = Math.min(100,
          GM.corruption.subDepts[ch.department].true + 0.02 * mr);
      }
    }
    if (incomeDetail.embezzle && r.publicTreasury) {
      r.publicTreasury.balance = Math.max(0, r.publicTreasury.balance - incomeDetail.embezzle);
      r.privateWealth.money += incomeDetail.embezzle;
      r.hiddenWealth += incomeDetail.embezzle * 0.5;
      ch.integrity = Math.max(0, ch.integrity - 0.3 * mr);
    }
    // 正当收入入 money
    ['salary','imperialReward','commerce','rent','inheritance','tributeShare',
     'examReward','templeDonation','militaryReward','personalTribute','extortion'].forEach(function(k) {
      if (incomeDetail[k]) r.privateWealth.money += incomeDetail[k];
    });

    // ─ 支出 ─
    var totalExpense = 0;
    var expenseDetail = {};
    for (var e in Expenses) {
      var v2 = 0;
      try { v2 = Expenses[e](ch) || 0; } catch(err) { v2 = 0; }
      if (v2 !== 0) expenseDetail[e] = v2 * mr;
      totalExpense += v2 * mr;
    }
    r.privateWealth.money -= totalExpense;

    // 清除本回合临时字段
    delete ch._inheritanceThisTurn;
    delete ch._tributeShareThisTurn;
    delete ch._examRewardThisTurn;
    delete ch._militaryRewardThisTurn;
    delete ch._finesThisTurn;
    delete ch._lifeEventCostThisTurn;

    // ─ 公库镜像更新（机构→角色）─
    updatePublicTreasuryMirror(ch);

    // ─ 压力 / 健康动态 ─
    tickStressHealth(ch, mr);

    // ─ 贤能积累 ─
    tickVirtueMerit(ch, mr);

    // ─ 名望衰减 ─
    tickFame(ch, mr);

    // 记录本回合流水
    ch._lastTickIncome = incomeDetail;
    ch._lastTickExpense = expenseDetail;
    ch._lastTickNet = totalIncome - totalExpense;
  }

  // 同步 publicPurse 三列(紧要之臣卡片/UI 显示用)·与 publicTreasury 镜像保持一致
  function _syncPublicPurse(ch, money, grain, cloth) {
    if (!ch.resources) ch.resources = {};
    if (!ch.resources.publicPurse) ch.resources.publicPurse = { money: 0, grain: 0, cloth: 0 };
    ch.resources.publicPurse.money = money || 0;
    ch.resources.publicPurse.grain = grain || 0;
    ch.resources.publicPurse.cloth = cloth || 0;
  }

  function updatePublicTreasuryMirror(ch) {
    var pt = ch.resources.publicTreasury;
    if (!pt) return;
    var ctx = getFactionLeaderContext(ch);
    // 皇帝特例：公库镜像 = 帑廪（GM.guoku 三列）
    if (ctx.type === 'emperor' || (pt.isGuoku && pt.leaderScope === 'emperor')) {
      pt.isGuoku = true;
      pt.linkedPost = '帑廪';
      pt.leaderScope = 'emperor';
      var gk = GM.guoku || {};
      var gkLedgers = gk.ledgers || {};
      pt.balance = (gkLedgers.money && gkLedgers.money.stock != null) ? gkLedgers.money.stock : (gk.balance || 0);
      pt.grain = (gkLedgers.grain && gkLedgers.grain.stock != null) ? gkLedgers.grain.stock : 0;
      pt.cloth = (gkLedgers.cloth && gkLedgers.cloth.stock != null) ? gkLedgers.cloth.stock : 0;
      pt.deficit = 0;
      _syncPublicPurse(ch, pt.balance, pt.grain, pt.cloth);
      // 同步私产=内帑
      var pw = ch.resources.privateWealth;
      if (pw) {
        pw.isNeitang = true;
        pw.leaderScope = 'emperor';
        var nt = GM.neitang || {};
        var ntLedgers = nt.ledgers || {};
        pw.money = (ntLedgers.money && ntLedgers.money.stock != null) ? ntLedgers.money.stock : (nt.balance || 0);
        pw.grain = (ntLedgers.grain && ntLedgers.grain.stock != null) ? ntLedgers.grain.stock : 0;
        pw.cloth = (ntLedgers.cloth && ntLedgers.cloth.stock != null) ? ntLedgers.cloth.stock : 0;
      }
      return;
    }
    // 势力领袖：公库镜像 = faction.treasury 三列
    if (ctx.type === 'factionLeader') {
      var f = ctx.faction;
      pt.isGuoku = true;
      pt.leaderScope = 'factionLeader';
      pt.factionName = f.name;
      pt.linkedPost = (f.name || '') + '·国库';
      var t = f.treasury || {};
      pt.balance = t.money || 0;
      pt.grain = t.grain || 0;
      pt.cloth = t.cloth || 0;
      pt.deficit = 0;
      _syncPublicPurse(ch, pt.balance, pt.grain, pt.cloth);
      // 同步私产=领袖私库
      var pw2 = ch.resources.privateWealth;
      if (pw2) {
        pw2.isNeitang = true;
        pw2.leaderScope = 'factionLeader';
        pw2.factionName = f.name;
        var lp = _initFactionLeaderPrivate(f);
        pw2.money = lp.money || 0;
        pw2.grain = lp.grain || 0;
        pw2.cloth = lp.cloth || 0;
      }
      return;
    }
    // 自动推断绑定：若未显式设置·按 officialTitle 查 officeTree 对应职位
    if (!pt.linkedPost && !pt.linkedRegion && ch.officialTitle && GM.officeTree) {
      var _foundPos = null;
      var _walk = function(nodes) {
        for (var i = 0; i < nodes.length && !_foundPos; i++) {
          var n = nodes[i];
          if (n && n.positions) {
            for (var j = 0; j < n.positions.length; j++) {
              var p = n.positions[j];
              if (p && p.name === ch.officialTitle) { _foundPos = p; break; }
              // 容错：官衔包含职位名
              if (p && p.name && (ch.officialTitle.indexOf(p.name) >= 0 || p.name.indexOf(ch.officialTitle) >= 0)) { _foundPos = p; break; }
            }
          }
          if (!_foundPos && n && n.subs) _walk(n.subs);
        }
      };
      _walk(GM.officeTree);
      if (_foundPos) {
        pt.linkedPost = _foundPos.name;
        pt._postRef = _foundPos; // 缓存引用·下次免查
      }
    }
    // 1) 职位公库镜像（优先）
    var postPos = pt._postRef;
    if (!postPos && pt.linkedPost && GM.officeTree) {
      var _w2 = function(nodes) {
        for (var i = 0; i < nodes.length && !postPos; i++) {
          var n = nodes[i];
          (n.positions||[]).forEach(function(p){ if (!postPos && p && p.name === pt.linkedPost) postPos = p; });
          if (!postPos && n.subs) _w2(n.subs);
        }
      };
      _w2(GM.officeTree);
      if (postPos) pt._postRef = postPos;
    }
    if (postPos && postPos.publicTreasury && postPos.publicTreasury.money) {
      pt.balance = postPos.publicTreasury.money.stock || 0;
      pt.grain = postPos.publicTreasury.grain && postPos.publicTreasury.grain.stock || 0;
      pt.cloth = postPos.publicTreasury.cloth && postPos.publicTreasury.cloth.stock || 0;
      pt.deficit = postPos.publicTreasury.money.deficit || 0;
      _syncPublicPurse(ch, pt.balance, pt.grain, pt.cloth);
      return;
    }
    // 2) 区域公库镜像（兜底）
    if (pt.linkedRegion) {
      var regionPT = (GM.regions && GM.regions[pt.linkedRegion] && GM.regions[pt.linkedRegion].publicTreasury) || null;
      if (regionPT) {
        pt.balance = regionPT.balance;
        _syncPublicPurse(ch, pt.balance, pt.grain || 0, pt.cloth || 0);
      }
    }
  }

  function tickStressHealth(ch, mr) {
    // 压力消长
    var stressDelta = 0;
    if (ch.officialTitle && (ch.rankLevel || 0) > 15) stressDelta += 0.3;  // 高官压力
    if (ch._recentFailures) stressDelta += ch._recentFailures * 2;
    if (ch.health < 50) stressDelta += 0.5;
    // 自然衰减
    stressDelta -= 0.4;
    // traits（压力特质 hooks）
    ch.stress = clamp((ch.stress || 20) + stressDelta * mr, 0, 100);

    // 健康
    var healthDelta = -0.1;  // 自然老化
    if (ch.age > 60) healthDelta -= 0.2;
    if (ch.age > 70) healthDelta -= 0.3;
    if (ch.stress > 70) healthDelta -= 0.3;
    if (ch.resources.privateWealth.money > 5000) healthDelta += 0.1;  // 富贵可养身
    ch.health = clamp((ch.health || 70) + healthDelta * mr, 0, 100);

    // 健康 = 0 → 死亡
    if (ch.health <= 0 && !ch.dead) {
      triggerCharacterDeath(ch, '疾');
    }
  }

  function tickVirtueMerit(ch, mr) {
    var r = ch.resources;
    // 每月微积累（按能力 + 政绩）
    var base = 0;
    if (ch.officialTitle) base += 0.1;
    if (ch.abilities && ch.abilities.administration) base += (ch.abilities.administration - 50) / 100 * 0.3;
    if (ch.integrity > 70) base += 0.2;
    if (ch._recentAchievements) base += ch._recentAchievements * 0.5;
    r.virtueMerit = (r.virtueMerit || 0) + base * mr;
    updateVirtueStage(ch);
  }

  function tickFame(ch, mr) {
    var r = ch.resources;
    var cls = CLASS_PARAMS[ch.socialClass] || {};
    var decay = cls.prestigeDecay || 0.02;
    // 向 0 缓慢回归
    r.fame = r.fame > 0 ? Math.max(0, r.fame - decay * mr)
                        : Math.min(0, r.fame + decay * mr);
  }

  // ═════════════════════════════════════════════════════════════
  // 抄家清算
  // ═════════════════════════════════════════════════════════════

  function confiscate(ch, opts) {
    if (!ch) return { success: false, reason: '无此人' };
    opts = opts || {};
    ensureCharResources(ch);

    var r = ch.resources;
    var pw = r.privateWealth;
    var visible = (pw.money || 0) + (pw.land || 0) * 5 + (pw.treasure || 0) + (pw.commerce || 0);
    var hiddenFound = 0;

    // 隐匿挖掘（按 opts.intensity）
    var intensity = opts.intensity || 0.5;
    hiddenFound = (r.hiddenWealth || 0) * Math.min(1, intensity);
    r.hiddenWealth -= hiddenFound;

    // 株连亲族（按 intensity 概率）
    var clanLoss = 0;
    if (opts.includeClan && ch.family && ch.family.clanId && GM.clans && GM.clans[ch.family.clanId]) {
      var clan = GM.clans[ch.family.clanId];
      clanLoss = (clan.sharedWealth || 0) * intensity * 0.5;
      clan.sharedWealth = Math.max(0, (clan.sharedWealth || 0) - clanLoss);
    }

    var total = visible + hiddenFound + clanLoss;

    // 现金清零；田产没官；slaves/treasure/commerce 估值记账
    pw.money = 0;
    pw.land = 0;
    pw.treasure = 0;
    pw.commerce = 0;
    pw.slaves = 0;

    // 按 destination 分账（默认入帑廪·"籍没入官"传统）
    var dest = opts.destination || 'guoku';
    if (dest === 'neitang' && GM.neitang) {
      GM.neitang.balance += total;
      GM.neitang._recentConfiscation = (GM.neitang._recentConfiscation || 0) + total;
    } else if (dest === 'guoku' && GM.guoku) {
      GM.guoku.balance += total;
    }

    // 角色状态：死/流放
    ch.retired = true;
    ch.confiscated = true;

    // 风闻
    if (typeof addEB === 'function') {
      addEB('惩罚', '抄没' + ch.name + '家产 ' + Math.round(total / 10000) + ' 万两（明 ' +
        Math.round(visible / 10000) + ' 万 · 暗 ' + Math.round(hiddenFound / 10000) + ' 万）',
        { credibility: 'high', subject: ch.id });
    }

    return {
      success: true, visible: visible, hidden: hiddenFound,
      clanLoss: clanLoss, total: total, destination: dest
    };
  }

  function triggerCharacterDeath(ch, cause) {
    ch.dead = true;
    ch.deathCause = cause;
    ch.deathTurn = GM.turn;
    // 继承（分给子嗣）
    distributeInheritance(ch);
    if (typeof addEB === 'function') {
      addEB('死亡', ch.name + '薨（' + cause + '）', { credibility: 'high', subject: ch.id });
    }
  }

  function distributeInheritance(ch) {
    if (!ch.family || !ch.family.children) return;
    var total = (ch.resources.privateWealth.money || 0) +
                (ch.resources.privateWealth.treasure || 0);
    var heirs = ch.family.children || [];
    if (heirs.length === 0) {
      // 入内帑（无嗣财产归公）
      if (GM.neitang) GM.neitang.balance += total * 0.5;
      return;
    }
    var perHeir = total / heirs.length;
    heirs.forEach(function(heirId) {
      var heir = (GM.chars || []).find(function(c) { return c.id === heirId; });
      if (heir) heir._inheritanceThisTurn = (heir._inheritanceThisTurn || 0) + perHeir;
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 「字」(courtesy name) 系统
  // ═════════════════════════════════════════════════════════════

  var COURTESY_PREFIX_POOL = [
    '伯','仲','叔','季','子','元','德','文','仁','义','礼','智','信',
    '思','希','惟','敬','承','延','宗','孝','忠','明','正','显','光',
    '茂','翰','钦','弘','谦','恭','允','懋','嘉','善','美','纯','裕'
  ];
  var COURTESY_SUFFIX_POOL = [
    '之','甫','夫','父','卿','先','允','懿','章','业','绩','轩','辅','弼',
    '达','通','逸','敏','才','俊','英','奇','杰','彦','质','朴','真','实'
  ];

  function generateCourtesyName(name, traits) {
    if (!name) return '';
    // 根据名字含义与特质匹配（简化：根据 traits 影响 prefix 选择）
    var prefer = {
      '儒': ['文','德','仁'], '武': ['武','勇','威'], '仁': ['仁','德','慈'],
      '奸': ['子','伯','仲'], '清': ['清','廉','朴']
    };
    var pref = null;
    if (traits) {
      for (var k in prefer) {
        if (traits.indexOf(k) !== -1) { pref = prefer[k]; break; }
      }
    }
    var prefix = pref ? pref[Math.floor(Math.random() * pref.length)]
                      : COURTESY_PREFIX_POOL[Math.floor(Math.random() * COURTESY_PREFIX_POOL.length)];
    var suffix = COURTESY_SUFFIX_POOL[Math.floor(Math.random() * COURTESY_SUFFIX_POOL.length)];
    return prefix + suffix;
  }

  function ensureCourtesyName(ch) {
    if (!ch) return;
    if (!ch.zi && ch.name) {
      ch.zi = generateCourtesyName(ch.name, (ch.traits || []).join(''));
    }
  }

  // 显示用称呼（按场景选名/字/官职）
  function formatAddress(ch, context) {
    if (!ch) return '';
    context = context || {};
    // 亲近 → 字
    if (context.relationship === 'intimate' || context.relationship === 'friend') {
      return ch.zi || ch.name;
    }
    // 正式 → 官职
    if (context.formal && ch.officialTitle) return ch.officialTitle;
    // 下级称上级 → 职/字
    if (context.hierarchical === 'upward') return ch.officialTitle || ch.zi || ch.name;
    // 默认名
    return ch.name;
  }

  // ═════════════════════════════════════════════════════════════
  // 主 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._charEconMonthRatio = mr;

    var chars = GM.chars || [];
    chars.forEach(function(ch) {
      try {
        ensureCharResources(ch);
        ensureCourtesyName(ch);
        tickCharacter(ch, mr, context);
      } catch(e) {
        console.error('[charEcon] tickCharacter:', ch && ch.name, e);
      }
    });

    // 家族共财两层
    try { tickClanPool(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'charEcon] clanPool:') : console.error('[charEcon] clanPool:', e); }
  }

  // ═════════════════════════════════════════════════════════════
  // 家族共财（两层）
  // ═════════════════════════════════════════════════════════════

  function tickClanPool(mr) {
    if (!GM.clans) return;
    Object.values(GM.clans).forEach(function(clan) {
      if (!clan.members) return;
      // 每月族人按 3% 缴纳给 clan 公共池（core family）
      var contribution = 0;
      clan.members.forEach(function(mId) {
        var m = (GM.chars || []).find(function(c) { return c.id === mId; });
        if (m && m.resources && m.resources.privateWealth && m.resources.privateWealth.money > 100) {
          var t = m.resources.privateWealth.money * 0.03 * mr;
          m.resources.privateWealth.money -= t;
          contribution += t;
        }
      });
      clan.sharedWealth = (clan.sharedWealth || 0) + contribution;

      // 扶持贫困族人（bottom 20%）
      var sorted = clan.members.map(function(mId) {
        var m = (GM.chars || []).find(function(c) { return c.id === mId; });
        return m;
      }).filter(function(m) { return m && m.resources; })
        .sort(function(a, b) {
          return (a.resources.privateWealth.money || 0) - (b.resources.privateWealth.money || 0);
        });
      var poorCount = Math.max(1, Math.floor(sorted.length * 0.2));
      var perPoorSupport = Math.min(clan.sharedWealth * 0.1, poorCount * 100) / poorCount;
      sorted.slice(0, poorCount).forEach(function(m) {
        m.resources.privateWealth.money += perPoorSupport;
        clan.sharedWealth -= perPoorSupport;
      });
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 外部调用接口
  // ═════════════════════════════════════════════════════════════

  // 供财政系统：发俸
  function paySalary(ch, amount) {
    ensureCharResources(ch);
    ch.resources.privateWealth.money += amount;
  }

  // 供腐败系统：贪腐入账
  function addBribeIncome(ch, amount, hiddenRatio) {
    ensureCharResources(ch);
    hiddenRatio = hiddenRatio || 0.4;
    ch.resources.privateWealth.money += amount * (1 - hiddenRatio);
    ch.resources.hiddenWealth = (ch.resources.hiddenWealth || 0) + amount * hiddenRatio;
    ch.integrity = Math.max(0, (ch.integrity || 50) - amount / 10000 * 2);
  }

  // 名望变更
  function adjustFame(ch, delta, reason) {
    ensureCharResources(ch);
    ch.resources.fame = clamp((ch.resources.fame || 0) + delta, -100, 100);
    if (!ch._fameHistory) ch._fameHistory = [];
    ch._fameHistory.push({ turn: GM.turn, delta: delta, reason: reason });
    if (ch._fameHistory.length > 20) ch._fameHistory = ch._fameHistory.slice(-20);
  }

  // 贤能变更
  function adjustVirtueMerit(ch, delta, reason) {
    ensureCharResources(ch);
    ch.resources.virtueMerit = Math.max(0, (ch.resources.virtueMerit || 0) + delta);
    updateVirtueStage(ch);
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.CharEconEngine = {
    tick: tick,
    isEmperor: isEmperor,
    ensureCharResources: ensureCharResources,
    updatePublicTreasuryMirror: updatePublicTreasuryMirror,
    ensureCourtesyName: ensureCourtesyName,
    formatAddress: formatAddress,
    Income: Income,
    Expenses: Expenses,
    tickCharacter: tickCharacter,
    confiscate: confiscate,
    distributeInheritance: distributeInheritance,
    paySalary: paySalary,
    addBribeIncome: addBribeIncome,
    adjustFame: adjustFame,
    adjustVirtueMerit: adjustVirtueMerit,
    CLASS_PARAMS: CLASS_PARAMS,
    VIRTUE_STAGES: VIRTUE_STAGES,
    getVirtueStageName: getVirtueStageName,
    generateCourtesyName: generateCourtesyName,
    inferSocialClass: inferSocialClass,
    getMonthRatio: getMonthRatio
  };

  console.log('[charEcon] 引擎已加载：6 资源 + 14×14 收支 + 8 阶层 + 家族共财 + 抄家 + 字系统');

})(typeof window !== 'undefined' ? window : this);
