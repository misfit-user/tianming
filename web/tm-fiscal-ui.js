// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-g4-economy-finalize.js — G 阶段 ④：经济终结补完
 *
 * 补完：
 *  - 破产 step3 驿站真实影响（政令传递延迟）
 *  - 诏令扣账 feasibility 处理（rejected/insufficient 等）
 *  - 年度决算弹窗 + 地方分账 Tab
 *  - 纸币 25 条按朝代自动启用
 *  - 海外银流年度推进
 *  - acceptanceByRegion 与成色/私铸耦合
 *  - 私产五大类子数组（LandHolding 等）
 *  - 家族共财/分家模式运算
 *  - 抄家隐匿挖掘 + 株连三档
 *  - 监察预算约束 + 覆盖率 = 预算/需求
 *  - 强征连续 2 回合双倍惩罚处理器
 *  - 承载力五维热力图
 *  - 古语 UI 文案库
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  破产 step3 驿站延迟应用
  // ═══════════════════════════════════════════════════════════════════

  function _applyPostalCollapseEffect(ctx, mr) {
    var G = global.GM;
    if (!G._infraState || !G._infraState.postalCollapse) return;
    // 政令传递延迟：pending memorial 延长 +1 turn
    if (G._pendingMemorials) {
      G._pendingMemorials.forEach(function(m) {
        if (m.status === 'pending_draft' && !m._postalDelayed) {
          m._postalDelayed = true;
          m.expectedReturnTurn = (m.expectedReturnTurn || 0) + 1;
        }
      });
    }
    // 合规率下降（央令难传达）
    if (G.fiscal && G.fiscal.regions) {
      Object.values(G.fiscal.regions).forEach(function(r) {
        r.compliance = Math.max(0.1, r.compliance - 0.003 * mr);
      });
    }
    // 军队调动延长
    if (G._activeTroopMovements) {
      G._activeTroopMovements.forEach(function(m) {
        if (!m._postalDelayed) {
          m._postalDelayed = true;
          m.days = (m.days || 15) * 1.3;
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  诏令扣账 feasibility 处理
  // ═══════════════════════════════════════════════════════════════════

  function processFiscalActionFeasibility(action) {
    var G = global.GM;
    if (!G.guoku) return { feasibility: 'rejected', reason: '帑廪未初始化' };
    var amount = action.amount || 0;
    // 检查
    if (amount > (G.guoku.money || 0)) {
      if ((G.guoku.money || 0) + amount > -((G.guoku.annualIncome||10000000) * 0.3)) {
        return { feasibility: 'insufficient', reason: '需借贷', suggestion: '户部借贷，年息 8%' };
      }
      return { feasibility: 'rejected', reason: '帑廪空虚' };
    }
    // 审批通过
    return { feasibility: 'approved', netAmount: amount };
  }

  function executeFiscalAction(action) {
    var G = global.GM;
    var feas = processFiscalActionFeasibility(action);
    if (feas.feasibility === 'rejected') {
      if (global.addEB) global.addEB('财政', action.name + ' 驳回：' + feas.reason);
      return feas;
    }
    if (feas.feasibility === 'insufficient') {
      // 走借贷路径
      if (!G._loans) G._loans = [];
      G._loans.push({
        id: 'loan_' + (G.turn||0),
        amount: action.amount,
        interestRate: 0.08,
        takenTurn: G.turn || 0,
        remaining: action.amount * 1.08
      });
      G.guoku.money = (G.guoku.money || 0) + action.amount;
      if (global.addEB) global.addEB('借贷', action.name + '借 ' + action.amount);
    }
    G.guoku.money = Math.max(-9e9, G.guoku.money - action.amount);
    return { feasibility: 'executed', amount: action.amount };
  }

  function _tickLoans(ctx, mr) {
    var G = global.GM;
    if (!G._loans) return;
    // 每月偿还
    G._loans.forEach(function(l) {
      if (l.remaining <= 0) return;
      var monthlyPayment = Math.floor(l.amount * l.interestRate / 12 + l.amount / 120);  // 10 年摊还
      l.remaining = Math.max(0, l.remaining - monthlyPayment);
      if (G.guoku) G.guoku.money = Math.max(-9e9, G.guoku.money - monthlyPayment * mr);
    });
    G._loans = G._loans.filter(function(l){return l.remaining > 0;});
  }

  // ═══════════════════════════════════════════════════════════════════
  //  年度决算弹窗 + 地方分账 Tab
  // ═══════════════════════════════════════════════════════════════════

  // Read-only display index. Live administrative names win over legacy region snapshots.
  // Rebuild per report so renaming a division or loading another save cannot leave stale labels.
  function regionLabelsForDisplay(G) {
    G = G || {};
    var names = new Map(), seen = new Set(), queue = [];
    function label(value) {
      return typeof value === 'string' && value.trim() && !/^div_/i.test(value.trim()) ? value.trim() : '';
    }
    function enqueue(nodes) {
      if (!nodes || typeof nodes !== 'object') return;
      if (Array.isArray(nodes)) { nodes.forEach(function(node) { queue.push({ node:node }); }); return; }
      if (nodes.id != null || nodes.name || nodes.divisions || nodes.children || nodes.subRegions) { queue.push({ node:nodes }); return; }
      Object.keys(nodes).forEach(function(key) { queue.push({ node:nodes[key], alias:key }); });
    }
    function index(roots) {
      queue = []; enqueue(roots);
      for (var i = 0; i < queue.length; i++) {
        var entry = queue[i], node = entry.node;
        if (!node || typeof node !== 'object') continue;
        var name = label(node.name) || label(node.regionName);
        if (name) [node.id, node.code, entry.alias, node.name].forEach(function(key) {
          if (key != null && String(key) && !names.has(String(key))) names.set(String(key), name);
        });
        if (seen.has(node)) continue;
        seen.add(node);
        enqueue(node.divisions); enqueue(node.children); enqueue(node.subRegions);
      }
    }
    index(G.adminHierarchy); index(G.regions);
    var result = Object.create(null), records = (G.fiscal && G.fiscal.regions) || {};
    Object.keys(records).forEach(function(id) {
      var record = records[id] || {};
      result[id] = names.get(id) || label(record.regionName) || label(record.name) || (/^div_/i.test(id) ? '地区未载' : id);
    });
    return result;
  }

  function fiscalText(value) {
    return String(value).replace(/[&<>"']/g, function(ch) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]; });
  }

  function openYearlyReport() {
    var G = global.GM;
    if (!G.guoku) { if (global.toast) global.toast('帑廪未初始化'); return; }
    var h = G.guoku.history || {};
    var lastYear = (h.yearlyArchive || [])[((h.yearlyArchive||[]).length - 1)];
    if (!lastYear) { if (global.toast) global.toast('年度归档无'); return; }
    var body = '<div style="max-width:720px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">📅 年度决算 · ' + lastYear.year + '</div>';
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
    body += '<div style="padding:10px;background:var(--bg-2);"><div style="font-size:0.74rem;">岁入</div><div style="font-size:1.2rem;color:var(--celadon-300);">' + Math.round(lastYear.totalIncome/10000) + ' 万</div></div>';
    body += '<div style="padding:10px;background:var(--bg-2);"><div style="font-size:0.74rem;">岁出</div><div style="font-size:1.2rem;color:var(--vermillion-300);">' + Math.round(lastYear.totalExpense/10000) + ' 万</div></div>';
    body += '</div>';
    var net = lastYear.totalIncome - lastYear.totalExpense;
    body += '<div style="padding:10px;background:var(--bg-2);margin-bottom:10px;">';
    body += '<div style="font-size:0.74rem;">结余</div>';
    body += '<div style="font-size:1.4rem;color:' + (net>=0?'var(--gold-300)':'var(--vermillion-400)') + ';">' + (net>=0?'+':'') + Math.round(net/10000) + ' 万</div>';
    body += '</div>';
    // 按源
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">岁入按源</div>';
    body += '<div style="background:var(--bg-2);padding:8px;border-radius:3px;font-size:0.72rem;margin-bottom:10px;">';
    Object.keys(lastYear.bySource || {}).forEach(function(k) {
      body += '<div>' + k + '：' + Math.round((lastYear.bySource[k]||0)/10000) + ' 万</div>';
    });
    body += '</div>';
    // 按沉
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">岁出按项</div>';
    body += '<div style="background:var(--bg-2);padding:8px;border-radius:3px;font-size:0.72rem;margin-bottom:10px;">';
    Object.keys(lastYear.bySink || {}).forEach(function(k) {
      body += '<div>' + k + '：' + Math.round((lastYear.bySink[k]||0)/10000) + ' 万</div>';
    });
    body += '</div>';
    // 地方分账 tab
    if (G.fiscal && G.fiscal.regions) {
      var regionLabels = regionLabelsForDisplay(G);
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">各地区分账</div>';
      body += '<div style="max-height:200px;overflow-y:auto;background:var(--bg-2);padding:6px;font-size:0.7rem;">';
      body += '<table style="width:100%;"><thead><tr style="color:var(--gold-500);"><th style="text-align:left;">地区</th><th>名义</th><th>实征</th><th>留</th><th>起</th><th>皮</th><th>公</th></tr></thead><tbody>';
      Object.keys(G.fiscal.regions).forEach(function(rid) {
        var r = G.fiscal.regions[rid] || {};
        body += '<tr><td title="' + fiscalText(rid) + '">' + fiscalText(regionLabels[rid]) + '</td>';
        body += '<td>' + Math.round((r.claimedRevenue||0)/10000) + '</td>';
        body += '<td>' + Math.round((r.actualRevenue||0)/10000) + '</td>';
        body += '<td>' + Math.round((r.retainedBudget||0)/10000) + '</td>';
        body += '<td>' + Math.round((r.remittedToCenter||0)/10000) + '</td>';
        body += '<td>' + ((r.skimmingRate||0)*100).toFixed(0) + '%</td>';
        body += '<td>' + Math.round((r.publicExpended||0)/10000) + '</td>';
        body += '</tr>';
      });
      body += '</tbody></table>';
      body += '</div>';
    }
    body += '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19070;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.0rem;width:92%;max-width:760px;max-height:88vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  纸币按朝代自动启用
  // ═══════════════════════════════════════════════════════════════════

  function autoEnablePaperByDynasty(G) {
    if (!G.currency || !G.dynasty) return;
    var dy = G.dynasty;
    var year = G.year || 1000;
    if (!G.currency.coins) G.currency.coins = {};
    if (!G.currency.coins.paper) G.currency.coins.paper = { enabled: false, newIssuances: [] };
    // 宋元明清 启用纸币
    if (/宋|元/.test(dy) || (dy === '明' && year < 1500) || (dy === '清' && year > 1850)) {
      G.currency.coins.paper.enabled = true;
      // 按朝代初始纸币
      var initialPaper = {
        '宋': 'jiaozi_shu',
        '元': 'zhongtong_chao',
        '明': 'daming_chao',
        '清': 'baochao_qing'
      }[dy];
      if (initialPaper && typeof global.PhaseF6 !== 'undefined' && global.PhaseF6.PAPER_PRESETS_25) {
        var preset = global.PhaseF6.PAPER_PRESETS_25.find(function(p){return p.id===initialPaper;});
        if (preset && !G.currency.coins.paper._autoLoaded) {
          G.currency.coins.paper._autoLoaded = true;
          G.currency.coins.paper.activePreset = initialPaper;
          G.currency.coins.paper.state = preset.state;
          if (global.addEB) global.addEB('纸币', '按 ' + dy + ' 启用 ' + preset.name);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  海外银流年度推进
  // ═══════════════════════════════════════════════════════════════════

  function _tickForeignSilverFlow(ctx) {
    var G = global.GM;
    if (!G.currency || !G.year) return;
    // 仅明清启用
    if (!(G.dynasty === '明' && G.year >= 1530) && !(G.dynasty === '清')) return;
    if (!G.currency.foreignFlow) G.currency.foreignFlow = { annualInflow: 0, annualOutflow: 0, sources: {}, sinks: {}, tradeMode: 'tribute' };
    var ff = G.currency.foreignFlow;
    // 年度（仅 month=1）
    if ((G.month || 1) !== 1) return;
    // 明中后期大量银入
    if (G.dynasty === '明' && G.year >= 1550 && G.year <= 1644) {
      ff.annualInflow = 2000000;  // 美洲/日本银
      ff.sources = { america: 1400000, japan: 600000 };
    } else if (G.dynasty === '清' && G.year <= 1820) {
      ff.annualInflow = 3000000;
      ff.sources = { america: 2000000, japan: 500000, europe: 500000 };
    } else if (G.dynasty === '清' && G.year > 1820) {
      // 鸦片贸易 → 银外流
      ff.annualOutflow = 2500000;
      ff.sinks = { opium: 2000000, indemnity: 500000 };
    }
    var net = (ff.annualInflow || 0) - (ff.annualOutflow || 0);
    if (net !== 0) {
      if (G.guoku) G.guoku.money = (G.guoku.money || 0) + Math.floor(net * 0.3);  // 30% 入国库
      if (global.addEB) global.addEB('海外', '年度白银净' + (net>0?'入':'出') + ' ' + Math.abs(net));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  acceptanceByRegion 与成色/私铸耦合
  // ═══════════════════════════════════════════════════════════════════

  function updateAcceptanceWithPurity(G, mr) {
    if (!G.currency || !G.currency.market || !G.currency.market.acceptanceByRegion) return;
    var purity = (G.currency.coins && G.currency.coins.copper && G.currency.coins.copper.currentPurity) || 0.9;
    var privMintShare = (G.currency.coins && G.currency.coins.copper && G.currency.coins.copper.privateMintShare) || 0.1;
    var accept = G.currency.market.acceptanceByRegion;
    Object.keys(accept).forEach(function(rid) {
      // 接受度跟成色正相关，跟私铸负相关
      var purityFactor = purity;
      var privFactor = 1 - privMintShare * 0.5;
      var newAccept = purityFactor * privFactor;
      accept[rid].acceptance = Math.max(0.3, Math.min(1, accept[rid].acceptance * 0.95 + newAccept * 0.05));
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  私产五大类子数组
  // ═══════════════════════════════════════════════════════════════════

  function initEnhancedPrivateWealth(char) {
    if (!char.privateWealthDetailed) {
      char.privateWealthDetailed = {
        cash:     char.privateWealth && char.privateWealth.cash || 0,
        lands:    [],         // [{id, acres, yield, tenants, location}]
        houses:   [],         // [{id, rooms, location, value}]
        shops:    [],         // [{id, industry, revenue}]
        treasures:[],         // [{id, type, value, hidden}]
        familyBusinesses:[]   // [{id, type, annualReturn, stake}]
      };
      // 按原 privateWealth.land 数值初始化几个土地块
      if (char.privateWealth && char.privateWealth.land) {
        var totalLand = char.privateWealth.land;
        for (var i = 0; i < Math.min(3, Math.floor(totalLand / 1000)); i++) {
          char.privateWealthDetailed.lands.push({
            id: 'land_' + i,
            acres: Math.floor(totalLand / 3),
            yield: Math.floor(totalLand / 3 * 0.5),
            tenants: Math.floor(totalLand / 30)
          });
        }
      }
      if (char.privateWealth && char.privateWealth.treasure) {
        char.privateWealthDetailed.treasures.push({
          id:'tr_0', type:'general', value: char.privateWealth.treasure, hidden: char.privateWealth.treasure > 50000
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  家族共财/分家模式
  // ═══════════════════════════════════════════════════════════════════

  function initFamilyMode(family, mode) {
    if (!family) return;
    family.mode = mode || 'communal';  // communal / divided
    if (mode === 'communal') {
      family.sharedWealth = { cash: 0, grain: 0 };
    }
  }

  function consolidateFamilyWealth(familyId) {
    var G = global.GM;
    if (!G.families) G.families = [];
    var fam = G.families.find(function(f){return f.id===familyId;});
    if (!fam || fam.mode !== 'communal') return;
    var members = (G.chars || []).filter(function(c){return c.familyId===familyId && c.alive!==false;});
    var totalCash = members.reduce(function(a,c){return a+((c.privateWealth&&c.privateWealth.cash)||0);}, 0);
    fam.sharedWealth = fam.sharedWealth || {};
    fam.sharedWealth.cash = totalCash * 0.3;  // 30% 共财
    members.forEach(function(m){
      if (m.privateWealth) m.privateWealth.cash = (m.privateWealth.cash || 0) * 0.7;
    });
  }

  function divideFamily(familyId) {
    var G = global.GM;
    var fam = (G.families || []).find(function(f){return f.id===familyId;});
    if (!fam) return;
    var shared = fam.sharedWealth || { cash: 0 };
    var members = (G.chars || []).filter(function(c){return c.familyId===familyId && c.alive!==false;});
    if (members.length === 0) return;
    var perShare = shared.cash / members.length;
    members.forEach(function(m){
      if (!m.privateWealth) m.privateWealth = {};
      m.privateWealth.cash = (m.privateWealth.cash || 0) + perShare;
    });
    fam.mode = 'divided';
    fam.sharedWealth = null;
    if (global.addEB) global.addEB('分家', '家族 ' + familyId + ' 分产，每份 ' + Math.round(perShare));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  抄家隐匿挖掘 + 株连三档
  // ═══════════════════════════════════════════════════════════════════

  var CONFISCATION_EXTENT = {
    none:              { scope:'self', digProbability:0.3 },
    immediate_family:  { scope:'immediate', digProbability:0.6 },
    full_family:       { scope:'full_clan', digProbability:0.9 }
  };

  function executeConfiscation(targetName, extent) {
    var G = global.GM;
    extent = extent || 'immediate_family';
    var cfg = CONFISCATION_EXTENT[extent];
    if (!cfg) return { ok: false };
    var target = (G.chars || []).find(function(c){return c.name===targetName;});
    if (!target) return { ok: false };
    var totalSeized = 0;
    // 挖掘隐匿
    var digChance = cfg.digProbability;
    var hiddenValue = 0;
    if (target.privateWealthDetailed && target.privateWealthDetailed.treasures) {
      target.privateWealthDetailed.treasures.forEach(function(t) {
        if (t.hidden && Math.random() < digChance) {
          hiddenValue += t.value;
          t.value = 0;
        }
      });
    }
    // 显性资产
    if (target.privateWealth) {
      totalSeized += (target.privateWealth.cash || 0);
      totalSeized += (target.privateWealth.treasure || 0);
      totalSeized += (target.privateWealth.commerce || 0);
      target.privateWealth.cash = 0;
      target.privateWealth.treasure = 0;
      target.privateWealth.commerce = 0;
    }
    totalSeized += hiddenValue;
    // 株连
    var implicated = [];
    if (cfg.scope === 'immediate' || cfg.scope === 'full_clan') {
      // 找核心家族成员
      var family = target.familyId && (G.families||[]).find(function(f){return f.id===target.familyId;});
      if (family) {
        (G.chars || []).forEach(function(c) {
          if (c.name === target.name) return;
          if (c.familyId !== target.familyId) return;
          if (c.alive === false) return;
          if (cfg.scope === 'immediate' && c._familyTier !== 'core') return;
          c.alive = false;
          c._purgedTurn = G.turn;
          c._implicationReason = target.name;
          implicated.push(c.name);
          // 扣其财
          if (c.privateWealth) {
            totalSeized += (c.privateWealth.cash || 0);
            c.privateWealth.cash = 0;
          }
        });
      }
    }
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + totalSeized;
    target.alive = false;
    target._confiscatedTurn = G.turn;
    target._confiscatedThisTurn = true;
    if (global.addEB) global.addEB('抄家', targetName + ' 抄没 ' + totalSeized + ' 钱 · 株连 ' + implicated.length);
    if (global._adjAuthority) {
      global._adjAuthority('huangwei', 3);
      global._adjAuthority('minxin', -Math.min(5, implicated.length));
    }
    return { ok: true, seized: totalSeized, implicated: implicated, hiddenFound: hiddenValue };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  监察预算约束 + 覆盖率
  // ═══════════════════════════════════════════════════════════════════

  function _tickAuditBudgetConstraint(ctx, mr) {
    var G = global.GM;
    if (!G.auditSystem) return;
    if (!G.auditSystem.annualBudget) G.auditSystem.annualBudget = 200000;
    if (!G.auditSystem.consumed) G.auditSystem.consumed = 0;
    // 年度重置
    if ((G.month || 1) === 1) {
      G.auditSystem.consumed = 0;
      // 使用率 → 覆盖率
      var demand = ((G.regions || []).length || 20) * 10000;
      G.auditSystem.coverage = Math.min(1, G.auditSystem.annualBudget / demand);
    }
    // 薪资扣
    var salary = Math.floor(G.auditSystem.inspectorsAssigned && Object.keys(G.auditSystem.inspectorsAssigned).length * 1000 * mr || 0);
    if (salary > 0 && G.guoku) {
      G.guoku.money = Math.max(-9e9, G.guoku.money - salary);
      G.auditSystem.consumed += salary;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  强征连续 2 回合双倍惩罚处理器
  // ═══════════════════════════════════════════════════════════════════

  function processForcedLevy(regionId, amount, reason) {
    var G = global.GM;
    if (!G.fiscal || !G.fiscal.regions) return { ok: false };
    var reg = G.fiscal.regions[regionId];
    if (!reg) return { ok: false };
    if (typeof global.PhaseA !== 'undefined' && global.PhaseA.checkForcedLevyCooldown) {
      var cd = global.PhaseA.checkForcedLevyCooldown(regionId, amount);
      // 应用强征
      reg.actualRevenue = (reg.actualRevenue || 0) + amount;
      if (G.guoku) G.guoku.money = (G.guoku.money || 0) + amount;
      // 冷却惩罚已在 checkForcedLevyCooldown 中应用
      // unrest +30 若连续
      if (cd.penaltyMult > 1.5) {
        reg.unrest = Math.min(100, (reg.unrest || 30) + 30);
        // 超额 50% 触发地方暴动
        if (amount > (reg.claimedRevenue || 100000) * 1.5 && Math.random() < 0.3) {
          if (G.minxin && !G.minxin.revolts) G.minxin.revolts = [];
          if (G.minxin) G.minxin.revolts.push({
            id: 'force_levy_rev_' + (G.turn||0),
            region: regionId, turn: G.turn||0, cause:'强征', status:'ongoing', level: 3, scale: 10000
          });
          if (global.addEB) global.addEB('强征', regionId + ' 强征激民变');
        }
      }
      return { ok: true, penaltyMult: cd.penaltyMult };
    }
    return { ok: false };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  承载力五维热力图
  // ═══════════════════════════════════════════════════════════════════

  function openCarryingCapacityHeatmap() {
    var G = global.GM;
    if (!G.environment || !G.environment.byRegion) { if (global.toast) global.toast('环境未初始化'); return; }
    var dims = ['farmland', 'water', 'fuel', 'housing', 'sanitation'];
    var dimNames = { farmland:'田力', water:'水源', fuel:'薪炭', housing:'居处', sanitation:'卫生' };
    var body = '<div style="max-width:780px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">🌄 承载力五维图</div>';
    dims.forEach(function(dim) {
      body += '<div style="margin-bottom:10px;">';
      body += '<div style="font-size:0.8rem;color:var(--gold-400);margin-bottom:4px;">' + dimNames[dim] + '</div>';
      body += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:3px;">';
      Object.keys(G.environment.byRegion).forEach(function(rid) {
        var r = G.environment.byRegion[rid];
        var v = (r.carrying && r.carrying[dim]) || (r[dim + 'Support']) || 0.5;
        var color = v >= 1.0 ? 'var(--celadon-500)' : v >= 0.7 ? 'var(--celadon-300)' : v >= 0.5 ? 'var(--gold-400)' : v >= 0.3 ? 'var(--vermillion-400)' : 'var(--vermillion-500)';
        body += '<div style="padding:4px 6px;background:' + color + ';border-radius:3px;color:#fff;font-size:0.71rem;">';
        body += rid + '<br>' + (v*100).toFixed(0) + '%';
        body += '</div>';
      });
      body += '</div>';
      body += '</div>';
    });
    body += '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19075;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.0rem;width:92%;max-width:800px;max-height:88vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  古语 UI 文案库
  // ═══════════════════════════════════════════════════════════════════

  var CLASSICAL_UI_TEXTS = {
    taxTooHeavy: '赋敛重而民困',
    taxLight:    '薄赋轻徭，天下归心',
    corruptHigh: '吏治大坏，百姓侧目',
    corruptLow:  '吏清政简，士民称颂',
    envOverload: '地力竭而民失所',
    envGood:     '地力渐复，草木蕃茂',
    mxHigh:      '四海升平，万邦景从',
    mxLow:       '四海鼎沸，怨声载道',
    hwHigh:      '天威有加，八荒来服',
    hwLow:       '王纲解纽，政出多门',
    hqHigh:      '乾纲独断，号令风从',
    hqLow:       '权臣专朝，御令不达',
    treasuryRich:'帑廪充盈，足济国用',
    treasuryLow: '国帑告罄，支用艰难',
    popBoom:     '户口日增，生齿日繁',
    popDecline:  '户口凋零，田畴荒废'
  };

  function getClassicalText(key) {
    return CLASSICAL_UI_TEXTS[key] || '';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    var G = global.GM;
    try { _applyPostalCollapseEffect(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
    try { _tickLoans(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
    try { _tickForeignSilverFlow(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
    try { updateAcceptanceWithPurity(G, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
    try { _tickAuditBudgetConstraint(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
    // 年度决算通知
    if ((G.month||1) === 1 && G.turn > 0) {
      try { autoEnablePaperByDynasty(G); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
      // 合并家族共财
      try {
        (G.families || []).forEach(function(f) {
          if (f.mode === 'communal') consolidateFamilyWealth(f.id);
        });
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-fiscal-ui');}catch(_){}}
    }
  }

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    autoEnablePaperByDynasty(G);
    // 初始化 char.privateWealthDetailed
    (G.chars || []).forEach(function(c) {
      if (c.alive !== false) initEnhancedPrivateWealth(c);
    });
  }

  global.PhaseG4 = {
    init: init,
    tick: tick,
    processFiscalActionFeasibility: processFiscalActionFeasibility,
    executeFiscalAction: executeFiscalAction,
    openYearlyReport: openYearlyReport,
    regionLabelsForDisplay: regionLabelsForDisplay,
    autoEnablePaperByDynasty: autoEnablePaperByDynasty,
    updateAcceptanceWithPurity: updateAcceptanceWithPurity,
    initEnhancedPrivateWealth: initEnhancedPrivateWealth,
    initFamilyMode: initFamilyMode,
    consolidateFamilyWealth: consolidateFamilyWealth,
    divideFamily: divideFamily,
    executeConfiscation: executeConfiscation,
    processForcedLevy: processForcedLevy,
    openCarryingCapacityHeatmap: openCarryingCapacityHeatmap,
    getClassicalText: getClassicalText,
    CONFISCATION_EXTENT: CONFISCATION_EXTENT,
    CLASSICAL_UI_TEXTS: CLASSICAL_UI_TEXTS,
    VERSION: 1
  };

  global.openYearlyReport = openYearlyReport;
  global.openCarryingCapacityHeatmap = openCarryingCapacityHeatmap;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
