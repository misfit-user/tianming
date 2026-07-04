// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   角色经济系统·核心引擎（暴露 CharEconEngine·设计方案-角色经济.md）
//   §1 6 资源保障   公库（只读镜像）/ 私产（5 类）/ 名望 / 贤能 / 健康 / 压力
//   §2 收支         14 类收入 / 14 类支出计算
//   §3 阶层分化     8 类独立经济逻辑
// ─────────────────────────────────────────────
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
  function num(v) {
    var n = Number(v == null ? 0 : v);
    return isFinite(n) ? n : 0;
  }
  function firstDefined() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
    }
    return undefined;
  }
  function copyPlain(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var out = {};
    Object.keys(obj).forEach(function(k) { out[k] = obj[k]; });
    return out;
  }

  function normalizePrivateWealth(ch) {
    if (!ch) return null;
    if (!ch.resources) ch.resources = {};
    var r = ch.resources;
    var legacy = r.private || ch.privateWealth || {};
    var current = r.privateWealth || {};
    var pw = {};
    Object.keys(current).forEach(function(k) { pw[k] = current[k]; });
    function pick(field, alt) {
      return firstDefined(current[field], current[alt], legacy[field], legacy[alt], 0);
    }
    pw.money = num(pick('money', 'cash'));
    pw.grain = num(pick('grain'));
    pw.cloth = num(pick('cloth'));
    pw.land = num(firstDefined(current.land, current.landAcres, legacy.land, legacy.landAcres, 0));
    pw.treasure = num(pick('treasure'));
    pw.slaves = num(pick('slaves'));
    pw.commerce = num(pick('commerce'));
    var debt = firstDefined(current.debt, legacy.debt, legacy.liability, legacy.arrears);
    pw.debt = debt == null ? (pw.money < 0 ? Math.abs(pw.money) : 0) : num(debt);
    if (current.isNeitang) pw.isNeitang = true;
    if (current.leaderScope) pw.leaderScope = current.leaderScope;
    if (current.factionName) pw.factionName = current.factionName;
    r.privateWealth = pw;
    return pw;
  }

  // 私产汇总估值（设计-角色经济·资源二）·五大类对象数组 overlay：数组在则按明细折算，缺则回退扁平聚合值。
  //   明细数组键(与扁平聚合并存·不冲突)：landHoldings[]/houses[]/shops[]/treasures[]/familyBusiness[]/debts[]/investments[]
  //   扁平 land(亩)/treasure/commerce/debt 仍是快路径聚合·领袖 isNeitang 镜像不受影响(走 money/grain/cloth)。
  function _calcPrivateSummary(ch) {
    var zero = { money: 0, grain: 0, cloth: 0, totalValue: { money: 0, grain: 0, cloth: 0 } };
    if (!ch || !ch.resources) return zero;
    var pw = ch.resources.privateWealth || {};
    var landPrice = (global.GM && GM.currency && GM.currency.market && num(GM.currency.market.landPricePerUnit)) || 5;  // 默认每亩5两(对齐抄家 land×5)
    var t = { money: num(pw.money), grain: num(pw.grain), cloth: num(pw.cloth) };
    // 田产
    if (Array.isArray(pw.landHoldings) && pw.landHoldings.length) {
      pw.landHoldings.forEach(function(l) {
        t.money += num(l.area) * landPrice;
        t.grain += num(l.yieldPerYear && l.yieldPerYear.grain);
        t.cloth += num(l.yieldPerYear && l.yieldPerYear.cloth);
      });
    } else {
      t.money += num(pw.land) * landPrice;
    }
    // 房产
    (Array.isArray(pw.houses) ? pw.houses : []).forEach(function(h) { t.money += num(firstDefined(h.estimatedValue, h.value, 0)); });
    // 商铺（无估值则按年营收×3 折）
    (Array.isArray(pw.shops) ? pw.shops : []).forEach(function(s) { t.money += num(firstDefined(s.estimatedValue, (num(s.annualRevenue) * 3), 0)); });
    // 珍玩
    if (Array.isArray(pw.treasures) && pw.treasures.length) pw.treasures.forEach(function(tr) { t.money += num(tr.estimatedValue); });
    else t.money += num(pw.treasure);
    // 家族企业（无估值则按年利×3 折）
    (Array.isArray(pw.familyBusiness) ? pw.familyBusiness : []).forEach(function(b) { t.money += num(firstDefined(b.estimatedValue, (num(b.annualProfit) * 3), 0)); });
    // 商业（扁平 commerce 估值）
    t.money += num(pw.commerce);
    // 投资本金
    (Array.isArray(pw.investments) ? pw.investments : []).forEach(function(iv) { t.money += num(firstDefined(iv.principal, iv.amount, 0)); });
    // 扣债务
    if (Array.isArray(pw.debts) && pw.debts.length) {
      pw.debts.forEach(function(d) {
        var a = d.amount;
        if (a && typeof a === 'object') { t.money -= num(a.money); t.grain -= num(a.grain); t.cloth -= num(a.cloth); }
        else t.money -= num(firstDefined(a, d.principal, 0));
      });
    } else {
      t.money -= num(pw.debt);
    }
    t.money = Math.round(t.money); t.grain = Math.round(t.grain); t.cloth = Math.round(t.cloth);
    return { money: t.money, grain: t.grain, cloth: t.cloth, totalValue: { money: t.money, grain: t.grain, cloth: t.cloth } };
  }

  function familyStatusOf(ch) {
    return ch && ch.familyStatus && typeof ch.familyStatus === 'object' ? ch.familyStatus : null;
  }

  function familyIdOf(ch) {
    if (!ch) return '';
    if (typeof ch.family === 'string') return ch.family;
    if (ch.family && typeof ch.family === 'object') {
      return ch.family.clanId || ch.family.id || ch.family.name || '';
    }
    return ch.familyId || ch.clanId || ch.motherClan || '';
  }

  function familyRoleOf(ch) {
    if (!ch) return '';
    if (ch.family && typeof ch.family === 'object') return ch.family.role || '';
    return ch.familyRole || '';
  }

  function eachFamilyRecord(fn) {
    var g = global.GM || {};
    [g.clans, g.families].forEach(function(src) {
      if (!src) return;
      if (Array.isArray(src)) {
        src.forEach(function(item) { if (item) fn(item.id || item.key || item.name, item); });
      } else if (typeof src === 'object') {
        Object.keys(src).forEach(function(k) { if (src[k]) fn(k, src[k]); });
      }
    });
  }

  function findFamilyRecord(ch) {
    var id = familyIdOf(ch);
    var status = familyStatusOf(ch);
    var statusName = status && (status['郡望'] || status.junwang || status.name);
    var found = null;
    eachFamilyRecord(function(k, rec) {
      if (found || !rec) return;
      if (id && (k === id || rec.id === id || rec.key === id || rec.name === id)) found = { key: k, rec: rec };
      else if (statusName && rec.name === statusName) found = { key: k, rec: rec };
    });
    return found;
  }

  function familyTierOf(ch, record) {
    var status = familyStatusOf(ch);
    return (record && (record.tier || record.familyTier))
      || (ch && ch.familyTier)
      || (status && (status['门第'] || status.tier))
      || '';
  }

  function normalizeSocialClass(ch) {
    if (!ch) return 'commoner';
    if (ch.socialClass && CLASS_PARAMS[ch.socialClass]) return ch.socialClass;
    var tier = String(familyTierOf(ch) || '').toLowerCase();
    var status = familyStatusOf(ch);
    var statusTier = String(status && (status['门第'] || status.tier) || '').toLowerCase();
    var title = String(ch.title || ch.officialTitle || '');
    var bg = String(ch.background || '');
    if (tier.indexOf('imperial') >= 0 || statusTier.indexOf('imperial') >= 0 || ch.isRoyal) return 'imperial';
    if (/general|commander|military|marshal|将|帅|都督|总兵|提督/.test(title + bg)) return 'militaryOfficial';
    if (ch.officialTitle || (num(ch.rankLevel) >= 1 && num(ch.rankLevel) <= 18) || (num(ch.rank) >= 1 && num(ch.rank) <= 9)) return 'civilOfficial';
    if (tier.indexOf('noble') >= 0 || statusTier.indexOf('noble') >= 0 || /公|侯|伯/.test(title)) return 'noble';
    if (tier.indexOf('merchant') >= 0 || statusTier.indexOf('merchant') >= 0 || /商/.test(bg)) return 'merchant';
    if (tier.indexOf('land') >= 0 || /地主|乡绅/.test(bg)) return 'landlord';
    if (statusTier.indexOf('peasant') >= 0 || statusTier.indexOf('outcast') >= 0) return 'commoner';
    return inferSocialClass(ch);
  }

  function classParamsSnapshot(key) {
    var src = CLASS_PARAMS[key] || CLASS_PARAMS.commoner || {};
    var out = {};
    Object.keys(src).forEach(function(k) {
      if (typeof src[k] === 'number') out[k] = src[k];
    });
    return out;
  }

  function buildFamilyEconomySnapshot(ch) {
    if (!ch) return null;
    var found = findFamilyRecord(ch);
    var record = found && found.rec;
    var status = familyStatusOf(ch);
    var id = (record && (record.id || record.key)) || (found && found.key) || familyIdOf(ch);
    var name = (record && record.name) || (status && (status['郡望'] || status.junwang || status.name)) || id || '';
    var members = record && Array.isArray(record.members) ? record.members : (Array.isArray(ch.familyMembers) ? ch.familyMembers : []);
    if (!id && !name && !status && !members.length) return null;
    var role = familyRoleOf(ch);
    return {
      clanId: id || '',
      clanName: name || '',
      tier: familyTierOf(ch, record),
      renown: num(firstDefined(record && record.renown, record && record.prestige, record && record.clanPrestige, ch.clanPrestige, status && status['声望'])),
      sharedWealth: num(firstDefined(record && record.sharedWealth, record && record.commonWealth, record && record.wealth)),
      memberCount: members.length,
      role: role,
      isHead: role === 'head' || role === 'leader' || (record && (record.headId === ch.id || record.head === ch.name)),
      familyStatus: copyPlain(status)
    };
  }

  function buildSocialTierSnapshot(ch) {
    if (!ch) return null;
    var found = findFamilyRecord(ch);
    var record = found && found.rec;
    var key = normalizeSocialClass(ch);
    return {
      key: key,
      rankLevel: num(firstDefined(ch.rankLevel, ch.rank)),
      familyTier: familyTierOf(ch, record),
      clanPrestige: num(firstDefined(ch.clanPrestige, record && record.renown, record && record.prestige)),
      classParams: classParamsSnapshot(key)
    };
  }

  // 六资源 → NPC 行为倾向权重（设计-角色经济·注入 AI 推演 prompt）
  //   纯函数·defensive read（不 re-normalize·供 buildEconomySnapshot 内联调用）·通用·阈值朝代中立
  var BW_MIDCLASS = 2000, BW_RICH = 20000;   // 中产/巨富 银两参考（引擎默认·剧本可另调平衡）
  function computeBehaviorWeights(ch) {
    if (!ch) return null;
    var r = ch.resources || {};
    var pw = r.privateWealth || r.private || {};
    var money = num(pw.money);
    var fame = num(r.fame);
    var merit = num(r.virtueMerit);
    var integrity = num(firstDefined(ch.integrity, 50));
    var ambition = num(firstDefined(ch.ambition, 50));
    var stress = num(firstDefined(r.stress, ch.stress, 20));
    var health = num(firstDefined(r.health, ch.health, 70));
    var corruption = (100 - integrity) / 100;
    var ptMoney = r.publicTreasury ? num(firstDefined(r.publicTreasury.balance, r.publicTreasury.money)) : 0;
    var clanInf = num(firstDefined(ch.clanPrestige, 50)) / 100;
    var hasMil = !!(ch.hasMilitaryPower || /将|帅|总兵|提督|都督|统领|经略|总兵官/.test(String(ch.officialTitle || ch.title || '')));
    function c1(v) { return Math.round(clamp(v, 0, 1) * 100) / 100; }
    return {
      bribery:           c1(0.1 + (money < 0 ? 0.4 : 0) + (money < BW_MIDCLASS ? 0.2 : 0) + ambition / 100 * 0.3),
      embezzle:          c1(0.05 + (money < 0 ? 0.3 : 0) + corruption * 0.5 + (ptMoney > 100000 ? 0.1 : 0)),
      politicalClout:    Math.round(clamp(0.2 + fame / 100 * 0.3 + merit / 15000 * 0.3 + money / (BW_RICH * 5) * 0.2, 0, 2) * 100) / 100,
      luxury:            c1(0.2 + money / BW_RICH * 0.4 + (num(ch.rankLevel) >= 1 && num(ch.rankLevel) <= 2 ? 0.2 : 0)),
      partyFunding:      c1(money / BW_RICH * 0.5 + ptMoney / 1000000 * 0.3),
      antiCorruptSens:   c1(0.5 - (fame < 0 ? 0.3 : 0) - clanInf * 0.3),
      resignRisk:        c1(stress / 100 * 0.4 + (100 - health) / 100 * 0.3 + (fame < -50 ? 0.2 : 0)),
      rebelRisk:         c1((money < 0 ? 0.1 : 0) + (merit > 7500 && fame < -30 ? 0.3 : 0) + (hasMil ? 0.3 : 0) - (fame > 50 ? 0.2 : 0)),
      recruitTalent:     c1(merit / 10500 * 0.5 + fame / 100 * 0.3)
    };
  }

  function buildEconomySnapshot(ch) {
    if (!ch) return null;
    if (!ch.resources) ch.resources = {};
    var r = ch.resources;
    var privateWealth = normalizePrivateWealth(ch);
    var money = num(privateWealth && privateWealth.money);
    var publicPurse = r.publicPurse || null;
    var publicTreasury = r.publicTreasury || null;
    return {
      privateWealth: {
        money: money,
        grain: num(privateWealth && privateWealth.grain),
        cloth: num(privateWealth && privateWealth.cloth),
        land: num(privateWealth && privateWealth.land),
        treasure: num(privateWealth && privateWealth.treasure),
        slaves: num(privateWealth && privateWealth.slaves),
        commerce: num(privateWealth && privateWealth.commerce),
        debt: money < 0 ? Math.max(Math.abs(money), num(privateWealth && privateWealth.debt)) : num(privateWealth && privateWealth.debt)
      },
      familyEconomy: buildFamilyEconomySnapshot(ch),
      socialTier: buildSocialTierSnapshot(ch),
      hiddenWealth: num(r.hiddenWealth),
      privateSummary: _calcPrivateSummary(ch),
      fame: num(r.fame),
      virtueMerit: num(r.virtueMerit),
      virtueStage: num(r.virtueStage),
      behaviorWeights: computeBehaviorWeights(ch),
      health: num(firstDefined(r.health, ch.health)),
      stress: num(firstDefined(r.stress, ch.stress)),
      publicPurse: publicPurse ? {
        money: num(publicPurse.money),
        grain: num(publicPurse.grain),
        cloth: num(publicPurse.cloth)
      } : null,
      publicTreasury: publicTreasury ? {
        linkedPost: publicTreasury.linkedPost || publicTreasury.post || null,
        linkedRegion: publicTreasury.linkedRegion || publicTreasury.region || null,
        balance: num(firstDefined(publicTreasury.balance, publicTreasury.money)),
        grain: num(publicTreasury.grain),
        cloth: num(publicTreasury.cloth),
        deficit: num(firstDefined(publicTreasury.deficit, publicTreasury.lastHandoverDeficit)),
        isReadOnly: publicTreasury.isReadOnly !== false
      } : null,
      lastTick: {
        income: ch._lastTickIncome || null,
        expense: ch._lastTickExpense || null,
        net: num(ch._lastTickNet)
      }
    };
  }

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
    normalizePrivateWealth(ch);

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
    if (!ch.socialClass || !CLASS_PARAMS[ch.socialClass]) ch.socialClass = normalizeSocialClass(ch);

    // 家族
    if (!ch.family) ch.family = { clanId: null, headId: null, role: 'member' };
  }

  // 显式检测缺失字段（设计-角色经济·运行时自动补齐 _detectMissingFields）
  function detectMissingFields(ch) {
    var missing = [];
    if (!ch) return missing;
    if (!ch.name) missing.push('name');
    if (ch.gender == null) missing.push('gender');
    if (ch.age == null) missing.push('age');
    if (!ch.zi && !ch.courtesy) missing.push('courtesy');
    if (!ch.resources) missing.push('resources');
    ['loyalty', 'ambition', 'intelligence', 'administration'].forEach(function(a) { if (ch[a] == null) missing.push(a); });
    if (!ch.socialClass) missing.push('socialClass');
    if (!ch.family) missing.push('family');
    return missing;
  }

  // 确定性补全残缺角色（设计-角色经济·_ensureCharComplete 的确定性层）
  //   五类触发(AI涌现/剧本进场/玩家诏令/历史事件/继承婚姻)统一靠每回合全 char 扫描收口——
  //   不论角色从何途径进来，下个 tick 必被补全。AI 散文/家谱深度生成由 aiGenerateCompleteCharacter 负责(创建时)。
  function ensureCharComplete(ch) {
    if (!ch) return [];
    var missing = detectMissingFields(ch);
    if (missing.length) {
      if (ch.gender == null) ch.gender = '男';   // 古代官场默认(剧本/AI 可改)
      if (ch.age == null) ch.age = 35;
      // 十维缺省(中庸 50)·只填 undefined·不覆盖既有
      ['loyalty', 'ambition', 'intelligence', 'valor', 'military', 'administration',
       'management', 'charisma', 'diplomacy', 'benevolence'].forEach(function(a) { if (ch[a] == null) ch[a] = 50; });
      ch._autoCompletedTurn = (global.GM && global.GM.turn) || 0;
    }
    ensureCharResources(ch);   // 六资源保障
    ensureCourtesyName(ch);    // 字保障
    return missing;
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

  // 身份转换：任命/受封时升阶（绕过 socialClass 的 sticky 早返）
  //   平民/商/地主/僧道 入仕 → 文官/武官；受爵/世袭 → 勋贵；皇族不降；已官身/勋贵不降。
  //   覆盖设计四转换之三：捐纳→官·科举→官·武官世袭→勋贵（获罪→庶人在 confiscate 已落）。
  function reconcileSocialClassOnAppointment(ch) {
    if (!ch || !ch.officialTitle) return ch ? ch.socialClass : null;
    var cls = ch.socialClass;
    if (cls === 'imperial') return cls;                      // 皇族不因任官改阶
    var t = String(ch.officialTitle || '') + String(ch.title || '');
    var bg = String(ch.background || '');
    // 受封爵位 / 世袭袭爵 → 勋贵
    if (/(公|侯|伯)$/.test(ch.officialTitle || '') || /世袭|袭爵/.test(bg + t)) {
      if (cls !== 'noble') ch.socialClass = 'noble';
      return ch.socialClass;
    }
    if (cls === 'noble') return cls;                         // 已勋贵不降
    if (cls === 'civilOfficial' || cls === 'militaryOfficial') return cls;  // 已官身
    // 平民/商/地主/僧道/无效 → 入仕升官身
    ch.socialClass = /general|commander|military|marshal|将|帅|都督|总兵|提督/.test(t + bg) ? 'militaryOfficial' : 'civilOfficial';
    return ch.socialClass;
  }

  // 显式阶层设置（供捐纳/世袭/掠夺等专门转换路径调用）
  function setSocialClass(ch, cls) {
    if (!ch || !CLASS_PARAMS[cls]) return false;
    ch.socialClass = cls;
    return true;
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
    // 4. 经营（商人/地主）·有 shops[] 明细则交细粒度 shopRevenue 处理(防双计)
    commerce: function(ch) {
      var pw = ch.resources.privateWealth;
      if (Array.isArray(pw.shops) && pw.shops.length) return 0;
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.commerceYield) return (pw.commerce || 0) * cls.commerceYield / 12;
      return 0;
    },
    // 5. 田租（地主）·有 landHoldings[] 明细则交细粒度 landRentDetail(防双计)
    rent: function(ch) {
      var pw = ch.resources.privateWealth;
      if (Array.isArray(pw.landHoldings) && pw.landHoldings.length) return 0;
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.landYield) return (pw.land || 0) * cls.landYield / 12;
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
    },
    // 15. 商铺营收（细粒度·shops[] 各店年营收/12）
    shopRevenue: function(ch) {
      var pw = ch.resources.privateWealth;
      if (!Array.isArray(pw.shops) || !pw.shops.length) return 0;
      var s = 0;
      pw.shops.forEach(function(x) { s += num(x.annualRevenue); });
      return s / 12;
    },
    // 16. 家族企业利润（细粒度·familyBusiness[] 年利按 partner 数分红/12）
    businessProfit: function(ch) {
      var pw = ch.resources.privateWealth;
      if (!Array.isArray(pw.familyBusiness) || !pw.familyBusiness.length) return 0;
      var s = 0;
      pw.familyBusiness.forEach(function(b) {
        var p = num(b.annualProfit);
        var partners = Array.isArray(b.partners) ? b.partners.length : 1;
        s += partners > 1 ? p / partners : p;   // 多股东均分
      });
      return s / 12;
    },
    // 17. 放贷/投资收益（细粒度·investments[] 年息/12·违约不计）
    investmentReturn: function(ch) {
      var pw = ch.resources.privateWealth;
      if (!Array.isArray(pw.investments) || !pw.investments.length) return 0;
      var s = 0;
      pw.investments.forEach(function(iv) {
        if (iv.status === 'defaulted') return;
        s += num(firstDefined(iv.expectedReturn, num(iv.principal) * num(firstDefined(iv.rate, 0.1)), 0));
      });
      return s / 12;
    },
    // 18. 田庄租息（细粒度·landHoldings[] 按亩×市价×地租率/12）
    landRentDetail: function(ch) {
      var pw = ch.resources.privateWealth;
      if (!Array.isArray(pw.landHoldings) || !pw.landHoldings.length) return 0;
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      var yieldRate = cls.landYield || 0.05;
      var price = (global.GM && GM.currency && GM.currency.market && num(GM.currency.market.landPricePerUnit)) || 5;
      var s = 0;
      pw.landHoldings.forEach(function(l) { s += num(l.area) * price * yieldRate; });
      return s / 12;
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
    // 5. 宅第修缮·有 houses[] 明细则交细粒度 houseUpkeep(防双计)
    estate: function(ch) {
      var pw = ch.resources.privateWealth;
      if (Array.isArray(pw.houses) && pw.houses.length) return 0;
      return (pw.land || 0) * 0.01;  // 亩 0.01 两/月修缮
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
    // 13. 借款利息·有 debts[] 明细则交细粒度 debtService(防双计)
    debtInterest: function(ch) {
      var pw = ch.resources.privateWealth;
      if (Array.isArray(pw.debts) && pw.debts.length) return 0;
      if (!pw.money || pw.money >= 0) return 0;
      return Math.abs(pw.money) * 0.02;  // 2%/月
    },
    // 14. 赌博挥霍
    gambling: function(ch) {
      // traits 含"贪玩"或 stress > 70 时可能
      if ((ch.stress || 0) > 70 && Math.random() < 0.1) return 100 + Math.random() * 500;
      return 0;
    },
    // 15. 宅院维护（细粒度·houses[] 各宅年维护/12 + 奢华度月耗）
    houseUpkeep: function(ch) {
      var pw = ch.resources.privateWealth;
      if (!Array.isArray(pw.houses) || !pw.houses.length) return 0;
      var s = 0;
      pw.houses.forEach(function(h) {
        var annual = num(firstDefined(h.annualUpkeep, num(h.estimatedValue || h.value) * 0.02, 0));
        s += annual / 12 + num(h.luxuryLevel) * 20;   // 月维护 + 奢华月耗(luxuryLevel 0-10 → 0-200/月)
      });
      return s;
    },
    // 16. 债务清偿（细粒度·debts[] 各笔按月息）
    debtService: function(ch) {
      var pw = ch.resources.privateWealth;
      if (!Array.isArray(pw.debts) || !pw.debts.length) return 0;
      var s = 0;
      pw.debts.forEach(function(d) {
        var a = d.amount;
        var principal = (a && typeof a === 'object') ? num(a.money) : num(firstDefined(a, d.principal, 0));
        s += principal * num(firstDefined(d.monthlyRate, d.rate ? num(d.rate) / 12 : 0.02));  // 默认月息 2%
      });
      return s;
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
     'examReward','templeDonation','militaryReward','personalTribute','extortion',
     'shopRevenue','businessProfit','investmentReturn','landRentDetail'].forEach(function(k) {
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

    // ─ §XI 角色↔官方变量联动（环境腐败→integrity·皇威皇权→loyalty·暴君→压力）─
    tickCharVariableLinkages(ch, mr);

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

  // 统一只读镜像（UI/外部读公库的唯一入口）—— 闲职/无官返回全零
  function getCharPublicTreasuryDisplay(ch) {
    var empty = { money: 0, grain: 0, cloth: 0, deficit: 0, isReadOnly: true, isInherited: false, linkedPost: null, linkedRegion: null, isGuoku: false };
    if (!ch) return empty;
    ensureCharResources(ch);
    updatePublicTreasuryMirror(ch);
    var pt = ch.resources.publicTreasury;
    if (!pt || (!pt.linkedPost && !pt.linkedRegion && !pt.isGuoku)) return empty;
    return {
      money: num(pt.balance),
      grain: num(pt.grain),
      cloth: num(pt.cloth),
      deficit: num(firstDefined(pt.deficit, pt.lastHandoverDeficit)),
      isReadOnly: pt.isReadOnly !== false,
      isInherited: !!(pt.handoverLog && pt.handoverLog.length > 0 && num(pt.lastHandoverDeficit) > 0),
      linkedPost: pt.linkedPost || null,
      linkedRegion: pt.linkedRegion || null,
      isGuoku: !!pt.isGuoku
    };
  }

  // 去职追亏：离任时机构(职位/区域)仍有亏空 → 向离任者私产追偿，返回追回额
  //   surplus(盈余)无需移交——公库绑机构，盈余天然留任给继任，故只处理 deficit。
  function pursueTreasuryDeficit(ch, entity) {
    if (!ch || !entity || !entity.publicTreasury || !entity.publicTreasury.money) return { pursued: 0, deficitRemaining: 0 };
    ensureCharResources(ch);
    var m = entity.publicTreasury.money;
    var def = num(m.deficit);
    if (def <= 0) return { pursued: 0, deficitRemaining: 0 };
    var pw = ch.resources.privateWealth;
    var pursued = Math.min(def, Math.max(0, num(pw.money)));   // 至多追到私产现银见底，不造负债
    if (pursued > 0) {
      pw.money -= pursued;
      m.deficit = def - pursued;
      m.available = num(m.available) + pursued;
    }
    return { pursued: pursued, deficitRemaining: m.deficit };
  }

  function tickStressHealth(ch, mr) {
    // 压力消长
    var stressDelta = 0;
    if (ch.officialTitle && (ch.rankLevel || 0) > 15) stressDelta += 0.3;  // 高官压力
    if (ch._recentFailures) stressDelta += ch._recentFailures * 2;
    if (ch.health < 50) stressDelta += 0.5;
    // 自然衰减
    stressDelta -= 0.4;
    // 爱好解压(owner 2026-06)：有闲暇做雅好者借此排遣·压力缓降——闭合面板「释压之法」的承诺(此前 hobbies 仅展示不生效)。
    //   在押/流放/逃亡/失踪/守丧者无闲情·不享此减。兼容数组与「、,·/」分隔串两种 hobbies 写法。跨朝代:任何剧本有爱好的角色受益。
    if (!(ch._imprisoned || ch.imprisoned || ch._exiled || ch.exiled || ch._fled || ch._missing || ch._mourning)) {
      var _hob = ch.hobbies;
      var _hobN = Array.isArray(_hob) ? _hob.length
                : (typeof _hob === 'string' && _hob.trim() ? _hob.split(/[、,，·\/;；]/).filter(function (x) { return x && x.trim(); }).length : 0);
      if (_hobN > 0) stressDelta -= Math.min(_hobN, 3) * 0.3;   // 每项 -0.3·至多三项(-0.9/月)·与自然衰减(-0.4)同量级·不喧宾夺主
    }
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
    var TP = (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)).TMPromotion;
    // 状态闸：在押/流放/逃亡/守丧/革职待罪 → 功名冻结（不在位尽职则不攒资历）。近期功绩仍消退。
    if (ch._imprisoned || ch.imprisoned || ch._exiled || ch.exiled || ch._fled || ch._missing || ch._mourning) {
      if (ch._recentAchievements) ch._recentAchievements = Math.max(0, ch._recentAchievements * 0.6);
      return;
    }
    // 每月微积累（在职底 + 近期功绩 + 八维能臣度）
    var base = 0;
    if (ch.officialTitle) base += 0.3;                                  // 在职底(庸臣也有基本积累)
    if (ch._recentAchievements) base += ch._recentAchievements * 0.5;   // 近期功绩（由 addAchievement 喂·下方衰减·激活原死字段）
    // 八维能臣度驱动(能者多得·拉大能力差距)·#3 功名与廉洁解耦
    var _cap = TP ? TP.capability(ch, (typeof getEffectiveAttr === 'function' ? getEffectiveAttr : null)) : 50;
    base += Math.max(0, (_cap - 45) / 100 * 1.0);                       // 能力加成只加不减·斜率大(能臣远多于庸臣)
    if (base < 0) base = 0;
    // 方向/状态调制：怠政（重压≥75/重病≤25）挣取打折·致仕减半（退而不攒资历）·均不改 owner 锁定的 EARN 数值
    var dutyMul = 1;
    if ((ch.stress || 0) >= 75 || (ch.health != null && ch.health <= 25)) dutyMul = 0.4;
    if (ch._retired) dutyMul = Math.min(dutyMul, 0.5);
    base *= dutyMul;
    var _gain = base * (TP ? TP.capabilityFactor(_cap) : 1) * mr;
    if (TP) _gain *= TP.diminishFactor(r.virtueMerit || 0) * TP.SCALE;  // 高位递减 + 对齐 0-15000 尺度
    var _capT = TP ? TP.EARN.perTurnCapBase * mr : 1e9;                 // 单回合封顶(随回合长 mr 缩放)
    if (_gain > _capT) _gain = _capT;
    r.virtueMerit = (r.virtueMerit || 0) + _gain;
    if (ch._recentAchievements) ch._recentAchievements = Math.max(0, ch._recentAchievements * 0.6); // 近期功绩衰减·避免永久驱动
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

  // §XI 角色↔官方变量联动（设计-角色经济·安全核心三条·均写 char 叶子字段）
  //   #1 环境腐败→integrity双向 #2 皇威皇权→loyalty漂移(温和·不压恩德系统) #3 暴君段→在朝官员压力
  //   缺前提缓做：#4 皇帝宠信疑忌(GM.emperor.suspicionOf/favorOf 不存在) #7 地方官→民心(走 ledger 叶子·单列)
  function tickCharVariableLinkages(ch, mr) {
    if (!ch || ch.dead || ch.retired) return;
    var G = global.GM || {};
    // #1 环境腐败 → integrity 双向腐化（§11.2）·浊环境加速堕落/清明环境约束贪官
    if (ch.department && G.corruption && G.corruption.subDepts && G.corruption.subDepts[ch.department] && ch.integrity != null) {
      var dc = num(G.corruption.subDepts[ch.department].true);
      if (dc > 50) ch.integrity = clamp(ch.integrity - (dc - 40) / 100 * 2 * mr, 0, 100);   // 年至多 -2
      else if (dc < 30 && ch.integrity < 50) ch.integrity = clamp(ch.integrity + 0.5 * mr, 0, 100);
    }
    // #2 皇威段位 + 皇权弱+野心 → loyalty（对君忠诚·§11.3）·×0.5 温和漂移避免压过恩德系统
    if (ch.loyalty != null && !isEmperor(ch)) {
      var w = G.huangwei ? num(G.huangwei.index) : 50;
      var h = G.huangquan ? num(G.huangquan.index) : 50;
      var lDelta = 0;
      if (w > 90) lDelta -= 1;        // 暴君段·口服心离
      else if (w > 70) lDelta += 1;   // 威严段·正常敬畏
      else if (w < 30) lDelta -= 2;   // 失威段·臣民离心
      if (h < 35 && (ch.ambition || 0) > 70) {  // 皇权弱+野心高 → 谋权臣
        lDelta -= 1;
        ch.ambition = clamp((ch.ambition || 0) + 0.5 * mr, 0, 100);
      }
      if (lDelta) ch.loyalty = clamp(ch.loyalty + lDelta * 0.5 * mr, 0, 100);
    }
    // #3 暴君段 → 在朝官员压力累积（§11.4·避祸事件 selfTarnish/feignIllness 暂略）
    if (ch.officialTitle && G.huangwei && num(G.huangwei.index) > 90) {
      ch.stress = clamp((ch.stress || 20) + 1.5 * mr, 0, 100);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 抄家清算（隐匿挖掘 + 五级株连）
  // ═════════════════════════════════════════════════════════════

  // 隐匿率：豪门易隐 + 监察弱 + 越贪越擅藏 + 权贵藏匿能力强
  function estimateConcealmentRatio(ch) {
    if (!ch) return 0;
    var r = ch.resources || {};
    var clanInfluence = clamp(num(firstDefined(ch.clanPrestige, 50)) / 100, 0, 1);   // 族望作豪门代理
    var monitoring = clamp(num(firstDefined(ch.monitoring, 0.5)), 0, 1);             // 监察强度 0-1
    var corruption = clamp((100 - num(firstDefined(ch.integrity, 50))) / 100, 0, 1); // 越不廉越擅藏
    var merit = num(r.virtueMerit);
    var ratio = clanInfluence * 0.3 + (1 - monitoring) * 0.3 + corruption * 0.4
              + (merit > 7500 ? 0.2 : 0);   // 朝宗阶以上权贵（≈旧 500×SCALE）
    return clamp(ratio, 0, 1);
  }

  // 估算隐匿总额 = 已追踪藏款 + 申报财产 × 隐匿率（未追踪那部分）
  function estimateHiddenWealth(ch) {
    if (!ch) return 0;
    ensureCharResources(ch);
    var r = ch.resources, pw = r.privateWealth;
    var visible = Math.max(0, (pw.money || 0)) + (pw.land || 0) * 5 + (pw.treasure || 0) + (pw.commerce || 0);
    return num(r.hiddenWealth) + visible * estimateConcealmentRatio(ch);
  }

  // 株连五级：none / immediate_family / full_family / nine_generations / ten_generations
  function collectImplicatedIds(ch, tier) {
    var ids = [];
    if (!ch || !tier || tier === 'none') return ids;
    function pushId(x) {
      if (x == null) return;
      var id = (typeof x === 'object') ? (x.id || x.name) : x;
      if (id != null && ids.indexOf(id) < 0 && id !== ch.id && id !== ch.name) ids.push(id);
    }
    var fam = ch.family || {};
    // 直系：配偶 + 子女
    [ch.spouseId, ch.spouse, fam.spouse, fam.spouseId].forEach(pushId);
    (fam.children || ch.children || []).forEach(pushId);
    if (tier === 'immediate_family') return ids;
    // 三族：父母 + 兄弟姐妹 + 孙辈
    [fam.fatherId, fam.motherId, fam.father, fam.mother].forEach(pushId);
    (fam.siblings || []).forEach(pushId);
    (fam.grandchildren || []).forEach(pushId);
    if (tier === 'full_family') return ids;
    // 九族 / 十族：全族成员
    var clanId = fam.clanId || familyIdOf(ch);
    if (clanId && GM.clans && GM.clans[clanId] && Array.isArray(GM.clans[clanId].members)) {
      GM.clans[clanId].members.forEach(pushId);
    }
    if (tier === 'ten_generations') {
      (ch.disciples || ch.mensheng || []).forEach(pushId);  // 十族：再加门生故吏
    }
    return ids;
  }

  function confiscate(ch, opts) {
    if (!ch) return { success: false, reason: '无此人' };
    opts = opts || {};
    ensureCharResources(ch);
    if (ch.confiscated && !opts._recursed) return { success: false, reason: '已抄没', total: 0 };

    var r = ch.resources;

    // 挖掘率：thoroughness×0.3 + interrogationPressure×0.5 + informantQuality×0.2；
    // 未给细项则退化为 opts.intensity（向后兼容旧调用）
    var excavationRate;
    if (opts.thoroughness != null || opts.interrogationPressure != null || opts.informantQuality != null) {
      excavationRate = num(opts.thoroughness) * 0.3 + num(opts.interrogationPressure) * 0.5 + num(opts.informantQuality) * 0.2;
    } else {
      excavationRate = (opts.intensity != null) ? num(opts.intensity) : 0.5;
    }
    excavationRate = clamp(excavationRate, 0, 1);

    // 隐匿挖掘（动态隐匿率 × 挖掘率）—— 先算，因 estimateHiddenWealth 内部会重置 r.privateWealth
    var hiddenFound = estimateHiddenWealth(ch) * excavationRate;
    r.hiddenWealth = Math.max(0, num(r.hiddenWealth) * (1 - excavationRate));

    // pw 须在 estimateHiddenWealth 之后取（其内部 normalize 会换 r.privateWealth 引用）
    var pw = r.privateWealth;
    var visible = Math.max(0, (pw.money || 0)) + (pw.land || 0) * 5 + (pw.treasure || 0) + (pw.commerce || 0);

    // 株连等级解析（向后兼容旧 includeClan → 九族）
    var tier = opts.clanImplication || (opts.includeClan ? 'nine_generations' : 'none');
    var clanLoss = 0;        // 家族共财损失（由主犯入账）
    var implicatedHaul = 0;  // 受株连族人各自抄没所得（各自已自行入账，仅汇报）
    var implicated = [];
    if (!opts._recursed && tier !== 'none') {
      // 九族 / 十族：取家族共财
      if (tier === 'nine_generations' || tier === 'ten_generations') {
        var clanId = (ch.family && ch.family.clanId) || familyIdOf(ch);
        if (clanId && GM.clans && GM.clans[clanId]) {
          var clan = GM.clans[clanId];
          clanLoss = num(clan.sharedWealth) * excavationRate * 0.5;
          clan.sharedWealth = Math.max(0, num(clan.sharedWealth) - clanLoss);
        }
      }
      // 递归抄受株连角色（各自不再株连，避免回环；各自自行入账）
      implicated = collectImplicatedIds(ch, tier);
      implicated.forEach(function(id) {
        var m = (GM.chars || []).find(function(c) { return c && (c.id === id || c.name === id); });
        if (m && !m.confiscated && !m.dead) {
          var sub = confiscate(m, { intensity: excavationRate, destination: opts.destination, clanImplication: 'none', _recursed: true });
          if (sub && sub.total) implicatedHaul += sub.total;
        }
      });
    }

    // 主犯入账总额 = 本人明产 + 挖出暗产 + 家族共财
    var total = visible + hiddenFound + clanLoss;

    // 现金清零；田产没官；slaves/treasure/commerce 估值记账
    pw.money = 0; pw.land = 0; pw.treasure = 0; pw.commerce = 0; pw.slaves = 0;

    // 按 destination 分账（默认入帑廪·"籍没入官"传统）
    var dest = opts.destination || 'guoku';
    if (dest === 'neitang' && GM.neitang) {
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToNeitang) FiscalEngine.addToNeitang({ money: total }, '抄没'); // 收口·走真账
      else GM.neitang.balance = num(GM.neitang.balance) + total; // 沙箱兜底
      GM.neitang._recentConfiscation = (GM.neitang._recentConfiscation || 0) + total;
    } else if (GM.guoku) {
      // 抄没入官走 FiscalEngine 真账(2026-07-04 收口)
      try {
        var _F = (typeof FiscalEngine !== 'undefined' && FiscalEngine) || (typeof window !== 'undefined' && window.FiscalEngine) || null;
        if (_F && _F.addToGuoku) _F.addToGuoku({ money: total }, '抄没入官');
      } catch (_e) {}
      dest = 'guoku';
    }

    // 角色状态：抄没 → 庶人·身败名裂
    ch.retired = true;
    ch.confiscated = true;
    ch.status = 'disgraced';
    ch.socialClass = 'commoner';
    if (r.fame != null) r.fame = clamp(r.fame - 40, -100, 100);  // 抄家名望重挫

    // 风闻（仅主犯播报，株连不刷屏）
    if (!opts._recursed && typeof addEB === 'function') {
      var _U = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.getUnit)
        ? CurrencyUnit.getUnit() : { money:'两' };
      var tierLabel = { immediate_family:'·株及妻孥', full_family:'·株连三族', nine_generations:'·株连九族', ten_generations:'·夷十族' }[tier] || '';
      var grand = total + implicatedHaul;
      addEB('惩罚', '抄没' + ch.name + '家产 ' + Math.round(grand / 10000) + ' 万' + _U.money + '（明 ' +
        Math.round(visible / 10000) + ' 万 · 暗 ' + Math.round(hiddenFound / 10000) + ' 万）' + tierLabel,
        { credibility: 'high', subject: ch.id });
    }

    return {
      success: true, visible: visible, hidden: hiddenFound,
      clanLoss: clanLoss, implicated: implicated, implicatedHaul: implicatedHaul,
      total: total, grandTotal: total + implicatedHaul,
      destination: dest, clanImplication: tier
    };
  }

  function triggerCharacterDeath(ch, cause) {
    ch.dead = true;
    ch.alive = false; // 必须同步 alive=false·否则死者仍过 `alive!==false` 过滤·继续生成奏疏/信件、显在朝(bug)
    ch.deathCause = cause;
    ch.deathReason = cause; // 与 AI 死亡路径字段一致(部分显示/过滤读 deathReason)
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
    var heirIds = ch.family.children || [];
    var heirs = heirIds.map(function(id) { return (GM.chars || []).find(function(c) { return c.id === id; }); }).filter(Boolean);
    if (heirs.length === 0) {
      // 入内帑（无嗣财产归公）
      if (GM.neitang) {
        if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToNeitang) FiscalEngine.addToNeitang({ money: total * 0.5 }, '无嗣归公'); // 收口·走真账
        else GM.neitang.balance += total * 0.5; // 沙箱兜底
      }
      return;
    }
    // 继承规则：clanRules.inheritance(eldest_son 嫡长 / equal 均分 / merit_based 按贤)·clan/family 覆盖·默认均分
    var found = findFamilyRecord(ch);
    var clanRules = (found && found.rec && found.rec.clanRules) || {};
    var rule = clanRules.inheritance || (ch.family && ch.family.inheritance) || 'equal';
    function grant(heir, amt) { if (heir && amt) heir._inheritanceThisTurn = (heir._inheritanceThisTurn || 0) + amt; }
    if (rule === 'eldest_son') {
      // 嫡长继承：年最长者全予（femaleShare 留扩展·默认 0）
      var eldest = heirs.slice().sort(function(a, b) { return num(b.age) - num(a.age); })[0];
      grant(eldest, total);
    } else if (rule === 'merit_based') {
      // 按贤继承：以功名(+基数100防0)为权重分配
      var weights = heirs.map(function(h) { return Math.max(1, num(h.resources && h.resources.virtueMerit) + 100); });
      var wsum = weights.reduce(function(a, b) { return a + b; }, 0);
      heirs.forEach(function(h, i) { grant(h, total * weights[i] / wsum); });
    } else {
      // 均分（诸子均分）
      var perHeir = total / heirs.length;
      heirs.forEach(function(h) { grant(h, perHeir); });
    }
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
  // 排行/品德前缀（用于语义关联生成）
  var COURTESY_RANK_PREFIX = ['子','孟','仲','叔','季','伯','元','景','德','公'];

  // 「字」语义词库：名末字（义根）→ 典型表字（同义扩展/反义互补/补足/典故）
  //   通用·不限单朝——皆为传统取字法则下的常见配对
  var COURTESY_TEMPLATES = {
    '亮': ['孔明','景仁','元辉'], '明': ['景亮','思远','子炳','晦之'],
    '德': ['孟直','子厚','仲翁','怀仁'], '义': ['怀仁','元正','君直','子方'],
    '仁': ['子义','君礼','景厚','安卿'], '忠': ['伯直','守信','子诚','贞甫'],
    '勇': ['子刚','元毅','伯虎','武卿'], '文': ['子雅','仲彦','景章','质夫'],
    '武': ['子烈','元威','伯昌','定之'], '智': ['子睿','思敏','元哲'],
    '信': ['守诚','君实','子谅'], '贤': ['希圣','希孟','子能'],
    '良': ['伯善','子美','怀玉'], '清': ['濯之','子澄','涤生'],
    '正': ['公直','子方','存中'], '光': ['晦之','子辉','景升'],
    '华': ['子实','茂先','韶卿'], '俊': ['彦升','子英','茂才'],
    '杰': ['世英','子奇','士伟'], '安': ['泰之','子宁','定国'],
    '兴': ['子振','起之','邦彦'], '昌': ['盛之','子隆','炽甫'],
    '弘': ['毅之','广源','子道'], '毅': ['弘之','刚甫','子果'],
    '謙': ['牧之','光卿','受益'], '谦': ['牧之','光卿','受益'],
    '愈': ['退之'], '熹': ['元晦','仲晦'], '羽': ['云长','翼德'],
    '诚': ['敬之','子悫','信夫'], '敬': ['诚之','子肃','慎甫'],
    '思': ['子睿','明远','希贤'], '宗': ['继先','绍祖','承业'],
    '世': ['延嗣','克承','绍宗'], 'national': []
  };
  // 语义关联（同义/反义）：义根 → 关联字（再配排行前缀）
  var COURTESY_SEMANTIC = {
    '山': ['岳','峰','嵩','岱'], '水': ['川','源','澜','清'],
    '玉': ['珉','瑜','瑾','璞'], '金': ['钧','铉','锡','鉴'],
    '云': ['霄','汉','卿','翔'], '风': ['行','逸','举','翔'],
    '松': ['乔','贞','操','茂'], '竹': ['筠','虚','节','清'],
    '龙': ['云','渊','骧','飞'], '虎': ['威','彪','贲','勇'],
    '日': ['昭','曜','晖','旭'], '月': ['朗','望','华','澄'],
    '海': ['川','涵','纳','澜'], '川': ['源','流','深','广'],
    '春': ['和','荣','发','元'], '秋': ['实','成','肃','收']
  };

  function generateCourtesyName(name, traits) {
    if (!name) return '';
    var anchor = String(name).slice(-1);   // 取名末字为义根（诸葛亮→亮）
    // 1) 预置语义词库直接命中
    var tpl = COURTESY_TEMPLATES[anchor];
    if (tpl && tpl.length) return tpl[Math.floor(Math.random() * tpl.length)];
    // 2) 语义关联（同义/反义）+ 排行/品德前缀
    var rel = COURTESY_SEMANTIC[anchor];
    if (rel && rel.length) {
      var pfx = COURTESY_RANK_PREFIX[Math.floor(Math.random() * COURTESY_RANK_PREFIX.length)];
      return pfx + rel[Math.floor(Math.random() * rel.length)];
    }
    // 3) 特质导向前缀
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

  // 显示用称呼（完整称呼树·按说话者/正式度/上下级/亲疏/家族选 名/字/官职）
  //   context: { speaker, formality:'formal'|'informal'|'intimate', relationship, hierarchical:'upward'|'downward',
  //             intimacy:-1~1, sameFamily, isElder }
  function formatAddress(ch, context) {
    if (!ch) return '';
    context = context || {};
    var speaker = context.speaker || null;
    var zi = ch.zi || ch.courtesy || '';
    var title = ch.officialTitle || ch.title || '';
    var surname = ch.surname || (ch.name ? String(ch.name).charAt(0) : '');
    var formality = context.formality || (context.formal ? 'formal' : '');
    var intimacy = (typeof context.intimacy === 'number') ? context.intimacy : null;

    // 1) 目标是皇帝 → 陛下
    if (isEmperor(ch)) return '陛下';
    // 2) 说话者是皇帝：眷顾称字·朝堂称名
    if (speaker && isEmperor(speaker)) {
      if (formality === 'intimate' || context.relationship === 'intimate') return zi || ch.name;
      return ch.name;
    }
    // 3) 亲近 → 字（兼容旧键 relationship）
    if (context.relationship === 'intimate' || context.relationship === 'friend') return zi || ch.name;
    // 4) 正式 → 官职
    if (formality === 'formal' && title) return title;
    // 5) 上下级
    if (context.hierarchical === 'upward') return title || zi || ch.name;          // 下对上：尊称官衔
    if (context.hierarchical === 'downward') return (intimacy != null && intimacy >= 0.5 && zi) ? zi : ch.name;
    // 6) 平级按亲疏
    if (intimacy != null) {
      if (intimacy >= 0.7) return zi || ch.name;          // 挚友/同年 → 字
      if (intimacy < 0) return surname + (title || '');   // 敌对 → 姓+官衔
      return ch.name;                                      // 平常 → 名
    }
    // 7) 家族内：长辈对晚辈称字
    if (context.sameFamily && context.isElder) return zi || ch.name;
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
        ensureCharComplete(ch);   // 运行时自动补齐(收口五类触发·含 ensureCharResources+ensureCourtesyName)
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

  // 家族经济模式：communal(共财同居) / divided(分家)·朝代默认表(通用·剧本/clan 可覆盖)
  var FAMILY_MODE_DEFAULT = {
    '先秦': 'communal', '秦': 'communal', '汉': 'communal', '西汉': 'communal', '东汉': 'communal',
    '三国': 'communal', '晋': 'communal', '两晋': 'communal', '南北朝': 'communal', '隋': 'communal', '唐': 'communal',
    '五代': 'divided', '宋': 'divided', '北宋': 'divided', '南宋': 'divided', '辽': 'divided', '金': 'divided', '元': 'divided',
    '明': 'communal', '清': 'communal'   // 明东南共财/北方分家·清宗族复兴·此为引擎默认·剧本可按区域覆盖
  };
  function familyModeDefault(dynasty) {
    if (!dynasty) return 'communal';
    if (FAMILY_MODE_DEFAULT[dynasty]) return FAMILY_MODE_DEFAULT[dynasty];
    for (var k in FAMILY_MODE_DEFAULT) { if (String(dynasty).indexOf(k) >= 0) return FAMILY_MODE_DEFAULT[k]; }
    return 'communal';
  }
  function _currentDynasty() {
    var G = global.GM || {};
    return G.dynasty || (G.scenario && G.scenario.dynasty) || (G.scenarioMeta && G.scenarioMeta.dynasty) || (G.sc && G.sc.dynasty) || '';
  }
  // 角色所属家族模式：clan.mode 显式覆盖优先，否则按朝代默认
  function familyModeOf(ch) {
    var found = findFamilyRecord(ch);
    if (found && found.rec && found.rec.mode) return found.rec.mode;
    return familyModeDefault(_currentDynasty());
  }

  function tickClanPool(mr) {
    if (!GM.clans) return;
    var dynMode = familyModeDefault(_currentDynasty());
    Object.values(GM.clans).forEach(function(clan) {
      if (!clan.members) return;
      // 分家(divided)：各房独立私产·仅祠堂/族田共有(本 tick 不模拟)·不走共财池
      var mode = clan.mode || dynMode;
      if (mode === 'divided') return;
      // 共财(communal)：每月族人按 3% 缴纳给 clan 公共池（core family）
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

  // 名望事件表（设计方案-角色经济·资源三 涨/降来源）——通用·不限单朝
  //   政绩/救灾/水利/教育/赈济 已由 applier localAction 映射接入；此表补其余结构化/叙事来源。
  var FAME_EVENTS = {
    // 涨
    great_achievement: 10,   // 重大政绩
    military_victory: 8,     // 平叛/克捷
    suppress_revolt: 8,      // 平乱
    diplomacy_success: 6,    // 外交成就
    reform_success: 12,      // 主持重大改革成功
    literary_fame: 6,        // 著名文章/诗词流传
    living_shrine: 20,       // 百姓立生祠
    retire_virtuous: 8,      // 退隐著书立说
    recommend_talent: 5,     // 举荐名臣
    // 降
    corruption_exposed: -30, // 腐败被揭
    military_defeat: -25,    // 军事溃败
    military_rout: -40,      // 全军覆没
    miscarriage_justice: -15,// 重大冤案
    reform_failure: -20,     // 改革失败
    faction_purged: -10,     // 党争失败被贬
    scandal_personal: -22,   // 私德丑闻
    scandal_clan: -12,       // 家族丑闻
    defection: -90,          // 投敌/叛乱
    delay_military: -18      // 贻误军机
  };
  // 按事件键施加名望变更（mult 缩放幅度，如战役规模 0.5~1.5）
  function applyFameEvent(ch, key, mult) {
    if (!ch || FAME_EVENTS[key] == null) return 0;
    var delta = Math.round(FAME_EVENTS[key] * (mult == null ? 1 : mult));
    if (delta !== 0) adjustFame(ch, delta, key);
    return delta;
  }

  // 功名近账：记一笔功名升降/功绩事由（玩家可见谁因何升降·tick 被动积累不记·避免淹没）
  function recordMeritChange(ch, delta, reason, kind) {
    if (!ch || !ch.name) return;
    var d = Math.round(delta || 0);
    if (!d && !reason) return;
    var G = (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)).GM;
    var turn = (G && G.turn) || 0;
    var k = kind || (d > 0 ? 'gain' : d < 0 ? 'loss' : 'note');
    if (G) {
      if (!Array.isArray(G._meritLedger)) G._meritLedger = [];
      G._meritLedger.push({ turn: turn, name: ch.name, delta: d, reason: reason || '', kind: k, stage: ch.resources && ch.resources.virtueStage });
      if (G._meritLedger.length > 200) G._meritLedger.splice(0, G._meritLedger.length - 200);
    }
    if (!Array.isArray(ch._meritLog)) ch._meritLog = [];
    ch._meritLog.push({ turn: turn, delta: d, reason: reason || '', kind: k });
    if (ch._meritLog.length > 10) ch._meritLog.splice(0, ch._meritLog.length - 10);
  }

  // 近期功绩缓冲：政绩事件累加（驱动 tickVirtueMerit 持续小涨数回合·tick 衰减）·激活原死字段 _recentAchievements·不直接改 merit（由 tick 体现·防双计）
  function addAchievement(ch, amount, reason) {
    if (!ch || !(amount > 0)) return;
    ensureCharResources(ch);
    ch._recentAchievements = Math.min(40, (ch._recentAchievements || 0) + amount); // 缓冲上限防滚雪球
    recordMeritChange(ch, 0, reason || '近期功绩', 'achievement');
  }

  // 贤能变更（功名直接升降·记近账）
  function adjustVirtueMerit(ch, delta, reason) {
    ensureCharResources(ch);
    ch.resources.virtueMerit = Math.max(0, (ch.resources.virtueMerit || 0) + delta);
    updateVirtueStage(ch);
    recordMeritChange(ch, delta, reason);
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.CharEconEngine = {
    tick: tick,
    isEmperor: isEmperor,
    ensureCharResources: ensureCharResources,
    ensureCharComplete: ensureCharComplete,
    detectMissingFields: detectMissingFields,
    updatePublicTreasuryMirror: updatePublicTreasuryMirror,
    getCharPublicTreasuryDisplay: getCharPublicTreasuryDisplay,
    pursueTreasuryDeficit: pursueTreasuryDeficit,
    ensureCourtesyName: ensureCourtesyName,
    formatAddress: formatAddress,
    Income: Income,
    Expenses: Expenses,
    tickCharacter: tickCharacter,
    confiscate: confiscate,
    estimateHiddenWealth: estimateHiddenWealth,
    estimateConcealmentRatio: estimateConcealmentRatio,
    distributeInheritance: distributeInheritance,
    familyModeOf: familyModeOf,
    familyModeDefault: familyModeDefault,
    paySalary: paySalary,
    addBribeIncome: addBribeIncome,
    adjustFame: adjustFame,
    applyFameEvent: applyFameEvent,
    FAME_EVENTS: FAME_EVENTS,
    tickCharVariableLinkages: tickCharVariableLinkages,
    adjustVirtueMerit: adjustVirtueMerit,
    addAchievement: addAchievement,
    recordMeritChange: recordMeritChange,
    CLASS_PARAMS: CLASS_PARAMS,
    VIRTUE_STAGES: VIRTUE_STAGES,
    getVirtueStageName: getVirtueStageName,
    generateCourtesyName: generateCourtesyName,
    normalizePrivateWealth: normalizePrivateWealth,
    buildFamilyEconomySnapshot: buildFamilyEconomySnapshot,
    buildSocialTierSnapshot: buildSocialTierSnapshot,
    buildEconomySnapshot: buildEconomySnapshot,
    computeBehaviorWeights: computeBehaviorWeights,
    calcPrivateSummary: _calcPrivateSummary,
    inferSocialClass: inferSocialClass,
    reconcileSocialClassOnAppointment: reconcileSocialClassOnAppointment,
    setSocialClass: setSocialClass,
    getMonthRatio: getMonthRatio
  };

  console.log('[charEcon] 引擎已加载：6 资源 + 14×14 收支 + 8 阶层 + 家族共财 + 抄家 + 字系统');

})(typeof window !== 'undefined' ? window : this);
