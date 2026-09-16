// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-indices.js — 索引 & WorldHelper (R123 从 tm-index-world.js L1-863 拆出)
// 姊妹: tm-world.js (L864-end·特质/AI 上下文/奏疏/官制/编年)
// Requires: tm-data-model.js (P, GM),
//           tm-utils.js (_dbg, uid, callAI, callAISmart, escHtml, getTS, deepClone)
// ============================================================

/** 构建所有 Map 索引（角色/势力/党派/阶层等按名字快查） */
// ============================================================
//  tm-index-world.js — 索引与查询系统（8,820 行）
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（2026-04-24 R78 实测）
// ══════════════════════════════════════════════════════════════
//
//  ┌─ §A 索引系统（L8-258） ─────────────────────────┐
//  │  L8   buildIndices()              建立所有 O(1) 索引 Map
//  │        charByName / facByName / partyByName / classByName /
//  │        techByName / armyByName / postById / postByTerritory /
//  │        unitById / supplyDepotById / buildingById /
//  │        officeByName / officeByHolder / divisionByName
//  │  L258 addScenarioToIndex()        新增剧本到 P._indices
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B 查询入口（L278-352）事实上的 DAL 内核 ──────┐
//  │  L278 findCharByName()            含 O(1) + 线性兜底 +
//  │                                   字/号/乳名/别名/曾用名 匹配
//  │  L316 findFacByName()
//  │  L323 findPartyByName()
//  │  L330 findClassByName()
//  │  L352 findScenarioById()
//  │  （findDivisionByName 也在此文件）
//  │  → DA.chars/factions/parties 委托给这些函数
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C 行政区划 & 官制面板（L500-8000+） ────────────┐
//  │  庞大的 tab 渲染逻辑·大部分位于此文件
//  │  包含：地方 tab / 官制 tab 中间栏 / 国事汇总
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口
// ══════════════════════════════════════════════════════════════
//
//  GM._indices                        所有索引 Map（Chrome devtools 展开）
//  buildIndices()                     手动重建（新加角色后必要）
//  findCharByName('袁崇焕')            等价 DA.chars.findByName
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 架构注意事项
// ══════════════════════════════════════════════════════════════
//
//  1. 新增角色时必须调 buildIndices() 或在 GM._indices.charByName
//     手动 set(name, char)，否则 findCharByName 走线性扫描（变慢）
//  2. 新代码优先用 DA.chars.findByName，不要直接 findCharByName
//     （DA 未来改内部时调用方不用动）
//  3. officeTree 相关索引（officeByName/officeByHolder）在官制变动时
//     需要 rebuild：detectOfficeChange → buildIndices
//
// ══════════════════════════════════════════════════════════════

function _tmCleanCharLookupName(name) {
  if (name == null) return '';
  return String(name).replace(/\s+/g, ' ').trim();
}

function _tmCleanCharAliasKey(name) {
  return _tmCleanCharLookupName(name).replace(/[\s·・\-—_，,。.;；:：'"“”‘’（）()【】\[\]《》<>]/g, '');
}

function _tmAddCharAlias(out, value) {
  var s = _tmCleanCharLookupName(value);
  if (!s || s.length > 24) return;
  out[s] = true;
  var parts = s.split(/[\s·・\-—_，,。.;；:：'"“”‘’（）()【】\[\]《》<>]+/);
  parts.forEach(function(p) {
    p = _tmCleanCharLookupName(p);
    if (p && (p.length >= 2 || p === '朕') && p.length <= 12) out[p] = true;
  });
}

function _tmWalkOfficeChildren(nodes, visitor) {
  for (var i = 0; i < (nodes || []).length; i++) {
    var node = nodes[i];
    if (!node) continue;
    if (visitor(node) === false) return;
    if (node.children) _tmWalkOfficeChildren(node.children, visitor);
  }
}

function _tmFindPlayerCharRaw() {
  var G = (typeof GM !== 'undefined' && GM) ? GM : null;
  if (!G || !Array.isArray(G.chars)) return null;
  var runtimeInfo = G.playerInfo && typeof G.playerInfo === 'object' ? G.playerInfo : null;
  var pId = runtimeInfo && runtimeInfo.characterId != null ? String(runtimeInfo.characterId).trim() : '';
  if (pId) {
    for (var i = 0; i < G.chars.length; i++) {
      var c = G.chars[i];
      if (c && c.id != null && String(c.id).trim() === pId) return c;
    }
    return null;
  }
  var pName = _tmCleanCharLookupName(runtimeInfo && runtimeInfo.characterName || '');
  if (pName) {
    var runtimeNamed = G.chars.filter(function(row) { return row && row.name === pName; });
    return runtimeNamed.length === 1 ? runtimeNamed[0] : null;
  }
  var flagged = G.chars.filter(function(row) { return row && row.isPlayer === true; });
  if (flagged.length === 1) return flagged[0];
  // 只在尚未建立运行态 playerInfo/玩家标记的新局初始化阶段读取 P 模板。
  if (!runtimeInfo && flagged.length === 0) {
    var templateInfo = (typeof P !== 'undefined' && P && P.playerInfo) ? P.playerInfo : {};
    var templateName = _tmCleanCharLookupName(templateInfo.characterName || '');
    for (var k = 0; templateName && k < G.chars.length; k++) {
      var byTemplateName = G.chars[k];
      if (byTemplateName && byTemplateName.name === templateName) return byTemplateName;
    }
  }
  return flagged[0] || null;
}

function getRuntimePlayerInfo() {
  if (typeof TM !== 'undefined' && TM.NativeWorld && typeof GM !== 'undefined' && TM.NativeWorld.enabled(GM)) {
    var nativeInfo = TM.NativeWorld.info(GM);
    return Object.assign({}, GM.playerInfo, {characterId:nativeInfo.character.id,characterName:nativeInfo.character.name,
      factionId:nativeInfo.faction.id,factionName:nativeInfo.faction.name,characterTitle:nativeInfo.character.title || nativeInfo.character.officialTitle || ''});
  }
  if (typeof GM !== 'undefined' && GM && GM.playerInfo && typeof GM.playerInfo === 'object') return GM.playerInfo;
  if (typeof P !== 'undefined' && P && P.playerInfo && typeof P.playerInfo === 'object') return P.playerInfo;
  return {};
}

function _tmGetCurrentScenarioRaw() {
  try {
    if (typeof P !== 'undefined' && P && Array.isArray(P.scenarios) && typeof GM !== 'undefined' && GM) {
      for (var i = 0; i < P.scenarios.length; i++) {
        if (P.scenarios[i] && P.scenarios[i].id === GM.sid) return P.scenarios[i];
      }
    }
  } catch(_) {}
  return null;
}

// 索引是派生缓存；回滚/换局只能通过索引模块统一失效，调用方不得跨模块直删。
function invalidateGameIndices(gmRef, pRef) {
  var G = gmRef || (typeof GM !== 'undefined' ? GM : null);
  // 第二参数显式传 null 表示只失效运行态索引；这对继承/回滚很重要，
  // 否则会在运行期删除剧本模板 P._indices。
  var scenarioState = arguments.length > 1 ? pRef : (typeof P !== 'undefined' ? P : null);
  if (G) { try { delete G._indices; } catch (_) {} }
  if (scenarioState) { try { delete scenarioState._indices; } catch (_) {} }
}

(function(global) {
  var TM = global.TM = global.TM || {};
  TM.Indices = TM.Indices || {};
  TM.Indices.invalidate = invalidateGameIndices;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

// 建筑双账只读兼容层：旧账 GM.buildings 仍服务老经济结算；新账 division.buildings[] 是现行营造主链。
// 展示/AI 上下文读取时合并两者，避免新建筑在旧面板里“隐身”；不把新账喂给旧建筑产出公式，防止重复收益。
function _tmAdminBuildingSources() {
  var srcs = [];
  function add(ah) {
    if (!ah || typeof ah !== 'object' || !Object.keys(ah).length) return;
    if (srcs.indexOf(ah) >= 0) return;
    srcs.push(ah);
  }
  try { if (typeof P !== 'undefined' && P) add(P.adminHierarchy); } catch (_) {}
  try { if (typeof GM !== 'undefined' && GM) add(GM.adminHierarchy); } catch (_) {}
  return srcs;
}

function _tmWalkAdminBuildings(visitor) {
  var seenDivs = [];
  function walkNode(node) {
    if (!node || typeof node !== 'object') return;
    if (seenDivs.indexOf(node) >= 0) return;
    seenDivs.push(node);
    if ((node.name || node.id) && Array.isArray(node.buildings) && node.buildings.length) visitor(node);
    ['divisions', 'children', 'subDivisions', 'subs'].forEach(function (k) {
      var list = node[k];
      if (Array.isArray(list)) list.forEach(walkNode);
    });
  }
  _tmAdminBuildingSources().forEach(function (ah) {
    if (Array.isArray(ah)) ah.forEach(walkNode);
    else if (ah && (ah.name || ah.id || ah.divisions || ah.children || ah.subDivisions || ah.subs)) walkNode(ah);
    else Object.keys(ah).forEach(function (k) { walkNode(ah[k]); });
  });
}

function _tmBuildingKey(b) {
  if (!b) return '';
  return String(b.territory || b._territory || '') + '|' + String(b.type || b.name || '');
}

function _tmCloneDivisionBuilding(b, div) {
  var out = {};
  Object.keys(b || {}).forEach(function (k) { out[k] = b[k]; });
  out.territory = out.territory || (div && div.name) || '';
  out._divisionBuilding = true;
  return out;
}

function getAllBuildingsCompat() {
  var out = [];
  var seen = {};
  try {
    if (typeof GM !== 'undefined' && GM && Array.isArray(GM.buildings)) {
      GM.buildings.forEach(function (b) {
        if (!b) return;
        // 影子过滤(2026-07-04)：历史 AI 落建造反查失败铸的「未知建筑」死条目(无描述/无 status/无效果)
        // 不入合并清单——它会按 territory|type 键位把新账真记录挤出(营造志曾因此全显「未知建筑·完好」)。
        // 读档处已一次性清存量·此处兜底拦当场新铸/未过读档的。
        if (b.name === '未知建筑' && !(typeof BUILDING_TYPES !== 'undefined' && BUILDING_TYPES[b.type])) return;
        out.push(b);
        seen[_tmBuildingKey(b)] = true;
        if (b.name) seen[String(b.territory || '') + '|' + String(b.name)] = true;
      });
    }
  } catch (_) {}
  _tmWalkAdminBuildings(function (div) {
    (div.buildings || []).forEach(function (b) {
      if (!b) return;
      var view = _tmCloneDivisionBuilding(b, div);
      var k = _tmBuildingKey(view);
      if (seen[k]) return;
      seen[k] = true;
      if (view.name) seen[String(view.territory || '') + '|' + String(view.name)] = true;
      out.push(view);
    });
  });
  return out;
}

function getTerritoryBuildingsCompat(territory) {
  var t = String(territory || '');
  return getAllBuildingsCompat().filter(function (b) { return b && String(b.territory || '') === t; });
}

function _tmPlayerCharAliases() {
  var out = {};
  var ch = _tmFindPlayerCharRaw();
  var pInfo = getRuntimePlayerInfo();
  if (ch) {
    ['name','zi','haoName','milkName','title','officialTitle','role','occupation'].forEach(function(k) {
      _tmAddCharAlias(out, ch[k]);
    });
    ['aliases','formerNames','_aliases'].forEach(function(k) {
      if (Array.isArray(ch[k])) ch[k].forEach(function(v) { _tmAddCharAlias(out, v); });
    });
  }
  ['characterName','characterTitle','factionLeader','factionLeaderTitle'].forEach(function(k) {
    _tmAddCharAlias(out, pInfo[k]);
  });

  var sc = _tmGetCurrentScenarioRaw();
  if (sc) {
    ['emperor','ruler','monarch','king','leader'].forEach(function(k) {
      var v = sc[k];
      if (!v) return;
      if (!ch || String(v).indexOf(ch.name || '') >= 0 || String(v).indexOf(pInfo.characterName || '') >= 0) _tmAddCharAlias(out, v);
    });
  }

  if (typeof GM !== 'undefined' && GM) {
    _tmAddCharAlias(out, GM.eraName);
    if (Array.isArray(GM.eraNames) && GM.eraNames.length) _tmAddCharAlias(out, GM.eraNames[GM.eraNames.length - 1].name);
  }
  if (typeof P !== 'undefined' && P && P.time) _tmAddCharAlias(out, P.time.reign);

  [
    '皇帝','天子','君上','陛下','圣上','皇上','主上','君父','朕','今上','至尊','万岁','万岁爷',
    '大王','王上','国主','主公','君主','可汗','大汗','汗王','单于','天可汗'
  ].forEach(function(v) { _tmAddCharAlias(out, v); });

  return Object.keys(out);
}

function canonicalizeCharName(name) {
  var raw = _tmCleanCharLookupName(name);
  if (!raw) return raw;
  var G = (typeof GM !== 'undefined' && GM) ? GM : null;
  if (!G || !Array.isArray(G.chars)) return raw;

  for (var i = 0; i < G.chars.length; i++) {
    var c = G.chars[i];
    if (c && c.name === raw) return c.name;
  }

  for (var j = 0; j < G.chars.length; j++) {
    var ch = G.chars[j];
    if (!ch || !ch.name) continue;
    if (ch.zi === raw || ch.haoName === raw || ch.milkName === raw) return ch.name;
    if (Array.isArray(ch.aliases) && ch.aliases.indexOf(raw) >= 0) return ch.name;
    if (Array.isArray(ch.formerNames) && ch.formerNames.indexOf(raw) >= 0) return ch.name;
    if (Array.isArray(ch._aliases) && ch._aliases.indexOf(raw) >= 0) return ch.name;
  }

  var player = _tmFindPlayerCharRaw();
  if (!player || !player.name) return raw;
  var rawKey = _tmCleanCharAliasKey(raw);
  var aliases = _tmPlayerCharAliases();
  for (var k = 0; k < aliases.length; k++) {
    if (aliases[k] === raw || _tmCleanCharAliasKey(aliases[k]) === rawKey) return player.name;
  }
  return raw;
}

function _tmMergeArrayUnique(base, extra, limit) {
  var out = Array.isArray(base) ? base.slice() : [];
  (Array.isArray(extra) ? extra : []).forEach(function(v) {
    if (out.indexOf(v) < 0) out.push(v);
  });
  return limit ? out.slice(-limit) : out;
}

function _tmMergeCharLedgerValue(dst, src) {
  if (dst == null) return src;
  if (src == null) return dst;
  if (Array.isArray(dst) || Array.isArray(src)) return _tmMergeArrayUnique(dst, src, 80);
  if (typeof dst === 'object' && typeof src === 'object') {
    Object.keys(src).forEach(function(k) {
      if (dst[k] == null) dst[k] = src[k];
      else if (Array.isArray(dst[k]) || Array.isArray(src[k])) dst[k] = _tmMergeArrayUnique(dst[k], src[k], 80);
      else if (typeof dst[k] === 'number' && typeof src[k] === 'number' && (k === 'favor' || k === 'strength')) {
        dst[k] = Math.max(-100, Math.min(100, dst[k] + src[k]));
      }
    });
    return dst;
  }
  return dst;
}

function _tmMergeObjectAliasKey(obj, alias, canonical) {
  if (!obj || !alias || !canonical || alias === canonical || obj[alias] == null) return;
  obj[canonical] = _tmMergeCharLedgerValue(obj[canonical], obj[alias]);
  delete obj[alias];
}

function _tmCanonicalizeNameArray(list, aliasMap, canonical) {
  if (!Array.isArray(list)) return list;
  var out = [];
  list.forEach(function(v) {
    var n = _tmCleanCharLookupName(v);
    if (aliasMap[n]) n = canonical;
    if (n && out.indexOf(n) < 0) out.push(n);
  });
  return out;
}

function normalizePlayerCharacterNameLedgers() {
  var G = (typeof GM !== 'undefined' && GM) ? GM : null;
  if (!G || !Array.isArray(G.chars)) return;
  var player = _tmFindPlayerCharRaw();
  if (!player || !player.name) return;
  var aliases = _tmPlayerCharAliases().filter(function(n) { return n && n !== player.name; });
  if (!aliases.length) return;
  var sig = player.name + '|' + aliases.slice().sort().join('|') + '|T' + (G.turn || 0);
  if (G._playerAliasLedgerNormalizeSig === sig) return;
  G._playerAliasLedgerNormalizeSig = sig;

  var aliasMap = {};
  aliases.forEach(function(a) { aliasMap[a] = true; });

  if (G.affinityMap && typeof G.affinityMap === 'object') {
    Object.keys(G.affinityMap).forEach(function(key) {
      var parts = key.split('|');
      if (parts.length !== 2) return;
      var a = aliasMap[parts[0]] ? player.name : parts[0];
      var b = aliasMap[parts[1]] ? player.name : parts[1];
      if (a === b) { delete G.affinityMap[key]; return; }
      var nextKey = [a, b].sort().join('|');
      if (nextKey === key) return;
      G.affinityMap[nextKey] = Math.max(-100, Math.min(100, Number(G.affinityMap[nextKey] || 0) + Number(G.affinityMap[key] || 0)));
      delete G.affinityMap[key];
    });
  }

  G.chars.forEach(function(ch) {
    if (!ch) return;
    aliases.forEach(function(a) {
      _tmMergeObjectAliasKey(ch.relations, a, player.name);
      _tmMergeObjectAliasKey(ch._relationships, a, player.name);
      _tmMergeObjectAliasKey(ch._impressions, a, player.name);
      _tmMergeObjectAliasKey(ch._relationHistory, a, player.name);
    });
    ['_memory','_memArchive','_scars'].forEach(function(k) {
      if (!Array.isArray(ch[k])) return;
      ch[k].forEach(function(m) {
        if (!m || typeof m !== 'object') return;
        if (aliasMap[m.who]) m.who = player.name;
        if (aliasMap[m.char]) m.char = player.name;
        if (Array.isArray(m.participants)) m.participants = _tmCanonicalizeNameArray(m.participants, aliasMap, player.name);
        if (Array.isArray(m.witnesses)) m.witnesses = _tmCanonicalizeNameArray(m.witnesses, aliasMap, player.name);
      });
    });
  });

  if (Array.isArray(G._memoryArchiveFull)) {
    G._memoryArchiveFull.forEach(function(m) {
      if (!m || typeof m !== 'object') return;
      if (aliasMap[m.char]) m.char = player.name;
      if (aliasMap[m.who]) m.who = player.name;
      if (Array.isArray(m.participants)) m.participants = _tmCanonicalizeNameArray(m.participants, aliasMap, player.name);
      if (Array.isArray(m.witnesses)) m.witnesses = _tmCanonicalizeNameArray(m.witnesses, aliasMap, player.name);
    });
  }
}

if (typeof window !== 'undefined') {
  window.canonicalizeCharName = canonicalizeCharName;
  window.normalizePlayerCharacterNameLedgers = normalizePlayerCharacterNameLedgers;
}

function buildIndices(options) {
  options = options || {};
  // 初始化索引对象
  if (!GM._indices) {
    GM._indices = {};
  }

  // 初始化监听系统
  initDataListeners();

  // 1. 角色索引（按名字 + 稳定 ID）
  GM._indices.charByName = new Map();
  GM._indices.charById = new Map();
  if (GM.chars && GM.chars.length > 0) {
    GM.chars.forEach(function(char) {
      if (char && char.name) {
        GM._indices.charByName.set(char.name, char);
      }
      if (char && char.id !== undefined && char.id !== null && String(char.id).trim()) {
        GM._indices.charById.set(String(char.id).trim(), char);
      }
    });
  }

  // 运行态玩家身份归一：GM.playerInfo.characterId 为权威，isPlayer 只保留唯一镜像。
  var _runtimePlayerIdentity = _tmFindPlayerCharRaw();
  if (_runtimePlayerIdentity) {
    GM.chars.forEach(function(char) { if (char) char.isPlayer = char === _runtimePlayerIdentity; });
    GM.playerInfo = Object.assign({}, (GM.playerInfo && typeof GM.playerInfo === 'object' ? GM.playerInfo : {}), {
      characterId: _runtimePlayerIdentity.id != null ? String(_runtimePlayerIdentity.id) : '',
      characterName: _runtimePlayerIdentity.name || '',
      characterTitle: _runtimePlayerIdentity.title || _runtimePlayerIdentity.officialTitle || '',
      factionId: _runtimePlayerIdentity.factionId || '',
      factionName: _runtimePlayerIdentity.faction || ''
    });
  }

  // 2. 势力索引（按名字）
  GM._indices.facByName = new Map();
  try {
    var _playerCharForAliases = _tmFindPlayerCharRaw();
    if (_playerCharForAliases && _playerCharForAliases.name) {
      _tmPlayerCharAliases().forEach(function(alias) {
        if (alias) GM._indices.charByName.set(alias, _playerCharForAliases);
      });
    }
    normalizePlayerCharacterNameLedgers();
  } catch(e) { try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'char-alias-index');}catch(_){} }

  if (GM.facs && GM.facs.length > 0) {
    GM.facs.forEach(function(fac) {
      if (fac && fac.name) {
        GM._indices.facByName.set(fac.name, fac);
      }
    });
  }

  // 3. 党派索引（按名字）
  GM._indices.partyByName = new Map();
  if (GM.parties && GM.parties.length > 0) {
    GM.parties.forEach(function(party) {
      if (party && party.name) {
        GM._indices.partyByName.set(party.name, party);
      }
    });
  }

  // 4. 阶层索引（按名字）
  GM._indices.classByName = new Map();
  if (GM.classes && GM.classes.length > 0) {
    GM.classes.forEach(function(cls) {
      if (cls && cls.name) {
        GM._indices.classByName.set(cls.name, cls);
      }
    });
  }


  // 6. 科技索引（按名字）
  GM._indices.techByName = new Map();
  if (GM.techTree && GM.techTree.length > 0) {
    GM.techTree.forEach(function(tech) {
      if (tech && tech.name) {
        GM._indices.techByName.set(tech.name, tech);
      }
    });
  }

  // 7. 军队索引（按名字）
  GM._indices.armyByName = new Map();
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      if (army && army.name) {
        GM._indices.armyByName.set(army.name, army);
      }
    });
  }

  // 8. 场景索引（按 ID）- 全局 P 对象。运行态身份切换可明确跳过，避免改写模板缓存。
  if (!options.skipScenarioIndex) {
    if (!P._indices) {
      P._indices = {};
    }
    P._indices.scenarioById = new Map();
    if (P.scenarios && P.scenarios.length > 0) {
      P.scenarios.forEach(function(sc) {
        if (sc && sc.id) {
          P._indices.scenarioById.set(sc.id, sc);
        }
      });
    }
  }

  // 9. 岗位索引（按 ID 和领地 ID）
  if (GM.postSystem && GM.postSystem.enabled) {
    GM._indices.postById = new Map();
    GM._indices.postByTerritory = new Map();

    if (GM.postSystem.posts && GM.postSystem.posts.length > 0) {
      GM.postSystem.posts.forEach(function(post) {
        if (post && post.id) {
          GM._indices.postById.set(post.id, post);

          if (post.territoryId) {
            if (!GM._indices.postByTerritory.has(post.territoryId)) {
              GM._indices.postByTerritory.set(post.territoryId, []);
            }
            GM._indices.postByTerritory.get(post.territoryId).push(post);
          }
        }
      });
    }
  }

  // 10. Unit 索引（按 ID）
  if (P.unitSystem && P.unitSystem.enabled) {
    GM._indices.unitById = new Map();
    if (GM.units && GM.units.length > 0) {
      GM.units.forEach(function(unit) {
        if (unit && unit.id) {
          GM._indices.unitById.set(unit.id, unit);
        }
      });
    }
  }

  // 11. 补给仓库索引（按 ID）
  if (P.supplySystem && P.supplySystem.enabled) {
    GM._indices.supplyDepotById = new Map();
    if (GM.supplyDepots && GM.supplyDepots.length > 0) {
      GM.supplyDepots.forEach(function(depot) {
        if (depot && depot.id) {
          GM._indices.supplyDepotById.set(depot.id, depot);
        }
      });
    }
  }

  // 12. 建筑索引（按 ID 和领地）
  GM._indices.buildingById = new Map();
  GM._indices.buildingByTerritory = new Map();
  if (GM.buildings && GM.buildings.length > 0) {
    GM.buildings.forEach(function(b) {
      if (b && b.id) {
        GM._indices.buildingById.set(b.id, b);
        if (b.territory) {
          if (!GM._indices.buildingByTerritory.has(b.territory)) {
            GM._indices.buildingByTerritory.set(b.territory, []);
          }
          GM._indices.buildingByTerritory.get(b.territory).push(b);
        }
      }
    });
  }

  // 13. 官职索引（按职位名）——walk officeTree·替代反复 walk 查询
  GM._indices.officeByName = new Map();
  GM._indices.officeByHolder = new Map();
  if (GM.officeTree && GM.officeTree.length > 0) {
    (function _walk(nodes, path) {
      (nodes || []).forEach(function(n) {
        if (!n) return;
        var _dept = (path ? path + '/' : '') + (n.name || '');
        (n.positions || []).forEach(function(p) {
          if (!p || !p.name) return;
          // 若同名职位多处·保留首个·附加 dept 字段便于区分
          if (!GM._indices.officeByName.has(p.name)) GM._indices.officeByName.set(p.name, { pos: p, dept: _dept, node: n });
          if (p.holder && p.holder !== '\u7A7A' && p.holder !== '') GM._indices.officeByHolder.set(p.holder, { pos: p, dept: _dept, node: n });
        });
        if (n.subs) _walk(n.subs, _dept);
      });
    })(GM.officeTree, '');
  }

  // 14. 行政区划索引（按名字/ID）——扁平化 adminHierarchy 树（支持对象根+数组根）
  GM._indices.divisionByName = new Map();
  if (GM.adminHierarchy) {
    var _divFlat = function(n) {
      if (!n) return;
      if (n.name) GM._indices.divisionByName.set(n.name, n);
      if (n.id && !GM._indices.divisionByName.has(n.id)) GM._indices.divisionByName.set(n.id, n);
      var _kids = n.children || n.subs || [];
      if (Array.isArray(_kids)) _kids.forEach(_divFlat);
    };
    if (Array.isArray(GM.adminHierarchy)) GM.adminHierarchy.forEach(_divFlat);
    else _divFlat(GM.adminHierarchy);
  }
}

// initAchievements 在 tm-dynamic-systems.js 中定义，此处不能直接调用（尚未加载）
// 改为在 startGame() 中调用

// ============================================================
//  索引维护函数（动态添加/删除/更新数据时使用）
// ============================================================

// 添加到索引
function addToIndex(type, key, value) {
  if (!GM._indices) {
    GM._indices = {};
  }

  var indexMap = {
    'char': 'charByName',
    'fac': 'facByName',
    'party': 'partyByName',
    'class': 'classByName',
    'tech': 'techByName',
    'army': 'armyByName',
    'post': 'postById',
    'unit': 'unitById',
    'building': 'buildingById',
    'supplyDepot': 'supplyDepotById'
  };

  var indexName = indexMap[type];
  if (!indexName) return;

  if (!GM._indices[indexName]) {
    GM._indices[indexName] = new Map();
  }

  GM._indices[indexName].set(key, value);
}

// 从索引中删除
function removeFromIndex(type, key) {
  if (!GM._indices) return;

  var indexMap = {
    'char': 'charByName',
    'fac': 'facByName',
    'party': 'partyByName',
    'class': 'classByName',
    'tech': 'techByName',
    'army': 'armyByName',
    'post': 'postById',
    'unit': 'unitById',
    'building': 'buildingById',
    'supplyDepot': 'supplyDepotById'
  };

  var indexName = indexMap[type];
  if (!indexName || !GM._indices[indexName]) return;

  GM._indices[indexName].delete(key);
}

// 场景索引维护（全局 P 对象）
function addScenarioToIndex(id, scenario) {
  if (!P._indices) {
    P._indices = {};
  }
  if (!P._indices.scenarioById) {
    P._indices.scenarioById = new Map();
  }
  P._indices.scenarioById.set(id, scenario);
}

function removeScenarioFromIndex(id) {
  if (!P._indices || !P._indices.scenarioById) return;
  P._indices.scenarioById.delete(id);
}

// 快速查询函数（O(1) 复杂度）
/** @param {string} name @returns {Object|undefined} 角色对象 */
function findCharByName(name) {
  if (typeof TM !== 'undefined' && TM.NativeWorld && typeof GM !== 'undefined' && TM.NativeWorld.enabled(GM)) return TM.NativeWorld.resolveCharacter(GM,name);
  if (!name) return undefined;
  if (!GM._indices || !GM._indices.charByName || typeof GM._indices.charByName.get !== 'function') {
    buildIndices();
  }
  var rawName = _tmCleanCharLookupName(name);
  // 索引优先·O(1):rawName 为精确名或已注册别名(含玩家别名/前次缓存)时直接命中·跳过热路径上每次必跑的 O(n)~O(4n) canonicalizeCharName
  // (findCharByName 全库 553 处调用·过回合 apply 内每条 AI 变更反复解析名)·miss 才回退规范化·保 字/号/乳名/曾用名/玩家别名 解析正确
  var fast = rawName ? GM._indices.charByName.get(rawName) : null;
  if (fast) return fast;
  var canonName = canonicalizeCharName(rawName);
  name = canonName || rawName;
  var hit = GM._indices.charByName.get(name);
  if (hit && rawName && rawName !== name) {
    try { GM._indices.charByName.set(rawName, hit); } catch(_) {}
  }
  if (hit) return hit;
  // Fallback·线性扫 GM.chars·捕获未注册到索引的新生成角色(多站点 push 漏 index.set)
  // 命中后顺手 patch 索引·下次直接 O(1)
  if (Array.isArray(GM.chars)) {
    for (var i = 0; i < GM.chars.length; i++) {
      var c = GM.chars[i];
      if (!c) continue;
      if (c.name === name) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        if (rawName && rawName !== name) try { GM._indices.charByName.set(rawName, c); } catch(_){}
        return c;
      }
      // 别名/字/号/乳名/曾用名兜底匹配
      if (c.zi === name || c.haoName === name || c.milkName === name) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        if (rawName && rawName !== name) try { GM._indices.charByName.set(rawName, c); } catch(_){}
        return c;
      }
      if (Array.isArray(c.aliases) && c.aliases.indexOf(name) >= 0) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        if (rawName && rawName !== name) try { GM._indices.charByName.set(rawName, c); } catch(_){}
        return c;
      }
      if (Array.isArray(c.formerNames) && c.formerNames.indexOf(name) >= 0) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        if (rawName && rawName !== name) try { GM._indices.charByName.set(rawName, c); } catch(_){}
        return c;
      }
    }
  }
  return undefined;
}

/** @param {string|number} id @returns {Object|undefined} 按稳定 ID 查询角色，绝不按姓名回退。 */
function findCharById(id) {
  if (id === undefined || id === null || !String(id).trim()) return undefined;
  if (!GM._indices || !GM._indices.charById || typeof GM._indices.charById.get !== 'function') buildIndices();
  var key = String(id).trim();
  var hit = GM._indices.charById.get(key);
  if (hit) return hit;
  if (!Array.isArray(GM.chars)) return undefined;
  for (var i = 0; i < GM.chars.length; i++) {
    var ch = GM.chars[i];
    if (ch && ch.id !== undefined && ch.id !== null && String(ch.id).trim() === key) {
      GM._indices.charById.set(key, ch);
      return ch;
    }
  }
  return undefined;
}

/** @param {string} name @returns {Object|undefined} 势力对象 */
function findFacByName(name) {
  if (!GM._indices || !GM._indices.facByName || typeof GM._indices.facByName.get !== 'function') {
    buildIndices();
  }
  return GM._indices.facByName.get(name);
}

function findPartyByName(name) {
  if (!GM._indices || !GM._indices.partyByName || typeof GM._indices.partyByName.get !== 'function') {
    buildIndices();
  }
  return GM._indices.partyByName.get(name);
}

function findClassByName(name) {
  if (!GM._indices || !GM._indices.classByName || typeof GM._indices.classByName.get !== 'function') {
    buildIndices();
  }
  return GM._indices.classByName.get(name);
}

function findTechByName(name) {
  if (!GM._indices || !GM._indices.techByName || typeof GM._indices.techByName.get !== 'function') {
    buildIndices();
  }
  return GM._indices.techByName.get(name);
}

function findArmyByName(name) {
  if (!GM._indices || !GM._indices.armyByName || typeof GM._indices.armyByName.get !== 'function') {
    buildIndices();
  }
  return GM._indices.armyByName.get(name);
}

/** @param {string} sid @returns {Object|undefined} 剧本对象 */
function findScenarioById(id) {
  if (!P._indices || !P._indices.scenarioById) {
    buildIndices();
  }
  // 防御性检查：确保 scenarioById 是 Map 对象
  if (!(P._indices.scenarioById instanceof Map)) {
    console.warn('[findScenarioById] scenarioById 不是 Map，重建索引');
    buildIndices();
  }
  // 自愈（2026-07-11 治「新建空卷→立刻打开→找不到剧本」）：P.scenarios 有十余处直接 push/splice
  // （confirmNewScn/桌面导入/工坊发布…），数组动了索引不知道。命中先验真（防 splice 删除后的
  // 幽灵条目），未命中兜底扫数组并回填索引；剧本数量级小（个位~几十），线性扫无感。
  var map = P._indices.scenarioById;
  var list = Array.isArray(P.scenarios) ? P.scenarios : [];
  var hit = map.get(id);
  if (hit && list.indexOf(hit) >= 0) return hit;
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) { map.set(id, list[i]); return list[i]; }
  }
  if (hit) map.delete(id);
  return undefined;
}

// ============================================================
// WorldHelper - 统一数据查询接口
// ============================================================

/**
 * WorldHelper 数据查询系统
 * 借鉴 KingOfIreland 的 WorldHelper 设计，提供统一的数据访问接口
 *
 * 核心特性：
 * 1. 统一查询接口（getById, getByName, getAll）
 * 2. 链式查询支持（filter, map, reduce）
 * 3. 关系查询（getVassals, getLiege, getSubordinates）
 * 4. 查询缓存机制
 * 5. 数据统计函数（count, sum, avg）
 */

var WorldHelper = {
  // 查询缓存
  _queryCache: {},
  _cacheEnabled: true,
  _cacheTTL: 1000, // 缓存有效期（毫秒）

  // 清空缓存
  clearCache: function() {
    this._queryCache = {};
  },

  // 获取缓存键
  _getCacheKey: function(type, method, args) {
    return type + '.' + method + '.' + JSON.stringify(args);
  },

  // 从缓存获取
  _getFromCache: function(key) {
    if (!this._cacheEnabled) return null;
    var cached = this._queryCache[key];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this._cacheTTL) {
      delete this._queryCache[key];
      return null;
    }
    return cached.data;
  },

  // 存入缓存
  _setCache: function(key, data) {
    if (!this._cacheEnabled) return;
    this._queryCache[key] = {
      data: data,
      timestamp: Date.now()
    };
  },

  // 获取所有实体（通用）
  getAll: function(type) {
    var cacheKey = this._getCacheKey(type, 'getAll', []);
    var cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    var result = [];
    switch(type) {
      case 'character':
        result = GM.chars || [];
        break;
      case 'faction':
        result = GM.facs || [];
        break;
      case 'party':
        result = GM.parties || [];
        break;
      case 'class':
        result = GM.classes || [];
        break;
      case 'army':
        result = GM.armies || [];
        break;
      case 'tech':
        result = GM.techTree || [];
        break;
      case 'civic':
        result = GM.civicTree || [];
        break;
      case 'post':
        result = GM.posts || [];
        break;
      case 'scenario':
        result = P.scenarios || [];
        break;
      case 'region':
        result = (P.map && P.map.regions) || [];
        break;
      default:
        result = [];
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 按名字查询（单个）
  getByName: function(type, name) {
    if (!name) return null;

    var cacheKey = this._getCacheKey(type, 'getByName', [name]);
    var cached = this._getFromCache(cacheKey);
    if (cached !== null) return cached;

    var result = null;
    switch(type) {
      case 'character':
        result = findCharByName(name);
        break;
      case 'faction':
        result = findFacByName(name);
        break;
      case 'party':
        result = findPartyByName(name);
        break;
      case 'class':
        result = findClassByName(name);
        break;
      case 'army':
        result = findArmyByName(name);
        break;
      case 'tech':
        result = findTechByName(name);
        break;
      default:
        result = this.getAll(type).find(function(item) {
          return item.name === name;
        });
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 按 ID 查询（单个）
  getById: function(type, id) {
    if (!id) return null;

    var cacheKey = this._getCacheKey(type, 'getById', [id]);
    var cached = this._getFromCache(cacheKey);
    if (cached !== null) return cached;

    var result = null;
    if (type === 'scenario') {
      result = findScenarioById(id);
    } else {
      result = this.getAll(type).find(function(item) {
        return item.id === id;
      });
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 条件查询（多个）
  where: function(type, predicate) {
    return this.getAll(type).filter(predicate);
  },

  // 统计数量
  count: function(type, predicate) {
    if (predicate) {
      return this.where(type, predicate).length;
    }
    return this.getAll(type).length;
  },

  // 求和
  sum: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    return items.reduce(function(sum, item) {
      return sum + (item[property] || 0);
    }, 0);
  },

  // 平均值
  avg: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return 0;
    return this.sum(type, property, predicate) / items.length;
  },

  // 最大值
  max: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return null;
    return items.reduce(function(max, item) {
      return (item[property] || 0) > (max[property] || 0) ? item : max;
    });
  },

  // 最小值
  min: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return null;
    return items.reduce(function(min, item) {
      return (item[property] || 0) < (min[property] || 0) ? item : min;
    });
  },

  // ============================================================
  // 关系查询（中国古代背景）
  // ============================================================

  // 获取角色的所有下属
  getSubordinates: function(characterName) {
    if (!characterName) return [];

    var char = this.getByName('character', characterName);
    if (!char || !char.position) return [];

    // 查找官职
    var office = this.findOffice(char.position);
    if (!office) return [];

    // 查找该官职的下属官职
    var subordinateOffices = this.getSubordinateOffices(office);

    // 查找担任这些官职的角色
    var subordinates = [];
    subordinateOffices.forEach(function(subOffice) {
      var holder = WorldHelper.where('character', function(c) {
        return c.position === subOffice.name;
      });
      subordinates = subordinates.concat(holder);
    });

    return subordinates;
  },

  // 获取角色的上级
  getSuperior: function(characterName) {
    if (!characterName) return null;

    var char = this.getByName('character', characterName);
    if (!char || !char.position) return null;

    // 查找官职
    var office = this.findOffice(char.position);
    if (!office || !office.deptId) return null;

    // 查找部门负责人
    var dept = this.findDepartment(office.deptId);
    if (!dept || !dept.head) return null;

    return this.getByName('character', dept.head);
  },

  // 获取势力的所有封臣
  getVassals: function(factionName) {
    if (!factionName) return [];

    var faction = this.getByName('faction', factionName);
    if (!faction || !faction.vassals) return [];

    return faction.vassals.map(function(vassalName) {
      return WorldHelper.getByName('faction', vassalName);
    }).filter(function(v) { return v !== null; });
  },

  // 获取势力的宗主
  getLiege: function(factionName) {
    if (!factionName) return null;

    var faction = this.getByName('faction', factionName);
    if (!faction || !faction.liege) return null;

    return this.getByName('faction', faction.liege);
  },

  // 获取角色的所有关系
  getRelations: function(characterName) {
    if (!characterName) return [];

    var relations = [];

    // 查找父子关系
    var children = this.where('character', function(c) {
      return c.father === characterName || c.mother === characterName;
    });
    children.forEach(function(child) {
      relations.push({ type: '子女', target: child.name, character: child });
    });

    // 查找配偶关系
    var char = this.getByName('character', characterName);
    if (char && char.spouse) {
      var spouse = this.getByName('character', char.spouse);
      if (spouse) {
        relations.push({ type: '配偶', target: spouse.name, character: spouse });
      }
    }

    // 查找上下级关系
    var subordinates = this.getSubordinates(characterName);
    subordinates.forEach(function(sub) {
      relations.push({ type: '下属', target: sub.name, character: sub });
    });

    var superior = this.getSuperior(characterName);
    if (superior) {
      relations.push({ type: '上级', target: superior.name, character: superior });
    }

    return relations;
  },

  // ============================================================
  // 辅助查询函数
  // ============================================================

  // 查找官职
  findOffice: function(officeName) {
    if (!GM.officeTree || !officeName) return null;

    var result = null;
    _tmWalkOfficeChildren(GM.officeTree, function(node) {
      if (node.positions) {
        for (var j = 0; j < node.positions.length; j++) {
          if (node.positions[j].name === officeName) {
            result = node.positions[j];
            result.deptId = node.id;
            result.deptName = node.name;
            return false;
          }
        }
      }
      return true;
    });
    return result;
  },

  // 查找部门
  findDepartment: function(deptId) {
    if (!GM.officeTree || !deptId) return null;

    var result = null;
    _tmWalkOfficeChildren(GM.officeTree, function(node) {
      if (node.id === deptId) {
        result = node;
        return false;
      }
      return true;
    });
    return result;
  },

  // 获取下属官职
  getSubordinateOffices: function(office) {
    if (!office || !office.deptId) return [];

    var dept = this.findDepartment(office.deptId);
    if (!dept) return [];

    var subordinates = [];
    if (dept.positions) {
      dept.positions.forEach(function(pos) {
        if (pos.rank > office.rank) {
          subordinates.push(pos);
        }
      });
    }

    return subordinates;
  },

  // 获取角色所在势力
  getCharacterFaction: function(characterName) {
    if (!characterName) return null;

    var char = this.getByName('character', characterName);
    if (!char || !char.faction) return null;

    return this.getByName('faction', char.faction);
  },

  // 获取势力的所有角色
  getFactionCharacters: function(factionName) {
    if (!factionName) return [];

    return this.where('character', function(c) {
      return c.faction === factionName;
    });
  },

  // 获取势力的所有军队
  getFactionArmies: function(factionName) {
    if (!factionName) return [];

    return this.where('army', function(a) {
      return a.faction === factionName;
    });
  },

  // 获取势力的总兵力
  getFactionTotalSoldiers: function(factionName) {
    return this.sum('army', 'soldiers', function(a) {
      return a.faction === factionName;
    });
  },

  // 获取角色的权力值（根据官职和能力）
  getCharacterPower: function(characterName) {
    var char = this.getByName('character', characterName);
    if (!char) return 0;

    var power = 0;

    // 基础能力值
    power += (char.intelligence || 0) * 0.3;
    power += (char.valor || 0) * 0.2;
    power += (char.benevolence || 0) * 0.1;

    // 官职加成
    if (char.position) {
      var office = this.findOffice(char.position);
      if (office && office.rank) {
        power += (10 - office.rank) * 10; // 品级越高权力越大
      }
    }

    // 下属数量加成
    var subordinates = this.getSubordinates(characterName);
    power += subordinates.length * 5;

    return Math.round(power);
  }
};

// findCharByName / findFacByName 已在索引系统中定义（约6895行），此处不再重复

// ── TM.Roster·人物名册写口（2026-07-04 守卫v3收口·gm:chars 数组级）──────────
// 各造人点曾各自为政：push 后 charByName 索引/图志名册缓存的配套动作漏一处=
// 新人 findCharByName 走线性扫(本文件 fallback 注释即此病自白)/图志名册看不到(策名之鉴)。
// 单口收齐：push + 索引 set + TMZhi 缓存失效；removeChar 同步反向。
// globalThis 优先绑定(沙箱 window mock 劫持之鉴)。
(function(global) {
  var TM = global.TM = global.TM || {};
  function _hash(text) {
    var hash = 2166136261;
    text = String(text || '');
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = typeof Math.imul === 'function' ? Math.imul(hash, 16777619) : hash * 16777619;
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }
  function _worldId(G) {
    return String((G && (G._campaignId || G.campaignId || G.sid)) || 'world');
  }
  function _hasCharId(G, id, except) {
    var key = String(id || '').trim();
    return !!key && (G.chars || []).some(function(row) {
      return row && row !== except && row.id !== undefined && row.id !== null && String(row.id).trim() === key;
    });
  }
  function allocateCharId(G) {
    if (!G || typeof G !== 'object') throw new Error('角色 ID 分配缺少当前世界');
    if (!G._entityIdCounters || typeof G._entityIdCounters !== 'object' || Array.isArray(G._entityIdCounters)) {
      G._entityIdCounters = { version: 1, char: 0 }; // arch-ok: 世界自有实体 ID 序列，随存档/回滚
    }
    if (G._entityIdCounters.version !== 1) G._entityIdCounters.version = 1;
    var counter = Number(G._entityIdCounters.char);
    if (!Number.isSafeInteger(counter) || counter < 0) counter = 0;
    var prefix = 'tm_char_' + _hash(_worldId(G));
    var candidate;
    do {
      counter += 1;
      candidate = prefix + '_' + counter.toString(36);
    } while (_hasCharId(G, candidate));
    G._entityIdCounters.char = counter;
    return candidate;
  }
  function _normalizeChar(ch, options) {
    options = options || {};
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) throw new Error('角色数据必须是对象');
    var name = typeof _tmCleanCharLookupName === 'function' ? _tmCleanCharLookupName(ch.name) : String(ch.name || '').trim();
    if (!name) throw new Error('角色缺少姓名');
    ch.name = name;
    var defaultAge = options.defaultAge !== undefined ? options.defaultAge : 30;
    ch.age = typeof getValidAge === 'function' ? getValidAge(ch, defaultAge)
      : (Number.isFinite(ch.age) && ch.age >= 0 ? Math.floor(ch.age) : defaultAge);
    if (!ch.gender) ch.gender = options.defaultGender || '未知';
    if (ch.alive === undefined) ch.alive = true;
    // 构造期默认值，不是运行态转籍；membership provider 此时尚未装载。
    if (ch.faction === undefined || ch.faction === null) Object.assign(ch, { faction: '' });
    return ch;
  }
  function _resolveParent(G, ref) {
    if (!ref) return null;
    if (typeof ref === 'object') return G.chars.indexOf(ref) >= 0 ? ref : null;
    var key = String(ref).trim();
    if (!key) return null;
    var byId = (G.chars || []).filter(function(row) {
      return row && row.id !== undefined && row.id !== null && String(row.id) === key;
    });
    if (byId.length === 1) return byId[0];
    var byName = (G.chars || []).filter(function(row) { return row && row.name === key; });
    return byName.length === 1 ? byName[0] : null;
  }
  function _repairRegisteredChar(G, ch, options) {
    var first = G.chars.indexOf(ch);
    if (first < 0) return null;
    var id = ch.id === undefined || ch.id === null ? '' : String(ch.id).trim();
    if (!id) throw new Error('已注册角色缺少稳定 ID: ' + (ch.name || '未名'));
    if (_hasCharId(G, id, ch)) throw new Error('角色稳定 ID 冲突: ' + id);

    // 旧缺陷可能已经把同一对象引用 push 多次；幂等入口顺手收敛为一行。
    for (var i = G.chars.length - 1; i > first; i--) {
      if (G.chars[i] === ch) G.chars.splice(i, 1);
    }
    if (!G._indices) G._indices = {};
    if (!G._indices.charByName || typeof G._indices.charByName.set !== 'function') G._indices.charByName = new Map();
    if (!G._indices.charById || typeof G._indices.charById.set !== 'function') G._indices.charById = new Map();
    var indexedById = G._indices.charById.get(id);
    if (indexedById && indexedById !== ch) throw new Error('角色 ID 索引冲突: ' + id);
    G._indices.charById.set(id, ch);
    var nameKey = typeof _tmCleanCharLookupName === 'function' ? _tmCleanCharLookupName(ch.name) : ch.name;
    var indexedByName = G._indices.charByName.get(nameKey);
    if (!indexedByName || G.chars.indexOf(indexedByName) < 0) G._indices.charByName.set(nameKey, ch);

    var father = _resolveParent(G, (options || {}).father || ch.fatherId || ch.father);
    var mother = _resolveParent(G, (options || {}).mother || ch.motherId || ch.mother);
    [father, mother].forEach(function(parent) {
      if (!parent) return;
      if (!Array.isArray(parent.childrenIds)) parent.childrenIds = [];
      var seen = false;
      parent.childrenIds = parent.childrenIds.filter(function(childId) {
        if (String(childId) !== id) return true;
        if (seen) return false;
        seen = true;
        return true;
      });
      if (!seen) parent.childrenIds.push(id);
    });
    if (global.TMZhi && typeof global.TMZhi.invalidatePeople === 'function') global.TMZhi.invalidatePeople();
    return ch;
  }
  function createChar(data, options) {
    options = options || {};
    var G = options.world || (typeof GM !== 'undefined' ? GM : null);
    if (!G) throw new Error('角色创建缺少当前世界');
    if (!Array.isArray(G.chars)) G.chars = [];
    var registered = _repairRegisteredChar(G, data, options);
    if (registered) return registered;
    // historical-agency-v21: the common ingress also covers direct AI additions and fallbacks.
    var agency = global.TM && global.TM.HistoricalAgency;
    if (G === global.GM && agency && agency.isPlayerDriven() && data && (data.isHistorical === true || agency.findProfile(data.name))) {
      var temporal = agency.temporalEligibility(data, {year:G.year});
      if (!temporal.ok) throw new Error('史实不可现：' + temporal.reason);
    }
    var ch = _normalizeChar(data, options);
    var counterBefore = G._entityIdCounters && G._entityIdCounters.char;
    var countersExisted = !!G._entityIdCounters;
    var id = ch.id === undefined || ch.id === null ? '' : String(ch.id).trim();
    if (id && _hasCharId(G, id, ch)) throw new Error('角色稳定 ID 冲突: ' + id);
    if (!id) id = allocateCharId(G);
    ch.id = id;

    var father = _resolveParent(G, options.father || ch.fatherId || ch.father);
    var mother = _resolveParent(G, options.mother || ch.motherId || ch.mother);
    var parentSnapshots = [];
    [father, mother].forEach(function(parent) {
      if (parent && !parentSnapshots.some(function(row) { return row.parent === parent; })) {
        parentSnapshots.push({ parent: parent, childrenIds: Array.isArray(parent.childrenIds) ? parent.childrenIds.slice() : null });
      }
    });
    var nameKey = typeof _tmCleanCharLookupName === 'function' ? _tmCleanCharLookupName(ch.name) : ch.name;
    var priorNameIndex = G._indices && G._indices.charByName && G._indices.charByName.get(nameKey);
    var priorIdIndex = G._indices && G._indices.charById && G._indices.charById.get(id);
    var pushed = false;
    try {
      if (father) { ch.fatherId = father.id; if (!ch.father) ch.father = father.name; }
      if (mother) { ch.motherId = mother.id; if (!ch.mother) ch.mother = mother.name; }
      G.chars.push(ch); pushed = true;
      [father, mother].forEach(function(parent) {
        if (!parent) return;
        if (!Array.isArray(parent.childrenIds)) parent.childrenIds = [];
        if (parent.childrenIds.indexOf(id) < 0) parent.childrenIds.push(id);
      });
      if (!G._indices) G._indices = {};
      if (!G._indices.charByName || typeof G._indices.charByName.set !== 'function') G._indices.charByName = new Map();
      if (!G._indices.charById || typeof G._indices.charById.set !== 'function') G._indices.charById = new Map();
      G._indices.charByName.set(nameKey, ch);
      G._indices.charById.set(id, ch);
      if (global.TMZhi && typeof global.TMZhi.invalidatePeople === 'function') global.TMZhi.invalidatePeople();
      return ch;
    } catch (error) {
      if (pushed) {
        var at = G.chars.indexOf(ch);
        if (at >= 0) G.chars.splice(at, 1);
      }
      parentSnapshots.forEach(function(row) {
        if (row.childrenIds === null) delete row.parent.childrenIds;
        else row.parent.childrenIds = row.childrenIds;
      });
      if (G._indices && G._indices.charByName) {
        if (priorNameIndex) G._indices.charByName.set(nameKey, priorNameIndex);
        else G._indices.charByName.delete(nameKey);
      }
      if (G._indices && G._indices.charById) {
        if (priorIdIndex) G._indices.charById.set(id, priorIdIndex);
        else G._indices.charById.delete(id);
      }
      if (!countersExisted) delete G._entityIdCounters;
      else G._entityIdCounters.char = counterBefore;
      throw error;
    }
  }
  function addChar(ch, options) {
    return createChar(ch, options);
  }
  function removeChar(nameOrId) {
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars) || !nameOrId) return false;
    var objectRef = typeof nameOrId === 'object' ? nameOrId : null;
    var raw = objectRef ? (objectRef.id || objectRef.name) : nameOrId;
    var n = typeof _tmCleanCharLookupName === 'function' ? _tmCleanCharLookupName(raw) : String(raw);
    var idMatches = GM.chars.filter(function(c) {
      return c && c.id !== undefined && c.id !== null && String(c.id) === String(raw);
    });
    var nameMatches = GM.chars.filter(function(c) { return c && c.name === raw; });
    var target = objectRef && GM.chars.indexOf(objectRef) >= 0 ? objectRef
      : (idMatches.length === 1 ? idMatches[0] : (nameMatches.length === 1 ? nameMatches[0] : null));
    if (!target) return false;
    var removed = false;
    var removedIds = [];
    for (var i = GM.chars.length - 1; i >= 0; i--) {
      var c = GM.chars[i];
      if (c === target) {
        if (c.id !== undefined && c.id !== null) removedIds.push(String(c.id));
        GM.chars.splice(i, 1); removed = true;
      }
    }
    if (removed) {
      if (GM._indices && GM._indices.charByName && typeof GM._indices.charByName.delete === 'function') {
        if (GM._indices.charByName.get(n) === target) GM._indices.charByName.delete(n);
        var sameName = GM.chars.filter(function(c) { return c && c.name === target.name; });
        if (sameName.length) GM._indices.charByName.set(target.name, sameName[sameName.length - 1]);
      }
      if (GM._indices && GM._indices.charById && typeof GM._indices.charById.delete === 'function') removedIds.forEach(function(id) { GM._indices.charById.delete(id); });
      if (global.TMZhi && typeof global.TMZhi.invalidatePeople === 'function') global.TMZhi.invalidatePeople();
    }
    return removed;
  }
  TM.Roster = { addChar: addChar, createChar: createChar, removeChar: removeChar, allocateCharId: allocateCharId };
  global.createRuntimeCharacter = function(data, options) {
    return createChar(data, options);
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

// ── 玩家身份与权力交接：GM.playerInfo.characterId 为权威，isPlayer 为同步镜像 ──
(function(global) {
  var TM = global.TM = global.TM || {};
  TM.Player = TM.Player || {};

  function cloneValue(value) {
    if (value === undefined) return undefined;
    if (typeof deepClone === 'function') return deepClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  function restoreObject(target, snapshot) {
    Object.keys(target).forEach(function(key) { delete target[key]; });
    Object.keys(snapshot || {}).forEach(function(key) { target[key] = cloneValue(snapshot[key]); });
  }
  function getPlayerCharacter(world) {
    var G = world || (typeof GM !== 'undefined' ? GM : null);
    if (!G || !Array.isArray(G.chars)) return null;
    if (TM.NativeWorld && TM.NativeWorld.enabled(G)) return TM.NativeWorld.info(G).character;
    var info = G.playerInfo && typeof G.playerInfo === 'object' ? G.playerInfo : null;
    var id = info && info.characterId != null ? String(info.characterId).trim() : '';
    if (id) {
      var byId = G.chars.find(function(ch) { return ch && ch.id != null && String(ch.id).trim() === id; });
      return byId || null;
    }
    var name = info && info.characterName ? String(info.characterName).trim() : '';
    if (name) {
      var named = G.chars.filter(function(ch) { return ch && ch.name === name; });
      return named.length === 1 ? named[0] : null;
    }
    var flagged = G.chars.filter(function(ch) { return ch && ch.isPlayer === true; });
    return flagged.length === 1 ? flagged[0] : null;
  }
  function resolveChar(G, ref) {
    if (!ref) return null;
    if (typeof ref === 'object') return G.chars.indexOf(ref) >= 0 ? ref : null;
    var key = String(ref).trim();
    if (!key) return null;
    var byId = G.chars.filter(function(ch) { return ch && ch.id != null && String(ch.id).trim() === key; });
    if (byId.length === 1) return byId[0];
    var byName = G.chars.filter(function(ch) { return ch && ch.name === key; });
    return byName.length === 1 ? byName[0] : null;
  }
  function clearHeirState(G, from, to) {
    var toId = String(to.id);
    if (String(from.designatedHeirId || '') === toId) delete from.designatedHeirId;
    if (String(from.designatedHeir || '') === toId
      || (!from.designatedHeirId && from.designatedHeir === to.name)) delete from.designatedHeir;
    ['isCrownPrince','isDesignatedHeir','_designatedHeir','heirAppointedTurn','successionRole'].forEach(function(key) { delete to[key]; });
    if (to.role === '太子' || to.role === '储君' || to.role === '皇太子') delete to.role;
    if (G.harem && typeof G.harem === 'object') {
      if (String(G.harem.crownPrinceId || '') === toId) G.harem.crownPrinceId = '';
      if (G.harem.crownPrince === toId
        || (!G.harem.crownPrinceId && G.harem.crownPrince === to.name)) G.harem.crownPrince = '';
      (Array.isArray(G.harem.heirs) ? G.harem.heirs : []).forEach(function(entry) {
        if (!entry) return;
        var entryId = entry.id || entry.characterId || '';
        var matches = entryId ? String(entryId) === toId : entry.name === to.name;
        if (matches) {
          entry.isCrownPrince = false;
          entry.ascendedTurn = Number.isFinite(Number(G.turn)) ? Number(G.turn) : 0;
        }
      });
    }
  }
  function invalidateSuccessionCaches(G) {
    if (typeof invalidateGameIndices === 'function') invalidateGameIndices(G, null);
    if (G === (typeof GM !== 'undefined' ? GM : null) && typeof buildIndices === 'function') {
      buildIndices({ skipScenarioIndex: true });
    }
    if (TM.FactionIndex && typeof TM.FactionIndex.rebuild === 'function') TM.FactionIndex.rebuild();
    if (global.TMZhi && typeof global.TMZhi.invalidatePeople === 'function') global.TMZhi.invalidatePeople();
  }
  function transferPlayerControl(options) {
    options = options || {};
    var G = options.world || (typeof GM !== 'undefined' ? GM : null);
    if (!G || !Array.isArray(G.chars)) return { ok: false, reason: 'world-missing' };
    var from = resolveChar(G, options.from) || getPlayerCharacter(G);
    var to = resolveChar(G, options.to);
    if (!from) return { ok: false, reason: 'old-ruler-not-found' };
    if (!to) return { ok: false, reason: 'heir-not-found' };
    if (from === to) return { ok: false, reason: 'same-ruler' };
    if (to.alive === false || to.dead) return { ok: false, reason: 'heir-not-alive' };
    if (!from.id || !String(from.id).trim()) return { ok: false, reason: 'old-ruler-stable-id-missing' };
    if (!to.id || !String(to.id).trim()) return { ok: false, reason: 'heir-stable-id-missing' };
    var current = getPlayerCharacter(G);
    if (current && current !== from) return { ok: false, reason: 'old-ruler-not-current-player' };
    var nativeIdentity = TM.NativeWorld && TM.NativeWorld.enabled(G) ? TM.NativeWorld.info(G) : null;
    if (nativeIdentity && (!G.nativeWorld.authority || G.nativeWorld.authority.roleKind !== 'headOfState')) return {ok:false,reason:'native-succession-role-not-defined'};

    var charSnapshots = G.chars.map(function(ch) { return { ref: ch, state: cloneValue(ch) }; });
    var snapshot = {
      nativeContext: cloneValue(G.startContext), nativeAuthority: cloneValue(G.nativeWorld && G.nativeWorld.authority), nativeRevocations: cloneValue(G.nativeWorld && G.nativeWorld.revokedAuthorityCharacters), playerCharacterId: G.playerCharacterId,
      playerInfo: cloneValue(G.playerInfo), playerInfoOwn: Object.prototype.hasOwnProperty.call(G, 'playerInfo'),
      officeTree: cloneValue(G.officeTree), officeOwn: Object.prototype.hasOwnProperty.call(G, 'officeTree'),
      harem: cloneValue(G.harem), haremOwn: Object.prototype.hasOwnProperty.call(G, 'harem'),
      facs: (G.facs || []).map(function(fac) { return { ref: fac, state: cloneValue(fac) }; }),
      successionEvent: cloneValue(G._successionEvent), successionOwn: Object.prototype.hasOwnProperty.call(G, '_successionEvent')
    };
    try {
      var vacated = { ok: true, vacated: [] };
      var hasOfficeTree = Array.isArray(G.officeTree) && G.officeTree.length > 0;
      if (hasOfficeTree) {
        if (typeof _offVacateByCharId !== 'function') {
          throw new Error('继承事务缺少稳定 ID 官职注销入口');
        }
        vacated = _offVacateByCharId(to.id, 'succession', G.officeTree, { leaveVacancy: true, world: G });
        if (!vacated || vacated.ok !== true) {
          throw new Error('继承人原官职注销失败: ' + ((vacated && vacated.reason) || 'unknown'));
        }
      }
      G.chars.forEach(function(ch) { if (ch) ch.isPlayer = ch === to; });
      clearHeirState(G, from, to);
      if (!Array.isArray(to.formerTitles)) to.formerTitles = [];
      [to.title, to.officialTitle].forEach(function(title) {
        if (title && title !== '皇帝' && to.formerTitles.indexOf(title) < 0) to.formerTitles.push(title);
      });
      to._preAccessionOffice = vacated.vacated || [];
      var nativeTitle = nativeIdentity && ((G.nativeWorld.ruleset.config.government || {}).headOfStateTitle || G.nativeWorld.authority.headTitle || from.officialTitle || from.title || to.title || '元首');
      to.role = nativeIdentity ? 'headOfState' : '皇帝';
      to.officialTitle = options.newOfficialTitle || nativeTitle || '皇帝';
      to.title = options.newTitle || nativeTitle || '皇帝';
      if (options.reason === 'abdication') {
        if (!Array.isArray(from.formerTitles)) from.formerTitles = [];
        if (from.title && from.title !== '太上皇' && from.formerTitles.indexOf(from.title) < 0) from.formerTitles.push(from.title);
        from.role = nativeIdentity ? 'formerHeadOfState' : '太上皇';
        from.officialTitle = nativeIdentity ? (options.oldRulerTitle || '前任元首') : '太上皇';
        from.title = options.oldRulerTitle || (nativeIdentity ? '前任元首' : '太上皇');
      }
      var baseInfo = G.playerInfo && typeof G.playerInfo === 'object' ? G.playerInfo
        : ((typeof P !== 'undefined' && P && P.playerInfo) ? cloneValue(P.playerInfo) : {});
      G.playerInfo = Object.assign({}, baseInfo, {
        characterId: String(to.id), characterName: to.name,
        characterTitle: to.title || to.officialTitle || '',
        characterBio: to.bio || '', characterPersonality: to.personality || '',
        factionId: nativeIdentity ? nativeIdentity.faction.id : to.factionId || '', factionName: nativeIdentity ? nativeIdentity.faction.name : to.faction || ''
      });
      if (nativeIdentity) {
        G.startContext.currentPlayerCharacterId = to.id;
        G.playerCharacterId = to.id;
        G.nativeWorld.authority.characterId = to.id;
        G.nativeWorld.revokedAuthorityCharacters = (G.nativeWorld.revokedAuthorityCharacters || []).filter(function(id){return id!==to.id;}).concat([from.id]);
        G.startContext.successions = (G.startContext.successions || []).concat([{fromId:from.id,toId:to.id,turn:G.turn,reason:options.reason || 'succession'}]);
      }
      (G.facs || []).forEach(function(fac) {
        if (!fac) return;
        if (nativeIdentity) { if (fac.id === nativeIdentity.faction.id) { fac.leaderId = to.id; fac.leaderCharacterId = to.id; fac.leader = to.name; } return; }
        var oldMatches = (from.id && String(fac.leaderId || '') === String(from.id))
          || (!fac.leaderId && fac.leader === from.name)
          || (fac.isPlayer && to.faction && fac.name === to.faction);
        if (oldMatches) { fac.leaderId = to.id; fac.leader = to.name; }
      });
      G._successionEvent = {
        fromId: from.id || '', from: from.name, toId: to.id, to: to.name,
        reason: options.eventReason || options.reason || 'succession',
        causeKind: options.causeKind || '', turn: Number(G.turn) || 0
      };
      invalidateSuccessionCaches(G);
      return { ok: true, from: from, to: to, vacated: vacated.vacated || [] };
    } catch (error) {
      if (nativeIdentity) { G.startContext = snapshot.nativeContext; G.nativeWorld.authority = snapshot.nativeAuthority; G.nativeWorld.revokedAuthorityCharacters = snapshot.nativeRevocations; G.playerCharacterId = snapshot.playerCharacterId; }
      charSnapshots.forEach(function(row) { restoreObject(row.ref, row.state); });
      snapshot.facs.forEach(function(row) { restoreObject(row.ref, row.state); });
      if (snapshot.playerInfoOwn) G.playerInfo = snapshot.playerInfo; else delete G.playerInfo;
      if (snapshot.officeOwn) G.officeTree = snapshot.officeTree; else delete G.officeTree;
      if (snapshot.haremOwn) G.harem = snapshot.harem; else delete G.harem;
      if (snapshot.successionOwn) G._successionEvent = snapshot.successionEvent; else delete G._successionEvent;
      if (typeof invalidateGameIndices === 'function') invalidateGameIndices(G, null);
      if (TM.errors && typeof TM.errors.capture === 'function') TM.errors.capture(error, 'succession-transfer');
      else if (global.console && typeof global.console.error === 'function') global.console.error('[succession-transfer]', error);
      return { ok: false, reason: 'transaction-failed', error: error };
    }
  }

  TM.Player.getInfo = getRuntimePlayerInfo;
  TM.Player.getCharacter = getPlayerCharacter;
  TM.Succession = TM.Succession || {};
  TM.Succession.getPlayerCharacter = getPlayerCharacter;
  TM.Succession.transferPlayerControl = transferPlayerControl;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
