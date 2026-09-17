// tm-border-risk.js — P1-A1a 边境风险结算（激活死字段 borderRisk「边警」）
//   命门：补「AI 开战决策对地块边境/战略属性完全盲视」(region-panel-fields-audit-2026-06.md:117)。
//   现状：borderRisk 是纯死字段——剧本写死多少就永远显示多少，引擎从不算它(grep 全是 phase8 显示位)。
//
//   省级简化版(2026-06-20·owner 拍板「精度可低·AI 能读·避开地块桥接」)：
//     · 在 adminHierarchy 叶级算，写回 leaf.borderRisk → 面板 regionBundle 的 liveDivision 直接读活值，
//       AI 读同一世界模型(adminHierarchy/provinceStats)也读得到。
//     · 敌方压强 = faction 级敌对态势(复用 borderThreatAgg 的敌对判定·generalize 到任意 faction)。
//     · 本地防御 = 该叶驻军相对其丁口的充分度。敌强 × 本地空虚 → 边境风险高。
//     · 不碰 P.map.regions 的地块邻接(地块 id ↔ 省名 两套 key 桥接)——地理前线/腹地暂不分(精度可低)。
//   边境风险结算恒开(owner 拍板·活化修复直接生效·2026-07 斩旗转正删 flag)。
//   后续：A1b 接 AI 出征读 borderRisk 攻软肋·A1c 烽燧预警·未来用 region.neighbors 精化地理前线。
(function (global) {
  'use strict';

  var HOSTILE_TYPES = ['敌对', '战争', '敌视', '交战', 'hostile', 'war', '侵略'];

  // 某 faction(按 name)的敌对势力集——把 borderThreatAgg 的「对玩家」判定 generalize 到任意 faction 视角。
  function _hostileFactionsOf(facName, playerFacName, game) {
    var G = game || global.GM || {};
    var rels = G.factionRelations || [];
    return (G.facs || []).filter(function (f) {
      if (!f || !f.name || f.name === facName) return false;
      // 方式1：factionRelations 显式敌对(双向查)
      for (var i = 0; i < rels.length; i++) {
        var r = rels[i];
        if (!r || !r.type) continue;
        var hit = (r.from === facName && r.to === f.name) || (r.from === f.name && r.to === facName);
        if (hit && HOSTILE_TYPES.indexOf(r.type) >= 0) return true;
      }
      // 方式2：玩家视角额外用 playerRelation(< -50 视为敌对·同 borderThreatAgg)
      if (facName === playerFacName && (Number(f.playerRelation) || 0) < -50) return true;
      return false;
    });
  }

  // 叶驻军：优先活值 troops·回落区划军务/守备字段·取不到当 0(空虚=高危)。
  function _leafTroops(leaf) {
    var t = Number(leaf.troops);
    if (isFinite(t) && t >= 0) return t;
    var d = leaf.data || {};
    var gm = leaf.governanceMilitary || d.governanceMilitary || {};
    t = Number(gm.standingArmy);
    if (isFinite(t) && t >= 0) return t;
    t = Number(leaf.garrison != null ? leaf.garrison : d.garrison);
    return (isFinite(t) && t >= 0) ? t : 0;
  }

  // ───────────────────────────────────────────────────────────
  // 剧本威胁变量↔敌势力 联动（深挖第六轮④·2026-07-07·flag threatVarLinkEnabled 默认关）
  //   通用机制·朝代中立：剧本可在任意变量上声明 linkedFaction:'<势力id或名>'（绍宋「金军威胁等级」首用）。
  //   此前该类变量三缺：无系统性更新(只有史事分支小幅拨动)·无军事消费(desc 承诺的「威胁高→南侵」
  //   纯空头)·loader 不认 range 界。目标里程碑(金威≤40)读的就是它——接活后可经真实战和达成。
  //   更新端 tickThreatVarLink：变量向该势力实际态势(实力/战和/敌意)缓慢漂移(±2/回合)——
  //     史事抉择冲击(±N)保留为渐衰偏离而非被硬覆写。
  //   消费端 _threatVarOf：borderRisk 里该势力压强按变量调制(0.6~1.4)——「大南侵」冲击有真机械后果；
  //     变量值本亦随 GM.vars 全量入 AI prompt(genMemorialsAI 等)·叙事同感知。
  // ───────────────────────────────────────────────────────────
  function _threatVarOf(G, facName, facId) {
    var P = global.P || {};
    if (!P.conf || P.conf.threatVarLinkEnabled !== true) return null;
    var vars = (G && G.vars) || {};
    for (var k in vars) {
      var v = vars[k];
      if (v && v.linkedFaction && (v.linkedFaction === facName || v.linkedFaction === facId) && v.value != null) {
        return Math.max(0, Math.min(100, Number(v.value) || 0));
      }
    }
    return null;
  }

  function _isAtWarWithPlayer(G, facName) {
    var P = global.P || {};
    var playerFacName = (P.playerInfo && P.playerInfo.factionName) || 'player';
    var rels = G.factionRelations || [];
    for (var i = 0; i < rels.length; i++) {
      var r = rels[i];
      if (!r || !r.type) continue;
      var hit = (r.from === facName && r.to === playerFacName) || (r.from === playerFacName && r.to === facName);
      if (hit && ['战争', '交战', 'war'].indexOf(r.type) >= 0) return true;
    }
    if (Array.isArray(G.activeWars)) {
      for (var j = 0; j < G.activeWars.length; j++) {
        var w = G.activeWars[j];
        if (!w) continue;
        if (w.enemy === facName || w.attacker === facName || w.defender === facName ||
            (w.name && String(w.name).indexOf(facName) >= 0)) return true;
      }
    }
    return false;
  }

  function tickThreatVarLink() {
    var P = global.P || {};
    if (!P.conf || P.conf.threatVarLinkEnabled !== true) return;
    var G = global.GM;
    if (!G || !G.vars) return;
    Object.keys(G.vars).forEach(function (k) {
      var v = G.vars[k];
      if (!v || !v.linkedFaction) return;
      var fac = (G.facs || []).find(function (f) {
        return f && (f.name === v.linkedFaction || f.id === v.linkedFaction);
      });
      if (!fac) return;
      var strength = Math.max(0, Math.min(100, Number(fac.strength) || 50));
      var atWar = _isAtWarWithPlayer(G, fac.name);
      var hostile = (Number(fac.playerRelation) || 0) < -50;
      var target = Math.max(0, Math.min(100, Math.round(strength * 0.7 + (atWar ? 25 : 0) + (!atWar && hostile ? 10 : 0))));
      var cur = Number(v.value) || 0;
      var drift = Math.max(-2, Math.min(2, target - cur));           // 缓漂·史事冲击渐衰不硬覆写
      var lo = (v.min != null && isFinite(Number(v.min))) ? Number(v.min) : 0;
      var hi = (v.max != null && isFinite(Number(v.max))) ? Number(v.max) : 100;
      v.value = Math.max(lo, Math.min(hi, cur + drift));
      v._linkTarget = target;                                        // 诊断可见·非存档契约
    });
  }

  function tickBorderRisk(game, profile) {
    var P = profile || global.P || {};
    var G = game && game.adminHierarchy ? game : global.GM;
    if (!G || !G.adminHierarchy) return;
    var IB = global.IntegrationBridge;
    if (!IB || typeof IB.getLeafDivisions !== 'function') return;    // 无取叶能力·静默跳过
    var ah = G.adminHierarchy;
    var playerFacName = (P.playerInfo && P.playerInfo.factionName) || 'player';
    var touched = 0;

    Object.keys(ah).forEach(function (facId) {
      var ownerFacName = (facId === 'player') ? playerFacName : facId;
      var hostiles = _hostileFactionsOf(ownerFacName, playerFacName,G);
      var threatScore = 0;
      if (hostiles.length) {
        var sum = 0;
        hostiles.forEach(function (f) {
          var s = (Number(f.strength) || 50);
          var tv = _threatVarOf(G, f.name, f.id);                    // 剧本威胁变量调制(第六轮④·flag 关返 null=字节级旧行为)
          if (tv != null) s = s * (0.6 + 0.8 * tv / 100);
          sum += s;
        });
        threatScore = Math.min(100, Math.round(sum / hostiles.length));
      }
      var leaves = IB.getLeafDivisions(ah, facId) || [];
      for (var i = 0; i < leaves.length; i++) {
        var leaf = leaves[i];
        if (!leaf) continue;
        var localThreat = _frontierThreat(G,P,leaf,hostiles,threatScore);
        if (localThreat === null) { leaf.borderRisk=null; touched++; continue; }
        if (localThreat <= 0) { leaf.borderRisk = 0; touched++; continue; }   // 无敌邻·腹地太平
        var pd = leaf.populationDetail || {};
        var mouths = Number(pd.mouths) || 0;
        var troops = _stationed(G,leaf).reduce(function(n,a){return n+Math.max(0,Number(a.soldiers)||0);},0);
        if (!Array.isArray(G.armies)) troops=_leafTroops(leaf);
        var fortify = Number(leaf.defenseBonus) || 0;                 // A4·边防工事加成(自拟营建/烽燧巡检写)·每档≈2000驻军之防(关隘抵众)
        var expected = Math.max(500, mouths * 0.005);                 // 应有驻军 ~0.5% 丁口
        var defenseRatio = Math.max(0, Math.min(1, (troops + fortify * 2000) / expected));
        // 边境风险 = 敌强 × 本地空虚度(驻军满仍留 30% 残险·因敌在侧)
        leaf.borderRisk = Math.round(localThreat * (1 - defenseRatio * 0.7));
        touched++;
      }
    });
    if (G._debugBorderRisk) G._borderRiskTouched = touched;
  }

  // ───────────────────────────────────────────────────────────
  // P1-A2·军费负担结算(armyPressure)·owner 拍板「军费负担」定位(2026-06-20)
  //   armyPressure = 本地养兵的经济压力 = 月军费(驻军×饷) / 月留用(retainedBudget/12)。
  //   与 borderRisk(军事威胁)正交：边警=会不会被打·军压=养不养得起。契合明末辽饷压垮地方。
  //   派生 localMilitaryCost(本地月军费)+retainedNet(养兵后净留用·可负=赤字)·不改 fiscal 的 retainedBudget(它每回合重算)。
  //   军费负担结算恒开(owner 拍板·活化修复直接生效·2026-07 斩旗转正删 flag)。留用月耗下游(tm-audit 可用预算改读 retainedNet)留 A2b。
  // ───────────────────────────────────────────────────────────
  function _leafRetained(leaf) {
    var fd = leaf.fiscalDetail || leaf.fiscal || {};
    var r = Number(fd.retainedBudget);
    return (isFinite(r) && r > 0) ? r : 0;
  }

  function legacyArmyPressure() {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return;
    var IB = global.IntegrationBridge;
    if (!IB || typeof IB.getLeafDivisions !== 'function') return;
    var ah = G.adminHierarchy;
    // 月饷单价(两/兵)·复用 fiscal-engine DEFAULT_ARMY_PAY.money·取不到回落 0.5
    var payPerSoldier = 0.5;
    try { var dap = global.FixedExpense && global.FixedExpense.DEFAULT_ARMY_PAY; if (dap && Number(dap.money) > 0) payPerSoldier = Number(dap.money); } catch (e) {}
    Object.keys(ah).forEach(function (facId) {
      var leaves = IB.getLeafDivisions(ah, facId) || [];
      for (var i = 0; i < leaves.length; i++) {
        var leaf = leaves[i];
        if (!leaf) continue;
        var troops = _leafTroops(leaf);
        var monthlyPay = troops * payPerSoldier;                      // 本地月军费(两)
        leaf.localMilitaryCost = Math.round(monthlyPay);
        var retained = _leafRetained(leaf);                           // 地方留用(年)
        leaf.retainedNet = Math.round(retained - monthlyPay * 12);    // 养兵后净留用·可负=赤字
        var monthlyRetained = retained / 12;
        var pressure;
        if (troops <= 0) pressure = 0;                                // 无驻军·无军费压力
        else if (monthlyRetained <= 0) pressure = 85;                 // 有兵无留用·地方养不起·高压
        else pressure = Math.max(0, Math.min(100, Math.round(monthlyPay / monthlyRetained * 60)));  // 月军费/月留用×60
        leaf.armyPressure = pressure;
      }
    });
  }


  function _num(v) { return v===null||v===undefined||v===''||!isFinite(Number(v)) ? null : Number(v); }
  function _facName(G,key) { var f=(G.facs||G.factions||[]).find(function(x){return x && (x.id===key||x.name===key);});return f&&f.name||key; }
  function _stationed(G,leaf) {
    var id=String(leaf.mapRegionId||leaf.regionId||leaf.id||leaf.name||'');
    return (G.armies||[]).filter(function(a){return a && !a.destroyed && (String(a.location||a.garrison||a.regionHint||'')===id);});
  }
  function _frontierThreat(G,P,leaf,hostiles,fallback) {
    var map=G.mapData||P.map||{}, regions=map.regions;
    if(!Array.isArray(regions)||!regions.length)return fallback;
    var id=String(leaf.mapRegionId||leaf.id||leaf.name||''), region=regions.find(function(r){return r && String(r.id)===id;});
    if(!region)return null;
    var explicit=leaf.securityContext && _num(leaf.securityContext.externalPressure);
    var edges=Array.isArray(region.neighbors)?region.neighbors:(map.adjacencyGraph&&map.adjacencyGraph[id]);
    if(!Array.isArray(edges))return explicit==null?null:Math.max(0,Math.min(100,explicit));
    var threat=explicit==null?0:explicit;
    edges.forEach(function(neighbor){
      var target=regions.find(function(r){return r && String(r.id)===String(neighbor.id||neighbor);});
      if(!target)return;
      var owner=_facName(G,target.currentOwner||target.owner||target.factionId||target.ownerKey);
      var enemy=hostiles.find(function(f){return _facName(G,f.id||f.name)===owner;});
      if(enemy)threat=Math.max(threat,Math.max(0,Number(enemy.strength)||50));
    });
    return Math.max(0,Math.min(100,threat));
  }
  function _monthlyCost(G,a) {
    if(global.FixedExpense && typeof global.FixedExpense.armyMonthlyCost==='function')return global.FixedExpense.armyMonthlyCost(a,{game:G,faction:a.payingFactionId||a.factionId||a.faction});
    var out={}, fields={money:'monthlyMoneyPayPerSoldier',grain:'monthlyGrainPayPerSoldier',cloth:'monthlyClothPayPerSoldier'};
    Object.keys(fields).forEach(function(k){var rate=_num(a[fields[k]]), upkeep=a.monthlyUpkeep&&_num(a.monthlyUpkeep[k]);out[k]=rate!=null?Math.max(0,Number(a.soldiers)||0)*rate:upkeep;});
    return out;
  }
  function _militaryAccounts(G,P) {
    var IB=global.IntegrationBridge, rows=[], groups={}, preview={};
    Object.keys(G.adminHierarchy||{}).forEach(function(factionKey){
      var branch=G.adminHierarchy[factionKey]||{}, owner=_facName(G,branch.factionId||branch.name||(factionKey==='player'?P.playerInfo&&P.playerInfo.factionName:factionKey));
      var leaves=IB&&IB.getLeafDivisions?IB.getLeafDivisions(G.adminHierarchy,factionKey):[];
      leaves.forEach(function(leaf){rows.push({leaf:leaf,id:String(leaf.id||leaf.name),owner:owner,factionKey:factionKey});});
      if(global.CascadeTax&&typeof global.CascadeTax.previewBudget==='function'){
        try{var budget=global.CascadeTax.previewBudget({game:G,faction:factionKey,turnDays:30});if(budget && budget.totals)preview[owner]=budget;}catch(_){}
      }
    });
    function account(faction,regionId) {
      faction=_facName(G,faction);var key=regionId?'region:'+regionId:'faction:'+faction;
      if(groups[key])return groups[key];
      var budget=preview[faction], row=regionId&&rows.find(function(r){return r.id===regionId&&r.owner===faction;}), leaf=row&&row.leaf, fiscal=leaf&&(leaf.fiscal||{}), budgetRow=regionId&&budget&&(budget.regions||[]).find(function(r){return String(r.id)===regionId;});
      var leafIds=[];
      if(regionId && global.CascadeTax && typeof global.CascadeTax.fundingRegionIds==='function')leafIds=global.CascadeTax.fundingRegionIds({game:G,faction:faction,regionId:regionId})||[];
      if(regionId && !leafIds.length && row)leafIds=[row.id];
      var budgetRows=budget&&(budget.regions||[]).filter(function(r){return leafIds.indexOf(String(r.id))>=0;})||[];
      var resource={money:null,grain:null,cloth:null};
      Object.keys(resource).forEach(function(k){
        if(regionId){
          var specific=fiscal&&fiscal.militaryBudget;
          if(specific&&_num(specific[k])!=null)resource[k]=Number(specific[k])*30/Math.max(1,Number(specific.periodDays)||30);
          else if(budgetRows.length && budgetRows.every(function(r){return r.resources && r.resources[k] && _num(r.resources[k].retainedBudget)!=null;}))resource[k]=budgetRows.reduce(function(n,r){return n+Number(r.resources[k].retainedBudget);},0);
          else if(fiscal&&fiscal.resources&&fiscal.resources[k]&&fiscal.period&&fiscal.period.days)resource[k]=Number(fiscal.resources[k].retainedBudget)*30/Number(fiscal.period.days);
          else if(fiscal&&fiscal.annualResources&&fiscal.annualResources[k])resource[k]=Number(fiscal.annualResources[k].retainedBudget)/12;
          else if(k==='money'&&leaf){var raw=fiscal&&_num(fiscal.retainedBudget);if(raw!=null&&fiscal.period&&fiscal.period.days)resource[k]=raw*30/Number(fiscal.period.days);else if(leaf.fiscalDetail&&_num(leaf.fiscalDetail.retainedBudget)!=null)resource[k]=Number(leaf.fiscalDetail.retainedBudget)/12;}
        } else if(budget&&budget.totals&&budget.totals.central)resource[k]=_num(budget.totals.central[k]);
        if(resource[k]!=null)resource[k]=Math.max(0,resource[k]);
      });
      return groups[key]={key:key,factionId:faction,regionId:regionId||null,leafIds:leafIds,regionalResources:budgetRows,capacity:resource,cost:{money:0,grain:0,cloth:0},missing:[],budget:budget};
    }
    var byStation={}, unresolvedArmies=[];
    (G.armies||[]).filter(function(a){return a&&!a.destroyed;}).forEach(function(a){
      var station=rows.find(function(r){return String(a.location||a.garrison||a.regionHint||'')===r.id;}), funding=a.funding||{}, payer=_facName(G,funding.factionId||a.payingFactionId||a.factionId||a.faction);
      if(!station){unresolvedArmies.push(a.id||a.name);return;}
      var share=_num(funding.localShare);
      if(share==null)share=a.fiscalFunding==='local'?1:0;
      share=Math.max(0,Math.min(1,share));
      var localShares={},centralShares={};
      ['money','grain','cloth'].forEach(function(k){var declared=_num(funding.localShareByResource&&funding.localShareByResource[k]);localShares[k]=declared==null?share:Math.max(0,Math.min(1,declared));centralShares[k]=1-localShares[k];});
      var parts=[];if(Object.keys(localShares).some(function(k){return localShares[k]>0;}))parts.push({account:account(payer,String(funding.regionId||station.id)),shares:localShares});if(Object.keys(centralShares).some(function(k){return centralShares[k]>0;}))parts.push({account:account(payer,null),shares:centralShares});
      var cost=_monthlyCost(G,a)||{};
      parts.forEach(function(part){Object.keys(part.account.cost).forEach(function(k){if(!part.shares[k])return;var amount=_num(cost[k]);if(amount==null){part.account.missing.push(a.id+':'+k+'军费');return;}part.account.cost[k]+=Math.max(0,amount)*part.shares[k];});});
      byStation[station.id]=byStation[station.id]||[];Array.prototype.push.apply(byStation[station.id],parts);
    });
    Object.keys(groups).forEach(function(k){
      var g=groups[k], worst=0;
      Object.keys(g.cost).forEach(function(resource){
        var due=g.cost[resource], available=g.capacity[resource];
        if(due<=0)return;
        if(available==null){g.missing.push(resource+'预算');return;}
        // Other ordinary expenditure also competes with the army for a central budget.
        if(!g.regionId&&g.budget&&g.budget.expenses&&g.budget.expenses.central){var all=_num(g.budget.expenses.central[resource]);if(all!=null)available=Math.max(0,available-Math.max(0,all-due));}
        g.capacity[resource]=available;
        worst=Math.max(worst,available>0?due/available:Infinity);
      });
      g.ready=g.missing.length===0;g.pressure=g.ready?Math.min(100,Math.round(worst*60)):null;
      delete g.budget;
    });
    return {rows:rows,accounts:groups,byStation:byStation,hasBudgetPreview:Object.keys(preview).length>0,unresolvedArmies:unresolvedArmies};
  }
  function tickArmyPressure(game,profile) {
    var G=game&&game.adminHierarchy?game:global.GM, P=profile||global.P||{};
    if(!G||!G.adminHierarchy)return;
    if(!Array.isArray(G.armies)){legacyArmyPressure();return;}
    var state=_militaryAccounts(G,P), missing=[];
    if(!state.hasBudgetPreview && !(G.armies||[]).some(function(a){return a && a.funding && (a.funding.localShare!=null||a.funding.localShareByResource);})){legacyArmyPressure();return;}
    state.rows.forEach(function(row){
      var leaf=row.leaf, parts=state.byStation[row.id]||[], unique=[];
      parts.forEach(function(p){if(!unique.some(function(g){return g.key===p.account.key;}))unique.push(p.account);});
      Object.keys(state.accounts).forEach(function(k){var g=state.accounts[k];if(g.regionId && g.leafIds.indexOf(row.id)>=0 && !unique.some(function(x){return x.key===g.key;}))unique.push(g);});
      var stationed=_stationed(G,leaf);
      var ready=unique.every(function(g){return g.ready;});
      leaf.armyPressure=ready?(unique.length?Math.max.apply(null,unique.map(function(g){return g.pressure;})):0):null;
      var localCost=0,localCapacity=null;
      unique.filter(function(g){return g.regionId && g.leafIds.indexOf(row.id)>=0;}).forEach(function(g){
        var own=g.regionalResources.find(function(r){return String(r.id)===row.id;}), cap=own&&own.resources&&own.resources.money&&_num(own.resources.money.retainedBudget);
        var share=g.capacity.money>0 && cap!=null?cap/g.capacity.money:1/Math.max(1,g.leafIds.length);
        localCost+=g.cost.money*share;if(cap!=null)localCapacity=cap;
      });
      leaf.localMilitaryCost=Math.round(localCost);
      leaf.retainedNet=localCapacity!=null?Math.round((localCapacity-localCost)*12):null;
      leaf.militaryPressureDetail={ready:ready,periodDays:30,stationedSoldiers:stationed.reduce(function(n,a){return n+(Number(a.soldiers)||0);},0),accounts:unique.map(function(g){return {factionId:g.factionId,regionId:g.regionId,contributingRegionIds:g.leafIds,cost:g.cost,capacity:g.capacity,pressure:g.pressure,missing:g.missing};}),missing:[]};
      if(!ready)missing.push(row.id);
    });
    return {regions:state.rows.length,missing:missing,unresolvedArmies:state.unresolvedArmies};
  }
  function prime(game,profile){tickBorderRisk(game,profile);return tickArmyPressure(game,profile);}

  global.BorderRisk = { tick: tickBorderRisk, tickArmyPressure: tickArmyPressure, _hostileFactionsOf: _hostileFactionsOf,
    tickThreatVarLink: tickThreatVarLink, _threatVarOf: _threatVarOf, _isAtWarWithPlayer: _isAtWarWithPlayer, prime:prime, monthlyAccounts:_militaryAccounts };

  // 挂 SettlementPipeline·边患聚合(17) → 威胁变量联动(17.5·须先于边境风险取值) → 边境风险(18) → 军费负担(19)
  if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
    global.SettlementPipeline.register('threatVarLink', '威胁变量联动', tickThreatVarLink, 17.5, 'perturn');
    global.SettlementPipeline.register('borderRiskLeaf', '边境风险结算', tickBorderRisk, 18, 'perturn');
    global.SettlementPipeline.register('armyPressureLeaf', '军费负担结算', tickArmyPressure, 19, 'perturn');
  }
})(typeof window !== 'undefined' ? window : this);
