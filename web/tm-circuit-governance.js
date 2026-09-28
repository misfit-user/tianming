/* tm-circuit-governance.js — 省道长官的只读绑定与履职视图
 * 只读取 GM 的行政树、官制树、人物与地图，不初始化状态，不产生机械效果。
 */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.TM = root.TM || {};
    root.TM.CircuitGovernance = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // 缺值转空串，保留全等匹配所需的原始文字。
  function text(value) { return value == null ? '' : String(value); }

  // 每次读取建立局部索引，批量接口复用一次；不把索引或缓存写回官制树。
  function officeIndex(gm) {
    var index = { rows: [], ids: new Map(), paths: new Map(), regions: new Map() };
    // 显式绑定按遍历顺序取首个精确匹配，和递归查找顺序一致。
    function first(map, key, row) { if (key != null && key !== '' && !map.has(key)) map.set(key, row); }
    // 部门名取直接挂职位的节点，子部门不会继承父部门名。
    function walk(nodes) {
      (Array.isArray(nodes) ? nodes : []).forEach(function (dept) {
        if (!dept) return;
        (Array.isArray(dept.positions) ? dept.positions : []).forEach(function (position) {
          if (!position) return;
          var row = { position: position, dept: text(dept.name) };
          index.rows.push(row);
          first(index.ids, position.id, row);
          first(index.paths, text(dept.name) + '/' + text(position.name), row);
          first(index.regions, position.regionId, row);
        });
        walk(dept.subs);
      });
    }
    walk(gm && gm.officeTree);
    return index;
  }

  // 按显式绑定、行政节点 id、官衔依次查找；按名有歧义时只以原载长官消歧。
  function resolveIndexed(index, adminNode) {
    if (!adminNode) return null;
    var ref = adminNode.governorOffice, hit = null, source = null;
    if (typeof ref === 'string' && ref) {
      hit = (ref.indexOf('/') >= 0 ? index.paths : index.ids).get(ref);
      if (hit) source = 'governorOffice';
    }
    if (!hit && adminNode.id != null && adminNode.id !== '') {
      hit = index.regions.get(adminNode.id);
      if (hit) source = 'regionId';
    }
    if (!hit && adminNode.officialPosition) {
      var name = adminNode.officialPosition;
      var candidates = index.rows.filter(function (row) {
        var title = text(row.position.name);
        return title === name || title.indexOf(name + '(') === 0 || title.indexOf(name + '（') === 0;
      });
      if (candidates.length > 1) candidates = candidates.filter(function (row) { return row.position.holder === adminNode.governor; });
      if (candidates.length === 1) { hit = candidates[0]; source = 'name'; }
    }
    return hit ? { position: hit.position, dept: hit.dept, source: source } : null;
  }

  // 单个省道行政节点的职位绑定；无匹配或仍有歧义时不猜测。
  function resolveGovernorPosition(gm, adminNode) {
    return resolveIndexed(officeIndex(gm), adminNode);
  }

  // 法定首府以行政节点为准，兼容州节点 id、地块 id 和旧首府名称。
  function seatRegionId(gm, circuit, adminNode) {
    var members = (circuit && circuit.members || []).map(function (member) { return member.region; });
    var regions = gm && gm.mapData && gm.mapData.regions || members;
    var capital = text(adminNode && (adminNode.capitalChildId || adminNode.capital));
    var entry = circuit && circuit.entry || {};
    if (!capital) capital = text(entry.capitalRegionId);
    if (capital) {
      var region = regions.filter(function (r) { return text(r.id) === capital || text(r.adminBinding) === capital; })[0];
      if (region) return text(region.id);
      var child = null;
      // 旧行政树有不同的下辖字段；仅查首府对应的节点，不改父子关系。
      function walk(node) {
        if (!node || child) return;
        if (text(node.id) === capital) { child = node; return; }
        ['children', 'divisions', 'prefectures', 'subDivisions', 'subs'].forEach(function (key) {
          (Array.isArray(node[key]) ? node[key] : []).forEach(walk);
        });
      }
      walk(adminNode);
      var name = child && child.name || capital;
      var named = members.filter(function (r) { return r.name === name || r.title === name; });
      if (!named.length) named = regions.filter(function (r) { return r.name === name || r.title === name; });
      return named.length === 1 ? text(named[0].id) : '';
    }
    var flagged = members.filter(function (r) { return r.capital === true || (r.data && r.data.capital === true); });
    return flagged.length ? text(flagged[0].id) : '';
  }

  // 组装只读视图：无单一主官优先，其次区分未绑定、出缺、赴任与在任。
  function governorView(gm, circuit, ownerKey, index) {
    var division = root.TM && root.TM.DivisionReassign;
    var key = text(circuit && circuit.key);
    var node = division && typeof division.circuitAdminNode === 'function' ? division.circuitAdminNode(gm, key, ownerKey) : null;
    var view = {
      circuitKey: key, adminNodeId: text(node && node.id),
      note: node && node.governanceNote || null, noteDetail: node && node.governanceDetail || null,
      status: 'unbound', position: null, source: null, holderName: '', travelDaysLeft: null,
      ability: null, fulfillment: null, band: null, seatRegionId: seatRegionId(gm, circuit, node)
    };
    if (view.note) { view.status = 'note'; return view; }
    var binding = resolveIndexed(index, node);
    if (!binding) return view;
    var position = binding.position;
    view.position = { name: text(position.name), dept: binding.dept, rank: position.rank == null ? null : position.rank };
    view.source = binding.source;
    var holderState=root.TM&&root.TM.OfficeHolderState;
    var occupancy=holderState?holderState.read(gm,position):null;
    view.holderName=occupancy?occupancy.label:text(position.holder);
    var ch=occupancy?occupancy.primary:null;
    var duty = typeof root.officeDutyView === 'function' ? root.officeDutyView(gm, position) : null;
    if (duty) { view.fulfillment = duty.fulfillment; view.band = duty.band; }
    if (occupancy ? !occupancy.occupied || ch && (ch.alive === false || ch.dead === true) : !ch) { view.status = 'vacant'; return view; }
    view.status = ch && ch._travelTo && ch._travelRemainingDays > 0 ? 'travelling' : 'serving';
    view.travelDaysLeft = view.status === 'travelling' ? Number(ch._travelRemainingDays) : null;
    view.ability = duty ? duty.capacity : null;
    return view;
  }

  // 单道长官视图，每次读取当前运行态，不复用上次任免前的缓存。
  function governorOf(gm, circuit, ownerKey) {
    return governorView(gm, circuit, ownerKey, officeIndex(gm));
  }

  // 批量读取只建立一次官制索引，各道仍使用本方行政节点。
  function listGovernors(gm, circuits, ownerKey) {
    var index = officeIndex(gm);
    return (circuits || []).map(function (circuit) { return governorView(gm, circuit, ownerKey, index); });
  }

  // 本方名称只取玩家配置，与现有通志的势力名称源一致。
  function playerFactionName(gm) {
    return (root.P && root.P.playerInfo && root.P.playerInfo.factionName) || '';
  }

  // 先解析势力 id，再兼容按名称记归属的地图；只读既有势力登记。
  function isPlayerRegion(gm, region) {
    if (!region) return false;
    var owner = region.currentOwner || region.owner || region.factionId;
    var membership = root.TM && root.TM.FactionMembership;
    var faction = membership && typeof membership.findFacById === 'function' ? membership.findFacById(owner) : null;
    if (!faction) faction = ((gm && gm.facs) || []).find(function (fac) { return fac.name === owner; });
    return (faction ? faction.name : owner) === playerFactionName(gm);
  }

  // 直接用地图登记组装省道，保留完整成员与 entry，供驻地和长官读口复用。
  function playerCircuits(gm) {
    var map = gm && gm.mapData || {}, regions = map.regions || [];
    return (map.circuitRegistry || []).map(function (entry) {
      var ids = new Set((entry.memberRegionIds || []).map(text));
      return { key: text(entry.key || entry.id), label: entry.name, entry: entry,
        members: regions.filter(function (region) { return ids.has(text(region.id)); }).map(function (region) { return { region: region }; }) };
    }).filter(function (circuit) { return circuit.members.some(function (member) { return isPlayerRegion(gm, member.region); }); });
  }

  // 全国履职结算每次调用前取一次集合，职位身份直接复用运行态对象。
  function governorPositions(gm) {
    var positions = new Set(), division = root.TM && root.TM.DivisionReassign, index = officeIndex(gm);
    if (!division) return positions;
    playerCircuits(gm).forEach(function (circuit) {
      var member = circuit.members.find(function (item) { return isPlayerRegion(gm, item.region); });
      var node = division.circuitAdminNode(gm, circuit.key, division.ownerKeyOf(member.region));
      var binding = resolveIndexed(index, node);
      if (binding) positions.add(binding.position);
    });
    return positions;
  }

  return { playerFactionName: playerFactionName, isPlayerRegion: isPlayerRegion, playerCircuits: playerCircuits, governorPositions: governorPositions, resolveGovernorPosition: resolveGovernorPosition, governorOf: governorOf, listGovernors: listGovernors };
});
