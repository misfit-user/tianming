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
    // 批三·AI 锻造的真旗号优先(owner重批：禁「XX义军」式模板)·模板仅为 AI 缺席兜底(双轨)
    var base = (r._identity && r._identity.banner) ? String(r._identity.banner)
      : ((r.region ? String(r.region) : '流民') + '义军');
    // 同区第二股民变→缀序防重名（按已在档的其他 _revoltEntity 势力计数）
    var clash = (G.facs || []).filter(function (f) {
      return f && f._revoltEntity && f.sourceRevoltId !== r.id && String(f.name || '').indexOf(base) === 0;
    }).length;
    return clash > 0 ? (base + '·' + (clash + 1)) : base;
  }

  function _leaderName(G, r) {
    var name = String((r._identity && r._identity.leaderName) || r.leader || r.leaderName || '').trim();
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

  // 覆灭/受抚：民变被剿/瓦解→军散·势力除档·渠帅溃散流亡；受抚(批三·AI 谈判成局)→遣散罢兵·
  // 渠帅得授讨来的官职或归顺·真人首领复原籍。皆不碰 alive(避开死亡系统)。
  function _teardown(G, fac, src) {
    var rid = fac.sourceRevoltId;
    var pac = (src && src._pacified) || null;
    var army = _findBySource(G.armies, rid);
    if (army && !army.disbanded) {
      army.disbanded = true; army.state = 'disbanded';
      army.soldiers = 0; army.size = 0; army.strength = 0;
    }
    for (var c = 0; c < G.chars.length; c++) {
      var ch = G.chars[c];
      if (!ch || ch.sourceRevoltId !== rid || ch._revoltDefeated || ch._revoltPacified) continue;
      if (pac) {
        ch._revoltPacified = true;
        ch.officialTitle = pac.officeTitle || '受抚归顺';
        _setCharFaction(ch, ch._preRevoltFaction || '');  // 真人招安复原籍·草莽渠帅无所属
        // 批五·受抚渠帅接问对/记忆：授官者落位京师(问对在京判定即可召对)·举旗往事入 NPC 记忆(召对 AI 有据可依)
        if (pac.officeTitle) ch.location = (G._capital || '京师');
        ch._revoltPast = { banner: fac.name, silver: pac.silver || 0, officeTitle: pac.officeTitle || '' };
        try {
          if (typeof global.NpcMemorySystem !== 'undefined' && typeof global.NpcMemorySystem.addMemory === 'function') {
            global.NpcMemorySystem.addMemory(ch.name, '曾举「' + (fac.name || '义旗') + '」聚众抗命·后受抚归朝' + (pac.officeTitle ? '·得授' + pac.officeTitle : '') + (pac.silver ? '·抚银' + pac.silver + '两' : ''), 10, 'career');
            global.NpcMemorySystem.addMemory(ch.name, '旧账与招安之恩并存·居朝如履薄冰·防猜忌亦存桀骜', 8, 'political');
          }
        } catch (_eMem) {}
      } else if (ch._revoltEntity) {
        ch._revoltDefeated = true; ch.officialTitle = '溃散流亡';
        _setCharFaction(ch, '');  // 退籍走正门
      } else {
        ch._revoltDefeated = true;  // 真人首领：败后无所依·原职衔不动(去留归后续系统)
        _setCharFaction(ch, '');
      }
    }
    // 受抚/覆灭皆解占据(批三·occupiedBy 归还)
    try {
      (fac._occupiedDivs || []).forEach(function (dn) {
        var div = null;
        try {
          var PU = global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils;
          var fn = PU && ((typeof PU.findDivisionByNameFuzzy === 'function') ? PU.findDivisionByNameFuzzy : PU.findDivisionByNameOrId);
          div = fn ? fn(G, dn) : null;
        } catch (_eDv) {}
        if (div && div.occupiedBy === fac.name) { delete div.occupiedBy; delete div._occupiedTurn; }
      });
    } catch (_eOc) {}
    var idx = G.facs.indexOf(fac);
    if (idx >= 0) G.facs.splice(idx, 1);  // arch-ok 民变实体唯一写口·自建势力对称除档
    _eb(pac ? ('「' + (fac.name || '义军') + '」受抚罢兵·遣散归农') : ('「' + (fac.name || '义军') + '」烟消云散·余党四散'));
  }


// ── R2·破京终局链（批二刀1·2026-07-21·级5三拍：进军→破京→裁决器定命）──────────
// 爬梯级5时(flag ON)tm-authority-complete 不再瞬时 _gameOver·改挂 r._breachMarch 由本层接力：
// 拍1(升级当回合)：义军主力移师京师·九门戒严——给玩家与推演一回合反应窗；
// 拍2(次回合)：破京——G._capitalFallen 首个真写入者(皇威 capitalFall 事件端一直在等此信号)·
// 玩家角色过「玩家之死裁决器」(adjudicatePlayerDeath·kind=regicide·R1f 合法性门生效)：
// 有储君=继统续玩残局(民变实体留场·南渡故事自然涌现)·无嗣=裁决器终局信号(_playerDead)独家收场·
// 裁决器缺席(裸跑/装载序)=回落经典 _gameOver(保留 _consumeDynastyEndSignal 旧契约字段+breach 增强)。
// ★终局信号单发纪律：裁决器接手就绝不再写 _gameOver(防双终局屏)·富屏增强走新字段 _dynastyFallInfo。
function _tickBreach(G, r) {
  if (!r || !r._breachMarch || r._breachDone) return;
  var turn = G.turn || 0;
  var army = _findBySource(G.armies, r.id);
  var facName = (function () { var f = _findBySource(G.facs, r.id); return (f && f.name) || ((r.region || '') + '义军'); })();
  if (!r._breachMarch.marched) {
    // 拍1·进军
    r._breachMarch.marched = turn;
    if (army && !army.disbanded) { army.location = '京师'; army.garrison = '京师'; army.state = 'march'; }
    _eb('「' + facName + '」百万之众进逼京师·九门戒严·中外震动');
    return;
  }
  if (turn <= r._breachMarch.marched) return;  // 拍1当回合幂等·次回合才破京
  // 拍2·破京
  r._breachDone = true;
  G._capitalFallen = true;  // 破京链首个真写入者·皇威 capitalFall 信号端(tm-authority-complete)既有消费
  _eb('京师陷落！「' + facName + '」入据宫阙·社稷倾覆在即');
  // 批四·定命场景交 AI（殉国/被俘北狩/出走勤王·场景与抉择由演绎层 subcall 定·AI 缺席=兜底旧行为死亡裁决）
  var RI2 = global.TM && global.TM.RevoltInference;
  if (RI2 && typeof RI2.scheduleBreachScene === 'function' && typeof RI2.aiOn === 'function' && RI2.aiOn()) {
    RI2.scheduleBreachScene(G, r);
    return;
  }
  _applyBreachOutcome(G, r, { fate: 'death' });
}

// ── 批四·破京定命落账（宪法层：三态菜单·菜单外一律按 death 兜底·死亡仍只走裁决器）──
// fate: 'death'(殉国/城破被弑→裁决器 regicide·有储君继统) | 'captured'(被俘北狩·_captured 续玩·
//   endturn _capturedSovereign 段既有消费) | 'escaped'(乘乱出走·驻跸于外续玩·勤王残局)。
function _applyBreachOutcome(G, r, o) {
  o = o || {};
  var turn = G.turn || 0;
  var facName = (function () { var f = _findBySource(G.facs, r.id); return (f && f.name) || ((r.region || '') + '义军'); })();
  if (o.narrative) {
    try {
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.push({ turn: turn, date: G._gameDate || '', type: '国变', text: String(o.narrative).slice(0, 160), tags: ['破京', 'AI演绎'] });
    } catch (_eN) {}
  }
  var player = null;
  for (var i = 0; i < (G.chars || []).length; i++) {
    var ch = G.chars[i];
    if (ch && ch.isPlayer && ch.alive !== false) { player = ch; break; }
  }
  function fallInfo(fateStr) {
    G._dynastyFallInfo = {  // 终局富屏/本纪增强(新字段·无旧消费端契约风险)
      revolt: r.id, turn: turn, region: r.region || '',
      leader: r.leader || r.leaderName || r._entityLeaderName || '',
      facName: facName, breach: true, fate: fateStr
    };
  }
  var f0 = String(o.fate || 'death');
  if (player && f0 === 'captured') {
    player._captured = true; player._capturedBy = facName;  // 北狩态·花名册/推演既有 _captured 消费
    player._capturedLocation = facName + '军中';  // 批五·endturn「社稷悬议」段读此落位
    fallInfo('captured');
    _eb('君上蒙尘·为「' + facName + '」所执·社稷存亡悬于一线');
    return;
  }
  if (player && f0 === 'escaped') {
    fallInfo('escaped');
    _eb('君上乘乱出走·驻跸于外·诏天下兵马勤王');
    return;
  }
  var fate = null;
  try {
    if (player && typeof global.adjudicatePlayerDeath === 'function') {
      fate = global.adjudicatePlayerDeath(player, '京师陷落·殁于社稷', { kind: 'regicide', deadReason: '京师陷落·殁于社稷' });
    }
  } catch (_eA) {}
  fallInfo(fate ? fate.outcome : 'no-adjudicator');
  if (fate && fate.outcome === 'succession') {
    _eb('嗣君于乱军之外继统·社稷不绝如线·天下事犹未可知');
    return;  // 续玩残局：实体留场·_capitalFallen 持续·爬梯照走
  }
  if (fate) return;  // 裁决器已定终局(_playerDead 信号独家收场·绝不双发)
  // 裁决器缺席回落：经典 _gameOver·字段形状=旧轨契约(_consumeDynastyEndSignal)+breach 增强
  G._gameOver = {
    type: 'dynasty_change', revolt: r.id, turn: turn,
    region: r.region || '', level: 5, levelName: '改朝',
    leader: r.leader || r.leaderName || r._entityLeaderName || '',
    breach: true, capitalFallen: true
  };
  _eb('改朝换代！天命已移');
}

  // 每回合镜像：状态驱动·幂等（即使某回合先于爬梯 tick 跑·至多迟一回合收敛）
  function sync(G) {
    if (!enabled()) return;
    G = G || global.GM;
    if (!G || !G.minxin || !Array.isArray(G.minxin.revolts)) return;
    if (!Array.isArray(G.facs)) return;
    // 批三·演绎层排程(AI 起号立领袖+逐回合行为·AI 缺席时本层模板/静默=双轨)
    try { if (global.TM && global.TM.RevoltInference && typeof global.TM.RevoltInference.schedule === 'function') global.TM.RevoltInference.schedule(G); } catch (_eI) {}
    var byId = {};
    G.minxin.revolts.forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
    // ① 具象化/更新在场者
    G.minxin.revolts.forEach(function (r) {
      if (!r || r.status !== 'ongoing') return;
      if ((r.level || 0) < 3) return;
      // 批三·身份锻造中缓拍(subcall 起号立领袖·失败/超时自动落模板=双轨)
      if (r._identityPending != null && !r._identity) {
        if (r._identityPending >= (G.turn || 0) - 1) return;
        delete r._identityPending;
      }
      try { _ensureTrio(G, r); } catch (_eT) {}
      if ((r.level || 0) >= 5) { try { _tickBreach(G, r); } catch (_eB) {} }  // 破京链三拍(批二刀1)
    });
    // ② 覆灭清账：源民变已被剿/瓦解/出档（级5改朝除外·实体留在场·终局屏归爬梯 _gameOver）
    G.facs.slice().forEach(function (fac) {
      if (!fac || !fac._revoltEntity) return;
      var src = byId[fac.sourceRevoltId];
      if (src && src.status === 'ongoing') return;
      if (src && (src.level || 0) >= 5 && src.status !== 'pacified') return;  // 级5留场·但受抚仍清账(批三)
      try { _teardown(G, fac, src); } catch (_eD) {}
    });
  }

  var API = {
    sync: sync,
    enabled: enabled,
    _applyBreachOutcome: _applyBreachOutcome,
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
