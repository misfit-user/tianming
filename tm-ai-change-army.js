// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-ai-change-army.js — AI 推演变化·军队处理 (拆自 tm-ai-change-applier.js·2026-05-21·Slice 2)
 *
 * 暴露·TM.AIChange.Army·主要 API + applier 仍需 alias 回去的 helper·
 *   applyAIArmyChange (public·AI 输出 → GM.armies 写回)
 *   applyAIArmyChangeList (批量)
 *   refreshMilitaryViews (PathUtils lazy 调)
 *   armyLooseNamePattern / armyNarrativeAliases / resolveNarrativeCommanderName
 *     (applier 内 region/army narrative fallback 仍需调)
 *   findArmyForAIChange / normalizeArmyKey / clampNum (跨模块通用)
 *
 * 依赖·TM.AIChange.PathUtils (Slice 1)·必须先于本文件加载。
 */
(function(global) {
  'use strict';

  // ── 从 PathUtils 拿到的 helper·原闭包内的本地名 ──
  var _PathUtils = (global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils) || null;
  if (!_PathUtils) console.warn('[ai-change-army] TM.AIChange.PathUtils not loaded·army calls may noop');
  var _applyPathDelta      = _PathUtils && _PathUtils.applyPathDelta;
  var _recordToTurnChanges = _PathUtils && _PathUtils.recordToTurnChanges;
  var _resolvePath         = _PathUtils && _PathUtils.resolvePath;
  var _findDivisionByNameOrId = _PathUtils && _PathUtils.findDivisionByNameOrId;

  // 内联·原 applier.js 闭包工具·拆模块后跨闭包看不见·复制 17 行避免循环依赖
  function _getNarrativeText(aiOutput) {
    var t = '';
    if (!aiOutput) return t;
    if (aiOutput.narrative)    t += String(aiOutput.narrative) + '\n';
    if (aiOutput.shilu_text)   t += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji)   t += String(aiOutput.shizhengji) + '\n';
    if (aiOutput.yupiHuiting)  t += String(aiOutput.yupiHuiting) + '\n';
    if (aiOutput.qijuHistory)  t += String(aiOutput.qijuHistory) + '\n';
    if (aiOutput.event && aiOutput.event.desc) t += String(aiOutput.event.desc) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) t += String(e.desc) + '\n'; });
    }
    if (Array.isArray(aiOutput.npc_actions)) {
      aiOutput.npc_actions.forEach(function(na){ if (na && na.desc) t += String(na.desc) + '\n'; });
    }
    return t;
  }

    function _clampNum(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return Math.max(min, Math.min(max, n));
  }

  function _normalizeArmyKey(name) {
    return String(name || '').trim().replace(/[\s,，、。？！；：·・\-—_]/g, '').toLowerCase();
  }

  function _findArmyForAIChange(G, name) {
    if (!G || !Array.isArray(G.armies) || !name) return null;
    var key = _normalizeArmyKey(name);
    if (!key) return null;
    var exact = G.armies.find(function(a) {
      return a && (_normalizeArmyKey(a.name) === key || _normalizeArmyKey(a.id) === key);
    });
    if (exact) return exact;
    var fuzzy = G.armies.find(function(a) {
      var ak = _normalizeArmyKey(a && a.name);
      return ak && key && (ak.indexOf(key) >= 0 || key.indexOf(ak) >= 0) && Math.abs(ak.length - key.length) <= 4;
    });
    if (fuzzy) return fuzzy;
    // 末位兜底·按主帅姓名反查：AI 常以「代善 / 代善部 / 代善所部」指代敌军，
    // 而军名是「后金·两红旗(代善领)」——名匹配被长度护栏卡掉 → 折损被丢弃(army not found)，
    // 真实兵力纹丝不动 → 「每回合折几千却杀不完」。仅在名匹配全败后，按军队当前主帅精确等值兜底，
    // 命中那支真军（与 vacateArmiesByCommander 同范式·主帅等值故误伤面极小）。
    var cmdKey = _normalizeArmyKey(String(name).replace(/(?:所部|部队|部众|所统|麾下|部)$/, ''));
    if (cmdKey) {
      var byCmd = G.armies.find(function(a) {
        var c = _armyCurrentCommander(a);
        return c && _normalizeArmyKey(c) === cmdKey;
      });
      if (byCmd) return byCmd;
    }
    return null;
  }

  function _playerFactionNameForArmy(G, change) {
    if (change && (change.faction || change.owner || change.factionName)) return change.faction || change.owner || change.factionName;
    var P0 = global.P || {};
    if (P0.playerInfo && P0.playerInfo.factionName) return P0.playerInfo.factionName;
    if (P0.playerFaction) return P0.playerFaction;
    var pc = G && Array.isArray(G.chars) ? G.chars.find(function(c){ return c && c.isPlayer; }) : null;
    if (pc && pc.faction) return pc.faction;
    var pf = G && Array.isArray(G.facs) ? G.facs.find(function(f){ return f && (f.isPlayer || f.player); }) : null;
    return (pf && pf.name) || '';
  }

  // ── [募兵开销·2026-06-14] 募兵/建军确定性扣国库（仅玩家自己的军；敌军不动玩家国库）　　
  //   旧缺口：建军/募兵只设兵额、不扣银粮（仅 followup 在 AI 主动报 recruitment_costs 时才扣→不报即免费）。
  //   现：单一扣费点·按增兵量×兵种单价扣国库银粮·国库不继则尽扣记欠+新军士气挫·标 army._recruitChargedTurn 让 followup 跳过防双扣。
  var RECRUIT_UNIT_COST = {
    base:    { money: 2,   grain: 1   },   // 步/募兵
    cavalry: { money: 4,   grain: 1.5 },   // 骑兵·马价贵
    firearm: { money: 5,   grain: 1   },   // 火器/炮·器械贵
    navy:    { money: 4,   grain: 1   }    // 水师/舟师
  };
  function _recruitUnitCost(army, change) {
    var s = String((army && (army.type || army.branch || army.armyType)) || (change && (change.branch || change.armyType || change.type)) || '');
    if (/骑|马队|cavalry/i.test(s)) return RECRUIT_UNIT_COST.cavalry;
    if (/火器|火铳|鸟铳|炮|铳|神机|firearm|artillery|cannon/i.test(s)) return RECRUIT_UNIT_COST.firearm;
    if (/水师|舟|船|海|navy|naval|fleet/i.test(s)) return RECRUIT_UNIT_COST.navy;
    return RECRUIT_UNIT_COST.base;
  }
  function _isPlayerOwnedArmy(G, army, source) {
    if (!army) return false;
    if (army._edictBuilt) return true;
    if (/edict|player|玩家|诏/.test(String(source || army.source || ''))) return true;
    var pfn = String(_playerFactionNameForArmy(G, null) || '').trim();
    if (!pfn) return false;
    var af = String(army.faction || army.owner || '').trim();
    return !!af && af === pfn;
  }
  function _chargeRecruitment(G, army, addedTroops, change, reason, source) {
    try {
      addedTroops = Math.max(0, Math.round(Number(addedTroops) || 0));
      if (addedTroops <= 0 || !army) return null;
      if (!_isPlayerOwnedArmy(G, army, source)) return null;        // 只对玩家自己的军扣国库
      var FE = global.FiscalEngine;
      if (!FE || typeof FE.spendFromGuoku !== 'function') return null;
      var unit = _recruitUnitCost(army, change);
      var silver = Math.max(0, Math.round(addedTroops * unit.money));
      var grain  = Math.max(0, Math.round(addedTroops * unit.grain));
      if (silver + grain <= 0) return null;
      var spend = FE.spendFromGuoku({ money: silver, grain: grain }, '募兵·' + (army.name || ''));
      var prev = (army._recruitCost && army._recruitCost.turn === (G.turn || 0)) ? army._recruitCost : null;
      army._recruitCost = {
        silver: (prev ? prev.silver : 0) + silver,
        grain:  (prev ? prev.grain  : 0) + grain,
        cloth:  (prev ? prev.cloth  : 0),
        turn: G.turn || 0
      };
      army._recruitChargedTurn = G.turn || 0;
      var ded = (spend && spend.deducted) || {};
      var def = [];
      if (ded.money && ded.money.deficit > 0) def.push('银' + Math.round(ded.money.deficit));
      if (ded.grain && ded.grain.deficit > 0) def.push('粮' + Math.round(ded.grain.deficit));
      if (def.length && typeof army.morale === 'number') {        // 欠饷→新募士气挫（养不起的军是弱军）
        army.morale = _clampNum(army.morale - 12, 0, 100);
        army._recruitArrears = (G.turn || 0);
      }
      // ── 募兵从武库支取装备（装备不凭空·缺装备则新军简陋·士气挫）──
      var AR = (typeof window !== 'undefined' && window.TMArmory) || (typeof global !== 'undefined' && global.TMArmory);
      var eqStr = '';
      try {
        if (AR && typeof AR.consumeForRecruit === 'function') {
          var eq = AR.consumeForRecruit(G, army, addedTroops);
          if (eq) {
            if (eq.condition) {                                     // 武库不继→新军装备简陋
              army.equipmentCondition = eq.condition;
              if (typeof army.morale === 'number') army.morale = _clampNum(army.morale - eq.moralePenalty, 0, 100);
              army._underEquipped = G.turn || 0;
              var shArr = []; for (var sk in eq.shortfall) shArr.push(sk + Math.round(eq.shortfall[sk]));
              eqStr = '（武库不继·缺' + shArr.join('/') + '·' + eq.condition + '·士气挫）';
            } else {
              eqStr = '·械齐';
            }
          }
        }
      } catch (_eqe) {}
      if (G._turnReport) G._turnReport.push({ type:'military', armyName: army.name || '', field:'recruitCost', silver: silver, grain: grain, deficit: def.join('/') || '', equip: eqStr, reason:'募兵开销', source: source || '', turn: G.turn || 0 });
      if (typeof global.addEB === 'function') global.addEB('财政', '募' + (army.name || '') + '·' + addedTroops + '兵·开销银' + silver + (grain ? '·粮' + grain : '') + (def.length ? '（国库不继，欠' + def.join('/') + '·新军士气挫）' : '') + eqStr);
      return spend;
    } catch (_) { return null; }
  }

  function _armyChangeDelta(change) {
    if (!change) return 0;
    var v = (change.delta != null) ? change.delta
          : (change.soldiers_delta != null) ? change.soldiers_delta
          : (change.soldierDelta != null) ? change.soldierDelta
          : (change.strength_delta != null) ? change.strength_delta
          : (change.troops_delta != null) ? change.troops_delta
          : null;
    if (v == null && (change.action === 'create' || change.create === true || change.isNewArmy === true)) {
      v = change.soldiers != null ? change.soldiers : (change.strength != null ? change.strength : change.size);
    }
    v = Math.round(Number(v) || 0);
    return v;
  }

  function _refreshMilitaryViews(G) {
    try { if (typeof global.syncMilitarySources === 'function') global.syncMilitarySources(G); } catch(_) {}
    try { if (global.TM && TM.FactionIndex && typeof TM.FactionIndex.rebuild === 'function') TM.FactionIndex.rebuild(); } catch(_) {}
    try { if (typeof global.renderTopBarVars === 'function') global.renderTopBarVars(); } catch(_) {}
    try { if (typeof global.syncArmiesToMap === 'function') global.syncArmiesToMap(); } catch(_) {}
    try { if (typeof global.renderMap === 'function') global.renderMap(); } catch(_) {}
    try {
      if (global.TMPhase8FormalBridge && typeof global.TMPhase8FormalBridge.refresh === 'function') {
        global.TMPhase8FormalBridge.refresh();
      }
    } catch(_) {}
  }

  function _armyCommanderField(change) {
    if (!change || typeof change !== 'object') return null;
    var keys = ['commander', 'commanderName', 'general', 'leader', 'newCommander', 'newGeneral', 'chiefCommander', '统帅', '主帅', '主将', '将领', '将帅'];
    for (var i = 0; i < keys.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(change, keys[i]) && change[keys[i]] != null) {
        return String(change[keys[i]] || '').trim();
      }
    }
    return null;
  }

  function _armyTextField(change, keys) {
    if (!change || typeof change !== 'object') return null;
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(change, k) && change[k] != null) {
        return String(change[k] || '').trim();
      }
    }
    return null;
  }

  function _armyQualityField(change) {
    return _armyTextField(change, ['quality', 'grade', 'eliteLevel', 'troopQuality', 'armyQuality', 'unitQuality', 'qualityLabel', '军质', '品质', '素质', '兵员素质', '部队质量', '军队质量']);
  }

  function _armyEquipmentField(change) {
    var text = _armyTextField(change, ['equipmentCondition', 'equipmentStatus', 'equipmentLevel', 'equipmentSummary', 'equipmentDesc', 'equipmentText', '装备', '装备状况', '装备水平', '军械', '器械']);
    if (text !== null) return text;
    if (change && Object.prototype.hasOwnProperty.call(change, 'equipment') && !Array.isArray(change.equipment) && change.equipment != null) {
      return String(change.equipment || '').trim();
    }
    return null;
  }

  function _armyCurrentCommander(army) {
    if (!army) return '';
    var keys = ['commander', 'commanderName', 'general', 'leader'];
    for (var i = 0; i < keys.length; i += 1) {
      var v = army[keys[i]];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  }

  function _syncArmyCommanderAliases(army, commander, oldCommander) {
    if (!army) return false;
    commander = String(commander || '').trim();
    var changed = false;
    [
      'commander',
      'commanderName',
      'commanderDisplayName',
      'commander_name',
      'general',
      'generalName',
      'leader',
      'leaderName',
      'commandingOfficer',
      'chiefCommander',
      'chiefGeneral',
      'mainGeneral'
    ].forEach(function(k) {
      if (army[k] !== commander) {
        army[k] = commander;
        changed = true;
      }
    });
    return changed;
  }

  function _syncArmyQualityAliases(army, quality) {
    if (!army) return false;
    quality = String(quality || '').trim();
    var changed = false;
    ['quality', 'grade', 'eliteLevel', 'troopQuality', 'armyQuality', 'unitQuality', 'qualityLabel'].forEach(function(k) {
      if (army[k] !== quality) {
        army[k] = quality;
        changed = true;
      }
    });
    return changed;
  }

  function _syncArmyEquipmentAliases(army, value) {
    if (!army) return false;
    var changed = false;
    if (Array.isArray(value)) {
      army.equipment = value;
      changed = true;
      return changed;
    }
    value = String(value || '').trim();
    ['equipmentCondition', 'equipmentStatus', 'equipmentLevel', 'equipmentSummary', 'equipmentDesc', 'equipmentText'].forEach(function(k) {
      if (army[k] !== value) {
        army[k] = value;
        changed = true;
      }
    });
    return changed;
  }

  function applyAIArmyChange(change, opts) {
    opts = opts || {};
    var G = global.GM;
    if (!G || !change) return { ok:false, reason:'no game or change' };
    if (!Array.isArray(G.armies)) G.armies = [];
    if (!G._turnReport) G._turnReport = [];

    var name = change.armyName || change.name || change.army || change.unitName || change.unit || '';
    name = String(name || '').trim();
    if (!name) return { ok:false, reason:'missing army name' };

    var delta = _armyChangeDelta(change);
    var army = _findArmyForAIChange(G, name);
    var reason = change.reason || change.rationale || opts.reason || 'AI推演';
    var commanderInput = _armyCommanderField(change);
    var qualityInput = _armyQualityField(change);
    var equipmentInput = _armyEquipmentField(change);
    var factionInput = (change.faction != null) ? change.faction
      : (change.owner != null) ? change.owner
      : (change.factionName != null) ? change.factionName
      : null;
    var changed = false;
    var created = false;

    // 名匹配失败但 AI 另给了主帅 → 按主帅反查那支军（防「后金军」这类含糊名漏改真军）。
    if (!army && commanderInput) army = _findArmyForAIChange(G, commanderInput);

    if (!army) {
      var _forceCreate = (change.action === 'create' || change.create === true || change.isNewArmy === true);
      if (delta <= 0 && !_forceCreate) return { ok:false, reason:'army not found', name:name };
      var armyType = change.armyType || change.type || change.branch || change.kind || '募兵';
      var factionName = _playerFactionNameForArmy(G, change);
      army = {
        id: change.id || ('army_' + (G.turn || 0) + '_' + Math.random().toString(36).slice(2, 7)),
        name: name,
        faction: '',
        branch: change.branch || armyType,
        type: armyType,
        armyType: armyType,
        soldiers: Math.max(0, delta),
        size: Math.max(0, delta),
        strength: Math.max(0, delta),
        morale: _clampNum((change.morale != null ? change.morale : 60) + (Number(change.morale_delta) || 0), 0, 100),
        supply: _clampNum(change.supply != null ? change.supply : 75, 0, 100),
        training: _clampNum((change.training != null ? change.training : 45) + (Number(change.training_delta) || 0), 0, 100),
        loyalty: _clampNum(change.loyalty != null ? change.loyalty : 60, 0, 100),
        control: _clampNum(change.control != null ? change.control : 60, 0, 100),
        controlLevel: _clampNum(change.controlLevel != null ? change.controlLevel : 60, 0, 100),
        location: change.location || change.garrison || change.region || change.province || change.destination || '',
        garrison: change.garrison || change.location || change.region || change.province || change.destination || '',
        commander: commanderInput || '',
        equipment: Array.isArray(change.equipment) ? change.equipment : [],
        quality: qualityInput || '',
        equipmentCondition: equipmentInput || '',
        composition: Array.isArray(change.composition) ? change.composition : [{ type: armyType, count: delta }],
        state: change.state || 'garrison',
        source: opts.source || change.source || 'ai_military_change',
        reason: reason,
        _aiCreated: true,
        _createdTurn: G.turn || 0
      };
      if (commanderInput) _syncArmyCommanderAliases(army, commanderInput, '');
      if (qualityInput !== null) _syncArmyQualityAliases(army, qualityInput);
      if (equipmentInput !== null) _syncArmyEquipmentAliases(army, equipmentInput);
      G.armies.push(army);
      if (factionName) {
        try {
          if (global.TM && TM.FactionMembership && typeof TM.FactionMembership.assignArmy === 'function') {
            TM.FactionMembership.assignArmy(army, factionName, { reason: reason, silent: true });
          } else {
            army.faction = factionName;
          }
        } catch(_) {
          army.faction = factionName;
        }
      }
      created = true;
      changed = true;
      G._turnReport.push({ type:'military', armyName:name, field:'soldiers', old:0, new:delta, delta:delta, created:true, reason:reason, source:opts.source || '', turn:G.turn||0 });
      if (!opts.silentEB && typeof global.addEB === 'function') global.addEB('军事', '新建' + name + '·' + delta + '兵' + (reason ? '：' + reason : ''));
      _chargeRecruitment(G, army, Math.max(0, delta), change, reason, opts.source); // 募兵开销·新建即扣
    } else {
      if (commanderInput !== null) {
        var oldCommander = _armyCurrentCommander(army);
        var aliasesChanged = _syncArmyCommanderAliases(army, commanderInput, oldCommander);
        if (aliasesChanged) {
          if (oldCommander !== commanderInput && typeof opts.recordChange === 'function') {
            opts.recordChange('military', army.name || name, 'commander', oldCommander, commanderInput, reason);
          }
          if (oldCommander !== commanderInput) {
            G._turnReport.push({ type:'military', armyName:army.name || name, field:'commander', old:oldCommander, new:commanderInput, reason:reason, source:opts.source || '', turn:G.turn||0 });
            if (typeof global.addEB === 'function') global.addEB('\u519b\u4e8b', (army.name || name) + '\u6539\u4efb\u4e3b\u5c06: ' + (commanderInput || '\u672a\u7f6e') + (reason ? '; ' + reason : ''));
          }
          changed = true;
        }
        // 补绑/改帅后复位 linkage 标记：有帅 → 在任、清掉「出缺」标记（使日后再死能再触发一次士气惩罚）；空帅 → 标记出缺
        if (String(commanderInput).trim()) { army.commanderAlive = true; army._commanderLost = false; }
        else { army.commanderAlive = false; army.commanderTitle = ''; }
      }
      if (qualityInput !== null) {
        var oldQuality = String(army.quality || army.grade || army.eliteLevel || '').trim();
        var qualityChanged = _syncArmyQualityAliases(army, qualityInput);
        if (qualityChanged) {
          if (oldQuality !== qualityInput && typeof opts.recordChange === 'function') {
            opts.recordChange('military', army.name || name, 'quality', oldQuality, qualityInput, reason);
          }
          if (oldQuality !== qualityInput && G._turnReport) {
            G._turnReport.push({ type:'military', armyName:army.name || name, field:'quality', old:oldQuality, new:qualityInput, reason:reason, source:opts.source || '', turn:G.turn||0 });
          }
          changed = true;
        }
      }
      if (equipmentInput !== null || Array.isArray(change.equipment)) {
        var newEquipmentValue = equipmentInput !== null ? equipmentInput : change.equipment;
        var oldEquipment = String(army.equipmentCondition || army.equipmentStatus || army.equipmentLevel || '').trim();
        var equipmentChanged = _syncArmyEquipmentAliases(army, newEquipmentValue);
        var newEquipmentReport = Array.isArray(newEquipmentValue) ? ('装备 ' + newEquipmentValue.length + ' 项') : String(newEquipmentValue || '').trim();
        if (equipmentChanged) {
          if (oldEquipment !== newEquipmentReport && typeof opts.recordChange === 'function') {
            opts.recordChange('military', army.name || name, 'equipmentCondition', oldEquipment, newEquipmentReport, reason);
          }
          if (oldEquipment !== newEquipmentReport && G._turnReport) {
            G._turnReport.push({ type:'military', armyName:army.name || name, field:'equipmentCondition', old:oldEquipment, new:newEquipmentReport, reason:reason, source:opts.source || '', turn:G.turn||0 });
          }
          changed = true;
        }
      }
      if (delta) {
        // S6（2026-06-12）募兵硬上限：明示募兵类扩编按驻地兵源池（militaryDetail.availableRecruits·硬链引擎每回合算）封顶；
        // 越限视为强征——民心叶账立扣。仅拦「募」字号正向扩编，调防/合军/援军不受限。
        if (delta > 0 && /募|征兵|招兵|招募|抽丁/.test(String(reason || '') + ' ' + String(change.action || ''))) {
          try {
            var _fpRec = global.TM && global.TM.FieldPipes;
            if (_fpRec && typeof _fpRec.capRecruitDelta === 'function') {
              var _recLoc = String(army.garrison || army.location || change.garrison || change.location || '').trim();
              var _capRes = _fpRec.capRecruitDelta(G, global.P, _recLoc, delta);
              if (_capRes && _capRes.overdraft > 0) {
                delta = _capRes.approved;
                if (typeof global.addEB === 'function') global.addEB('军事', (army.name || name) + '募兵逾' + _recLoc + '兵源之池（池 ' + _capRes.cap + '）·实募 ' + _capRes.approved + '·强征扰民');
                if (G._turnReport) G._turnReport.push({ type:'military', armyName:army.name || name, field:'recruitCap', old:_capRes.cap + _capRes.overdraft, new:_capRes.approved, reason:'募兵硬上限（S6）', source:opts.source || '', turn:G.turn||0 });
              }
            }
          } catch(_) {}
        }
        var oldS = Math.max(0, Math.round(Number(army.soldiers || army.size || army.strength || 0) || 0));
        var newS = Math.max(0, oldS + delta);
        army.soldiers = newS;
        army.size = newS;
        army.strength = newS;
        if ((army._createdTurn === (G.turn || 0)) || /募|征兵|招兵|招募|抽丁|建军|扩编/.test(String(reason || '') + ' ' + String(change.action || ''))) {
          _chargeRecruitment(G, army, delta, change, reason, opts.source); // 募兵性增兵才扣（调防/合军/援军不扣）
          // 新兵稀释累计历练(§12.3·老兵金贵)·丁口/募兵两源共用此 delta apply·只对募兵性增兵(非调防/合军老兵)·flag-inert(veterancy=0时无操作·零变更)
          try { var _AU = (typeof window !== 'undefined' && window.TMArmyUnits) || (typeof global !== 'undefined' && global.TMArmyUnits); if (_AU && typeof _AU.diluteVeterancy === 'function') _AU.diluteVeterancy(army, oldS, delta); } catch (_dv) {}
        }
        if (typeof opts.recordChange === 'function') opts.recordChange('military', army.name || name, 'soldiers', oldS, newS, reason);
        G._turnReport.push({ type:'military', armyName:army.name || name, field:'soldiers', old:oldS, new:newS, delta:delta, reason:reason, source:opts.source || '', turn:G.turn||0 });
        if (newS <= 0) {
          army.destroyed = true;
          if (typeof global.addEB === 'function') global.addEB('军事', (army.name || name) + '全军覆没：' + reason);
        }
        changed = true;
      }
      if (factionInput != null && String(factionInput).trim()) {
        var newFaction = String(factionInput).trim();
        var oldFaction = String(army.faction || army.owner || '').trim();
        if (oldFaction !== newFaction) {
          try {
            if (global.TM && TM.FactionMembership && typeof TM.FactionMembership.assignArmy === 'function') {
              TM.FactionMembership.assignArmy(army, newFaction, { reason: reason, silent: true });
            }
          } catch(_) {}
          if (String(army.faction || army.owner || '').trim() === newFaction) {
            if (G._turnReport) G._turnReport.push({ type:'military', armyName:army.name || name, field:'faction', old:oldFaction, new:newFaction, reason:reason, source:opts.source || '', turn:G.turn||0 });
            changed = true;
          }
        }
      }
      if (change.morale_delta || change.morale != null) {
        var oldM = army.morale == null ? 60 : Number(army.morale);
        army.morale = change.morale != null ? _clampNum(change.morale, 0, 100) : _clampNum(oldM + Number(change.morale_delta || 0), 0, 100);
        if (typeof opts.recordChange === 'function') opts.recordChange('military', army.name || name, 'morale', oldM, army.morale, reason);
        changed = true;
      }
      if (change.training_delta || change.training != null) {
        var oldT = army.training == null ? 50 : Number(army.training);
        army.training = change.training != null ? _clampNum(change.training, 0, 100) : _clampNum(oldT + Number(change.training_delta || 0), 0, 100);
        changed = true;
      }
      if (change.supply_delta || change.supply != null) {
        var oldSupply = army.supply == null ? 75 : Number(army.supply);
        army.supply = change.supply != null ? _clampNum(change.supply, 0, 100) : _clampNum(oldSupply + Number(change.supply_delta || 0), 0, 100);
        changed = true;
      }
      if (change.loyalty_delta || change.loyalty != null) {
        var oldLoyalty = army.loyalty == null ? 60 : Number(army.loyalty);
        army.loyalty = change.loyalty != null ? _clampNum(change.loyalty, 0, 100) : _clampNum(oldLoyalty + Number(change.loyalty_delta || 0), 0, 100);
        changed = true;
      }
      if (change.control_delta || change.control != null || change.controlLevel_delta || change.controlLevel != null) {
        var oldControl = army.control == null ? (army.controlLevel == null ? 60 : Number(army.controlLevel)) : Number(army.control);
        var controlDelta = Number(change.control_delta != null ? change.control_delta : change.controlLevel_delta || 0);
        var newControl = (change.control != null || change.controlLevel != null)
          ? _clampNum(change.control != null ? change.control : change.controlLevel, 0, 100)
          : _clampNum(oldControl + controlDelta, 0, 100);
        army.control = newControl;
        army.controlLevel = newControl;
        changed = true;
      }
      if (change.destination && typeof change.destination === 'string') {
        army.destination = change.destination;
        army._remainingDistance = 0;
        if (typeof global.addEB === 'function') global.addEB('行军', (army.name || name) + '接令调往' + change.destination);
        changed = true;
      }
      if ((change.location || change.garrison) && !change.destination) {
        var oldLoc = String(army.location || army.garrison || '').trim();
        var newLoc = String(change.location || change.garrison || '').trim();
        army.location = change.location || change.garrison;
        army.garrison = change.garrison || change.location;
        if (oldLoc !== newLoc && G._turnReport) {
          G._turnReport.push({ type:'military', armyName:army.name || name, field:'location', old:oldLoc, new:newLoc, reason:reason, source:opts.source || '', turn:G.turn||0 });
        }
        changed = true;
      }
    }

    if (changed) _refreshMilitaryViews(G);
    return { ok:true, army:army, created:created, changed:changed };
  }

  function _applyAIArmyChangeList(list, source, opts) {
    var count = 0;
    (list || []).forEach(function(change) {
      var res = applyAIArmyChange(change, Object.assign({}, opts || {}, { source: source }));
      if (res && res.ok && res.changed) count++;
    });
    return count;
  }

  function _escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function _armyLooseNamePattern(name) {
    var raw = String(name || '').trim();
    if (!raw) return '';
    var parts = raw.split(/[\s,，、。？！；：:·•・\-—–_]+/).filter(Boolean);
    if (parts.length > 1) {
      return parts.map(_escapeRegExp).join('[\\s,，、。？！；：:·•・\\-—–_]*');
    }
    return _escapeRegExp(raw);
  }

  function _armyNarrativeAliases(army) {
    var out = [];
    ['name', 'armyName', 'title', 'id'].forEach(function(k) {
      var v = army && army[k];
      if (v != null && String(v).trim()) out.push(String(v).trim());
    });
    return out.filter(function(v, idx) { return v && out.indexOf(v) === idx; });
  }

  function _cleanCommanderCandidate(raw) {
    var text = String(raw || '').trim();
    text = text.replace(/^[\s"'“”‘’《》【】「」『』：:，,。；;]+|[\s"'“”‘’《》【】「」『』：:，,。；;]+$/g, '');
    text = text.replace(/^(?:为|任|由|以|命|令|擢|拜|简|调|改由|更正为|改任为|改为|更为|调整为|换为|易为|新任|继任)\s*/, '');
    text = text.replace(/\s*(?:为|任|充|领|统领|统带|统辖|节制|督率|督|管带|出任|出掌|接掌|掌管|总理|总督|提督|署理|兼领|兼统|镇守|坐镇|移镇|领军|领兵|掌军|统帅|主将|将领|将帅|总兵|督师|指挥).*$/g, '');
    return text.trim();
  }

  function _resolveNarrativeCommanderName(G, raw) {
    var text = _cleanCommanderCandidate(raw);
    if (!text) return '';
    var chars = Array.isArray(G && G.chars) ? G.chars : [];
    var exact = chars.find(function(c) { return c && c.name && String(c.name).trim() === text; });
    if (exact) return String(exact.name).trim();
    var contained = chars.find(function(c) {
      var name = c && c.name ? String(c.name).trim() : '';
      return name && text.indexOf(name) >= 0;
    });
    if (contained) return String(contained.name).trim();
    var m = text.match(/[\u4e00-\u9fff·]{2,8}/);
    return m ? m[0] : text.slice(0, 20);
  }

  function _applyNarrativeArmyCommanderFallback(G, aiOutput) {
    if (!G || !Array.isArray(G.armies) || !aiOutput) return 0;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return 0;
    var seen = {};
    var count = 0;
    var roleTerms = '统帅|主帅|主将|将领|将帅|总兵|督师|统领|统带|统辖|节制|督率|管带|提督|总督|指挥|掌军|领军|领兵|镇守';
    var leadTerms = '出任|出掌|接掌|掌管|领|统领|统带|统辖|节制|督率|管带|总督|提督|署理|署|兼领|兼统|镇守|坐镇|移镇|掌军|领军|领兵';
    var commandTerms = '命|令|着|诏令|诏|旨令|敕|遣|派|委|委任|任命|授|擢|起用|简|拜|以';
    var handoverTerms = '交由|交与|交付|交|付与|付|委|委任|授|托付|移交|归|令归|改隶|转隶';
    var roleWords = '(?:' + roleTerms + ')';
    var leadVerbs = '(?:' + leadTerms + ')';
    var commandVerbs = '(?:' + commandTerms + ')';
    var handoverVerbs = '(?:' + handoverTerms + ')';
    G.armies.forEach(function(army) {
      _armyNarrativeAliases(army).forEach(function(alias) {
        var namePat = _armyLooseNamePattern(alias);
        if (!namePat) return;
        var patterns = [
          new RegExp(namePat + '[^。；;\\n]{0,32}?' + roleWords + '[^。；;\\n]{0,16}?由[^。；;\\n]{0,16}?改为\\s*([^，,。；;\\n\\s]{2,16})', 'g'),
          new RegExp(namePat + '[^。；;\\n]{0,32}?' + roleWords + '[^。；;\\n]{0,12}?(?:更正为|改任为|改为|更为|调整为|换为|易为|任为|新任|继任|补为|补授)\\s*([^，,。；;\\n\\s]{2,16})', 'g'),
          new RegExp(namePat + '[^。；;\\n]{0,32}?' + roleWords + '\\s*[:：]?\\s*([^，,。；;\\n\\s]{2,16})', 'g'),
          new RegExp(namePat + '[^。；;\\n]{0,32}?(?:改由|由|转由|交由|移交|付与)\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:接掌|' + leadTerms + ')', 'g'),
          new RegExp(namePat + '[^。；;\\n]{0,24}?' + handoverVerbs + '\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:' + roleTerms + ')', 'g'),
          new RegExp(commandVerbs + '\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:为|任|充|领|统领|统带|统辖|节制|督率|督|管带|接掌|' + leadTerms + ')[^。；;\\n]{0,24}?' + namePat + '(?:[^。；;\\n]{0,10}?' + roleWords + ')?', 'g'),
          new RegExp('([^，,。；;\\n\\s]{2,16})\\s*' + leadVerbs + '[^。；;\\n]{0,24}?' + namePat + '(?:[^。；;\\n]{0,10}?' + roleWords + ')?', 'g'),
          new RegExp('([^，,。；;\\n\\s]{2,16})\\s*(?:为|任|充|出任|署|署理|兼)\\s*' + namePat + '[^。；;\\n]{0,10}?' + roleWords, 'g')
        ];
        patterns.forEach(function(pat) {
          var m;
          while ((m = pat.exec(narrative)) !== null) {
            var commander = _resolveNarrativeCommanderName(G, m[1]);
            if (!commander) continue;
            var key = (army.id || army.name || alias) + '|' + commander;
            if (seen[key]) continue;
            seen[key] = true;
            var res = applyAIArmyChange(
              { name: army.name || alias, commander: commander, reason: '叙事统帅补录' },
              { source: 'narrative.army_commander' }
            );
            if (res && res.ok && res.changed) count++;
          }
        });
      });
    });
    return count;
  }

  // ── 部队统帅 linkage：摘帅校正 / 罢兵权 / 诏令补绑（钉死范式·回合末从「统帅死活」反推，不逐路打补丁）──

  // 把一支兵的主帅引用清空：清全部 12 个别名 + commanderTitle，按需扣士气/标记/发邸报
  function _vacateArmyCommand(army, formerName, opts) {
    if (!army) return;
    opts = opts || {};
    _syncArmyCommanderAliases(army, '', formerName || '');
    army.commanderTitle = '';
    army.commanderAlive = false;
    if (opts.moraleHit) army.morale = Math.max(0, (army.morale != null ? Number(army.morale) : 60) - opts.moraleHit);
    if (opts.markLost) { army._commanderLost = true; army._commanderLostTurn = (global.GM && global.GM.turn) || 0; }
    if (opts.eb && typeof global.addEB === 'function') {
      global.addEB('军事', String(opts.eb).replace('{army}', army.name || '某军').replace('{name}', formerName || ''));
    }
  }

  // 按统帅姓名摘掉其名下所有兵的帅位（供「免职即解兵权」等 alive-but-removed 路径显式调用）
  function vacateArmiesByCommander(commanderName, opts) {
    var G = global.GM; opts = opts || {};
    if (!G || !Array.isArray(G.armies) || !commanderName) return 0;
    var n = String(commanderName).trim(); if (!n) return 0;
    var cnt = 0;
    G.armies.forEach(function(army) {
      if (_armyCurrentCommander(army) === n) { _vacateArmyCommand(army, n, opts); cnt += 1; }
    });
    return cnt;
  }

  // 回合末校正：扫所有兵，主帅角色已死(alive===false/dead)或查无此人 → 摘帅留空缺。
  //   death-agnostic：赐死(edict)/AI character_deaths/战死(commanderFate) 各路死法都兜得住。
  //   士气-15 + 邸报只在「主字段 commander 仍挂着死者 且 未扣过」时一次性触发——
  //   防与 tm-ai-apply-deaths.js:79 的 AI 死亡级联(已清 commander 但只清主字段)重复扣士气；别名残留则静默清齐。
  function reconcileArmyCommanders(opts) {
    var G = global.GM; opts = opts || {};
    if (!G || !Array.isArray(G.armies)) return 0;
    var findChar = (typeof global.findCharByName === 'function') ? global.findCharByName : null;
    var fuzzy = (typeof global._fuzzyFindChar === 'function') ? global._fuzzyFindChar : null;
    var n = 0;
    G.armies.forEach(function(army) {
      var anyName = _armyCurrentCommander(army);          // 含别名
      if (!anyName) return;                                // 已空缺
      var primary = String(army.commander || '').trim();   // 主字段（士气惩罚只认它）
      var ch = (fuzzy && fuzzy(anyName)) || (findChar && findChar(anyName)) || null;
      var dead = ch ? (ch.alive === false || ch.dead === true) : false;
      var missing = !ch;
      if (!dead && !missing) return;                       // 在任且活着——不动
      if (dead && primary === anyName && !army._commanderLost) {
        _vacateArmyCommand(army, anyName, {
          moraleHit: 15, markLost: true,
          eb: '{army}主帅{name}' + (ch && ch.deathReason ? ('（' + ch.deathReason + '）') : '') + '殁，军中无主、士气骤降，亟待下诏补任'
        });
      } else {
        _vacateArmyCommand(army, anyName, {});             // 别名残留/查无此人/已扣过——静默清齐、不再扣士气
      }
      n += 1;
    });
    return n;
  }

  // 确定性「下诏任免主帅」：含军职(督师/总兵/提督…)的官制任命，额外把 army.commander 绑到对应部队。
  //   不取代官制任命(officeTree)，是在其之上补绑兵权。部队解析顺序：官职/防区名直接命中 → 名称或驻地含防区 → 玩家仅一支兵则默认。
  //   定不到部队就不硬绑(发低可信邸报提示在诏书写明部队名)——绝不替玩家把帅绑到错的兵上。
  function bindCommanderFromAppointment(charName, position, opts) {
    var G = global.GM; opts = opts || {};
    if (!G || !Array.isArray(G.armies) || !charName || !position) return false;
    var pos = String(position);
    var ROLE = '督师|经略|总兵官|总兵|提督|总督|镇守|节制|挂印|大将军|戎政|练兵|督理军务|协理京营';
    if (!(new RegExp(ROLE)).test(pos)) return false;     // 非军事统帅类官职——不绑
    // 朝无此人 / 已殁 → 不绑：免得把幽灵或死人挂成主帅（死人还会被回合末 reconciler 当死帅倒扣 15 士气）。与官制任命路(edict:209「朝无此人」)同口径。
    var _findCh = (typeof global.findCharByName === 'function') ? global.findCharByName : null;
    if (_findCh) {
      var _ch = _findCh(String(charName).trim());
      if (!_ch || _ch.alive === false || _ch.dead === true) {
        if (typeof global.addEB === 'function') global.addEB('军事', '诏任' + charName + '为' + pos + '·然朝无此人或已殁，主帅未绑定', { credibility: 'low' });
        return false;
      }
    }
    var hintM = pos.match(new RegExp('^([\\u4e00-\\u9fa5]{2,6}?)(?:' + ROLE + ')'));
    var hint = (hintM && hintM[1]) ? hintM[1] : '';
    var army = _findArmyForAIChange(G, pos) || (hint ? _findArmyForAIChange(G, hint) : null) || null;
    if (!army && hint) {
      army = G.armies.find(function(a) {
        var an = String(a.name || ''), loc = String(a.location || a.garrison || '');
        return (an && (an.indexOf(hint) >= 0 || hint.indexOf(an) >= 0)) || (loc && (loc.indexOf(hint) >= 0 || hint.indexOf(loc) >= 0));
      }) || null;
    }
    if (!army) {
      // 单支兵默认：仅对「明确统兵」的强军职放行——避免漕运/河道总督等文职在玩家仅一支兵时被误绑
      var STRONG = /(督师|经略|总兵官|总兵|提督|挂印|大将军|戎政|练兵|督理军务|协理京营|总督军务)/;
      if (STRONG.test(pos)) {
        var pf = (global.P && global.P.playerInfo && global.P.playerInfo.factionName) || '';
        var mine = G.armies.filter(function(a) { return !a.faction || a.faction === pf; });
        if (mine.length === 1) army = mine[0];
      }
    }
    if (!army) {
      if (typeof global.addEB === 'function') global.addEB('军事', '诏任' + charName + '为' + pos + '·未能定位部队，主帅未自动绑定（可在诏书写明部队名）', { credibility: 'low' });
      return false;
    }
    if (_armyCurrentCommander(army) === String(charName).trim()) return false; // 已是该帅
    applyAIArmyChange({ armyName: army.name, commander: charName, reason: opts.reason || ('奉诏任' + pos) }, { source: opts.source || 'edict.appoint_commander' });
    return _armyCurrentCommander(army) === String(charName).trim();
  }

  // ── Export ──
  var TM = global.TM = global.TM || {};
  TM.AIChange = TM.AIChange || {};
  TM.AIChange.Army = {
    applyAIArmyChange: applyAIArmyChange,
    applyAIArmyChangeList: _applyAIArmyChangeList,
    clampNum: _clampNum,
    normalizeArmyKey: _normalizeArmyKey,
    findArmyForAIChange: _findArmyForAIChange,
    refreshMilitaryViews: _refreshMilitaryViews,
    armyLooseNamePattern: _armyLooseNamePattern,
    armyNarrativeAliases: _armyNarrativeAliases,
    resolveNarrativeCommanderName: _resolveNarrativeCommanderName,
    applyNarrativeArmyCommanderFallback: _applyNarrativeArmyCommanderFallback,
    reconcileArmyCommanders: reconcileArmyCommanders,
    vacateArmiesByCommander: vacateArmiesByCommander,
    bindCommanderFromAppointment: bindCommanderFromAppointment,
    chargeRecruitment: _chargeRecruitment,       // 单一募兵扣费点(银粮/防双扣/武库支取/欠饷士气挫)·御驾亲征战后补员复用
    recruitUnitCost: _recruitUnitCost,           // 兵种单价表查询(补员报价 UI 用)
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.AIChange.Army;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
