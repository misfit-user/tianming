// phase8-formal-map-dossier.js — 第二十五拆 sibling（御案中央地图·地块方志/势力谱牒册页 + regionBundle 数据装配层）
// split from phase8-formal-map.js·2026-07-06·第二十五拆（origin 3983→退巨石名单）
// 范式②b origin-first 双向 bucket(先例 tm-content-manager-community)：本片【紧随 origin 之后】装载。
//   origin 装载末向 bridge.__p8MapParts 导出 kept 成员→本片闭包捕获；本片回填 5 函数→origin forward shim 调用期解析。
// 迁出段（body 0 改动·逐字节等于 origin 原文）：
//   §A 军队↔地块对账 + regionBundle 数据装配层 [orig 2235-2675]
//   §B popup 基础设施 + 方志/谱牒册页 UI [orig 2881-3893]
(function(){
  'use strict';
  var bridge = window.TMPhase8FormalBridge;
  if (!bridge || !bridge.__p8MapParts) {
    console.error('[phase8-formal-map-dossier] __p8MapParts bucket 未就绪·phase8-formal-map.js 必须先 load');
    return;
  }
  var __p = bridge.__p8MapParts;
  // ── 捕获 origin kept 成员（45 项·②b origin 装载末已导出）──
  var firstValue = __p.firstValue, esc = __p.esc, ppValue = __p.ppValue, hasDisplayValue = __p.hasDisplayValue, hasValue = __p.hasValue;
  var plainObject = __p.plainObject, attr = __p.attr, ownerName = __p.ownerName, assignKnown = __p.assignKnown, ownerKey = __p.ownerKey;
  var shortText = __p.shortText, mapNum = __p.mapNum, findLiveAdminDivision = __p.findLiveAdminDivision, state = __p.state, toast = __p.toast;
  var findRegion = __p.findRegion, fieldLabel = __p.fieldLabel, regionTitle = __p.regionTitle, gradeOf = __p.gradeOf, getMapData = __p.getMapData;
  var pctValueIfPresent = __p.pctValueIfPresent, compactText = __p.compactText, factionTokens = __p.factionTokens, fmtNum = __p.fmtNum, firstPositive = __p.firstPositive;
  var recruitPoolValue = __p.recruitPoolValue, rowHasDisplayValue = __p.rowHasDisplayValue, ratio01 = __p.ratio01, moodViewScore = __p.moodViewScore, gradeIsWarn = __p.gradeIsWarn;
  var cssEscape = __p.cssEscape, regionNameKeys = __p.regionNameKeys, findLiveProvinceStats = __p.findLiveProvinceStats, liveRegionVitals = __p.liveRegionVitals, liveRegionOwner = __p.liveRegionOwner;
  var liveRegionGovernor = __p.liveRegionGovernor, findFaction = __p.findFaction, classPressureForRegion = __p.classPressureForRegion, MAP_MODE_META = __p.MAP_MODE_META, pctValue = __p.pctValue;
  var regionLevel = __p.regionLevel, officeViewScore = __p.officeViewScore, _reportedPop = __p._reportedPop, modeScore = __p.modeScore, ppTagNames = __p.ppTagNames;

  // ══════ §A 军队↔地块对账 + regionBundle 数据装配层（orig 2235-2675·body 0 改动）══════
  // ── 军队↔地块对账层（2026-06-12）：GM.armies 与地块驻军此前两本账（驻地是城名·区划字段全空）。
  //    驻地名 token 拆分 → 两遍匹配（先全等后包含·区划子树名册爬根）→ 按地块聚合活军。
  //    剧本可在 region.data.aliases / division.aliases 扩别名（朝代地名不硬编进引擎）。──
  var _armyRegionCache = { sig: '', byRegion: {}, unboundCount: 0, unbound: [] };
  function armyRegionIndex(){
    var gm = window.GM || {};
    var armies = Array.isArray(gm.armies) ? gm.armies : [];
    var map = getMapData() || {};
    var regions = map.regions || [];
    var sig = (gm.turn || 0) + ':' + armies.length + ':' +
      armies.reduce(function(a, x){ return a + (Number(x && x.soldiers) || 0); }, 0) + ':' + regions.length;
    if (_armyRegionCache.sig === sig) return _armyRegionCache;
    // 聚落层名册（2026-06-12）：localityLayer 自带 regionId↔城名（宁远城/锦州城/皮岛/山海关…），
    // 是城名驻地的通用解（朝代地名仍归剧本数据·引擎只读结构）。
    var locByRegion = {};
    (Array.isArray(map.localityLayer) ? map.localityLayer : []).forEach(function(x){
      if (!x || !x.regionId || !x.localityName) return;
      var k = String(x.regionId);
      if (!locByRegion[k]) locByRegion[k] = [];
      locByRegion[k].push(String(x.localityName));
    });
    var books = regions.map(function(r){
      var names = regionNameKeys(r).slice();
      var live = findLiveAdminDivision(r);
      if (live) (function walk(d){
        if (d && d.name) names.push(String(d.name));
        if (d && Array.isArray(d.aliases)) d.aliases.forEach(function(a){ names.push(String(a)); });
        var kids = d && (d.children || d.divisions);
        if (kids && kids.length) kids.forEach(walk);
      })(live);
      var alias = (r.data && r.data.aliases) || (r.admin && r.admin.aliases);
      if (Array.isArray(alias)) alias.forEach(function(a){ names.push(String(a)); });
      var rid0 = String(r.id || r.name || '');
      if (locByRegion[rid0]) names = names.concat(locByRegion[rid0]);
      return {
        id: rid0,
        names: names.filter(function(n){ return n && n.length >= 2; }),
        ownerKey: String(r.owner || r.currentOwner || (r.data && r.data.dejureOwner) || ''),
        pop: Number(r.data && r.data.population) || 0
      };
    });
    function matchRegion(token){
      if (!token || token.length < 2) return null;
      var i, j, ns;
      for (i = 0; i < books.length; i += 1) {        // 第一遍：全等
        ns = books[i].names;
        for (j = 0; j < ns.length; j += 1) if (ns[j] === token) return books[i].id;
      }
      for (i = 0; i < books.length; i += 1) {        // 第二遍：双向包含
        ns = books[i].names;
        for (j = 0; j < ns.length; j += 1) {
          if (ns[j].indexOf(token) >= 0 || token.indexOf(ns[j]) >= 0) return books[i].id;
        }
      }
      return null;
    }
    var facIdByName = {};
    (Array.isArray(gm.facs) ? gm.facs : []).forEach(function(f){
      if (f && f.name && (f.id || f.sid)) facIdByName[String(f.name)] = String(f.id || f.sid);
    });
    var byRegion = {};
    var unbound = [];
    function addTo(rid, a, soldiers, label){
      if (!byRegion[rid]) byRegion[rid] = { troops: 0, armies: [] };
      byRegion[rid].troops += soldiers;
      byRegion[rid].armies.push(label ? Object.assign({}, a, { name: String(a.name || '') + label, soldiers: soldiers }) : a);
    }
    armies.forEach(function(a){
      if (!a || a.destroyed) return;
      var soldiers = Math.max(0, Math.round(Number(a.soldiers || a.size || a.strength) || 0));
      if (soldiers <= 0) return;
      var garrisonText = String(a.garrison || a.location || '');
      // ① 剧本 regionHint 直绑：不在区划树/聚落层的驻地（蓟州/固原/京师等）由剧本点名所属地块
      var hint = a.regionHint || a.regionId;
      var rid = hint ? matchRegion(String(hint)) : null;
      // ② 驻地名 token 两遍匹配（区划子树+聚落层城名）
      if (!rid) {
        var tokens = garrisonText.split(/[·\-—~／/、()（）\s]+/).filter(Boolean);
        for (var i = 0; i < tokens.length && !rid; i += 1) rid = matchRegion(tokens[i]);
      }
      // ③ 散驻天下（卫所总览类）：按本势力治下地块户口分摊（纸面分驻·卡名缀「分驻」）
      if (!rid && /全国|各地|诸省|天下/.test(garrisonText)) {
        var fid = facIdByName[String(a.faction || '')] || '';
        var owned = books.filter(function(b){ return fid && b.ownerKey === fid; });
        if (owned.length) {
          var wsum = 0;
          owned.forEach(function(b){ wsum += (b.pop > 0 ? b.pop : 1); });
          owned.forEach(function(b){
            var share = Math.round(soldiers * ((b.pop > 0 ? b.pop : 1) / wsum));
            if (share > 0) addTo(b.id, a, share, '·分驻');
          });
          return;
        }
      }
      // ④ 势力本部兜底：主力驻「游牧汗帐/诸部寨落」等无城名 → 势力名↔地块名匹配，或独块势力直绑
      if (!rid && a.faction) {
        rid = matchRegion(String(a.faction));
        if (!rid) {
          var fid2 = facIdByName[String(a.faction)] || '';
          var owned2 = books.filter(function(b){ return fid2 && b.ownerKey === fid2; });
          if (owned2.length === 1) rid = owned2[0].id;
        }
      }
      if (!rid) { unbound.push({ name: String(a.name || ''), garrison: garrisonText, soldiers: soldiers }); return; }
      addTo(rid, a, soldiers);
    });
    _armyRegionCache = { sig: sig, byRegion: byRegion, unboundCount: unbound.length, unbound: unbound };
    return _armyRegionCache;
  }
  function regionArmies(r){
    if (!r) return null;
    var idx = armyRegionIndex();
    return idx.byRegion[String(r.id || r.name || '')] || null;
  }

  function regionBundle(r){
    var base = Object.assign({}, (r && r.admin) || {}, (r && r.data) || {});
    var liveDivision = findLiveAdminDivision(r);
    var liveStats = findLiveProvinceStats(r);
    var data = assignKnown({}, base, liveDivision, liveStats);
    var liveOwner = liveRegionOwner(r, liveStats, liveDivision);
    if (hasValue(liveOwner)) {
      data.owner = liveOwner;
      data.factionName = liveOwner;
      data.ownerName = liveOwner;
    }
    var liveGovernor = firstValue(
      liveStats && liveStats.governor,
      liveStats && liveStats.governorName,
      liveStats && liveStats.currentGovernor,
      liveStats && liveStats.administrator,
      liveStats && liveStats.administratorName,
      liveStats && liveStats.localOfficial,
      liveStats && liveStats.official,
      liveStats && liveStats.currentOfficial,
      liveDivision && liveDivision.governor,
      liveDivision && liveDivision.governorName,
      liveDivision && liveDivision.currentGovernor,
      liveDivision && liveDivision.administrator,
      liveDivision && liveDivision.administratorName,
      liveDivision && liveDivision.localOfficial,
      liveDivision && liveDivision.official,
      liveDivision && liveDivision.currentOfficial
    );
    if (hasValue(liveGovernor)) {
      data.governor = liveGovernor;
      data.official = liveGovernor;
    }
    var liveOffice = firstValue(
      liveStats && liveStats.officialPosition,
      liveStats && liveStats.officialTitle,
      liveStats && liveStats.governorTitle,
      liveStats && liveStats.positionTitle,
      liveStats && liveStats.office,
      liveDivision && liveDivision.officialPosition,
      liveDivision && liveDivision.officialTitle,
      liveDivision && liveDivision.governorTitle,
      liveDivision && liveDivision.positionTitle,
      liveDivision && liveDivision.office
    );
    if (hasValue(liveOffice)) {
      data.officialPosition = liveOffice;
      data.office = liveOffice;
    }
    // ★主官绑定官职:按治理官职找在世持有人(权威·随任命/死亡而变)·剧本静态 governor(死字段)降为兜底。
    var _officePos = firstValue(data.officialPosition, liveOffice);
    var _liveGov = _officePos ? liveRegionGovernor(_officePos) : null;
    if (_liveGov) {
      data.governor = _liveGov.name; data.official = _liveGov.name;
      data.governorChar = _liveGov.name; data.governorVacant = false;
    } else {
      var _sg = firstValue(data.governor, data.official);
      var _sc = (hasValue(_sg) && typeof findCharByName === 'function') ? findCharByName(_sg) : null;
      if (_sc && (_sc.alive === false || _sc.dead === true)) { data.governor = ''; data.official = ''; data.governorVacant = true; }   // 静态主官已殁→出缺(死字段曾显死人)
      else if (!hasValue(_sg) && hasValue(_officePos)) { data.governorVacant = true; }                                                  // 有治理官职却无人→出缺
      else if (_sc) { data.governorChar = _sc.name; }                                                                                   // 静态主官在世(官职串格式异)→兜底保留+可取属性
    }
    var pop = assignKnown({},
      plainObject(base.populationDetail),
      plainObject(liveDivision && liveDivision.populationDetail),
      plainObject(liveStats && liveStats.populationDetail),
      plainObject(liveStats && liveStats.population)
    );
    if (hasValue(liveDivision && liveDivision.population) && typeof liveDivision.population !== 'object') pop.mouths = liveDivision.population;
    if (hasValue(liveStats && liveStats.population) && typeof liveStats.population !== 'object') pop.mouths = liveStats.population;
    if (hasValue(liveStats && liveStats.households)) pop.households = liveStats.households;
    [
      ['ding', 'ding', 'dingCount'],
      ['fugitives', 'fugitives', 'escapedHouseholds', 'escapedPopulation'],
      ['hiddenCount', 'hiddenCount', 'hiddenHouseholds', 'hiddenPopulation']
    ].forEach(function(row){
      var target = row[0];
      for (var i = 1; i < row.length; i += 1) {
        var key = row[i];
        var value = firstValue(liveStats && liveStats[key], liveDivision && liveDivision[key]);
        if (hasValue(value)) {
          pop[target] = value;
          break;
        }
      }
    });
    if (hasValue(pop.mouths)) data.population = pop.mouths;
    var fiscal = assignKnown({},
      plainObject(base.fiscalDetail),
      plainObject(liveDivision && liveDivision.fiscalDetail),
      plainObject(liveStats && liveStats.fiscalDetail)
    );
    // 收支四账（应征/实征/起运/留用）+实征率/产出 正值优先：live 的 0 是「cascade 未触账/旧版零写入存档」
    // 死缺省，不抹静态账。compliance 尤要：境外/边镇地块财赋分全靠它，live 0 盖掉静态即整片归零。
    var REVENUE_KEYS = { actualRevenue: 1, claimedRevenue: 1, remittedToCenter: 1, retainedBudget: 1, compliance: 1, moneyOutput: 1, grainOutput: 1 };
    [
      ['actualRevenue', 'taxRevenue', 'revenue', 'actualRevenue'],
      ['claimedRevenue', 'claimedRevenue', 'expectedRevenue'],
      ['remittedToCenter', 'remittedToCenter', 'remitToCenter'],
      ['retainedBudget', 'retainedBudget', 'retainedLocal'],
      ['compliance', 'compliance', 'taxCompliance'],
      ['skimmingRate', 'skimmingRate', 'corruptionSkimRate'],
      ['autonomy', 'fiscalAutonomy', 'autonomy'],
      ['taxBurden', 'taxBurden'],
      ['moneyOutput', 'moneyOutput', 'silverOutput', 'cashOutput'],
      ['grainOutput', 'grainOutput', 'grainTaxOutput']
    ].forEach(function(row){
      var target = row[0];
      for (var i = 1; i < row.length; i += 1) {
        var key = row[i];
        var value = firstValue(liveStats && liveStats[key], liveDivision && liveDivision[key]);
        if (REVENUE_KEYS[target] && hasValue(value) && !(Number(value) > 0)) continue; // 零值跳过·继续找
        if (hasValue(value)) {
          fiscal[target] = value;
          break;
        }
      }
    });
    // 同源对账：实征空/零而起运+留用有值（跨源混账残留），以起运+留用重建实征
    if (!(Number(fiscal.actualRevenue) > 0)) {
      var _rebuilt = (Number(fiscal.remittedToCenter) > 0 ? Number(fiscal.remittedToCenter) : 0) +
                     (Number(fiscal.retainedBudget) > 0 ? Number(fiscal.retainedBudget) : 0);
      if (_rebuilt > 0) fiscal.actualRevenue = _rebuilt;
    }
    if (hasValue(fiscal.actualRevenue)) data.taxRevenue = fiscal.actualRevenue;
    // P0-1(2026-06-20): 财政自主活账在 .fiscal.autonomyLevel(0-1·central-local/fiscal-engine 维护)·
    // 面板字段名 autonomy 仅从顶层取(:2230)取不到嵌套 autonomyLevel → 补接活账
    if (!(Number(fiscal.autonomy) > 0)) {
      var _autoLvl = firstValue(
        liveStats && liveStats.fiscal && liveStats.fiscal.autonomyLevel,
        liveDivision && liveDivision.fiscal && liveDivision.fiscal.autonomyLevel
      );
      if (hasValue(_autoLvl)) fiscal.autonomy = _autoLvl;
    }
    var treasury = assignKnown({},
      plainObject(base.publicTreasuryInit),
      plainObject(liveDivision && liveDivision.publicTreasuryInit),
      plainObject(liveStats && liveStats.publicTreasuryInit),
      plainObject(liveStats && liveStats.treasury)
    );
    ['money','silver','grain','cloth','horse'].forEach(function(k){
      var value = firstValue(liveStats && liveStats[k], liveDivision && liveDivision[k]);
      if (hasValue(value)) treasury[k] = value;
    });
    // P0-1(2026-06-20): 库藏布活账在 publicTreasury.cloth.stock(fiscal-engine cunliu 每回合写)·
    // 顶层 cloth 取不到(money/grain 由 military 写顶层 treasury·cloth 走 publicTreasury) → 补接活账
    if (!(Number(treasury.cloth) > 0)) {
      var _clothStock = firstValue(
        liveDivision && liveDivision.publicTreasury && liveDivision.publicTreasury.cloth && liveDivision.publicTreasury.cloth.stock,
        liveStats && liveStats.publicTreasury && liveStats.publicTreasury.cloth && liveStats.publicTreasury.cloth.stock
      );
      if (hasValue(_clothStock)) treasury.cloth = _clothStock;
    }
    var economy = assignKnown({},
      plainObject(base.economyBase),
      plainObject(liveDivision && liveDivision.economyBase),
      plainObject(liveStats && liveStats.economyBase)
    );
    [
      'farmland',
      'commerceVolume',
      'commerceCoefficient',
      'saltProduction',
      'mineralProduction',
      'horseProduction',
      'fishingProduction',
      'imperialFarmland',
      'postRelays',
      'roadQuality',
      'kejuQuota'
    ].forEach(function(k){
      var value = firstValue(liveStats && liveStats[k], liveDivision && liveDivision[k]);
      if (hasValue(value)) economy[k] = value;
    });
    if (hasValue(liveStats && liveStats.imperialAssets) || hasValue(liveDivision && liveDivision.imperialAssets)) {
      economy.imperialAssets = assignKnown({}, plainObject(economy.imperialAssets), plainObject(liveDivision && liveDivision.imperialAssets), plainObject(liveStats && liveStats.imperialAssets));
    }
    var army = assignKnown({},
      plainObject(base.armyDetail),
      plainObject(liveDivision && liveDivision.armyDetail),
      plainObject(liveStats && liveStats.armyDetail)
    );
    var liveDivisionArmy = plainObject(liveDivision && liveDivision.armyDetail);
    var liveStatsArmy = plainObject(liveStats && liveStats.armyDetail);
    // 驻军真账（2026-06-12 军地绑定）：第一优先 = GM.armies 按驻地聚合的活军；
    // 次之 live 字段取正值（provinceStats.soldiers=0 是死缺省·不抹静态）；全无正值保静态。
    var boundArmies = regionArmies(r);
    var troops = firstPositive(
      boundArmies && boundArmies.troops,
      liveStats && liveStats.soldiers, liveStats && liveStats.troops, liveStats && liveStats.garrison, liveStats && liveStats.strength,
      liveDivision && liveDivision.garrison, liveDivision && liveDivision.troops
    );
    if (troops !== null) {
      army.troops = troops;
      data.garrison = troops;
    }
    if (boundArmies && boundArmies.armies.length) {
      army.liveArmies = boundArmies.armies;
      army.liveArmyCount = boundArmies.armies.length;
    }
    var recruits = firstValue(
      recruitPoolValue(liveStats),
      recruitPoolValue(liveDivision),
      firstPositive(
        data.militaryRecruits,
        data.recruits,
        data.levyPool,
        data.militaryDetail && data.militaryDetail.availableRecruits,
        army.recruits,
        army.availableRecruits
      )
    );
    if (hasValue(recruits)) {
      army.recruits = recruits;
      data.militaryRecruits = recruits;
    }
    var regionCommander = firstValue(
      liveStatsArmy.commander,
      liveStatsArmy.commanderName,
      liveStatsArmy.general,
      liveStatsArmy.generalName,
      liveStatsArmy.commandingOfficer,
      liveStatsArmy.chiefCommander,
      liveStats && liveStats.commander,
      liveStats && liveStats.commanderName,
      liveStats && liveStats.general,
      liveStats && liveStats.generalName,
      liveStats && liveStats.commandingOfficer,
      liveStats && liveStats.chiefCommander,
      liveDivisionArmy.commander,
      liveDivisionArmy.commanderName,
      liveDivisionArmy.general,
      liveDivisionArmy.generalName,
      liveDivisionArmy.commandingOfficer,
      liveDivisionArmy.chiefCommander,
      liveDivision && liveDivision.commander,
      liveDivision && liveDivision.commanderName,
      liveDivision && liveDivision.general,
      liveDivision && liveDivision.generalName,
      army.commander,
      army.commanderName,
      army.general,
      army.generalName
    );
    if (hasValue(regionCommander)) {
      army.commander = regionCommander;
      data.commander = regionCommander;
    }
    var regionSupply = firstValue(
      liveStatsArmy.supply,
      liveStatsArmy.supplies,
      liveStatsArmy.supplyState,
      liveStats && liveStats.supply,
      liveStats && liveStats.supplies,
      liveStats && liveStats.supplyState,
      liveDivisionArmy.supply,
      liveDivisionArmy.supplies,
      liveDivisionArmy.supplyState,
      liveDivision && liveDivision.supply,
      liveDivision && liveDivision.supplies,
      liveDivision && liveDivision.supplyState,
      army.supply,
      army.supplies,
      army.supplyState
    );
    if (hasValue(regionSupply)) {
      army.supply = regionSupply;
      data.supply = regionSupply;
    }
    // 活态要素（2026-06-13 死字段修）：民心/吏治/繁荣/民变 优先取「活叶人口加权聚合」——
    // liveStats 对省级地块恒空（provinceStats 按府级叶键存）、liveDivision 是开局冻结的省节点，
    // 二者都读不到引擎逐回合更新的叶值；vitals 才是真实活账，置于 firstValue 首位。
    var vitals = liveRegionVitals(r, liveDivision);
    // P0-2(2026-06-20): 省级财赋四账=子叶 fiscalDetail 求和(vitals.fiscal·与叶级同源保证省=Σ府)。
    // 省节点自身 fiscalDetail 是开局静数·liveStats 省级恒空——仅父节点(有子区)覆盖,叶子保持自身账(P0-1)。
    var _isFiscalParent = liveDivision && (
      (liveDivision.children && liveDivision.children.length) ||
      (liveDivision.divisions && liveDivision.divisions.length)
    );
    if (_isFiscalParent && vitals.fiscal && vitals.fiscal.leaves > 0) {
      fiscal.claimedRevenue = vitals.fiscal.claimedRevenue;
      fiscal.actualRevenue = vitals.fiscal.actualRevenue;
      fiscal.remittedToCenter = vitals.fiscal.remittedToCenter;
      fiscal.retainedBudget = vitals.fiscal.retainedBudget;
      data.taxRevenue = vitals.fiscal.actualRevenue;
    }
    // P1-B3b·省级耕地=子府和(farmland 父覆盖·vitals 已 Σ叶·像 P0-2 fiscal·父节点用聚合值·叶级保持自身)·economy 是 :2291 clone·:2446 赋 data.economyBase
    if (_isFiscalParent && vitals.farmland > 0) economy.farmland = vitals.farmland;
    var minxin = firstValue(
      vitals.minxin,
      liveStats && liveStats.minxin, liveStats && liveStats.mood, liveStats && liveStats.stability,
      liveDivision && liveDivision.minxinLocal, liveDivision && liveDivision.minxin
    );
    if (hasValue(minxin)) { data.minxinLocal = minxin; data.minxin = minxin; }
    var prosperity = firstValue(
      vitals.prosperity,
      liveStats && liveStats.prosperity, liveStats && liveStats.wealth, liveStats && liveStats.development,
      liveDivision && liveDivision.prosperity, liveDivision && liveDivision.wealth
    );
    if (hasValue(prosperity)) data.prosperity = prosperity;
    var development = firstValue(liveStats && liveStats.development, liveDivision && liveDivision.development);
    if (hasValue(development)) data.development = development;
    var unrest = firstValue(
      vitals.unrest,
      liveStats && liveStats.unrest, liveStats && liveStats.revoltRisk,
      liveDivision && liveDivision.unrest, liveDivision && liveDivision.revoltRisk
    );
    if (hasValue(unrest)) data.unrest = unrest;
    var corruption = firstValue(
      vitals.corruption,
      liveStats && liveStats.corruption, liveStats && liveStats.corruptionLocal,
      liveDivision && liveDivision.corruptionLocal, liveDivision && liveDivision.corruption
    );
    if (hasValue(corruption)) {
      data.corruptionLocal = corruption;
      data.corruption = corruption;
    }
    data.liveVitals = vitals;
    data.populationDetail = pop;
    data.fiscalDetail = fiscal;
    data.publicTreasuryInit = treasury;
    data.economyBase = economy;
    data.armyDetail = army;
    return { data: data, pop: pop, fiscal: fiscal, treasury: treasury, army: army, liveStats: liveStats, liveDivision: liveDivision, vitals: vitals };
  }

  // ══════ §B popup 基础设施 + 方志/谱牒册页 UI（orig 2881-3893·body 0 改动）══════
  function ensureMapPpop(){
    var pop = document.getElementById('ppop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'ppop';
      document.body.appendChild(pop);
    }
    if (!pop.__phase8MapBound) {
      pop.__phase8MapBound = true;
      // 2026-06-12 册页委托：关闭(×)=真关闭·合册(—)=收成书脊·检签=滚卷·兴造=诏令建议库
      pop.addEventListener('click', function(e){
        var hit = function(sel){ return e.target && e.target.closest ? e.target.closest(sel) : null; };
        if (hit('[data-pp-close]')) { closeMapDossier(); return; }
        var fold = hit('[data-bk-fold]');
        if (fold) { pop.classList.toggle('bk-folded'); return; }
        if (hit('.bk-spine')) { pop.classList.remove('bk-folded'); return; }
        var jq = hit('[data-bk-jq]');
        if (jq) {
          var target = pop.querySelector('#' + jq.dataset.bkJq);
          if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        var desc = hit('[data-bk-desc]');
        if (desc) { desc.classList.toggle('open'); return; }
        var foldText = hit('[data-bk-fold-text]');
        if (foldText) {
          var box = foldText.closest('.bk-fold');
          if (box) {
            box.classList.toggle('open');
            foldText.textContent = box.classList.contains('open') ? '收 起 ▴' : '展 读 全 文 ▾';
          }
          return;
        }
        var build = hit('[data-bk-build]');
        if (build) {
          var divName = build.dataset.bkBuild || '';
          if (typeof window._dfBuildModal === 'function') window._dfBuildModal(divName);
          else if (typeof toast === 'function') toast('营造入口未就绪');
          return;
        }
        var openFac = hit('[data-bk-open-faction]');
        if (openFac) { openFactionDossier(openFac.dataset.bkOpenFaction || '', null); return; }
        var openReg = hit('[data-bk-open-region]');
        if (openReg) {
          var rr = findRegion(openReg.dataset.bkOpenRegion || '');
          if (rr) openRegionDossier(rr);
          else if (typeof toast === 'function') toast('舆图上未录此地');
          return;
        }
        var ledger = hit('[data-bk-ledger]');
        if (ledger) {
          var dn = ledger.dataset.bkLedger || '';
          if (typeof window.openDivisionDetail === 'function') window.openDivisionDetail(dn);
          return;
        }
      });
      // 活账因果签：hover 展示「此数牵动什么」
      pop.addEventListener('mouseover', function(e){
        var el = e.target && e.target.closest ? e.target.closest('[data-bk-cause]') : null;
        if (el) showBkCause(el);
      });
      pop.addEventListener('mouseout', function(e){
        var el = e.target && e.target.closest ? e.target.closest('[data-bk-cause]') : null;
        if (el) hideBkCause();
      });
      // 兴造录入诏令后：方志开着就重渲营造志（候诏卡即时可见）并滚到该卷
      document.addEventListener('tm-yingzao-submitted', function(e){
        var detail = (e && e.detail) || {};
        var p = document.getElementById('ppop');
        if (!p || p.dataset.panelKind !== 'region' || p.className.indexOf('show') < 0) return;
        var r = findRegion(p.dataset.regionId || '') || findRegion(detail.regionId || detail.divName || '');
        if (!r) return;
        openRegionDossier(r);
        setTimeout(function(){
          var y = document.getElementById('bk-yingzao');
          if (y && typeof y.scrollIntoView === 'function') y.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      });
    }
    return pop;
  }

  function markSelectedRegion(id){
    document.querySelectorAll('.tmf-region.selected').forEach(function(x){ x.classList.remove('selected'); });
    if (!id) return;
    var el = document.querySelector('.tmf-region[data-region-id="' + cssEscape(id) + '"]');
    if (el) el.classList.add('selected');
  }

  function closeMapDossier(){
    var old = document.getElementById('tmf-map-dossier');
    if (old) old.remove();
    var pop = document.getElementById('ppop');
    if (pop) {
      pop.classList.remove('show', 'region-panel', 'faction-panel');
      pop.removeAttribute('data-region-id');
      pop.removeAttribute('data-faction-key');
      pop.removeAttribute('data-panel-kind');
    }
    document.body.classList.remove('province-panel-open');
  }

  // ════════ 方志/谱牒册页（2026-06-12 重构）════════════════════════════
  // 替代 codex 版 760px 大板+7tab+重复 grid：左缘窄册页 392px·检签六卷连续滚动·
  // 可合册成书脊·×真关闭。数据与四视图计分同源(regionBundle/modeScore)，
  // 营造志读 division.buildings（建筑工役引擎），因果账签展示字段牵动链。
  function bkRow(k, v, tone, cause){
    if (!hasDisplayValue(v)) return '';
    var vs = ppValue(v);
    return '<div class="bk-lr"' + (cause ? ' data-bk-cause="' + attr(cause) + '"' : '') + '><span class="bk-k">' + esc(k) + '</span><span class="bk-v ' + (tone || '') + (vs.length > 14 ? ' wrap' : '') + '">' + esc(vs) + '</span></div>';
  }
  // 豪强势力数值条(读 provinceStats.magnatePower·tm-region-magnate 引擎):势力<20 不扰目,渐进定性。
  function _magnateLabel(ls){
    if (!ls || typeof ls.magnatePower !== 'number') return '';
    var mp = ls.magnatePower;
    if (mp < 20) return '';
    var label = mp >= 70 ? '势大难制' : mp >= 50 ? '坐大' : mp >= 35 ? '渐起' : '抬头';
    return Math.round(mp) + ' · ' + label + (ls._magnateCollusion ? ' · 勾结州县' : '');
  }
  function bkLan(rows, one){
    var html = rows.join('');
    return html ? '<div class="bk-lan' + (one ? ' one' : '') + '">' + html + '</div>' : '';
  }
  function bkJuan(id, no, title, hint, inner){
    if (!inner) return '';
    return '<section class="bk-juan" id="' + attr(id) + '"><div class="bk-jt"><span class="bk-jseal">' + esc(no) + '</span><b>' + esc(title) + '</b><small>' + esc(hint || '') + '</small></div>' + inner + '</section>';
  }
  function bkStat(k, v, note, warn, cause){
    if (!hasDisplayValue(v)) return '';
    return '<div class="bk-stat' + (warn ? ' warn' : '') + '"' + (cause ? ' data-bk-cause="' + attr(cause) + '"' : '') + '><span class="k">' + esc(k) + '</span><span class="v">' + esc(ppValue(v)) + '</span><span class="n">' + esc(note || '') + '</span></div>';
  }
  function bkStats(cards){
    var html = cards.filter(Boolean).join('');
    return html ? '<div class="bk-stats">' + html + '</div>' : '';
  }
  function bkWuGrid(rows){
    var html = rows.filter(rowHasDisplayValue).map(function(row){
      return '<div class="bk-wu"><span class="k">' + esc(row[0]) + '</span><span class="v">' + esc(ppValue(row[1])) + '</span></div>';
    }).join('');
    return html ? '<div class="bk-wu-grid">' + html + '</div>' : '';
  }
  function bkChips(rows){
    var html = rows.filter(rowHasDisplayValue).map(function(row){
      return '<span class="bk-chip"><b>' + esc(row[0]) + '</b>' + esc(ppValue(row[1])) + '</span>';
    }).join('');
    return html ? '<div class="bk-chips">' + html + '</div>' : '';
  }
  // 年龄结构 {young/ding/old:{count,ratio}} → "少壮 X / 丁壮 X / 老弱 X"(专用格式化·绕开泛型 dump·免 old 被误译"旧值"+count/ratio 吐原文)
  function fmtByAge(a){
    if (!a || typeof a !== 'object' || Array.isArray(a)) return a;
    var AGE = { infant: '婴孩', child: '幼弱', young: '少壮', ding: '丁壮', adult: '丁壮', old: '老弱', elder: '耆老' };
    var order = ['infant', 'child', 'young', 'ding', 'adult', 'old', 'elder'];
    var keys = order.filter(function(k){ return a[k] != null; });
    Object.keys(a).forEach(function(k){ if (keys.indexOf(k) < 0 && a[k] != null) keys.push(k); });
    var parts = [];
    keys.forEach(function(k){
      var g = a[k], cnt = (g && typeof g === 'object') ? g.count : g;
      if (cnt == null || cnt === '') return;
      parts.push((AGE[k] || fieldLabel(k)) + ' ' + mapNum(cnt));
    });
    return parts.length ? parts.join(' / ') : a;
  }
  // 聚落结构 {fang/shi/zhen:{mouths,households}} → "坊 X / 市 X / 镇 X"(专用格式化·免拼音键+口数重复)
  function fmtBySettlement(s){
    if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
    var SET = { fang: '坊', shi: '市', zhen: '镇', cun: '村', xiang: '乡', li: '里', du: '都', tun: '屯', bao: '堡', wei: '卫', suo: '所', cheng: '城', guan: '关' };
    var parts = [];
    Object.keys(s).forEach(function(k){
      var v = s[k], m = (v && typeof v === 'object') ? (v.mouths != null ? v.mouths : (v.population != null ? v.population : v.count)) : v;
      if (m == null || m === '') return;
      parts.push((SET[k] || fieldLabel(k)) + ' ' + mapNum(m));
    });
    return parts.length ? parts.join(' / ') : s;
  }
  function bkFold(text){
    if (!hasDisplayValue(text)) return '';
    return '<div class="bk-fold"><pre>' + esc(ppValue(text)) + '</pre><button type="button" class="bk-fold-btn" data-bk-fold-text="1">展 读 全 文 ▾</button></div>';
  }
  function bkBar(title, items, totalLabel){
    var sum = items.reduce(function(a, x){ return a + (Number(x[1]) || 0); }, 0);
    if (sum <= 0) return '';
    return '<div class="bk-bar-strip"><div class="bs-t"><span>' + esc(title) + '</span><span>' + esc(totalLabel || '') + '</span></div>' +
      '<div class="bk-bar">' + items.map(function(x){ return '<i style="width:' + ((Number(x[1]) || 0) / sum * 100) + '%;background:' + attr(x[2]) + '"></i>'; }).join('') + '</div>' +
      '<div class="bk-bar-legend">' + items.map(function(x){ return '<em style="--c:' + attr(x[2]) + '">' + esc(x[0]) + ' ' + esc(fmtNum(x[1])) + '</em>'; }).join('') + '</div></div>';
  }
  function bkHead(opts){
    return '<div class="bk-head">' +
      '<div class="bk-bigseal' + (opts.round ? ' round' : '') + '"><i>' + esc(opts.seal) + '</i></div>' +
      '<div class="bk-kind"><span class="bk-tag">' + esc(opts.kind) + '</span>' +
        '<button type="button" class="bk-close" data-bk-fold="1" title="合册成脊">—</button>' +
        '<button type="button" class="bk-close x" data-pp-close="1" title="关闭">×</button></div>' +
      '<div class="bk-title-row"><div class="bk-name">' + esc(opts.name) + '</div><div class="bk-name-sub">' + esc(opts.sub || '') + '</div></div>' +
      '<div class="bk-govline">' + opts.pills.filter(Boolean).join('') + '</div>' +
      (hasDisplayValue(opts.desc) ? '<p class="bk-desc" data-bk-desc="1">' + esc(ppValue(opts.desc)) + '</p>' : '') +
    '</div>';
  }
  function bkSpine(label){
    return '<div class="bk-spine"><div class="sp-seal">印</div><div class="sp-label">' + esc(label) + '<small>点 脊 展 册</small></div></div>';
  }
  function bkJianqian(items){
    return '<div class="bk-jianqian">' + items.map(function(it, i){
      return '<div class="bk-jq" data-bk-jq="' + attr(it[0]) + '"><span class="jq-no">' + '一二三四五六七八'.charAt(i) + '</span>' + esc(it[1]) + '</div>';
    }).join('') + '</div>';
  }
  var BK_TAB_JUAN = { mood: 'bk-hukou', classPressure: 'bk-hukou', tax: 'bk-caifu', army: 'bk-junbei', office: 'bk-zhiguan' };
  function bkScrollToTab(pop, tab){
    var id = BK_TAB_JUAN[tab];
    if (!id) return;
    var el = pop.querySelector('#' + id);
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ block: 'start' }); } catch(_) { el.scrollIntoView(); }
    }
  }
  var _bkSpy = null;
  function bindBkSpy(pop){
    if (_bkSpy) { try { _bkSpy.disconnect(); } catch(_) {} _bkSpy = null; }
    var scroll = pop.querySelector('.bk-scroll');
    if (!scroll || typeof IntersectionObserver !== 'function') return;
    _bkSpy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        pop.querySelectorAll('.bk-jq').forEach(function(x){ x.classList.toggle('active', x.dataset.bkJq === en.target.id); });
      });
    }, { root: scroll, rootMargin: '-8% 0px -78% 0px', threshold: 0 });
    scroll.querySelectorAll('.bk-juan').forEach(function(s){ _bkSpy.observe(s); });
    var first = pop.querySelector('.bk-jq');
    if (first) first.classList.add('active');
  }
  // ── 活账因果签：字段牵动链（动态拼当前账面值·非死文案） ──
  function bkCauseDef(key, r){
    var b = regionBundle(r);
    var data = b.data || {};
    var corr = firstValue(data.corruptionLocal, data.corruption);
    var skim = ratio01(b.fiscal.skimmingRate);
    var comp = ratio01(b.fiscal.compliance);
    var defs = {
      corr: { t: '贪腐 ' + ppValue(corr) + ' · 牵动', items: [
        ['截留', '贪腐推高税赋截留' + (skim !== null ? '——今截留 ' + Math.round(skim * 100) + '%' : '') + '，实征随减'],
        ['税基', '征税公式按贪腐打折（罚至五成为限）'],
        ['整饬', '肃贪诏令 / 换主官 / 派钦差可降之（走诏令）']] },
      minxin: { t: '民心 ' + ppValue(moodViewScore(r, b)) + ' · 牵动', items: [
        ['民变', '民变判级按各省民心，非全国均值——低于 50 入「忧」档'],
        ['逃户', '民心愈低逃户愈众' + (hasDisplayValue(b.pop.fugitives) ? '——今逃 ' + ppValue(b.pop.fugitives) : '') + '，税基随减'],
        ['回原', '民心由叶账聚合：税负、灾异、徭役、兵祸、贪腐皆摊入']] },
      tax: { t: '实征 ' + ppValue(b.fiscal.actualRevenue) + ' · 牵动', items: [
        ['央地', '实征按央地分成：起运入太仓，留用存地方库'],
        ['合规', (comp !== null ? '合规率 ' + Math.round(comp * 100) + '%——' : '') + '应征与实征之差即欠征'],
        ['加派', '强征可增实征，然民心叶账立扣——加派激变之鉴不远']] },
      army: { t: '驻军 ' + ppValue(firstValue(data.garrison, b.army.troops)) + ' · 牵动', items: [
        ['守御', '守城战力 = 驻军 × 城防档位乘成（围城结算实读）'],
        ['军压', '边警与驻军共定军压——高军压日耗粮饷'],
        ['抽调', '抽兵他调则本地守御立减，边警之地慎抽']] },
      pop: { t: '户口 ' + ppValue(firstValue(data.population, b.pop.mouths)) + ' · 牵动', items: [
        ['税基', '应征 = 田亩 × 税则 + 丁口 × 丁银——户口即税基'],
        ['兵源', '可募兵源按丁口折算'],
        ['逃隐', '逃户隐户不纳粮——清丈括户可收编（走诏令）']] },
      fugitive: { t: '逃户 ' + ppValue(b.pop.fugitives) + ' · 牵动', items: [
        ['税基', '逃户不纳粮——岁入随减'],
        ['民变', '流民为民变之薪'],
        ['安辑', '减赋、放赈、垦荒可招抚归籍（走诏令）']] },
      hidden: { t: '隐户 ' + ppValue(b.pop.hiddenCount) + ' · 牵动', items: [
        ['税基', '豪强荫庇之口，不在册——税基之漏'],
        ['清丈', '清丈括户可收编入册，然必触士绅之怒']] },
      ding: { t: '丁口 ' + ppValue(b.pop.ding) + ' · 牵动', items: [
        ['丁银', '丁口 × 丁银入应征'],
        ['徭役', '征发徭役按丁——大工役耗丁则民心叶账立扣'],
        ['兵源', '募兵上限按丁口折算']] },
      compliance: { t: '合规率 ' + (comp !== null ? Math.round(comp * 100) + '%' : '—') + ' · 牵动', items: [
        ['实征', '起运净额 = 起运毛额 × 合规率——央地财政真账之闸'],
        ['因由', '贪腐、士绅抗税、灾异共同压低'],
        ['提振', '清吏治 / 安民心 / 缓灾年皆走叶账']] },
      skim: { t: '截留 ' + (skim !== null ? Math.round(skim * 100) + '%' : '—') + ' · 牵动', items: [
        ['去向', '截留入贪腐之囊，不入太仓不入地方库'],
        ['根由', '与贪腐同涨同消——肃贪则截留自降']] },
      fort: { t: '城防 · 牵动', items: [
        ['守御', '守城战力按城防档位乘成（1-5 档 ×1.3 ～ ×3.0·围城结算实读）'],
        ['营造', '营造志修城墙 / 敌台可升档（走诏令工役）']] },
      vacancy: { t: '官缺 ' + ppValue(firstValue(data.officeVacancy, data.vacancy)) + ' · 牵动', items: [
        ['执行', '官缺愈多政令执行愈低——无官则政不行'],
        ['铨选', '吏部铨选 / 科举取士可补（走人事）']] },
      exec: { t: '政令执行 ' + ppValue(firstValue(data.policyExecution, data.execution)) + ' · 牵动', items: [
        ['诏效', '凡颁于此地之诏，效用按执行率打折'],
        ['因由', '官缺、贪腐、地方派系共同拖累']] },
      recruits: { t: '可募兵源 ' + ppValue(firstValue(data.militaryRecruits, b.army.recruits)) + ' · 牵动', items: [
        ['上限', '募兵不得过此数——强拉则民心叶账立扣'],
        ['营造', '卫所 / 军府类工役可增之']] },
      post: { t: '驿路 · 牵动', items: [
        ['政令', '驿密则政令时滞短——边报朝发夕至'],
        ['裁驿', '裁驿省银而驿卒失业——流民之源，前车可鉴']] },
      prosperity: { t: '繁荣 ' + ppValue(firstValue(data.prosperity, r && r.prosperity)) + ' · 牵动', items: [
        ['税基', '繁荣即税基之一——繁则岁入随长'],
        ['缓变', '每回合按民心、地方状态（奇观/灾异/营造之利）、兵燹缓变'],
        ['状态', '状态卷之效皆乘入此地岁入——奇观增之，灾异削之']] }
    };
    return defs[key] || null;
  }
  // S7 近账：因果签下半显示该字段最近变更（div._fieldLedger 环账·FieldPipes/BuildingWorks 记入）
  var BK_CAUSE_LEDGER_FIELD = { minxin: 'minxin', recruits: 'recruits', army: 'recruits', fort: 'fort', corr: 'corruption', prosperity: 'prosperity' };
  function bkCauseLedgerHtml(key, r){
    var field = BK_CAUSE_LEDGER_FIELD[key];
    if (!field) return '';
    var div = findLiveAdminDivision(r);
    var ring = div && div._fieldLedger && Array.isArray(div._fieldLedger[field]) ? div._fieldLedger[field] : null;
    if (!ring || !ring.length) return '';
    return ring.slice(-3).reverse().map(function(en){
      var d = Number(en.delta) || 0;
      return '<div class="cp-led-row"><span class="lt">回合 ' + esc(String(en.turn)) + '</span><span class="ld ' + (d < 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '+' : '') + esc(String(d)) + '</span><span class="lw">' + esc(en.why || '') + '</span></div>';
    }).join('');
  }
  function ensureBkCausePop(){
    var el = document.getElementById('tmf-bk-cause');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tmf-bk-cause';
      el.className = 'tmf-bk-cause';
      document.body.appendChild(el);
    }
    return el;
  }
  function showBkCause(el){
    var pop = document.getElementById('ppop');
    var rid = pop && pop.dataset.regionId;
    var r = rid ? findRegion(rid) : null;
    if (!r) return;
    var def = bkCauseDef(el.dataset.bkCause, r);
    if (!def) return;
    var host = ensureBkCausePop();
    var led = bkCauseLedgerHtml(el.dataset.bkCause, r);
    host.innerHTML = '<div class="cp-hd"><span class="cp-seal">牵</span><b>' + esc(def.t) + '</b></div>' +
      '<div class="cp-body">' + def.items.map(function(it){ return '<div class="cp-item"><span class="ck">' + esc(it[0]) + '</span><span class="cv">' + esc(it[1]) + '</span></div>'; }).join('') + '</div>' +
      (led ? '<div class="cp-led"><b>近 账</b>' + led + '</div>' : '') +
      '<div class="cp-ft">活账之义：此数每回合由叶账聚合而来，亦反向牵动他账。</div>';
    var rect = el.getBoundingClientRect();
    var x = rect.right + 12, y = rect.top - 6;
    if (x + 280 > window.innerWidth) x = rect.left - 286;
    if (y + 230 > window.innerHeight) y = window.innerHeight - 240;
    host.style.left = x + 'px';
    host.style.top = Math.max(52, y) + 'px';
    host.classList.add('show');
  }
  function hideBkCause(){
    var host = document.getElementById('tmf-bk-cause');
    if (host) host.classList.remove('show');
  }
  // ── 营造志卡（建筑工役引擎数据） ──
  function bkYeCard(bld, P){
    var bw = (window.TM && TM.BuildingWorks) || null;
    var typeDef = bw ? bw.typeDefFor(bld.name, P) : null;
    var labels = bw ? bw.fxLabels(bld, typeDef) : [];
    var doing = bld.status === 'building';
    var neglected = bld.status === 'neglected';
    var damaged = bld.status === 'damaged';   // S6·半损态
    var ledger = (bw && bw.buildingLedger && !doing && !bld._proposal) ? bw.buildingLedger(bld, typeDef) : null;   // S7·实入账(完工/半损卡显真贡献)
    var total = Number(bld.timeActual) || Number(typeDef && typeDef.buildTime) || Math.max(1, Number(bld.remainingTurns) || 1);
    var prog = doing ? Math.round(Math.max(0, Math.min(1, (total - (Number(bld.remainingTurns) || 0)) / total)) * 100) : 100;
    var stCls = doing ? 'doing' : (neglected ? 'ni' : (damaged ? 'ni' : 'done'));
    var stTxt = doing ? '工 役 中' : (neglected ? '失 修' : (damaged ? '半 损' : '完 好'));
    return '<div class="bk-ye' + (bld._proposal ? ' nijian' : '') + '">' +
      '<div class="ye-hd"><b>' + esc(bld.name) + '</b><span class="lv">' + (bld._proposal ? '候 诏' : esc((bld.isCustom ? '自拟 · ' : '') + (bld.level || 1) + ' 级')) + '</span><span class="st ' + stCls + '">' + (bld._proposal ? '候 诏' : stTxt) + '</span></div>' +
      (hasDisplayValue(bld.description) ? '<p>' + esc(compactText ? compactText(bld.description, 90) : String(bld.description).slice(0, 90)) + '</p>' : '') +
      (hasDisplayValue(bld.judgedEffects) && !labels.length ? '<p>' + esc(String(bld.judgedEffects).slice(0, 90)) + '</p>' : '') +
      (labels.length ? '<div class="fx">' + labels.map(function(x, i){ return '<em class="' + (i === labels.length - 1 && /维护/.test(x) ? 'cost' : '') + '">' + esc(x) + '</em>'; }).join('') + '</div>' : '') +
      // S7·营造可观测账：完工/半损卡显「实入账」(真为本地所添·非 per-level 规则) + 工成之利岁入
      (ledger && ledger.applied && ledger.applied.length ? '<div style="margin-top:4px;font-size:12px;color:#5a4a32;">实入账：' + esc(ledger.applied.join(' · ')) + (ledger.flowPct > 0 ? ' · 岁入 +' + ledger.flowPct + '%/回合' : '') + '</div>' : '') +
      (damaged ? '<div style="margin-top:3px;font-size:12px;color:#9a3a2a;">半损 · 效用减半 · 库银可支半费则葺治复完</div>' : '') +
      (doing ? '<div class="gq"><div class="gq-bar"><i style="width:' + prog + '%"></i></div><em>余 ' + esc(bld.remainingTurns) + ' 回合</em></div>' : '') +
      '</div>';
  }
  function bkYingzao(r, b){
    var live = b.liveDivision;
    var P = window.P || {};
    var divName = firstValue(live && live.name, r && r.name, r && r.title, '');
    var cards = [];
    var seenBuildCards = {};
    function buildCardKey(bld){
      if (!bld) return '';
      return String(bld.territory || bld._territory || divName || '') + '|' + String(bld.type || bld.name || '');
    }
    function pushBuildCard(bld){
      if (!bld) return;
      var k = buildCardKey(bld);
      if (k && seenBuildCards[k]) return;
      if (k) seenBuildCards[k] = true;
      cards.push(bkYeCard(bld, P));
    }
    if (live && Array.isArray(live.buildings) && live.buildings.length) {
      live.buildings.forEach(pushBuildCard);
    }
    if (typeof getTerritoryBuildingsCompat === 'function') {
      var compatNames = [];
      [divName, live && live.name, r && r.name, r && r.title, r && r.officialName].forEach(function(v){
        if (!hasDisplayValue(v)) return;
        v = String(v);
        if (compatNames.indexOf(v) < 0) compatNames.push(v);
      });
      compatNames.forEach(function(name){
        try { getTerritoryBuildingsCompat(name).forEach(pushBuildCard); } catch (_) {}
      });
    }
    // 诏令建议库中候颁的本地营造案（_dfBuildModal 推入·source='工程'）
    var gm = window.GM || {};
    (Array.isArray(gm._edictSuggestions) ? gm._edictSuggestions : []).forEach(function(s){
      if (s && !s.used && s.from === divName && String(s.source || '') === '工程') {
        cards.push(bkYeCard({ name: String(s.content || '营造案').slice(0, 24) + '…', _proposal: true, description: '已录入诏令建议库，候颁行后由有司核定费用、工期与效用。' }, P));
      }
    });
    var canBuild = !!live && hasDisplayValue(divName);
    var buildBtn = canBuild
      ? '<button type="button" class="bk-act zhu wide" data-bk-build="' + attr(divName) + '">⊕ 兴 造 · 录 入 诏 令</button>'
      : '';
    if (!cards.length && !buildBtn) return '';
    var note = !cards.length ? '<p class="bk-ye-empty">此地尚无在册工役——可兴造以厚其本。</p>' : '';
    return note + cards.join('') + buildBtn;
  }
  // ── 地块方志 ──
  function renderRegionBook(r){
    var b = regionBundle(r);
    var data = b.data || {};
    var econ = data.economyBase || {};
    var assets = econ.imperialAssets || {};
    var children = Array.isArray(data.children) ? data.children : [];
    var tagList = ppTagNames(data.tags);
    var oKey = ownerKey(r);
    var moodS = moodViewScore(r, b);
    var offS = officeViewScore(r, b);
    var corr = firstValue(data.corruptionLocal, data.corruption);
    var cp = classPressureForRegion(r);
    var cpHtml = (cp.count > 0 || Number(cp.score) > 0) ? bkLan([
      bkRow('阶层压力', hasDisplayValue(cp.score) ? cp.score + ' / 100' : '', Number(cp.score) >= 50 ? 'zhu' : ''),
      bkRow('牵动阶层', cp.classNames.join('、')),
      bkRow('最近近因', cp.reason)
    ], true) : '';
    var head = bkHead({
      seal: '御览', round: false, kind: '方 志',
      name: regionTitle(r), sub: regionLevel(r), desc: firstValue(data.description, r && r.description),
      pills: [
        hasDisplayValue(ownerName(r)) ? '<span class="bk-pill owner" data-bk-open-faction="' + attr(oKey) + '" title="展其谱牒"><span class="dot"></span>隶 <b>' + esc(ownerName(r)) + '</b></span>' : '',
        (function(){
          var op = esc(firstValue(data.officialPosition, '主官'));
          if (data.governorVacant) return '<span class="bk-pill" style="color:var(--vermillion-400,#c0563a);border-color:var(--vermillion-400,#c0563a);" title="该地治理官职出缺·待补任">' + op + ' <b>空缺·待补</b></span>';
          var gn = firstValue(data.governor, data.official);
          if (!hasDisplayValue(gn)) return '';
          var gc = (data.governorChar && typeof findCharByName === 'function') ? findCharByName(data.governorChar) : null;
          var adm = (gc && hasDisplayValue(gc.administration)) ? ' <span style="opacity:.65;font-size:0.92em;">政' + esc(gc.administration) + '</span>' : '';
          return '<span class="bk-pill" title="' + op + ' · 当任主官(绑官职持有人·随任免更新)">' + op + ' <b>' + esc(gn) + '</b>' + adm + '</span>';
        })(),
        hasDisplayValue(firstValue(data.terrain, r && r.terrain)) ? '<span class="bk-pill">' + esc(firstValue(data.terrain, r && r.terrain)) + '</span>' : '',
        hasDisplayValue(data.taxLevel) ? '<span class="bk-pill">税 <b>' + esc(data.taxLevel) + '</b></span>' : ''
      ]
    });
    var stats = bkStats([
      bkStat('户口', firstValue(data.population, b.pop.mouths), hasDisplayValue(b.pop.ding) ? '丁 ' + ppValue(b.pop.ding) : '', false, 'pop'),
      bkStat('实征', b.fiscal.actualRevenue, hasDisplayValue(b.fiscal.compliance) ? '合规 ' + pctValue(b.fiscal.compliance) : '', false, 'tax'),
      bkStat('驻军', firstValue(data.garrison, b.army.troops, r && r.troops), firstValue(data.armyPressure, ''), false, 'army'),
      bkStat('民心', hasDisplayValue(firstValue(data.minxinLocal, r && r.mood, data.prosperity)) ? moodS : '', (gradeOf('mood', moodS) || {}).mark || '', gradeIsWarn('mood', gradeOf('mood', moodS)), 'minxin'),
      bkStat('吏治', hasDisplayValue(corr) ? offS : '', (gradeOf('office', offS) || {}).mark || '', gradeIsWarn('office', gradeOf('office', offS)), 'corr')
    ]);
    var hukou = bkLan([
      bkRow('在册口数', firstValue(data.population, b.pop.mouths)),
      bkRow('在册户', b.pop.households),
      (function(){
        var rp = _reportedPop(r);
        if (rp && rp.ding != null && Number(rp.conceal) > 0 && hasDisplayValue(b.pop.ding)) {
          // 默认只看上报值（督抚据报·瞒报税基/隐户）·真丁口藏于聚光（hover 核验）——薛定谔奏报范式 pilot
          // 失真层S4收严(拍板①真值须揭)：失真层开且该地未揭真→hover 不再泄真丁口与瞒报%·只提示核查之途
          var cP = Math.round(Number(rp.conceal) * 100);
          var RVd = window.TM && TM.ReportedView;
          var _veiled = RVd && RVd.active(window.P || null) && !RVd.revealed('renli', 'region.' + String((r && (r.id || r.name)) || ''));
          var tt = _veiled
            ? '督抚奏报口径 · 真丁口须遣员核查、门生密报方得掀见'
            : '督抚奏报口径 · 真丁口 ' + ppValue(b.pop.ding) + '（约瞒报 ' + cP + '%·聚光核验）';
          return '<div class="bk-lr" data-bk-cause="ding" title="' + attr(tt) + '"><span class="bk-k">丁口 <small style="opacity:.65">据报</small></span><span class="bk-v">' + esc(ppValue(rp.ding)) + '</span></div>';
        }
        return bkRow('丁口', b.pop.ding, null, 'ding');
      })(),
      bkRow('逃户', b.pop.fugitives, 'zhu', 'fugitive'),
      bkRow('隐户', b.pop.hiddenCount, 'zhu', 'hidden'),
      bkRow('承载上限', data.carryingCapacity),
      bkRow('保甲', data.baojia),
      bkRow('繁荣', firstValue(data.prosperity, r && r.prosperity), null, 'prosperity'),
      (hasDisplayValue(data.wealth) && String(data.wealth) !== String(firstValue(data.prosperity, r && r.prosperity)) ? bkRow('财富', data.wealth) : ''),            // P2-2·异于繁荣才显(去重同值·保留异值·不盲删)
      (hasDisplayValue(data.development) && String(data.development) !== String(firstValue(data.prosperity, r && r.prosperity)) ? bkRow('发展', data.development) : ''),  // P2-2·同上
      bkRow('不稳', data.unrest, 'zhu')
    ]) + bkChips([
      ['性别', data.byGender], ['年龄', fmtByAge(data.byAge)], ['族群', data.byEthnicity],
      ['信仰', data.byFaith], ['聚落', fmtBySettlement(data.bySettlement)], ['宗教场所', data.religiousSites]
    ]) + cpHtml;
    var caifu = bkLan([
      bkRow('应征', b.fiscal.claimedRevenue),
      bkRow('实征', b.fiscal.actualRevenue, null, 'tax'),
      bkRow('起运中枢', b.fiscal.remittedToCenter),
      bkRow('留用地方', b.fiscal.retainedBudget),
      bkRow('合规率', pctValueIfPresent(b.fiscal.compliance), null, 'compliance'),
      bkRow('截留率', pctValueIfPresent(b.fiscal.skimmingRate), 'zhu', 'skim'),
      bkRow('财政自主', pctValueIfPresent(b.fiscal.autonomy)),
      bkRow('税负', firstValue(b.fiscal.taxBurden, data.taxBurden)),
      bkRow('税级', data.taxLevel),
      bkRow('库藏银', b.treasury.money),
      bkRow('库藏粮', b.treasury.grain),
      bkRow('库藏布', b.treasury.cloth),
      bkRow('本回合银产', b.fiscal.moneyOutput, 'jin'),
      bkRow('本回合粮产', b.fiscal.grainOutput, 'jin'),
      bkRow('豪强', _magnateLabel(b.liveStats), 'zhu', 'magnate')
    ]);
    var fortRow = (b.liveDivision && Number(b.liveDivision.fortLevel) > 0) || hasDisplayValue(b.army.fortification);  // P0-5(2026-06-20): 删 data.fortification(剧本死字段)触发,城防只认活档+armyDetail回落
    // 活军卡（军地绑定·2026-06-12）：GM.armies 驻此地者列于卷首——驻军数即其合计
    var liveArmyHtml = '';
    if (b.army.liveArmies && b.army.liveArmies.length) {
      liveArmyHtml = '<div class="bk-jun-list">' + b.army.liveArmies.slice(0, 8).map(function(a){
        var mor = Number(a.morale);
        return '<div class="bk-jun"><span class="j-ni"></span><b>' + esc(String(a.name || '无名之师')) + '</b>' +
          '<span class="j-n">' + esc(mapNum(Number(a.soldiers || a.size || a.strength) || 0)) + '</span>' +
          (hasDisplayValue(a.commander) ? '<span class="j-cmd">' + esc(shortText(a.commander, 10)) + '</span>' : '') +
          (isFinite(mor) ? '<span class="j-mor' + (mor < 45 ? ' low' : '') + '">气 ' + Math.round(mor) + '</span>' : '') +
          '</div>';
      }).join('') + (b.army.liveArmies.length > 8 ? '<div class="bk-jun-more">…另 ' + (b.army.liveArmies.length - 8) + ' 支</div>' : '') + '</div>';
    }
    var junbei = liveArmyHtml + bkLan([
      bkRow('驻军', firstValue(data.garrison, b.army.troops, r && r.troops), null, 'army'),
      liveArmyHtml ? bkRow('在驻之师', b.army.liveArmyCount + ' 支（驻军数即其合计）') : '',
      bkRow('可募兵源', firstValue(data.militaryRecruits, b.army.recruits), null, 'recruits'),
      bkRow('军压', firstValue(data.armyPressure, r && r.armyPressure), 'zhu'),
      bkRow('月军费', data.localMilitaryCost, null, 'army'),                                       // P1-A2b·本地养兵月耗(恒开·无值叶自动不渲染)
      bkRow('净留用', data.retainedNet, (Number(data.retainedNet) < 0 ? 'zhu' : null), 'army'),    // P1-A2b·养兵后净留用·赤字(军费吃穿地方留用)标红
      fortRow ? bkRow('城防', [(b.liveDivision && Number(b.liveDivision.fortLevel) > 0) ? b.liveDivision.fortLevel + ' 档' : '', b.army.fortification].filter(hasDisplayValue).map(ppValue).join(' · '), 'jin', 'fort') : '',  // P0-5: fortLevel 活档优先·删 data.fortification 死重复
      bkRow('主将', firstValue(b.army.liveArmies && b.army.liveArmies[0] && b.army.liveArmies[0].commander, data.commander, b.army.commander)),
      bkRow('边警', firstValue(data.borderRisk, data.warRisk), 'zhu'),
      bkRow('补给', firstValue(data.supply, b.army.supply)),
      bkRow('水师 / 海防', firstValue(data.navy, data.coastalDefense)),
      bkRow('威胁', data.threats, 'zhu'),
      bkRow('战略价值', data.strategicValue)
    ], true);
    var zhiguan = bkLan([
      bkRow('主官', data.governorVacant ? '空缺·待补' : firstValue(data.governor, data.official), data.governorVacant ? 'zhu' : ''),
      bkRow('官职', data.officialPosition),
      bkRow('官缺', firstValue(data.officeVacancy, data.vacancy), null, 'vacancy'),
      bkRow('贪腐', corr, 'zhu', 'corr'),
      bkRow('政令执行', firstValue(data.policyExecution, data.execution), null, 'exec'),
      bkRow('地方派系', firstValue(data.localFaction, data.party)),
      bkRow('士绅', data.leadingGentry),
      bkRow('书院', data.academies),
      bkRow('科举解额', econ.kejuQuota),
      bkRow('官府资产', econ.imperialAssets),
      bkRow('备注', firstValue(data.note, r && r.note))
    ]);
    var fengwu = bkWuGrid([
      ['耕地', econ.farmland], ['商贸', econ.commerceVolume], ['商系数', econ.commerceCoefficient],
      ['盐课', econ.saltProduction], ['矿课', econ.mineralProduction], ['马政', econ.horseProduction],
      ['渔课', econ.fishingProduction], ['皇庄', econ.imperialFarmland], ['海贸', econ.maritimeTradeVolume],
      ['织造', assets.zhizao], ['矿场', assets.kuangchang], ['御窑', assets.yuyao],
      ['驿站', econ.postRelays], ['道路', econ.roadQuality]
    ]) + bkLan([
      bkRow('地势', firstValue(data.terrain, r && r.terrain)),
      bkRow('特殊资源', firstValue(data.specialResources, r && r.resources)),
      bkRow('特殊文化', data.specialCulture),
      bkRow('商路', data.tradeRoutes),
      bkRow('驿路', hasDisplayValue(econ.postRelays) ? ppValue(econ.postRelays) + ' 处' : '', null, 'post'),
      bkRow('近期灾异', firstValue(data.recentDisasters, econ.disasterRecord), 'zhu'),
      bkRow('标签', tagList.length ? tagList.join('、') : ''),
      bkRow('法理归属', firstValue(data.dejureOwner, ownerName(r))),
      bkRow('核心 / 边缘', firstValue(data.coreStatus, data.borderStatus)),
      bkRow('归属历史', data.ownerHistory),
      bkRow('下辖子区', children.length ? children.map(function(x){ return ppValue(x.name || x.title || x); }).join('、') : '')
    ], true);
    var yingzao = bkYingzao(r, b);
    // 状态卷（2026-06-12）：奇观/灾异/圣裁/风云/营造之利——落在此地的持续境况（活账·乘进岁入）
    var zhuangkuang = '';
    var statusFx = (b.liveDivision && Array.isArray(b.liveDivision.statusEffects)) ? b.liveDivision.statusEffects.filter(Boolean) : [];
    if (statusFx.length) {
      var ZT_SEAL = { wonder: '观', disaster: '灾', player: '裁', event: '云', building: '营' };
      var _gmTurn = Number(window.GM && GM.turn) || 0;
      zhuangkuang = '<div class="bk-zt-list">' + statusFx.slice(0, 12).map(function(e){
        var chips = [];
        var ep = Number(e.econPct);
        if (isFinite(ep) && ep) chips.push('<em class="' + (ep > 0 ? 'pos' : 'neg') + '">岁入 ' + (ep > 0 ? '+' : '') + Math.round(ep * 100) + '%</em>');
        var mp = Number(e.minxinPerTurn);
        if (isFinite(mp) && mp) chips.push('<em class="' + (mp > 0 ? 'pos' : 'neg') + '">民心 ' + (mp > 0 ? '+' : '') + mp + '/回合</em>');
        var left = e.expiresTurn != null ? Math.max(0, Number(e.expiresTurn) - _gmTurn) : null;
        return '<div class="bk-zt ' + esc(String(e.kind || 'event')) + '">' +
          '<span class="zt-seal">' + esc(ZT_SEAL[e.kind] || '云') + '</span>' +
          '<div class="zt-body"><b>' + esc(String(e.name || '')) + '</b>' +
          (e.desc ? '<p>' + esc(String(e.desc)) + '</p>' : '') +
          (chips.length ? '<div class="zt-fx">' + chips.join('') + '</div>' : '') + '</div>' +
          '<span class="zt-term">' + (left === null ? '永 续' : '余 ' + left + ' 回合') + '</span>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="bk-zt-note">状态之效乘入本地岁入、逐回合作用民心——非摆设。</div>';
    }
    var foot = '<div class="bk-foot">' +
      (hasDisplayValue(ownerName(r)) ? '<button type="button" class="bk-act" data-bk-open-faction="' + attr(oKey) + '">展 势 力 谱</button>' : '') +
      ((b.liveDivision && typeof window.openDivisionDetail === 'function') ? '<button type="button" class="bk-act" data-bk-ledger="' + attr(firstValue(b.liveDivision.id, b.liveDivision.name, '')) + '">地 方 账 本</button>' : '') +
      '</div>';
    // 卷与检签同源：空卷不渲染、签也不挂（不留点了不动的死签）
    // 役政志（人力/徭役/农政层·R7-c）——仅已行役政（已种子）地域渲染·未种子不挂此卷
    var yizheng = '';
    (function(){
      var ld = (typeof findLiveAdminDivision === 'function') ? findLiveAdminDivision(r) : (b.liveDivision || null);
      if (!ld || !ld.renliSeed) return;
      var GMr = (window.GM && GM.renli && GM.renli.byRegion) ? GM.renli.byRegion : null;
      var rid = String(r.id || r.name || '');
      var rg = GMr ? (GMr[rid] || (r.name ? GMr[r.name] : null)) : null;
      var pd = ld.populationDetail || null;
      var alloc = pd && pd.alloc ? pd.alloc : null;
      var pol = rg && rg.levyPolicy ? rg.levyPolicy : null;
      yizheng = bkLan([
        bkRow('役负率', rg && hasDisplayValue(rg.corveeRate) ? Math.round(Number(rg.corveeRate) * 100) + '%' : '', (rg && Number(rg.corveeRate) > 0.35) ? 'zhu' : ''),
        bkRow('地力', rg ? rg.soil : ''),
        bkRow('水利', rg ? rg.waterworks : ''),
        bkRow('在耕田亩', rg ? rg.cultivatedLand : ''),
        bkRow('抛荒田亩', rg ? rg.fallowLand : '', 'zhu'),
        bkRow('本回合粮产', rg ? rg.grainOutput : '', 'jin'),
        bkRow('缺粮', rg ? rg.foodDeficit : '', 'zhu'),
        // 刀C·官报对照：督抚奏报口径（reported·可粉饰）vs 上列真值——瞒报显著则标红示警
        // 失真层S4翻转(拍板①)：失真层开且该地未揭→对照行升为主口径·不泄瞒报%与「实情见上」·揭后照旧对照
        (function(){
          var rep = (window.GM && GM.renli && GM.renli.reported) ? (GM.renli.reported[rid] || (r.name ? GM.renli.reported[r.name] : null)) : null;
          if (!rep) return '';
          var cz = Number(rep.conceal) || 0;
          var RVy = window.TM && TM.ReportedView;
          var _veiledY = RVy && RVy.active(window.P || null) && !RVy.revealed('renli', 'region.' + String(rid || (r && r.name) || ''));
          if (_veiledY) {
            return bkRow('督抚奏报', '役负' + Math.round((Number(rep.corveeRate)||0)*100) + '% · 抛荒' + Math.round((Number(rep.fallowShare)||0)*100) + '%　〔诸数皆有司口径·实情须遣员核查〕', '');
          }
          return bkRow('督抚奏报', '役负' + Math.round((Number(rep.corveeRate)||0)*100) + '% · 抛荒' + Math.round((Number(rep.fallowShare)||0)*100) + '%' + (cz > 0.12 ? ('　〔瞒报~' + Math.round(cz*100) + '%·实情见上〕') : '　〔与实情相符〕'), cz > 0.12 ? 'zhu' : '');
        })(),
        alloc ? bkRow('丁分配', '务农 ' + ppValue(alloc.farm) + ' · 应役 ' + ppValue(alloc.corvee) + ' · 应征 ' + ppValue(alloc.draft) + ' · 优免 ' + ppValue(alloc.exempt)) : '',
        pd ? bkRow('册载丁', pd.registeredDing) : '',
        pd ? bkRow('优免丁', pd.exemptDing, 'zhu') : '',
        pd ? bkRow('诡寄丁', pd.commendedDing, 'zhu') : '',
        bkRow('逃户', b.pop.fugitives, 'zhu', 'fugitive'),
        bkRow('隐户', b.pop.hiddenCount, 'zhu', 'hidden'),
        pol ? bkRow('现行则例', String(pol.strength || 'normal') + (Number(pol.remitTurns) > 0 ? ' · 蠲免余 ' + pol.remitTurns + ' 回合' : '')) : ''
      ], true);
    })();
    var juans = [
      ['bk-hukou', '一', '户口志', '黄册口算', '户', hukou],
      ['bk-yizheng', '二', '役政志', '徭役农政 · 丁田', '役', yizheng],
      ['bk-caifu', '三', '财赋志', '岁入库藏', '赋', caifu],
      ['bk-junbei', '四', '军备志', '戎政边防', '军', junbei],
      ['bk-zhiguan', '五', '职官志', '官守治理', '官', zhiguan],
      ['bk-fengwu', '六', '风物志', '物产设施', '物', fengwu],
      ['bk-yingzao', '七', '营造志', '已建之业 · 工役', '营', yingzao],
      ['bk-zhuangkuang', '八', '状态', '奇观灾异风云圣裁', '况', zhuangkuang]
    ];
    var live = juans.filter(function(j){ return !!j[5]; });
    return bkSpine(regionTitle(r) + ' · 方志') +
      '<div class="bk-inner">' + head + stats +
      '<div class="bk-scroll">' +
        live.map(function(j){ return bkJuan(j[0], j[1], j[2], j[3], j[5]); }).join('') +
      '</div>' + foot + '</div>' +
      bkJianqian(live.map(function(j){ return [j[0], j[4]]; })) +
      '<div class="bk-straddle"><i>验讫</i></div>';
  }
  function openRegionDossier(r){
    if (!r) return;
    var id = String(r.id || r.name || r.title || '');
    state.mapPanelTab = MAP_MODE_META[state.mapPanelTab] ? state.mapPanelTab : 'overview';
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'region';
    pop.dataset.regionId = id;
    pop.removeAttribute('data-faction-key');
    pop.className = 'tmf-map-ppop tmf-book region-panel show';
    pop.innerHTML = renderRegionBook(r);
    document.body.classList.add('province-panel-open');
    markSelectedRegion(id);
    bindBkSpy(pop);
    bkScrollToTab(pop, state.mapPanelTab);
  }

  function sumFactionValues(regions, pick){
    return regions.reduce(function(sum, r){
      var value = Number(pick(regionBundle(r), r));
      return sum + (isFinite(value) ? value : 0);
    }, 0);
  }

  function factionRegionTokens(r){
    var b = regionBundle(r);
    return factionTokens(null, ownerKey(r), firstValue(b.data.factionName, b.data.ownerName, b.data.dejureOwner, r && r.factionName, r && r.ownerName));
  }

  function factionOwnsRegion(r, key, f){
    var ft = factionTokens(f, key, f && (f.label || f.name || f.scenarioFactionName));
    var rt = factionRegionTokens(r);
    return rt.some(function(x){ return ft.indexOf(x) >= 0; });
  }

  function factionControlledRegions(key, f){
    var map = getMapData() || {};
    return (map.regions || []).filter(function(r){ return factionOwnsRegion(r, key, f); });
  }

  function avgFactionValue(regions, pick){
    var vals = regions.map(function(r){ return Number(pick(regionBundle(r), r)); }).filter(function(n){ return isFinite(n); });
    if (!vals.length) return '';
    return Math.round(vals.reduce(function(a, b){ return a + b; }, 0) / vals.length);
  }

  function factionIndexEntry(f, key){
    var api = window.TM && TM.FactionIndex;
    if (!api || typeof api.getOrRebuild !== 'function') return null;
    var names = [];
    function add(v){
      if (v === undefined || v === null || v === '') return;
      var s = String(v);
      if (names.indexOf(s) < 0) names.push(s);
    }
    add(f && f.name);
    add(f && f.label);
    add(f && f.scenarioFactionName);
    add(f && f.runtimeFactionId);
    add(f && f.stableOwnerKey);
    add(f && f.mapFactionId);
    add(key);
    for (var i = 0; i < names.length; i += 1) {
      try {
        var entry = api.getOrRebuild(names[i]);
        if (entry) return entry;
      } catch (_) {}
    }
    return null;
  }

  function runtimeFactionValue(f, key){
    var live = f && f._runtimeFaction;
    return live && hasValue(live[key]) ? live[key] : undefined;
  }

  function factionProfile(f, key, region){
    f = f || {};
    key = key || f.stableOwnerKey || f.mapFactionId || f.id || '';
    var regions = factionControlledRegions(key, f);
    var sample = region || regions[0] || null;
    var pop = sumFactionValues(regions, function(b, r){ return firstValue(b.data.population, b.pop.mouths, r && r.population, 0); });
    var revenue = sumFactionValues(regions, function(b){ return firstValue(b.fiscal.actualRevenue, 0); });
    var grain = sumFactionValues(regions, function(b){ return firstValue(b.treasury.grain, 0); });
    var indexEntry = factionIndexEntry(f, key);
    var indexMetrics = (indexEntry && indexEntry.metrics) || {};
    var indexedTroops = Number(indexMetrics.totalSoldiers);
    var regionTroops = sumFactionValues(regions, function(b, r){ return firstValue(b.data.garrison, b.army.troops, r && r.troops, 0); });
    var troops = firstValue(indexMetrics.armyCount > 0 && isFinite(indexedTroops) ? indexedTroops : '', regionTroops || '', f.militaryStrength, f.strength);
    var avgMood = avgFactionValue(regions, function(b, r){ return firstValue(b.data.minxinLocal, r && r.mood); });
    var avgCorr = avgFactionValue(regions, function(b){ return firstValue(b.data.corruptionLocal, b.data.corruption); });
    var threats = [];
    var resources = [];
    regions.forEach(function(r){
      var b = regionBundle(r);
      [b.data.threats, b.data.tradeRoutes].forEach(function(v){
        if (Array.isArray(v)) v.forEach(function(x){ if (x && threats.indexOf(x) < 0) threats.push(x); });
        else if (v && threats.indexOf(v) < 0) threats.push(v);
      });
      [b.data.specialResources, r && r.resources].forEach(function(v){
        if (Array.isArray(v)) v.forEach(function(x){ if (x && resources.indexOf(x) < 0) resources.push(x); });
        else if (v && resources.indexOf(v) < 0) resources.push(v);
      });
    });
    return { f: f, key: key, regions: regions, sample: sample, pop: pop, revenue: revenue, grain: grain, troops: troops, avgMood: avgMood, avgCorr: avgCorr, threats: threats, resources: resources, indexEntry: indexEntry, indexMetrics: indexMetrics };
  }

  function factionFinanceValue(f, p){
    return firstValue(runtimeFactionValue(f, 'economy'), runtimeFactionValue(f, 'wealth'), p.regions.length ? p.revenue : '', f.economy, f.wealth);
  }

  function factionTreasuryValue(f, p){
    return firstValue(runtimeFactionValue(f, 'treasury'), p.regions.length ? p.revenue : '', f.treasury);
  }

  // ── 势力谱牒 ──
  var BK_LEADERSHIP_LABEL = { ruler: '君主', regent: '摄政', general: '主将', chancellor: '宰辅', spy: '耳目', heir: '继嗣' };
  // 剧本数据里常见的英文枚举值 → 中文（只译整 token·按「·」分段各自比对·不破坏混排中文）
  var BK_ENUM_CN = {
    heavy_from_land: '重赋于田', light_touch: '轻徭薄赋', restricted: '有禁', open: '开放',
    silver_standard: '银本位', coin_standard: '钱法', barter: '以物易物',
    primogeniture: '嫡长承袭', election: '推举', tanistry: '幼子守灶', merit: '择贤',
    declining: '渐衰', rising: '方兴', stable: '安稳', tribute_conquest: '贡赋掳掠',
    corvee: '力役', imperial: '宗室', noble: '勋贵', gentry: '士绅', commoner: '庶民'
  };
  function bkEnumText(v){
    var s = ppValue(v, '');
    if (!s || !/[a-z_]/i.test(s)) return s;
    return s.split('·').map(function(seg){
      var t = seg.trim();
      return BK_ENUM_CN[t] || seg;
    }).join('·');
  }
  // {键: 数值} → 评分徽签条（负值/低值朱显）
  function bkScoreChips(title, obj, warnBelow){
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
    var keys = Object.keys(obj).filter(function(k){ return isFinite(Number(obj[k])); });
    if (!keys.length) return '';
    var lim = (warnBelow === undefined) ? 0 : warnBelow;
    return '<div class="bk-lr"><span class="bk-k">' + esc(title) + '</span><span class="bk-v wrap"><span class="bk-score-chips">' +
      keys.map(function(k){
        var n = Number(obj[k]);
        return '<em class="' + (n < lim ? 'neg' : '') + '">' + esc(fieldLabel(k)) + ' <b>' + esc(mapNum(n)) + '</b></em>';
      }).join('') + '</span></span></div>';
  }
  // 势力级 relations {名: 亲疏分} → 邦交印泥条（≥50 盟 · <0 敌 · 余 中）
  function bkRelationRows(relations){
    if (!relations || typeof relations !== 'object' || Array.isArray(relations)) return [];
    return Object.keys(relations).filter(function(k){ return isFinite(Number(relations[k])); }).map(function(k){
      var n = Number(relations[k]);
      return bkBangRow(k, n >= 50 ? 'meng' : (n < 0 ? 'di' : 'zhong'), '亲疏 ' + n);
    });
  }
  // historicalEvents [{event, impact}] → 年表行
  function bkEventLines(arr){
    if (!Array.isArray(arr) || !arr.length) return '';
    return arr.map(function(e){
      if (!e || typeof e !== 'object') return ppValue(e, '');
      var ev = firstValue(e.event, e.name, '');
      var im = firstValue(e.impact, e.note, '');
      return ev ? (ev + (im ? '——' + im : '')) : '';
    }).filter(Boolean).join('\n');
  }
  // offendThresholds [{score, description, consequences[]}] → 阈值行
  function bkThresholdLines(arr){
    if (!Array.isArray(arr)) return ppValue(arr, '');
    return arr.map(function(t){
      if (!t || typeof t !== 'object') return ppValue(t, '');
      var head = (isFinite(Number(t.score)) ? '至 ' + t.score + '：' : '') + firstValue(t.description, t.desc, '');
      var cons = Array.isArray(t.consequences) ? t.consequences.join('·') : ppValue(t.consequences, '');
      return head + (cons && cons !== '未记' ? '（' + cons + '）' : '');
    }).filter(Boolean).join('\n');
  }
  function bkRenCard(title, person, main, emptyName){
    if (!hasDisplayValue(person)) return '';
    var isObj = person && typeof person === 'object';
    var name = isObj ? firstValue(person.name, person.ruler, person.general, person.chancellor) : person;
    if (isObj && !hasDisplayValue(name)) {
      // 空名对象（如储位未定的 heirInfo）——有小传则以虚位示之·否则整卡不出
      if (!hasDisplayValue(person.bio)) return '';
      name = emptyName || '（虚位）';
    }
    var meta = isObj ? [person.title, person.role, person.age ? ppValue(person.age) + ' 岁' : '', person.personality].filter(hasDisplayValue).map(ppValue).join(' / ') : '';
    if (isObj && hasDisplayValue(person.bio)) meta = meta ? meta + ' · ' + ppValue(person.bio) : ppValue(person.bio);
    var label = title ? title + ' · ' : '';
    return '<div class="bk-ren' + (main ? ' main' : '') + '"><div class="r-seal">' + esc(String(ppValue(name)).replace(/[\s（）()]/g, '').slice(0, 1)) + '</div><div class="r-body"><b>' + esc(label + ppValue(name)) + '</b><span>' + esc(shortText(meta, 46)) + '</span></div></div>';
  }
  function bkBangRow(name, rel, note){
    if (!hasDisplayValue(name)) return '';
    var relCls = rel === 'di' ? 'di' : (rel === 'meng' ? 'meng' : 'zhong');
    var relTxt = rel === 'di' ? '敌 对' : (rel === 'meng' ? '盟 好' : '中 立');
    return '<div class="bk-bang"><span class="b-ni ' + relCls + '"></span><b>' + esc(ppValue(name)) + '</b><span class="b-rel ' + relCls + '">' + relTxt + '</span><span class="b-note">' + esc(ppValue(note || '')) + '</span></div>';
  }
  function bkBangList(f){
    var rows = [];
    function many(v, rel){
      if (!hasDisplayValue(v)) return;
      if (Array.isArray(v)) v.forEach(function(x){ rows.push(bkBangRow(typeof x === 'object' ? firstValue(x.name, ppValue(x)) : x, rel, typeof x === 'object' ? firstValue(x.note, x.attitude, '') : '')); });
      else rows.push(bkBangRow(ppValue(v), rel, ''));
    }
    many(f.allies, 'meng');
    many(f.enemies, 'di');
    many(f.neutrals, 'zhong');
    // 势力级 relations {名: 亲疏分} → 同列印泥条·不再流水 dump
    var relRows = bkRelationRows(f.relations);
    relRows.forEach(function(x){ rows.push(x); });
    var html = rows.filter(Boolean).join('');
    var attitudeObj = f.attitude && typeof f.attitude === 'object' ? f.attitude : null;
    var spies = f.knownSpies && typeof f.knownSpies === 'object' && !Array.isArray(f.knownSpies) ? f.knownSpies : null;
    var thLines = Array.isArray(f.offendThresholds) ? bkThresholdLines(f.offendThresholds) : '';
    var extra = bkLan([
      relRows.length ? '' : bkRow('关系', f.relations),
      attitudeObj ? bkRow('自居', attitudeObj.self) : bkRow('态度', firstValue(f.attitudeDetail, f.attitude)),
      attitudeObj ? bkRow('所敌', attitudeObj.enemies, 'zhu') : '',
      attitudeObj ? bkRow('所盟', attitudeObj.allies) : '',
      attitudeObj ? bkRow('所持中立', attitudeObj.neutrals) : '',
      bkRow('与本朝', f.playerRelation),
      thLines ? '' : bkRow('冒犯阈值', f.offendThresholds),
      bkRow('内部派系', f.internalParties),
      bkRow('党派关系', f.partyRelations),
      spies ? bkRow('已知耳目', Object.keys(spies).filter(function(k){ return isFinite(Number(spies[k])); }).map(function(k){ return fieldLabel(k) + ' ' + spies[k]; }).join(' · ')) : bkRow('已知耳目', f.knownSpies)
    ], true);
    var thHtml = thLines ? '<div class="bk-lan one"><div class="bk-lr"><span class="bk-k">冒犯阈值</span><span class="bk-v wrap zhu">' + esc(thLines).replace(/\n/g, '<br>') + '</span></div></div>' : '';
    return (html ? '<div class="bk-bang-list">' + html + '</div>' : '') + extra + thHtml;
  }
  function renderFactionBook(f, key, r){
    var p = factionProfile(f, key, r);
    var name = firstValue(f.label, f.name, f.scenarioFactionName, r && ownerName(r), key, '未名势力');
    var attitudeObj = f.attitude && typeof f.attitude === 'object' ? f.attitude : null;
    var attitudeText = firstValue(attitudeObj ? attitudeObj.self : f.attitude, f.playerRelation);
    var head = bkHead({
      seal: shortText(f.short || name, 2) + '印', round: true, kind: '谱 牒',
      name: name, sub: firstValue(f.type, f.factionType, '势力'), desc: firstValue(f.description, f.desc, f.note),
      pills: [
        hasDisplayValue(firstValue(f.leader, f.leaderName, f.ruler)) ? '<span class="bk-pill">' + esc(firstValue(f.leaderTitle, '首领')) + ' <b>' + esc(firstValue(f.leader, f.leaderName, f.ruler)) + '</b></span>' : '',
        hasDisplayValue(firstValue(f.capital, f.home)) ? '<span class="bk-pill">都 <b>' + esc(firstValue(f.capital, f.home)) + '</b></span>' : '',
        hasDisplayValue(attitudeText) ? '<span class="bk-pill' + (/敌/.test(String(attitudeText)) ? ' hostile' : '') + '">' + esc(shortText(attitudeText, 10)) + '</span>' : '',
        hasDisplayValue(firstValue(f.government, f.ideology)) ? '<span class="bk-pill">' + esc(shortText(firstValue(f.government, f.ideology), 10)) + '</span>' : ''
      ]
    });
    var stats = bkStats([
      bkStat('领地', p.regions.length ? p.regions.length + ' 块' : '', p.regions.slice(0, 2).map(regionTitle).join('、')),
      bkStat('总兵', firstValue(p.troops, runtimeFactionValue(f, 'militaryStrength'), f.militaryStrength), '势力/地块聚合'),
      bkStat('户口', firstValue(p.regions.length ? p.pop : '', runtimeFactionValue(f, 'population'), f.population), '所辖合计'),
      bkStat('实收', p.regions.length ? p.revenue : factionFinanceValue(f, p), '财赋'),
      bkStat('民心', p.avgMood, '所辖均值', isFinite(Number(p.avgMood)) && Number(p.avgMood) < 50)
    ]);
    var junchen = '';
    var renCards = [];
    renCards.push(bkRenCard(firstValue(f.leaderTitle, '首领'), firstValue(f.leaderInfo, f.leader, f.leaderName, f.ruler), true));
    renCards.push(bkRenCard('继嗣', firstValue(f.heirInfo, f.heir), false, '储位未定'));
    if (f.leadership && typeof f.leadership === 'object') {
      Object.keys(f.leadership).slice(0, 6).forEach(function(k){
        if (k === 'ruler' && renCards[0]) return;
        renCards.push(bkRenCard(BK_LEADERSHIP_LABEL[k] || k, f.leadership[k]));
      });
    }
    var renHtml = renCards.filter(Boolean).join('');
    // 运行时 members = FactionIndex 派生 {chars, armies, provinces, parties, summary}——只取人物名册
    var memberChars = f.members && typeof f.members === 'object' && Array.isArray(f.members.chars) ? f.members.chars : (Array.isArray(f.members) ? f.members : null);
    var memberNames = memberChars ? memberChars.map(function(c){ return typeof c === 'object' ? firstValue(c && c.name, '') : c; }).filter(hasDisplayValue) : [];
    var memberText = memberNames.length ? '共 ' + memberNames.length + ' 人：' + shortText(memberNames.join('、'), 56) : (memberChars ? '' : (hasDisplayValue(f.members) ? shortText(ppValue(f.members), 60) : ''));
    junchen = (renHtml ? '<div class="bk-ren-row">' + renHtml + '</div>' : '') + bkLan([
      bkRow('在册人物', memberText),
      bkRow('政体', firstValue(f.government, f.type)),
      bkRow('战略目标', firstValue(f.goal, f.strategy)),
      bkRow('意识形态', firstValue(f.ideology, f.mainstream)),
      bkRow('文化', f.culture),
      bkScoreChips('凝聚', f.cohesion, 50) || bkRow('凝聚', f.cohesion),
      bkRow('开局问题', f.openingProblems)
    ], true);
    var bantu = (p.regions.length ? '<div class="bk-qian-links">' + p.regions.map(function(rg){
      return '<button type="button" class="bk-qian" data-bk-open-region="' + attr(rg.id || rg.name || rg.title || '') + '">' + esc(regionTitle(rg)) + '</button>';
    }).join('') + '</div>' : '') + bkLan([
      bkRow('剧本领土', f.territory),
      bkRow('资源', firstValue(f.resources, f.mainResources, p.resources.length ? p.resources.join('、') : '')),
      bkRow('威胁 / 商路', p.threats.length ? p.threats.join('、') : '')
    ], true);
    var mb = f.militaryBreakdown && typeof f.militaryBreakdown === 'object' ? f.militaryBreakdown : null;
    var ws = f.warState && typeof f.warState === 'object' && !Array.isArray(f.warState) ? f.warState : null;
    var MB_LABEL = { elite: '精锐', standingArmy: '常备', militia: '民兵', fleet: '水师' };
    var MB_COLOR = { elite: '#8e6aa8', standingArmy: '#a8833a', militia: '#7d6a48', fleet: '#4a5e8a' };
    var junlue = (mb ? bkBar('兵力构成', Object.keys(mb).filter(function(k){ return Number(mb[k]) > 0; }).map(function(k){
      return [MB_LABEL[k] || k, Number(mb[k]) || 0, MB_COLOR[k] || '#9d5b4b'];
    }), '总 ' + fmtNum(Object.keys(mb).reduce(function(a, k){ return a + (Number(mb[k]) || 0); }, 0))) : '') + bkLan([
      bkRow('总兵力', firstValue(p.troops, runtimeFactionValue(f, 'militaryStrength'), f.militaryStrength)),
      mb ? '' : bkRow('军力构成', f.militaryBreakdown),
      ws ? bkRow('现战', ws.active, 'zhu') : bkRow('战争状态', f.warState, 'zhu'),
      ws ? bkRow('将起', ws.pending) : '',
      ws ? bkRow('近役', ws.recent) : '',
      bkRow('动员', firstValue(f.mobilization, f.manpower)),
      bkRow('战略优先', f.strategicPriorities),
      bkRow('决策提示', firstValue(f.decisionHints, f.npcDecisionHints)),
      bkRow('禁忌动作', f.tabooMoves, 'zhu')
    ], true);
    var tre = f.treasury && typeof f.treasury === 'object' ? f.treasury : null;
    var ecoPol = f.economicPolicy && typeof f.economicPolicy === 'object' ? f.economicPolicy : null;
    var succ = f.succession && typeof f.succession === 'object' ? f.succession : null;
    var fpop = f.population && typeof f.population === 'object' ? f.population : null;
    var caiji = bkLan([
      bkRow('经济', factionFinanceValue(f, p)),
      bkRow('库藏银', tre ? tre.money : factionTreasuryValue(f, p)),
      bkRow('库藏粮', firstValue(tre && tre.grain, p.regions.length ? p.grain : '')),
      bkRow('库藏布', tre && tre.cloth),
      bkRow('战马', tre && tre.horses, 'jin'),
      bkRow('库藏注', tre && tre.note),
      fpop ? bkRow('编户 / 实口', [mapNum(fpop.registered), mapNum(fpop.actual)].filter(function(s){ return s && s !== '未记'; }).join(' / ')) : '',
      fpop && fpop.ethnicities ? bkScoreChips('族裔', fpop.ethnicities, -1) : '',
      bkScoreChips('经济结构', f.economicStructure, -1) || bkRow('经济结构', f.economicStructure),
      ecoPol ? bkRow('赋税之政', bkEnumText(ecoPol.taxation)) : bkRow('经济政策', f.economicPolicy),
      ecoPol ? bkRow('商贸之政', bkEnumText(ecoPol.trade)) : '',
      ecoPol ? bkRow('币制', bkEnumText(ecoPol.currency)) : '',
      ecoPol ? bkRow('役法', bkEnumText(ecoPol.labor)) : '',
      bkScoreChips('公共舆情', f.publicOpinion, 0) || bkRow('公共舆情', f.publicOpinion),
      bkScoreChips('技术', f.techLevel, 40) || bkRow('科技', f.techLevel),
      bkRow('文教', f.cultureLevel),
      succ ? bkRow('继承', [bkEnumText(succ.rule), hasDisplayValue(succ.designatedHeir) ? '储 ' + ppValue(succ.designatedHeir) : '储位未定', isFinite(Number(succ.stability)) ? '稳定 ' + succ.stability : ''].filter(Boolean).join(' · ')) : bkRow('继承', f.succession)
    ]);
    var youlie = '';
    var you = Array.isArray(f.strengths) ? f.strengths : (hasDisplayValue(f.strengths) ? [ppValue(f.strengths)] : []);
    var lie = Array.isArray(f.weaknesses) ? f.weaknesses : (hasDisplayValue(f.weaknesses) ? [ppValue(f.weaknesses)] : []);
    if (you.length || lie.length) {
      youlie = '<div class="bk-youlie">' +
        (you.length ? '<div class="yl you"><b>所 长</b>' + you.slice(0, 6).map(function(s){ return '<span>' + esc(ppValue(s)) + '</span>'; }).join('') + '</div>' : '') +
        (lie.length ? '<div class="yl lie"><b>所 短</b>' + lie.slice(0, 6).map(function(s){ return '<span>' + esc(ppValue(s)) + '</span>'; }).join('') + '</div>' : '') +
        '</div>';
    }
    var shilueText = [
      hasDisplayValue(f.strategy) ? '【大略】' + ppValue(f.strategy) : '',
      hasDisplayValue(f.longTermStrategy) ? '【长策】' + ppValue(f.longTermStrategy) : '',
      hasDisplayValue(f.history) ? '【国史】' + ppValue(f.history) : '',
      hasDisplayValue(f.historicalEvents) ? '【年表】\n' + (bkEventLines(f.historicalEvents) || ppValue(f.historicalEvents)) : '',
      hasDisplayValue(f.aiProfile) ? '【画像】' + ppValue(f.aiProfile) : '',
      hasDisplayValue(f.victoryConditions) ? '【胜局】' + ppValue(f.victoryConditions) : '',
      hasDisplayValue(f.defeatConditions) ? '【败局】' + ppValue(f.defeatConditions) : ''
    ].filter(function(s){ return s && s.length > 5; }).join('\n\n');
    var shilue = youlie + bkFold(shilueText);
    var foot = '<div class="bk-foot">' +
      (p.regions.length ? '<button type="button" class="bk-act" data-bk-open-region="' + attr(p.regions[0].id || p.regions[0].name || '') + '">翻 其 首 地</button>' : '') +
      '<button type="button" class="bk-act" data-pp-close="1">合 上 谱 牒</button>' +
      '</div>';
    var juans = [
      ['bk-junchen', '一', '君臣', '首脑重臣', '君', junchen],
      ['bk-bantu', '二', '版图', '所辖之地', '图', bantu],
      ['bk-junlue', '三', '军略', '兵制方略', '军', junlue],
      ['bk-caiji', '四', '财计', '库藏经济', '财', caiji],
      ['bk-bangjiao', '五', '邦交', '与国之谊', '交', bkBangList(f)],
      ['bk-shilue', '六', '史略', '优劣大略', '史', shilue]
    ];
    var live = juans.filter(function(j){ return !!j[5]; });
    return bkSpine(name + ' · 谱牒') +
      '<div class="bk-inner">' + head + stats +
      '<div class="bk-scroll">' +
        live.map(function(j){ return bkJuan(j[0], j[1], j[2], j[3], j[5]); }).join('') +
      '</div>' + foot + '</div>' +
      bkJianqian(live.map(function(j){ return [j[0], j[4]]; })) +
      '<div class="bk-straddle"><i>验讫</i></div>';
  }
  function openFactionDossier(key, region){
    var map = getMapData() || {};
    var f = findFaction(key, region && (region.factionName || region.ownerName)) || {};
    var r = region || factionControlledRegions(key, f)[0] || ((map.regions || []).find(function(x){ return ownerKey(x) === key; }) || null);
    key = key || (r && ownerKey(r)) || '';
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'faction';
    pop.dataset.factionKey = key;
    pop.removeAttribute('data-region-id');
    pop.className = 'tmf-map-ppop tmf-book faction-panel show';
    pop.innerHTML = renderFactionBook(f, key, r);
    document.body.classList.add('province-panel-open');
    bindBkSpy(pop);
  }

  // ── 回填 origin forward shim 目标（5 函数）──
  __p.regionBundle = regionBundle;
  __p.openRegionDossier = openRegionDossier;
  __p.openFactionDossier = openFactionDossier;
  __p.closeMapDossier = closeMapDossier;
  __p.factionOwnsRegion = factionOwnsRegion;
})();
