// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// EndTurn 省级经济模块（从 tm-endturn.js 拆分）
// 包含：initProvinceEconomy, updateProvinceEconomy, 省级政策,
//       省级面板, appointGovernor
// Requires: tm-utils.js, tm-endturn-helpers.js
// ============================================================


// ============================================================
// 省级经济系统 - 借鉴 HistorySimAI
// ============================================================

/**
 * 初始化省级经济数据 — 优先从行政区划(P.adminHierarchy)创建，回退到territories
 */
function initProvinceEconomy() {
  if (!GM.provinceStats) GM.provinceStats = {};

  // 辅助：从行政区划树收集叶级或指定级别节点
  function _collectAdminDivisions(divs, factionName) {
    var result = [];
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      // 有子节点→递归；叶节点→作为省份
      if (d.children && d.children.length > 0) {
        result = result.concat(_collectAdminDivisions(d.children, factionName));
      } else {
        result.push({
          name: d.name,
          owner: factionName,
          households: d.households || 0,
          population: d.population || (50000 + Math.floor(random() * 50000)),
          wealth: d.prosperity || (50 + Math.floor(random() * 30)),
          stability: 60 + Math.floor(random() * 20),
          development: d.prosperity ? Math.round(d.prosperity * 0.8) : (40 + Math.floor(random() * 30)),
          taxRevenue: 0,
          militaryRecruits: 0,
          unrest: 10 + Math.floor(random() * 20),
          corruption: 20 + Math.floor(random() * 30),
          terrain: d.terrain || '',
          specialResources: d.specialResources || '',
          governor: d.governor || '',
          taxLevel: d.taxLevel || '中'
        });
      }
    }
    return result;
  }

  // 尝试从行政区划加载
  var _adminUsed = false;
  if (P.adminHierarchy) {
    var _adminKeys = Object.keys(P.adminHierarchy);
    _adminKeys.forEach(function(fk) {
      var ah = P.adminHierarchy[fk];
      if (!ah || !ah.divisions || ah.divisions.length === 0) return;

      // 推断势力名称
      var factionName = '';
      if (fk === 'player' && P.playerInfo) {
        factionName = P.playerInfo.factionName || '';
      } else {
        var _fac = GM.facs ? GM.facs.find(function(f) { return f.id === fk || f.name === fk; }) : null;
        if (_fac) factionName = _fac.name;
      }
      if (!factionName) return;

      var provinces = _collectAdminDivisions(ah.divisions, factionName);
      provinces.forEach(function(p) {
        if (!GM.provinceStats[p.name]) {
          GM.provinceStats[p.name] = p;
          _adminUsed = true;
          // 同步到势力territories
          var _f = GM.facs ? GM.facs.find(function(f) { return f.name === factionName; }) : null;
          if (_f) {
            if (!_f.territories) _f.territories = [];
            if (_f.territories.indexOf(p.name) === -1) _f.territories.push(p.name);
          }
        }
      });
    });
  }

  // 回退：从势力territories创建
  GM.facs.forEach(function(faction) {
    if (!faction.territories || faction.territories.length === 0) {
      faction.territories = [faction.capital || faction.name];
    }

    faction.territories.forEach(function(territory) {
      if (!GM.provinceStats[territory]) {
        GM.provinceStats[territory] = {
          name: territory,
          owner: faction.name,
          population: 50000 + Math.floor(random() * 50000),
          wealth: 50 + Math.floor(random() * 30),
          stability: 60 + Math.floor(random() * 20),
          development: 40 + Math.floor(random() * 30),
          taxRevenue: 0,
          militaryRecruits: 0,
          unrest: 10 + Math.floor(random() * 20),
          corruption: 20 + Math.floor(random() * 30),
          terrain: '', specialResources: '', governor: '', taxLevel: '中'
        };
      }
    });
  });
}

/**
 * 更新省级经济（每回合）
 */
function updateProvinceEconomy() {
  // 趋势快照——保存上回合数据供地方舆情面板对比
  if (GM.provinceStats) {
    GM._prevProvinceStats = {};
    Object.keys(GM.provinceStats).forEach(function(k) {
      var ps = GM.provinceStats[k];
      GM._prevProvinceStats[k] = { prosperity: ps.prosperity||ps.development||0, corruption: ps.corruption||0, unrest: ps.unrest||0 };
    });
  }
  // 7.5: 地方区划可选Worker加速（当省份数>50时启用）
  // 目前通过WorkerPool.compute('provinceEconomy', data)调用
  // 如果Worker不可用或超时，回退到主线程同步计算（当前逻辑）
  if (!GM.provinceStats) initProvinceEconomy();
  var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30; // 月比例
  GM._resourceProvinces = {}; // 5.3: 每回合重置特产资源记录

  Object.keys(GM.provinceStats).forEach(function(provinceName) {
    var province = GM.provinceStats[provinceName];

    // 人口增长（月基准1%/-0.5%，按天数缩放）
    var populationGrowth = 0;
    if (province.stability > 60 && province.wealth > 60) {
      populationGrowth = Math.floor(province.population * 0.01 * _ms);
    } else if (province.stability < 40 || province.wealth < 40) {
      populationGrowth = -Math.floor(province.population * 0.005 * _ms);
    }
    province.population = Math.max(10000, province.population + populationGrowth);

    // 财富变化（月基准，按天数缩放）
    var wealthChange = 0;
    if (province.development > 60) {
      wealthChange = 2 * _ms;
    } else if (province.development < 40) {
      wealthChange = -1 * _ms;
    }
    if (province.corruption > 60) {
      wealthChange -= 2 * _ms;
    }
    province.wealth = Math.max(10, Math.min(100, province.wealth + wealthChange));

    // 稳定度变化
    var stabilityChange = 0;
    if (province.unrest > 60) {
      stabilityChange = -2 * _ms;
    } else if (province.unrest < 30) {
      stabilityChange = 1 * _ms;
    }
    if (province.corruption > 70) {
      stabilityChange -= 1 * _ms;
    }
    province.stability = Math.max(10, Math.min(100, province.stability + stabilityChange));

    // 发展度变化
    var developmentChange = 0;
    if (province.wealth > 70 && province.stability > 70) {
      developmentChange = 1 * _ms;
    } else if (province.wealth < 40 || province.stability < 40) {
      developmentChange = -0.5 * _ms;
    }
    province.development = Math.max(10, Math.min(100, province.development + developmentChange));

    // 建筑效果加成
    var _bldEffects = null;
    if (typeof calculateTerritoryBuildingEffects === 'function') {
      _bldEffects = calculateTerritoryBuildingEffects(provinceName);
    }
    var _bldIncome = _bldEffects ? _bldEffects.monthlyIncome : 0;
    var _bldLevy = _bldEffects ? _bldEffects.levy : 0;
    var _bldCulture = _bldEffects ? _bldEffects.culturalInfluence : 0;
    var _bldProsperity = _bldEffects ? (_bldEffects.prosperity || 0) : 0;

    // 建筑繁荣加成影响财富
    if (_bldProsperity > 0) {
      province.wealth = Math.min(100, province.wealth + Math.min(2, _bldProsperity / 10) * _ms);
    }
    // 文化建筑减少民变
    if (_bldCulture > 10) {
      province.unrest = Math.max(0, province.unrest - Math.min(2, _bldCulture / 15) * _ms);
    }

    // 地形/特产修正
    var _terrainTaxMod = 1.0;
    if (province.terrain === '平原' || province.terrain === '水乡') _terrainTaxMod = 1.1;
    else if (province.terrain === '沙漠' || province.terrain === '山地') _terrainTaxMod = 0.8;
    else if (province.terrain === '沿海') _terrainTaxMod = 1.15;
    if (province.specialResources) _terrainTaxMod += 0.05; // 有特产+5%

    // 税率等级修正
    var _taxLevelMod = 1.0;
    if (province.taxLevel === '重') { _taxLevelMod = 1.3; province.unrest = Math.min(100, (province.unrest || 0) + 0.5 * _ms); }
    else if (province.taxLevel === '轻') { _taxLevelMod = 0.7; province.stability = Math.min(100, (province.stability || 50) + 0.3 * _ms); }

    // 计算税收（基于人口、财富、发展度 + 建筑 + 地形 + 税率）
    var baseTax = Math.floor(province.population / 1000);
    var wealthMultiplier = province.wealth / 100;
    var developmentMultiplier = province.development / 100;
    var corruptionPenalty = province.corruption / 200;
    province.taxRevenue = Math.floor((baseTax * wealthMultiplier * developmentMultiplier * (1 - corruptionPenalty) + _bldIncome) * _terrainTaxMod * _taxLevelMod);

    // 5.3: 特产加成
    var specRes = province.specialResources || [];
    if (typeof specRes === 'string') specRes = specRes ? specRes.split(/[,，、\s]+/) : [];
    specRes.forEach(function(res) {
      if (res === '\u76D0' || res === 'salt') province.taxRevenue = Math.floor(province.taxRevenue * 1.15); // 盐税加成
      if (res === '\u94C1\u77FF' || res === 'iron') {
        if (!GM._resourceProvinces) GM._resourceProvinces = {};
        GM._resourceProvinces[provinceName] = (GM._resourceProvinces[provinceName]||[]).concat('iron');
      }
      if (res === '\u9A6C\u5339' || res === 'horse') {
        if (!GM._resourceProvinces) GM._resourceProvinces = {};
        GM._resourceProvinces[provinceName] = (GM._resourceProvinces[provinceName]||[]).concat('horse');
      }
    });

    // 计算可征兵数（基于人口和稳定度 + 军事建筑）
    var baseRecruits = Math.floor(province.population / 100);
    var stabilityMultiplier = province.stability / 100;
    province.militaryRecruits = Math.floor(baseRecruits * stabilityMultiplier) + _bldLevy;

    // 民变自然衰减
    province.unrest = Math.max(0, province.unrest - 0.5 * _ms);

    // 贪腐自然增长（需要定期整治）
    province.corruption = Math.min(100, province.corruption + 0.3 * _ms);

    // ═══ M4: 属性漂移——向governor能力目标值收敛 ═══
    var _gov = province.governor ? (typeof findCharByName === 'function' ? findCharByName(province.governor) : null) : null;
    if (_gov) {
      var _tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
      var _driftScale = _tr * 12; // 月度缩放

      // development向治政能力收敛
      var _devTarget = Math.min(100, (_gov.administration || 50) * 1.2);
      var _devDrift = (_devTarget - province.development) * 0.05 * _driftScale;
      province.development = clamp(province.development + _devDrift, 10, 100);

      // stability向忠诚度收敛
      var _staTarget = Math.min(100, (_gov.loyalty || 50) * 1.0);
      var _staDrift = (_staTarget - province.stability) * 0.04 * _driftScale;
      province.stability = clamp(province.stability + _staDrift, 10, 100);

      // corruption向(100 - 品德)收敛
      var _corTarget = Math.max(0, 100 - (_gov.benevolence || 50));
      var _corDrift = (_corTarget - province.corruption) * 0.03 * _driftScale;
      province.corruption = clamp(province.corruption + _corDrift, 0, 100);
    }

    // ═══ M8: 征兵池月度回复（征兵上限=人口/50，年度回满）═══
    var _maxRecruits = Math.floor(province.population / 50);
    var _monthlyRecovery = Math.floor(_maxRecruits / 12 * ((typeof getTimeRatio === 'function') ? getTimeRatio() * 12 : 1));
    province.militaryRecruits = Math.min(_maxRecruits, province.militaryRecruits + _monthlyRecovery);

    // ═══ M10: 钱粮双轨——产出拆分（如果区域有moneyRatio/grainRatio）═══
    var _matchRegion = (P.map && P.map.regions || []).find(function(r) { return (r.id||r.name) === provinceName || r.name === provinceName; });
    if (_matchRegion && _matchRegion.moneyRatio !== undefined && _matchRegion.grainRatio !== undefined) {
      var _totalOutput = province.taxRevenue;
      var _mRatio = _matchRegion.moneyRatio || 3;
      var _gRatio = _matchRegion.grainRatio || 7;
      province.moneyOutput = Math.floor(_totalOutput * _mRatio / (_mRatio + _gRatio));
      province.grainOutput = _totalOutput - province.moneyOutput;
    }
  });

  // 更新势力的总收入和兵力
  GM.facs.forEach(function(faction) {
    if (!faction.territories) return;

    var totalTax = 0;
    var totalRecruits = 0;

    faction.territories.forEach(function(territory) {
      var province = GM.provinceStats[territory];
      if (province && province.owner === faction.name) {
        totalTax += province.taxRevenue;
        totalRecruits += province.militaryRecruits;
      }
    });

    // 更新势力数据：税收汇入势力金库
    if (!faction.income) faction.income = 0;
    faction.income = totalTax;
    if (typeof faction.money === 'number') {
      faction.money += totalTax; // 省份税收汇入势力
    }
    // 同时更新对应的GM.vars资源（如果有"国库"类变量且属于该势力）
    if (faction.isPlayer || (P.playerInfo && P.playerInfo.factionName === faction.name)) {
      // 玩家势力的税收更新到变量
      var _treasuryVar = GM.vars['\u56FD\u5E93'] || GM.vars['\u8D22\u653F'] || GM.vars['\u91D1\u94B1'];
      if (_treasuryVar) {
        _treasuryVar.value = Math.min(_treasuryVar.max || 99999999, _treasuryVar.value + totalTax);
      }
    }

    if (!faction.militaryForce) faction.militaryForce = 0;
    faction.militaryForce = totalRecruits;
  });
}

/**
 * 省级政策执行（玩家可对特定省份执行政策）
 */
function executeProvincePolicy(provinceName, policyType) {
  var province = GM.provinceStats[provinceName];
  if (!province) return;

  switch(policyType) {
    case 'reduce_tax':
      // 减税
      province.unrest = Math.max(0, province.unrest - 10);
      province.wealth += 5;
      addEB('省级政策', provinceName + '：减税惠民');
      break;

    case 'increase_tax':
      // 增税
      province.unrest = Math.min(100, province.unrest + 10);
      province.taxRevenue = Math.floor(province.taxRevenue * 1.2);
      addEB('省级政策', provinceName + '：增加税收');
      break;

    case 'anti_corruption':
      // 反腐
      province.corruption = Math.max(0, province.corruption - 20);
      province.stability += 5;
      addEB('省级政策', provinceName + '：整治贪腐');
      break;

    case 'develop_economy':
      // 发展经济
      province.development += 5;
      province.wealth += 3;
      addEB('省级政策', provinceName + '：发展经济');
      break;

    case 'recruit_troops':
      // 征兵
      province.unrest = Math.min(100, province.unrest + 5);
      province.militaryRecruits = Math.floor(province.militaryRecruits * 1.3);
      addEB('省级政策', provinceName + '：征募士兵');
      break;

    case 'disaster_relief':
      // 赈灾
      province.unrest = Math.max(0, province.unrest - 15);
      province.stability += 10;
      addEB('省级政策', provinceName + '：赈灾救济');
      break;
  }
}

/**
 * 任命省份主官（玩家操作）
 */
function appointProvinceGovernor(provinceName) {
  var province = GM.provinceStats ? GM.provinceStats[provinceName] : null;
  if (!province) { toast('\u7701\u4EFD\u4E0D\u5B58\u5728'); return; }

  // 收集可任命的角色（同势力、活着、无地方官职务的）
  var candidates = (GM.chars || []).filter(function(c) {
    if (c.alive === false || c.dead) return false;
    if (c.isPlayer) return false;
    // 优先同势力
    if (province.owner && c.faction !== province.owner) return false;
    return true;
  });

  if (candidates.length === 0) { toast('\u65E0\u53EF\u4EFB\u547D\u7684\u89D2\u8272'); return; }

  var html = '<div style="max-height:60vh;overflow-y:auto;">';
  html += '<div style="margin-bottom:0.5rem;color:var(--txt-d);font-size:0.82rem;">\u4E3A ' + provinceName + ' \u4EFB\u547D\u4E3B\u5B98\uFF1A</div>';
  candidates.slice(0, 20).forEach(function(c) {
    var adm = c.administration || 50;
    var loy = c.loyalty || 50;
    var loyClr = loy > 70 ? 'var(--green)' : loy < 30 ? 'var(--red)' : 'var(--txt-s)';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid var(--bg-4);cursor:pointer;" onclick="doAppointGovernor(\'' + provinceName.replace(/'/g, '') + '\',\'' + c.name.replace(/'/g, '') + '\')">';
    html += '<span>' + c.name + (c.title ? ' <span style="font-size:0.7rem;color:var(--txt-d);">' + c.title + '</span>' : '') + '</span>';
    html += '<span style="font-size:0.75rem;">\u653F' + adm + ' <span style="color:' + loyClr + ';">\u5FE0' + loy + '</span></span>';
    html += '</div>';
  });
  html += '</div>';

  openGenericModal('\u4EFB\u547D\u4E3B\u5B98', html, null);
}

function doAppointGovernor(provinceName, charName) {
  var province = GM.provinceStats ? GM.provinceStats[provinceName] : null;
  if (!province) return;

  var oldGov = province.governor || '';
  province.governor = charName;
  addEB('\u4EFB\u547D', charName + '\u88AB\u4EFB\u547D\u4E3A' + provinceName + '\u4E3B\u5B98');

  var ch = findCharByName(charName);
  if (ch) ch.loyalty = Math.min(100, (ch.loyalty || 50) + 3);

  // 同步到行政区划
  if (P.adminHierarchy) {
    var _aks = Object.keys(P.adminHierarchy);
    _aks.forEach(function(k) {
      var ah = P.adminHierarchy[k];
      if (!ah || !ah.divisions) return;
      (function _syncGov(divs) {
        divs.forEach(function(d) {
          if (d.name === provinceName) {
            d.governor = charName;
            // 同步到officeTree
            if (d.officialPosition && GM.officeTree) {
              (function _syncOff(nodes) {
                nodes.forEach(function(nd) {
                  if (nd.positions) nd.positions.forEach(function(p) {
                    if (p.name === d.officialPosition && (!p.holder || p.holder === oldGov)) p.holder = charName;
                  });
                  if (nd.subs) _syncOff(nd.subs);
                });
              })(GM.officeTree);
            }
          }
          if (d.children) _syncGov(d.children);
        });
      })(ah.divisions);
    });
  }

  // 记录决策
  if (typeof recordPlayerDecision === 'function') recordPlayerDecision('appointment', '\u4EFB\u547D' + charName + '\u4E3A' + provinceName + '\u4E3B\u5B98');

  closeGenericModal();
  _peRefreshContent();
  toast(charName + '\u5DF2\u4EFB\u547D\u4E3A' + provinceName + '\u4E3B\u5B98');
}

/**
 * 打开省级经济面板
 */
// 省级经济：展开/折叠状态（在面板生命周期内保持）
var _peExpandState = {};

/**
 * 递归聚合行政区划节点的经济数据
 * 返回 { population, wealth, stability, development, taxRevenue, militaryRecruits, unrest, corruption, count }
 */
function _aggregateDivisionStats(div) {
  var ps = GM.provinceStats || {};
  var stat = ps[div.name];

  // 叶节点：优先读新 adminHierarchy 深化字段（div.population/minxin/corruption/fiscal），fallback 老 provinceStats，再 fallback 编辑器静态
  if (!div.children || div.children.length === 0) {
    // 新字段优先
    var popObj = (div.population && typeof div.population === 'object') ? div.population : null;
    var mouths = popObj ? (popObj.mouths || 0) : (typeof div.population === 'number' ? div.population : 0);
    var minxin = (typeof div.minxin === 'number') ? div.minxin : null;
    var corr = (typeof div.corruption === 'number') ? div.corruption : null;
    var fiscalObj = div.fiscal || null;

    if (mouths > 0 || minxin != null || fiscalObj) {
      return {
        population: mouths,
        wealth: div.prosperity || 50,
        stability: minxin != null ? minxin : 60,    // 地方民心 → 稳定指标
        development: div.prosperity ? Math.round(div.prosperity * 0.8) : 40,
        taxRevenue: fiscalObj ? (fiscalObj.actualRevenue || fiscalObj.remittedToCenter || 0) : 0,
        militaryRecruits: popObj && popObj.ding ? Math.round(popObj.ding * 0.01) : 0,  // 丁 × 1% 为理论兵源
        unrest: minxin != null ? Math.max(0, 100 - minxin) : 20,  // 民心低 → 民变高
        corruption: corr != null ? corr : 0,
        count: 1
      };
    }
    // 再尝试老 provinceStats
    if (stat) {
      return {
        population: stat.population || 0, wealth: stat.wealth || 0,
        stability: stat.stability || 0, development: stat.development || 0,
        taxRevenue: stat.taxRevenue || 0, militaryRecruits: stat.militaryRecruits || 0,
        unrest: stat.unrest || 0, corruption: stat.corruption || 0, count: 1
      };
    }
    // 最终 fallback：编辑器静态
    return {
      population: div.population || 0, wealth: div.prosperity || 0,
      stability: 50, development: div.prosperity ? Math.round(div.prosperity * 0.8) : 40,
      taxRevenue: 0, militaryRecruits: 0, unrest: 0, corruption: 0, count: 1
    };
  }

  // 非叶节点：聚合子节点
  var agg = { population: 0, wealth: 0, stability: 0, development: 0, taxRevenue: 0, militaryRecruits: 0, unrest: 0, corruption: 0, count: 0 };
  for (var i = 0; i < div.children.length; i++) {
    var child = _aggregateDivisionStats(div.children[i]);
    agg.population += child.population;
    agg.taxRevenue += child.taxRevenue;
    agg.militaryRecruits += child.militaryRecruits;
    agg.wealth += child.wealth * child.count;
    agg.stability += child.stability * child.count;
    agg.development += child.development * child.count;
    agg.unrest += child.unrest * child.count;
    agg.corruption += child.corruption * child.count;
    agg.count += child.count;
  }
  // 比率类指标取加权平均
  if (agg.count > 0) {
    agg.wealth = agg.wealth / agg.count;
    agg.stability = agg.stability / agg.count;
    agg.development = agg.development / agg.count;
    agg.unrest = agg.unrest / agg.count;
    agg.corruption = agg.corruption / agg.count;
  }
  return agg;
}

// ────────────────── 辅助：数字/条形/饼图/gauge ──────────────────
function _peN(v) { v=Math.round(v||0); if(Math.abs(v)>=1e8) return (v/1e8).toFixed(2)+'亿'; if(Math.abs(v)>=10000) return Math.round(v/10000)+'万'; if(Math.abs(v)>=1000) return (v/1000).toFixed(1)+'K'; return v.toString(); }
function _peU() { return (typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : { money:'两', grain:'石', cloth:'匹' }; }

function _peGauge(value, max, color, label) {
  var pct = Math.max(0, Math.min(100, (value/(max||100))*100));
  return '<div style="display:flex;align-items:center;gap:6px;font-size:0.7rem;">' +
    '<span style="min-width:42px;color:var(--color-foreground-muted);">' + label + '</span>' +
    '<div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">' +
    '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px;transition:width .3s;"></div></div>' +
    '<span style="min-width:32px;text-align:right;color:' + color + ';font-weight:600;">' + Math.round(value) + '</span></div>';
}

function _peStackBar(parts, height) {
  // parts = [{ value, color, label }]
  var total = parts.reduce(function(s,p){return s+(p.value||0);}, 0);
  if (total <= 0) return '';
  var h = height || 10;
  var html = '<div style="display:flex;height:' + h + 'px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,0.04);">';
  parts.forEach(function(p) {
    var w = ((p.value||0) / total) * 100;
    if (w <= 0) return;
    html += '<div title="' + (p.label||'') + ' ' + p.value + ' (' + w.toFixed(0) + '%)" style="width:' + w + '%;background:' + p.color + ';"></div>';
  });
  html += '</div>';
  return html;
}

function _peStatCard(title, main, sub, color) {
  var _clr = color || 'var(--gold-400)';
  return '<div style="background:rgba(184,154,83,0.04);border:1px solid rgba(184,154,83,0.15);border-left:3px solid ' + _clr + ';border-radius:4px;padding:6px 10px;">' +
    '<div style="font-size:0.64rem;color:var(--color-foreground-muted);letter-spacing:0.05em;">' + title + '</div>' +
    '<div style="font-size:0.95rem;color:' + _clr + ';font-weight:700;margin-top:2px;">' + main + '</div>' +
    (sub ? '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-top:2px;">' + sub + '</div>' : '') +
    '</div>';
}

function _peSection(icon, title, bodyHtml) {
  return '<div class="tm-div-section">' +
    '<div class="tm-div-section-title">' +
    '<span class="tm-div-section-icon">' + icon + '</span>' +
    '<span class="tm-div-section-name">' + title + '</span></div>' +
    bodyHtml + '</div>';
}

/**
 * 渲染单个行政区划节点（卷轴风 · 多域信息密集）
 */
function _renderDivisionNode(div, depth) {
  var isLeaf = !div.children || div.children.length === 0;
  var territory = div.name;
  var agg = _aggregateDivisionStats(div);
  var nodeId = div.id || territory;
  var expanded = !!_peExpandState[nodeId];
  var indent = depth * 0.5;

  var _U = _peU();  // 货币单位（剧本/朝代决定）
  // ── 数据采集（优先新字段，fallback agg） ──
  var _hh = 0, _mo = 0, _ding = 0, _fug = 0, _hid = 0;
  if (div.population && typeof div.population === 'object') {
    _hh = div.population.households||0; _mo = div.population.mouths||0; _ding = div.population.ding||0;
    _fug = div.population.fugitives||0; _hid = div.population.hiddenCount||0;
  } else if (typeof div.population === 'number') {
    _mo = div.population; _hh = Math.floor(_mo/5); _ding = Math.floor(_mo*0.25);
  } else {
    _mo = agg.population; _hh = Math.floor(_mo/5); _ding = Math.floor(_mo*0.25);
  }
  var _minxin = (typeof div.minxin === 'number') ? div.minxin : null;
  var _corr = (typeof div.corruption === 'number') ? div.corruption : null;
  var _remit = (div.fiscal && div.fiscal.remittedToCenter) || 0;
  var _actual = (div.fiscal && div.fiscal.actualRevenue) || 0;
  var _claimed = (div.fiscal && div.fiscal.claimedRevenue) || 0;
  var _retained = (div.fiscal && div.fiscal.retainedBudget) || 0;
  var _compl = (div.fiscal && div.fiscal.compliance != null) ? div.fiscal.compliance : 0.85;
  var _skim = (div.fiscal && div.fiscal.skimmingRate != null) ? div.fiscal.skimmingRate : 0.1;
  var _auto = (div.fiscal && div.fiscal.autonomyLevel != null) ? div.fiscal.autonomyLevel : 0.3;
  var _pubM = (div.publicTreasury && div.publicTreasury.money && div.publicTreasury.money.stock) || 0;
  var _pubG = (div.publicTreasury && div.publicTreasury.grain && div.publicTreasury.grain.stock) || 0;
  var _pubC = (div.publicTreasury && div.publicTreasury.cloth && div.publicTreasury.cloth.stock) || 0;
  var _deficit = (div.publicTreasury && div.publicTreasury.money && div.publicTreasury.money.deficit) || 0;
  var _envLoad = (div.environment && div.environment.currentLoad) || 0;
  var gov = div.governor || (GM.provinceStats && GM.provinceStats[territory] ? GM.provinceStats[territory].governor : '');
  var govCh = gov ? findCharByName(gov) : null;

  // 颜色主题
  var _mxClr = _minxin == null ? 'var(--color-foreground-muted)' : (_minxin >= 60 ? '#6aa88a' : _minxin >= 40 ? 'var(--gold-400)' : 'var(--vermillion-400)');
  var _crClr = _corr == null ? 'var(--color-foreground-muted)' : (_corr <= 30 ? '#6aa88a' : _corr <= 60 ? 'var(--gold-400)' : 'var(--vermillion-400)');
  var _levelClr = depth === 0 ? 'var(--gold-400)' : depth === 1 ? 'var(--celadon-400)' : 'var(--ink-300)';

  // ── 卡片 header ──
  var _safeNodeId = String(nodeId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  var _cardClick = 'event.stopPropagation();if(typeof openDivisionDetail===\'function\')openDivisionDetail(\'' + _safeNodeId + '\')';
  var html = '<div style="margin-bottom:0.5rem;margin-left:' + indent + 'rem;">';
  html += '<div style="background:var(--color-surface);border:1px solid rgba(184,154,83,0.2);border-left:3px solid ' + _levelClr + ';border-radius:6px;padding:10px 12px;position:relative;cursor:pointer;transition:background 0.15s;" '
       + 'onmouseover="this.style.background=\'rgba(184,154,83,0.05)\'" '
       + 'onmouseout="this.style.background=\'var(--color-surface)\'" '
       + 'onclick="' + _cardClick + '" '
       + 'title="点击查看完整地区详情">';

  // 标题栏（名称 · 级别 · 主官 · 区划类型 · 承载警示）
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">';
  if (!isLeaf) {
    html += '<span style="cursor:pointer;font-size:0.82rem;color:var(--gold-400);user-select:none;" onclick="_peToggle(\'' + nodeId.replace(/\\/g,"\\\\").replace(/'/g, "\\'") + '\')">' + (expanded ? '\u25BE' : '\u25B8') + '</span>';
  } else {
    html += '<span style="width:12px;display:inline-block;"></span>';
  }
  html += '<span style="font-family:var(--font-serif);font-size:' + (depth === 0 ? '1.05rem' : '0.95rem') + ';font-weight:700;color:var(--color-foreground);letter-spacing:0.08em;">' + escHtml(territory) + '</span>';
  if (div.level) html += '<span style="font-size:0.62rem;color:' + _levelClr + ';background:rgba(184,154,83,0.08);padding:2px 6px;border-radius:3px;letter-spacing:0.05em;">' + escHtml(div.level) + '</span>';
  if (!isLeaf) html += '<span style="font-size:0.65rem;color:var(--color-foreground-muted);">\u8F96' + agg.count + '\u533A</span>';
  // regionType 标签
  if (div.regionType && div.regionType !== 'normal') {
    var _rtL = { jimi:{t:'羁縻',c:'var(--celadon-400)'}, tusi:{t:'土司',c:'var(--celadon-400)'}, fanbang:{t:'藩属',c:'var(--amber-400)'}, imperial_clan:{t:'宗藩王封',c:'var(--indigo-400,#7986cb)'} };
    var _rti = _rtL[div.regionType] || { t:div.regionType, c:'var(--gold-400)' };
    html += '<span style="font-size:0.62rem;color:' + _rti.c + ';background:rgba(255,255,255,0.04);padding:2px 6px;border:1px dashed ' + _rti.c + ';border-radius:3px;">' + _rti.t + '</span>';
  }
  if (div.terrain) html += '<span style="font-size:0.62rem;color:var(--color-foreground-muted);">' + escHtml(div.terrain) + '</span>';
  if (div.specialResources) html += '<span style="font-size:0.62rem;color:var(--gold-400);">\u4EA7' + escHtml(div.specialResources) + '</span>';
  // 警示
  if (_envLoad > 0.9) html += '<span style="margin-left:auto;font-size:0.62rem;color:var(--vermillion-400);">\u26A0 \u627F\u8F7D' + (_envLoad*100).toFixed(0) + '%</span>';
  else if (_fug > 0) html += '<span style="margin-left:auto;font-size:0.62rem;color:var(--amber-400);">\u9003\u6237 ' + _fug + '</span>';
  html += '</div>';

  // 主官栏（天命风：印鉴色）
  if (gov) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(184,154,83,0.06);border-radius:4px;margin-bottom:8px;">';
    html += '<span style="font-size:0.66rem;color:var(--color-foreground-muted);letter-spacing:0.08em;">' + escHtml(div.officialPosition||'主官') + '</span>';
    html += '<span style="font-size:0.82rem;color:var(--gold-400);font-weight:600;cursor:pointer;text-decoration:underline dotted;" onclick="if(typeof showCharPopup===\'function\')showCharPopup(\'' + escHtml(gov).replace(/'/g,"\\'") + '\',event)">' + escHtml(gov) + '</span>';
    if (govCh) {
      html += '<div style="display:flex;gap:4px;font-size:0.6rem;color:var(--color-foreground-muted);">';
      html += '<span title="忠诚">\u5FE0' + (govCh.loyalty||50) + '</span>';
      html += '<span title="廉节">\u5EC9' + (govCh.integrity||50) + '</span>';
      html += '<span title="智能">\u667A' + (govCh.intelligence||50) + '</span>';
      html += '<span title="政能">\u653F' + (govCh.administration||50) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  } else if (div.officialPosition) {
    html += '<div style="padding:6px 10px;background:rgba(192,64,48,0.08);border-radius:4px;margin-bottom:8px;font-size:0.72rem;color:var(--vermillion-400);">' + escHtml(div.officialPosition) + '：<b>空缺</b>（待委任）</div>';
  }

  // 三卡快览（人口 · 财政 · 公库）
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">';
  html += _peStatCard('\u6237\u53E3\u4E09\u5143', _peN(_mo) + '\u53E3', _peN(_hh) + '\u6237 \u00B7 ' + _peN(_ding) + '\u4E01' + (_fug?' \u00B7 \u9003' + _fug:''), 'var(--celadon-400)');
  var _incomeSub = _actual > 0 ? ('\u5B9E\u5F81 ' + _peN(_actual)) : (_claimed > 0 ? ('\u540D\u4E49 ' + _peN(_claimed)) : '');
  html += _peStatCard('\u4E0A\u89E3\u4E2D\u592E', _peN(_remit) + _U.money, _incomeSub, 'var(--gold-400)');
  var _pubSub = [];
  if (_pubG > 0) _pubSub.push(_peN(_pubG) + _U.grain);
  if (_pubC > 0) _pubSub.push(_peN(_pubC) + _U.cloth);
  if (_deficit > 0) _pubSub.push('<span style="color:var(--vermillion-400);">\u4E8F' + _peN(_deficit) + '</span>');
  html += _peStatCard('\u516C\u5E93', _peN(_pubM) + _U.money, _pubSub.join(' \u00B7 '), 'var(--amber-400)');
  html += '</div>';

  // 三条 gauge（民心 · 吏治 · 自治）
  if (_minxin != null || _corr != null || _auto > 0) {
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;padding:6px 10px;background:rgba(0,0,0,0.15);border-radius:4px;">';
    if (_minxin != null) html += _peGauge(_minxin, 100, _mxClr, '\u6C11\u5FC3');
    else html += '<div></div>';
    if (_corr != null) html += _peGauge(_corr, 100, _crClr, '\u5426\u8150');
    else html += '<div></div>';
    html += _peGauge(_auto * 100, 100, 'var(--indigo-400,#7986cb)', '\u81EA\u6CBB');
    html += '</div>';
  }

  // ────── 详情展开（折叠） ──────
  var _detailHtml = '';

  // A. 户口细分 —— grid 展示
  if (div.byCategory || div.bySettlement || div.byAge || div.byGender || div.byEthnicity || div.byFaith || div.baojia) {
    var _popGrid = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">';
    // 居所
    if (div.bySettlement) {
      var bs = div.bySettlement;
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u5C45\u6240</div>';
      _popGrid += _peStackBar([
        {value:(bs.fang||{}).mouths||0, color:'var(--gold-400)', label:'坊(城内)'},
        {value:(bs.shi||{}).mouths||0, color:'var(--amber-400)', label:'市(市集)'},
        {value:(bs.zhen||{}).mouths||0, color:'var(--celadon-400)', label:'镇'},
        {value:(bs.cun||{}).mouths||0, color:'var(--indigo-400,#7986cb)', label:'村'}
      ], 8);
      _popGrid += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:3px;">\u574A' + _peN((bs.fang||{}).mouths) + ' \u00B7 \u5E02' + _peN((bs.shi||{}).mouths) + ' \u00B7 \u9547' + _peN((bs.zhen||{}).mouths) + ' \u00B7 \u6751' + _peN((bs.cun||{}).mouths) + '</div>';
      _popGrid += '</div>';
    }
    // 性别
    if (div.byGender) {
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u7537\u5973 (\u6BD4 ' + (div.byGender.sexRatio||1.04).toFixed(2) + ')</div>';
      _popGrid += _peStackBar([
        {value:div.byGender.male||0, color:'var(--indigo-400,#7986cb)', label:'男'},
        {value:div.byGender.female||0, color:'#e48a8a', label:'女'}
      ], 8);
      _popGrid += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:3px;">\u7537' + _peN(div.byGender.male) + ' \u00B7 \u5973' + _peN(div.byGender.female) + '</div>';
      _popGrid += '</div>';
    }
    // 年龄
    if (div.byAge) {
      var ba = div.byAge;
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u5E74\u9F84\u7ED3\u6784</div>';
      _popGrid += _peStackBar([
        {value:((ba.young||{}).count)||0, color:'var(--celadon-400)', label:'幼'},
        {value:((ba.ding||{}).count)||0, color:'var(--gold-400)', label:'丁'},
        {value:((ba.old||{}).count)||0, color:'var(--ink-300)', label:'老'}
      ], 8);
      _popGrid += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:3px;">\u5E7C' + ((ba.young||{}).ratio||0.3).toFixed(2) + ' \u00B7 \u4E01' + ((ba.ding||{}).ratio||0.55).toFixed(2) + ' \u00B7 \u8001' + ((ba.old||{}).ratio||0.15).toFixed(2) + '</div>';
      _popGrid += '</div>';
    }
    // 族群
    if (div.byEthnicity) {
      var _ePalette = ['var(--gold-400)','var(--celadon-400)','var(--indigo-400,#7986cb)','var(--amber-400)','var(--vermillion-400)','var(--ink-300)'];
      var _eParts = Object.keys(div.byEthnicity).map(function(k,i){return {value: div.byEthnicity[k]*_mo, color:_ePalette[i%_ePalette.length], label:k};});
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u65CF\u7FA4</div>';
      _popGrid += _peStackBar(_eParts, 8);
      _popGrid += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:3px;">' + Object.keys(div.byEthnicity).map(function(k){return k+(div.byEthnicity[k]*100).toFixed(0)+'%';}).join('·') + '</div>';
      _popGrid += '</div>';
    }
    // 信仰
    if (div.byFaith) {
      var _fPalette = ['var(--gold-400)','var(--celadon-400)','var(--indigo-400,#7986cb)','var(--amber-400)','var(--ink-300)'];
      var _fParts = Object.keys(div.byFaith).map(function(k,i){return {value: div.byFaith[k]*_mo, color:_fPalette[i%_fPalette.length], label:k};});
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u4FE1\u4EF0</div>';
      _popGrid += _peStackBar(_fParts, 8);
      _popGrid += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:3px;">' + Object.keys(div.byFaith).map(function(k){return k+(div.byFaith[k]*100).toFixed(0)+'%';}).join('·') + '</div>';
      _popGrid += '</div>';
    }
    // 保甲
    if (div.baojia) {
      var _regAcc = (div.baojia.registerAccuracy||0)*100;
      var _regClr = _regAcc > 75 ? '#6aa88a' : _regAcc > 50 ? 'var(--gold-400)' : 'var(--vermillion-400)';
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u4FDD\u7532\u7CFB\u7EDF</div>';
      _popGrid += '<div style="font-size:0.68rem;color:var(--color-foreground);">\u4FDD' + _peN(div.baojia.baoCount) + ' \u00B7 \u7532' + _peN(div.baojia.jiaCount) + ' \u00B7 \u724C' + _peN(div.baojia.paiCount) + '</div>';
      _popGrid += '<div style="font-size:0.58rem;color:' + _regClr + ';margin-top:2px;">\u518C\u51C6 ' + _regAcc.toFixed(0) + '%</div>';
      _popGrid += '</div>';
    }
    // 逃隐户
    if (_fug > 0 || _hid > 0) {
      _popGrid += '<div>';
      _popGrid += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-bottom:3px;">\u6D41\u5931\u4EBA\u53E3</div>';
      _popGrid += '<div style="font-size:0.68rem;color:var(--amber-400);">\u9003\u6237 ' + _peN(_fug) + ' \u00B7 \u9690\u6237 ' + _peN(_hid) + '</div>';
      var _lossPct = _mo > 0 ? ((_fug+_hid)/(_mo+_fug+_hid)*100) : 0;
      _popGrid += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:2px;">\u5931\u518C\u7387 ' + _lossPct.toFixed(1) + '%</div>';
      _popGrid += '</div>';
    }
    _popGrid += '</div>';
    _detailHtml += _peSection('\u{1F465}', '\u6237\u53E3\u56FE\u666F', _popGrid);
  }

  // B. 财政细分
  if (div.fiscal && (div.fiscal.claimedRevenue || div.fiscal.actualRevenue || div.fiscal.remittedToCenter)) {
    var f = div.fiscal;
    var _fb = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px;">';
    _fb += '<div><div style="font-size:0.58rem;color:var(--color-foreground-muted);">\u540D\u4E49</div><div style="font-size:0.76rem;color:var(--ink-300);">' + _peN(f.claimedRevenue||0) + _U.money + '</div></div>';
    _fb += '<div><div style="font-size:0.58rem;color:var(--color-foreground-muted);">\u5B9E\u5F81</div><div style="font-size:0.76rem;color:var(--gold-400);">' + _peN(f.actualRevenue||0) + _U.money + '</div></div>';
    _fb += '<div><div style="font-size:0.58rem;color:var(--color-foreground-muted);">\u4E0A\u89E3</div><div style="font-size:0.76rem;color:var(--celadon-400);">' + _peN(f.remittedToCenter||0) + _U.money + '</div></div>';
    _fb += '<div><div style="font-size:0.58rem;color:var(--color-foreground-muted);">\u7559\u5B58</div><div style="font-size:0.76rem;color:var(--amber-400);">' + _peN(f.retainedBudget||0) + _U.money + '</div></div>';
    _fb += '</div>';
    // 流量条（名义→实征→上解 的损耗可视化）
    if ((f.claimedRevenue||0) > 0) {
      _fb += '<div style="margin-bottom:6px;">';
      _fb += _peStackBar([
        {value: (f.remittedToCenter||0), color:'var(--celadon-400)', label:'上解中央'},
        {value: (f.retainedBudget||0), color:'var(--amber-400)', label:'地方留存'},
        {value: Math.max(0, (f.actualRevenue||0) - (f.remittedToCenter||0) - (f.retainedBudget||0)), color:'var(--vermillion-400)', label:'漂没'},
        {value: Math.max(0, (f.claimedRevenue||0) - (f.actualRevenue||0)), color:'var(--ink-300)', label:'不征(灾/免/战乱)'}
      ], 10);
      _fb += '<div style="display:flex;gap:8px;font-size:0.56rem;color:var(--color-foreground-muted);margin-top:3px;flex-wrap:wrap;">';
      _fb += '<span><span style="color:var(--celadon-400);">\u25A0</span> \u4E0A\u89E3</span>';
      _fb += '<span><span style="color:var(--amber-400);">\u25A0</span> \u7559\u5B58</span>';
      _fb += '<span><span style="color:var(--vermillion-400);">\u25A0</span> \u6F02\u6CA1</span>';
      _fb += '<span><span style="color:var(--ink-300);">\u25A0</span> \u4E0D\u5F81</span>';
      _fb += '</div></div>';
    }
    _fb += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
    _fb += _peGauge((f.compliance||0.85)*100, 100, (f.compliance||0.85)>0.7?'#6aa88a':'var(--vermillion-400)', '\u5408\u89C4');
    _fb += _peGauge((f.skimmingRate||0.1)*100, 50, (f.skimmingRate||0.1)<0.15?'#6aa88a':'var(--vermillion-400)', '\u6F02\u6CA1');
    _fb += _peGauge((f.autonomyLevel||0.3)*100, 100, 'var(--indigo-400,#7986cb)', '\u81EA\u6CBB');
    _fb += '</div>';
    _detailHtml += _peSection('\u{1F4B0}', '\u8D22\u653F\u672C\u56DE\u5408', _fb);
  }

  // C. 公库三账
  if (div.publicTreasury) {
    var pt = div.publicTreasury;
    var _pb = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">';
    ['money','grain','cloth'].forEach(function(k){
      var led = pt[k]; if (!led) return;
      var _unit = _U[k];
      var _label = { money:'\u94F6', grain:'\u7CAE', cloth:'\u5E03' }[k];
      var _clr = { money:'var(--gold-400)', grain:'var(--celadon-400)', cloth:'var(--amber-400)' }[k];
      _pb += '<div style="padding:6px 8px;background:rgba(255,255,255,0.03);border-left:2px solid ' + _clr + ';border-radius:3px;">';
      _pb += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);">' + _label + '\u8D26</div>';
      _pb += '<div style="font-size:0.82rem;color:' + _clr + ';font-weight:600;">' + _peN(led.stock||0) + ' ' + _unit + '</div>';
      if (led.quota) _pb += '<div style="font-size:0.56rem;color:var(--color-foreground-muted);">\u989D ' + _peN(led.quota) + '</div>';
      if (led.deficit > 0) _pb += '<div style="font-size:0.58rem;color:var(--vermillion-400);">\u4E8F ' + _peN(led.deficit) + '</div>';
      _pb += '</div>';
    });
    _pb += '</div>';
    if (pt.currentHead) _pb += '<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-top:6px;">\u73B0\u638C\u5E93\uFF1A<span style="color:var(--gold-400);">' + escHtml(pt.currentHead) + '</span>' + (pt.previousHead ? ' \u00B7 \u524D\u4EFB\uFF1A' + escHtml(pt.previousHead):'') + '</div>';
    if (pt.handoverLog && pt.handoverLog.length) _pb += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:2px;">\u4EA4\u63A5\u6848\u5377 ' + pt.handoverLog.length + ' \u6761</div>';
    _detailHtml += _peSection('\u{1F3DB}', '\u516C\u5E93\u4E09\u8D26', _pb);
  }

  // D. 承载力
  if (div.environment) {
    var env = div.environment;
    var _eb = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
    var _loadClr = _envLoad > 0.9 ? 'var(--vermillion-400)' : _envLoad > 0.75 ? 'var(--amber-400)' : '#6aa88a';
    _eb += '<div>' + _peGauge(_envLoad*100, 100, _loadClr, '\u8F7D\u7387') + '</div>';
    _eb += '<div style="font-size:0.66rem;color:var(--color-foreground-muted);">';
    if (env.arableLand) _eb += '\u8015\u5730 ' + _peN(env.arableLand) + ' \u4EA9';
    if (env.waterCapacity) _eb += ' \u00B7 \u6C34 ' + _peN(env.waterCapacity);
    if (env.carryingRegime) _eb += ' \u00B7 ' + env.carryingRegime;
    _eb += '</div>';
    _eb += '</div>';
    if (env.ecoScars && Object.keys(env.ecoScars).length) {
      _eb += '<div style="font-size:0.6rem;color:var(--amber-400);margin-top:4px;">\u751F\u6001\u75A4\u75D5\uFF1A' + Object.keys(env.ecoScars).join('\u3001') + '</div>';
    }
    _detailHtml += _peSection('\u{1F33E}', '\u627F\u8F7D\u529B', _eb);
  }

  // E. 本回合地方官治理活动
  if (div.fiscal && div.fiscal.expenditures) {
    var exp = div.fiscal.expenditures;
    var _hasActions = (exp.discretionary && exp.discretionary.length) || (exp.illicit && exp.illicit.length) || (exp.fixed && exp.fixed.length) || (exp.imperial && exp.imperial.length);
    if (_hasActions) {
      var _ab = '';
      var _typeLabels = { disaster_relief:{t:'\u8D48\u707E',i:'\u{1F33E}',c:'var(--celadon-400)'}, public_works_water:{t:'\u6C34\u5229',i:'\u{1F30A}',c:'var(--celadon-400)'}, public_works_road:{t:'\u4FEE\u8DEF',i:'\u{1F6E3}',c:'var(--gold-400)'}, education:{t:'\u5174\u5B66',i:'\u{1F4D6}',c:'var(--indigo-400,#7986cb)'}, granary_stockpile:{t:'\u5C6F\u7CAE',i:'\u{1F33E}',c:'var(--amber-400)'}, military_prep:{t:'\u5907\u6B66',i:'\u2694',c:'var(--vermillion-400)'}, charity_local:{t:'\u6D4E\u8D2B',i:'\u{1F3E0}',c:'var(--celadon-400)'} };
      if (exp.discretionary && exp.discretionary.length) {
        _ab += '<div style="margin-bottom:6px;">';
        exp.discretionary.slice(-8).forEach(function(act) {
          var _ti = _typeLabels[act.type] || { t:act.type, i:'\u00B7', c:'var(--gold-400)' };
          _ab += '<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;background:rgba(255,255,255,0.02);border-left:2px solid ' + _ti.c + ';border-radius:2px;margin-bottom:2px;font-size:0.66rem;">';
          _ab += '<span style="color:' + _ti.c + ';">' + _ti.i + '</span>';
          _ab += '<span style="color:' + _ti.c + ';font-weight:600;">' + _ti.t + '</span>';
          _ab += '<span style="color:var(--color-foreground);">' + _peN(act.amount||0) + _U.money + '</span>';
          if (act.proposer) _ab += '<span style="color:var(--color-foreground-muted);">\u00B7 ' + escHtml(act.proposer) + '</span>';
          if (act.reason) _ab += '<span style="color:var(--color-foreground-muted);margin-left:auto;font-style:italic;">\u300C' + escHtml(act.reason) + '\u300D</span>';
          _ab += '</div>';
        });
        _ab += '</div>';
      }
      if (exp.illicit && exp.illicit.length) {
        _ab += '<div style="padding:4px 8px;background:rgba(192,64,48,0.08);border-left:2px solid var(--vermillion-400);border-radius:2px;font-size:0.64rem;color:var(--vermillion-400);">';
        _ab += '\u2716 \u79C1\u5F0A ' + exp.illicit.length + ' \u8D77 \u00B7 \u6324\u6D3E\u4E2D\u98FD ' + _peN(exp.illicit.reduce(function(s,x){return s+(x.amount||0);},0)) + _U.money;
        _ab += '</div>';
      }
      if (exp.fixed && exp.fixed.length) {
        _ab += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);margin-top:4px;">\u56FA\u5B9A\u652F\u51FA \u00B7 ' + exp.fixed.length + ' \u9879（俸禄/兵饷/驿站 等）</div>';
      }
      if (exp.imperial && exp.imperial.length) {
        _ab += '<div style="font-size:0.6rem;color:var(--gold-400);margin-top:2px;">\u4E2D\u592E\u547D\u6D3E \u00B7 ' + exp.imperial.length + ' \u9879</div>';
      }
      _detailHtml += _peSection('\u{1F4DC}', '\u672C\u56DE\u5408\u5730\u65B9\u6CBB\u884C', _ab);
    }
  }

  // F. 建筑
  if (typeof getTerritoryBuildings === 'function' && isLeaf) {
    var _blds = getTerritoryBuildings(territory);
    if (_blds.length > 0) {
      var _bb = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;">';
      _blds.forEach(function(b) {
        _bb += '<div style="padding:4px 8px;background:rgba(255,255,255,0.03);border-left:2px solid var(--gold-400);border-radius:2px;font-size:0.66rem;">';
        _bb += '<div style="color:var(--gold-400);font-weight:600;">' + escHtml(b.name) + '</div>';
        if (b.level) _bb += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);">Lv' + b.level + (b.status?' \u00B7 ' + b.status:'') + '</div>';
        _bb += '</div>';
      });
      _bb += '</div>';
      _detailHtml += _peSection('\u{1F3EF}', '\u5EFA\u7B51 (' + _blds.length + ')', _bb);
    }
  }

  // G. 驻地官员
  var _inRegion = (GM.chars || []).filter(function(c) { return c.alive !== false && _isSameLocation(c.location, territory); });
  if (_inRegion.length > 0) {
    var _ob = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;">';
    _inRegion.slice(0,12).forEach(function(c) {
      var _loyClr = (c.loyalty||50) > 70 ? '#6aa88a' : (c.loyalty||50) < 30 ? 'var(--vermillion-400)' : 'var(--gold-400)';
      _ob += '<div style="padding:4px 8px;background:rgba(255,255,255,0.03);border-radius:2px;font-size:0.66rem;cursor:pointer;" onclick="if(typeof showCharPopup===\'function\')showCharPopup(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\',event)">';
      _ob += '<div style="color:var(--color-foreground);font-weight:600;">' + escHtml(c.name) + '</div>';
      if (c.officialTitle) _ob += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);">' + escHtml(c.officialTitle) + '</div>';
      _ob += '<div style="display:flex;gap:3px;font-size:0.56rem;color:var(--color-foreground-muted);margin-top:2px;">';
      _ob += '<span style="color:' + _loyClr + ';">\u5FE0' + (c.loyalty||50) + '</span>';
      _ob += '<span>\u5EC9' + (c.integrity||50) + '</span>';
      _ob += '</div></div>';
    });
    if (_inRegion.length > 12) _ob += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);padding:4px;">\u2026\u8FD8\u6709 ' + (_inRegion.length-12) + ' \u4EBA</div>';
    _ob += '</div>';
    _detailHtml += _peSection('\u{1F468}', '\u9A7B\u5730\u5B98\u5458 (' + _inRegion.length + ')', _ob);
  }

  // ★ 详情体存到 div 临时字段·供 modal 读取（卡片不再嵌入展示·UI 改造）
  div._cachedDetailBody = _detailHtml;
  // 卡片底部·提示点击查看详情
  html += '<div style="text-align:center;font-size:0.6rem;color:var(--gold-d);letter-spacing:0.15em;padding-top:6px;margin-top:4px;border-top:1px dashed rgba(184,154,83,0.15);">点 击 卡 片 查 看 详 情 ▸</div>';

  // 旧详情折叠（保留作 fallback·display:none）
  if (_detailHtml && false) {
    html += '<details style="margin-top:4px;">';
    html += '<summary style="cursor:pointer;font-size:0.68rem;color:var(--gold-400);letter-spacing:0.08em;padding:4px 0;list-style:none;">\u25BE \u5C55\u5F00\u5168\u8C8C</summary>';
    html += '<div style="padding:6px 2px;">' + _detailHtml + '</div>';
    html += '</details>';
  }

  html += '</div>'; // card end

  // 子节点（展开时）
  if (!isLeaf && expanded) {
    html += '<div style="margin-top:0.3rem;">';
    for (var i = 0; i < div.children.length; i++) {
      html += _renderDivisionNode(div.children[i], depth + 1);
    }
    html += '</div>';
  }

  html += '</div>'; // outer
  return html;
}

// ═══════════════════════════════════════════════════════════════════
//  地区详情弹窗·人物志风格·点击卡片 → 弹出此 modal
// ═══════════════════════════════════════════════════════════════════

/** 立绘存储 key（按 div.id，回退 div.name） */
function _peLijuanKey(div) {
  return 'tm:divLijuan:' + (div.id || div.name || '_');
}
/** 读取立绘 dataURL（无则 null） */
function _peLijuanLoad(div) {
  try { return localStorage.getItem(_peLijuanKey(div)) || null; }
  catch (e) { return null; }
}
/** 保存立绘 dataURL（500KB 上限） */
function _peLijuanSave(div, dataUrl) {
  try {
    if (dataUrl && dataUrl.length > 500 * 1024 * 1.4) { // base64 ~ +33%
      if (typeof toast === 'function') toast('立绘过大（>500KB），请压缩后再导入');
      return false;
    }
    localStorage.setItem(_peLijuanKey(div), dataUrl);
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast('立绘保存失败：' + (e && e.message || '存储已满'));
    return false;
  }
}
/** 移除立绘 */
function _peLijuanRemove(div) {
  try { localStorage.removeItem(_peLijuanKey(div)); } catch (e) {}
}
/** 触发立绘文件选择（全局调用） */
function _peLijuanPick(idOrName) {
  var div = _peFindDivision(idOrName);
  if (!div) return;
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.style.display = 'none';
  input.onchange = function(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    if (f.size > 800 * 1024) {
      if (typeof toast === 'function') toast('原图 > 800KB，建议压缩；将尝试保存…');
    }
    var rd = new FileReader();
    rd.onload = function(e) {
      if (_peLijuanSave(div, e.target.result)) {
        if (typeof toast === 'function') toast('立绘已导入');
        // 刷新弹窗
        if (typeof window.openDivisionDetail === 'function') window.openDivisionDetail(div.id || div.name);
      }
    };
    rd.readAsDataURL(f);
  };
  document.body.appendChild(input);
  input.click();
  setTimeout(function(){ if (input.parentNode) input.parentNode.removeChild(input); }, 60000);
}
/** 移除立绘（确认后） */
function _peLijuanClear(idOrName) {
  var div = _peFindDivision(idOrName);
  if (!div) return;
  if (!confirm('确定移除此区划的立绘？')) return;
  _peLijuanRemove(div);
  if (typeof toast === 'function') toast('立绘已移除');
  if (typeof window.openDivisionDetail === 'function') window.openDivisionDetail(div.id || div.name);
}

/** 按 ID 或名称查找 division */
function _peFindDivision(idOrName) {
  if (!GM.adminHierarchy) return null;
  var found = null;
  Object.keys(GM.adminHierarchy).forEach(function(fk) {
    if (found) return;
    var tree = GM.adminHierarchy[fk];
    function walk(divs) {
      if (!Array.isArray(divs) || found) return;
      for (var i = 0; i < divs.length; i++) {
        var d = divs[i]; if (!d) continue;
        if (d.id === idOrName || d.name === idOrName) { found = d; return; }
        if (d.children) walk(d.children);
        if (d.divisions) walk(d.divisions);
      }
    }
    walk((tree && tree.divisions) || []);
  });
  return found;
}

/** 渲染区域属性 tag 徽章（hasPort / saltRegion / mineralRegion / horseRegion / fishingRegion / imperialDomain） */
function _peRenderTagBadges(div) {
  var tags = div.tags || {};
  var TAG_INFO = {
    hasPort:        { label: '沿海港', color: '#5e9bd4', icon: '⚓' },
    saltRegion:     { label: '产盐', color: '#e0d098', icon: '▲' },
    mineralRegion:  { label: '产矿', color: '#a88a6a', icon: '◈' },
    horseRegion:    { label: '草场', color: '#9bc28e', icon: '○' },
    fishingRegion:  { label: '渔区', color: '#5dadcb', icon: '◇' },
    imperialDomain: { label: '皇室直辖', color: '#c04030', icon: '☆' }
  };
  var html = '';
  var any = false;
  Object.keys(TAG_INFO).forEach(function(k) {
    if (!tags[k]) return;
    any = true;
    var info = TAG_INFO[k];
    html += '<span class="tm-div-tag" style="border-color:' + info.color + ';color:' + info.color + ';">'
         + '<span class="tm-div-tag-icon">' + info.icon + '</span>'
         + '<span>' + info.label + '</span></span>';
  });
  if (!any) html = '<span style="font-size:0.7rem;color:var(--color-foreground-muted);font-style:italic;">普通州县（无特殊属性）</span>';
  return html;
}

/** 渲染经济基础区·8 字段（farmland/commerce/maritime/salt/mineral/horse/fishing） */
function _peRenderEconomyBase(div) {
  var eb = div.economyBase || {};
  var tags = div.tags || {};
  var rows = [
    { id: 'farmland', label: '在编田亩', value: eb.farmland || 0, color: 'var(--celadon-400)', visible: true },
    { id: 'commerce', label: '商业繁荣度', value: eb.commerceVolume || 0, color: 'var(--gold-400)', sub: '系数 ' + (eb.commerceCoefficient != null ? eb.commerceCoefficient : 1.0).toFixed(1), visible: true },
    { id: 'maritime', label: '海贸量', value: eb.maritimeTradeVolume || 0, color: '#5e9bd4', visible: tags.hasPort },
    { id: 'salt', label: '盐产(斤/年)', value: eb.saltProduction || 0, color: '#e0d098', visible: tags.saltRegion },
    { id: 'mineral', label: '矿产(两/年)', value: eb.mineralProduction || 0, color: '#a88a6a', visible: tags.mineralRegion },
    { id: 'horse', label: '年产马匹', value: eb.horseProduction || 0, color: '#9bc28e', visible: tags.horseRegion },
    { id: 'fishing', label: '渔产(两/年)', value: eb.fishingProduction || 0, color: '#5dadcb', visible: tags.fishingRegion }
  ];
  var visibleRows = rows.filter(function(r) { return r.visible; });
  if (visibleRows.length === 0) {
    return '<div style="font-size:0.7rem;color:var(--color-foreground-muted);font-style:italic;padding:8px;">本区无特殊经济基础（仅田/商）</div>';
  }
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">';
  visibleRows.forEach(function(r) {
    html += '<div style="padding:6px 9px;background:rgba(255,255,255,0.03);border-left:2px solid ' + r.color + ';border-radius:3px;">';
    html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">' + r.label + '</div>';
    html += '<div style="font-size:0.85rem;color:' + r.color + ';font-weight:600;">' + _peN(r.value) + '</div>';
    if (r.sub) html += '<div style="font-size:0.58rem;color:var(--color-foreground-muted);margin-top:2px;">' + r.sub + '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/** 渲染皇室直辖资产区·仅 imperialDomain=true 显示 */
function _peRenderImperialAssets(div) {
  var tags = div.tags || {};
  if (!tags.imperialDomain) return '';
  var eb = div.economyBase || {};
  var ia = eb.imperialAssets || {};
  var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">';
  html += '<div style="padding:6px 9px;background:rgba(192,64,48,0.06);border-left:2px solid var(--vermillion-400);border-radius:3px;">';
  html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">皇庄亩数</div>';
  html += '<div style="font-size:0.85rem;color:var(--vermillion-400);font-weight:600;">' + _peN(eb.imperialFarmland || 0) + '</div>';
  html += '</div>';
  ['zhizao', 'kuangchang', 'yuyao'].forEach(function(k) {
    var labelMap = { zhizao: '织造局', kuangchang: '矿场', yuyao: '御窑' };
    html += '<div style="padding:6px 9px;background:rgba(192,64,48,0.06);border-left:2px solid var(--vermillion-400);border-radius:3px;">';
    html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">' + labelMap[k] + '</div>';
    html += '<div style="font-size:0.85rem;color:var(--vermillion-400);font-weight:600;">' + (ia[k] || 0) + ' 处</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/** 渲染基础设施区·驿站 + 科举解额 */
function _peRenderInfrastructure(div) {
  var eb = div.economyBase || {};
  var rq = (typeof eb.roadQuality === 'number') ? eb.roadQuality : 50;
  var rqClr = rq >= 60 ? '#6aa88a' : rq >= 35 ? 'var(--gold-400)' : 'var(--vermillion-400)';
  var rqLabel = rq >= 70 ? '驿道·良' : rq >= 50 ? '驿道·中' : rq >= 30 ? '驿道·差' : '崎岖';
  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
  // 驿站数
  html += '<div style="padding:7px 10px;background:rgba(255,255,255,0.03);border-left:2px solid var(--indigo-400,#7986cb);border-radius:3px;">';
  html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">驿站数</div>';
  html += '<div style="font-size:0.95rem;color:var(--indigo-400,#7986cb);font-weight:700;">' + _peN(eb.postRelays || 0) + ' <span style="font-size:0.55rem;font-weight:400;">驿</span></div>';
  html += '<div style="font-size:0.55rem;color:var(--ink-400);margin-top:2px;">驿递站银</div>';
  html += '</div>';
  // 道路质量·新
  html += '<div style="padding:7px 10px;background:rgba(255,255,255,0.03);border-left:2px solid ' + rqClr + ';border-radius:3px;">';
  html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">道路质量 · ' + rqLabel + '</div>';
  html += '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">';
  html += '<div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;"><div style="width:' + Math.min(100, rq) + '%;height:100%;background:' + rqClr + ';"></div></div>';
  html += '<div style="font-size:0.85rem;color:' + rqClr + ';font-weight:700;font-variant-numeric:tabular-nums;">' + Math.round(rq) + '</div>';
  html += '</div>';
  html += '<div style="font-size:0.55rem;color:var(--ink-400);margin-top:3px;">商旅/军调/驿递成本</div>';
  html += '</div>';
  // 科举解额
  html += '<div style="padding:7px 10px;background:rgba(255,255,255,0.03);border-left:2px solid var(--gold-400);border-radius:3px;">';
  html += '<div style="font-size:0.6rem;color:var(--color-foreground-muted);">科举解额</div>';
  html += '<div style="font-size:0.95rem;color:var(--gold-400);font-weight:700;">' + _peN(eb.kejuQuota || 0) + ' <span style="font-size:0.55rem;font-weight:400;">名</span></div>';
  html += '<div style="font-size:0.55rem;color:var(--ink-400);margin-top:2px;">教育/科举费</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

/** Hero 段·立绘 + 名号识别条 */
function _peRenderHero(div) {
  var safeId = String(div.id || div.name).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var lijuanUrl = _peLijuanLoad(div);
  var firstChar = (div.name || '').charAt(0) || '·';
  var subName = (div.name || '').slice(1, 6);

  // 立绘区
  var lijuanHtml = '<div class="tm-div-lijuan" onclick="_peLijuanPick(\'' + safeId + '\')" title="点击导入/更换立绘">';
  if (lijuanUrl) {
    lijuanHtml += '<img class="tm-div-lijuan-img" src="' + lijuanUrl + '" alt="' + escHtml(div.name) + '立绘"/>';
    lijuanHtml += '<div class="tm-div-lijuan-overlay"><div class="tm-div-lijuan-overlay-row">';
    lijuanHtml += '<span class="tm-div-lj-btn" onclick="event.stopPropagation();_peLijuanPick(\'' + safeId + '\')">更换</span>';
    lijuanHtml += '<span class="tm-div-lj-btn danger" onclick="event.stopPropagation();_peLijuanClear(\'' + safeId + '\')">移除</span>';
    lijuanHtml += '</div></div>';
  } else {
    lijuanHtml += '<div class="tm-div-lijuan-empty">';
    lijuanHtml += '<div class="tm-div-lj-char">' + escHtml(firstChar) + '</div>';
    if (subName) lijuanHtml += '<div class="tm-div-lj-sub">' + escHtml(subName) + '</div>';
    lijuanHtml += '<div class="tm-div-lj-hint">📜 点击导入立绘</div>';
    lijuanHtml += '</div>';
  }
  lijuanHtml += '</div>';

  // 名号识别条
  var idHtml = '<div class="tm-div-id">';
  idHtml += '<div class="tm-div-id-name">' + escHtml(div.name) + '</div>';

  // meta pills 行
  var pills = '<div class="tm-div-id-meta">';
  if (div.level) pills += '<span class="pill">' + escHtml(div.level) + '</span>';
  if (div.regionType && div.regionType !== 'normal') {
    var rtMap = { jimi:'羁縻', tusi:'土司', fanbang:'藩属', imperial_clan:'宗藩王封' };
    pills += '<span class="pill cool">' + escHtml(rtMap[div.regionType] || div.regionType) + '</span>';
  }
  if (div.terrain) pills += '<span class="pill muted">' + escHtml(div.terrain) + '</span>';
  if (div.taxLevel) {
    var tlClr = div.taxLevel === '重' ? 'danger' : div.taxLevel === '轻' ? 'cool' : 'warn';
    pills += '<span class="pill ' + tlClr + '">税额·' + escHtml(div.taxLevel) + '</span>';
  }
  if (div.officialPosition) pills += '<span class="pill muted">' + escHtml(div.officialPosition) + '</span>';
  if (div.governor) {
    var govSafe = String(div.governor).replace(/'/g,"\\'");
    pills += '<span class="gov-link" onclick="if(typeof showCharPopup===\'function\')showCharPopup(\'' + govSafe + '\',event)">主官·' + escHtml(div.governor) + '</span>';
  }
  pills += '</div>';
  idHtml += pills;

  // 描述
  if (div.description) {
    var desc = String(div.description);
    idHtml += '<div class="tm-div-id-desc" onclick="this.classList.toggle(\'expanded\')">' + escHtml(desc) + '</div>';
  }

  // 特产
  if (div.specialResources) {
    idHtml += '<div style="font-size:0.66rem;color:var(--gold-400);letter-spacing:0.05em;">▣ 特产 · ' + escHtml(div.specialResources) + '</div>';
  }

  // tags 徽章
  var tagsBody = _peRenderTagBadges(div);
  if (tagsBody && tagsBody.indexOf('普通州县') === -1) {
    idHtml += '<div class="tm-div-id-tags">' + tagsBody + '</div>';
  }

  idHtml += '</div>';

  return '<div class="tm-div-hero">' + lijuanHtml + idHtml + '</div>';
}

/** 6 格快览 */
function _peRenderQuickStats(div) {
  var _U = _peU();
  var eb = div.economyBase || {};
  var fis = div.fiscal || {};
  var pop = div.population || {};
  var mouths = (typeof div.population === 'number') ? div.population : (pop.mouths || 0);
  var households = pop.households || 0;
  var farmland = eb.farmland || 0;
  var commerce = eb.commerceVolume || 0;
  var coef = eb.commerceCoefficient != null ? eb.commerceCoefficient : 1.0;
  var actualRev = fis.actualRevenue || 0;
  var minxin = (typeof div.minxin === 'number') ? div.minxin : (typeof div.minxinLocal === 'number' ? div.minxinLocal : null);
  var corr = (typeof div.corruption === 'number') ? div.corruption : (typeof div.corruptionLocal === 'number' ? div.corruptionLocal : null);
  var mxClr = minxin == null ? 'var(--color-foreground-muted)' : (minxin >= 60 ? '#6aa88a' : minxin >= 40 ? 'var(--gold-400)' : 'var(--vermillion-400)');
  var crClr = corr == null ? 'var(--color-foreground-muted)' : (corr <= 30 ? '#6aa88a' : corr <= 60 ? 'var(--gold-400)' : 'var(--vermillion-400)');

  var html = '<div class="tm-div-quickstats">';
  html += '<div class="tm-div-qs"><div class="tm-div-qs-label">在编户口</div>'
       + '<div class="tm-div-qs-val" style="color:var(--celadon-400);">' + _peN(mouths) + '</div>'
       + '<div class="tm-div-qs-sub">' + _peN(households) + '户</div></div>';
  html += '<div class="tm-div-qs"><div class="tm-div-qs-label">在编田亩</div>'
       + '<div class="tm-div-qs-val" style="color:#9bc28e;">' + _peN(farmland) + '</div>'
       + '<div class="tm-div-qs-sub">亩</div></div>';
  html += '<div class="tm-div-qs"><div class="tm-div-qs-label">商业</div>'
       + '<div class="tm-div-qs-val" style="color:var(--gold-400);">' + _peN(commerce) + '</div>'
       + '<div class="tm-div-qs-sub">系数 ' + coef.toFixed(1) + '</div></div>';
  html += '<div class="tm-div-qs"><div class="tm-div-qs-label">实征</div>'
       + '<div class="tm-div-qs-val" style="color:var(--gold-300);">' + _peN(actualRev) + '</div>'
       + '<div class="tm-div-qs-sub">' + _U.money + '</div></div>';
  html += '<div class="tm-div-qs"><div class="tm-div-qs-label">民心</div>'
       + '<div class="tm-div-qs-val" style="color:' + mxClr + ';">' + (minxin == null ? '—' : minxin) + '</div>'
       + '<div class="tm-div-qs-sub">/100</div></div>';
  html += '<div class="tm-div-qs"><div class="tm-div-qs-label">腐败</div>'
       + '<div class="tm-div-qs-val" style="color:' + crClr + ';">' + (corr == null ? '—' : corr) + '</div>'
       + '<div class="tm-div-qs-sub">/100</div></div>';
  html += '</div>';
  return html;
}

/** 升级版 section 容器（支持 aside） */
function _peSectionV2(icon, title, bodyHtml, aside) {
  var h = '<div class="tm-div-section">';
  h += '<div class="tm-div-section-title">';
  h += '<span class="tm-div-section-icon">' + icon + '</span>';
  h += '<span class="tm-div-section-name">' + title + '</span>';
  if (aside) h += '<span class="tm-div-section-aside">' + aside + '</span>';
  h += '</div>';
  h += bodyHtml;
  h += '</div>';
  return h;
}

/** 渲染单条核算行（name | formula | amount） */
function _peLineItem(name, formula, amount, unit, color) {
  var html = '<div class="tm-div-line-row">';
  html += '<div class="tm-div-line-name" style="color:' + (color || 'var(--color-foreground)') + ';">' + escHtml(name) + '</div>';
  html += '<div class="tm-div-line-formula">' + (formula ? escHtml(formula) : '') + '</div>';
  html += '<div class="tm-div-line-amount" style="color:' + (color || 'var(--color-foreground)') + ';">' + _peN(amount) + ' <span class="tm-div-line-unit">' + (unit || '') + '</span></div>';
  html += '</div>';
  return html;
}

/** 应输上解·赋税核算细目（按 division.economyBase 实时算 7-9 项） */
function _peRenderRevenueBreakdown(div) {
  var eb = div.economyBase || {};
  var tags = div.tags || {};
  var pop = div.population || {};
  var ding = pop.ding || (typeof div.population === 'number' ? Math.floor(div.population * 0.25) : 0);
  var households = pop.households || 0;
  var policies = (typeof GM !== 'undefined' && GM && GM.policies) || {};
  var landRate = policies.landTaxRate != null ? policies.landTaxRate : 0.04;
  var pollTax = policies.pollTaxPerCapita != null ? policies.pollTaxPerCapita : 0.03;
  var saltPrice = policies.saltPrice != null ? policies.saltPrice : 0.05;
  var saltRate = policies.saltTaxRate != null ? policies.saltTaxRate : 0.40;
  var maritimeRate = policies.maritimeTaxRate != null ? policies.maritimeTaxRate : 0.08;
  var commerceRate = policies.commerceTaxRate != null ? policies.commerceTaxRate : 0.03;
  var mineralRate = policies.mineralTaxRate != null ? policies.mineralTaxRate : 0.20;
  var actualRate = (typeof GM !== 'undefined' && GM && GM.guoku && GM.guoku.actualTaxRate != null) ? GM.guoku.actualTaxRate : 1;
  var grainPrice = (typeof GM !== 'undefined' && GM && GM.currency && GM.currency.market && GM.currency.market.grainPrice) || 100;
  var _U = _peU();

  var rows = [];
  var subtotal = 0;

  // 田赋
  var farmland = eb.farmland || 0;
  if (farmland > 0) {
    var tianfu = farmland * landRate * actualRate;
    rows.push({ name: '田赋·正赋', formula: '田 ' + _peN(farmland) + '亩 × ' + (landRate*100).toFixed(1) + '%', amount: tianfu * 0.9, c: 'var(--celadon-400)' });
    rows.push({ name: '田赋·附加(漕水)', formula: '正赋 × 10%', amount: tianfu * 0.1, c: 'var(--celadon-400)' });
    subtotal += tianfu;
  }

  // 丁银
  if (ding > 0) {
    var dingTax = ding * pollTax * actualRate;
    rows.push({ name: '丁银', formula: '丁 ' + _peN(ding) + ' × ' + pollTax.toFixed(2), amount: dingTax, c: '#9bc28e' });
    subtotal += dingTax;
  }

  // 漕粮（折银）
  if (households > 0) {
    var grainAmount = households * 5 * 0.005;  // ~ 户均口数 × 比例
    if (typeof div.population === 'number') grainAmount = div.population * 0.005;
    else if (pop.mouths) grainAmount = pop.mouths * 0.005;
    var caoliang = grainAmount * grainPrice / 100;
    if (caoliang > 0) {
      rows.push({ name: '漕粮(折银)', formula: _peN(grainAmount) + ' 石 × 价 ' + grainPrice/100 + ' 两/石', amount: caoliang, c: 'var(--gold-400)' });
      subtotal += caoliang;
    }
  }

  // 盐课
  if (tags.saltRegion && eb.saltProduction > 0) {
    var saltTax = eb.saltProduction * saltPrice * saltRate;
    rows.push({ name: '盐课', formula: _peN(eb.saltProduction) + ' 斤 × ' + saltPrice + ' × ' + (saltRate*100) + '%', amount: saltTax, c: '#e0d098' });
    subtotal += saltTax;
  }

  // 矿税
  if (tags.mineralRegion && eb.mineralProduction > 0) {
    var miningTax = eb.mineralProduction * mineralRate;
    rows.push({ name: '矿税', formula: _peN(eb.mineralProduction) + ' 两产 × ' + (mineralRate*100) + '%', amount: miningTax, c: '#a88a6a' });
    subtotal += miningTax;
  }

  // 关津商税
  if (eb.commerceVolume > 0) {
    var coef = eb.commerceCoefficient != null ? eb.commerceCoefficient : 1.0;
    var commerceTax = eb.commerceVolume * coef * commerceRate;
    rows.push({ name: '关津税', formula: '商 ' + _peN(eb.commerceVolume) + ' × 系 ' + coef.toFixed(1) + ' × ' + (commerceRate*100) + '% ÷ 2', amount: commerceTax * 0.5, c: 'var(--gold-400)' });
    rows.push({ name: '城商税', formula: '同上 ÷ 2', amount: commerceTax * 0.5, c: 'var(--gold-400)' });
    subtotal += commerceTax;
  }

  // 市舶
  if (tags.hasPort && eb.maritimeTradeVolume > 0) {
    var shibo = eb.maritimeTradeVolume * maritimeRate;
    rows.push({ name: '市舶税', formula: '海 ' + _peN(eb.maritimeTradeVolume) + ' × ' + (maritimeRate*100) + '%', amount: shibo, c: '#5e9bd4' });
    subtotal += shibo;
  }

  // 渔课
  if (tags.fishingRegion && eb.fishingProduction > 0) {
    var yu = eb.fishingProduction * 0.10;
    rows.push({ name: '渔课', formula: _peN(eb.fishingProduction) + ' × 10%', amount: yu, c: '#5dadcb' });
    subtotal += yu;
  }

  // 马征(折银)·抵扣性质
  if (tags.horseRegion && eb.horseProduction > 0) {
    var ma = eb.horseProduction * 50;
    rows.push({ name: '马征(折银抵扣)', formula: _peN(eb.horseProduction) + ' 匹 × 50/匹', amount: ma, c: '#9bc28e' });
    subtotal += ma;
  }

  if (rows.length === 0) {
    return '<div class="tm-div-empty">本区无可核算赋税项目（建议在编辑器配置 economyBase）</div>';
  }

  var html = '<div class="tm-div-line-list">';
  rows.forEach(function(r){ html += _peLineItem(r.name, r.formula, r.amount, _U.money, r.c); });
  html += '</div>';
  html += '<div class="tm-div-line-total"><span class="tm-div-line-total-label">合 计 · 年估</span><span class="tm-div-line-total-val">' + _peN(subtotal) + ' ' + _U.money + '</span></div>';
  // 与实际比对·双向警示（漏征 OR 加派均偏离健康区间）
  if (div.fiscal && div.fiscal.claimedRevenue) {
    var ratio = subtotal > 0 ? (div.fiscal.claimedRevenue / subtotal * 100) : 0;
    var ratioClr, ratioNote;
    if (ratio >= 85 && ratio <= 120) { ratioClr = '#6aa88a'; ratioNote = ''; }            // 健康
    else if (ratio >= 60 && ratio <= 160) { ratioClr = 'var(--gold-400)'; ratioNote = ''; } // 偏离
    else { ratioClr = 'var(--vermillion-400)'; ratioNote = ratio > 160 ? ' · 加派重压' : ' · 漏征严重'; }
    html += '<div class="tm-div-compare">名义已征 ' + _peN(div.fiscal.claimedRevenue) + ' ' + _U.money + ' · 占核算 <span style="color:' + ratioClr + ';">' + ratio.toFixed(0) + '%</span>' + ratioNote + '</div>';
  }
  return html;
}

/** 应负岁出·经费核算（仅可归属本区的项） */
function _peRenderExpenseBreakdown(div) {
  var eb = div.economyBase || {};
  var pop = div.population || {};
  var households = pop.households || 0;
  var _U = _peU();

  var rows = [];
  var subtotal = 0;

  // 驿递站银
  if (eb.postRelays > 0) {
    var post = eb.postRelays * 200;
    rows.push({ name: '驿递站银', formula: '驿 ' + eb.postRelays + ' × 200/驿', amount: post, c: 'var(--indigo-400,#7986cb)' });
    subtotal += post;
  }

  // 教育/科举经费
  if (eb.kejuQuota > 0) {
    var keju = eb.kejuQuota * 50;
    rows.push({ name: '教育常费', formula: '解额 ' + eb.kejuQuota + ' × 50/名', amount: keju, c: 'var(--gold-400)' });
    subtotal += keju;
  }

  // 在地俸禄（按驻地角色 salary 之和粗估）
  var localSalary = 0, localCount = 0;
  if (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars) && div.name) {
    GM.chars.forEach(function(c) {
      if (c.alive === false) return;
      if (!_isSameLocation(c.location, div.name)) return;
      var sal = (typeof c.salary === 'number') ? c.salary : 0;
      if (sal > 0) { localSalary += sal * 12; localCount++; }
    });
  }
  if (localSalary > 0) {
    rows.push({ name: '在地俸禄', formula: '驻官 ' + localCount + ' 人 · 月俸 × 12', amount: localSalary, c: 'var(--amber-400)', note: '官品制' });
    subtotal += localSalary;
  }

  // 在地灾赈(本回合)
  var disasterRelief = 0;
  if (div.fiscal && div.fiscal.expenditures && div.fiscal.expenditures.discretionary) {
    div.fiscal.expenditures.discretionary.forEach(function(act) {
      if (act.type === 'disaster_relief' || act.type === 'public_works_water') disasterRelief += (act.amount || 0);
    });
  }
  if (disasterRelief > 0) {
    rows.push({ name: '本回合·赈灾水利', formula: 'div.fiscal.expenditures', amount: disasterRelief, c: 'var(--celadon-400)' });
    subtotal += disasterRelief;
  }

  // 在地军饷（如有 GM.armies 驻在此地）
  var localGarrison = 0, garrisonName = '';
  if (typeof GM !== 'undefined' && GM && Array.isArray(GM.armies) && div.name) {
    GM.armies.forEach(function(a) {
      if (_isSameLocation(a.location, div.name) || _isSameLocation(a.station, div.name)) {
        var troops = a.troops || a.initialTroops || a.size || 0;
        var pay = (a.payPerSoldier || 1.5) * troops * 12;
        localGarrison += pay;
        if (!garrisonName && a.name) garrisonName = a.name;
      }
    });
  }
  if (localGarrison > 0) {
    rows.push({ name: '在地军饷', formula: '驻军 × ' + (garrisonName || '部队') + ' × 12月', amount: localGarrison, c: 'var(--vermillion-400)' });
    subtotal += localGarrison;
  }

  if (rows.length === 0) {
    return '<div class="tm-div-empty">本区无可归属本区的中央经费支出（可在编辑器配置 postRelays/kejuQuota）</div>';
  }

  var html = '<div class="tm-div-line-list">';
  rows.forEach(function(r){ html += _peLineItem(r.name, r.formula, r.amount, _U.money, r.c); });
  html += '</div>';
  html += '<div class="tm-div-line-total"><span class="tm-div-line-total-label">合 计 · 年估</span><span class="tm-div-line-total-val">' + _peN(subtotal) + ' ' + _U.money + '</span></div>';
  return html;
}

/** 在灾实录·disasterRecord */
function _peRenderDisasters(div) {
  var eb = div.economyBase || {};
  var dr = eb.disasterRecord || [];
  if (!Array.isArray(dr) || dr.length === 0) {
    if (div.environment && div.environment.ecoScars && Object.keys(div.environment.ecoScars).length) {
      return '<div class="tm-div-empty">无在灾·但留 <span style="color:var(--amber-400);">生态痤疮</span>：' + Object.keys(div.environment.ecoScars).join('、') + '</div>';
    }
    return '';
  }
  var TYPE_INFO = {
    drought:    { label: '旱', icon: '☀', color: '#d4a838' },
    flood:      { label: '水', icon: '~',  color: '#5e9bd4' },
    plague:     { label: '瘟', icon: '⊙', color: '#a55ad4' },
    locust:     { label: '蝗', icon: '※', color: '#9bc28e' },
    earthquake: { label: '震', icon: '☷', color: '#a88a6a' },
    cold:       { label: '寒', icon: '❄', color: '#7eb8a7' }
  };
  var html = '<div class="tm-div-disaster-list">';
  dr.forEach(function(rec) {
    var info = TYPE_INFO[rec.type] || { label: rec.type || '?', icon: '!', color: 'var(--vermillion-400)' };
    var sev = rec.severity || 1;
    var sevLabel = sev >= 3 ? '重' : sev >= 2 ? '中' : '轻';
    html += '<div class="tm-div-disaster-row" style="border-left-color:' + info.color + ';">';
    html += '<span class="tm-div-disaster-icon" style="color:' + info.color + ';">' + info.icon + '</span>';
    html += '<span class="tm-div-disaster-name" style="color:' + info.color + ';">' + info.label + '</span>';
    html += '<span class="tm-div-disaster-sev">' + sevLabel + '</span>';
    if (rec.startTurn) html += '<span class="tm-div-disaster-time">起 第 ' + rec.startTurn + ' 回合</span>';
    if (rec.note) html += '<span class="tm-div-disaster-note">' + escHtml(String(rec.note)) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/** 公库完整账·扩展（quota/deficit/handover/inflowOutflow） */
function _peRenderTreasuryFull(div) {
  var pt = div.publicTreasury;
  if (!pt) return '';
  var _U = _peU();
  var html = '<div class="tm-div-treasury-grid">';
  ['money','grain','cloth'].forEach(function(k){
    var led = pt[k]; if (!led) return;
    var unit = _U[k];
    var labelMap = { money:'银 账', grain:'粮 账', cloth:'布 账' };
    var clrMap = { money:'var(--gold-400)', grain:'var(--celadon-400)', cloth:'var(--amber-400)' };
    var clr = clrMap[k];
    var stock = led.stock || 0;
    var quota = led.quota || 0;
    var deficit = led.deficit || 0;
    var inflow = led.inflowThisTurn || led.inflow || 0;
    var outflow = led.outflowThisTurn || led.outflow || 0;
    var fillPct = quota > 0 ? Math.min(100, stock / quota * 100) : 0;
    html += '<div class="tm-div-treasury-card" style="border-left-color:' + clr + ';">';
    html += '<div class="tm-div-treasury-head"><span class="tm-div-treasury-label">' + labelMap[k] + '</span>';
    if (deficit > 0) html += '<span class="tm-div-treasury-deficit">亏 ' + _peN(deficit) + '</span>';
    html += '</div>';
    html += '<div class="tm-div-treasury-stock" style="color:' + clr + ';">' + _peN(stock) + ' <span class="tm-div-treasury-unit">' + unit + '</span></div>';
    if (quota > 0) {
      html += '<div class="tm-div-treasury-bar"><div style="width:' + fillPct + '%;background:' + clr + ';"></div></div>';
      html += '<div class="tm-div-treasury-quota">额 ' + _peN(quota) + ' · 实占 ' + fillPct.toFixed(0) + '%</div>';
    }
    if (inflow || outflow) {
      html += '<div class="tm-div-treasury-flow">';
      if (inflow) html += '<span style="color:#6aa88a;">↑ 入 ' + _peN(inflow) + '</span> ';
      if (outflow) html += '<span style="color:var(--vermillion-400);">↓ 出 ' + _peN(outflow) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  // 经手人 + 交接
  if (pt.currentHead || pt.previousHead || (pt.handoverLog && pt.handoverLog.length)) {
    html += '<div class="tm-div-treasury-meta">';
    if (pt.currentHead) html += '现掌库：<span style="color:var(--gold-400);">' + escHtml(pt.currentHead) + '</span>';
    if (pt.previousHead) html += ' · 前任：' + escHtml(pt.previousHead);
    if (pt.handoverLog && pt.handoverLog.length) html += ' · 交接案卷 ' + pt.handoverLog.length + ' 条';
    html += '</div>';
  }
  return html;
}

/** 承载力·完整账（环境系统的承载力田亩，独立于税基 economyBase.farmland） */
function _peRenderCarryingCapacityFull(div) {
  var cc = div.carryingCapacity || (div.environment && div.environment.carryingCapacity) || null;
  if (!cc && div.environment) cc = {
    arable: div.environment.arableLand || 0,
    water: div.environment.waterCapacity || 0,
    climate: div.environment.climate || 1.0,
    historicalCap: div.environment.historicalCap || 0,
    currentLoad: div.environment.currentLoad || 0,
    carryingRegime: div.environment.carryingRegime || ''
  };
  if (!cc) return '<div class="tm-div-empty">承载力数据未配置</div>';

  var loadPct = (cc.currentLoad || 0) * 100;
  var loadClr = loadPct > 90 ? 'var(--vermillion-400)' : loadPct > 75 ? 'var(--amber-400)' : '#6aa88a';
  var REGIME_INFO = {
    abundant:    { label: '丰饶', color: '#6aa88a' },
    sustainable: { label: '可持续', color: '#6aa88a' },
    strained:    { label: '紧张', color: 'var(--amber-400)' },
    overload:    { label: '超载', color: 'var(--vermillion-400)' },
    collapse:    { label: '崩塌', color: 'var(--vermillion-400)' }
  };
  var regimeInfo = REGIME_INFO[cc.carryingRegime] || { label: cc.carryingRegime || '未评定', color: 'var(--color-foreground-muted)' };

  var html = '<div class="tm-div-cc-grid">';
  // 承载力田亩
  html += '<div class="tm-div-cc-card" style="border-left-color:#9bc28e;">'
       + '<div class="tm-div-cc-label">承载力·耕地</div>'
       + '<div class="tm-div-cc-val" style="color:#9bc28e;">' + _peN(cc.arable || 0) + ' 亩</div>'
       + '<div class="tm-div-cc-sub">环境最大承载</div>'
       + '</div>';
  // 水容量
  html += '<div class="tm-div-cc-card" style="border-left-color:#5e9bd4;">'
       + '<div class="tm-div-cc-label">水容量</div>'
       + '<div class="tm-div-cc-val" style="color:#5e9bd4;">' + _peN(cc.water || 0) + '</div>'
       + '<div class="tm-div-cc-sub">饮水/灌溉</div>'
       + '</div>';
  // 气候
  html += '<div class="tm-div-cc-card" style="border-left-color:var(--celadon-400);">'
       + '<div class="tm-div-cc-label">气候系数</div>'
       + '<div class="tm-div-cc-val" style="color:var(--celadon-400);">' + (cc.climate != null ? cc.climate.toFixed(2) : '1.00') + '</div>'
       + '<div class="tm-div-cc-sub">1.0=常年</div>'
       + '</div>';
  // 历史峰值
  html += '<div class="tm-div-cc-card" style="border-left-color:var(--gold-400);">'
       + '<div class="tm-div-cc-label">历史峰值</div>'
       + '<div class="tm-div-cc-val" style="color:var(--gold-400);">' + _peN(cc.historicalCap || 0) + '</div>'
       + '<div class="tm-div-cc-sub">最大可承载</div>'
       + '</div>';
  html += '</div>';

  // 载率 + 体制
  html += '<div class="tm-div-cc-load">';
  html += '<div class="tm-div-cc-load-label">当前载率</div>';
  html += '<div class="tm-div-cc-load-bar"><div style="width:' + Math.min(100, loadPct) + '%;background:' + loadClr + ';"></div>'
       + (loadPct > 100 ? '<div class="overflow" style="width:' + (loadPct - 100) + '%;background:var(--vermillion-400);"></div>' : '')
       + '</div>';
  html += '<div class="tm-div-cc-load-val" style="color:' + loadClr + ';">' + loadPct.toFixed(0) + '%</div>';
  html += '<div class="tm-div-cc-regime" style="color:' + regimeInfo.color + ';border-color:' + regimeInfo.color + ';">' + regimeInfo.label + '</div>';
  html += '</div>';

  // 生态痤疮
  var scars = (div.environment && div.environment.ecoScars) || cc.ecoScars;
  if (scars && Object.keys(scars).length > 0) {
    var SCAR_INFO = {
      deforestation: { label: '伐木', color: '#a88a6a' },
      desertification: { label: '荒漠化', color: '#d4a838' },
      salinization: { label: '盐碱', color: '#e0d098' },
      siltation: { label: '淤积', color: '#7eb8a7' },
      flooding: { label: '水患', color: '#5e9bd4' }
    };
    html += '<div class="tm-div-scars">';
    html += '<div class="tm-div-scars-label">生态痤疮</div>';
    html += '<div class="tm-div-scars-list">';
    Object.keys(scars).forEach(function(k) {
      var info = SCAR_INFO[k] || { label: k, color: 'var(--amber-400)' };
      var sev = scars[k];
      var sevLabel = sev > 0.7 ? '深' : sev > 0.4 ? '中' : '轻';
      html += '<span class="tm-div-scar-badge" style="border-color:' + info.color + ';color:' + info.color + ';">'
           + info.label + ' · ' + sevLabel + '</span>';
    });
    html += '</div></div>';
  }

  return html;
}

/** 田亩流转·展示当前册数 + 累计兼并/开垦/清丈 + 本回合 delta */
function _peRenderLandFlow(div) {
  var eb = div.economyBase || {};
  var farmland = eb.farmland || 0;
  var imperialFarmland = eb.imperialFarmland || 0;
  var landsAnnexed = eb.landsAnnexed || 0;
  var landsReclaimed = eb.landsReclaimed || 0;
  var landsSurveyed = eb.landsSurveyed || 0;
  var ccArable = (div.carryingCapacity && div.carryingCapacity.arable) || 0;
  var thisTurn = div._thisTurnLandFlow || null;

  // 第一行·四态 stock 显示（在编/承载/皇庄/累计兼并）
  var html = '<div class="tm-div-landflow-grid">';
  html += '<div class="tm-div-landflow-card" style="border-left-color:#9bc28e;">';
  html += '<div class="tm-div-landflow-label">在编田亩 <span class="tm-div-landflow-tag">税基</span></div>';
  html += '<div class="tm-div-landflow-val" style="color:#9bc28e;">' + _peN(farmland) + ' 亩</div>';
  html += '<div class="tm-div-landflow-sub">economyBase.farmland · 田赋核算</div>';
  html += '</div>';
  html += '<div class="tm-div-landflow-card" style="border-left-color:var(--celadon-400);">';
  html += '<div class="tm-div-landflow-label">承载耕地 <span class="tm-div-landflow-tag">环境</span></div>';
  html += '<div class="tm-div-landflow-val" style="color:var(--celadon-400);">' + _peN(ccArable) + ' 亩</div>';
  html += '<div class="tm-div-landflow-sub">carryingCapacity.arable · 环境承载</div>';
  html += '</div>';
  if (imperialFarmland > 0) {
    html += '<div class="tm-div-landflow-card" style="border-left-color:var(--vermillion-400);">';
    html += '<div class="tm-div-landflow-label">皇庄亩数 <span class="tm-div-landflow-tag">直辖</span></div>';
    html += '<div class="tm-div-landflow-val" style="color:var(--vermillion-400);">' + _peN(imperialFarmland) + ' 亩</div>';
    html += '<div class="tm-div-landflow-sub">imperialFarmland · 内帑收</div>';
    html += '</div>';
  }
  if (landsAnnexed > 0) {
    html += '<div class="tm-div-landflow-card" style="border-left-color:var(--amber-400);">';
    html += '<div class="tm-div-landflow-label">累计兼并 <span class="tm-div-landflow-tag">流失</span></div>';
    html += '<div class="tm-div-landflow-val" style="color:var(--amber-400);">' + _peN(landsAnnexed) + ' 亩</div>';
    html += '<div class="tm-div-landflow-sub">豪强吞并·清丈可回</div>';
    html += '</div>';
  }
  html += '</div>';

  // 第二行·本回合 delta（如已结算过）
  if (thisTurn && (thisTurn.annexed || thisTurn.reclaimed || thisTurn.surveyed)) {
    html += '<div class="tm-div-landflow-delta">';
    html += '<div class="tm-div-landflow-delta-label">本回合流转</div>';
    html += '<div class="tm-div-landflow-delta-rows">';
    if (thisTurn.annexed > 0) {
      html += '<span class="tm-div-landflow-delta-item" style="color:var(--amber-400);">⊖ 兼并 ' + _peN(thisTurn.annexed) + ' 亩</span>';
    }
    if (thisTurn.reclaimed > 0) {
      html += '<span class="tm-div-landflow-delta-item" style="color:#6aa88a;">⊕ 开垦 ' + _peN(thisTurn.reclaimed) + ' 亩</span>';
    }
    if (thisTurn.surveyed > 0) {
      html += '<span class="tm-div-landflow-delta-item" style="color:var(--gold-300);">⊙ 清丈回归 ' + _peN(thisTurn.surveyed) + ' 亩</span>';
    }
    var netClr = thisTurn.net > 0 ? '#6aa88a' : thisTurn.net < 0 ? 'var(--vermillion-400)' : 'var(--color-foreground-muted)';
    var netSign = thisTurn.net > 0 ? '+' : '';
    html += '<span class="tm-div-landflow-delta-net" style="color:' + netClr + ';">净 ' + netSign + _peN(thisTurn.net) + ' 亩</span>';
    html += '</div></div>';
  }

  // 第三行·累计·开垦/清丈
  if (landsReclaimed > 0 || landsSurveyed > 0) {
    html += '<div class="tm-div-landflow-cumul">';
    if (landsReclaimed > 0) html += '<span class="tm-div-landflow-cumul-item" style="color:#6aa88a;">⊕ 累计开垦 ' + _peN(landsReclaimed) + ' 亩</span>';
    if (landsSurveyed > 0) html += '<span class="tm-div-landflow-cumul-item" style="color:var(--gold-300);">⊙ 累计清丈回归 ' + _peN(landsSurveyed) + ' 亩</span>';
    html += '</div>';
  }

  // 注·机制说明
  html += '<div class="tm-div-landflow-note">'
       + '<span style="color:var(--vermillion-400);">兼并</span> · 腐败 > 50 时按 (corr-50)/100×4%/年 流失到豪强 ｜ '
       + '<span style="color:#6aa88a;">开垦</span> · 载率 < 0.7 时按 (1-load)×1.5%/年 增加（劝农政策×2.5）｜ '
       + '<span style="color:var(--gold-300);">清丈</span> · 诏令触发·按 30-60% 比例从兼并回归（民心高 → 比例高）'
       + '</div>';
  return html;
}

/** 地方实绩·展示本回合财政与田亩相对上回合的变化 */
function _peRenderLocalAchievements(div) {
  var fis = div.fiscal || {};
  var lt = div._lastTurnFiscal || null;
  var eb = div.economyBase || {};
  var thisTurnLand = div._thisTurnLandFlow || null;
  var _U = _peU();

  if (!lt && !thisTurnLand) {
    return '<div class="tm-div-empty">尚无上回合数据可比对·首回合或新近设立</div>';
  }

  var rows = [];

  // 田亩变化
  if (thisTurnLand && (thisTurnLand.before !== thisTurnLand.after)) {
    var delta = thisTurnLand.after - thisTurnLand.before;
    rows.push({
      label: '在编田亩',
      before: thisTurnLand.before,
      after: thisTurnLand.after,
      delta: delta,
      unit: '亩',
      narrative: thisTurnLand.surveyed > 0 ? '清丈复田' : (delta > 0 ? '开垦增田' : '兼并失田')
    });
  }

  // 名义已征
  if (lt && fis.claimedRevenue != null) {
    var d = (fis.claimedRevenue || 0) - (lt.claimedRevenue || 0);
    if (d !== 0) rows.push({
      label: '名义已征',
      before: lt.claimedRevenue,
      after: fis.claimedRevenue,
      delta: d,
      unit: _U.money,
      narrative: ''
    });
  }
  // 实征
  if (lt && fis.actualRevenue != null) {
    var d2 = (fis.actualRevenue || 0) - (lt.actualRevenue || 0);
    if (d2 !== 0) rows.push({
      label: '实征到账',
      before: lt.actualRevenue,
      after: fis.actualRevenue,
      delta: d2,
      unit: _U.money,
      narrative: ''
    });
  }
  // 上解中央
  if (lt && fis.remittedToCenter != null) {
    var d3 = (fis.remittedToCenter || 0) - (lt.remittedToCenter || 0);
    if (d3 !== 0) rows.push({
      label: '上解中央',
      before: lt.remittedToCenter,
      after: fis.remittedToCenter,
      delta: d3,
      unit: _U.money,
      narrative: ''
    });
  }

  if (rows.length === 0) {
    return '<div class="tm-div-empty">本回合无数据变化</div>';
  }

  var html = '<div class="tm-div-achieve-list">';
  rows.forEach(function(r) {
    var deltaClr = r.delta > 0 ? '#6aa88a' : 'var(--vermillion-400)';
    var deltaSign = r.delta > 0 ? '+' : '';
    var pct = r.before > 0 ? (r.delta / r.before * 100) : 0;
    html += '<div class="tm-div-achieve-row">';
    html += '<div class="tm-div-achieve-label">' + r.label + '</div>';
    html += '<div class="tm-div-achieve-flow"><span class="tm-div-achieve-prev">' + _peN(r.before) + '</span>';
    html += '<span class="tm-div-achieve-arrow" style="color:' + deltaClr + ';">→</span>';
    html += '<span class="tm-div-achieve-now" style="color:' + deltaClr + ';">' + _peN(r.after) + '</span>';
    html += '<span class="tm-div-achieve-unit">' + r.unit + '</span></div>';
    html += '<div class="tm-div-achieve-delta" style="color:' + deltaClr + ';">' + deltaSign + _peN(r.delta);
    if (Math.abs(pct) > 0.1) html += ' <span class="tm-div-achieve-pct">(' + deltaSign + pct.toFixed(1) + '%)</span>';
    html += '</div>';
    if (r.narrative) html += '<div class="tm-div-achieve-narr">' + r.narrative + '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/** 辖区·子区清单（仅 children.length > 0 时） */
function _peRenderChildrenList(div) {
  if (!div.children || !div.children.length) return '';
  var html = '<div class="tm-div-children-grid">';
  div.children.forEach(function(c) {
    if (!c) return;
    var safeId = String(c.id || c.name).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var pop = (c.populationDetail && c.populationDetail.mouths) || (typeof c.population === 'number' ? c.population : 0);
    var grandCount = 0;
    if (c.children) c.children.forEach(function(){ grandCount++; });
    html += '<div class="tm-div-child-card" onclick="if(typeof openDivisionDetail===\'function\')openDivisionDetail(\'' + safeId + '\')">';
    html += '<div class="tm-div-child-name">' + escHtml(c.name) + '</div>';
    if (c.level) html += '<div class="tm-div-child-level">' + escHtml(c.level) + '</div>';
    var subInfo = [];
    if (pop > 0) subInfo.push(_peN(pop) + '口');
    if (grandCount > 0) subInfo.push('辖 ' + grandCount);
    if (c.governor) subInfo.push(escHtml(c.governor));
    if (subInfo.length) html += '<div class="tm-div-child-sub">' + subInfo.join(' · ') + '</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/** byAge 详细·补 counts（旧版只有 ratios） */
function _peRenderAgeDetail(div) {
  var ba = div.byAge; if (!ba) return '';
  var pop = div.population || {};
  var mouths = (typeof div.population === 'number') ? div.population : (pop.mouths || 0);
  var young = (ba.young && ba.young.count) || Math.round(mouths * (ba.young && ba.young.ratio || 0.35));
  var ding = (ba.ding && ba.ding.count) || Math.round(mouths * (ba.ding && ba.ding.ratio || 0.55));
  var old = (ba.old && ba.old.count) || Math.round(mouths * (ba.old && ba.old.ratio || 0.10));
  var html = '<div class="tm-div-age-grid">';
  html += '<div class="tm-div-age-card" style="border-left-color:var(--celadon-400);"><div class="tm-div-age-label">幼 (15以下)</div><div class="tm-div-age-val" style="color:var(--celadon-400);">' + _peN(young) + ' 口</div><div class="tm-div-age-sub">' + ((young/mouths)*100).toFixed(1) + '%</div></div>';
  html += '<div class="tm-div-age-card" style="border-left-color:var(--gold-400);"><div class="tm-div-age-label">丁 (15-60·赋役)</div><div class="tm-div-age-val" style="color:var(--gold-400);">' + _peN(ding) + ' 口</div><div class="tm-div-age-sub">' + ((ding/mouths)*100).toFixed(1) + '% · 主要纳税基</div></div>';
  html += '<div class="tm-div-age-card" style="border-left-color:var(--ink-300);"><div class="tm-div-age-label">老 (60以上)</div><div class="tm-div-age-val" style="color:var(--ink-300);">' + _peN(old) + ' 口</div><div class="tm-div-age-sub">' + ((old/mouths)*100).toFixed(1) + '%</div></div>';
  html += '</div>';
  return html;
}

/** 弹出区划详情·复用 openGenericModal */
function openDivisionDetail(idOrName) {
  if (typeof openGenericModal !== 'function') {
    if (typeof toast === 'function') toast('详情弹窗框架未加载');
    return;
  }
  var div = _peFindDivision(idOrName);
  if (!div) {
    if (typeof toast === 'function') toast('未找到区划：' + idOrName);
    return;
  }
  // 触发一次 _renderDivisionNode 缓存详情体（供下方使用）
  if (!div._cachedDetailBody) {
    try { _renderDivisionNode(div, 0); } catch (e) {}
  }
  var detailBody = div._cachedDetailBody || '';

  // 子区数（对非叶子节点）
  var subCount = 0;
  if (div.children && div.children.length) {
    function _cnt(arr) { if (!arr) return; arr.forEach(function(c){ subCount++; if (c.children) _cnt(c.children); }); }
    _cnt(div.children);
  }
  var aside = subCount ? ('辖 ' + subCount + ' 区') : (div.id ? ('id·' + div.id.slice(0,8)) : '');

  // 完整分区·按主题分组（经济金/民政青/财政朱/灾害琥珀/治理紫）
  var newSectionsHtml = '';
  // — 概况组 —
  newSectionsHtml += '<div class="tm-div-group-header" data-group="overview">概 况</div>';
  newSectionsHtml += _peSectionV2Cls('\u{1F33E}', '经济基础', _peRenderEconomyBase(div), null, 'econ');
  if (div.tags && div.tags.imperialDomain) {
    newSectionsHtml += _peSectionV2Cls('\u{1F3DB}', '皇室直辖资产', _peRenderImperialAssets(div), null, 'imperial');
  }
  newSectionsHtml += _peSectionV2Cls('\u{1F689}', '基础设施', _peRenderInfrastructure(div), null, 'infra');
  newSectionsHtml += _peSectionV2Cls('\u{1F33E}', '田亩流转·诚实账', _peRenderLandFlow(div), '在编册 vs 承载力·分轨', 'land');

  // — 财政组 —
  newSectionsHtml += '<div class="tm-div-group-header" data-group="fiscal">赋 税 与 经 费</div>';
  newSectionsHtml += _peSectionV2Cls('\u{1F4B0}', '应输上解·赋税核算', _peRenderRevenueBreakdown(div), '依 economyBase × policies', 'revenue');
  newSectionsHtml += _peSectionV2Cls('\u{1F4DC}', '应负岁出·经费核算', _peRenderExpenseBreakdown(div), '可归属本区', 'expense');
  if (div.publicTreasury) {
    newSectionsHtml += _peSectionV2Cls('\u{1F4B5}', '公库三账·细目', _peRenderTreasuryFull(div), null, 'treasury');
  }

  // — 民政组 —
  newSectionsHtml += '<div class="tm-div-group-header" data-group="people">民 政 与 承 载</div>';
  var ageHtml = _peRenderAgeDetail(div);
  if (ageHtml) newSectionsHtml += _peSectionV2Cls('\u{1F465}', '户龄结构', ageHtml, null, 'people');
  newSectionsHtml += _peSectionV2Cls('\u{1F33F}', '承载力·完整账', _peRenderCarryingCapacityFull(div), null, 'env');
  // 灾害（仅在有数据或 ecoScars 时出 section）
  var disasterHtml = _peRenderDisasters(div);
  if (disasterHtml) {
    newSectionsHtml += _peSectionV2Cls('⚡', '在灾实录', disasterHtml, null, 'disaster');
  }

  // — 治理组（旧 detailBody 含户口图景/财政/承载力/治理/建筑/驻地官员） —
  newSectionsHtml += '<div class="tm-div-group-header" data-group="govern">治 理 与 人 事</div>';

  // 地方实绩（仅有上回合或本回合数据时出）
  var achieveHtml = _peRenderLocalAchievements(div);
  if (achieveHtml.indexOf('tm-div-empty') === -1) {
    newSectionsHtml += _peSectionV2Cls('\u{1F4C8}', '地方实绩·本回合', achieveHtml, '↑变化 vs 上回合', 'achievement');
  }

  // 子区清单（如有 children）
  var childrenHtml = _peRenderChildrenList(div);
  if (childrenHtml) {
    newSectionsHtml += _peSectionV2Cls('\u{1F5FA}', '辖区·子区', childrenHtml, '点击进入', 'children');
  }

  // 旧 detail 把已被覆盖的段落剔除（公库三账·细目 已新版替代；承载力 已新版替代）
  // 用「锚定在 section-name 标签之后」的精确正则·避免吞掉前面的兄弟 section
  var trimmedDetail = detailBody;
  // 删旧公库三账·anchor 在 <span class="tm-div-section-name">公库三账</span> 处反查回该 section 起点
  function _stripSectionByName(html, sectName) {
    var anchor = '<span class="tm-div-section-name">' + sectName + '</span>';
    var anchorIdx = html.indexOf(anchor);
    if (anchorIdx < 0) return html;
    // 反向找该 section 的起始 <div class="tm-div-section"> tag
    var startMarker = '<div class="tm-div-section">';
    var startIdx = html.lastIndexOf(startMarker, anchorIdx);
    if (startIdx < 0) return html;
    // 正向找该 section 的结束 — 用计数法找匹配的 </div>
    var depth = 0;
    var i = startIdx;
    var endIdx = -1;
    while (i < html.length) {
      var openTag = html.indexOf('<div', i);
      var closeTag = html.indexOf('</div>', i);
      if (closeTag < 0) break;
      if (openTag >= 0 && openTag < closeTag) {
        depth++; i = openTag + 4;
      } else {
        depth--; i = closeTag + 6;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx < 0) return html;
    return html.slice(0, startIdx) + html.slice(endIdx);
  }
  trimmedDetail = _stripSectionByName(trimmedDetail, '公库三账');
  trimmedDetail = _stripSectionByName(trimmedDetail, '承载力');

  // 完整内容
  var fullHtml = '<div class="tm-div-detail" id="tm-div-detail-root">';
  fullHtml += _peRenderHero(div);
  fullHtml += _peRenderQuickStats(div);
  fullHtml += newSectionsHtml;
  fullHtml += trimmedDetail;
  fullHtml += '</div>';

  openGenericModal('卷·' + escHtml(div.name) + (aside ? '（' + aside + '）' : ''), fullHtml);

  // DOM 级修宽度·:has() 不可靠时兜底
  setTimeout(function() {
    var modal = document.querySelector('.generic-modal');
    if (modal && document.getElementById('tm-div-detail-root')) {
      modal.style.maxWidth = '820px';
      modal.style.width = '95%';
    }
  }, 16);
}

/** 升级版 section 容器·带 domain class 用于色域分类 */
function _peSectionV2Cls(icon, title, bodyHtml, aside, domainCls) {
  var cls = 'tm-div-section' + (domainCls ? ' tm-div-section-' + domainCls : '');
  var h = '<div class="' + cls + '">';
  h += '<div class="tm-div-section-title">';
  h += '<span class="tm-div-section-icon">' + icon + '</span>';
  h += '<span class="tm-div-section-name">' + title + '</span>';
  if (aside) h += '<span class="tm-div-section-aside">' + aside + '</span>';
  h += '</div>';
  h += bodyHtml;
  h += '</div>';
  return h;
}

// 暴露到 window·让卡片 onclick 能 call
if (typeof window !== 'undefined') {
  window.openDivisionDetail = openDivisionDetail;
  window._peLijuanPick = _peLijuanPick;
  window._peLijuanClear = _peLijuanClear;
}

/** 构建面板内容HTML（不含modal外壳） */
function _peBuiltContent() {
  if (!GM.provinceStats) initProvinceEconomy();

  var playerFacName = '';
  if (P.playerInfo && P.playerInfo.factionName) {
    playerFacName = P.playerInfo.factionName;
  } else {
    var _pf = GM.facs ? GM.facs.find(function(f) { return f.isPlayer; }) : null;
    if (_pf) playerFacName = _pf.name;
  }

  // 优先读 GM.adminHierarchy（运行时 live 数据，CascadeTax/aggregate 写入处），回退到 P.adminHierarchy
  var _adminSrc = (GM.adminHierarchy && Object.keys(GM.adminHierarchy).length > 0) ? GM.adminHierarchy : P.adminHierarchy;
  var adminTree = null;
  if (_adminSrc) {
    adminTree = _adminSrc.player || null;
    if (!adminTree || !adminTree.divisions || adminTree.divisions.length === 0) {
      var _keys = Object.keys(_adminSrc);
      for (var k = 0; k < _keys.length; k++) {
        var _ah = _adminSrc[_keys[k]];
        if (_ah && _ah.divisions && _ah.divisions.length > 0) {
          var _fac = GM.facs ? GM.facs.find(function(f) { return f.id === _keys[k] || f.name === _keys[k]; }) : null;
          if (_fac && (_fac.isPlayer || _fac.name === playerFacName)) { adminTree = _ah; break; }
        }
      }
    }
  }

  // 总计：优先用 bridge 聚合好的 GM.population.national（保证等于叶子和）；
  // 若 bridge 未跑过，fallback 用 _aggregateDivisionStats 走顶级
  var totalHH = 0, totalMouths = 0, totalDing = 0, totalRemit = 0, totalPubMoney = 0;
  var totalPubGrain = 0, totalPubCloth = 0;
  if (GM.population && GM.population.national) {
    totalHH = GM.population.national.households || 0;
    totalMouths = GM.population.national.mouths || 0;
    totalDing = GM.population.national.ding || 0;
  }
  if (adminTree && adminTree.divisions) {
    adminTree.divisions.forEach(function(n) {
      if (!n) return;
      // 如果 bridge 已把父节点聚合，用顶级 population 之和更保险
      if ((totalMouths === 0) && n.population) {
        if (typeof n.population === 'object') {
          totalHH += n.population.households || 0;
          totalMouths += n.population.mouths || 0;
          totalDing += n.population.ding || 0;
        } else if (typeof n.population === 'number') {
          totalMouths += n.population;
        }
      }
      // 财政 + 公库：顶级 n.fiscal 由 bridge reconcile 写为子和
      if (n.fiscal) totalRemit += n.fiscal.remittedToCenter || 0;
      if (n.publicTreasury) {
        if (n.publicTreasury.money) totalPubMoney += n.publicTreasury.money.stock || 0;
        if (n.publicTreasury.grain) totalPubGrain += n.publicTreasury.grain.stock || 0;
        if (n.publicTreasury.cloth) totalPubCloth += n.publicTreasury.cloth.stock || 0;
      }
    });
  }
  // 最终兜底：若仍为 0 但 _lastCascadeSummary 有数据，用 cascade 结果
  if (totalRemit === 0 && GM._lastCascadeSummary && GM._lastCascadeSummary.central) {
    totalRemit = GM._lastCascadeSummary.central.money || 0;
  }

  var html = '';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.8rem;margin-bottom:1.2rem;">';
  html += '<div style="background:var(--bg-2);padding:0.7rem;border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u603B\u53E3</div>';
  html += '<div style="font-size:1.1rem;color:var(--gold);font-weight:700;">' + formatNumber(totalMouths) + '</div>';
  html += '<div style="font-size:0.66rem;color:var(--txt-d);">' + formatNumber(totalHH) + '\u6237 \u00B7 ' + formatNumber(totalDing) + '\u4E01</div>';
  html += '</div>';
  html += '<div style="background:var(--bg-2);padding:0.7rem;border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u4E0A\u89E3\u5165\u4E2D\u592E</div>';
  var _UU = _peU();
  html += '<div style="font-size:1.1rem;color:var(--gold);font-weight:700;">' + formatNumber(totalRemit) + _UU.money + '</div></div>';
  html += '<div style="background:var(--bg-2);padding:0.7rem;border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u5730\u65B9\u516C\u5E93</div>';
  html += '<div style="font-size:1.1rem;color:var(--gold);font-weight:700;">' + formatNumber(totalPubMoney) + _UU.money + '</div>';
  if (totalPubGrain > 0 || totalPubCloth > 0) html += '<div style="font-size:0.66rem;color:var(--txt-d);">' + formatNumber(totalPubGrain) + _UU.grain + ' \u00B7 ' + formatNumber(totalPubCloth) + _UU.cloth + '</div>';
  html += '</div>';
  html += '<div style="background:var(--bg-2);padding:0.7rem;border-radius:6px;text-align:center;">';
  html += '<div style="font-size:0.72rem;color:var(--txt-d);">\u6240\u8F96\u533A\u5212</div>';
  html += '<div style="font-size:1.1rem;color:var(--gold);font-weight:700;">' + (adminTree && adminTree.divisions ? adminTree.divisions.length : 0) + '</div></div>';
  html += '</div>';

  // 结算状态栏——仅在 CascadeTax 存在时显示
  if (typeof CascadeTax !== 'undefined') {
    var cascadeHasRun = !!GM._lastCascadeSummary;
    var lastCascadeTurn = GM._lastCascadeTurn || 0;

    if (!cascadeHasRun) {
      // 未结算过（罕见——新游戏载入/endTurn 都会自动跑一次；若仍未跑说明 adminHierarchy 未就绪）
      html += '<div style="padding:0.5rem 0.8rem;background:var(--bg-2);border-left:3px solid var(--amber-400);border-radius:4px;margin-bottom:0.8rem;font-size:0.72rem;color:var(--txt-d);">';
      html += '\u203B \u7A0E\u6536\u5C1A\u672A\u7ED3\u7B97\u3002\u6BCF\u56DE\u5408 endTurn \u65F6\u4F1A\u81EA\u52A8\u7ED3\u7B97\uFF0C\u65B0\u6E38\u620F\u8F7D\u5165\u65F6\u4E5F\u4F1A\u5373\u523B\u7ED3\u7B97\u4E00\u6B21\u3002';
      html += '<button class="bt bp bsm" style="margin-left:10px;font-size:0.65rem;" onclick="_peTriggerCascadeNow()" title="立即执行一次税收级联结算">\u7ACB\u5373\u7ED3\u7B97</button>';
      html += '</div>';
    } else {
      // 已结算——显示状态行：上次结算回合 + 本回合累计数 + 手动再结算按钮
      var lcs = GM._lastCascadeSummary || {};
      var lcsC = lcs.central || { money:0, grain:0, cloth:0 };
      var _lossPct = '';
      if (lcs.lostTransit && (lcs.lostTransit.money||0) > 0) {
        var _loss = lcs.lostTransit.money || 0;
        var _total = (lcsC.money||0) + _loss;
        if (_total > 0) _lossPct = ' 路途损耗' + Math.round(_loss/_total*100) + '%';
      }
      var _skimPct = '';
      if (lcs.skimmed && (lcs.skimmed.money||0) > 0) {
        var _skim = lcs.skimmed.money || 0;
        var _t2 = (lcsC.money||0) + _skim + (lcs.lostTransit?lcs.lostTransit.money||0:0);
        if (_t2 > 0) _skimPct = ' 贪墨' + Math.round(_skim/_t2*100) + '%';
      }
      html += '<div style="padding:0.5rem 0.8rem;background:var(--bg-2);border-left:3px solid var(--celadon-400);border-radius:4px;margin-bottom:0.8rem;font-size:0.72rem;color:var(--txt-d);display:flex;align-items:center;gap:0.5rem;">';
      html += '<span style="color:var(--celadon-400);">\u2713</span>';
      html += '<span>\u4E0A\u6B21\u7ED3\u7B97\uFF1AT' + lastCascadeTurn + '\u3002\u4E2D\u592E +' + formatNumber(lcsC.money||0) + _UU.money;
      if ((lcsC.grain||0) > 0) html += ' +' + formatNumber(lcsC.grain) + _UU.grain;
      if (_lossPct) html += '<span style="color:var(--amber-400);">' + _lossPct + '</span>';
      if (_skimPct) html += '<span style="color:var(--vermillion-400);">' + _skimPct + '</span>';
      html += '\u3002\u6BCF\u56DE\u5408 endTurn \u81EA\u52A8\u7ED3\u7B97\u3002</span>';
      html += '<button class="bt bsm" style="margin-left:auto;font-size:0.65rem;" onclick="_peTriggerCascadeNow()" title="手动再结算一次（覆盖本回合）">\u91CD\u65B0\u7ED3\u7B97</button>';
      html += '</div>';
    }
  }

  if (adminTree && adminTree.divisions && adminTree.divisions.length > 0) {
    for (var i = 0; i < adminTree.divisions.length; i++) {
      html += _renderDivisionNode(adminTree.divisions[i], 0);
    }
  } else {
    var playerProvinces = [];
    Object.keys(GM.provinceStats).forEach(function(key) {
      var prov = GM.provinceStats[key];
      if (prov.owner === playerFacName) playerProvinces.push({ key: key, data: prov });
    });
    if (playerProvinces.length === 0 && playerFacName) {
      var _pFac = GM.facs ? GM.facs.find(function(f) { return f.name === playerFacName; }) : null;
      if (_pFac && _pFac.territories) {
        _pFac.territories.forEach(function(t) {
          var prov = GM.provinceStats[t];
          if (prov) playerProvinces.push({ key: t, data: prov });
        });
      }
    }
    if (playerProvinces.length === 0) {
      html += '<div style="text-align:center;padding:2rem;color:var(--txt-s);">\u6682\u65E0\u6240\u8F96\u884C\u653F\u533A\u5212\u6570\u636E</div>';
    } else {
      playerProvinces.forEach(function(item) {
        html += _renderDivisionNode({ name: item.key, children: null }, 0);
      });
    }
  }
  return html;
}

/** 切换展开/折叠——仅更新内容区，不重建modal */
function _peToggle(nodeId) {
  _peExpandState[nodeId] = !_peExpandState[nodeId];
  _peRefreshContent();
}

/** 刷新内容区（保持modal和滚动位置） */
function _peRefreshContent() {
  var container = document.getElementById('pe-content');
  if (!container) return;
  var scrollTop = container.scrollTop;
  container.innerHTML = _peBuiltContent();
  container.scrollTop = scrollTop;
}

/** 立即结算——手动触发一次税收级联 */
function _peTriggerCascadeNow() {
  try {
    if (typeof CascadeTax === 'undefined' || typeof CascadeTax.collect !== 'function') {
      if (typeof toast === 'function') toast('税收级联引擎未加载');
      console.error('[立即结算] CascadeTax 未加载');
      return;
    }
    if (!GM.adminHierarchy || Object.keys(GM.adminHierarchy).length === 0) {
      if (typeof toast === 'function') toast('未配置行政区划·无法结算');
      console.error('[立即结算] GM.adminHierarchy 为空');
      return;
    }
    var result = CascadeTax.collect();
    console.log('[立即结算] CascadeTax.collect 返回:', result);

    // 即使结算成功也可能 totals 全为 0（剧本税率太低/人口不足/region 无 fiscal 字段）
    if (result && result.ok === false) {
      if (typeof toast === 'function') toast('结算失败: ' + (result.reason || '未知'));
      return;
    }

    // 聚合到顶栏变量
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') {
      try { IntegrationBridge.aggregateRegionsToVariables(); } catch(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '立即结算] aggregate 失败') : console.warn('[立即结算] aggregate 失败', e); }
    }

    // 刷新顶栏变量
    if (typeof renderTopBarVars === 'function') {
      try { renderTopBarVars(); } catch(_e){}
    }

    // 反馈
    var turnIn = (GM.guoku && GM.guoku.turnIncome) || 0;
    var gIn = (GM.guoku && GM.guoku.turnGrainIncome) || 0;
    if (typeof toast === 'function') {
      toast('结算完成·中央帑廪 +' + (turnIn >= 10000 ? Math.round(turnIn/10000) + '万两' : turnIn + '两') + (gIn > 0 ? ' +' + (gIn >= 10000 ? Math.round(gIn/10000) + '万石' : gIn + '石') : ''));
    }

    // 重开面板（会刷新显示）
    openProvinceEconomy();
  } catch (e) {
    console.error('[立即结算] 异常:', e);
    if (typeof toast === 'function') toast('结算异常: ' + (e.message || e));
  }
}
if (typeof window !== 'undefined') window._peTriggerCascadeNow = _peTriggerCascadeNow;

/** 打开地方区划面板 */
function openProvinceEconomy() {
  // 关闭已有的
  var old = document.getElementById('pe-overlay');
  if (old) old.remove();

  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'pe-overlay';
  ov.innerHTML = '<div class="generic-modal" style="max-width:800px;">'
    + '<div class="generic-modal-header"><h3>\u5730\u65B9\u533A\u5212</h3>'
    + '<button class="bt bs bsm" onclick="var o=document.getElementById(\'pe-overlay\');if(o)o.remove();">\u2715</button></div>'
    + '<div class="generic-modal-body"><div id="pe-content" style="padding:1rem;max-height:75vh;overflow-y:auto;">'
    + _peBuiltContent()
    + '</div></div></div>';
  document.body.appendChild(ov);
}

/**
 * 格式化数字（添加千位分隔符）— 用于需要精确数字的场景
 */
function formatNumberComma(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ============================================================
// ============================================================
// 侨置系统（P3）
// ============================================================

/**
 * 打开侨置选择面板（领土丢失后调用）
 * lostName: 丢失的行政区名称
 */
function openQiaozhiPanel(lostName) {
  if (!GM._lostTerritories || !GM._lostTerritories[lostName]) {
    toast('\u627E\u4E0D\u5230\u4E22\u5931\u9886\u571F\u8BB0\u5F55');
    return;
  }

  var lostData = GM._lostTerritories[lostName];
  var lostNode = lostData.node;

  // 获取可作为宿主的现有行政区
  var _ahKey = P.adminHierarchy ? (P.adminHierarchy.player ? 'player' : Object.keys(P.adminHierarchy)[0]) : null;
  var _ahData = _ahKey ? P.adminHierarchy[_ahKey] : null;
  var hostOptions = [];
  if (_ahData && _ahData.divisions) {
    _ahData.divisions.forEach(function(d) {
      if (d.name !== '\u672A\u5B9A\u884C\u653F\u533A') {
        hostOptions.push(d.name);
      }
    });
  }

  var html = '<div style="padding:1rem;">';
  html += '<div style="margin-bottom:1rem;color:var(--txt-l);font-size:0.9rem;">\u300C' + lostName + '\u300D\u5DF2\u5931\u9677\uFF0C\u662F\u5426\u4FA8\u7F6E\uFF1F</div>';
  html += '<div style="margin-bottom:1rem;font-size:0.82rem;color:var(--txt-d);">\u539F\u4EBA\u53E3\uFF1A' + formatNumber(lostNode.population || 0)
    + ' | \u539F\u7E41\u8363\uFF1A' + (lostNode.prosperity || 0)
    + ' | \u5931\u4E8E\uFF1A' + (lostData.lostTo || '\u654C\u65B9')
    + ' | \u7B2C' + lostData.turn + '\u56DE\u5408</div>';

  // 选项1：不侨置（直接撤销）
  html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:6px;margin-bottom:0.8rem;cursor:pointer;border:1px solid transparent;" '
    + 'onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'transparent\'" '
    + 'onclick="doQiaozhi(\'' + lostName.replace(/'/g, '') + '\',\'none\')">';
  html += '<div style="font-weight:700;margin-bottom:0.3rem;">\u4E0D\u4FA8\u7F6E\uFF0C\u76F4\u63A5\u64A4\u9500</div>';
  html += '<div style="font-size:0.78rem;color:var(--txt-d);">\u653E\u5F03\u8BE5\u884C\u653F\u533A\u5212\u7684\u540D\u4E49\u548C\u5B98\u5236\u3002</div>';
  html += '</div>';

  // 选项2：纯名义侨置
  html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:6px;margin-bottom:0.8rem;cursor:pointer;border:1px solid transparent;" '
    + 'onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'transparent\'" '
    + 'onclick="doQiaozhi(\'' + lostName.replace(/'/g, '') + '\',\'nominal\')">';
  html += '<div style="font-weight:700;margin-bottom:0.3rem;">\u7EAF\u540D\u4E49\u4FA8\u7F6E</div>';
  html += '<div style="font-size:0.78rem;color:var(--txt-d);">\u4FDD\u7559\u5B98\u5236\u548C\u5B98\u804C\uFF08\u5982\u4FA8\u7F6E' + lostName + '\u523A\u53F2\uFF09\uFF0C\u4F46\u65E0\u5B9E\u9645\u7ECF\u6D4E\u6570\u636E\u548C\u7BA1\u8F96\u3002\u5F85\u6536\u590D\u540E\u53EF\u6062\u590D\u3002</div>';
  html += '</div>';

  // 选项3：划出治所侨置
  if (hostOptions.length > 0) {
    html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:6px;margin-bottom:0.8rem;">';
    html += '<div style="font-weight:700;margin-bottom:0.3rem;">\u5212\u51FA\u6CBB\u6240\u4FA8\u7F6E</div>';
    html += '<div style="font-size:0.78rem;color:var(--txt-d);margin-bottom:0.5rem;">\u4ECE\u73B0\u6709\u884C\u653F\u533A\u5212\u51FA\u4E00\u90E8\u5206\u7586\u57DF\u7ED9\u4FA8\u7F6E\u7684' + lostName + '\uFF0C\u7B49\u540C\u6B63\u5E38\u884C\u653F\u533A\u3002\u5BBF\u4E3B\u7ECF\u6D4E/\u4EBA\u53E3\u6570\u636E\u4F1A\u51CF\u5C11\u3002</div>';
    html += '<div style="display:flex;align-items:center;gap:0.5rem;">';
    html += '<span style="font-size:0.82rem;">\u5BBF\u4E3B\uFF1A</span>';
    html += '<select id="qiaozhi-host" style="flex:1;padding:4px;background:var(--bg-3);border:1px solid var(--bg-4);color:var(--txt-l);border-radius:4px;">';
    hostOptions.forEach(function(h) {
      html += '<option value="' + h + '">' + h + '</option>';
    });
    html += '</select>';
    html += '<button class="bt bsm" onclick="doQiaozhi(\'' + lostName.replace(/'/g, '') + '\',\'allocated\')">\u786E\u5B9A</button>';
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';

  openGenericModal('\u4FA8\u7F6E\u51B3\u7B56 \u2014 ' + lostName, html, null);
}

/**
 * 执行侨置操作
 * mode: 'none' | 'nominal' | 'allocated'
 */
function doQiaozhi(lostName, mode) {
  if (!GM._lostTerritories || !GM._lostTerritories[lostName]) { closeGenericModal(); return; }

  var lostData = GM._lostTerritories[lostName];
  var lostNode = lostData.node;

  var _ahKey = P.adminHierarchy ? (P.adminHierarchy.player ? 'player' : Object.keys(P.adminHierarchy)[0]) : null;
  var _ahData = _ahKey ? P.adminHierarchy[_ahKey] : null;

  if (mode === 'none') {
    // 不侨置，彻底撤销
    delete GM._lostTerritories[lostName];
    addEB('\u884C\u653F', '\u64A4\u9500' + lostName + '\u884C\u653F\u533A\u5212\uFF0C\u4E0D\u4FA8\u7F6E');

  } else if (mode === 'nominal') {
    // 纯名义侨置：保留节点在树中但标记为侨置
    if (_ahData) {
      var nominalNode = {
        id: 'div_qz_' + Date.now(),
        name: '\u4FA8\u7F6E' + lostName,
        level: lostNode.level || '',
        officialPosition: lostNode.officialPosition || '',
        governor: lostNode.governor || '',
        description: '\u4FA8\u7F6E\uFF08\u7EAF\u540D\u4E49\uFF09\uFF0C\u539F' + lostName + '\u5931\u9677\u4E8E' + (lostData.lostTo || '\u654C\u65B9'),
        population: 0, prosperity: 0,
        terrain: '', specialResources: '', taxLevel: '\u65E0',
        _isQiaozhi: true, _qiaozhiType: 'nominal',
        _originalName: lostName, _lostTo: lostData.lostTo || '',
        children: []
      };
      _ahData.divisions.push(nominalNode);
    }
    addEB('\u884C\u653F', lostName + '\u7EAF\u540D\u4E49\u4FA8\u7F6E\uFF0C\u4FDD\u7559\u5B98\u5236');

  } else if (mode === 'allocated') {
    // 划出治所侨置
    var hostName = '';
    var hostEl = document.getElementById('qiaozhi-host');
    if (hostEl) hostName = hostEl.value;
    if (!hostName || !_ahData) { toast('\u8BF7\u9009\u62E9\u5BBF\u4E3B'); return; }

    // 从宿主划出20%人口和经济
    var hostFound = null;
    (function _find(divs) {
      for (var i = 0; i < divs.length; i++) {
        if (divs[i].name === hostName) { hostFound = divs[i]; return; }
        if (divs[i].children) _find(divs[i].children);
      }
    })(_ahData.divisions);

    if (!hostFound) { toast('\u5BBF\u4E3B\u4E0D\u5B58\u5728'); return; }

    var transferPop = Math.floor((hostFound.population || 0) * 0.2);
    var transferPros = Math.floor((hostFound.prosperity || 0) * 0.15);
    hostFound.population = Math.max(0, (hostFound.population || 0) - transferPop);
    hostFound.prosperity = Math.max(10, (hostFound.prosperity || 50) - transferPros);

    var qzNode = {
      id: 'div_qz_' + Date.now(),
      name: '\u4FA8\u7F6E' + lostName,
      level: lostNode.level || '',
      officialPosition: lostNode.officialPosition || '',
      governor: lostNode.governor || '',
      description: '\u4FA8\u7F6E\u4E8E' + hostName + '\uFF0C\u539F' + lostName + '\u5931\u9677\u4E8E' + (lostData.lostTo || '\u654C\u65B9'),
      population: transferPop,
      prosperity: transferPros > 0 ? transferPros : 30,
      terrain: hostFound.terrain || '',
      specialResources: '', taxLevel: '\u4E2D',
      _isQiaozhi: true, _qiaozhiType: 'allocated',
      _originalName: lostName, _hostName: hostName, _lostTo: lostData.lostTo || '',
      children: []
    };

    // 添加为宿主的子节点
    if (!hostFound.children) hostFound.children = [];
    hostFound.children.push(qzNode);

    // 同步provinceStats
    if (!GM.provinceStats) GM.provinceStats = {};
    var _pfn = (P.playerInfo && P.playerInfo.factionName) || '';
    GM.provinceStats[qzNode.name] = {
      name: qzNode.name, owner: _pfn,
      population: transferPop, wealth: qzNode.prosperity,
      stability: 45, development: 30,
      taxRevenue: 0, militaryRecruits: 0,
      unrest: 20, corruption: 20,
      terrain: qzNode.terrain, specialResources: '',
      governor: qzNode.governor, taxLevel: '\u4E2D'
    };
    // 更新宿主provinceStats
    if (GM.provinceStats[hostName]) {
      GM.provinceStats[hostName].population = Math.max(0, (GM.provinceStats[hostName].population || 0) - transferPop);
    }

    addEB('\u884C\u653F', lostName + '\u4FA8\u7F6E\u4E8E' + hostName + '\uFF0C\u5212\u51FA\u4EBA\u53E3' + formatNumber(transferPop));

    // 宿主主官可能不满
    if (hostFound.governor) {
      var _govCh = findCharByName(hostFound.governor);
      if (_govCh) {
        _govCh.loyalty = Math.max(0, (_govCh.loyalty || 50) - 5);
        _govCh.stress = Math.min(100, (_govCh.stress || 0) + 8);
        addEB('\u4EBA\u7269', hostFound.governor + '\u5BF9\u4FA8\u7F6E' + lostName + '\u4E8E\u5176\u8F96\u533A\u8868\u793A\u4E0D\u6EE1');
      }
    }
  }

  delete GM._lostTerritories[lostName];
  closeGenericModal();
  // 刷新省级经济面板（如果当前打开的话）
  var _peOverlay = document.querySelector('.generic-modal-overlay');
  if (_peOverlay) { try { _peRefreshContent(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn-province');}catch(_){}} }
  toast('\u4FA8\u7F6E\u64CD\u4F5C\u5B8C\u6210');
}

/**
 * 收复领土——将侨置行政区转回原建制
 * qiaozhiName: 侨置节点名称（如"侨置豫州"）
 * recoveredDivisionName: 收复后的行政区名称（如"豫州"）
 */
function restoreQiaozhiDivision(qiaozhiName, recoveredDivisionName) {
  var _ahKey = P.adminHierarchy ? (P.adminHierarchy.player ? 'player' : Object.keys(P.adminHierarchy)[0]) : null;
  var _ahData = _ahKey ? P.adminHierarchy[_ahKey] : null;
  if (!_ahData) return;

  // 查找侨置节点
  function _findAndRemove(divs, parent) {
    for (var i = 0; i < divs.length; i++) {
      if (divs[i].name === qiaozhiName && divs[i]._isQiaozhi) {
        var node = divs[i];
        divs.splice(i, 1);
        return node;
      }
      if (divs[i].children) {
        var found = _findAndRemove(divs[i].children, divs[i]);
        if (found) return found;
      }
    }
    return null;
  }

  var qzNode = _findAndRemove(_ahData.divisions, null);
  if (!qzNode) { toast('\u627E\u4E0D\u5230\u4FA8\u7F6E\u8282\u70B9'); return; }

  // 如果是划出治所侨置，归还数据给宿主
  if (qzNode._qiaozhiType === 'allocated' && qzNode._hostName) {
    var hostFound = null;
    (function _find(divs) {
      for (var i = 0; i < divs.length; i++) {
        if (divs[i].name === qzNode._hostName) { hostFound = divs[i]; return; }
        if (divs[i].children) _find(divs[i].children);
      }
    })(_ahData.divisions);

    if (hostFound) {
      hostFound.population = (hostFound.population || 0) + (qzNode.population || 0);
      if (GM.provinceStats && GM.provinceStats[qzNode._hostName]) {
        GM.provinceStats[qzNode._hostName].population += qzNode.population || 0;
      }
    }

    // 移除侨置节点的provinceStats
    if (GM.provinceStats && GM.provinceStats[qiaozhiName]) {
      delete GM.provinceStats[qiaozhiName];
    }
  }

  addEB('\u884C\u653F', qiaozhiName + '\u64A4\u9500\u4FA8\u7F6E\uFF0C' + (recoveredDivisionName || qzNode._originalName) + '\u6062\u590D\u539F\u5EFA\u5236');
  toast('\u4FA8\u7F6E\u5DF2\u64A4\u9500\uFF0C\u539F\u5EFA\u5236\u6062\u590D');
}

// ============================================================
// AI 深度预热（新游戏首次启动时完整阅读全部剧本——大规模8轮调用版）
// ============================================================

/**
 * 新游戏AI深度预热 — 让AI逐章完整阅读全部剧本内容（不截断任何字段）
 * 分8次调用，每次专注一个领域，最后综合生成高质量摘要
 * 消耗约8000-15000 tokens，换取整局游戏叙事质量大幅提升
 */
