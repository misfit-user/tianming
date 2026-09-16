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

function _tmValidateFiniteWorldNumbers(root, label) {
  var stack = [{ value: root, path: label }];
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  while (stack.length) {
    var current = stack.pop();
    var value = current.value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('存档数值非法: ' + current.path);
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (seen) {
      if (seen.has(value)) continue;
      seen.add(value);
    }
    // Map/Set/Blob 等运行时派生容器不属于 JSON 世界正文；其内部由各自重建器负责。
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      stack.push({ value: value[keys[i]], path: current.path + '.' + keys[i] });
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
