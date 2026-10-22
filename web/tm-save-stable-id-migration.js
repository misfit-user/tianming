// @ts-check
/// <reference path="types.d.ts" />
// Save stable-ID migration helpers. Load before world validation and lifecycle.
// Classic-script declarations only; lifecycle helpers are resolved at call time.

function _tmStableIdMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function _tmStableIdHash(text) {
  var hash = 2166136261;
  text = String(text || '');
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = typeof Math.imul === 'function' ? Math.imul(hash, 16777619) : hash * 16777619;
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function _tmStableIdentityParts(kind, item) {
  item = item || {};
  var sourceIdentity = [item.sourceId, item.sourceKey, item.uuid, item.legacyId, item.originalId]
    .map(function(value) { return value === undefined || value === null ? '' : String(value).trim(); })
    .filter(Boolean);
  // 显式来源身份单独构成种子；若再拼入可改名的显示字段，同一 sourceId
  // 在旧档分支改名后仍会生成不同 ID。
  if (sourceIdentity.length) return ['source'].concat(sourceIdentity);
  var semanticIdentity;
  if (kind === 'char') {
    semanticIdentity = [item.sid, item.key, item.name, item.zi, item.courtesyName, item.birthDate, item.birthYear, item.birthplace, item.gender];
  } else if (kind === 'faction') {
    semanticIdentity = [item.sid, item.key, item.name, item.foundedYear, item.dynasty, item.culture, item.faith];
  } else if (kind === 'army') {
    semanticIdentity = [item.sid, item.key, item.name, item.createdTurn, item.foundedYear, item.homeRegionId, item.homeRegion];
  } else if (kind === 'region' || kind === 'division') {
    semanticIdentity = [item.sid, item.key, item.mapRegionId, item.regionId, item.name, item.level, item.parentId, item.longitude, item.latitude];
  } else {
    semanticIdentity = [item.name, item.title, item.type, item.kind];
  }
  // Only immutable/source-like attributes participate. Faction, owner,
  // location, commander and composition are gameplay state and would make a
  // legacy entity change identity across save branches.
  return semanticIdentity.map(function(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (_) { return ''; }
    }
    return String(value).trim();
  }).filter(Boolean);
}

function _tmCollectAdminDivisionEntries(targetGM) {
  var out = [];
  var hierarchy = targetGM && targetGM.adminHierarchy;
  if (!hierarchy || typeof hierarchy !== 'object') return out;
  var visited = typeof WeakSet === 'function' ? new WeakSet() : null;
  function walk(nodes, path, identityPath) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node, index) {
      if (!node || typeof node !== 'object') return;
      if (visited) {
        if (visited.has(node)) return;
        visited.add(node);
      }
      var nodePath = path + '/' + index;
      var identityToken = _tmStableIdentityParts('division', node).join('|') || ('index:' + index);
      var nodeIdentityPath = identityPath + '/' + identityToken;
      out.push({ item: node, path: nodePath, identityPath: nodeIdentityPath });
      [node.children, node.divisions, node.subdivisions, node.subs].forEach(function(children) {
        if (Array.isArray(children)) walk(children, nodePath, nodeIdentityPath);
      });
    });
  }
  if (Array.isArray(hierarchy.divisions)) {
    walk(hierarchy.divisions, 'admin/player', 'admin/player');
  } else {
    Object.keys(hierarchy).sort().forEach(function(factionKey) {
      var branch = hierarchy[factionKey];
      var roots = Array.isArray(branch) ? branch : (branch && branch.divisions);
      walk(roots, 'admin/' + factionKey, 'admin/' + factionKey);
    });
  }
  return out;
}

function _tmAssignMissingStableIds(targetGM, kind, entries) {
  entries = Array.isArray(entries) ? entries : [];
  var unresolvedFingerprints = Object.create(null);
  entries.forEach(function(entry, index) {
    var item = entry && entry.item;
    if (!item || !_tmStableIdMissing(item.id)) return;
    var parts = _tmStableIdentityParts(kind, item);
    if (!parts.length) return;
    var parentIdentity = '';
    if (kind === 'division' && entry.identityPath) {
      var identitySegments = String(entry.identityPath).split('/');
      identitySegments.pop();
      parentIdentity = identitySegments.join('/');
    }
    var fingerprint = parts.join('|') + (parentIdentity ? '|parent:' + parentIdentity : '');
    if (_tmHasOwn(unresolvedFingerprints, fingerprint)) {
      throw new Error('旧存档 ' + kind + ' 身份歧义：' + String(unresolvedFingerprints[fingerprint]) + ' 与 ' + String(entry.path || index) + ' 缺少可区分的稳定来源字段');
    }
    unresolvedFingerprints[fingerprint] = entry.path || index;
  });
  var used = Object.create(null);
  entries.forEach(function(entry) {
    var item = entry && entry.item;
    if (!item || _tmStableIdMissing(item.id)) return;
    used[String(item.id).trim()] = true;
  });
  var assigned = 0;
  entries.forEach(function(entry, index) {
    var item = entry && entry.item;
    if (!item || !_tmStableIdMissing(item.id)) return;
    var path = String(entry.path || index);
    var identityParts = _tmStableIdentityParts(kind, item);
    // 数组位置只在实体完全没有语义身份，或同指纹碰撞时作最后消歧；
    // 常规人物/势力/军队/地区在重排、删除前置项后仍生成同一 ID。
    var semanticIdentity = identityParts.length ? identityParts.join('|') : String(entry.identityPath || path);
    var seed = [targetGM && (targetGM.sid || targetGM._campaignId) || '', kind, semanticIdentity].join('|');
    var base = 'tmlegacy_' + kind + '_' + _tmStableIdHash(seed) + _tmStableIdHash(seed.split('').reverse().join(''));
    var candidate = base;
    if (used[candidate]) {
      var disambiguator = String(entry.identityPath || path);
      candidate = base + '_' + _tmStableIdHash(seed + '|collision|' + disambiguator);
      var suffix = 2;
      while (used[candidate]) candidate = base + '_' + _tmStableIdHash(seed + '|collision|' + disambiguator) + '_' + suffix++;
    }
    item.id = candidate; // arch-ok: 旧存档核心实体稳定 ID 的确定性 schema 迁移
    used[candidate] = true;
    assigned++;
  });
  return assigned;
}

function _tmUniqueEntityIdByName(list) {
  var map = Object.create(null);
  (Array.isArray(list) ? list : []).forEach(function(item) {
    if (!item || _tmStableIdMissing(item.id) || !String(item.name || '').trim()) return;
    var name = String(item.name).trim();
    if (_tmHasOwn(map, name)) map[name] = null;
    else map[name] = item.id;
  });
  return map;
}

function _tmEntityIdSet(list) {
  var set = Object.create(null);
  (Array.isArray(list) ? list : []).forEach(function(item) {
    if (!item || _tmStableIdMissing(item.id)) return;
    set[String(item.id).trim()] = true;
  });
  return set;
}

function _tmBackfillStableForeignKeys(targetGM, dupGroups) {
  var factionByName = _tmUniqueEntityIdByName(targetGM.facs);
  var charByName = _tmUniqueEntityIdByName(targetGM.chars);
  var factionIds = _tmEntityIdSet(targetGM.facs);
  var charIds = _tmEntityIdSet(targetGM.chars);
  // 重复 id 组（2026-10-17·复审 F1）：撞上组的引用按旁边的名字在组内唯一确定归属；没名字或重名时保持原样并计数
  var dupStats = { rebound: 0, ambiguous: 0 }, dupKey = function(s) { return String(s == null ? '' : s).replace(/[（(].*$/, '').trim(); }, fullKey = function(s) { return String(s == null ? '' : s).trim(); };
  function pickDuplicate(owner, idField, nameValue, idSet) {
    var table = dupGroups && dupGroups[idSet === charIds ? 'char' : 'faction'], ref = _tmStableIdMissing(owner[idField]) ? '' : String(owner[idField]).trim(), group = table && ref && Object.prototype.hasOwnProperty.call(table, ref) && Array.isArray(table[ref]) ? table[ref] : null; // 只认自有键：id 叫 constructor / __proto__ 的不能撞上原型（二次复审 R2-5）
    if (!group) return false;
    var hits = fullKey(nameValue) ? group.filter(function(m) { return fullKey(m.name) === fullKey(nameValue); }) : []; // 先按完整名字（含括注）唯一匹配，没有精确命中才去括注兜底（二次复审 R2-6）
    if (!hits.length && dupKey(nameValue)) hits = group.filter(function(m) { return dupKey(m.name) === dupKey(nameValue); });
    if (hits.length !== 1) { dupStats.ambiguous++; return true; }
    if (hits[0].id !== String(owner[idField]).trim()) { owner[idField] = hits[0].id; dupStats.rebound++; } // arch-ok: 读档 schema 迁移·重复 id 组内按名字改绑
    return true;
  }
  function repairNamedRef(owner, idField, nameValue, idSet, nameMap) {
    if (!owner || pickDuplicate(owner, idField, nameValue, idSet)) return;
    if (!_tmStableIdMissing(owner[idField]) && idSet[String(owner[idField]).trim()]) return;
    var name = typeof nameValue === 'string' ? nameValue.trim() : '';
    var id = name ? nameMap[name] : null; // 2026-10-13：name 为空时原写法得到 ''，会把悬空/缺失 id 悄悄抹成空串（无收据、躲过校验）；找不到就留给 _tmClearDanglingStableRefs 记账清理
    if (id != null) owner[idField] = id; // arch-ok: 旧名称外键迁移到稳定实体 ID
  }
  function repairNamedRefArray(owner, field, idSet, nameMap) {
    if (!owner || !Array.isArray(owner[field])) return;
    owner[field] = owner[field].map(function(value) {
      var key = typeof value === 'string' ? value.trim() : '';
      if (!key || idSet[key]) { var table = dupGroups && dupGroups[idSet === charIds ? 'char' : 'faction']; if (key && table && Object.prototype.hasOwnProperty.call(table, key)) dupStats.ambiguous++; return value; } // 数组里撞上重复组的 id 旁边没有名字可凭，保持原样只计数（二次复审补充）
      return nameMap[key] != null ? nameMap[key] : value; // arch-ok: 旧姓名数组外键仅在唯一可解析时迁移
    });
  }
  (targetGM.chars || []).forEach(function(ch) {
    if (!ch) return;
    repairNamedRef(ch, 'factionId', ch.faction, factionIds, factionByName);
    repairNamedRef(ch, 'fatherId', ch.father, charIds, charByName);
    repairNamedRef(ch, 'motherId', ch.mother, charIds, charByName);
    repairNamedRef(ch, 'spouseId', ch.spouse, charIds, charByName);
    repairNamedRef(ch, 'mentorId', ch.mentor, charIds, charByName);
    repairNamedRef(ch, 'designatedHeirId', ch.designatedHeir || ch.designatedHeirId, charIds, charByName);
    ['childrenIds', 'studentIds', 'studentsIds', 'relativeIds'].forEach(function(field) {
      repairNamedRefArray(ch, field, charIds, charByName);
    });
    (Array.isArray(ch.familyMembers) ? ch.familyMembers : []).forEach(function(member) {
      if (!member || typeof member !== 'object') return;
      repairNamedRef(member, 'characterId', member.name, charIds, charByName);
      repairNamedRef(member, 'personId', member.name, charIds, charByName);
    });
  });
  if (targetGM.harem && typeof targetGM.harem === 'object') {
    repairNamedRef(targetGM.harem, 'crownPrinceId', targetGM.harem.crownPrince || targetGM.harem.crownPrinceId, charIds, charByName);
  }
  (targetGM.facs || []).forEach(function(fac) {
    if (!fac) return;
    repairNamedRef(fac, 'leaderId', fac.leader, charIds, charByName);
    repairNamedRef(fac, 'coLeaderId', fac.coLeader, charIds, charByName);
    repairNamedRef(fac, 'heirId', fac.heir, charIds, charByName);
  });
  (targetGM.armies || []).forEach(function(army) {
    if (!army) return;
    var commanderName = typeof army.commander === 'string' ? army.commander : (army.commanderName || army.general || army.leader || '');
    repairNamedRef(army, 'commanderId', commanderName, charIds, charByName);
    repairNamedRef(army, 'factionId', army.faction || army.factionName || army.owner || '', factionIds, factionByName);
  });
  var regions = targetGM.mapData && targetGM.mapData.regions;
  (Array.isArray(regions) ? regions : []).forEach(function(region) {
    if (!region) return;
    var ownerName = region.currentOwner || region.owner || region.controller || region.factionName || region.ownerName || '';
    repairNamedRef(region, 'factionId', ownerName, factionIds, factionByName);
    repairNamedRef(region, 'governorId', region.governor, charIds, charByName);
  });
  _tmCollectAdminDivisionEntries(targetGM).forEach(function(entry) {
    var division = entry && entry.item;
    if (division) repairNamedRef(division, 'governorId', division.governor, charIds, charByName);
  });
  (function walkOffices(nodes) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node) {
      (Array.isArray(node && node.positions) ? node.positions : []).forEach(function(position) {
        if (!position) return;
        repairNamedRef(position, 'holderId', position.holder, charIds, charByName);
        (Array.isArray(position.actualHolders) ? position.actualHolders : []).forEach(function(holder) {
          if (!holder || typeof holder !== 'object') return;
          repairNamedRef(holder, 'characterId', holder.name, charIds, charByName);
          repairNamedRef(holder, 'personId', holder.name, charIds, charByName);
          repairNamedRef(holder, 'holderId', holder.name, charIds, charByName);
        });
      });
      var subs = Array.isArray(node && node.subs) ? node.subs : [];
      var children = Array.isArray(node && node.children) && node.children !== subs ? node.children : [];
      walkOffices(subs);
      walkOffices(children);
    });
  })(targetGM.officeTree);
  return dupStats;
}

function _tmMigrateCoreStableIds(targetGM) {
  if (!targetGM || typeof targetGM !== 'object') return { total: 0, byType: {} };
  var groups = {
    char: (targetGM.chars || []).map(function(item, index) { return { item: item, path: 'chars/' + index }; }),
    faction: (targetGM.facs || []).map(function(item, index) { return { item: item, path: 'facs/' + index }; }),
    army: (targetGM.armies || []).map(function(item, index) { return { item: item, path: 'armies/' + index }; }),
    region: ((targetGM.mapData && targetGM.mapData.regions) || []).map(function(item, index) { return { item: item, path: 'mapData/regions/' + index }; }),
    division: _tmCollectAdminDivisionEntries(targetGM)
  };
  var result = { total: 0, byType: {}, duplicateRepaired: 0, danglingRepaired: 0 }, dupGroups = {}; // 重复 id 组（复审 F1）：供补外键与玩家收据按名字改绑
  Object.keys(groups).forEach(function(kind) {
    // 修复器与校验器同住 tm-save-world-validation.js（紧邻装载）；单独装载本文件的测试夹具没有它们时按旧行为跳过。
    var duplicates = (typeof _tmRepairDuplicateEntityIds === 'function') ? _tmRepairDuplicateEntityIds(targetGM, kind, groups[kind], dupGroups) : 0;
    if (duplicates > 0) result.duplicateRepaired += duplicates;
    var count = _tmAssignMissingStableIds(targetGM, kind, groups[kind]);
    result.byType[kind] = count;
    result.total += count;
  });
  var rebound = _tmBackfillStableForeignKeys(targetGM, dupGroups) || {};
  if (rebound.rebound) result.duplicateRefsRebound = rebound.rebound;
  if (rebound.ambiguous) result.duplicateRefsAmbiguous = rebound.ambiguous;
  var dangling = (typeof _tmClearDanglingStableRefs === 'function') ? _tmClearDanglingStableRefs(targetGM) : [];
  if (dangling.length) result.danglingRepaired = dangling.length;
  // 与上面两个修复器同款：单独装载本文件的测试夹具没有它时按旧行为跳过（prod 同文件内恒有）
  var receiptFix = typeof _tmRepairPlayerIdentityReceipt === 'function' ? _tmRepairPlayerIdentityReceipt(targetGM, dupGroups) : false, playerReceipt = receiptFix === true ? 1 : 0; if (receiptFix === 'ambiguous') result.duplicateRefsAmbiguous = (result.duplicateRefsAmbiguous || 0) + 1; // 收据撞上重复组又分不清：保持原样、计入分不清（二次复审补充）
  if (playerReceipt) result.playerIdentityRepaired = playerReceipt;
  if (result.total > 0 || result.duplicateRepaired > 0 || dangling.length > 0 || playerReceipt > 0) {
    if (!targetGM._stableIdMigration || typeof targetGM._stableIdMigration !== 'object') {
      targetGM._stableIdMigration = { version: 3, totalAssigned: 0, byType: {} }; // arch-ok: schema 迁移收据
    }
    targetGM._stableIdMigration.version = 3;
    targetGM._stableIdMigration.totalAssigned = Number(targetGM._stableIdMigration.totalAssigned || 0) + result.total;
    targetGM._stableIdMigration.duplicateRepaired = Number(targetGM._stableIdMigration.duplicateRepaired || 0) + Number(result.duplicateRepaired || 0);
    if (result.duplicateRefsRebound || result.duplicateRefsAmbiguous) { targetGM._stableIdMigration.duplicateRefsRebound = Number(targetGM._stableIdMigration.duplicateRefsRebound || 0) + Number(result.duplicateRefsRebound || 0); targetGM._stableIdMigration.duplicateRefsAmbiguous = Number(targetGM._stableIdMigration.duplicateRefsAmbiguous || 0) + Number(result.duplicateRefsAmbiguous || 0); } // arch-ok: 迁移收据·重复组改绑 / 分不清的计数
    if (playerReceipt) targetGM._stableIdMigration.playerIdentityRepaired = Number(targetGM._stableIdMigration.playerIdentityRepaired || 0) + playerReceipt; // arch-ok: schema 迁移收据
    if (dangling.length) {
      targetGM._stableIdMigration.danglingRepaired = Number(targetGM._stableIdMigration.danglingRepaired || 0) + dangling.length;
      targetGM._stableIdMigration.danglingDetails = dangling.slice(0, 40); // arch-ok: 迁移收据·只留最近一次的样本
      try { console.warn('[stable-id] 悬空引用已修复 ' + dangling.length + ' 处（按名找回或清空）', dangling.slice(0, 10)); } catch (_) {}
    }
    Object.keys(result.byType).forEach(function(kind) {
      targetGM._stableIdMigration.byType[kind] = Number(targetGM._stableIdMigration.byType[kind] || 0) + result.byType[kind];
    });
  }
  return result;
}
