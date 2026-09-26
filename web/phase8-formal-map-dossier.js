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
    var locationService = window.TMMapLocations;
    var strictLocations = locationService && locationService.enabled(map);
    var liveLocations = strictLocations ? armies.map(function(a) { return locationService.read(a, 'army', gm); }) : null;
    var sig = (gm.turn || 0) + ':' + armies.length + ':' +
      armies.reduce(function(a, x){ return a + (Number(x && x.soldiers) || 0); }, 0) + ':' + regions.length;
    sig += ':' + JSON.stringify(armies.map(function(a, i) { return a && [a.id,a.garrison,a.location,a.regionId,a.garrisonRegionId,a.regionHint,a.soldiers,a.size,a.strength,a.faction,a.factionId,a.destroyed,a.disbanded,liveLocations && liveLocations[i] && liveLocations[i].regionId]; }));
    if (_armyRegionCache.sig === sig && _armyRegionCache.world === gm && _armyRegionCache.map === map) return _armyRegionCache;
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
    armies.forEach(function(a, armyIndex){
      if (!a || a.destroyed || a.disbanded) return;
      var soldiers = Math.max(0, Math.round(Number(a.soldiers || a.size || a.strength) || 0));
      if (soldiers <= 0) return;
      var garrisonText = String(a.garrison || a.location || '');
      if (strictLocations) {
        var bound = liveLocations[armyIndex];
        if (!bound || !bound.regionId) unbound.push({ name: String(a.name || ''), garrison: garrisonText, soldiers: soldiers, status: bound && bound.status });
        else addTo(bound.regionId, a, soldiers, bound.precision === 'representative' ? '·区域参考点' : '');
        return;
      }
      // ① 剧本 regionHint 直绑：不在区划树/聚落层的驻地（蓟州/固原/京师等）由剧本点名所属地块
      var hint = a.garrisonRegionId || a.regionId || a.regionHint;
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
    _armyRegionCache = { sig: sig, world: gm, map: map, byRegion: byRegion, unboundCount: unbound.length, unbound: unbound };
    return _armyRegionCache;
  }
  function regionArmies(r){
    if (!r) return null;
    var idx = armyRegionIndex();
    return idx.byRegion[String(r.id || r.name || '')] || null;
  }

  // Cache only within a synchronous render batch; each later action reads the current tax bases.
  var fiscalReadBatch = null;
  function currentFactionBudget(fid){
    var g = typeof GM !== 'undefined' ? GM : null;
    if (!g || typeof CascadeTax === 'undefined' || !CascadeTax.previewBudget) return null;
    if (!fiscalReadBatch || fiscalReadBatch.game !== g || fiscalReadBatch.turn !== g.turn) {
      fiscalReadBatch = {game:g, turn:g.turn, values:{}};
      var batch = fiscalReadBatch;
      var clear = function(){if(fiscalReadBatch === batch) fiscalReadBatch=null;};
      if (typeof queueMicrotask === 'function') queueMicrotask(clear); else setTimeout(clear,0);
    }
    if (!Object.prototype.hasOwnProperty.call(fiscalReadBatch.values,fid)) fiscalReadBatch.values[fid] = CascadeTax.previewBudget({game:g,faction:fid,turnDays:360});
    return fiscalReadBatch.values[fid];
  }
  function resourceText(row){
    if (!row) return '';
    return ['money','grain','cloth'].map(function(k,i){return ppValue(Number(row[k])||0)+['贯','石','匹'][i];}).join(' · ');
  }
  // Read-only union of explicit original accounts; a same-name child is not the whole region.
  function combinedMapAccountView(r, node){
    if (!r || !node || !Array.isArray(r.accountingLeafIds) || r.accountingLeafIds.length < 2) return null;
    var wanted=new Set(r.accountingLeafIds.map(String)), records=[], seen=new Set();
    (function walk(n){if(!n||seen.has(n))return;seen.add(n);if(wanted.has(String(n.id))){records.push(n);return;}(n.children||n.divisions||[]).forEach(walk);})(node);
    if(records.length!==wanted.size)return null;
    var weights=records.map(function(n){return Number(n.populationDetail&&n.populationDetail.mouths)||Number(n.population)||0;}),total=weights.reduce(function(a,b){return a+b;},0);
    var rates=new Set(['ratio','sexRatio','climate','currentLoad','compliance','skimmingRate','autonomy','autonomyLevel','commerceCoefficient','roadQuality','taxBurden','minxin','minxinLocal','corruption','corruptionLocal','prosperity','unrest']);
    function combine(values,key){
      if(values.every(function(v){return typeof v==='number'&&isFinite(v);}))return rates.has(key)?values.reduce(function(s,v,i){return s+v*weights[i];},0)/Math.max(total,1):values.reduce(function(a,b){return a+b;},0);
      if(values.every(function(v){return v&&typeof v==='object'&&!Array.isArray(v);})){var out={};new Set([].concat.apply([],values.map(Object.keys))).forEach(function(k){out[k]=combine(values.map(function(v){return v[k];}),k);});return out;}
      var known=values.find(function(v){return v!==undefined&&v!==null;});return Array.isArray(known)?known.slice():known;
    }
    var view=Object.assign({},node);
    ['populationDetail','byGender','byAge','bySettlement','carryingCapacity','publicTreasuryInit','economyBase','fiscalDetail','fiscal'].forEach(function(k){var values=records.map(function(n){return ((k==='byGender'||k==='byAge'||k==='bySettlement')&&n.populationDetail&&n.populationDetail[k])||n[k]||{};});view[k]=combine(values,k);});
    view.population=total;view.populationDetail.mouths=total;view.populationDetail.id=node.id;view.populationDetail.name=node.name;
    view._sourceAccountCount=records.length;
    view.description=String((r.data&&r.data.description)||node.description||'')+' 本图块合并显示'+records.length+'份原账，分项身份与数值分别保留。'+(r.theaterAccountIds?'其中含战区分项，不表示所有人口均居于图示海岛。':'');
    return view;
  }

  function regionBundle(r){
    var base = Object.assign({}, (r && r.admin) || {}, (r && r.data) || {});
    var liveDivision = findLiveAdminDivision(r);
    var liveStats = findLiveProvinceStats(r);
    var combined = combinedMapAccountView(r, liveDivision);
    if (combined) { liveDivision=combined; liveStats=null; }
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
      else if (!hasValue(_sg) && hasValue(_officePos)) {
        // 与执行率管线（tm-field-pipelines）同一口径：区划上写了 governor 却为空才算出缺；
        // 剧本从未记下任官者（没有 governor 字段）显示「任官未详」，不当出缺。
        if (liveDivision && Object.prototype.hasOwnProperty.call(liveDivision, 'governor')) data.governorVacant = true;
        else data.governorUnrecorded = true;
      }
      else if (_sc) { data.governorChar = _sc.name; }                                                                                   // 静态主官在世(官职串格式异)→兜底保留+可取属性
    }
    if (window.GM && window.GM.publicTreasuryConfig && data.governorVacant && _officePos) {
      var declaredOffice=null;
      (function find(nodes){(nodes||[]).forEach(function(d){(d.positions||[]).forEach(function(p){if(p.name===_officePos&&(p.regionId===(liveDivision&&liveDivision.id)||!p.regionId))declaredOffice=p;});find(d.subs||d.children);});})(window.GM.officeTree);
      if (declaredOffice && declaredOffice.occupancyStatus==='unrecorded') {data.governorVacant=false;data.governor='任官未详';data.official='任官未详';}
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
    // Read the declared entity ledger, including an explicit zero or unknown balance.
    if (window.GM && window.GM.publicTreasuryConfig && window.GM.publicTreasuryConfig.schema === 'tm-public-treasury/2'
        && window.FiscalEngine && window.FiscalEngine.getAccountView) {
      var treasuryNode=liveDivision||base, treasuryRef=(treasuryNode.children&&treasuryNode.children.length?'pool:':'region:')+String(treasuryNode.id||base.id||'');
      var treasuryView=window.FiscalEngine.getAccountView({game:window.GM,ref:treasuryRef});
      ['money','grain','cloth'].forEach(function(k){treasury[k]=treasuryView.resources[k].known?treasuryView.resources[k].stock:'未具数';});
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
    var popView = null;
    if (typeof HujiEngine !== 'undefined' && HujiEngine.getPopulationView) {
      popView = HujiEngine.getPopulationView({root:typeof GM !== 'undefined' ? GM : {}, region:liveDivision || (r && r.id), factionId:ownerKey(r)});
      if (popView.displayBasis === 'registered') {
        pop = Object.assign({},pop,{mouths:popView.mouths,households:popView.households,ding:popView.ding,actualMouths:popView.actualMouths,taxableMouths:popView.taxableMouths,taxableHouseholds:popView.taxableHouseholds});
        data.population = pop.mouths;
      }
    }
    var budget = currentFactionBudget(ownerKey(r));
    if (budget && Array.isArray(budget.regions)) {
      var ids = {};
      (function walk(n){if(!n)return;var cs=n.children||n.divisions;if(cs&&cs.length)cs.forEach(walk);else ids[n.id||n.name]=true;})(liveDivision || r);
      var matching = budget.regions.filter(function(x){return ids[x.id];});
      if (matching.length) {
        var resources = {};
        ['money','grain','cloth'].forEach(function(k){resources[k]={};matching.forEach(function(row){Object.keys(row.resources[k]).forEach(function(field){resources[k][field]=(resources[k][field]||0)+(Number(row.resources[k][field])||0);});});});
        fiscal = Object.assign({},fiscal,resources.money,{resources:resources,period:budget.period,isForecast:true});
        data.taxRevenue=fiscal.actualRevenue;
      }
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
        var openCir = hit('[data-bk-open-circuit]');
        if (openCir) { openCircuitDossier(openCir.dataset.bkOpenCircuit || '', findRegion(pop.dataset.regionId || '')); return; }
        var cirAct = hit('[data-bk-circuit-act]');
        if (cirAct) { circuitAction(pop.dataset.circuitKey || '', cirAct.dataset.bkCircuitAct || ''); return; }
        var regAct = hit('[data-bk-region-act]');
        if (regAct) { regionAction(pop.dataset.regionId || '', regAct.dataset.bkRegionAct || ''); return; }
        // 改隶（S6）：开合候选面板；选定一道即录入诏书建议并收起
        var rsOpen = hit('[data-bk-reassign-open]');
        if (rsOpen) {
          if (rsOpen.dataset.bkReassignOpen === 'circuit') toggleReassignPanel(pop, circuitReassignPanel(findCircuit(pop.dataset.circuitKey || '')));
          else toggleReassignPanel(pop, regionReassignPanel(findRegion(pop.dataset.regionId || '')));
          return;
        }
        var rsTo = hit('[data-bk-reassign-to]');
        if (rsTo) {
          if (reassignSuggest(rsTo.dataset.bkReassignRegion || '', rsTo.dataset.bkReassignTo || '')) toggleReassignPanel(pop, '');
          return;
        }
        if (hit('[data-bk-reassign-close]')) { toggleReassignPanel(pop, ''); return; }
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
      pop.classList.remove('show', 'region-panel', 'faction-panel', 'circuit-panel');
      pop.removeAttribute('data-region-id');
      pop.removeAttribute('data-faction-key');
      pop.removeAttribute('data-circuit-key');
      pop.removeAttribute('data-panel-kind');
    }
    document.body.classList.remove('province-panel-open');
    syncCircuitOutline();
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
  function bkTerrainText(v){
    var labels = { plains:'平原', plain:'平原', hills:'丘陵', hill:'丘陵', mountains:'山地', mountain:'山地', plateau:'高原', basin:'盆地', desert:'沙漠', steppe:'草原', grassland:'草原', forest:'林地', coast:'滨海', coastal:'滨海', river:'河谷', valley:'河谷', wetland:'泽地', marsh:'泽地', water:'水域', sea:'海域', ocean:'海域', island:'岛屿', tundra:'寒原' };
    if (Array.isArray(v)) return v.map(bkTerrainText).filter(Boolean).join('、');
    if (v && typeof v === 'object') return bkTerrainText(v.name || v.label || v.type || '');
    var text = String(v || '').trim();
    return labels[text] || (/^[a-z][a-z0-9_-]*$/i.test(text) ? '' : text);
  }
  function bkDemographicBreakdown(data, key){
    var info = data.demographicAccounting || {};
    if (Array.isArray(info.unverifiedBreakdowns) && info.unverifiedBreakdowns.indexOf(key) >= 0) return null;
    return data[key];
  }
  function bkPopulationGroup(v, kind){
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    var labels = kind === 'faith' ? { folk:'民间祠祀', buddhist:'佛教', taoist:'道教', confucian:'儒学礼教', islam:'伊斯兰教', christian:'基督宗教', nestorian:'景教', hindu:'印度诸教', shinto:'神祇祭祀', shaman:'萨满信俗', other:'其他信俗' } : { han:'汉人', tujue:'突厥诸部', tubo:'吐蕃诸部', xiyu:'西域诸族', nanzhao:'西南诸族', mongol:'蒙古诸部', manchu:'满洲', hui:'回回', tibetan:'藏人', uyghur:'回鹘', japanese:'日本诸族', korean:'朝鲜半岛诸族', khmer:'高棉', other:'其他族属' };
    var keys = Object.keys(v).filter(function(k){ return v[k] != null; });
    var ratios = keys.length > 0 && keys.every(function(k){ return typeof v[k] === 'number' && v[k] >= 0 && v[k] <= 1; });
    return keys.map(function(k){
      var entry = v[k], label = (entry && typeof entry === 'object' && (entry.name || entry.label)) || labels[k] || (/[\u3400-\u9fff]/.test(k) ? k : (kind === 'faith' ? '未详信俗' : '未详族属'));
      var value = entry && typeof entry === 'object' ? firstValue(entry.count, entry.mouths, entry.ratio) : entry;
      var ratio = ratios || (entry && typeof entry === 'object' && entry.count == null && entry.mouths == null && entry.ratio != null);
      return label + ' ' + (ratio ? (Math.round(Number(value) * 1000) / 10) + '%' : mapNum(value));
    }).join(' / ');
  }
  // Age ranges and known category names are displayed without leaking schema keys.
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
      var range = k.match(/^age_(\d+)_(\d+|plus)$/);
      var label = AGE[k] || (range ? range[1] + (range[2] === 'plus' ? '岁以上' : '—' + range[2] + '岁') : fieldLabel(k));
      parts.push(label + ' ' + mapNum(cnt));
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
      (opts.crumbs ? '<div class="bk-crumbs">' + opts.crumbs + '</div>' : '') +
      '<div class="bk-title-row"><div class="bk-name">' + esc(opts.name) + '</div><div class="bk-name-sub">' + esc(opts.sub || '') + '</div></div>' +
      '<div class="bk-govline">' + opts.pills.filter(Boolean).join('') + '</div>' +
      (opts.tags || '') +
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
  // 役政并入户役志后（通志一期 S4），役政视图跳到户役志里的「役政」一节
  var BK_TAB_JUAN = { mood: 'bk-hukou', classPressure: 'bk-hukou', yizheng: 'bk-yizheng', tax: 'bk-caifu', army: 'bk-junbei', office: 'bk-zhiguan' };
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
    var moneyUnit = (typeof P !== 'undefined' && P && P.fiscalConfig && P.fiscalConfig.unit && P.fiscalConfig.unit.money) || '两';
    try { if (window.CurrencyUnit && CurrencyUnit.getUnit) moneyUnit = CurrencyUnit.getUnit().money || moneyUnit; } catch (_) {}
    var ledger = (bw && bw.buildingLedger && !bld._proposal) ? bw.buildingLedger(bld, typeDef) : null;
    var total = Number(bld.timeActual) || Number(typeDef && typeDef.buildTime) || Math.max(1, Number(bld.remainingTurns) || 1);
    var prog = doing ? Math.round(Math.max(0, Math.min(1, (total - (Number(bld.remainingTurns) || 0)) / total)) * 100) : 100;
    var stCls = doing ? 'doing' : (neglected ? 'ni' : (damaged ? 'ni' : 'done'));
    var stTxt = doing ? '工 役 中' : (neglected ? '失 修' : (damaged ? '半 损' : '完 好'));
    return '<div class="bk-ye' + (bld._proposal ? ' nijian' : '') + '">' +
      '<div class="ye-hd"><b>' + esc(bld.name) + '</b><span class="lv">' + (bld._proposal ? '营造案' : esc((bld.isCustom ? '自拟 · ' : '') + (bld.level || 1) + ' 级')) + '</span><span class="st ' + stCls + '">' + (bld._proposal ? esc(bld._proposalStatus || '候 诏') : stTxt) + '</span></div>' +
      (hasDisplayValue(bld.description) ? '<p>' + esc(compactText ? compactText(bld.description, 90) : String(bld.description).slice(0, 90)) + '</p>' : '') +
      (hasDisplayValue(bld.judgedEffects) && !labels.length ? '<p>' + esc(String(bld.judgedEffects).slice(0, 90)) + '</p>' : '') +
      (labels.length ? '<div class="fx">' + labels.map(function(x, i){ return '<em class="' + (i === labels.length - 1 && /维护/.test(x) ? 'cost' : '') + '">' + esc(x) + '</em>'; }).join('') + '</div>' : '') +
      // S7·营造可观测账：完工/半损卡显「实入账」(真为本地所添·非 per-level 规则) + 工成之利岁入
      (!doing && ledger && ledger.applied && ledger.applied.length ? '<div style="margin-top:4px;font-size:12px;color:#5a4a32;">实入账：' + esc(ledger.applied.join(' · ')) + '</div>' : '') +
      (ledger && ledger.flowPct > 0 ? '<div style="margin-top:3px;font-size:12px;color:#5a4a32;">工成之利：地方岁入 +' + ledger.flowPct + '%/回合（单建筑上限 6%）</div>' : '') +
      (ledger ? '<div style="margin-top:3px;font-size:12px;color:#6a5638;">' + (doing ? '完工后' : '') + '养护用钱：地方库款 ' + esc(ledger.upkeep) + ' ' + esc(moneyUnit) + '/回合</div>' : '') +
      (damaged && ledger ? '<div style="margin-top:3px;font-size:12px;color:#9a3a2a;">半损 · 存量效用减半，工成之利暂停；地方库款足付修缮费 ' + esc(ledger.repairCost) + ' ' + esc(moneyUnit) + '（造价 30%，至少 20 ' + esc(moneyUnit) + '）则自动葺治复完。</div>' : '') +
      (neglected ? '<div style="margin-top:3px;font-size:12px;color:#9a3a2a;">失修停用，工成之利暂停，候地方修缮后再启。</div>' : '') +
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
        var order = window.TM && TM.BuildingOrders && TM.BuildingOrders.list(gm).find(function(o) { return o.id === s.buildingOrderId; });
        var labels = { submitted: '待 核 办', unresolved: '未 开 工', rejected: '未 准', deferred: '缓 行', recovery_required: '待 恢 复' };
        cards.push(bkYeCard({ name: order ? order.req.name : String(s.content || '营造案').slice(0, 24) + '…', _proposal: true, _proposalStatus: order && labels[order.status], description: order && order.receipt ? order.receipt.reason : '已录入诏令建议库，候颁行后由有司核定费用、工期与效用。' }, P));
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
  // ── 方志轻调（通志一期 S4）：层级路径、页头状态小签、本道排名、页脚诏书动作 ──
  var REGION_ACTIONS = ['安民', '巡按', '调粮', '拟诏'];
  var ZT_SEAL = { wonder: '观', disaster: '灾', player: '裁', event: '云', building: '营' };

  // 页头层级路径：势力 › 省道 › 本州；势力、省道可点
  function regionCrumbs(r, oKey){
    var parts = [];
    if (hasDisplayValue(ownerName(r))) parts.push('<button type="button" data-bk-open-faction="' + attr(oKey) + '" title="展其谱牒">' + esc(ownerName(r)) + '</button>');
    var circuit = findCircuit(r);
    if (circuit) parts.push('<button type="button" data-bk-open-circuit="' + attr(circuit.key) + '" title="展其通志">' + esc(circuit.label) + '</button>');
    parts.push('<b>' + esc(regionTitle(r)) + '</b>');
    return parts.join('<span>›</span>');
  }

  // 状态小签：奇观、灾异、圣裁、风云、营造之利落在此地的持续境况。签上写名目与剩余回合，
  // 悬停见说明与效果（效果乘进本地岁入、逐回合作用民心）
  function regionStatusTags(statusFx){
    if (!statusFx || !statusFx.length) return '';
    var turn = Number(window.GM && GM.turn) || 0;
    return '<div class="bk-zhuangkuang bk-zt-tags">' + statusFx.slice(0, 12).map(function(e){
      var fx = [], ep = Number(e.econPct), mp = Number(e.minxinPerTurn);
      if (isFinite(ep) && ep) fx.push('岁入 ' + (ep > 0 ? '+' : '') + Math.round(ep * 100) + '%');
      if (isFinite(mp) && mp) fx.push('民心 ' + (mp > 0 ? '+' : '') + mp + '/回合');
      var left = e.expiresTurn != null ? Math.max(0, Number(e.expiresTurn) - turn) : null;
      var term = left === null ? '永 续' : '余 ' + left + ' 回合';
      var tone = (ep < 0 || mp < 0) ? ' neg' : (fx.length ? ' pos' : '');
      var tip = [String(e.name || ''), e.desc ? String(e.desc) : '', fx.join('，'), term.replace(/ /g, '')].filter(Boolean).join(' · ');
      return '<span class="bk-zt-tag ' + attr(String(e.kind || 'event')) + tone + '" tabindex="0" title="' + attr(tip) + '">' +
        '<i>' + esc(ZT_SEAL[e.kind] || '云') + '</i>' + esc(String(e.name || '')) + '<em>' + esc(term) + '</em></span>';
    }).join('') + '</div>';
  }

  // 本道排名：本州在本道本方各州里的名次（户口、实征从多到少，民心从高到低，吏治从清到浊），
  // 写在读数带下；民心、吏治排在后三分之一的标红；点省道名开通志
  function regionCircuitRank(r, b){
    var circuit = findCircuit(r), MC = circuitApi();
    if (!circuit || !MC) return '';
    var own = MC.partitionByOwner(circuit, circuitOwnerKey(r)).own, at = own.indexOf(r);
    if (own.length < 2 || at < 0) return '';
    var all = own.map(function(x){
      var bx = x === r ? b : regionBundle(x), d = bx.data || {};
      return { pop: Number(firstValue(d.population, bx.pop.mouths)), tax: Number(bx.fiscal.actualRevenue), mood: Number(moodViewScore(x, bx)), office: Number(officeViewScore(x, bx)) };
    });
    function rank(key, higherBetter){
      var v = all[at][key];
      if (!isFinite(v)) return null;
      return 1 + all.filter(function(m){ return isFinite(m[key]) && (higherBetter ? m[key] > v : m[key] < v); }).length;
    }
    var low = Math.ceil(own.length * 2 / 3);
    var items = [['户口', rank('pop', true), false], ['实征', rank('tax', true), false], ['民心', rank('mood', true), true], ['吏治', rank('office', false), true]]
      .filter(function(x){ return x[1] != null; })
      .map(function(x){ return '<span' + (x[2] && x[1] > low ? ' class="lo"' : '') + '>' + esc(x[0]) + ' 第 ' + x[1] + '</span>'; });
    if (!items.length) return '';
    return '<div class="bk-rankline"><button type="button" data-bk-open-circuit="' + attr(circuit.key) + '" title="展其通志">' + esc(circuit.label) + '</button>' +
      '<small>本方 ' + own.length + ' 州中</small>' + items.join('') + '</div>';
  }

  // 本方州县才给诏书动作（与通志、右栏同一套「本方」判定）
  function isPlayerRegion(r){
    var names = playerFactionNames();
    if (!r || !names.length) return false;
    return [circuitOwnerKey(r), ownerKey(r)].some(function(owner){
      if (!hasDisplayValue(owner)) return false;
      var f = findFaction(owner, r.factionName || r.ownerName);
      return names.indexOf(String(owner)) >= 0 || !!(f && names.indexOf(String(f.name)) >= 0);
    });
  }
  function regionActionText(act, r){
    var d = regionBundle(r).data || {}, area = regionTitle(r);
    var who = firstValue(d.governor, d.official);
    var head = firstValue(d.officialPosition, '地方有司') + (!d.governorVacant && hasDisplayValue(who) ? who : '');
    if (act === '安民') return '命' + head + '抚辑' + area + '军民，察疾苦、宽徭役、赈贫乏，限期具奏。';
    if (act === '巡按') return '遣御史巡按' + area + '，察吏治、问民瘼、核钱粮，据实以闻。';
    if (act === '调粮') return '议调邻近仓储之粮接济' + area + '，数额、脚价与期限由户部会议具奏。';
    return '就' + area + '之事拟诏：核实主官、钱粮、民心与地方积弊，列明可行方略候旨。';
  }
  // 页脚动作只写进诏书建议库（与右栏、通志同一个写入口），下诏后才生效
  function regionAction(regionId, act){
    var r = findRegion(regionId);
    if (!r || REGION_ACTIONS.indexOf(act) < 0 || !isPlayerRegion(r)) return false;
    var rail = bridge.rightrail, area = regionTitle(r);
    var ok = !!(rail && typeof rail.addEdictSuggestion === 'function' &&
      rail.addEdictSuggestion('行政区划', area, '方志·' + act, regionActionText(act, r)));
    if (typeof toast === 'function') toast(ok ? '已录入诏令建议库：' + area + act : '诏令建议库未就绪');
    return ok;
  }

  // ── 改隶（通志一期 S6）：方志「改隶」、通志「调整辖区」只生成诏书建议 ──
  // 候选与校验都取改隶写口 TM.DivisionReassign（本方省道之间、首府暂不改出、不接壤标飞地）；
  // 下诏后由推演核定，经回合末写工具 restructure_division 调同一写口三处同步落地。
  function reassignApi(){
    return (window.TM && TM.DivisionReassign) || null;
  }
  function reassignSuggest(regionId, targetKey){
    var DR = reassignApi(), r = findRegion(regionId);
    if (!DR || !r || !isPlayerRegion(r)) return false;
    var p = DR.plan(r, targetKey, {});
    if (!p.ok) { if (typeof toast === 'function') toast(p.reason || '不能改隶'); return false; }
    var area = regionTitle(r), rail = bridge.rightrail;
    var body = '改隶' + area + '于' + p.to.label + '（原隶' + p.from.label + '）' +
      (p.warnings.length ? '；按：' + p.warnings.join('；') : '') + '。着所司会议具奏，行政、钱粮、刑名一并交割。';
    var ok = !!(rail && typeof rail.addEdictSuggestion === 'function' && rail.addEdictSuggestion('行政区划', area, '改隶·' + p.to.label, body));
    if (typeof toast === 'function') toast(ok ? '已录入诏令建议库：改隶' + area + '于' + p.to.label : '诏令建议库未就绪');
    return ok;
  }
  // 一州的候选省道按钮；limit 给了就只列接壤的前几道（通志逐州一行用），不给就列接壤的全部
  function reassignButton(id, t){
    return '<button type="button" data-bk-reassign-region="' + attr(id) + '" data-bk-reassign-to="' + attr(t.key) + '">' + esc(t.label) + (t.adjacent ? '' : '<em>飞地</em>') + '</button>';
  }
  function reassignTargetButtons(r, limit){
    var DR = reassignApi(), id = String(r.id || r.name || '');
    var near = (DR ? DR.targetsFor(r, {}) : []).filter(function(t){ return t.adjacent; });
    var shown = limit ? near.slice(0, limit) : near;
    return shown.map(function(t){ return reassignButton(id, t); }).join('') +
      (limit && near.length > shown.length ? '<small>另有 ' + (near.length - shown.length) + ' 道接壤</small>' : '');
  }
  // 方志「改隶」：接壤的本方省道直接列出；不接壤的收在「另有 N 道」里，展开才见（改隶将成飞地）
  function regionReassignPanel(r){
    var DR = reassignApi();
    if (!DR) return '';
    var m = DR.movable(r, {});
    var head = '<div class="rs-t">改隶 <b>' + esc(regionTitle(r)) + '</b><small>' + (m.from ? '今隶 ' + esc(m.from.label) + ' · ' : '') + '选定后录入诏书建议</small>' +
      '<button type="button" class="rs-x" data-bk-reassign-close="1" title="收起">×</button></div>';
    if (!m.ok) return head + '<div class="rs-note">' + esc(m.reason) + '</div>';
    var id = String(r.id || r.name || '');
    var far = DR.targetsFor(r, {}).filter(function(t){ return !t.adjacent; });
    var near = reassignTargetButtons(r, 0);
    if (!near && !far.length) return head + '<div class="rs-note">本方没有别的省道可改隶</div>';
    return head + (near ? '<div class="rs-list">' + near + '</div>' : '<div class="rs-note">本方没有接壤的别道</div>') +
      (far.length ? '<details class="rs-far"><summary>另有 ' + far.length + ' 道不接壤（改隶将成飞地）</summary><div class="rs-list">' +
        far.map(function(t){ return reassignButton(id, t); }).join('') + '</div></details>' : '');
  }
  // 通志「调整辖区」：本道各州可改出到哪（只列接壤的前三道），邻道本方之州可划进来
  function circuitReassignPanel(circuit){
    var DR = reassignApi(), MC = circuitApi();
    if (!DR || !MC || !circuit) return '';
    var own = MC.partitionByOwner(circuit, circuitViewer(circuit, null).owner).own;
    var ownIds = own.map(function(r){ return String(r.id || r.name || ''); });
    var head = '<div class="rs-t">调整辖区 <b>' + esc(circuit.label) + '</b><small>选定后录入诏书建议 · 首府暂不改出</small>' +
      '<button type="button" class="rs-x" data-bk-reassign-close="1" title="收起">×</button></div>';
    var outRows = own.map(function(r){
      if (!DR.movable(r, {}).ok) return '';
      var buttons = reassignTargetButtons(r, 3);
      return buttons ? '<div class="rs-row"><span class="rs-nm">' + esc(regionTitle(r)) + '</span>' + buttons + '</div>' : '';
    }).filter(Boolean);
    // 划入：与本道接壤、同属本方、隶于别道且不是别道首府的州
    var seen = {}, inRows = [];
    own.forEach(function(r){
      (Array.isArray(r.neighbors) ? r.neighbors : []).forEach(function(nb){
        var x = findRegion(nb), xid = x ? String(x.id || x.name || '') : '';
        if (!x || seen[xid] || ownIds.indexOf(xid) >= 0 || circuitOwnerKey(x) !== circuitOwnerKey(r)) return;
        seen[xid] = true;
        var m = DR.movable(x, {});
        if (!m.ok || !m.from || m.from.key === circuit.key) return;
        inRows.push('<div class="rs-row"><span class="rs-nm">' + esc(regionTitle(x)) + '<small>今隶 ' + esc(m.from.label) + '</small></span>' +
          '<button type="button" data-bk-reassign-region="' + attr(xid) + '" data-bk-reassign-to="' + attr(circuit.key) + '">划入本道</button></div>');
      });
    });
    return head +
      (outRows.length ? '<div class="rs-sec">划出本道</div>' + outRows.join('') : '<div class="rs-note">本道各州没有接壤的本方别道可改隶</div>') +
      (inRows.length ? '<div class="rs-sec">划入本道</div>' + inRows.join('') : '');
  }
  // 候选面板挂在册页页脚上方的插槽里，再点一次收起；html 为空即收起
  function toggleReassignPanel(pop, html){
    var slot = pop && pop.querySelector('.bk-reassign-slot');
    if (!slot) return false;
    var open = !!slot.innerHTML;
    if (!html) { slot.innerHTML = ''; return false; }
    slot.innerHTML = open ? '' : '<div class="bk-reassign">' + html + '</div>';
    return !open;
  }

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
      bkRow('地方处境', cp.reason)
    ], true) : '';
    // 状态收进页头（通志一期 S4）：奇观、灾异、圣裁、风云、营造之利各成一枚小签，悬停见效果与剩余回合
    var statusFx = (b.liveDivision && Array.isArray(b.liveDivision.statusEffects)) ? b.liveDivision.statusEffects.filter(Boolean) : [];
    var head = bkHead({
      seal: '御览', round: false, kind: '方 志',
      crumbs: regionCrumbs(r, oKey),
      name: regionTitle(r), sub: regionLevel(r), desc: firstValue(data.description, r && r.description),
      tags: regionStatusTags(statusFx),
      pills: [
        hasDisplayValue(ownerName(r)) ? '<span class="bk-pill owner" data-bk-open-faction="' + attr(oKey) + '" title="展其谱牒"><span class="dot"></span>隶 <b>' + esc(ownerName(r)) + '</b></span>' : '',
        (function(){
          var op = esc(firstValue(data.officialPosition, '主官'));
          if (data.governorVacant) return '<span class="bk-pill" style="color:var(--vermillion-400,#c0563a);border-color:var(--vermillion-400,#c0563a);" title="该地治理官职出缺·待补任">' + op + ' <b>空缺·待补</b></span>';
          if (data.governorUnrecorded) return '<span class="bk-pill" title="官署照常供职，掌官姓名未载">' + op + ' <b>任官未详</b></span>';
          var gn = firstValue(data.governor, data.official);
          if (!hasDisplayValue(gn)) return '';
          var gc = (data.governorChar && typeof findCharByName === 'function') ? findCharByName(data.governorChar) : null;
          var adm = (gc && hasDisplayValue(gc.administration)) ? ' <span style="opacity:.65;font-size:0.92em;">政' + esc(gc.administration) + '</span>' : '';
          return '<span class="bk-pill" title="' + op + ' · 当任主官">' + op + ' <b>' + esc(gn) + '</b>' + adm + '</span>';
        })(),
        hasDisplayValue(firstValue(data.terrain, r && r.terrain)) ? '<span class="bk-pill">' + esc(bkTerrainText(firstValue(data.terrain, r && r.terrain))) + '</span>' : '',
        hasDisplayValue(data.taxLevel) ? '<span class="bk-pill">税 <b>' + esc(data.taxLevel) + '</b></span>' : ''
      ]
    });
    var stats = bkStats([
      bkStat('户口', firstValue(data.population, b.pop.mouths), hasDisplayValue(b.pop.ding) ? '丁 ' + ppValue(b.pop.ding) : '', false, 'pop'),
      bkStat('实征', b.fiscal.actualRevenue, hasDisplayValue(b.fiscal.compliance) ? '合规 ' + pctValue(b.fiscal.compliance) : '', false, 'tax'),
      bkStat('驻军', firstValue(data.garrison, b.army.troops, r && r.troops), firstValue(data.armyPressure, ''), false, 'army'),
      bkStat('民心', hasDisplayValue(firstValue(data.minxinLocal, r && r.mood, data.prosperity)) ? moodS : '', (gradeOf('mood', moodS) || {}).mark || '', gradeIsWarn('mood', gradeOf('mood', moodS)), 'minxin'),
      bkStat('吏治', hasDisplayValue(corr) ? offS : '', (gradeOf('office', offS) || {}).mark || '', gradeIsWarn('office', gradeOf('office', offS)), 'corr')
    ]) + regionCircuitRank(r, b);
    var hukou = bkLan([
      bkRow(data.demographicAccounting && data.demographicAccounting.basis === 'existing-game-population-domain-with-legal-status-partitions' ? '口数（含逃隐）' : '在册口数', firstValue(data.population, b.pop.mouths)),
      bkRow(data.demographicAccounting && data.demographicAccounting.basis === 'existing-game-population-domain-with-legal-status-partitions' ? '户数' : '在册户', b.pop.households),
      (function(){
        var rp = _reportedPop(r);
        if (rp && rp.ding != null && Number(rp.conceal) > 0 && hasDisplayValue(b.pop.ding)) {
          // 默认只看上报值（督抚据报·瞒报税基/隐户）·真丁口藏于聚光（hover 核验）——薛定谔奏报范式 pilot
          // 失真层S4收严(拍板①真值须揭)：失真层开且该地未揭真→hover 不再泄真丁口与瞒报%·只提示核查之途
          var cP = Math.round(Number(rp.conceal) * 100);
          var RVd = window.TM && TM.ReportedView;
          var _veiled = RVd && RVd.active(window.P || null) && !RVd.revealed('renli', 'region.' + String((r && (r.id || r.name)) || ''));
          var tt = _veiled
            ? '地方奏报口径 · 真丁口须遣员核查、门生密报方得掀见'
            : '地方奏报口径 · 真丁口 ' + ppValue(b.pop.ding) + '（约瞒报 ' + cP + '%·聚光核验）';
          return '<div class="bk-lr" data-bk-cause="ding" title="' + attr(tt) + '"><span class="bk-k">丁口 <small style="opacity:.65">据报</small></span><span class="bk-v">' + esc(ppValue(rp.ding)) + '</span></div>';
        }
        return bkRow('丁口', b.pop.ding, null, 'ding');
      })(),
      bkRow(data.demographicAccounting && data.demographicAccounting.hiddenCountUnit === 'mouths' ? '逃散人口（估）' : '逃户', b.pop.fugitives, 'zhu', 'fugitive'),
      bkRow(data.demographicAccounting && data.demographicAccounting.hiddenCountUnit === 'mouths' ? '隐匿人口（估）' : '隐户', b.pop.hiddenCount, 'zhu', 'hidden'),
      b.pop.actualMouths != null ? bkRow('居民估数', b.pop.actualMouths + ' 口') : '',
      b.pop.taxableHouseholds != null ? bkRow('当前应税户', b.pop.taxableHouseholds) : '',
      bkRow('承载上限', data.carryingCapacity),
      bkRow('保甲', data.baojia),
      bkRow('繁荣', firstValue(data.prosperity, r && r.prosperity), null, 'prosperity'),
      (hasDisplayValue(data.wealth) && String(data.wealth) !== String(firstValue(data.prosperity, r && r.prosperity)) ? bkRow('财富', data.wealth) : ''),            // P2-2·异于繁荣才显(去重同值·保留异值·不盲删)
      (hasDisplayValue(data.development) && String(data.development) !== String(firstValue(data.prosperity, r && r.prosperity)) ? bkRow('发展', data.development) : ''),  // P2-2·同上
      bkRow('不稳', data.unrest, 'zhu')
    ]) + bkChips([
      ['性别', bkDemographicBreakdown(data, 'byGender')], ['年龄', fmtByAge(bkDemographicBreakdown(data, 'byAge'))], ['族群', bkPopulationGroup(bkDemographicBreakdown(data, 'byEthnicity'), 'ethnicity')],
      ['信仰', bkPopulationGroup(bkDemographicBreakdown(data, 'byFaith'), 'faith')], ['聚落', fmtBySettlement(bkDemographicBreakdown(data, 'bySettlement'))], ['宗教场所', bkDemographicBreakdown(data, 'religiousSites')]
    ]) + (data.demographicAccounting && data.demographicAccounting.basis === 'existing-game-population-domain-with-legal-status-partitions' ? '<p class="bk-census-note">所列口数已含逃隐，实居之众尚未尽详。细分簿籍未备。</p>' : '') + cpHtml;
    var caifu = bkLan([
      bkRow(b.fiscal.isForecast ? '岁计应征钱' : '应征', b.fiscal.claimedRevenue),
      bkRow(b.fiscal.isForecast ? '岁计可入钱' : '实征', b.fiscal.actualRevenue, null, 'tax'),
      bkRow(b.fiscal.isForecast ? '岁计解送钱' : '起运中枢', b.fiscal.remittedToCenter),
      bkRow(b.fiscal.isForecast ? '岁计留用钱' : '留用地方', b.fiscal.retainedBudget),
      b.fiscal.resources ? bkRow('岁计可入粮', b.fiscal.resources.grain.actualRevenue + ' 石') : '',
      b.fiscal.resources ? bkRow('岁计可入帛', b.fiscal.resources.cloth.actualRevenue + ' 匹') : '',
      bkRow('征到比例', pctValueIfPresent(b.fiscal.compliance), null, 'compliance'),
      bkRow('截留率', pctValueIfPresent(b.fiscal.skimmingRate), 'zhu', 'skim'),
      bkRow('财政自主', pctValueIfPresent(firstValue(b.fiscal.autonomyLevel,b.fiscal.autonomy))),
      bkRow('税负', firstValue(b.fiscal.taxBurden, data.taxBurden)),
      bkRow('税级', data.taxLevel),
      bkRow('库钱', b.treasury.money),
      bkRow('掌藏记', data.custodyNote),
      bkRow('库藏粮', b.treasury.grain),
      bkRow('库帛', b.treasury.cloth),
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
      bkRow('主官', data.governorVacant ? '空缺·待补' : (data.governorUnrecorded ? '任官未详' : firstValue(data.governor, data.official)), data.governorVacant ? 'zhu' : ''),
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
      ['耕地', econ.farmland], ['商贸', econ.commerceVolume], ['商贸盛衰', econ.commerceCoefficient],
      ['盐课', econ.saltProduction], ['矿课', econ.mineralProduction], ['马政', econ.horseProduction],
      ['渔课', econ.fishingProduction], ['皇庄', econ.imperialFarmland], ['海贸', econ.maritimeTradeVolume],
      ['织造', assets.zhizao], ['矿场', assets.kuangchang], ['御窑', assets.yuyao],
      ['驿站', econ.postRelays], ['道路', econ.roadQuality]
    ]) + bkLan([
      bkRow('地势', bkTerrainText(firstValue(data.terrain, r && r.terrain))),
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
    // 页脚（通志一期 S4）：本方州县给安民、巡按、调粮、拟诏四个动作，只写进诏书建议库；势力谱牒改由页头层级路径进
    var ledgerBtn = (b.liveDivision && typeof window.openDivisionDetail === 'function') ? '<button type="button" class="bk-act" data-bk-ledger="' + attr(firstValue(b.liveDivision.id, b.liveDivision.name, '')) + '">地 方 账 本</button>' : '';
    var regionActs = isPlayerRegion(r) ? REGION_ACTIONS.map(function(act){
      return '<button type="button" class="bk-act zhu" data-bk-region-act="' + attr(act) + '">' + esc(act.split('').join(' ')) + '</button>';
    }).join('') : '';
    // 改隶（S6）：本方州县在地方账本旁给「改隶」，点开候选省道
    var reassignBtn = regionActs && reassignApi() ? '<button type="button" class="bk-act" data-bk-reassign-open="region">改 隶</button>' : '';
    var moreBtns = ledgerBtn + reassignBtn;
    var foot = (regionActs || moreBtns) ? '<div class="bk-foot' + (regionActs ? ' bk-foot-region' : '') + '">' +
      (regionActs ? '<div class="bk-foot-acts">' + regionActs + '</div>' : '') +
      (regionActs && moreBtns ? '<div class="bk-foot-more">' + moreBtns + '</div>' : moreBtns) +
      '</div>' : '<div class="bk-foot"></div>';
    // 卷与检签同源：空卷不渲染、签也不挂（不留点了不动的死签）
    // 役政志（人力/徭役/农政层·R7-c）——仅已行役政（已种子）地域渲染·未种子不挂此卷
    var yizheng = '';
    (function(){
      var ld = (typeof findLiveAdminDivision === 'function') ? findLiveAdminDivision(r) : (b.liveDivision || null);
      if (!ld || !ld.renliSeed) return;
      var GMr = (window.GM && GM.renli && GM.renli.byRegion) ? GM.renli.byRegion : null;
      var rid = String(r.id || r.name || '');
      var rg = window.TM && TM.Renli && TM.Renli.forMapRegion ? TM.Renli.forMapRegion(window.GM,r) : (GMr ? GMr[rid] : null);
      var pd = ld.populationDetail || null;
      var alloc = pd && pd.alloc ? pd.alloc : null;
      var pol = rg && rg.levyPolicy ? rg.levyPolicy : null;
      yizheng = bkLan([
        bkRow('役负率', rg && hasDisplayValue(rg.corveeRate) ? Math.round(Number(rg.corveeRate) * 100) + '%' : '', (rg && Number(rg.corveeRate) > 0.35) ? 'zhu' : ''),
        rg && rg.physicalRoleRate != null ? bkRow('全体劳力役占', Math.round(rg.physicalRoleRate*100) + '%') : '',
        bkRow('地力', rg ? rg.soil : ''),
        bkRow('水利', rg ? rg.waterworks : ''),
        bkRow('在耕田亩', rg ? rg.cultivatedLand : ''),
        bkRow('抛荒田亩', rg ? rg.fallowLand : '', 'zhu'),
        bkRow(ld.renliSeed.accounting === 'explicit-ding' ? '岁计粮产' : '本回合粮产', rg ? rg.grainOutput : '', 'jin'),
        rg && rg.otherFoodEquivalent != null ? bkRow('牧渔等食物当量', rg.otherFoodEquivalent + ' 石口粮') : '',
        bkRow(ld.renliSeed.accounting === 'explicit-ding' ? '本地产食缺口' : '缺粮', rg ? rg.foodDeficit : '', 'zhu'),
        // 刀C·官报对照：地方奏报口径（reported·可粉饰）vs 上列真值——瞒报显著则标红示警
        // 失真层S4翻转(拍板①)：失真层开且该地未揭→对照行升为主口径·不泄瞒报%与「实情见上」·揭后照旧对照
        (function(){
          var rep = (window.GM && GM.renli && GM.renli.reported) ? (GM.renli.reported[rid] || (r.name ? GM.renli.reported[r.name] : null)) : null;
          if (!rep) return '';
          var cz = Number(rep.conceal) || 0;
          var RVy = window.TM && TM.ReportedView;
          var _veiledY = RVy && RVy.active(window.P || null) && !RVy.revealed('renli', 'region.' + String(rid || (r && r.name) || ''));
          if (_veiledY) {
            return bkRow('地方奏报', '役负' + Math.round((Number(rep.corveeRate)||0)*100) + '% · 抛荒' + Math.round((Number(rep.fallowShare)||0)*100) + '%　〔诸数皆有司口径·实情须遣员核查〕', '');
          }
          return bkRow('地方奏报', '役负' + Math.round((Number(rep.corveeRate)||0)*100) + '% · 抛荒' + Math.round((Number(rep.fallowShare)||0)*100) + '%' + (cz > 0.12 ? ('　〔瞒报~' + Math.round(cz*100) + '%·实情见上〕') : '　〔与实情相符〕'), cz > 0.12 ? 'zhu' : '');
        })(),
        alloc ? bkRow('丁分配', '务农 ' + ppValue(alloc.farm) + ' · 应役 ' + ppValue(alloc.corvee) + ' · 应征 ' + ppValue(alloc.draft) + ' · 优免 ' + ppValue(alloc.exempt)) : '',
        pd ? bkRow('册载丁', pd.registeredDing) : '',
        pd ? bkRow('优免丁', pd.exemptDing, 'zhu') : '',
        pd ? bkRow('诡寄丁', pd.commendedDing, 'zhu') : '',
        // 逃户、隐户两行户口一节已列，并卷后不再重复
        pol ? bkRow('现行则例', ({light:'轻役',normal:'常役',heavy:'重役'}[pol.strength] || '常役') + (Number(pol.remitTurns) > 0 ? ' · 蠲免余 ' + pol.remitTurns + ' 回合' : '')) : ''
      ], true);
    })();
    // 八卷并六卷（通志一期 S4）：役政并入户口为户役志（役政一节保留 bk-yizheng 锚点），状态收进页头小签
    var huyi = hukou + (yizheng ? '<div class="bk-subjuan" id="bk-yizheng"><div class="bk-subt">役 政<small>徭役农政 · 丁田</small></div>' + yizheng + '</div>' : '');
    var juans = [
      ['bk-hukou', '一', '户役志', yizheng ? '户口簿籍 · 徭役丁田' : '户口簿籍', '户', huyi],
      ['bk-caifu', '二', '财赋志', '岁入库藏', '赋', caifu],
      ['bk-junbei', '三', '军备志', '戎政边防', '军', junbei],
      ['bk-zhiguan', '四', '职官志', '官守治理', '官', zhiguan],
      ['bk-fengwu', '五', '风物志', '物产设施', '物', fengwu],
      ['bk-yingzao', '六', '营造志', '已建之业 · 工役', '营', yingzao]
    ];
    var live = juans.filter(function(j){ return !!j[5]; });
    return bkSpine(regionTitle(r) + ' · 方志') +
      '<div class="bk-inner">' + head + stats +
      '<div class="bk-scroll">' +
        live.map(function(j){ return bkJuan(j[0], j[1], j[2], j[3], j[5]); }).join('') +
      '</div><div class="bk-reassign-slot"></div>' + foot + '</div>' +
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
    pop.removeAttribute('data-circuit-key');
    pop.className = 'tmf-map-ppop tmf-book region-panel show';
    pop.innerHTML = renderRegionBook(r);
    document.body.classList.add('province-panel-open');
    markSelectedRegion(id);
    bindBkSpy(pop);
    bkScrollToTab(pop, state.mapPanelTab);
    syncCircuitOutline();
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
      bkStat('总兵', firstValue(p.troops, runtimeFactionValue(f, 'militaryStrength'), f.militaryStrength), '所辖诸军'),
      bkStat('户口', firstValue(p.regions.length ? p.pop : '', runtimeFactionValue(f, 'population'), f.population), '所辖合计'),
      bkStat('财赋', p.regions.length ? p.revenue : factionFinanceValue(f, p), '钱账'),
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
    if (window.GM && window.GM.publicTreasuryConfig && window.GM.publicTreasuryConfig.schema === 'tm-public-treasury/2' && window.FiscalEngine && window.FiscalEngine.getConsolidatedView) {
      var liveTreasury=window.FiscalEngine.getConsolidatedView({game:window.GM,factionId:f.id||f.name,scope:f.isUnifiedPolity===false?'regional':'central'});
      tre={};['money','grain','cloth'].forEach(function(k){tre[k]=liveTreasury.resources[k].known?liveTreasury.resources[k].stock:'未具数';});
      tre.note=f.isUnifiedPolity===false?'分藏各地，按本地议定用途支给。':'总库与已拨诸署余存合计，仍各按储处掌管。';
    }
    var ecoPol = f.economicPolicy && typeof f.economicPolicy === 'object' ? f.economicPolicy : null;
    var succ = f.succession && typeof f.succession === 'object' ? f.succession : null;
    var fpop = f.population && typeof f.population === 'object' ? f.population : null;
    var annualBudget = currentFactionBudget(f.id || f.name || key);
    var annualFinance = annualBudget ? bkLan([
      bkRow('岁计中枢收入', resourceText(annualBudget.totals.central)),
      bkRow('岁计地方留用', resourceText(annualBudget.totals.localRetain)),
      bkRow('岁计中枢支出', resourceText(annualBudget.expenses.central)),
      bkRow('岁计地方支出', resourceText(annualBudget.expenses.local)),
      annualBudget.expenses.internal ? bkRow('岁计内廷支用', resourceText(annualBudget.expenses.internal)) : '',
      annualBudget.expenses.total ? bkRow('岁计公用总支', resourceText(annualBudget.expenses.total)) : '',
      bkRow('其中养兵', resourceText(annualBudget.expenses.army)),
      bkRow('赋入出处', f.economyDescription)
    ]) : '';
    var caiji = annualFinance + bkLan([
      bkRow('经济', factionFinanceValue(f, p)),
      bkRow('库钱', tre ? tre.money : factionTreasuryValue(f, p)),
      bkRow('库藏粮', firstValue(tre && tre.grain, p.regions.length ? p.grain : '')),
      bkRow('库帛', tre && tre.cloth),
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
    pop.removeAttribute('data-circuit-key');
    pop.className = 'tmf-map-ppop tmf-book faction-panel show';
    pop.innerHTML = renderFactionBook(f, key, r);
    document.body.classList.add('province-panel-open');
    bindBkSpy(pop);
    syncCircuitOutline();
  }

  // ════════ 省道通志（通志一期 S2）══════════════════════════════════
  // 通志是诊断台：辖境按问题轻重排，全道共有的问题上提到道一级说一次。
  // 读数一律由下辖府州实时汇总（TM.MapCircuits），口径与方志读数带相同；
  // 省级节点自带的数字开局后就冻结了，只取它的文字档案。页脚动作只生成诏书建议，不直接改世界。
  var CIRCUIT_BUILDING_CATEGORIES = {
    military: '军事', economic: '经济', cultural: '文教', administrative: '政务',
    religious: '祠祀', infrastructure: '工程', social: '民生', other: '其他'
  };
  var CIRCUIT_ACTIONS = ['整饬吏治', '蠲免', '巡按', '任免'];

  function circuitApi(){
    return (window.TM && TM.MapCircuits) || null;
  }

  // 与地图分组同一口径的归属 key（地图按 canonicalOwnerKey 切分省道）
  function circuitOwnerKey(r){
    return typeof __p.canonicalOwnerKey === 'function' ? __p.canonicalOwnerKey(r) : ownerKey(r);
  }

  // 省道分组依赖地名模块里的 TMMapRealmLayout；归属或隶属一变就重算，同一局面反复开册页时复用
  var _circuitMemo = { map: null, sig: '', index: null };
  function circuitIndex(){
    var MC = circuitApi(), map = getMapData(), layout = window.TMMapRealmLayout;
    if (!MC || !layout || !map || !Array.isArray(map.regions) || !map.regions.length) return null;
    var sig = map.regions.map(function(r){ return circuitOwnerKey(r) + '>' + firstValue(r.parentId, r.circuitId, ''); }).join('|') +
      '#' + JSON.stringify((map.circuitRegistry || []).map(function(e){ return e && [e.key || e.id, (e.memberRegionIds || []).length]; }));
    if (_circuitMemo.map !== map || _circuitMemo.sig !== sig) {
      _circuitMemo = { map: map, sig: sig, index: MC.indexCircuits(map, { layout: layout, ownerOf: circuitOwnerKey }) };
    }
    return _circuitMemo.index;
  }

  // 按 key 或按府州取所属省道；只认正式省道（有登记或不止一州），单州孤块不开通志
  function findCircuit(keyOrRegion){
    var MC = circuitApi(), index = circuitIndex();
    if (!MC || !index) return null;
    var circuit = typeof keyOrRegion === 'string' ? index.circuits.get(keyOrRegion) : MC.circuitOf(index, keyOrRegion);
    return circuit && MC.isRealCircuit(circuit) ? circuit : null;
  }

  // 行政树（活树）按 id 与名称查节点，只用来取省道的文字档案
  function circuitAdminFinder(){
    var byId = {}, byName = {};
    var roots = (window.GM && GM.adminHierarchy) || {};
    function walk(node){
      if (!node || typeof node !== 'object') return;
      if (node.id != null && !byId[node.id]) byId[node.id] = node;
      if (node.name && !byName[node.name]) byName[node.name] = node;
      ['divisions', 'children', 'prefectures'].forEach(function(k){ (Array.isArray(node[k]) ? node[k] : []).forEach(walk); });
    }
    Object.keys(roots).forEach(function(k){ walk(roots[k]); });
    return function(ref){ return (ref && ref.id ? byId[ref.id] : byName[ref && ref.name]) || null; };
  }

  function playerFactionNames(){
    var rail = bridge.rightrail;
    try { return rail && typeof rail.playerFactionNames === 'function' ? rail.playerFactionNames() : []; } catch (_) { return []; }
  }

  // 以谁的眼光看这一道：本道有玩家的州就以玩家为本方，否则以点开的那一州（或第一州）的归属为本方
  function circuitViewer(circuit, clickedRegion){
    var names = playerFactionNames();
    var isPlayer = function(owner){
      var f = findFaction(owner, '');
      return names.indexOf(String(owner)) >= 0 || !!(f && names.indexOf(String(f.name)) >= 0);
    };
    var mine = circuit.members.filter(function(m){ return isPlayer(m.owner); })[0];
    if (mine) return { owner: mine.owner, player: true };
    var anchor = (clickedRegion && circuit.members.filter(function(m){ return m.region === clickedRegion; })[0]) || circuit.members[0];
    return { owner: anchor ? anchor.owner : '', player: false };
  }

  // 一州的建筑：与方志营造志同源（活区划上的 buildings，加旧版按地名登记的兼容账），同名同类只算一座
  function circuitRegionBuildings(r){
    var live = findLiveAdminDivision(r), seen = {}, out = [];
    var divName = firstValue(live && live.name, r && r.name, '');
    function add(bld){
      if (!bld) return;
      var k = String(bld.territory || bld._territory || divName) + '|' + String(bld.type || bld.name || '');
      if (seen[k]) return;
      seen[k] = true;
      out.push(bld);
    }
    if (live && Array.isArray(live.buildings)) live.buildings.forEach(add);
    if (typeof getTerritoryBuildingsCompat === 'function' && hasDisplayValue(divName)) {
      try { getTerritoryBuildingsCompat(String(divName)).forEach(add); } catch (_) {}
    }
    return out;
  }

  function circuitBuildingCategory(bld){
    var bw = window.TM && TM.BuildingWorks;
    var typeDef = bw && typeof bw.typeDefFor === 'function' ? bw.typeDefFor(bld && bld.name, window.P || {}) : null;
    return (typeDef && typeDef.category) || '';
  }

  function circuitCapitalRegion(circuit, profile){
    var name = profile && profile.capital;
    var byName = name ? circuit.members.filter(function(m){ return regionTitle(m.region) === name || m.region.name === name; })[0] : null;
    return byName ? byName.region : null;
  }

  function circuitRegionLink(r, label){
    return '<button type="button" class="bk-circuit-link" data-bk-open-region="' + attr(r.id || r.name || '') + '" title="开其方志">' + esc(label || regionTitle(r)) + '</button>';
  }

  // 卷一 辖境：共性上提后的诊断表；他属之州单列在表下
  function circuitXiajing(MC, own, others){
    var ranked = MC.rankProblems(own, {
      score: modeScore, grade: gradeOf, isWarn: gradeIsWarn,
      statusOf: function(r){ var b = regionBundle(r); return (b.liveDivision && b.liveDivision.statusEffects) || []; },
      unrestOf: function(r){ var b = regionBundle(r), d = b.data || {}; return firstValue(d.unrest, b.liveDivision && b.liveDivision.unrest, ''); }
    });
    var lifted = MC.liftCommonProblems(ranked, {
      populationOf: function(r){ var b = regionBundle(r); return firstValue((b.data || {}).population, b.pop && b.pop.mouths, ''); }
    });
    var common = lifted.common.length
      ? '<div class="bk-circuit-common">全道共性（' + lifted.common[0].count + '/' + own.length + ' 州）：<b>' +
        esc(lifted.common.map(function(c){ return c.label + (c.mark ? ' ' + c.mark : ''); }).join(' · ')) + '</b>。下列各州只标独有的问题。</div>'
      : '';
    var rows = lifted.rows.map(function(row){
      var r = row.region, b = regionBundle(r), d = b.data || {};
      var moodS = moodViewScore(r, b), offS = officeViewScore(r, b);
      var moodG = gradeOf('mood', moodS) || {}, offG = gradeOf('office', offS) || {};
      return '<tr class="' + (row.score > 0 ? 'warn' : '') + '">' +
        '<td class="nm">' + circuitRegionLink(r) + '</td>' +
        '<td class="num">' + esc(ppValue(firstValue(d.population, b.pop && b.pop.mouths, '—'))) + '</td>' +
        '<td class="num">' + esc(ppValue(firstValue(b.fiscal && b.fiscal.actualRevenue, '—'))) + '</td>' +
        '<td class="num">' + esc(ppValue(firstValue(d.garrison, b.army && b.army.troops, r.troops, '—'))) + '</td>' +
        '<td class="num">' + esc(hasDisplayValue(moodS) ? moodS : '—') + (moodG.mark ? '<i>' + esc(moodG.mark) + '</i>' : '') + '</td>' +
        '<td class="num">' + esc(hasDisplayValue(offS) ? offS : '—') + (offG.mark ? '<i>' + esc(offG.mark) + '</i>' : '') + '</td>' +
        '<td class="why">' + (row.reasons.length ? esc(row.reasons.join('；')) : '<span class="dim">—</span>') + '</td>' +
      '</tr>';
    }).join('');
    var table = rows
      ? '<div class="bk-circuit-table"><table><thead><tr><th>府州</th><th class="num">户口</th><th class="num">实征</th><th class="num">驻军</th><th class="num">民心</th><th class="num">吏治</th><th>主因</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '';
    var otherLines = others.map(function(g){
      var name = firstValue(g.regions[0] && ownerName(g.regions[0]), g.owner);
      return '<div class="bk-circuit-other">隶 <b>' + esc(name) + '</b>：' + g.regions.map(function(r){ return circuitRegionLink(r); }).join('、') + '</div>';
    }).join('');
    return common + table + otherLines;
  }

  // 叙述文字与拼好的读数直接转义显示：bkRow 走 ppValue，会把含势力名的整句换成势力名
  // （「后金破宣府大同塞入塞；……」只剩「后金」）
  function circuitTextRow(k, v, tone){
    if (!hasDisplayValue(v)) return '';
    var s = String(v);
    return '<div class="bk-lr"><span class="bk-k">' + esc(k) + '</span><span class="bk-v ' + (tone || '') + (s.length > 14 ? ' wrap' : '') + '">' + esc(s) + '</span></div>';
  }

  // 卷二 形势：战略、边警、灾异蔓延；士绅与书院
  function circuitXingshi(profile, own){
    var disasters = own.filter(function(r){
      var b = regionBundle(r);
      return ((b.liveDivision && b.liveDivision.statusEffects) || []).some(function(e){ return e && e.kind === 'disaster'; });
    });
    return bkLan([
      circuitTextRow('战略', profile.strategicValue),
      circuitTextRow('边警', profile.threats.join('；'), profile.threats.length ? 'zhu' : ''),
      circuitTextRow('灾异', disasters.length ? disasters.map(function(r){ return regionTitle(r); }).join('、') : '本回合各州无灾异', disasters.length ? 'zhu' : ''),
      circuitTextRow('士绅', profile.gentry.join('、')),
      circuitTextRow('书院', profile.academies.join('、'))
    ], true);
  }

  // 卷三 财计：实征与合规、起运留用、各州公帑合计、掌藏记
  function circuitCaiji(sum, profile){
    var moneyUnit = (window.P && P.fiscalConfig && P.fiscalConfig.unit && P.fiscalConfig.unit.money) || '两';
    return bkLan([
      circuitTextRow('实征', ppValue(sum.actualRevenue) + (sum.compliance != null ? '　合规 ' + Math.round(sum.compliance * 100) + '%' : '')),
      circuitTextRow('起运 / 留用', ppValue(sum.remittedToCenter) + ' / ' + ppValue(sum.retainedBudget)),
      circuitTextRow('公帑', '银 ' + ppValue(sum.treasury.money) + ' ' + moneyUnit + ' · 粮 ' + ppValue(sum.treasury.grain) + '（各州库藏合计）'),
      circuitTextRow('掌藏记', profile.custodyNote)
    ], true) + bkBar('起运与留用', [['起运', sum.remittedToCenter, 'var(--gold-600)'], ['留用', sum.retainedBudget, 'rgba(var(--gold-550-rgb),.45)']], '本道一期只汇总展示，不单独记账');
  }

  // 卷四 营造：本道全部建筑，只作集成展示；首府的建筑单独标出
  function circuitYingzao(MC, own, capital){
    var types = window.P && P.buildingSystem && (P.buildingSystem.buildingTypes || P.buildingSystem.types);
    var sum = MC.summarizeBuildings(own, { buildingsOf: circuitRegionBuildings, categoryOf: circuitBuildingCategory });
    if (!sum.total) {
      return '<p class="bk-ye-empty">' + (Array.isArray(types) && types.length ? '本道各州尚无在册工役。' : '本剧本未设营造。') + '</p>';
    }
    var cats = Object.keys(sum.byCategory).map(function(k){ return (CIRCUIT_BUILDING_CATEGORIES[k] || k) + ' ' + sum.byCategory[k]; }).join(' · ');
    var st = sum.byStatus;
    var head = bkLan([
      circuitTextRow('在册', sum.total + ' 座：完好 ' + st.intact + '、在建 ' + st.building + '、失修 ' + st.neglected + '、半损 ' + st.damaged, (st.neglected || st.damaged) ? 'zhu' : ''),
      circuitTextRow('类别', cats)
    ], true);
    var groups = sum.byRegion.map(function(g){
      var names = g.buildings.map(function(bld){
        var tag = bld.status === 'building' ? '（在建）' : bld.status === 'neglected' ? '（失修）' : bld.status === 'damaged' ? '（半损）' : '';
        return esc(bld.name) + (bld.level > 1 ? ' ' + esc(bld.level) + '级' : '') + tag;
      }).join('、');
      return '<div class="bk-circuit-yz">' + circuitRegionLink(g.region) + (g.region === capital ? '<em>首府</em>' : '') + '<span>' + names + '</span></div>';
    }).join('');
    return head + groups;
  }

  function circuitOfficialCard(profile, own, sum){
    if (!hasDisplayValue(profile.officialPosition) && !hasDisplayValue(profile.title)) return '';
    var role = firstValue(profile.officialPosition, profile.title, '长官');
    var who = hasDisplayValue(profile.governor) ? profile.governor : '未录';
    var subs = own.every(function(r){ var d = regionBundle(r).data || {}; return !!d.governorUnrecorded; }) ? '下辖各州主官均未载姓名' : '下辖各州主官见各州方志';
    return '<div class="bk-circuit-official"><span class="role">' + esc(role) + '</span><b>' + esc(who) + '</b>' +
      '<span class="line">统辖本道 ' + sum.count + ' 府州；' + subs + '</span></div>';
  }

  function renderCircuitBook(circuit, clickedRegion){
    var MC = circuitApi();
    var viewer = circuitViewer(circuit, clickedRegion);
    var split = MC.partitionByOwner(circuit, viewer.owner);
    var own = split.own;
    var profile = MC.profileOf(circuit, { findAdmin: circuitAdminFinder() });
    var sum = MC.summarize(own, { bundle: regionBundle, mood: moodViewScore, office: officeViewScore });
    var capital = circuitCapitalRegion(circuit, profile);
    var ownerLabel = firstValue(own[0] && ownerName(own[0]), viewer.owner, '');
    var moodG = gradeOf('mood', sum.mood), offG = gradeOf('office', sum.office);

    var head = bkHead({
      seal: '御览', round: false, kind: '通 志',
      crumbs: (hasDisplayValue(ownerLabel) ? '<button type="button" data-bk-open-faction="' + attr(viewer.owner) + '">' + esc(ownerLabel) + '</button><span>›</span>' : '') + '<b>' + esc(circuit.label) + '</b>',
      name: circuit.label,
      sub: '省道 · 辖 ' + circuit.members.length + ' 府州' + (hasDisplayValue(profile.capital) ? ' · 治所 ' + profile.capital : ''),
      desc: firstValue(profile.description, profile.note, ''),
      pills: [
        hasDisplayValue(ownerLabel) ? '<span class="bk-pill owner" data-bk-open-faction="' + attr(viewer.owner) + '" title="展其谱牒"><span class="dot"></span>隶 <b>' + esc(ownerLabel) + '</b></span>' : '',
        '<span class="bk-pill">实控 <b>' + own.length + '/' + circuit.members.length + '</b> 州</span>',
        capital ? '<span class="bk-pill" data-bk-open-region="' + attr(capital.id || capital.name || '') + '" title="开治所方志">治所 <b>' + esc(regionTitle(capital)) + '</b></span>' : '',
        viewer.player ? '' : '<span class="bk-pill hostile">他方所辖</span>'
      ]
    });
    var stats = bkStats([
      bkStat('户口', sum.population, sum.ding ? '丁 ' + ppValue(sum.ding) : '', false, ''),
      bkStat('实征', sum.actualRevenue, '起运 ' + ppValue(sum.remittedToCenter), false, ''),
      bkStat('驻军', sum.troops, sum.garrisoned + ' 州有驻', false, ''),
      bkStat('民心', sum.mood == null ? '' : sum.mood, (moodG || {}).mark || '', gradeIsWarn('mood', moodG), ''),
      bkStat('吏治', sum.office == null ? '' : sum.office, (offG || {}).mark || '', gradeIsWarn('office', offG), '')
    ]);
    var juans = [
      ['bk-circuit-xiajing', '一', '辖境', '按问题轻重 · 点州开方志', '境', own.length ? circuitXiajing(MC, own, split.others) : ''],
      ['bk-circuit-xingshi', '二', '形势', '战略边警 · 士绅书院', '势', circuitXingshi(profile, own)],
      ['bk-circuit-caiji', '三', '财计', '实征起运 · 公帑', '财', own.length ? circuitCaiji(sum, profile) : ''],
      ['bk-circuit-yingzao', '四', '营造', '本道建筑 · 只作汇览', '营', own.length ? circuitYingzao(MC, own, capital) : '']
    ];
    var live = juans.filter(function(j){ return !!j[5]; });
    var acts = viewer.player
      ? CIRCUIT_ACTIONS.map(function(act){ return '<button type="button" class="bk-act zhu" data-bk-circuit-act="' + attr(act) + '">' + esc(act.split('').join(' ')) + '</button>'; }).join('')
      : '';
    // 调整辖区（S6）：本方省道在四个动作下另起一行，点开本道各州的改隶候选与邻道可划入之州
    var reassignBtn = viewer.player && reassignApi() ? '<div class="bk-foot-more"><button type="button" class="bk-act" data-bk-reassign-open="circuit">调 整 辖 区</button></div>' : '';
    var foot = '<div class="bk-foot' + (reassignBtn ? ' bk-foot-region' : '') + '">' +
      (reassignBtn ? '<div class="bk-foot-acts">' + acts + '</div>' + reassignBtn : acts) +
      (!viewer.player && hasDisplayValue(ownerLabel) ? '<button type="button" class="bk-act" data-bk-open-faction="' + attr(viewer.owner) + '">展 势 力 谱</button>' : '') +
      '</div>';
    return bkSpine(circuit.label + ' · 通志') +
      '<div class="bk-inner">' + head + stats +
      '<div class="bk-scroll">' + circuitOfficialCard(profile, own, sum) +
        live.map(function(j){ return bkJuan(j[0], j[1], j[2], j[3], j[5]); }).join('') +
      '</div><div class="bk-reassign-slot"></div>' + foot + '</div>' +
      bkJianqian(live.map(function(j){ return [j[0], j[4]]; })) +
      '<div class="bk-straddle"><i>验讫</i></div>';
  }

  // 打开通志：key 可以是省道 key，也可以直接给一个府州（开它所属的省道）
  function openCircuitDossier(keyOrRegion, clickedRegion){
    var circuit = findCircuit(keyOrRegion);
    if (!circuit) {
      if (typeof toast === 'function') toast(circuitApi() && window.TMMapRealmLayout ? '此地未隶正式省道' : '舆图分组尚未就绪');
      return false;
    }
    var region = clickedRegion || (typeof keyOrRegion === 'object' ? keyOrRegion : null);
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'circuit';
    pop.dataset.circuitKey = circuit.key;
    pop.removeAttribute('data-region-id');
    pop.removeAttribute('data-faction-key');
    pop.className = 'tmf-map-ppop tmf-book circuit-panel show';
    pop.innerHTML = renderCircuitBook(circuit, region);
    document.body.classList.add('province-panel-open');
    bindBkSpy(pop);
    // 整道描金边代替单州选中
    markSelectedRegion(null);
    syncCircuitOutline();
    return true;
  }

  // 页脚动作：写进诏书建议库（与右栏同一个写入口），范围写明本道各州；下诏后才生效
  function circuitActionText(act, circuit, profile, names){
    var head = firstValue(profile.officialPosition, '本道长官') + (hasDisplayValue(profile.governor) ? profile.governor : '');
    var scope = '（本道 ' + names.length + ' 府州：' + names.join('、') + '）';
    if (act === '整饬吏治') return '命' + head + '整饬' + circuit.label + '吏治，考核属吏、劾罢贪墨，限期具奏' + scope + '。';
    if (act === '蠲免') return '议蠲' + circuit.label + '各州部分钱粮赋役以苏民困，额数与期限由户部会议具奏' + scope + '。';
    if (act === '巡按') return '遣御史巡按' + circuit.label + '，察吏治、问民瘼、核钱粮，据实以闻' + scope + '。';
    return '议' + circuit.label + '长官任免：召' + head + '述职，由吏部会推人选具奏。';
  }
  function circuitAction(key, act){
    var circuit = findCircuit(key), MC = circuitApi();
    if (!circuit || CIRCUIT_ACTIONS.indexOf(act) < 0) return false;
    var viewer = circuitViewer(circuit, null);
    if (!viewer.player) return false;
    var own = MC.partitionByOwner(circuit, viewer.owner).own;
    var profile = MC.profileOf(circuit, { findAdmin: circuitAdminFinder() });
    var names = own.map(function(r){ return regionTitle(r); });
    var rail = bridge.rightrail;
    var ok = !!(rail && typeof rail.addEdictSuggestion === 'function' &&
      rail.addEdictSuggestion('行政区划', circuit.label, '通志·' + act, circuitActionText(act, circuit, profile, names)));
    if (typeof toast === 'function') toast(ok ? '已录入诏令建议库：' + circuit.label + act : '诏令建议库未就绪');
    return ok;
  }

  // ════════ 地图交互（通志一期 S3）：点击随层级、右键小菜单、整道描金边、地图签注 ════════
  // 点地块开哪一册在这里定；地图模块只把点到的地块交过来（origin forward shim：openTierDossier、openMapContextMenu、mapTipHtml）。
  var GRADE_BANDS = __p.GRADE_BANDS, mapReported = __p.mapReported;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ── 点击随层级 ──
  // 左键：天下级开势力谱牒，省道级开通志，府州级开方志；省道级点到不属正式省道的孤块，照旧开方志。
  // 设置「舆图点击」可切回旧习惯「左键一律开方志」，存在 P.conf.mapClickFollowTier（没设过就是随层级）。
  function mapClickFollowsTier(){
    var conf = window.P && window.P.conf;
    return !(conf && conf.mapClickFollowTier === false);
  }
  function clickTier(){
    return mapClickFollowsTier() ? state.mapScale : 'prefecture';
  }
  // tier 可以显式给（点省名时一律按省道级），不给就取当前层级
  function openTierDossier(r, tier){
    if (!r) return false;
    tier = tier || clickTier();
    if (tier === 'realm' && ownerKey(r)) return openFactionDossier(ownerKey(r), r);
    if (tier === 'region' && findCircuit(r)) return openCircuitDossier(r, r);
    return openRegionDossier(r);
  }

  // ── 右键小菜单：本州方志、本道通志、本国谱牒 ──
  // 挂在舆图外框上（与签注同一容器），不进地图舞台，免得菜单上的点击又被当成点地块。
  // 键盘：打开即聚焦第一项，上下键移动，回车或空格选中，Esc 关闭并还焦点，Tab 关闭；
  // 点菜单外、滚轮、窗口缩放或失焦都关闭。
  var _mapCtx = null;
  function mapContextItems(r){
    var items = [{ act: 'region', label: '本州方志', name: regionTitle(r) }];
    var circuit = findCircuit(r);
    if (circuit) items.push({ act: 'circuit', label: '本道通志', name: circuit.label });
    if (ownerKey(r)) items.push({ act: 'faction', label: '本国谱牒', name: ownerName(r) || ownerKey(r) });
    return items;
  }
  function closeMapContextMenu(restoreFocus){
    var ctx = _mapCtx;
    if (!ctx) return;
    _mapCtx = null;
    document.removeEventListener('pointerdown', ctx.onOutside, true);
    document.removeEventListener('wheel', ctx.onOutside, true);
    window.removeEventListener('resize', ctx.onDismiss);
    window.removeEventListener('blur', ctx.onDismiss);
    if (ctx.menu.parentNode) ctx.menu.parentNode.removeChild(ctx.menu);
    if (restoreFocus && ctx.focus && ctx.focus.isConnected && typeof ctx.focus.focus === 'function') {
      try { ctx.focus.focus({ preventScroll: true }); } catch (_) {}
    }
  }
  function runMapContextItem(act, r){
    closeMapContextMenu(false);
    if (act === 'region') return openRegionDossier(r);
    if (act === 'circuit') return openCircuitDossier(r, r);
    if (act === 'faction') return openFactionDossier(ownerKey(r), r);
    return false;
  }
  function openMapContextMenu(r, e){
    closeMapContextMenu(false);
    if (!r) return null;
    var tip = document.getElementById('tmf-map-tip');
    var host = (tip && tip.parentElement) || document.body;
    if (tip) tip.classList.remove('show');
    // 菜单开着时签注停更，山河境的悬停高亮落在右键点中的这一州上
    if (window.TMShanheRuntime && typeof TMShanheRuntime.setHovered === 'function') TMShanheRuntime.setHovered(String(r.id || r.name || ''));
    var menu = document.createElement('div');
    menu.id = 'tmf-map-ctx';
    menu.className = 'tmf-map-ctx';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', regionTitle(r) + ' · 册页');
    menu.innerHTML = '<div class="ctx-title">' + esc(regionTitle(r)) + '</div>' +
      mapContextItems(r).map(function(it){
        return '<button type="button" role="menuitem" data-map-ctx="' + attr(it.act) + '"><b>' + esc(it.label) + '</b><span>' + esc(it.name || '') + '</span></button>';
      }).join('');
    host.appendChild(menu);
    // 与签注同一套定位：正式界面整体缩放，按容器实际比例换算指针坐标
    if (e && typeof __p.positionMapTip === 'function') __p.positionMapTip(menu, e);
    var buttons = Array.prototype.slice.call(menu.querySelectorAll('[data-map-ctx]'));
    var ctx = { menu: menu, focus: document.activeElement };
    ctx.onOutside = function(ev){ if (!menu.contains(ev.target)) closeMapContextMenu(false); };
    ctx.onDismiss = function(){ closeMapContextMenu(false); };
    // 菜单上的指针与滚轮事件不往外传：外框上挂着拖图与缩放
    ['pointerdown', 'mousedown', 'wheel', 'dblclick'].forEach(function(type){
      menu.addEventListener(type, function(ev){ ev.stopPropagation(); });
    });
    menu.addEventListener('contextmenu', function(ev){ ev.preventDefault(); ev.stopPropagation(); });
    menu.addEventListener('click', function(ev){
      ev.stopPropagation();
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-map-ctx]') : null;
      if (btn) runMapContextItem(btn.getAttribute('data-map-ctx'), r);
    });
    menu.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        closeMapContextMenu(true);
      } else if (ev.key === 'Tab') {
        closeMapContextMenu(false);
      } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        var i = buttons.indexOf(document.activeElement), step = ev.key === 'ArrowDown' ? 1 : -1;
        buttons[(i + step + buttons.length) % buttons.length].focus();
      }
    });
    document.addEventListener('pointerdown', ctx.onOutside, true);
    document.addEventListener('wheel', ctx.onOutside, true);
    window.addEventListener('resize', ctx.onDismiss);
    window.addEventListener('blur', ctx.onDismiss);
    _mapCtx = ctx;
    if (buttons[0]) {
      try { buttons[0].focus({ preventScroll: true }); } catch (_) { buttons[0].focus(); }
    }
    return menu;
  }

  // ── 整道描金边 ──
  // 通志开着时，给本道所有州（不分归属）的外沿描一道金边。外轮廓取 TMMapRealmLayout.boundaryMesh：
  // 成员放进同一组，州与州之间的共享边正反相消，只剩外沿（飞地、海岛各成一圈）。
  // SVG 图上画一条覆盖描边；山河境由其焦点层照同一条轮廓画。改隶后成员变了，按成员重算。
  var _circuitOutline = { sig: '', d: '', node: null };
  function circuitOutlineFor(circuit){
    var G = window.TMMapRealmLayout;
    if (!circuit || !G || typeof G.boundaryMesh !== 'function') return '';
    var sig = circuit.key + '|' + circuit.members.map(function(m){ return m.region.id || m.region.name; }).join(',');
    if (sig !== _circuitOutline.sig) {
      var items = circuit.members.map(function(m){ return { region: m.region, owner: 'circuit', group: 'circuit' }; });
      var mesh = G.boundaryMesh(items, 'circuit-outline');
      _circuitOutline.sig = sig;
      _circuitOutline.d = (mesh && mesh.major) || '';
    }
    return _circuitOutline.d;
  }
  function openCircuitKey(){
    var pop = document.getElementById('ppop');
    if (!pop || !pop.classList.contains('show') || pop.dataset.panelKind !== 'circuit') return '';
    return pop.dataset.circuitKey || '';
  }
  // 开册页、关册页、换层、重画之后都调一次；幂等
  function syncCircuitOutline(){
    var key = openCircuitKey(), circuit = key ? findCircuit(key) : null;
    var d = circuit ? circuitOutlineFor(circuit) : '';
    var stage = typeof __p.mapStage === 'function' ? __p.mapStage() : null;
    var world = d && stage ? stage.querySelector('#tmf-formal-map #tmf-map-world') : null;
    var node = _circuitOutline.node;
    // 预备层换下来的那张图不在文档里，查不到，所以记住挂上去的节点直接摘
    if (node && (node.parentNode !== world || node.getAttribute('data-circuit-key') !== key || node.getAttribute('data-outline') !== _circuitOutline.sig)) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node = _circuitOutline.node = null;
    }
    if (world && !node) {
      // 属性先写好再挂上：山河境盯着这张图的属性变化，挂上之后再改 d 会让它整张重采
      node = document.createElementNS(SVG_NS, 'g');
      node.setAttribute('class', 'tmf-circuit-outline');
      node.setAttribute('pointer-events', 'none');
      node.setAttribute('data-circuit-key', key);
      node.setAttribute('data-outline', _circuitOutline.sig);
      ['halo', 'line'].forEach(function(cls){
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', cls);
        path.setAttribute('d', d);
        node.appendChild(path);
      });
      world.insertBefore(node, world.querySelector('.tmf-map-grain'));
      _circuitOutline.node = node;
    }
    if (window.TMShanheRuntime && typeof TMShanheRuntime.setSelectedOutline === 'function') TMShanheRuntime.setSelectedOutline(d || null);
  }

  // ── 地图签注（自 phase8-formal-map.js 迁入，正文未改；页脚改为按层级写明左键开哪一册）──
  function mapTipFoot(r){
    var tier = clickTier();
    var left = tier === 'realm' && ownerKey(r) ? '左键 展谱牒' : (tier === 'region' && findCircuit(r) ? '左键 开通志' : '左键 翻方志');
    return '<div class="tip-foot"><em>' + left + '</em><em>右键 选册页</em></div>';
  }
  // 签注内容（2026-06-11）：hover 小笺按视图给核心读数 + 判语
  function _tipRow(k, v, tone){
    if (!hasDisplayValue(v)) return '';
    return '<div class="tip-row"><span class="tip-k">' + esc(k) + '</span><span class="tip-v ' + (tone || '') + '">' + esc(ppValue(v)) + '</span></div>';
  }
  // 「机动兵力」兜底——地块无逐块驻军实体、但所属势力有军力时，显势力机动军力，免得游牧/无常驻势力图上显 0/空。
  // 跨朝代通用：游牧（部落/游牧）显「机动兵力」，其余有军力无驻军的抽象/海外势力显「势力军力」。地块归地块、势力归势力，驻军栏本身不动。
  function _mobileForceRow(r, b){
    if (!r) return '';
    var data = (b && b.data) || {};
    var localGarrison = firstValue(data.garrison, b && b.army && b.army.troops, r && r.troops);
    if (Number(localGarrison) > 0) return '';   // 本地有真驻军(>0)才让位；0/空=无常驻实体，游牧仍显机动兵力（察哈尔 troops 显式为 0）
    var f = findFaction(ownerKey(r), r.factionName || r.ownerName);
    var ms = f && Number(firstValue(f.militaryStrength, f.military));
    if (!f || !isFinite(ms) || ms <= 0) return '';
    var nomad = /部落|游牧|游猎/.test(String(f.type || '') + String((f.traits || []).join('')));
    return _tipRow(nomad ? '机动兵力' : '势力军力', ms);
  }
  function mapTipVerdict(mode, r, b, score){
    var data = b.data || {};
    var n = Number(score);
    if (mode === 'mood') {
      var fug = hasDisplayValue(b.pop.fugitives) ? '，逃户 ' + ppValue(b.pop.fugitives) : '';
      if (!isFinite(n)) return ['民情无册可稽。', ''];
      if (n < 35) return ['民心 ' + n + '——已成干柴' + fug + '，一火即燃。', 'wei'];
      if (n < 50) return ['民心 ' + n + '——民力已竭' + fug + '，有生变之虞。', 'wei'];
      if (n < 65) return ['民心 ' + n + '——尚可支吾，不宜再加赋扰役。', ''];
      return ['民心 ' + n + '——黎庶安业，可为根本之地。', 'an'];
    }
    if (mode === 'army') {
      var note = firstValue(data.armyPressure, data.borderRisk, data.warRisk, data.threats);
      var noteTxt = hasDisplayValue(note) ? '（' + ppValue(note) + '）' : '';
      if (n >= 80) return ['边警之地' + noteTxt + '——宜厚饷固防，不可抽兵。', 'wei'];
      if (n >= 60) return ['有警之地' + noteTxt + '——守备勿弛。', 'wei'];
      if (n >= 40) return ['守备之地' + noteTxt + '。', ''];
      return ['腹里安靖——可酌减冗兵以纾饷。', 'an'];
    }
    if (mode === 'office') {
      var vac = Number(firstValue(data.officeVacancy, data.vacancy));
      var vacTxt = isFinite(vac) && vac > 0 ? '，官缺 ' + vac + ' 员' : '';
      if (n >= 80) return ['吏治已蠹' + vacTxt + '——非大狱不能清。', 'wei'];
      if (n >= 60) return ['吏治浑浊' + vacTxt + '——赋税多漏，政令多阻。', 'wei'];
      if (n >= 40) return ['吏治平平' + vacTxt + '——犹可整饬。', ''];
      return ['吏治清明——可为他省式范。', 'an'];
    }
    if (mode === 'tax') {
      if (score === '' || score === null || !isFinite(n)) return ['此地免科或未设税制——不入岁入之算。', ''];
      var skim = ratio01(b.fiscal.skimmingRate);
      var skimTxt = skim !== null && skim > 0 ? '，截留 ' + Math.round(skim * 100) + '%' : '';
      if (n < 50) return ['实征不及应征之半' + skimTxt + '——欠征之地。', 'wei'];
      if (n < 70) return ['足额率 ' + n + '%' + skimTxt + '——征解有漏。', ''];
      if (n < 85) return ['足额率 ' + n + '%' + skimTxt + '——大体可观。', ''];
      return ['足额率 ' + n + '%——足额上仓之地。', 'an'];
    }
    if (mode === 'classPressure') {
      var cp = classPressureForRegion(r);
      if (cp.count <= 0 && !(Number(cp.score) > 0)) return ['阶层账本于此地无近压。', 'an'];
      return ['阶层压力 ' + ppValue(cp.score) + (cp.classNames.length ? '——牵动 ' + cp.classNames.join('、') : '') + '。', Number(cp.score) >= 50 ? 'wei' : ''];
    }
    if (mode === 'yizheng') {
      if (!isFinite(n)) return ['役政无册可稽（未行人力之政）。', ''];
      if (n >= 55) return ['役负 ' + n + '——苛役之地，丁多逃隐，田将抛荒。', 'wei'];
      if (n >= 35) return ['役负 ' + n + '——徭役偏重，宜蠲减或募役折银。', 'wei'];
      if (n >= 20) return ['役负 ' + n + '——尚在可支之间。', ''];
      return ['役负 ' + n + '——轻徭薄赋，民得安耕。', 'an'];
    }
    return ['', ''];
  }
  function mapTipHtml(r){
    var b = regionBundle(r);
    var data = b.data || {};
    var mode = (state.mapMode && state.mapMode !== 'owner' && GRADE_BANDS[state.mapMode]) ? state.mapMode : 'owner';
    var rows = '';
    if (mode === 'owner') {
      rows = _tipRow('归属', ownerName(r)) +
        _tipRow('主官', firstValue(data.governor, data.official)) +
        _tipRow('驻军', firstValue(data.garrison, b.army.troops, r && r.troops)) +
        _mobileForceRow(r, b) +
        _tipRow('民心', mapReported('minxin', r, firstValue(data.minxinLocal, r && r.mood), 'good'));
      return '<b>' + esc(regionTitle(r)) + '</b><span class="tip-owner">' + esc(ownerName(r) || '') + '</span>' +
        '<div class="tip-body">' + rows + '</div>' +
        mapTipFoot(r);
    }
    var score = modeScore(r, mode);
    var grade = gradeOf(mode, score);
    var verdict = mapTipVerdict(mode, r, b, score);
    if (mode === 'mood') {
      rows = _tipRow('民心', score, gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('逃户', b.pop.fugitives, 'zhu') +
        _tipRow('灾异', firstValue(data.recentDisasters, (data.economyBase || {}).disasterRecord)) +
        _tipRow('不稳', data.unrest);
    } else if (mode === 'army') {
      rows = _tipRow('军压', grade ? grade.mark + ' · ' + ppValue(score) : score, gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('驻军', firstValue(data.garrison, b.army.troops, r && r.troops)) +
        _mobileForceRow(r, b) +
        _tipRow('城防', firstValue(data.fortification, b.army.fortification)) +
        _tipRow('边警', firstValue(data.borderRisk, data.warRisk, data.threats), 'zhu');
    } else if (mode === 'office') {
      rows = _tipRow('贪腐', firstValue(data.corruptionLocal, data.corruption), gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('主官', firstValue(data.governor, data.official)) +
        _tipRow('官缺', firstValue(data.officeVacancy, data.vacancy)) +
        _tipRow('执行', firstValue(data.policyExecution, data.execution));
    } else if (mode === 'tax') {
      rows = _tipRow('应征', b.fiscal.claimedRevenue) +
        _tipRow('实征', b.fiscal.actualRevenue) +
        _tipRow('合规', hasDisplayValue(b.fiscal.compliance) ? pctValue(b.fiscal.compliance) : '') +
        _tipRow('截留', hasDisplayValue(b.fiscal.skimmingRate) ? pctValue(b.fiscal.skimmingRate) : '', 'zhu');
    } else if (mode === 'classPressure') {
      var cp = classPressureForRegion(r);
      rows = _tipRow('压力', cp.score, Number(cp.score) >= 50 ? 'zhu' : '') +
        _tipRow('牵动', cp.classNames.join('、')) +
        _tipRow('近因', cp.reason);
    } else if (mode === 'yizheng') {
      var GMv = (typeof GM !== 'undefined' && GM) ? GM : ((typeof window !== 'undefined' && window.GM) ? window.GM : null);
      var rgv = (GMv && GMv.renli && GMv.renli.byRegion) ? (window.TM && TM.Renli && TM.Renli.forMapRegion ? TM.Renli.forMapRegion(GMv,r) : GMv.renli.byRegion[(r && (r.id || r.regionId || r.name)) || '']) : null;
      rows = _tipRow('役负', grade ? grade.mark + ' · ' + (isFinite(Number(score)) ? Number(score) + '%' : '—') : score, gradeIsWarn(mode, grade) ? 'zhu' : '') +
        _tipRow('抛荒', rgv && hasDisplayValue(rgv.fallowLand) && Number(rgv.fallowLand) > 0 ? ppValue(rgv.fallowLand) + ' 亩' : '') +
        _tipRow('逃户', b.pop.fugitives, 'zhu') +
        _tipRow('地力', rgv && hasDisplayValue(rgv.soil) ? ppValue(rgv.soil) : '');
    }
    return '<b>' + esc(regionTitle(r)) + '</b><span class="tip-owner">' + esc(ownerName(r) || '') + '</span>' +
      '<div class="tip-body">' + rows + '</div>' +
      (verdict[0] ? '<div class="tip-verdict ' + verdict[1] + '">' + esc(verdict[0]) + '</div>' : '') +
      mapTipFoot(r);
  }

  // ── 回填 origin forward shim 目标（5 函数）──
  __p.regionBundle = regionBundle;
  __p.openRegionDossier = openRegionDossier;
  __p.openFactionDossier = openFactionDossier;
  __p.closeMapDossier = closeMapDossier;
  __p.factionOwnsRegion = factionOwnsRegion;
  // 通志（S2）：地图模块的册页刷新与 bridge.map 经这里调用
  __p.openCircuitDossier = openCircuitDossier;
  __p.circuitAction = circuitAction;
  __p.findCircuit = findCircuit;
  // 地图交互（S3）：点击随层级、右键小菜单、整道描金边、签注
  __p.openTierDossier = openTierDossier;
  __p.openMapContextMenu = openMapContextMenu;
  __p.closeMapContextMenu = closeMapContextMenu;
  __p.syncCircuitOutline = syncCircuitOutline;
  __p.mapTipHtml = mapTipHtml;
  // 方志轻调（S4）：页脚诏书动作
  __p.regionAction = regionAction;
  // 改隶（S6）：入口只生成诏书建议
  __p.reassignSuggest = reassignSuggest;
  __p.regionReassignPanel = regionReassignPanel;
  __p.circuitReassignPanel = circuitReassignPanel;
})();
