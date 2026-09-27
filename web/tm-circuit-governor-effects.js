/* tm-circuit-governor-effects.js — 省道主官履职的唯一落账口，每回合只作用本方本道叶子。 */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.TM = root.TM || {};
    root.TM.CircuitGovernorEffects = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  var MULTIPLIERS = { light: 0.5, normal: 1, strong: 2 };
  var CHILD_KEYS = ['children', 'divisions', 'subDivisions', 'subs'];

  // 新旧存档未设置时都开启，不初始化玩家设置。
  function enabled() {
    return !(root.P && root.P.conf && root.P.conf.circuitGovernorEffects === false);
  }

  // 只接受三档力度，未知值回到中档。
  function strength() {
    var value = root.P && root.P.conf && root.P.conf.circuitGovernorStrength;
    return value === 'light' || value === 'strong' ? value : 'normal';
  }

  // 执行率与腐败分别受各自边界约束。
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }

  // 只索引本方行政树的末级节点，不读取省道汇总数字。
  function leafIndex(GM) {
    var index = { ids: new Map(), names: new Map() };
    // 与改隶 kidsOf 同口径：取首个下辖数组，不把兼容字段的影子树重复算账。
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      var key = CHILD_KEYS.find(function (name) { return Array.isArray(node[name]); });
      var children = key ? node[key] : [];
      if (children.length) { children.forEach(walk); return; }
      if (/province|circuit/.test(String(node.level || node.regionType || ''))) return;
      if (node.id != null && !index.ids.has(String(node.id))) index.ids.set(String(node.id), node);
      if (node.name) {
        var named = index.names.get(String(node.name)) || [];
        named.push(node); index.names.set(String(node.name), named);
      }
    }
    walk(GM.adminHierarchy && GM.adminHierarchy.player);
    return index;
  }

  // 地块所有记账叶子都取出；完全没有 id 命中时才按名称兜底。
  function regionLeaves(index, region) {
    var ids = [region.adminBinding].concat(region.accountingLeafIds || [], [region.id]);
    var leaves = [];
    ids.forEach(function (id) {
      var leaf = id != null && index.ids.get(String(id));
      if (leaf && leaves.indexOf(leaf) < 0) leaves.push(leaf);
    });
    return leaves.length ? leaves : (index.names.get(String(region.name)) || []);
  }

  // 单回合推进、落账与退潮；关闭或同回合再调时不写任何状态。
  function tick(GM, P) {
    if (!enabled()) return { skipped: 'disabled' };
    if (!GM) return { skipped: 'missingGame' };
    if (GM.circuitGovernance && GM.circuitGovernance.turn === GM.turn) return { skipped: 'alreadyTicked' };
    var TM = root.TM || {}, governance = TM.CircuitGovernance, division = TM.DivisionReassign, route = TM.MapRouteDays;
    if (!governance || !division || !route || typeof root.tickDutyPosition !== 'function') return { skipped: 'missingModule' };
    var m = typeof root._getDaysPerTurn === 'function' ? root._getDaysPerTurn() / 30 : 1;
    var s = MULTIPLIERS[strength()], map = GM.mapData || {}, turn = GM.turn;
    var ledger = GM.circuitGovernance || (GM.circuitGovernance = { v: 1, turn: null, byLeaf: {}, byCircuit: {} });
    var index = leafIndex(GM), touched = new Set(), applied = new Set(), high = [], low = [];
    var circuits = governance.playerCircuits(GM);
    var summary = { circuits: circuits.length, leaves: 0, serving: 0, vacant: 0, travelling: 0, seatLost: 0 };
    // 上回合各道档位留作对照：事件簿只记档位有变的道，免得每回合重复列出同一批称职、失职
    var previous = ledger.byCircuit || {};
    ledger.byCircuit = {};
    circuits.forEach(function (circuit) {
      var own = circuit.members.map(function (member) { return member.region; }).filter(function (region) { return governance.isPlayerRegion(GM, region); });
      var owner = division.ownerKeyOf(own[0]), view = governance.governorOf(GM, circuit, owner);
      var row = { status: view.status, turn: turn };
      ledger.byCircuit[circuit.key] = row;
      if (view.status === 'note' || view.status === 'unbound') return;
      var binding = governance.resolveGovernorPosition(GM, division.circuitAdminNode(GM, circuit.key, owner));
      var advanced = root.tickDutyPosition(GM, binding.position, { frozen: view.status === 'travelling' });
      row.holder = view.status === 'vacant' ? '' : view.holderName;
      row.fulfillment = advanced.next; row.band = advanced.band; row.E = clamp((advanced.next - 50) / 50, -1, 1);
      row.seatRegionId = view.seatRegionId; row.execAvg = 0; row.corrMonthly = 0;
      if (view.status === 'travelling') {
        summary.travelling++;
        // 赴任期冻结既有修正，既不叠加也不退潮；新任到达后再恢复本道推进。
        own.forEach(function (region) { regionLeaves(index, region).forEach(function (leaf) {
          var old = ledger.byLeaf[leaf.id];
          if (old && old.circuitKey === circuit.key) touched.add(String(leaf.id));
        }); });
        return;
      }
      var seat = (map.regions || []).find(function (region) { return String(region.id) === view.seatRegionId; });
      if (!seat || !governance.isPlayerRegion(GM, seat)) { row.status = 'seatLost'; summary.seatLost++; return; }
      summary[view.status]++;
      var distances = route.routeDays(map, seat), values = [];
      row.corrMonthly = -0.8 * s * row.E;
      own.forEach(function (region) {
        var trip = distances.get(String(region.id)) || { days: route.DEFAULT_DAYS, estimated: true };
        var R = 1 / (1 + trip.days / 15);
        regionLeaves(index, region).forEach(function (leaf) {
          var id = String(leaf.id);
          if (touched.has(id)) return;
          touched.add(id); applied.add(id);
          var old = ledger.byLeaf[id], prev = old && Number.isFinite(old.exec) ? old.exec : 0;
          var exec = clamp(prev + 0.03 * s * row.E * R * m, -0.06 * s, 0.06 * s);
          ledger.byLeaf[id] = { exec: exec, circuitKey: circuit.key, holder: row.holder, days: trip.days, estimated: trip.estimated, R: R, E: row.E, turn: turn };
          if (Number.isFinite(leaf.corruption)) leaf.corruption = clamp(leaf.corruption + row.corrMonthly * R * m, 0, 100);
          values.push(exec);
        });
      });
      row.execAvg = values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
      var changed = (previous[circuit.key] || {}).band !== advanced.band;
      if (changed && advanced.band === 'high') high.push(circuit.label);
      if (changed && advanced.band === 'low') low.push(circuit.label);
    });
    Object.keys(ledger.byLeaf).forEach(function (id) {
      if (touched.has(id)) return;
      var row = ledger.byLeaf[id], value = Number.isFinite(row.exec) ? row.exec : 0;
      row.exec = Math.sign(value) * Math.max(0, Math.abs(value) - 0.03 * s * m);
      row.turn = turn;
      if (row.exec === 0) delete ledger.byLeaf[id];
    });
    ledger.turn = turn; summary.leaves = applied.size;
    var segments = [];
    if (high.length) segments.push('称职：' + high.join('、'));
    if (low.length) segments.push('失职：' + low.join('、'));
    if (segments.length && typeof root.addEB === 'function') root.addEB('官制', '省道长官·' + segments.join('；'));
    return summary;
  }

  return { enabled: enabled, strength: strength, tick: tick };
});
