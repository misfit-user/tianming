// Canonical save-world validators, extracted without behavior changes.
function _tmValidateUniqueStableIds(label, list) {
  if (!Array.isArray(list)) return;
  var seen = Object.create(null);
  list.forEach(function (item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new Error(label + ' 第 ' + index + ' 项不是合法对象');
    if (_tmStableIdMissing(item.id)) throw new Error(label + ' 缺少稳定 id（索引 ' + index + '）');
    var raw = item.id;
    if (typeof raw !== 'string' && !(typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0)) {
      throw new Error(label + ' id 类型非法（索引 ' + index + '）');
    }
    var id = String(raw).trim();
    if (!id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id))
      throw new Error(label + ' id 格式非法（索引 ' + index + '）');
    if (seen[id] !== undefined)
      throw new Error(label + ' 存在重复 id: ' + id + '（索引 ' + seen[id] + ' / ' + index + '）');
    seen[id] = index;
  });
}

function _tmValidateStableForeignKeys(targetGM) {
  var factionIds = _tmEntityIdSet(targetGM.facs);
  var charIds = _tmEntityIdSet(targetGM.chars);
  function requireExisting(label, value, set) {
    if (_tmStableIdMissing(value)) return;
    var key = String(value).trim();
    if (!set[key]) throw new Error(label + ' 指向不存在的稳定 id: ' + key);
  }
  (targetGM.chars || []).forEach(function (ch, index) {
    if (!ch) return;
    requireExisting('人物[' + index + '].factionId', ch.factionId, factionIds);
    ['fatherId', 'motherId', 'spouseId', 'mentorId', 'designatedHeirId'].forEach(function (field) {
      requireExisting('人物[' + index + '].' + field, ch[field], charIds);
    });
    ['childrenIds', 'studentIds', 'studentsIds', 'relativeIds'].forEach(function (field) {
      (Array.isArray(ch[field]) ? ch[field] : []).forEach(function (id, refIndex) {
        requireExisting('人物[' + index + '].' + field + '[' + refIndex + ']', id, charIds);
      });
    });
    (Array.isArray(ch.familyMembers) ? ch.familyMembers : []).forEach(function (member, memberIndex) {
      if (!member || typeof member !== 'object') return;
      requireExisting(
        '人物[' + index + '].familyMembers[' + memberIndex + '].characterId',
        member.characterId,
        charIds,
      );
      requireExisting('人物[' + index + '].familyMembers[' + memberIndex + '].personId', member.personId, charIds);
    });
  });
  if (targetGM.harem && typeof targetGM.harem === 'object') {
    requireExisting('后宫.crownPrinceId', targetGM.harem.crownPrinceId, charIds);
  }
  (targetGM.facs || []).forEach(function (faction, index) {
    if (!faction) return;
    requireExisting('势力[' + index + '].leaderId', faction.leaderId, charIds);
    requireExisting('势力[' + index + '].coLeaderId', faction.coLeaderId, charIds);
    requireExisting('势力[' + index + '].heirId', faction.heirId, charIds);
    (Array.isArray(faction.memberIds) ? faction.memberIds : []).forEach(function (id, memberIndex) {
      requireExisting('势力[' + index + '].memberIds[' + memberIndex + ']', id, charIds);
    });
  });
  (targetGM.armies || []).forEach(function (army, index) {
    if (!army) return;
    requireExisting('军队[' + index + '].commanderId', army.commanderId, charIds);
    requireExisting('军队[' + index + '].factionId', army.factionId, factionIds);
  });
  var regions = targetGM.mapData && targetGM.mapData.regions;
  (Array.isArray(regions) ? regions : []).forEach(function (region, index) {
    if (!region) return;
    requireExisting('地图地区[' + index + '].factionId', region.factionId, factionIds);
    requireExisting('地图地区[' + index + '].governorId', region.governorId, charIds);
  });
  _tmCollectAdminDivisionEntries(targetGM).forEach(function (entry, index) {
    if (entry && entry.item) requireExisting('行政区划[' + index + '].governorId', entry.item.governorId, charIds);
  });
  (function walkOffices(nodes, path) {
    (Array.isArray(nodes) ? nodes : []).forEach(function (node, nodeIndex) {
      var nodePath = path + '[' + nodeIndex + ']';
      (Array.isArray(node && node.positions) ? node.positions : []).forEach(function (position, positionIndex) {
        if (!position) return;
        var positionPath = nodePath + '.positions[' + positionIndex + ']';
        requireExisting(positionPath + '.holderId', position.holderId, charIds);
        (Array.isArray(position.actualHolders) ? position.actualHolders : []).forEach(function (holder, holderIndex) {
          if (!holder || typeof holder !== 'object') return;
          requireExisting(
            positionPath + '.actualHolders[' + holderIndex + '].characterId',
            holder.characterId,
            charIds,
          );
          requireExisting(positionPath + '.actualHolders[' + holderIndex + '].personId', holder.personId, charIds);
          requireExisting(positionPath + '.actualHolders[' + holderIndex + '].holderId', holder.holderId, charIds);
        });
      });
      var subs = Array.isArray(node && node.subs) ? node.subs : [];
      var children = Array.isArray(node && node.children) && node.children !== subs ? node.children : [];
      walkOffices(subs, nodePath + '.subs');
      walkOffices(children, nodePath + '.children');
    });
  })(targetGM.officeTree, 'officeTree');
}

// 深度优先遍历整个世界，检查每个数字都是有限值。遍历顺序与报错路径都与旧版一致。
// 绍宋一份存档约有 1430 万个数字、320 万个数组（其中 316 万个是坐标对这类只装标量的小数组）。
// 旧写法把每个值连同拼好的路径入栈，并把几百万个小数组登记进 WeakSet；渲染进程内存本就吃紧，
// 频繁 GC 每次都要重扫这张弱引用表，读档时单这一个函数就占 165 秒。现在：
//   · 标量和只装标量的数组（坐标对之类）当场查完，不入栈、不登记去重（重复出现只是多验一遍，结果相同）；
//   · 去重用普通 Set：只在本次遍历里用，用完即弃，不需要弱引用；
//   · 栈用三个平行数组，路径只在发现非法数字时沿父节点回溯拼出。
// 顺序说明：旧版把子项按键序入栈、从末尾弹出，所以展开一个节点时从最后一个子项往前处理；
// 碰到第一个还要继续展开的子项，就把它和它前面的子项按原顺序入栈，交还主循环。
// 数组上的非下标属性不是 JSON 世界正文（序列化本就不带），就地检查只看下标。
function _tmValidateFiniteWorldNumbers(root, label) {
  var stackValues = [root], stackParents = [-1], stackKeys = [label];
  var nodeParents = [], nodeKeys = [];   // 已展开节点的父节点与键，仅用于出错时回溯路径
  var seen = typeof Set === 'function' ? new Set() : null;
  function pathOf(parent, key) {
    var parts = [key];
    for (var p = parent; p !== -1; p = nodeParents[p]) parts.push(nodeKeys[p]);
    return parts.reverse().join('.');
  }
  function fail(parent, key) {
    throw new Error('存档数值非法: ' + pathOf(parent, key));
  }
  function isScalarArray(list) {
    for (var j = 0; j < list.length; j++) {
      if (list[j] !== null && typeof list[j] === 'object') return false;
    }
    return true;
  }
  function checkScalarArray(list, parent, key) {
    for (var j = list.length - 1; j >= 0; j--) {
      if (typeof list[j] === 'number' && !Number.isFinite(list[j])) {
        nodeParents.push(parent);
        nodeKeys.push(key);
        fail(nodeParents.length - 1, String(j));
      }
    }
  }
  while (stackValues.length) {
    var value = stackValues.pop(), parent = stackParents.pop(), key = stackKeys.pop();
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail(parent, key);
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value) && isScalarArray(value)) {
      checkScalarArray(value, parent, key);
      continue;
    }
    if (seen) {
      if (seen.has(value)) continue;
      seen.add(value);
    }
    var node = nodeParents.length;
    nodeParents.push(parent);
    nodeKeys.push(key);
    // Map/Set/Blob 等运行时派生容器不属于 JSON 世界正文；其内部由各自重建器负责。
    var keys = Object.keys(value);
    for (var i = keys.length - 1; i >= 0; i--) {
      var child = value[keys[i]];
      if (typeof child === 'number') {
        if (!Number.isFinite(child)) fail(node, keys[i]);
        continue;
      }
      if (!child || typeof child !== 'object') continue;
      if (Array.isArray(child) && isScalarArray(child)) {
        checkScalarArray(child, node, keys[i]);
        continue;
      }
      for (var k = 0; k <= i; k++) {
        stackValues.push(value[keys[k]]);
        stackParents.push(node);
        stackKeys.push(keys[k]);
      }
      break;
    }
  }
}

function _tmValidateLoadedWorld(targetP, targetGM) {
  if (typeof window !== 'undefined' && window.TM && TM.NativeWorld && TM.NativeWorld.enabled(targetGM))
    TM.NativeWorld.rebind(targetGM);
  if (!targetP || typeof targetP !== 'object' || Array.isArray(targetP)) throw new Error('存档 P 不是合法对象');
  if (!targetGM || typeof targetGM !== 'object' || Array.isArray(targetGM)) throw new Error('存档 GM 不是合法对象');
  var turn = Number(targetGM.turn);
  if (!Number.isSafeInteger(turn) || turn < 0) throw new Error('存档回合号非法');
  if (!String(targetGM._campaignId || '')) throw new Error('存档缺少 campaignId');
  if (!_tmEnsureTimelineIdentity(targetGM)) throw new Error('存档缺少 timelineId');
  [
    ['chars', targetGM.chars],
    ['facs', targetGM.facs],
    ['armies', targetGM.armies],
    ['officeTree', targetGM.officeTree],
  ].forEach(function (pair) {
    if (pair[1] != null && !Array.isArray(pair[1])) throw new Error('存档字段 ' + pair[0] + ' 必须为数组');
  });
  if (targetGM.mapData != null) {
    if (typeof targetGM.mapData !== 'object' || Array.isArray(targetGM.mapData)) throw new Error('运行地图结构非法');
    if (targetGM.mapData.regions != null && !Array.isArray(targetGM.mapData.regions))
      throw new Error('运行地图地区必须为数组');
    if (targetP.map === targetGM.mapData || targetP.mapData === targetGM.mapData)
      throw new Error('运行地图与剧本模板仍共享引用');
  }
  if (
    targetGM._chronicleSysState != null &&
    (typeof targetGM._chronicleSysState !== 'object' || Array.isArray(targetGM._chronicleSysState))
  ) {
    throw new Error('编年状态结构非法');
  }
  _tmValidateUniqueStableIds('人物', targetGM.chars);
  _tmValidateUniqueStableIds('势力', targetGM.facs);
  _tmValidateUniqueStableIds('军队', targetGM.armies);
  _tmValidateUniqueStableIds('地图地区', targetGM.mapData && targetGM.mapData.regions);
  _tmValidateUniqueStableIds(
    '行政区划',
    _tmCollectAdminDivisionEntries(targetGM).map(function (entry) {
      return entry.item;
    }),
  );
  _tmValidateStableForeignKeys(targetGM);
  _tmValidateFiniteWorldNumbers(targetP, 'P');
  _tmValidateFiniteWorldNumbers(targetGM, 'GM');
  return true;
}

// ---- 读档修复（2026-10-13）：与上面校验器成对的修复器。校验器只判对错，修复器在迁移阶段先把
// 自建剧本留下的重复稳定 id、悬空引用修好并留收据，修完再过校验；字段清单两边必须一致。
// 自建剧本可能在地图编辑器往返时把两个不同的行政节点写成同一个旧 id。
// 读档不能把第二个节点静默删掉，也不能把两个节点继续当成同一节点；保留
// 首个稳定 id，对后续节点按其行政路径生成确定性新 id，并只改该节点子树的
// parentId。这样旧引用仍指向首个节点，第二棵树不会再撞 ID，下一次读档幂等。
function _tmRepairDuplicateDivisionIds(targetGM, entries) {
  entries = Array.isArray(entries) ? entries : [];
  var byId = Object.create(null), used = Object.create(null), repaired = 0;
  entries.forEach(function(entry) {
    var item = entry && entry.item;
    if (!item || _tmStableIdMissing(item.id)) return;
    var id = String(item.id).trim();
    used[id] = true;
    (byId[id] || (byId[id] = [])).push(entry);
  });
  Object.keys(byId).forEach(function(oldId) {
    var collisions = byId[oldId];
    if (collisions.length < 2) return;
    collisions.slice(1).forEach(function(entry) {
      var item = entry.item;
      var identity = _tmStableIdentityParts('division', item).join('|') || String(entry.identityPath || entry.path || '');
      var seed = [targetGM && (targetGM.sid || targetGM._campaignId) || '', 'division-duplicate', oldId, entry.identityPath || entry.path || '', identity].join('|');
      var candidate = oldId + '__tmdup_' + _tmStableIdHash(seed);
      var suffix = 2;
      while (used[candidate]) candidate = oldId + '__tmdup_' + _tmStableIdHash(seed) + '_' + suffix++;
      item.id = candidate;
      used[candidate] = true;
      repaired++;
      var rootPath = String(entry.identityPath || '');
      entries.forEach(function(child) {
        if (!child || child === entry || !child.item || !rootPath) return;
        var childPath = String(child.identityPath || '');
        if (childPath.indexOf(rootPath + '/') !== 0) return;
        if (String(child.item.parentId || '').trim() === oldId) child.item.parentId = candidate;
      });
      // 地图行政绑定若同时带行政名称，可安全指向重命名后的第二节点；
      // 同名或无名称时保留旧引用，避免把一个外部引用猜给错误分支。
      var name = String(item.name || '').trim();
      var maps = [targetGM.mapData, targetGM.map];
      maps.forEach(function(map) {
        (map && Array.isArray(map.regions) ? map.regions : []).forEach(function(region) {
          if (!region || !name || String(region.name || '').trim() !== name) return;
          ['adminBinding', 'divisionId', 'adminDivisionId', 'administrativeDivisionId'].forEach(function(field) {
            if (String(region[field] == null ? '' : region[field]).trim() === oldId) region[field] = candidate;
          });
        });
      });
    });
  });
  return repaired;
}

// 人物/势力/军队/地区的重复稳定 id 同款处理（2026-10-13）：自建剧本经国师批量改写或地图
// 编辑器往返后，同一数组里可能出现两个同 id 的实体。校验器原本直接拒载整档；这里保留首个，
// 后续实体按语义身份派生确定性新 id。旧引用仍指向首个（两者共用 id 时引用本就分不清），
// 再读一次档不会再改。行政区划走上面那条带子树 parentId 的专用路径。
function _tmRepairDuplicateEntityIds(targetGM, kind, entries) {
  if (kind === 'division') return _tmRepairDuplicateDivisionIds(targetGM, entries);
  entries = Array.isArray(entries) ? entries : [];
  var byId = Object.create(null), used = Object.create(null), repaired = 0;
  entries.forEach(function(entry) {
    var item = entry && entry.item;
    if (!item || _tmStableIdMissing(item.id)) return;
    var id = String(item.id).trim();
    used[id] = true;
    (byId[id] || (byId[id] = [])).push(entry);
  });
  Object.keys(byId).forEach(function(oldId) {
    var collisions = byId[oldId];
    if (collisions.length < 2) return;
    collisions.slice(1).forEach(function(entry) {
      var item = entry.item;
      var identity = _tmStableIdentityParts(kind, item).join('|') || String(entry.path || '');
      var seed = [targetGM && (targetGM.sid || targetGM._campaignId) || '', kind + '-duplicate', oldId, entry.path || '', identity].join('|');
      var candidate = oldId + '__tmdup_' + _tmStableIdHash(seed);
      var suffix = 2;
      while (used[candidate]) candidate = oldId + '__tmdup_' + _tmStableIdHash(seed) + '_' + suffix++;
      item.id = candidate; // arch-ok: 读档 schema 迁移·重复稳定 id 的确定性重写
      used[candidate] = true;
      repaired++;
    });
  });
  return repaired;
}

// 悬空稳定引用修复（2026-10-13·玩家自建剧本「地图地区[418].factionId 指向不存在的稳定 id：台湾诸部」拒载案）。
// 校验器要求每条外键都指向存在的实体；自建剧本经国师/地图编辑器往返后，常留下指向已改名、
// 已删除势力或人物的旧 id，甚至把势力名直接写进 factionId。一条悬空引用不该让整档拒载：
//   ① 引用值本身若等于某个唯一实体名，按名找回；
//   ② 找不回就把这条引用清空（owner / father / holder 等显示名字段原样保留），形态与从未写过
//      稳定 id 的旧档一致，引擎本就按名称兜底；
//   ③ 每一笔都写进 _stableIdMigration.danglingDetails 收据，诊断面板与玩家回报可查。
// 字段清单与 tm-save-world-validation.js 的 _tmValidateStableForeignKeys 一一对应；
// smoke-stable-id-dangling-repair.js 会在修完后再跑一遍校验器，两边漏配立刻红。
function _tmClearDanglingStableRefs(targetGM) {
  var receipts = [];
  if (!targetGM || typeof targetGM !== 'object') return receipts;
  var factionIds = _tmEntityIdSet(targetGM.facs);
  var charIds = _tmEntityIdSet(targetGM.chars);
  var factionByName = _tmUniqueEntityIdByName(targetGM.facs);
  var charByName = _tmUniqueEntityIdByName(targetGM.chars);
  function resolve(value, idSet, nameMap) {
    if (_tmStableIdMissing(value)) return { ok: true };
    var key = String(value).trim();
    if (idSet[key]) return { ok: true };
    if (nameMap[key] != null) return { ok: true, replace: nameMap[key] };
    return { ok: false };
  }
  function fixField(owner, field, label, idSet, nameMap) {
    if (!owner || typeof owner !== 'object') return;
    var found = resolve(owner[field], idSet, nameMap);
    if (found.ok) {
      if (found.replace != null) {
        receipts.push({ path: label, field: field, from: owner[field], to: found.replace, action: 'renamed' });
        owner[field] = found.replace; // arch-ok: 读档 schema 迁移·势力名/人名写成 id 的引用按名找回
      }
      return;
    }
    receipts.push({ path: label, field: field, from: owner[field], action: 'cleared' });
    delete owner[field]; // arch-ok: 读档 schema 迁移·悬空引用退回旧档的按名形态
  }
  function fixArray(owner, field, label, idSet, nameMap) {
    if (!owner || !Array.isArray(owner[field])) return;
    var kept = [], changed = false;
    owner[field].forEach(function(value, index) {
      var found = resolve(value, idSet, nameMap);
      if (found.ok) {
        if (found.replace != null) {
          receipts.push({ path: label + '[' + index + ']', field: field, from: value, to: found.replace, action: 'renamed' });
          changed = true;
          kept.push(found.replace);
        } else kept.push(value);
        return;
      }
      receipts.push({ path: label + '[' + index + ']', field: field, from: value, action: 'removed' });
      changed = true;
    });
    if (changed) owner[field] = kept; // arch-ok: 读档 schema 迁移·剔除悬空的数组引用
  }
  (targetGM.chars || []).forEach(function(ch, index) {
    if (!ch) return;
    var label = '人物[' + index + ']';
    fixField(ch, 'factionId', label, factionIds, factionByName);
    ['fatherId', 'motherId', 'spouseId', 'mentorId', 'designatedHeirId'].forEach(function(field) {
      fixField(ch, field, label, charIds, charByName);
    });
    ['childrenIds', 'studentIds', 'studentsIds', 'relativeIds'].forEach(function(field) {
      fixArray(ch, field, label + '.' + field, charIds, charByName);
    });
    (Array.isArray(ch.familyMembers) ? ch.familyMembers : []).forEach(function(member, memberIndex) {
      if (!member || typeof member !== 'object') return;
      fixField(member, 'characterId', label + '.familyMembers[' + memberIndex + ']', charIds, charByName);
      fixField(member, 'personId', label + '.familyMembers[' + memberIndex + ']', charIds, charByName);
    });
  });
  if (targetGM.harem && typeof targetGM.harem === 'object') {
    fixField(targetGM.harem, 'crownPrinceId', '后宫', charIds, charByName);
  }
  (targetGM.facs || []).forEach(function(faction, index) {
    if (!faction) return;
    var label = '势力[' + index + ']';
    ['leaderId', 'coLeaderId', 'heirId'].forEach(function(field) { fixField(faction, field, label, charIds, charByName); });
    fixArray(faction, 'memberIds', label + '.memberIds', charIds, charByName);
  });
  (targetGM.armies || []).forEach(function(army, index) {
    if (!army) return;
    fixField(army, 'commanderId', '军队[' + index + ']', charIds, charByName);
    fixField(army, 'factionId', '军队[' + index + ']', factionIds, factionByName);
  });
  var regions = targetGM.mapData && targetGM.mapData.regions;
  (Array.isArray(regions) ? regions : []).forEach(function(region, index) {
    if (!region) return;
    fixField(region, 'factionId', '地图地区[' + index + ']', factionIds, factionByName);
    fixField(region, 'governorId', '地图地区[' + index + ']', charIds, charByName);
  });
  _tmCollectAdminDivisionEntries(targetGM).forEach(function(entry, index) {
    if (entry && entry.item) fixField(entry.item, 'governorId', '行政区划[' + index + ']', charIds, charByName);
  });
  (function walkOffices(nodes, path) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node, nodeIndex) {
      var nodePath = path + '[' + nodeIndex + ']';
      (Array.isArray(node && node.positions) ? node.positions : []).forEach(function(position, positionIndex) {
        if (!position) return;
        var positionPath = nodePath + '.positions[' + positionIndex + ']';
        fixField(position, 'holderId', positionPath, charIds, charByName);
        (Array.isArray(position.actualHolders) ? position.actualHolders : []).forEach(function(holder, holderIndex) {
          if (!holder || typeof holder !== 'object') return;
          var holderPath = positionPath + '.actualHolders[' + holderIndex + ']';
          ['characterId', 'personId', 'holderId'].forEach(function(field) { fixField(holder, field, holderPath, charIds, charByName); });
        });
      });
      var subs = Array.isArray(node && node.subs) ? node.subs : [];
      var children = Array.isArray(node && node.children) && node.children !== subs ? node.children : [];
      walkOffices(subs, nodePath + '.subs');
      walkOffices(children, nodePath + '.children');
    });
  })(targetGM.officeTree, 'officeTree');
  return receipts;
}
