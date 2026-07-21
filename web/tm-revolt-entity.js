// ============================================================
//  tm-revolt-entity.js — 民变实体镜像层（R2 第一波·2026-07-21）
//
//  owner 范式铁律(2026-07-07)：民变=实体演进链·终局=玩家角色被杀·绝非数值阈值。
//  R2 双轨(鼎革战役已拍)：flag P.conf.revoltEntityEnabled(默认 OFF·设置可开)——
//  ON 时·五级爬梯(tm-authority-complete P0-2·仍是进度时钟·本层零改动)中 level≥3 的民变
//  被具象化为**真实体三件套**：义军势力(GM.facs) + 渠帅人物(GM.chars) + 义军军队(GM.armies)。
//  全游戏系统(军事/势力索引/花名册/AI 叙事)经由既有容器自然看见它们；爬梯状态逐回合
//  镜像到实体：升级→扩军·被剿/瓦解→覆灭(军散/势力除档/渠帅溃散流亡)。
//  级5(改朝)实体保留在场——终局屏仍由爬梯的 _gameOver 信号管。
//
//  本文件是这三类 _revoltEntity 实体的**唯一写口**(已登记 lint-gm-writes owners)。
//  批二(须摊桌)：破京终局链(接玩家之死裁决器)·招抚动词(牵国库走账+玩家操作五渠道)·
//  威胁值→侵攻确定性接点(外患侧同范式具象化)。
//  渠帅之死不在本层：溃散=流亡(alive 不动)·避免与结构化死亡闸/亡因系统纠缠。
// ============================================================
(function (global) {
  'use strict';

  // 兵额/势力强度按爬梯级别定值（movement scale ≠ 军队员额·取约三成·封 20 万）
  var SOLDIERS_BY_LEVEL = { 3: 9000, 4: 60000, 5: 200000 };
  var STRENGTH_BY_LEVEL = { 3: 40, 4: 60, 5: 85 };

  function enabled() {
    try { return !!(global.P && global.P.conf && global.P.conf.revoltEntityEnabled === true); }
    catch (_) { return false; }
  }

  function _eb(msg) {
    try { if (typeof global.addEB === 'function') global.addEB('民变', msg); } catch (_) {}
  }

  function _factionName(G, r) {
    var base = (r.region ? String(r.region) : '流民') + '义军';
    // 同区第二股民变→缀序防重名（按已在档的其他 _revoltEntity 势力计数）
    var clash = (G.facs || []).filter(function (f) {
      return f && f._revoltEntity && f.sourceRevoltId !== r.id && String(f.name || '').indexOf(base) === 0;
    }).length;
    return clash > 0 ? (base + '·' + (clash + 1)) : base;
  }

  function _leaderName(G, r) {
    var name = String(r.leader || r.leaderName || '').trim();
    if (name) return name;
    return (r.region ? String(r.region) : '') + '义军渠帅';
  }

  // 人物转籍/退籍走 FactionMembership 正门（缺席[裸跑/装载序]时单点兜底直写）
  function _setCharFaction(ch, facName) {
    try {
      var FM = global.TM && global.TM.FactionMembership;
      if (FM && typeof FM.assignChar === 'function') {
        FM.assignChar(ch, facName || '', { reason: '民变实体镜像', silent: true });
        return;
      }
    } catch (_) {}
    ch.faction = facName || '';  // membership-fallback·API 缺席兜底(smoke 裸跑用)
  }

  function _findBySource(list, rid) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i]._revoltEntity && list[i].sourceRevoltId === rid) return list[i];
    }
    return null;
  }

  // 具象化：为 ongoing 且 level≥3 的民变确保实体三件套在档（幂等·按 sourceRevoltId 认亲）
  function _ensureTrio(G, r) {
    if (!Array.isArray(G.facs) || !Array.isArray(G.armies) || !Array.isArray(G.chars)) return;
    var lvl = Math.max(3, Math.min(5, r.level || 3));
    var fac = _findBySource(G.facs, r.id);
    var facName;
    if (!fac) {
      facName = _factionName(G, r);
      fac = {
        id: 'fac_rev_' + r.id,
        name: facName,
        type: '民变',
        isRevolt: true,
        strength: STRENGTH_BY_LEVEL[lvl],
        economy: 15,
        playerRelation: -85,
        sourceRevoltId: r.id,
        _revoltEntity: true,
        _createdTurn: G.turn || 0
      };
      G.facs.push(fac);  // arch-ok 民变实体唯一写口(本文件已登记 owners)·义军势力入档
      _eb((r.region || '某地') + '民变成势·「' + facName + '」旗号立·天下侧目');
    } else {
      facName = fac.name;
      fac.strength = STRENGTH_BY_LEVEL[lvl];  // 爬梯升级→势力强度镜像
    }

    // 渠帅：民变自带首领名且已在档(真人物揭竿)→只挂链不造人；否则造 _revoltEntity 渠帅
    var lname = _leaderName(G, r);
    var existing = null;
    for (var c = 0; c < G.chars.length; c++) {
      if (G.chars[c] && String(G.chars[c].name || '') === lname) { existing = G.chars[c]; break; }
    }
    if (existing && !existing._revoltEntity) {
      // 在档真人揭竿·不重复造·转投义军势力(原势力留痕 _preRevoltFaction·覆灭时清账)
      r._entityLeaderName = lname;
      if (existing.faction !== facName) {
        existing._preRevoltFaction = existing.faction || '';
        _setCharFaction(existing, facName);
      }
      existing.sourceRevoltId = r.id;
    } else if (!existing) {
      G.chars.push({  // arch-ok 民变实体唯一写口·渠帅人物入档
        name: lname, alive: true, faction: facName, officialTitle: '义军渠帅',
        loyalty: 0, sourceRevoltId: r.id, _revoltEntity: true, _createdTurn: G.turn || 0
      });
      r._entityLeaderName = lname;
    } else {
      r._entityLeaderName = lname;
      _setCharFaction(existing, facName);
    }

    var army = _findBySource(G.armies, r.id);
    var soldiers = SOLDIERS_BY_LEVEL[lvl];
    if (!army) {
      G.armies.push({  // arch-ok 民变实体唯一写口·义军军队入档(形状镜像 ai-change-army 创建先例)
        id: 'army_rev_' + r.id,
        name: facName + '主力',
        faction: facName,
        branch: '流民军', type: '流民军', armyType: '流民军',
        soldiers: soldiers, size: soldiers, strength: soldiers,
        morale: 55, supply: 45, training: 35, loyalty: 80, control: 70, controlLevel: 70,
        location: r.region || '', garrison: r.region || '',
        commander: lname,
        equipment: [], quality: '乌合',
        composition: [{ type: '流民军', count: soldiers }],
        state: 'field',
        source: 'revolt.entity',
        sourceRevoltId: r.id, _revoltEntity: true, _createdTurn: G.turn || 0
      });
    } else if ((army.soldiers || 0) < soldiers && !army.disbanded) {
      // 爬梯升级→扩军镜像（只涨不缩·被剿减员归战斗/镇压系统管）
      army.soldiers = soldiers; army.size = soldiers; army.strength = soldiers;
      army.composition = [{ type: '流民军', count: soldiers }];
      _eb((r.region || '某地') + '「' + facName + '」裹挟日众·号称 ' + Math.round(soldiers / 1000) + ' 千之众');
    }
  }

  // 覆灭：民变被剿/瓦解 → 军散·势力除档·渠帅溃散流亡（不碰 alive·避开死亡系统）
  function _teardown(G, fac) {
    var rid = fac.sourceRevoltId;
    var army = _findBySource(G.armies, rid);
    if (army && !army.disbanded) {
      army.disbanded = true; army.state = 'disbanded';
      army.soldiers = 0; army.size = 0; army.strength = 0;
    }
    for (var c = 0; c < G.chars.length; c++) {
      var ch = G.chars[c];
      if (!ch || ch.sourceRevoltId !== rid || ch._revoltDefeated) continue;
      if (ch._revoltEntity) {
        ch._revoltDefeated = true; ch.officialTitle = '溃散流亡';
      } else {
        ch._revoltDefeated = true;  // 真人首领：败后无所依·原职衔不动(去留归后续系统)
      }
      _setCharFaction(ch, '');  // 退籍走正门
    }
    var idx = G.facs.indexOf(fac);
    if (idx >= 0) G.facs.splice(idx, 1);  // arch-ok 民变实体唯一写口·自建势力对称除档
    _eb('「' + (fac.name || '义军') + '」烟消云散·余党四散');
  }

  // 每回合镜像：状态驱动·幂等（即使某回合先于爬梯 tick 跑·至多迟一回合收敛）
  function sync(G) {
    if (!enabled()) return;
    G = G || global.GM;
    if (!G || !G.minxin || !Array.isArray(G.minxin.revolts)) return;
    if (!Array.isArray(G.facs)) return;
    var byId = {};
    G.minxin.revolts.forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
    // ① 具象化/更新在场者
    G.minxin.revolts.forEach(function (r) {
      if (!r || r.status !== 'ongoing') return;
      if ((r.level || 0) < 3) return;
      try { _ensureTrio(G, r); } catch (_eT) {}
    });
    // ② 覆灭清账：源民变已被剿/瓦解/出档（级5改朝除外·实体留在场·终局屏归爬梯 _gameOver）
    G.facs.slice().forEach(function (fac) {
      if (!fac || !fac._revoltEntity) return;
      var src = byId[fac.sourceRevoltId];
      if (src && src.status === 'ongoing') return;
      if (src && (src.level || 0) >= 5) return;
      try { _teardown(G, fac); } catch (_eD) {}
    });
  }

  var API = {
    sync: sync,
    enabled: enabled,
    SOLDIERS_BY_LEVEL: SOLDIERS_BY_LEVEL,
    STRENGTH_BY_LEVEL: STRENGTH_BY_LEVEL
  };
  global.TM = global.TM || {};
  global.TM.RevoltEntity = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  // 结算管线注册：晚序(90)·爬梯 tick 之后镜像；管线缺席(裸跑/旧装载序)→ 静默·smoke 直调 sync
  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('revoltEntity', '民变实体镜像', function () {
        try { sync(global.GM); } catch (_eS) {}
      }, 90, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);
