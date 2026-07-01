// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-economy.js — 经济 & 继承 (R122 从 tm-economy-military.js L1-722 拆出)
// 姊妹: tm-military.js (原 L723-end·军事+封建+头衔+补给+铨选+战争+建筑)
// 原文件注释：
// 经济/军事/封建/头衔/补给/铨选系统
// Requires: tm-data-model.js (P, GM), tm-utils.js (_dbg, clamp, uid, random),
//           tm-index-world.js (findCharByName, findFacByName, addToIndex)
// ============================================================
/** @param {number} centralControl - 集权度(0-1) @param {string} territoryType - "military"|"civil" @returns {number} 贡奉比例(0-1) */
function getTributeRatio(centralControl, territoryType) {
  // centralControl: 0-1 的集权度
  // territoryType: 'military' (军镇/藩镇) 或 'civil' (州县)

  // 将 0-1 的集权度映射到 1-4 的等级
  var level = 1;
  if (centralControl >= 0.75) level = 4;
  else if (centralControl >= 0.5) level = 3;
  else if (centralControl >= 0.25) level = 2;
  else level = 1;

  var ratios = {
    military: [0.1, 0.2, 0.35, 0.5],    // 军镇贡奉比例低
    civil: [0.4, 0.6, 0.8, 0.95]        // 州县贡奉比例高
  };

  return ratios[territoryType] ? ratios[territoryType][level - 1] : 0.5;
}

/** @param {Object} region @param {Object} [eraState] @returns {number} 月收入 */
function calculateMonthlyIncome(region, eraState) {
  if (!region) return 0;

  // 从配置读取基础收入，默认 100
  var baseIncome = (P.economyConfig && P.economyConfig.baseIncome) ? P.economyConfig.baseIncome : 100;

  // 人口影响
  if (region.population) {
    baseIncome += region.population / 1000;
  }

  // 经济繁荣度影响
  if (eraState && eraState.economicProsperity !== undefined) {
    baseIncome *= (0.5 + eraState.economicProsperity * 0.5); // 0.5x - 1.0x
  }

  // 社会稳定度影响
  if (eraState && eraState.socialStability !== undefined) {
    baseIncome *= (0.7 + eraState.socialStability * 0.3); // 0.7x - 1.0x
  }

  // B1: 激活经济配置乘数
  if (P.economyConfig) {
    var ec = P.economyConfig;
    // 农业系数（影响70%的基础产出——农业在古代经济中占主导）
    if (ec.agricultureMultiplier && ec.agricultureMultiplier !== 1) {
      baseIncome *= (0.3 + ec.agricultureMultiplier * 0.7); // 30%固定+70%受农业影响
    }
    // 商业系数（影响贸易收入部分）
    if (ec.commerceMultiplier && ec.commerceMultiplier !== 1) {
      baseIncome *= (0.7 + ec.commerceMultiplier * 0.3); // 商业只影响30%的收入
    }
    // 贸易加成
    if (ec.tradeBonus && ec.tradeBonus > 0) {
      baseIncome *= (1 + ec.tradeBonus);
    }
    // 通胀侵蚀（每回合实际购买力下降）
    if (ec.inflationRate && ec.inflationRate > 0.03) {
      baseIncome *= (1 - ec.inflationRate * 0.5); // 通胀减少实际收入
    }
  }

  // 阶层满意度影响
  if (GM.classes && GM.classes.length > 0) {
    var classMod = 1.0;
    GM.classes.forEach(function(cls) {
      var sat = parseInt(cls.satisfaction) || 50;
      var inf = parseInt(cls.influence || cls.classInfluence) || 50;
      if (sat < 30 && inf > 20) {
        classMod -= (30 - sat) / 300 * (inf / 100);
      }
    });
    baseIncome *= Math.max(0.7, classMod);
  }

  return Math.floor(baseIncome);
}

// 更新经济系统（在 endTurn 中调用）
function updateEconomy(timeRatio) {
  if (!GM.eraState) return;

  var es = GM.eraState;
  var centralControl = es.centralControl || 0.5;

  // 1. 计算各地区的收入和贡奉
  var totalTribute = 0;
  var tributeByRegion = {}; // 记录各地区贡奉

  // 如果有地图系统
  if (P.map && P.map.regions && P.map.regions.length > 0) {
    P.map.regions.forEach(function(region) {
      if (!region || !region.name) return;

      // 计算月度收入
      var income = calculateMonthlyIncome(region, es);

      // 判断领地类型（简化：根据控制者判断）
      var territoryType = 'civil';
      if (region.controller && region.controller.indexOf('节度使') >= 0) {
        territoryType = 'military';
      }

      // 计算贡奉（含M5层级贡赋乘数）
      var tributeRatio = getTributeRatio(centralControl, territoryType);
      // 层级乘数：根据区域对应的行政层级调整贡赋
      if (typeof getTierRule === 'function' && region.adminLevel) {
        var _tierRule = getTierRule(region.adminLevel);
        tributeRatio *= (_tierRule.tributeMultiplier || 1.0);
      }
      var tribute = Math.floor(income * tributeRatio);

      totalTribute += tribute;
      tributeByRegion[region.name] = {
        income: income,
        tribute: tribute,
        ratio: tributeRatio,
        type: territoryType
      };

      // 记录变化
      if (tribute > 0) {
        recordChange('economy', region.name, 'tribute', 0, tribute, '向中央贡奉');
      }
    });
  }

  // 1b. 无地图模式：从 GM.provinceStats 计算贡奉（地方区划已由 updateProvinceEconomy 维护）
  if (totalTribute === 0 && GM.provinceStats && Object.keys(GM.provinceStats).length > 0) {
    Object.keys(GM.provinceStats).forEach(function(provName) {
      var prov = GM.provinceStats[provName];
      if (!prov) return;
      var income = prov.taxRevenue || 0;
      var tributeRatio = (es.centralControl || 0.5) * 0.8; // 简化：集权度×0.8
      var tribute = Math.floor(income * tributeRatio);
      totalTribute += tribute;
      tributeByRegion[provName] = { income: income, tribute: tribute, ratio: tributeRatio, type: 'civil' };
      if (tribute > 0) recordChange('economy', provName, 'tribute', 0, tribute, '省份贡奉');
    });
  }

  // 2. 中央收到贡奉后，按比例回拨
  // 从配置读取回拨比例，默认 0.3
  var redistributionRate = (P.economyConfig && P.economyConfig.redistributionRate !== undefined)
    ? P.economyConfig.redistributionRate
    : 0.3;
  var redistributed = Math.floor(totalTribute * redistributionRate);

  // 3. 按贡献占比分配回拨
  if (totalTribute > 0 && redistributed > 0) {
    Object.keys(tributeByRegion).forEach(function(regionName) {
      var regionData = tributeByRegion[regionName];
      var share = regionData.tribute / totalTribute;
      var allocation = Math.floor(redistributed * share);

      if (allocation > 0) {
        recordChange('economy', regionName, 'allocation', 0, allocation, '中央回拨');
      }
    });
  }

  // 4. 更新中央财政——双层国库（国库/内库分离）
  var netRevenue = totalTribute - redistributed;
  var ecCfg = P.economyConfig || {};
  var dualTreasury = ecCfg.dualTreasury === true;
  var privateRatio = ecCfg.privateIncomeRatio || 0.15;

  if (dualTreasury) {
    // ═══ 双层国库模式 ═══
    var stateIncome = Math.floor(netRevenue * (1 - privateRatio));
    var privateIncome = netRevenue - stateIncome;

    var oldState = GM.stateTreasury || 0;
    var oldPrivate = GM.privateTreasury || 0;
    GM.stateTreasury = oldState + stateIncome;
    GM.privateTreasury = oldPrivate + privateIncome;

    if (netRevenue !== 0) {
      recordChange('resources', '国库', 'value', oldState, GM.stateTreasury,
        '贡奉' + totalTribute + '·回拨' + redistributed + '·入国库' + stateIncome);
      recordChange('resources', '内库', 'value', oldPrivate, GM.privateTreasury,
        '入内库' + privateIncome);
    }

    // 破产检测
    var bankruptThreshold = ecCfg.bankruptcyThreshold || -5000;
    if (GM.stateTreasury < bankruptThreshold) {
      if (!GM._bankruptcyTurns) GM._bankruptcyTurns = 0;
      GM._bankruptcyTurns++;
      addEB('财政', '国库告罄（' + GM.stateTreasury + '），财政危机第' + GM._bankruptcyTurns + '回合');
      // 连续3回合破产→触发严重后果
      if (GM._bankruptcyTurns >= 3) {
        addEB('财政', '连续三回合国库空虚，引发兵变/辞官潮！');
        // 军队士气下降
        (GM.armies || []).forEach(function(a) {
          if (a.soldiers > 0) a.morale = Math.max(0, (a.morale || 70) - 15);
        });
      }
    } else {
      GM._bankruptcyTurns = 0;
    }

    // 同步到传统fiscal变量（向后兼容——旧的经济变量仍可用）
    var _fiscalKey = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
    if (GM.vars && _fiscalKey && GM.vars[_fiscalKey]) {
      GM.vars[_fiscalKey].value = clamp(GM.stateTreasury, GM.vars[_fiscalKey].min || 0, GM.vars[_fiscalKey].max || 100000);
    }

  } else {
    // ═══ 单层国库模式（向后兼容旧剧本）═══
    var _fiscalKey = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
    if (GM.vars && _fiscalKey && GM.vars[_fiscalKey]) {
      var oldValue = GM.vars[_fiscalKey].value;
      GM.vars[_fiscalKey].value = clamp(oldValue + netRevenue, GM.vars[_fiscalKey].min || 0, GM.vars[_fiscalKey].max || 100000);
      if (netRevenue !== 0) {
        recordChange('resources', _fiscalKey, 'value', oldValue, GM.vars[_fiscalKey].value,
          '\u8D21\u5949\u6536\u5165' + totalTribute + '\uFF0C\u56DE\u62E8' + redistributed);
      }
    }
  }

  // 5. 集权度动态调整
  // 如果贡奉比例高且稳定，集权度上升
  var avgTributeRatio = 0;
  var count = 0;
  Object.values(tributeByRegion).forEach(function(data) {
    avgTributeRatio += data.ratio;
    count++;
  });
  if (count > 0) {
    avgTributeRatio /= count;

    var _ms2 = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    // 高贡奉比例 → 集权度上升
    if (avgTributeRatio > 0.7 && es.socialStability > 0.6) {
      es.centralControl = Math.min(1.0, es.centralControl + 0.01 * _ms2);
    }
    // 低贡奉比例 → 集权度下降
    else if (avgTributeRatio < 0.3) {
      es.centralControl = Math.max(0.0, es.centralControl - 0.01 * _ms2);
    }
  }

  // 6. 经济繁荣度动态调整
  var _fiscalKey2 = typeof _findVarByType === 'function' ? _findVarByType('economy') : null;
  if (GM.vars && _fiscalKey2 && GM.vars[_fiscalKey2]) {
    var _ms3 = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    var fiscalHealth = GM.vars[_fiscalKey2].value / (GM.vars[_fiscalKey2].max || 10000);
    if (fiscalHealth > 0.7) {
      es.economicProsperity = Math.min(1.0, es.economicProsperity + 0.02 * _ms3);
    } else if (fiscalHealth < 0.3) {
      es.economicProsperity = Math.max(0.1, es.economicProsperity - 0.02 * _ms3);
    }
  }
}

// 重新计算经济系统（监听器触发）
function recalculateEconomy() {
  if (!GM.running) return;
  var timeRatio = getTimeRatio();
  updateEconomy(timeRatio);
}

// 重新计算权力结构（监听器触发）
function recalculatePowerStructure() {
  if (!GM.running) return;
  // 统计各官职的权力分布
  var powerDistribution = {};
  if (GM.chars && GM.chars.length > 0) {
    GM.chars.forEach(function(char) {
      if (char.position) {
        if (!powerDistribution[char.position]) {
          powerDistribution[char.position] = 0;
        }
        powerDistribution[char.position]++;
      }
    });
  }
  // 可以在这里添加更多权力结构分析逻辑
}

// 朝代阶段转换通知（监听器触发，通知AI而非硬编码事件）
function triggerDynastyPhaseEvent(phase) {
  if (!GM.running) return;
  // 仅通知AI朝代阶段发生转换，由AI决定具体叙事
  var phaseNames = {
    founding: '开创期', expansion: '扩张期', peak: '鼎盛期',
    decline: '衰落期', collapse: '崩溃期'
  };
  var phaseName = phaseNames[phase] || phase;
  addEB('朝代', '朝代进入' + phaseName + '阶段');
}

// 更新势力状态（仅做数据维护，实力变化由AI推演驱动）
function updateFactions(timeRatio) {
  if (!GM.facs || !Array.isArray(GM.facs)) return;
  // 势力实力变化由AI通过faction_changes字段驱动，此处不再随机波动
  // 仅做数据一致性维护（如clamp）
  GM.facs.forEach(function(fac) {
    if (!fac || !fac.name) return;
    if (fac.strength != null) {
      fac.strength = Math.max(0, Math.min(100, fac.strength));
    }
  });
}

// 更新党派状态（影响力变化由AI推演驱动，此处仅维护状态标签）
function updateParties(timeRatio) {
  if (!GM.parties || !Array.isArray(GM.parties)) return;

  GM.parties.forEach(function(party) {
    if (!party || !party.name) return;

    // 影响力变化由AI通过party_changes字段驱动，不再随机波动
    if (typeof party.influence === 'number') {
      party.influence = Math.max(0, Math.min(100, party.influence));
    }

    // 状态标签根据当前影响力自动维护
    if (party.status && party.influence !== undefined) {
      var oldStatus = party.status;
      var newStatus = oldStatus;

      if (party.influence > 60 && oldStatus !== '活跃') {
        newStatus = '活跃';
      } else if (party.influence < 30 && party.influence > 10 && oldStatus !== '式微') {
        newStatus = '式微';
      } else if (party.influence <= 10 && oldStatus !== '被压制') {
        newStatus = '被压制';
      }

      if (newStatus !== oldStatus) {
        party.status = newStatus;
        recordChange('parties', party.name, 'status', oldStatus, newStatus, '影响力变化');
      }
    }
  });
}

// 更新阶层状态（人口变化由AI推演驱动，此处仅做数据维护）
function updateClasses(timeRatio) {
  if (!GM.classes || !Array.isArray(GM.classes)) return;
  // 阶层人口/影响力变化由AI叙事驱动，不再随机波动
}

// 更新人物状态
function updateCharacters(timeRatio) {
  if (!GM.chars || !Array.isArray(GM.chars)) return;

  var sc = findScenarioById(GM.sid);
  var perTurn = P.time.perTurn || "1m";
  var deadCharacters = []; // 记录本回合死亡的角色

  GM.chars.forEach(function(chr) {
    if (!chr || !chr.name) return;

    // 年龄增长：累计天数跨365天时+1岁
    if (chr.age !== undefined) {
      var oldAge = chr.age;
      var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
      var prevTotalDays = (GM.turn - 1) * _dpv;
      var curTotalDays = GM.turn * _dpv;
      var ageInc = Math.floor(curTotalDays / 365) - Math.floor(prevTotalDays / 365);

      if (ageInc > 0) {
        chr.age = (typeof chr.age === 'number' ? chr.age : parseInt(chr.age) || 0) + ageInc;
        recordChange('characters', chr.name, 'age', oldAge, chr.age, '时间流逝');

        // 死亡风险由NaturalDeathSystem计算并报告给AI，由AI通过character_deaths决定
        // 此处不再自动执行死亡，仅做年龄记录
      }
    }

    // 属性变化由AI通过char_updates字段驱动，不再随机波动
    // 仅做数据一致性维护（clamp到合法范围）
    if (chr.alive !== false) {
      ['loyalty', 'ambition', 'benevolence'].forEach(function(attr) {
        if (chr[attr] !== undefined && typeof chr[attr] === 'number') {
          chr[attr] = Math.max(0, Math.min(100, chr[attr]));
        }
      });
    }
  });

  // 处理死亡角色的继承
  if (deadCharacters.length > 0) {
    deadCharacters.forEach(function(deadChar) {
      handleInheritance(deadChar);
    });
  }
}

// ============================================================
// 继承系统
// ============================================================

// 计算继承候选人的综合得分
function calculateInheritanceScore(candidate, eraState, deadChar) {
  if (!candidate || !eraState) return 0;

  var legitimacy = candidate.legitimacy || 0.5;
  var ability = candidate.ability || 0.5;
  var supportCount = (candidate.support || []).length;
  var oppositionCount = (candidate.opposition || []).length;

  // 根据时代状态调整权重
  var centralControl = eraState.centralControl || 0.5;
  var legitimacySource = eraState.legitimacySource || '血统';
  var dynastyPhase = eraState.dynastyPhase || '盛期';

  var legitimacyWeight = 0.4;
  var abilityWeight = 0.3;
  var supportWeight = 0.3;

  // 根据集权度调整权重
  if (centralControl < 0.3) {
    // 低集权：血统和地方支持更重要
    legitimacyWeight = 0.5;
    abilityWeight = 0.2;
    supportWeight = 0.3;
  } else if (centralControl > 0.7) {
    // 高集权：能力和制度更重要
    legitimacyWeight = 0.3;
    abilityWeight = 0.5;
    supportWeight = 0.2;
  }

  // 根据正统性来源调整权重
  if (legitimacySource === '血统') {
    legitimacyWeight += 0.1;
    abilityWeight -= 0.1;
  } else if (legitimacySource === '功绩') {
    abilityWeight += 0.1;
    legitimacyWeight -= 0.1;
  } else if (legitimacySource === '选举') {
    supportWeight += 0.1;
    legitimacyWeight -= 0.1;
  }

  // 根据王朝阶段调整
  if (dynastyPhase === '初创期') {
    abilityWeight += 0.1;
    legitimacyWeight -= 0.1;
  } else if (dynastyPhase === '末期') {
    supportWeight += 0.1;
    legitimacyWeight -= 0.1;
  }

  // 计算支持度得分（0-1）
  var supportScore = Math.min(1, supportCount / 5) - Math.min(0.5, oppositionCount / 5);
  supportScore = Math.max(0, Math.min(1, supportScore));

  // 综合得分
  var totalScore = legitimacy * legitimacyWeight + ability * abilityWeight + supportScore * supportWeight;

  return totalScore;
}

async function handleInheritance(deadChar) {
  if (!deadChar || !deadChar.name) return;

  // 查找死者的官职
  var deadCharOffices = [];
  if (GM.officeTree && GM.officeTree.length > 0) {
    function findOffices(nodes) {
      nodes.forEach(function(node) {
        if (node.positions) {
          node.positions.forEach(function(pos) {
            if (pos.holder === deadChar.name) {
              deadCharOffices.push({
                deptName: node.name,
                posName: pos.name,
                rank: pos.rank || '',
                node: node,
                position: pos
              });
            }
          });
        }
        if (node.subs && node.subs.length > 0) {
          findOffices(node.subs);
        }
      });
    }
    findOffices(GM.officeTree);
  }

  // 如果死者没有官职，只记录死亡事件
  if (deadCharOffices.length === 0) {
    addEB('\u4EBA\u7269', deadChar.name + '\u53BB\u4E16\uFF0C\u4EAB\u5E74' + (deadChar.age || '?') + '\u5C81\u3002');
    return;
  }

  // 优先使用指定继承人（跳过 AI 调用）
  if (typeof resolveHeir === 'function') {
    var quickHeir = resolveHeir(deadChar);
    if (quickHeir && deadChar.designatedHeirId) {
      // 有明确指定继承人，直接继承，不浪费 AI token
      deadCharOffices.forEach(function(o) {
        o.position.holder = quickHeir.name;
      });
      addEB('\u7EE7\u627F', deadChar.name + '\u53BB\u4E16\uFF0C' + quickHeir.name + '\u7EE7\u4EFB\u5176\u804C\u3002');
      if (typeof recordCharacterArc === 'function') recordCharacterArc(quickHeir.name, 'inheritance', '\u7EE7\u627F' + deadChar.name + '\u7684\u5730\u4F4D');
      return;
    }
  }

  // 无指定继承人时，使用 AI 生成继承候选人和推演后果
  if (P.ai.key) {
    try {
      var officeList = deadCharOffices.map(function(o) {
        return o.deptName + ' ' + o.posName + '(' + o.rank + ')';
      }).join('\u3001');

      var eraContext = '';
      if (GM.eraState && GM.eraState.contextDescription) {
        eraContext = '时代背景：' + GM.eraState.contextDescription + '\n' +
          '政治统一度：' + (GM.eraState.politicalUnity || 0.5) + '（0=分裂，1=统一）\n' +
          '中央集权度：' + (GM.eraState.centralControl || 0.5) + '（0=地方割据，1=高度集权）\n' +
          '社会稳定度：' + (GM.eraState.socialStability || 0.5) + '（0=动荡，1=稳定）\n' +
          '官僚体系强度：' + (GM.eraState.bureaucracyStrength || 0.5) + '（0=人治，1=制度化）\n' +
          '正统性来源：' + (GM.eraState.legitimacySource || '血统') + '\n' +
          '王朝阶段：' + (GM.eraState.dynastyPhase || '盛期') + '\n';
      }

      var prompt = deadChar.name + '去世，任' + officeList + '。\n' +
        eraContext +
        '死者信息：年龄' + (deadChar.age || '?') + '岁，忠诚度' + (deadChar.loyalty || 50) + '，派系' + (deadChar.faction || '无') + '\n' +
        '其他人物：' + JSON.stringify(GM.chars.filter(function(c) {
          return c.alive !== false && c.name !== deadChar.name;
        }).map(function(c) {
          return {name: c.name, title: c.title, age: c.age, loyalty: c.loyalty, faction: c.faction};
        })) + '\n\n' +
        '请根据时代背景推演继承情况和后果。返回 JSON：\n' +
        '{\n' +
        '  "candidates": [\n' +
        '    {"name": "候选人姓名", "relation": "与死者关系", "legitimacy": 0.9, "ability": 0.7, "support": ["支持者"], "opposition": ["反对者"], "note": "简要评价"}\n' +
        '  ],\n' +
        '  "recommendation": "候选人姓名",\n' +
        '  "reasoning": "推荐理由50-100字",\n' +
        '  "consequence": "继承后果描述100-200字，包括各方反应"\n' +
        '}\n\n' +
        '注意：\n' +
        '1. 根据时代背景推断：\n' +
        '   - 低集权时期（<0.3）：多世袭，子女优先，地方势力支持重要\n' +
        '   - 中集权时期（0.3-0.7）：混合制，能力和血统并重\n' +
        '   - 高集权时期（>0.7）：多流官，朝廷任命，能力优先\n' +
        '2. 根据正统性来源：\n' +
        '   - 血统：嫡长子 > 庶长子 > 兄弟 > 侄子\n' +
        '   - 功绩：能力强者优先，忠诚度重要\n' +
        '   - 选举：支持者多者优先\n' +
        '3. 根据王朝阶段：\n' +
        '   - 初创期：功臣优先，能力重要\n' +
        '   - 盛期：制度化，按规则继承\n' +
        '   - 中期：开始腐败，关系网重要\n' +
        '   - 末期：混乱，实力为王\n' +
        '4. 候选人数量：2-4人，包括不同派系和背景\n' +
        '5. legitimacy 表示名分正统性（0-1），ability 表示能力（0-1）\n' +
        '6. consequence 要考虑：\n' +
        '   - 地方势力反应（支持/反对/观望）\n' +
        '   - 朝廷态度（认可/质疑/干预）\n' +
        '   - 其他候选人反应（接受/不满/反叛）\n' +
        '   - 对局势的影响（稳定/动荡/战争）';

      var url = P.ai.url;
      if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';

      var response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + P.ai.key
        },
        body: JSON.stringify({
          model: P.ai.model || 'gpt-4o',
          messages: [{role: 'user', content: prompt}],
          temperature: 0.7,
          max_tokens: Math.round(1000 * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0))
        })
      });

      if (!response.ok) {
        throw new Error('AI \u8C03\u7528\u5931\u8D25');
      }

      var data = await response.json();
      var content = (data.choices&&data.choices[0]&&data.choices[0].message)?data.choices[0].message.content:'';

      // 提取 JSON
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        var inheritanceData = JSON.parse(jsonMatch[0]);

        // 自动执行推荐的继承方案
        var heir = inheritanceData.recommendation;
        if (heir) {
          deadCharOffices.forEach(function(office) {
            office.position.holder = heir;
          });

          // 记录继承事件
          addEB('继承', deadChar.name + '去世，' + heir + '继任' + officeList + '。');
          if (typeof recordCharacterArc === 'function') recordCharacterArc(heir, 'inheritance', heir + '继承' + deadChar.name + '的地位');
          if (inheritanceData.reasoning) {
            addEB('推荐理由', inheritanceData.reasoning);
          }
          addEB('后果', inheritanceData.consequence);

          // 处理其他候选人的反应（继承冲突）
          if (inheritanceData.candidates && inheritanceData.candidates.length > 1) {
            inheritanceData.candidates.forEach(function(candidate) {
              if (candidate.name === heir) return;
              var candidateChar = findCharByName(candidate.name);
              if (candidateChar) {
                // 落选候选人的忠诚度下降
                var oldLoyalty = (typeof candidateChar.loyalty === 'number' && isFinite(candidateChar.loyalty)) ? candidateChar.loyalty : 50;
                var heirLegitimacy = (inheritanceData.candidates.find(function(c) { return c.name === heir; }) || {legitimacy: 0.5}).legitimacy;
                var legitimacyGap = (candidate.legitimacy || 0.5) - heirLegitimacy;
                var loyaltyDrop = -Math.max(1, Math.round((0.2 + Math.max(0, legitimacyGap)) * 20)); // 资格越强却落选，不满越大
                if (typeof adjustCharacterLoyalty === 'function') {
                  adjustCharacterLoyalty(candidateChar, loyaltyDrop, '\u7EE7\u627F\u843D\u9009\u4E0D\u6EE1\uFF1A' + deadChar.name, { source:'inheritance-candidate-lost' });
                } else {
                  candidateChar.loyalty = Math.max(0, oldLoyalty + loyaltyDrop);
                }

                if (loyaltyDrop < -10) {
                  if (typeof adjustCharacterLoyalty !== 'function') recordChange('characters', candidate.name, 'loyalty', oldLoyalty, candidateChar.loyalty, '继承落选不满');
                  addEB('不满', candidate.name + '对继承结果不满，忠诚度下降。');

                  // 如果不满严重且有反对者支持，可能引发叛乱
                  if (candidateChar.loyalty < 30 && candidate.opposition && candidate.opposition.length > 0) {
                    addEB('警告', candidate.name + '可能联合' + candidate.opposition.join('、') + '发动叛乱！');
                  }
                }
              }
            });
          }

          // 更新继承人忠诚度
          var heirChar = findCharByName(heir);
          if (heirChar) {
            var oldLoyalty = (typeof heirChar.loyalty === 'number' && isFinite(heirChar.loyalty)) ? heirChar.loyalty : 50;
            // 继承后的忠诚变化改为可解释：正统性越高越感激，野心过高则转为自恃。
            var heirCandidate = inheritanceData.candidates.find(function(c) { return c.name === heir; }) || {legitimacy: 0.5};
            var ambition = (typeof heirChar.ambition === 'number' && isFinite(heirChar.ambition)) ? heirChar.ambition : 50;
            var loyaltyChange = Math.round(((heirCandidate.legitimacy || 0.5) - 0.5) * 16) + (ambition > 75 ? -4 : (ambition < 35 ? 4 : 1));
            loyaltyChange = Math.max(-6, Math.min(12, loyaltyChange));
            if (typeof adjustCharacterLoyalty === 'function') {
              adjustCharacterLoyalty(heirChar, loyaltyChange, '\u7EE7\u627F' + deadChar.name + '\u9057\u7F3A', { source:'inheritance-heir-result' });
            } else {
              heirChar.loyalty = Math.max(0, Math.min(100, oldLoyalty + loyaltyChange));
            }
            if (loyaltyChange !== 0 && typeof adjustCharacterLoyalty !== 'function') {
              recordChange('characters', heir, 'loyalty', oldLoyalty, heirChar.loyalty, '\u7EE7\u627F\u5F71\u54CD');
            }

            // 头衔继承：如果死者有世袭头衔，继承人自动继承
            if (deadChar.titles && deadChar.titles.length > 0 && typeof inheritTitle === 'function') {
              deadChar.titles.forEach(function(title) {
                if (title.hereditary) {
                  inheritTitle(deadChar.name, heir, title.type);
                }
              });
            }
          } else {
            // 继承人不在当前角色列表中，可能需要创建新角色
            var candidate = inheritanceData.candidates.find(function(c) { return c.name === heir; });
            if (candidate) {
              var newHeir = {
                name: heir,
                title: candidate.relation || '',
                desc: candidate.note || '',
                stats: {},
                stance: "",
                playable: false,
                personality: "",
                appearance: "",
                skills: [],
                loyalty: Math.floor(candidate.legitimacy * 100),
                morale: 70,
                dialogues: [],
                secret: "",
                faction: deadChar.faction || "",
                aiPersonaText: "",
                behaviorMode: "",
                valueSystem: "",
                speechStyle: "",
                rels: []
              };
              GM.chars.push(newHeir);
              // 维护索引
              addToIndex('char', newHeir.name, newHeir);
              addEB('\u4EBA\u7269', heir + '\u51FA\u73B0\uFF0C\u7EE7\u627F' + deadChar.name + '\u7684\u5B98\u804C\u3002');
            }
          }
        } else {
          // 无人继承，官职空缺
          deadCharOffices.forEach(function(office) {
            office.position.holder = '';
          });
          addEB('\u7EDD\u5F7C', deadChar.name + '\u53BB\u4E16\uFF0C' + officeList + '\u51FA\u7F3A\u3002');
          addEB('\u540E\u679C', inheritanceData.consequence);
        }
      }

    } catch (error) {
      console.error('\u7EE7\u627F AI \u63A8\u6F14\u5931\u8D25:', error);
      // AI 失败时，简单处理：官职空缺
      deadCharOffices.forEach(function(office) {
        office.position.holder = '';
      });
      addEB('\u4EBA\u7269', deadChar.name + '\u53BB\u4E16\uFF0C' + officeList + '\u51FA\u7F3A\u3002');
    }
  } else {
    // 没有 AI 时，简单处理：官职空缺
    deadCharOffices.forEach(function(office) {
      office.position.holder = '';
    });
    var officeList2 = deadCharOffices.map(function(o) {
      return o.deptName + ' ' + o.posName;
    }).join('\u3001');
    addEB('\u4EBA\u7269', deadChar.name + '\u53BB\u4E16\uFF0C' + officeList2 + '\u51FA\u7F3A\u3002');
  }
}
