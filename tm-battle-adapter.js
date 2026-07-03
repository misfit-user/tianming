/* tm-battle-adapter.js — 御驾亲征接入 · Phase 1「适配器」
 * 把主游戏交战双方的 army.units[](队·Phase0 派生)转成战术原型 `startBattle(config)` 的入参。
 * 纯数据转换(读 GM 不改 GM)·朝代中立(方名由 faction 派生)·规模压缩(场上≤35队/方·超出入 reserves 波次)。
 * 依赖:window.TMArmyUnits(Phase0·units[] 派生/自愈)。node 测试时回退 a.units。
 */
(function () {
  'use strict';

  /* 历练 → 品质(vetFromQuality 的逆·喂原型 effStr 的 quality 段) */
  function qualityFromVet(v) {
    v = +v || 0;
    return v >= 55 ? '精锐' : v >= 40 ? '精兵' : v >= 25 ? '普通' : '新募';
  }

  /* 主将名 → 战斗 gen{n,valor,mil,int}(翻 GM.chars·缺则中庸默认·永不崩) */
  function genFor(commander, GMref) {
    var name = commander || '';
    var g = GMref || (typeof window !== 'undefined' && window.GM) || (typeof GM !== 'undefined' ? GM : null);
    var c = null;
    if (g && Array.isArray(g.chars) && name) {
      for (var i = 0; i < g.chars.length; i++) {
        var ch = g.chars[i];
        if (ch && (ch.name === name || ch['姓名'] === name)) { c = ch; break; }
      }
    }
    function pick(o, keys, d) { for (var k = 0; k < keys.length; k++) { if (o && o[keys[k]] != null) return o[keys[k]]; } return d; }
    return {
      n: name || '裨将',
      valor: c ? Math.round(pick(c, ['valor', '武力', '勇武'], 60)) : 60,
      mil: c ? Math.round(pick(c, ['military', '军事', '统率', '将略'], 62)) : 62,
      int: c ? Math.round(pick(c, ['intelligence', '智力', '智'], 55)) : 55
    };
  }
  /* 麾下分队主官(裨将·主将的削弱影子·避免每队都成具名英雄) */
  function deputyGen(gen) {
    return { n: '裨将', valor: Math.max(38, (gen.valor || 60) - 18), mil: Math.max(38, (gen.mil || 62) - 14), int: Math.max(38, (gen.int || 55) - 8) };
  }

  /* 装备态→品质降级(武库供械不足→战术战斗品质降·与 calculateArmyStrength equipMod 呼应) */
  var _QTIERS = ['新募', '普通', '精兵', '精锐'];
  function degradeQualityByEquip(q, condition) {
    var c = String(condition || '');
    var drop = /严重不足|匮乏|奇缺/.test(c) ? 2 : /简陋|破败|朽钝|不足|短缺/.test(c) ? 1 : 0;
    if (!drop) return q;
    var i = _QTIERS.indexOf(q); if (i < 0) i = 1;
    return _QTIERS[Math.max(0, i - drop)];
  }
  /* 原型 flag 覆盖层认的修饰位(与 proto hasFlag 注入点对齐·§3"LLM直出flag拼装") */
  var TOKEN_FLAGS = { elite: 1, heavy: 1, shield: 1, baggage: 1, shock: 1, scare: 1, slow: 1, antiCav: 1 };
  /* 队 → 兵牌(原型 roster 单位形状:type/sub/name/soldiers/mor/training/quality/supply/gen/id/parentArmyId[/flags]) */
  function unitToToken(u, army, gen) {
    var tok = {
      id: u.id, parentArmyId: u.parentArmyId != null ? u.parentArmyId : (army && army.id) || null,
      type: u.arm || 'step', sub: u.sub || 'sword',
      name: u['番号'] || u.name || (army && army.name) || '队',
      soldiers: Math.max(1, Math.round(u.men || 0)),
      mor: Math.round((army && army.morale) || 60),
      training: Math.round((army && army.training) || 50),
      quality: degradeQualityByEquip(qualityFromVet(u['历练']), army && army.equipmentCondition),
      supply: Math.round((army && army.supply) || 80),
      gen: gen
    };
    if (Array.isArray(u.flags) && u.flags.length) {   // 修饰位透传(识别瀑布正则+LLM词典直出)·原型 spread 进 sim 单位·hasFlag 消费
      var fl = u.flags.filter(function (f) { return TOKEN_FLAGS[f]; });
      if (fl.length) tok.flags = fl;
    }
    return tok;
  }

  function armyUnits(a) {
    var us = ((typeof window !== 'undefined' && window.TMArmyUnits) ? window.TMArmyUnits.ensureArmyUnits(a) : (a && a.units)) || [];
    return us;
  }

  /* 一方军群 → 兵牌列表(每军:首队挂主将·余队挂裨将·联军合流=多军汇一方) */
  function sideTokens(armies, GMref, emperorArmyId) {
    var out = [];
    (armies || []).forEach(function (a) {
      if (!a) return;
      var us = armyUnits(a), gen = genFor(a.commander, GMref), dep = deputyGen(gen);
      var isEmp = emperorArmyId != null && (a.id === emperorArmyId);
      us.forEach(function (u, i) {
        var tok = unitToToken(u, a, i === 0 ? gen : dep);
        if (isEmp && i === 0) tok.emperor = true;   // 御营=御驾亲征者所在军的首队(天子亲临·护住御营)
        out.push(tok);
      });
    });
    return out;
  }

  /* 省名 → 确定性地图种子(同址每战一致·喂 genMap) */
  function provinceSeed(name) {
    var s = String(name || ''), h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return (h >>> 0) || 1;
  }

  /* 省地形标签 → genMap 地形档(§8 适配器·dens/biome)。标签缺省→默认随机感(dens 0.3) */
  var TERRAIN_PROFILE = {
    '平原': { dens: 0.18, biome: 'plain' }, '草原': { dens: 0.10, biome: 'plain' },
    '丘陵': { dens: 0.34, biome: 'verdant' }, '山地': { dens: 0.52, biome: 'verdant' },
    '高原': { dens: 0.26, biome: 'plain' }, '沿海': { dens: 0.22, biome: 'verdant' },
    '边塞': { dens: 0.30, biome: 'snow' }, '林地': { dens: 0.40, biome: 'verdant' },
    '漠南草原': { dens: 0.10, biome: 'plain' }, '盆地': { dens: 0.24, biome: 'verdant' }, '河谷': { dens: 0.28, biome: 'verdant' }
  };
  /* 复合地形标签拆分:"平原/山地"、"沿海/海域" → ['平原','山地']('海域'等未知子标签自然被忽略) */
  function _splitTags(tag) {
    return String(tag || '').split(/[\/、,，;；\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /* 单标签直取·复合标签取已知子标签的 dens 均值(biome 取首个已知=通常写在前的主地貌)。缺省/全未知→null(原型用默认随机感 dens0.3) */
  function terrainProfile(tag) {
    var parts = _splitTags(tag), hits = [];
    for (var i = 0; i < parts.length; i++) { var p = TERRAIN_PROFILE[parts[i]]; if (p) hits.push(p); }
    if (!hits.length) return null;
    if (hits.length === 1) return { dens: hits[0].dens, biome: hits[0].biome };
    var dens = 0; for (var j = 0; j < hits.length; j++) dens += hits[j].dens;
    return { dens: Math.round(dens / hits.length * 100) / 100, biome: hits[0].biome };
  }

  /* ── 战场环境解析(Phase4 收尾:军队所在省 → 地形标签 / 全局回合 → 天候·喂 buildBattleConfig)── */

  /* adminHierarchy(GM 优先·回退 P)·运行时形状 {side:{divisions:[{name,terrain,children,mapRegionId}]}} */
  function _ahOf(GMref) {
    var g = GMref || (typeof window !== 'undefined' && window.GM) || (typeof GM !== 'undefined' ? GM : null);
    if (g && g.adminHierarchy && typeof g.adminHierarchy === 'object' && Object.keys(g.adminHierarchy).length) return g.adminHierarchy;
    var p = (typeof window !== 'undefined' && window.P) || (typeof P !== 'undefined' ? P : null);
    if (p && p.adminHierarchy && typeof p.adminHierarchy === 'object') return p.adminHierarchy;
    return null;
  }
  /* 递归收集所有 division 节点(各方 .divisions → 每节点 .children 下钻)·扁平数组·永不崩。
   * terrain 在省级·故向下传播:子节点(府/州/县)继承最近祖先省的 terrain(军队常驻府州级·须climb到省地形)。 */
  function _collectDivisions(ah) {
    var out = [];
    if (!ah || typeof ah !== 'object') return out;
    function walk(node, inherited) {
      if (!node || typeof node !== 'object') return;
      var terr = node.terrain || inherited || '';
      if (node.name) out.push({ name: node.name, terrain: terr, mapRegionId: node.mapRegionId, id: node.id, regionId: node.regionId });
      var kids = node.children;
      if (Array.isArray(kids)) for (var i = 0; i < kids.length; i++) walk(kids[i], terr);
    }
    if (Array.isArray(ah.divisions)) ah.divisions.forEach(function (n) { walk(n, ''); });          // 顶层直接 divisions(编辑器形态兜底)
    Object.keys(ah).forEach(function (k) { var side = ah[k]; if (side && Array.isArray(side.divisions)) side.divisions.forEach(function (n) { walk(n, ''); }); });
    return out;
  }
  /* 军队所在地 → 省地形标签(读 adminHierarchy·永不崩·缺则 '')。链:regionId/mapRegionId 直配 → location/garrison/regionHint token 配 division.name(全等→双向包含)。节点已带继承 terrain(府州→省) */
  function resolveTerrainTag(GMref, army) {
    try {
      if (!army) return '';
      var divs = _collectDivisions(_ahOf(GMref)).filter(function (d) { return d && d.terrain; }); if (!divs.length) return '';
      var rid = army.regionId || army.mapRegionId || army.regionHintId;
      if (rid) { for (var i = 0; i < divs.length; i++) { var d = divs[i]; if (d.mapRegionId === rid || d.id === rid || d.regionId === rid) return d.terrain; } }
      var toks = [];
      [army.regionHint, army.location, army.garrison].forEach(function (s) { if (s) String(s).split(/[\/、,，\-－—~～·・‧至\s]+/).forEach(function (t) { t = (t || '').trim(); if (t) toks.push(t); }); });   // 含连字符/波浪/间隔号·/"至"(如"宁远-锦州"、"北直·通州"、"宁远至锦州")
      for (var a = 0; a < toks.length; a++) { for (var j = 0; j < divs.length; j++) { if (divs[j].name === toks[a]) return divs[j].terrain; } }                                   // 全等
      for (var b = 0; b < toks.length; b++) { for (var k = 0; k < divs.length; k++) { var nm = divs[k].name; if (nm && (nm.indexOf(toks[b]) >= 0 || toks[b].indexOf(nm) >= 0)) return divs[k].terrain; } }   // 双向包含
      var raw = String((army.location || '') + ' ' + (army.garrison || '') + ' ' + (army.regionHint || ''));   // 末级兜底:位置文本本身含地形词(如"福建沿海"→沿海·"陕北高原"→高原)
      var keys = Object.keys(TERRAIN_PROFILE).sort(function (x, y) { return y.length - x.length; });            // 长词优先(漠南草原 先于 草原)
      for (var q = 0; q < keys.length; q++) { if (raw.indexOf(keys[q]) >= 0) return keys[q]; }
      return '';
    } catch (e) { return ''; }
  }

  /* 中文月名 → 月序(1-12·正/腊/冬月特办) */
  function _cnMonth(s) {
    s = String(s || ''); if (!s) return 0;
    if (s === '正') return 1; if (s === '腊') return 12; if (s === '冬') return 11;
    var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    if (s === '十一' || s === '十有一') return 11;
    if (s === '十二') return 12;
    if (s.length === 2 && s.charAt(0) === '十' && map[s.charAt(1)]) return 10 + map[s.charAt(1)];
    return map[s] || 0;
  }
  /* GM → 季节(优先纪年文本月份·回退 turn 四回合周期·确定性无随机) */
  function seasonOf(GMref) {
    var g = GMref || (typeof window !== 'undefined' && window.GM) || (typeof GM !== 'undefined' ? GM : null);
    var t = g && (g.dateText || g.date || g.time || g.monthText || (g.gameTime && g.gameTime.text));
    var m = t ? String(t).match(/([正腊冬一二三四五六七八九十有]+)月/) : null;
    if (m) { var mn = _cnMonth(m[1]); if (mn >= 1) return mn <= 3 ? '春' : mn <= 6 ? '夏' : mn <= 9 ? '秋' : '冬'; }
    var turn = Number(g && g.turn) || 1;
    return ['春', '夏', '秋', '冬'][(((turn - 1) % 4) + 4) % 4] || '春';
  }
  /* 季节 → 战场天候(冬→雪·余→晴·确定性·雾留待未来)。喂 startBattle(config).weather */
  function deriveWeather(GMref) {
    try { return seasonOf(GMref) === '冬' ? 'snow' : 'clear'; } catch (e) { return 'clear'; }
  }

  var ONFIELD_CAP = 35;   // 场上≤35队/方(全场≤70·§4/§12.1)·超出入波次 reserves
  var DIVERSE_FLOOR = 2;  // 每个在场兵种至少 N 队上阵(保骑/炮/铳露面·不被步兵挤光)

  /* 场上选取:按兵种(sub)分层比例取样+保底·非「按队序取前N」(否则首支大军步兵占满·骑炮铳全沉预备队)。
   * 御营队(emperor)强制上场;每兵种按其占比分配场上名额(≥DIVERSE_FLOOR·≤该兵种队数)·余数补给最大缺口兵种;剩余入 reserves。确定性(纯排序算术·无随机)。 */
  function selectOnField(tokens, cap) {
    cap = cap || ONFIELD_CAP;
    if (tokens.length <= cap) return { field: tokens.slice(), reserve: [] };
    var forced = [], rest = [];
    tokens.forEach(function (t) { (t && t.emperor ? forced : rest).push(t); });
    var budget = Math.max(0, cap - forced.length);
    var groups = {}, order = [];
    rest.forEach(function (t) { var k = t.sub || t.type || '?'; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(t); });
    var total = rest.length || 1, want = {};
    order.forEach(function (k) { var sz = groups[k].length; want[k] = Math.min(sz, Math.max(Math.min(sz, DIVERSE_FLOOR), Math.round(budget * sz / total))); });
    var sum = order.reduce(function (s, k) { return s + want[k]; }, 0);
    var guard = 0;
    while (sum > budget && guard++ < 9999) { var k = order.filter(function (k) { return want[k] > DIVERSE_FLOOR; }).sort(function (a, b) { return want[b] - want[a]; })[0]; if (!k) { k = order.filter(function (k) { return want[k] > 0; }).sort(function (a, b) { return want[b] - want[a]; })[0]; } if (!k) break; want[k]--; sum--; }
    while (sum < budget && guard++ < 9999) { var k2 = order.filter(function (k) { return want[k] < groups[k].length; }).sort(function (a, b) { return (groups[b].length - want[b]) - (groups[a].length - want[a]); })[0]; if (!k2) break; want[k2]++; sum++; }
    var field = forced.slice(), reserve = [];
    order.forEach(function (k) { for (var i = 0; i < groups[k].length; i++) (i < want[k] ? field : reserve).push(groups[k][i]); });
    return { field: field, reserve: reserve };
  }

  /* 主入口:交战双方 army 群 → startBattle(config)。
   * playerArmies/enemyArmies = 该接触节点上 同/敌 faction 在场全部军(联军合流)。
   * opts:{ provinceName, terrainTag, weather, playerFactionName, enemyFactionName, emperorArmyId, GM } */
  function buildBattleConfig(playerArmies, enemyArmies, opts) {
    opts = opts || {};
    var G = opts.GM || (typeof window !== 'undefined' && window.GM) || (typeof GM !== 'undefined' ? GM : null);
    var p0 = (playerArmies && playerArmies[0]) || null;
    var provinceName = opts.provinceName != null ? opts.provinceName : ((p0 && (p0.location || p0.garrison)) || '');
    var terrainTag = opts.terrainTag != null ? opts.terrainTag : resolveTerrainTag(G, p0);   // 未显式给→由玩家主军所在省解析(§8)
    var weather = opts.weather || deriveWeather(G);                                          // 未显式给→由季节推导(冬→雪)
    var ming = sideTokens(playerArmies, G, opts.emperorArmyId);
    var jin = sideTokens(enemyArmies, G, null);
    var enemyLead = (enemyArmies && enemyArmies[0] && enemyArmies[0].commander) || '敌帅';
    var mSel = selectOnField(ming, ONFIELD_CAP), jSel = selectOnField(jin, ONFIELD_CAP);   // 兵种分层取样(非按队序截断)
    return {
      mapSeed: provinceSeed(provinceName),
      terrainProfile: terrainProfile(terrainTag),
      weather: weather,
      sideName: { ming: opts.playerFactionName || '我军', jin: opts.enemyFactionName || '敌军' },
      lead: enemyLead,
      emperorSide: 'ming',
      armies: { ming: mSel.field, jin: jSel.field },
      reserves: { ming: mSel.reserve, jin: jSel.reserve },   // 溢出波次(接 proto reinf)
      meta: { provinceName: provinceName || '', terrainTag: terrainTag || '', weather: weather, onFieldCap: ONFIELD_CAP, mingTotal: ming.length, jinTotal: jin.length }
    };
  }

  var API = {
    buildBattleConfig: buildBattleConfig, sideTokens: sideTokens, unitToToken: unitToToken, selectOnField: selectOnField, degradeQualityByEquip: degradeQualityByEquip,
    genFor: genFor, qualityFromVet: qualityFromVet, provinceSeed: provinceSeed, terrainProfile: terrainProfile,
    resolveTerrainTag: resolveTerrainTag, deriveWeather: deriveWeather, seasonOf: seasonOf,
    ONFIELD_CAP: ONFIELD_CAP
  };
  if (typeof window !== 'undefined') window.TMBattleAdapter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
