// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-three-systems-ext.js
 * 三大系统升级·波1 数据模型补全
 * 势力/党争/军事的运行时字段扩展 + 省份归属反向索引 + 人物社交网络
 * 纯数据扩展·所有 extend 函数幂等(已存在字段不覆盖)·可反复调用
 */
(function(global){
  'use strict';

  // ====== 势力字段扩展 ======
  function extendFactionFields(f) {
    if (!f || typeof f !== 'object') return;
    // 国力维度
    if (f.population === undefined) f.population = 50;           // 相对值 0-100·省份人口汇总后覆盖
    if (f.morale === undefined) f.morale = 50;                    // 民心士气
    if (f.legitimacy === undefined) f.legitimacy = 60;            // 统治合法性
    if (f.stability === undefined) f.stability = 50;              // 内部稳定度
    // 文化宗教
    if (!f.culture) f.culture = f.ideology || '';
    if (!f.faith) f.faith = '';
    // 外交姿态
    if (!f.diplomacyStance) f.diplomacyStance = 'neutral';        // aggressive/defensive/isolationist/expansionist/neutral
    // 附庸宗主关系(补 v2 字段·liege 已有)
    if (!f.suzerainFaction) f.suzerainFaction = f.liege || null;  // 宗主势力名
    if (!f.vassalType) f.vassalType = null;                       // tribute/protectorate/puppet/ally
    // 兼容老数据·territory(单数字符串) → territories(数组)
    if (!Array.isArray(f.territories)) {
      if (typeof f.territory === 'string' && f.territory) f.territories = [f.territory];
      else f.territories = [];
    }
    // 省份 ID 绑定
    if (!Array.isArray(f.provinceIds)) f.provinceIds = f.territories.slice();
    // 外交公开态度
    if (!f.publicAgenda) f.publicAgenda = '';
    if (!f.hiddenAgenda) f.hiddenAgenda = '';
    // 历史动向(最近 5 回合简记)
    if (!Array.isArray(f.recentActions)) f.recentActions = [];
    // 生命周期阶段(rising/consolidating/stable/strained/declining)
    if (!f.lifePhase) f.lifePhase = 'stable';
    // 危急标志
    if (f._collapsing === undefined) f._collapsing = false;
  }

  // ====== 党派量化状态 ======
  // GM.partyState[partyName] = {influence, cohesion, reputationBalance, alliedWith[], conflictWith[], officeCount, recentImpeachWin, recentImpeachLose, recentPolicyWin, recentPolicyLose, lastShift}
  function initPartyState(force) {
    if (!global.GM) return;
    if (!Array.isArray(GM.parties)) GM.parties = [];
    if (!GM.partyState || typeof GM.partyState !== 'object') GM.partyState = {};
    GM.parties.forEach(function(p) {
      if (!p || !p.name) return;
      if (!GM.partyState[p.name] || force) {
        var existing = GM.partyState[p.name] || {};
        GM.partyState[p.name] = {
          name: p.name,
          influence: (typeof p.influence === 'number') ? p.influence : (existing.influence || 30),
          cohesion: (typeof p.cohesion === 'number') ? p.cohesion : (existing.cohesion || 50),
          reputationBalance: existing.reputationBalance !== undefined ? existing.reputationBalance : 0,  // -100..100 清名/恶名
          alliedWith: Array.isArray(p.allies) ? p.allies.slice() : (existing.alliedWith || []),
          conflictWith: Array.isArray(p.enemies) ? p.enemies.slice() : (existing.conflictWith || []),
          neutralWith: Array.isArray(p.neutrals) ? p.neutrals.slice() : (existing.neutralWith || []),
          officeCount: existing.officeCount || 0,
          recentImpeachWin: existing.recentImpeachWin || 0,
          recentImpeachLose: existing.recentImpeachLose || 0,
          recentPolicyWin: existing.recentPolicyWin || 0,
          recentPolicyLose: existing.recentPolicyLose || 0,
          lastShift: existing.lastShift || { turn: 0, influenceDelta: 0, reason: '初始' },
          historyLog: existing.historyLog || []
        };
      }
    });
  }

  // ====== 省份-势力反向索引 ======
  // 从 GM.provinceStats 和 GM.facs[i].territories 重建双向索引
  function buildProvinceOwnerIndex() {
    if (!global.GM) return;
    GM._provinceToFaction = {};
    // 1. 从 provinceStats.owner 拉
    if (GM.provinceStats && typeof GM.provinceStats === 'object') {
      Object.keys(GM.provinceStats).forEach(function(pname) {
        var ps = GM.provinceStats[pname];
        if (ps && ps.owner) GM._provinceToFaction[pname] = ps.owner;
      });
    }
    // 2. 从 GM.facs territories 补全
    if (Array.isArray(GM.facs)) {
      GM.facs.forEach(function(f) {
        var arr = Array.isArray(f.provinceIds) ? f.provinceIds : (Array.isArray(f.territories) ? f.territories : []);
        arr.forEach(function(pid) {
          if (pid && !GM._provinceToFaction[pid]) GM._provinceToFaction[pid] = f.name;
        });
      });
    }
  }
  function getFactionProvinces(factionName) {
    if (!global.GM) return [];
    if (!GM._provinceToFaction) buildProvinceOwnerIndex();
    var out = [];
    Object.keys(GM._provinceToFaction).forEach(function(p) {
      if (GM._provinceToFaction[p] === factionName) out.push(p);
    });
    return out;
  }
  function setProvinceOwner(provinceName, newOwnerName, reason) {
    if (!global.GM || !provinceName) return false;
    if (!GM._provinceToFaction) buildProvinceOwnerIndex();
    var oldOwner = GM._provinceToFaction[provinceName] || null;
    if (oldOwner === newOwnerName) return false;
    GM._provinceToFaction[provinceName] = newOwnerName;
    // 同步 provinceStats.owner
    if (GM.provinceStats && GM.provinceStats[provinceName]) {
      GM.provinceStats[provinceName].owner = newOwnerName;
    }
    // 同步 facs[i].territories/provinceIds
    if (Array.isArray(GM.facs)) {
      GM.facs.forEach(function(f) {
        if (f.name === oldOwner) {
          if (Array.isArray(f.territories)) f.territories = f.territories.filter(function(t){return t!==provinceName;});
          if (Array.isArray(f.provinceIds)) f.provinceIds = f.provinceIds.filter(function(t){return t!==provinceName;});
        }
        if (f.name === newOwnerName) {
          if (!Array.isArray(f.territories)) f.territories = [];
          if (!Array.isArray(f.provinceIds)) f.provinceIds = [];
          if (f.territories.indexOf(provinceName) < 0) f.territories.push(provinceName);
          if (f.provinceIds.indexOf(provinceName) < 0) f.provinceIds.push(provinceName);
        }
      });
    }
    // 事件总线
    try {
      if (global.GameEventBus && typeof global.GameEventBus.emit === 'function') {
        global.GameEventBus.emit('province:ownerChange', { province: provinceName, from: oldOwner, to: newOwnerName, reason: reason || '' });
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ext');}catch(_){}}
    return true;
  }

  // ====== 军队字段扩展 ======
  function extendArmyFields(a) {
    if (!a || typeof a !== 'object') return;
    // 所有权(已有 faction 则沿用·否则空)
    if (!a.owner) a.owner = a.faction || a.ownerFaction || '';
    // 私兵度·0=国家兵·100=完全私兵
    if (a.controlLevel === undefined) {
      // 以 commander 是否有 faction 关联推算·有 faction != owner 则偏私兵
      a.controlLevel = 20;
    }
    // 对主将忠诚·0..100·低则易兵变
    if (a.loyalty === undefined) {
      a.loyalty = (typeof a.morale === 'number') ? Math.min(100, Math.max(20, a.morale)) : 60;
    }
    // 士气/补给/训练度补齐(若缺)
    if (a.morale === undefined) a.morale = 50;
    if (a.supply === undefined) a.supply = 70;
    if (a.training === undefined) a.training = 50;
    // 状态标志
    if (!a.state) a.state = 'garrison';  // garrison/marching/sieging/routed/disbanded
    if (!a.destination) a.destination = '';
    if (a.marchDaysLeft === undefined) a.marchDaysLeft = 0;
    // 兵变风险
    if (a.mutinyRisk === undefined) a.mutinyRisk = 0;
    // 粮饷欠发月数
    if (a.payArrearsMonths === undefined) a.payArrearsMonths = 0;
  }

  // ====== 人物社交网络字段 ======
  function extendCharacterSocialFields(c) {
    if (!c || typeof c !== 'object') return;
    // 师承(mentor 已有·可为字符串)
    if (c.mentor === undefined) c.mentor = '';
    // 门生门徒(指向字符名数组)
    if (!Array.isArray(c.studentsIds)) c.studentsIds = [];
    // 同年同榜(科举同年)
    if (!Array.isArray(c.sameYearMates)) c.sameYearMates = [];
    // 同乡网络
    if (!Array.isArray(c.sameTownNetwork)) c.sameTownNetwork = [];
    // 党派忠诚度·0..100
    if (c.partyLoyal === undefined) {
      if (c.party) {
        var rank = c.partyRank || '';
        if (rank === '党魁' || rank === '领袖') c.partyLoyal = 95;
        else if (rank === '骨干') c.partyLoyal = 80;
        else if (rank === '附党') c.partyLoyal = 55;
        else c.partyLoyal = 65;
      } else {
        c.partyLoyal = 0;
      }
    }
    // 投机度·高则易变节
    if (c.opportunismScore === undefined) {
      // 野心高 + 忠诚低 → 投机度高
      var amb = c.ambition || 50;
      var loy = c.loyalty || 50;
      c.opportunismScore = Math.max(0, Math.min(100, Math.round(amb * 0.6 + (100 - loy) * 0.4)));
    }
    // 政见偏离度·-100..100·距离本党核心政见偏离
    if (c.partyDeviation === undefined) c.partyDeviation = 0;
    // 历史党派(变节记录)
    if (!Array.isArray(c.partyHistory)) c.partyHistory = c.party ? [{party: c.party, fromTurn: 0, reason: '初始归属'}] : [];
  }

  // ====== 外患势力军事力量补齐 ======
  // 为剧本中声明为敌对势力但无 armies 的 faction·兜底生成代表性主力军
  function backfillHostileFactionArmies() {
    if (!global.GM || !Array.isArray(GM.facs) || !Array.isArray(GM.armies)) return;
    var playerFac = (global.P && P.playerInfo && P.playerInfo.factionName) || '';
    GM.facs.forEach(function(f) {
      if (!f || !f.name || f.name === playerFac) return;
      // 只为 strength >= 20 的势力兜底
      var s = typeof f.strength === 'number' ? f.strength : 0;
      if (s < 20) return;
      var hasOwnArmy = GM.armies.some(function(a){ return (a.owner === f.name) || (a.faction === f.name); });
      if (hasOwnArmy) return;
      // 生成代表性部队
      var estSize = Math.round(s * 500);  // strength 60 → 3万
      GM.armies.push({
        name: f.name + '·主力',
        owner: f.name,
        faction: f.name,
        commander: f.leader || '',
        size: estSize, soldiers: estSize, strength: estSize,
        type: '综合',
        morale: Math.round(40 + s * 0.4),
        supply: 60, training: 50,
        location: f.capital || f.name,
        garrison: f.capital || f.name,
        equipment: [],
        controlLevel: 30, loyalty: 70,
        state: 'garrison', destination: '', marchDaysLeft: 0,
        mutinyRisk: 0, payArrearsMonths: 0,
        _autoBackfilled: true
      });
    });
  }

  // ====== 人物门生/同年网络自动推断 ======
  // 从 mentor 字段反向构建 studentsIds·从 birthYear+party 推测 sameYearMates
  function inferCharacterNetworks() {
    if (!global.GM || !Array.isArray(GM.chars)) return;
    // Step 1: mentor → studentsIds 反向
    var mentorOfStudents = {};  // mentor name → [studentNames]
    GM.chars.forEach(function(c) {
      if (!c.mentor) return;
      var m = String(c.mentor).trim();
      if (!m) return;
      // mentor 字段常含注释·如 '韩逢禧(殁·馆师)' → 剥出主名
      m = m.replace(/[\(（][^)）]*[\)）]/g, '').replace(/\s+/g,'').trim();
      if (!m) return;
      // 可能多个 mentor 用 · / 、 分隔
      m.split(/[·\/、，,；;]/).forEach(function(mn) {
        mn = mn.trim();
        if (!mn) return;
        if (!mentorOfStudents[mn]) mentorOfStudents[mn] = [];
        if (mentorOfStudents[mn].indexOf(c.name) < 0) mentorOfStudents[mn].push(c.name);
      });
    });
    GM.chars.forEach(function(c) {
      var list = mentorOfStudents[c.name] || [];
      if (!Array.isArray(c.studentsIds)) c.studentsIds = [];
      list.forEach(function(s) {
        if (c.studentsIds.indexOf(s) < 0) c.studentsIds.push(s);
      });
    });
    // Step 2: 同年(差 3 岁内·同党·同为官)
    // 成本高·只按需·这里跳过强关联·留给 AI 推断
  }

  // ══════════════════════════════════════════════════════════════════════
  //  波2 · 回合结算循环
  //  三个函数在 endturn 的 Phase 1.7(AI推演前)调用·让 AI 看到更新后状态
  // ══════════════════════════════════════════════════════════════════════

  // —— 势力状态更新 ——
  function _updateFactionState() {
    if (!global.GM || !Array.isArray(GM.facs)) return;
    var turn = GM.turn || 1;
    // 先重建省份反向索引
    buildProvinceOwnerIndex();
    GM.facs.forEach(function(f) {
      extendFactionFields(f);
      // 1. 统计人口·兵力·财赋——从省份汇总
      var provs = getFactionProvinces(f.name);
      var popSum = 0, wealthSum = 0, stabSum = 0, unrestSum = 0, provCount = 0;
      provs.forEach(function(pname) {
        var ps = GM.provinceStats && GM.provinceStats[pname];
        if (!ps) return;
        popSum += (ps.population || 0);
        wealthSum += (ps.wealth || 0);
        stabSum += (ps.stability || 0);
        unrestSum += (ps.unrest || 0);
        provCount++;
      });
      if (provCount > 0) {
        f.population = Math.round(Math.min(100, popSum / provCount / 1000));
        f.stability = Math.round(stabSum / provCount);
        f.morale = Math.round(Math.max(0, Math.min(100, 50 + (stabSum - unrestSum) / provCount * 0.5)));
      }
      // 2. 合法性衰减：若势力长时间无行动·缓慢衰减
      if (!Array.isArray(f.recentActions)) f.recentActions = [];
      if (f.recentActions.length === 0 || (turn - (f._lastActionTurn || turn)) > 4) {
        f.legitimacy = Math.max(20, (f.legitimacy || 60) - 1);
      }
      // 3. 生命周期判定
      var s = typeof f.strength === 'number' ? f.strength : 0;
      var leg = f.legitimacy || 60;
      var prevPhase = f.lifePhase || 'stable';
      var newPhase = prevPhase;
      if (s >= 70 && leg >= 65) newPhase = 'consolidating';
      else if (s >= 55 && leg >= 55) newPhase = 'stable';
      else if (s >= 40 || leg >= 50) newPhase = 'strained';
      else if (s >= 20) newPhase = 'declining';
      else newPhase = 'collapsing';
      if (newPhase !== prevPhase) {
        f.lifePhase = newPhase;
        if (!GM._chronicle) GM._chronicle = [];
        GM._chronicle.push({
          turn: turn, date: GM._gameDate || '',
          type: '势力阶段',
          text: f.name + '·' + prevPhase + '→' + newPhase + '·strength=' + s + '·leg=' + leg,
          tags: ['势力', '生命周期']
        });
      }
      // 4. 崩溃标志
      if (s < 10 && provs.length === 0) {
        f._collapsing = true;
      } else if (f._collapsing && s >= 20) {
        f._collapsing = false;
      }
      // 5. 兜底：territories/provinceIds 同步
      if (Array.isArray(provs) && provs.length > 0) {
        f.territories = provs.slice();
        f.provinceIds = provs.slice();
      }
    });
  }

  // —— 党派状态更新 ——
  function _updatePartyState() {
    if (!global.GM || !Array.isArray(GM.parties) || GM.parties.length === 0) return;
    if (!GM.partyState) initPartyState();
    var turn = GM.turn || 1;

    // 1. 统计各党在官位树中的人数 (iterate officeTree recursively)
    var partyOfficeCounts = {};
    (function walk(nodes) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(function(n) {
        (n.positions || []).forEach(function(p) {
          var holders = [];
          if (p.holder) holders.push(p.holder);
          if (Array.isArray(p.actualHolders)) {
            p.actualHolders.forEach(function(ah){ if (ah && ah.name && holders.indexOf(ah.name) < 0) holders.push(ah.name); });
          }
          holders.forEach(function(charName) {
            var ch = GM.chars && GM.chars.find(function(c){ return c.name === charName; });
            if (!ch || !ch.party) return;
            partyOfficeCounts[ch.party] = (partyOfficeCounts[ch.party] || 0) + 1;
          });
        });
        if (n.subs) walk(n.subs);
      });
    })(GM.officeTree || []);

    // 2. 更新每个党派的 partyState
    GM.parties.forEach(function(p) {
      if (!p || !p.name) return;
      extendCharacterSocialFields_PartyMembers(p);
      var ps = GM.partyState[p.name];
      if (!ps) { initPartyState(true); ps = GM.partyState[p.name]; }
      if (!ps) return;
      var prevCount = ps.officeCount || 0;
      var newCount = partyOfficeCounts[p.name] || 0;
      var delta = newCount - prevCount;
      // 官位变化 → influence 推导
      if (delta !== 0) {
        ps.influence = Math.max(0, Math.min(100, ps.influence + delta * 3));
        ps.historyLog = ps.historyLog || [];
        ps.historyLog.push({ turn: turn, type: 'officeShift', delta: delta, influenceDelta: delta * 3 });
        if (ps.historyLog.length > 20) ps.historyLog = ps.historyLog.slice(-20);
      }
      ps.officeCount = newCount;
      // 反响衰减
      ps.recentImpeachWin = Math.max(0, (ps.recentImpeachWin || 0) * 0.7);
      ps.recentImpeachLose = Math.max(0, (ps.recentImpeachLose || 0) * 0.7);
      ps.recentPolicyWin = Math.max(0, (ps.recentPolicyWin || 0) * 0.7);
      ps.recentPolicyLose = Math.max(0, (ps.recentPolicyLose || 0) * 0.7);
      // 回传 p.influence 以供旧 UI 读取
      p.influence = ps.influence;
      // cohesion：反弹·如果内部冲突多则下降
      if ((ps.recentPolicyLose || 0) > 2 && (ps.recentImpeachLose || 0) > 1) {
        ps.cohesion = Math.max(0, ps.cohesion - 3);
      }
      p.cohesion = ps.cohesion;
    });
  }

  // 辅助：动态补齐党派成员列表(从成员文字描述或 chars.party 字段建立)
  function extendCharacterSocialFields_PartyMembers(party) {
    if (!party) return;
    // 从 chars.party 反向推导成员·用于 UI/AI
    if (!Array.isArray(party._memberChars)) party._memberChars = [];
    if (!global.GM || !Array.isArray(GM.chars)) return;
    var members = GM.chars.filter(function(c){ return c.party === party.name; }).map(function(c){ return c.name; });
    party._memberChars = members;
    party.memberCount = members.length;
  }

  // —— 军事状态更新 ——
  function _updateMilitaryState() {
    if (!global.GM || !Array.isArray(GM.armies)) return;
    var daysPerTurn = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    GM.armies.forEach(function(a) {
      extendArmyFields(a);
      // 1. 行军/围城消耗
      if (a.state === 'marching' && a.marchDaysLeft > 0) {
        a.marchDaysLeft = Math.max(0, a.marchDaysLeft - daysPerTurn);
        a.supply = Math.max(0, a.supply - Math.round(daysPerTurn * 0.4));
        if (a.marchDaysLeft === 0 && a.destination) {
          a.garrison = a.destination;
          a.location = a.destination;
          a.destination = '';
          a.state = 'garrison';
        }
      } else if (a.state === 'sieging') {
        a.supply = Math.max(0, a.supply - Math.round(daysPerTurn * 0.5));
      } else {
        // 驻防小幅消耗·重新获取
        a.supply = Math.min(100, a.supply + 2);
      }
      // 2. 粮饷欠发累计(仅国家兵)
      if (a.controlLevel < 60) {
        // 简化处理：若势力财政低·累加欠饷
        var owner = a.owner;
        if (owner && global.GM.facs) {
          var f = GM.facs.find(function(ff){ return ff.name === owner; });
          if (f && typeof f.money === 'number' && f.money < 0) {
            a.payArrearsMonths = Math.min(24, (a.payArrearsMonths || 0) + 1);
          } else if (a.payArrearsMonths > 0) {
            a.payArrearsMonths = Math.max(0, a.payArrearsMonths - 1);
          }
        }
      }
      if (global.MilitarySystems && typeof global.MilitarySystems.applyPayArrearsPressure === 'function') {
        global.MilitarySystems.applyPayArrearsPressure(a, { source: 'three-systems-update' }, global.GM);
      } else if (global.TM && global.TM.MilitarySystems && typeof global.TM.MilitarySystems.applyPayArrearsPressure === 'function') {
        global.TM.MilitarySystems.applyPayArrearsPressure(a, { source: 'three-systems-update' }, global.GM);
      }
      // 3. 士气崩溃判定
      if (a.supply < 20) {
        a.morale = Math.max(0, a.morale - 5);
      }
      if (a.morale < 30 && a.payArrearsMonths >= 3) {
        a.mutinyRisk = Math.min(100, a.mutinyRisk + 10);
      } else if (a.payArrearsMonths >= 3) {
        a.mutinyRisk = Math.min(100, a.mutinyRisk + 5);
      } else if (a.morale < 20) {
        a.mutinyRisk = Math.min(100, a.mutinyRisk + 3);
      } else {
        a.mutinyRisk = Math.max(0, a.mutinyRisk - 2);
      }
      // 4. 兵变事件触发标记
      if (a.mutinyRisk >= 80 && !a._mutinyTriggered) {
        a._mutinyTriggered = true;
        if (!GM._chronicle) GM._chronicle = [];
        GM._chronicle.push({
          turn: GM.turn || 0, date: GM._gameDate || '',
          type: '兵变警讯',
          text: a.name + ' 军心大乱·兵变风险极高·士气' + a.morale + '·欠饷' + a.payArrearsMonths + '月',
          tags: ['军事', '兵变', '警讯']
        });
        try {
          if (global.GameEventBus && typeof global.GameEventBus.emit === 'function') {
            global.GameEventBus.emit('army:mutinyRisk', { army: a.name, risk: a.mutinyRisk, owner: a.owner });
          }
        } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ext');}catch(_){}}
      } else if (a.mutinyRisk < 50 && a._mutinyTriggered) {
        a._mutinyTriggered = false;
      }
    });
  }

  // —— 统一 endturn 接口 ——
  function updateThreeSystemsOnEndTurn() {
    if (!global.GM) return;
    try { _updateFactionState(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统回合] faction') : console.warn('[三系统回合] faction', e); }
    try { _updatePartyState(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统回合] party') : console.warn('[三系统回合] party', e); }
    try { _updateMilitaryState(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统回合] military') : console.warn('[三系统回合] military', e); }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  波3 · NPC AI 决策器（单次批量调用·每 3 回合一次）
  //  输出 GM._npcDecisions = {factionActions, partyActions, generalActions}
  //  下一回合推演 sysP 读取并展示
  // ══════════════════════════════════════════════════════════════════════
  async function _scThreeSystemsAI() {
    if (!global.GM || !global.P) return;
    if (!global.P.ai || !global.P.ai.key) return;
    // 频率控制：每 3 回合一次·或首回合立即一次以有开局反应
    var turn = GM.turn || 1;
    if (turn > 1 && (turn % 3) !== 0) return;
    // 避免重复调用
    if (GM._npcDecisions && GM._npcDecisions.generatedTurn === turn) return;

    try {
      var playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
      // 推断势力类型·农耕/游牧/海商/割据/部落/宗教/海盗
      function _inferFacType(f) {
        if (!f) return '农耕';
        var hint = (f.type || f.category || f.culture || f.ideology || '') + (f.name || '') + (f.leader || '');
        if (/游牧|鞑靼|蒙古|女真|建州|后金|瓦剌|蒙兀|察哈尔|喀尔喀|科尔沁|卫拉特|漠南|漠北|鞑/.test(hint)) return '游牧';
        if (/海商|海寇|倭|倭寇|荷兰|葡萄牙|西班牙|郑|红夷/.test(hint)) return '海商';
        if (/起义|流寇|流民|饥民|白莲|闻香|义军|叛|反贼/.test(hint)) return '流寇';
        if (/藩|割据|土司|奢安/.test(hint)) return '割据';
        if (/吐蕃|西藏|喇嘛|番|僧/.test(hint)) return '宗教';
        return '农耕';
      }
      // 推断当前季节(便于建议劫掠/祭祀等季节性动作)
      function _inferSeason() {
        try {
          var mon = 0;
          if (typeof GM._gameMonth === 'number') mon = GM._gameMonth;
          else if (GM._gameDate) {
            var m = String(GM._gameDate).match(/(\d+)月/);
            if (m) mon = parseInt(m[1], 10) || 0;
          }
          if (mon >= 3 && mon <= 5) return '春';
          if (mon >= 6 && mon <= 8) return '夏';
          if (mon >= 9 && mon <= 11) return '秋';
          return '冬';
        } catch(e) { return '春'; }
      }
      var season = _inferSeason();
      // 构建精简上下文
      var hostileFacs = (GM.facs||[]).filter(function(f){
        if (!f || f.name === playerFac) return false;
        var s = f.strength || 0;
        return s >= 15;  // 太弱的不纳入
      }).slice(0, 6).map(function(f) {
        return {
          name: f.name,
          leader: f.leader || '',
          type: _inferFacType(f),
          strength: f.strength || 0,
          legitimacy: f.legitimacy || 0,
          lifePhase: f.lifePhase || 'stable',
          stance: f.diplomacyStance || 'neutral',
          hiddenAgenda: f.hiddenAgenda || '',
          morale: f.morale || 50,
          stability: f.stability || 50,
          provinces: (f.provinceIds||[]).slice(0, 4).join('、'),
          suzerain: f.suzerainFaction || '',
          vassals: (f.vassals||[]).slice(0, 3).join('、')
        };
      });

      var parties = (GM.parties||[]).filter(function(p){ return (p.influence||0) > 15; }).slice(0, 6).map(function(p){
        var ps = GM.partyState ? GM.partyState[p.name] : null;
        return {
          name: p.name,
          leader: p.leader || '',
          influence: ps ? ps.influence : (p.influence||0),
          officeCount: ps ? ps.officeCount : 0,
          reputationBalance: ps ? ps.reputationBalance : 0,
          cohesion: ps ? ps.cohesion : (p.cohesion||50),
          conflictWith: ps ? (ps.conflictWith||[]).slice(0, 3) : (p.enemies||[]).slice(0, 3),
          currentAgenda: p.currentAgenda || ''
        };
      });

      var riskArmies = (GM.armies||[]).filter(function(a){
        return (a.mutinyRisk||0) >= 40 || (a.supply||100) < 40 || (a.payArrearsMonths||0) >= 2 || (a.state === 'marching') || (a.state === 'sieging');
      }).slice(0, 6).map(function(a){
        return {
          name: a.name,
          commander: a.commander || '',
          owner: a.owner || a.faction || '',
          size: a.soldiers || a.size || 0,
          state: a.state || 'garrison',
          location: a.garrison || a.location || '',
          supply: a.supply || 0,
          morale: a.morale || 0,
          mutinyRisk: a.mutinyRisk || 0,
          payArrears: a.payArrearsMonths || 0
        };
      });

      // 近 2 回合编年关键事件
      var recentEvents = [];
      if (Array.isArray(GM._chronicle)) {
        recentEvents = GM._chronicle.filter(function(c){
          return c && (c.turn === turn || c.turn === turn-1);
        }).slice(-15).map(function(c){ return (c.type||'')+ ':' + (c.text||'').slice(0,60); });
      }

      // 玩家近 3 回合诏令(供 NPC 势力响应)
      var recentPlayerEdicts = [];
      if (Array.isArray(GM._edictTracker)) {
        recentPlayerEdicts = GM._edictTracker.filter(function(e) {
          return e && (turn - (e.turn||0)) <= 3;
        }).slice(-10).map(function(e) {
          return {
            id: e.id || '',
            turn: e.turn || 0,
            category: e.category || '',
            content: (e.content || '').slice(0, 100),
            status: e.status || '',
            region: e._affectedRegion || ''
          };
        });
      }
      // 御批回听结果(若有·含朝野反响)
      var efficacyBrief = '';
      if (GM._edictEfficacyReport && !GM._edictEfficacyReport.skipped) {
        var ef = GM._edictEfficacyReport;
        efficacyBrief = '上回合玩家代理强度:' + (ef.overallEfficacy||0) + '%';
        if (ef.oppositionSummary && ef.oppositionSummary.length) efficacyBrief += '·主要阻力:' + ef.oppositionSummary.slice(0, 3).join('·');
        if (ef.popularReaction) efficacyBrief += '·民间:' + ef.popularReaction.slice(0, 30);
      }

      var ctx = {
        turn: turn,
        date: GM._gameDate || '',
        season: season,
        playerFaction: playerFac,
        hostileFactions: hostileFacs,
        parties: parties,
        riskArmies: riskArmies,
        recentEvents: recentEvents,
        recentPlayerEdicts: recentPlayerEdicts,  // 新增·供 NPC 势力响应
        playerEfficacyBrief: efficacyBrief
      };

      var prompt = '你是推演 AI。基于以下三系统快照·为 NPC 势力/党派/将领分别规划未来 3 回合的自主行动。务必让势力 actions 丰富多元·不仅限军事·含日常治理/经济/外交/仪轨/季节性活动。\n\n' +
        '【三系统快照·JSON】\n' + JSON.stringify(ctx, null, 2) +
        '\n\n【任务】输出 JSON 结构：\n' +
        '{\n' +
        '  "factionActions": [\n' +
        '    {\n' +
        '      "faction":"势力名",\n' +
        '      "category":"military/daily/diplomatic/internal/religious/economic (6 类必分)",\n' +
        '      "action":"具体动作·见下方动作库",\n' +
        '      "target":"目标(势力/地点/角色/可选)",\n' +
        '      "rationale":"理由(对应 hiddenAgenda·性别/季节/lifePhase)",\n' +
        '      "likelyTurn":"可能发生回合(数字)",\n' +
        '      "scale":"小/中/大 (规模)",\n' +
        '      "precondition":"需要什么条件触发",\n' +
        '      "reactsToPlayerEdict":"(可选)若该 action 是对玩家某诏令的反应·填该诏令 id 或简述",\n' +
        '      "reactionType":"(可选)opportunity(机会窗口)/retaliate(报复)/align(顺从)/exploit(趁虚)/probe(试探)"\n' +
        '    }\n' +
        '  ],\n' +
        '  "partyActions": [{"party":"党派名","action":"弹劾/结社/上疏/结盟/罢黜/密谋/招揽/清议","target":"对象","rationale":"内幕动机","likelyTurn":"回合数"}],\n' +
        '  "generalActions": [{"general":"将领名","action":"请饷/告急/主战/主守/谢罪/请辞/密报/练兵/哗变/降敌","target":"上奏对象","rationale":"边情","likelyTurn":"回合数"}]\n' +
        '}\n\n' +
        '【势力 action 动作库·按势力 type 选择】\n' +
        '· 军事 military: 劫掠·征讨·围城·偷袭·调兵·筑寨·演武·设伏·叛变·投降·夜袭·攻坚·退兵·突围·布防\n' +
        '· 日常 daily: 屯田·筑城·修渠·开互市·抚流民·建粮仓·营造·纳粮·清田·核户·置驿\n' +
        '· 外交 diplomatic: 朝贡·结盟·和谈·遣使·联姻·递书·绝交·立盟·调解·宣战·纳款·请封\n' +
        '· 内务 internal: 内乱·分裂·清洗·改制·立嗣·继位·迁都·改元·祭告·大丧·赐姓·恩赦\n' +
        '· 礼法 religious: 祭天·告庙·封禅·大婚·封册·巡幸·赦囚·求雨·祷祈·降诏\n' +
        '· 经济 economic: 加税·减赋·扩市·开关·封禁·发行·赐赉·赈济·铸币·盐铁\n' +
        '\n' +
        '【按势力类型差异化建议】\n' +
        '· 游牧势力(后金/蒙古/女真)：秋冬必有劫掠(春夏防御·秋高马肥之际劫掠边郡)·夏季会盟/祭祀·冬季打草谷\n' +
        '· 农耕势力：春耕秋收之时不宜大征战·春祭秋报·冬令征伐·夏季多内修\n' +
        '· 海商/海寇(郑氏/荷兰/倭寇)：夏秋风季劫掠沿海·冬春隐伏·常与明朝互市\n' +
        '· 流寇/起义(陕北饥民/白莲)：抢粮为生·春冬缺粮时活跃·秋季暂伏·夏季流动\n' +
        '· 割据藩镇(奢安之乱/土司)：割据自保·常名义臣服实则自治·请封·请兵权\n' +
        '· 宗教势力(吐蕃/喇嘛)：祭祀·朝贡·求赐·少主动军事\n' +
        '\n' +
        '【季节当前 = ' + season + '】\n' +
        '· 春：耕作/开市/春祭/议和·游牧准备劫掠但未动\n' +
        '· 夏：农忙/筑城/结盟/内修·农耕少征战·游牧休养\n' +
        '· 秋：游牧劫掠高峰·秋收·大型军事行动常启动·海寇开始活跃\n' +
        '· 冬：守御/屯粮/祭天·缺粮势力劫掠·大征伐常在此时\n' +
        '\n' +
        '【要求】\n' +
        '1. factionActions 至少 5-10 条·按势力类型差异化+当前季节·不要千篇一律宣战\n' +
        '2. 每个 category 至少出现 1-2 次·不得全部军事\n' +
        '3. 游牧势力+秋冬必有劫掠 action·内容具体(劫某县某路·掳掠多少人畜)\n' +
        '4. 农耕势力冬季可有征伐·但春夏以内务/礼法为主\n' +
        '5. rationale 必须对应 hiddenAgenda/季节/lifePhase·不能模糊\n' +
        '6. precondition 具体化(如"等秋高马肥""借大丧之机")\n' +
        '7. ★【响应玩家】至少 30%-40% 的 factionActions 必须填 reactsToPlayerEdict + reactionType·指出该 action 是针对玩家某条诏令的响应·例:\n' +
        '   · 玩家赈陕→后金趁明廷财困南下(opportunity·exploit)\n' +
        '   · 玩家加派剿饷→流寇蜂起(retaliate)·蒙古瞅边防空虚劫掠(exploit)\n' +
        '   · 玩家重用东林→阉党密谋反扑(retaliate)·浙党观望(probe)\n' +
        '   · 玩家封册附庸→他势力来朝贡试探(probe·align)\n' +
        '   · 玩家议和→敌方得寸进尺要求更大让步(exploit)·或感激停劫(align)\n' +
        '   · 玩家怠政·recentPlayerEdicts 少→各势力普遍 exploit\n' +
        '8. partyActions/generalActions 3-6 条·按 prev 规范·党派/将领也应响应玩家近期行为\n' +
        '9. 不臆造未在快照中的 NPC·不用游戏时间之后的史实\n' +
        '10. 若 hostileFactions 为空则 factionActions=[]\n' +
        '11. playerEfficacyBrief 若显示玩家代理弱+阻力大·NPC 势力/党派应更激进(exploit/retaliate)·反之则更收敛(align/probe)\n' +
        '12. 只输出 JSON·无其他文字';

      var result;
      try {
        if (typeof callAISmart === 'function') {
          result = await callAISmart(prompt, 3000, { maxRetries: 2 });
        } else if (typeof callAI === 'function') {
          result = await callAI(prompt, 3000);
        }
      } catch(e) {
        console.warn('[NPC 决策器] AI 调用失败', e);
        return;
      }

      if (!result) return;
      var text = typeof result === 'string' ? result : (result.text || result.content || JSON.stringify(result));
      var parsed;
      try {
        // 提取 JSON
        var m = text.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : JSON.parse(text);
      } catch(e) {
        console.warn('[NPC 决策器] JSON 解析失败', e, text.slice(0, 200));
        return;
      }

      GM._npcDecisions = {
        generatedTurn: turn,
        factionActions: Array.isArray(parsed.factionActions) ? parsed.factionActions.slice(0, 10) : [],
        partyActions: Array.isArray(parsed.partyActions) ? parsed.partyActions.slice(0, 10) : [],
        generalActions: Array.isArray(parsed.generalActions) ? parsed.generalActions.slice(0, 10) : []
      };

      // 写入编年史(仅 type 摘要·不会喧宾夺主)
      if (!GM._chronicle) GM._chronicle = [];
      var total = GM._npcDecisions.factionActions.length + GM._npcDecisions.partyActions.length + GM._npcDecisions.generalActions.length;
      if (total > 0) {
        GM._chronicle.push({
          turn: turn, date: GM._gameDate || '',
          type: 'NPC 预规划',
          text: 'NPC 预规划·势力 ' + GM._npcDecisions.factionActions.length + ' 条·党派 ' + GM._npcDecisions.partyActions.length + ' 条·将领 ' + GM._npcDecisions.generalActions.length + ' 条(生效于未来推演)',
          tags: ['NPC', '决策', 'AI']
        });
      }
      console.log('[NPC 决策器] 已生成 '+total+' 条·回合'+turn);
    } catch(e) {
      console.warn('[NPC 决策器] 异常', e);
    }
  }

  // 构建 NPC 决策注入文本(供 sysP 使用)
  function buildNpcDecisionsForSysP() {
    if (!global.GM || !GM._npcDecisions) return '';
    var d = GM._npcDecisions;
    var out = '';
    if ((d.factionActions||[]).length > 0) {
      out += '\n\n【NPC 势力预规划·AI 推演时优先从此展开·而非凭空】';
      // 按 category 分组·便于 AI 读取
      var catMap = { military:'军事', daily:'日常', diplomatic:'外交', internal:'内务', religious:'礼法', economic:'经济' };
      var byCat = { military:[], daily:[], diplomatic:[], internal:[], religious:[], economic:[], other:[] };
      d.factionActions.forEach(function(fa) {
        var c = fa.category || 'other';
        if (byCat[c]) byCat[c].push(fa); else byCat.other.push(fa);
      });
      Object.keys(byCat).forEach(function(k) {
        if (byCat[k].length === 0) return;
        out += '\n ['+(catMap[k]||'其他')+']';
        byCat[k].forEach(function(fa) {
          var sc = fa.scale ? ('·'+fa.scale) : '';
          var reactMark = '';
          if (fa.reactsToPlayerEdict) {
            var rtMap = { opportunity:'机会', retaliate:'报复', align:'顺从', exploit:'趁虚', probe:'试探' };
            reactMark = '·[响应玩家'+(rtMap[fa.reactionType]||'')+']';
          }
          out += '\n  · ' + fa.faction + '·' + fa.action + (fa.target?('·'+fa.target):'') + sc + reactMark + '·' + (fa.rationale||'').slice(0,70) + (fa.likelyTurn?('·T'+fa.likelyTurn):'') + (fa.precondition?('·前提:'+fa.precondition.slice(0,30)):'');
        });
      });
    }
    if ((d.partyActions||[]).length > 0) {
      out += '\n\n【党派预规划】';
      d.partyActions.forEach(function(pa) {
        out += '\n  · ' + pa.party + '·' + pa.action + (pa.target?('·'+pa.target):'') + '·' + (pa.rationale||'').slice(0,80);
      });
    }
    if ((d.generalActions||[]).length > 0) {
      out += '\n\n【将领预规划】';
      d.generalActions.forEach(function(ga) {
        out += '\n  · ' + ga.general + '·' + ga.action + (ga.target?('·上'+ga.target):'') + '·' + (ga.rationale||'').slice(0,80);
      });
    }
    return out;
  }

  // ====== 统一入口 ======
  function initThreeSystemsOnStart() {
    if (!global.GM) return;
    try {
      // 1. 势力
      if (Array.isArray(GM.facs)) GM.facs.forEach(extendFactionFields);
      // 2. 省份-势力反向索引
      buildProvinceOwnerIndex();
      // 3. 党派量化状态
      initPartyState();
      // 4. 军队
      if (Array.isArray(GM.armies)) GM.armies.forEach(extendArmyFields);
      // 5. 敌对势力军队兜底
      backfillHostileFactionArmies();
      // 6. 人物社交网络
      if (Array.isArray(GM.chars)) GM.chars.forEach(extendCharacterSocialFields);
      if (global.RelGraph && typeof global.RelGraph.syncCharRefs === 'function' && Array.isArray(GM.chars)) {
        GM.chars.forEach(function(ch) {
          try { global.RelGraph.syncCharRefs(ch, global.GM); } catch(_) {}
        });
      }
      inferCharacterNetworks();
      console.log('[三系统扩展] 完成·势力+', (GM.facs||[]).length, '·党派+', Object.keys(GM.partyState||{}).length, '·军队+', (GM.armies||[]).length, '·角色+', (GM.chars||[]).length);
    } catch(e) {
      console.warn('[三系统扩展] 初始化异常', e);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  波5 · 跨系统联动(事件总线)
  //  军事→势力 · 势力→党争 · 党争→军事
  // ══════════════════════════════════════════════════════════════════════
  var _crossLinksWired = false;
  function _wireCrossSystemLinks() {
    if (_crossLinksWired) return;  // 防重复·一次游戏进程只连一次
    if (!global.GameEventBus || typeof global.GameEventBus.on !== 'function') return;
    _crossLinksWired = true;

    // ─── 军事→势力 ───
    // 战败：faction strength-5·legitimacy-3·士气 morale-8
    global.GameEventBus.on('army:defeat', function(data) {
      if (!global.GM || !data || !data.owner) return;
      var f = (GM.facs||[]).find(function(x){return x.name === data.owner;});
      if (f) {
        f.strength = Math.max(0, (f.strength||0) - 5);
        f.legitimacy = Math.max(0, (f.legitimacy||0) - 3);
        f.morale = Math.max(0, (f.morale||0) - 8);
        if (!GM._chronicle) GM._chronicle = [];
        GM._chronicle.push({
          turn: GM.turn||0, date: GM._gameDate||'',
          type: '军事↔势力',
          text: data.owner + ' 战败·strength-5·legitimacy-3·morale-8',
          tags: ['联动','军事','势力']
        });
      }
    });

    // 战胜并占领：setProvinceOwner
    global.GameEventBus.on('army:victoryOccupy', function(data) {
      if (!data || !data.victor || !data.province) return;
      if (typeof setProvinceOwner === 'function') {
        setProvinceOwner(data.province, data.victor, '战胜占领');
      }
      var f = (global.GM && GM.facs || []).find(function(x){return x.name === data.victor;});
      if (f) {
        f.strength = Math.min(100, (f.strength||0) + 5);
        f.legitimacy = Math.min(100, (f.legitimacy||0) + 2);
      }
    });

    // 兵变：owner strength/legitimacy 大挫·对应将领 loyalty 崩溃
    global.GameEventBus.on('army:mutiny', function(data) {
      if (!global.GM || !data || !data.army) return;
      var a = (GM.armies||[]).find(function(x){return x.name === data.army;});
      if (a) {
        a.loyalty = 0;
        a.morale = Math.max(10, a.morale - 20);
        a.state = 'routed';
      }
      if (a && a.owner) {
        var f = (GM.facs||[]).find(function(x){return x.name === a.owner;});
        if (f) {
          f.strength = Math.max(0, (f.strength||0) - 10);
          f.legitimacy = Math.max(0, (f.legitimacy||0) - 5);
          f.stability = Math.max(0, (f.stability||0) - 10);
        }
      }
    });

    // ─── 势力→党争 ───
    // 势力崩溃：附党失根(cohesion -30·influence -20)
    global.GameEventBus.on('faction:collapse', function(data) {
      if (!global.GM || !data || !data.faction) return;
      if (!GM.partyState) return;
      Object.keys(GM.partyState).forEach(function(pn) {
        var ps = GM.partyState[pn];
        var party = (GM.parties||[]).find(function(p){return p.name === pn;});
        if (!party) return;
        if (party.faction === data.faction) {
          ps.cohesion = Math.max(0, ps.cohesion - 30);
          ps.influence = Math.max(0, ps.influence - 20);
          if (!GM._chronicle) GM._chronicle = [];
          GM._chronicle.push({
            turn: GM.turn||0, date: GM._gameDate||'',
            type: '势力↔党派',
            text: data.faction + ' 崩溃·'+pn+' 失根 cohesion-30·influence-20',
            tags: ['联动','势力','党派']
          });
        }
      });
    });

    // 势力陷入战争：其内各党凝聚力 +5(共同对外)
    global.GameEventBus.on('faction:declareWar', function(data) {
      if (!global.GM || !GM.partyState) return;
      Object.keys(GM.partyState).forEach(function(pn) {
        var ps = GM.partyState[pn];
        ps.cohesion = Math.min(100, ps.cohesion + 5);
      });
    });

    // ─── 党争→军事 ───
    // 首辅换党·同党武将升迁(标记用于下回合 AI 推演)
    global.GameEventBus.on('party:ministershipChange', function(data) {
      if (!global.GM || !data || !data.newParty) return;
      (GM.armies||[]).forEach(function(a) {
        if (!a.commander) return;
        var ch = (GM.chars||[]).find(function(c){return c.name === a.commander;});
        if (ch && ch.party === data.newParty) {
          a._favoredByMinister = true;
          a._favoredTurn = GM.turn||0;
          a.loyalty = Math.min(100, (a.loyalty||60) + 5);
        }
      });
    });

    // 清党：同党武将 loyalty 骤降(恐惧清算)
    global.GameEventBus.on('party:purge', function(data) {
      if (!global.GM || !data || !data.party) return;
      (GM.armies||[]).forEach(function(a) {
        if (!a.commander) return;
        var ch = (GM.chars||[]).find(function(c){return c.name === a.commander;});
        if (ch && ch.party === data.party) {
          a.loyalty = Math.max(0, (a.loyalty||60) - 25);
          a.mutinyRisk = Math.min(100, (a.mutinyRisk||0) + 20);
        }
      });
    });

    // 弹劾成功：对应人物 opportunismScore 微调(投机者看风使舵)
    global.GameEventBus.on('party:impeachSucceed', function(data) {
      if (!global.GM || !data || !data.target) return;
      var ch = (GM.chars||[]).find(function(c){return c.name === data.target;});
      if (ch && ch.party && GM.partyState && GM.partyState[ch.party]) {
        GM.partyState[ch.party].recentImpeachLose = (GM.partyState[ch.party].recentImpeachLose||0) + 1;
      }
    });

    console.log('[三系统联动] 事件总线钩子已连接');
  }

  // 波2 势力更新后检查 collapse → 广播事件
  var _prevFactionCollapseCheck = _updateFactionState;
  _updateFactionState = function() {
    _prevFactionCollapseCheck();
    if (!global.GM || !Array.isArray(GM.facs)) return;
    GM.facs.forEach(function(f) {
      if (f._collapsing && !f._collapseEventFired) {
        f._collapseEventFired = true;
        try {
          if (global.GameEventBus && global.GameEventBus.emit) {
            global.GameEventBus.emit('faction:collapse', { faction: f.name, leader: f.leader });
          }
        } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ext');}catch(_){}}
      } else if (!f._collapsing && f._collapseEventFired) {
        f._collapseEventFired = false;
      }
    });
  };

  // 暴露
  global.ThreeSystemsExt = {
    extendFactionFields: extendFactionFields,
    initPartyState: initPartyState,
    buildProvinceOwnerIndex: buildProvinceOwnerIndex,
    getFactionProvinces: getFactionProvinces,
    setProvinceOwner: setProvinceOwner,
    extendArmyFields: extendArmyFields,
    extendCharacterSocialFields: extendCharacterSocialFields,
    backfillHostileFactionArmies: backfillHostileFactionArmies,
    inferCharacterNetworks: inferCharacterNetworks,
    initThreeSystemsOnStart: initThreeSystemsOnStart,
    // 波2 回合循环
    updateFactionState: _updateFactionState,
    updatePartyState: _updatePartyState,
    updateMilitaryState: _updateMilitaryState,
    updateThreeSystemsOnEndTurn: updateThreeSystemsOnEndTurn,
    // 波3 NPC AI 决策器
    scThreeSystemsAI: _scThreeSystemsAI,
    buildNpcDecisionsForSysP: buildNpcDecisionsForSysP
  };
  global.updateThreeSystemsOnEndTurn = updateThreeSystemsOnEndTurn;
  global.scThreeSystemsAI = _scThreeSystemsAI;
  global.buildNpcDecisionsForSysP = buildNpcDecisionsForSysP;

  // 便捷顶级别名(供其他模块和 AI applier 直接调用)
  global.getFactionProvinces = getFactionProvinces;
  global.setProvinceOwner = setProvinceOwner;

  // 开局信件·sc.openingLetters 在 T1 自动 push 到 GM.letters·作为 NPC 来信
  function _activateOpeningLetters() {
    if (!global.GM || !global.P) return;
    if ((GM.turn || 1) !== 1) return;
    // 已激活过则跳过
    if (GM._openingLettersActivated) return;
    // 从当前剧本查 openingLetters
    var sc = null;
    try {
      if (typeof findScenarioById === 'function' && GM.sid) sc = findScenarioById(GM.sid);
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ext');}catch(_){}}
    if (!sc || !Array.isArray(sc.openingLetters) || sc.openingLetters.length === 0) { GM._openingLettersActivated = true; return; }
    if (!Array.isArray(GM.letters)) GM.letters = [];
    var _days = (P.time && P.time.daysPerTurn) || 30;
    sc.openingLetters.forEach(function(tpl) {
      if (!tpl || !tpl.from) return;
      // 若此信已存在(按 from+subjectLine 去重)则跳过
      if (GM.letters.some(function(l){ return l._fromOpeningLetter && l.from === tpl.from && l.subjectLine === tpl.subjectLine; })) return;
      var letter = {
        id: 'op_ltr_' + (tpl.from || '') + '_' + Math.random().toString(36).slice(2, 6),
        from: tpl.from,
        to: tpl.to || '朱由检',
        fromLocation: tpl.fromLocation || '',
        toLocation: tpl.toLocation || '京师',
        letterType: tpl.letterType || 'personal',
        urgency: tpl.urgency || 'normal',
        // R: 字段名统一为 _cipher（渲染端读 l._cipher，下划线开头表"非剧情字段"惯例）
        _cipher: tpl.cipher || tpl._cipher || 'none',
        subjectLine: tpl.subjectLine || '',
        content: tpl.content || '',
        suggestion: tpl.suggestion || '',
        sentTurn: 1,
        sentDate: GM._gameDate || '',
        deliveryTurn: 1,  // 开局即送达·无需等驿
        status: 'delivered',
        _replyExpected: tpl.replyExpected !== false,
        _npcInitiated: true,
        _fromOpeningLetter: true,
        _historicalRef: tpl._historicalRef || '',
        _background: tpl._background || '',
        isOpening: true
      };
      GM.letters.push(letter);
      // 记忆：上书者记下此次陈奏
      try {
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember && tpl.from) {
          var _opMem = '自' + (tpl.fromLocation||'远方') + '上书天子' + (tpl.subjectLine ? '《'+String(tpl.subjectLine).slice(0,20)+'》' : '') + '：' + String(tpl.content||'').slice(0, 60);
          NpcMemorySystem.remember(tpl.from, _opMem, '忧', 7, '天子', {
            type: 'dialogue',
            source: 'witnessed',
            credibility: 100
          });
        }
      } catch(_opMe) {}
      // 提示 toast
      if (typeof toast === 'function') toast((tpl.from || '远方') + ' 来信·' + (tpl.subjectLine || '').slice(0, 20));
      // 写 evtLog 让玩家面板可见
      if (typeof addEB === 'function') addEB('传书', (tpl.from||'') + ' 来信·' + (tpl.subjectLine || '').slice(0, 30));
      // 写编年
      if (!GM._chronicle) GM._chronicle = [];
      GM._chronicle.push({
        turn: 1, date: GM._gameDate || '',
        type: '开局来信',
        text: '【开局·鸿雁】' + tpl.from + ' 自 ' + (tpl.fromLocation||'远方') + ' 来书：' + (tpl.subjectLine || '').slice(0, 40),
        tags: ['开局', '传书', tpl.from || '']
      });
      console.log('[开局信件激活] ' + tpl.from + ' → ' + (tpl.to || '朱由检'));
    });
    GM._openingLettersActivated = true;
  }

  // 开局事件(isOpeningEvent/triggerTurn:1)自动 push 到 GM.currentIssues·让玩家首回合看到并选择
  function _activateOpeningEvents() {
    if (!global.GM || !global.P) return;
    if (!Array.isArray(P.events)) return;
    var turn = GM.turn || 1;
    // 仅在 T1 处理·避免重复
    if (turn !== 1) return;
    if (!GM.currentIssues) GM.currentIssues = [];
    P.events.forEach(function(e) {
      if (!e || e._openingActivated) return;
      var shouldOpen = (e.isOpeningEvent === true) || (e.triggerTurn === 1);
      if (!shouldOpen) return;
      // 避免重复 push
      if (GM.currentIssues.some(function(i){ return i.sourceEventId === e.id || i.title === e.name; })) return;
      var issue = {
        id: 'issue_' + (e.id || Math.random().toString(36).slice(2, 8)),
        sourceEventId: e.id || '',
        title: e.name || '开局要务',
        description: e.narrative || e.description || '',
        category: e.importance === '关键' ? '关键决策' : (e.affectedRegion ? '地方·' + e.affectedRegion : '要事'),
        severity: e.importance === '关键' ? 'urgent' : 'high',
        status: 'pending',
        raisedTurn: 1,
        raisedDate: GM._gameDate || '',
        choices: Array.isArray(e.choices) ? e.choices.slice() : [],
        linkedChars: e.linkedChars || [],
        linkedFactions: e.linkedFactions || [],
        affectedRegion: e.affectedRegion || '',
        longTermConsequences: e.longTermConsequences || null,
        historicalNote: e.historicalNote || '',
        isOpening: true
      };
      GM.currentIssues.push(issue);
      e._openingActivated = true;
      e.triggered = true;
      // 同步写入编年
      if (!GM._chronicle) GM._chronicle = [];
      GM._chronicle.push({
        turn: 1, date: GM._gameDate || '',
        type: '开局要务',
        text: '【' + (e.name || '') + '】' + (e.description || e.narrative || '').slice(0, 120),
        tags: ['开局', e.importance || '重要'].concat(e.affectedRegion ? [e.affectedRegion] : [])
      });
      console.log('[开局事件激活] ' + e.name + ' → currentIssues');
    });
  }

  // 注册到 GameHooks 的 enterGame:after 和 startGame:after
  if (global.GameHooks && typeof global.GameHooks.on === 'function') {
    global.GameHooks.on('enterGame:after', function(){
      try { initThreeSystemsOnStart(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统扩展] enterGame:after 异常') : console.warn('[三系统扩展] enterGame:after 异常', e); }
      try { _wireCrossSystemLinks(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统联动] wire 异常') : console.warn('[三系统联动] wire 异常', e); }
      try { _activateOpeningEvents(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '开局事件] enterGame:after 异常') : console.warn('[开局事件] enterGame:after 异常', e); }
      try { _activateOpeningLetters(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '开局信件] enterGame:after 异常') : console.warn('[开局信件] enterGame:after 异常', e); }
    });
    global.GameHooks.on('startGame:after', function(){
      try { initThreeSystemsOnStart(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统扩展] startGame:after 异常') : console.warn('[三系统扩展] startGame:after 异常', e); }
      try { _wireCrossSystemLinks(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '三系统联动] wire 异常') : console.warn('[三系统联动] wire 异常', e); }
      try { _activateOpeningEvents(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '开局事件] startGame:after 异常') : console.warn('[开局事件] startGame:after 异常', e); }
      try { _activateOpeningLetters(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '开局信件] startGame:after 异常') : console.warn('[开局信件] startGame:after 异常', e); }
    });
  }
  // 脚本加载即尝试 wire(若事件总线已就绪)
  try { _wireCrossSystemLinks(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ext');}catch(_){}}

})(typeof window !== 'undefined' ? window : this);
