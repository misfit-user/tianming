// 晚唐外藩一刀的共用操作：跨势力改挂地块、撤销势力、势力与区划改名、删人物及其引用。
// 各函数直接改传入的剧本对象；mapData 由调用方最后按 map 重新生成（tang-redistribute.js 的 refreshLedgers 会做）。
'use strict';

// 地块上记归属的各字段（map.regions 与 mapData.regions 同形）
const OWNER_FIELDS = ['owner', 'currentOwner', 'initialOwner', 'controller', 'ownerKey', 'currentOwnerKey', 'initialOwnerKey', 'controllerKey',
  'stableFactionId', 'factionId', 'factionName', 'ownerName'];
// 军队上记归属的各字段
const TROOP_FACTION_FIELDS = ['faction', 'factionId', 'ownerFactionId', 'payingFactionId'];
// 史料引文照录原文，改名不碰
const QUOTE_KEYS = new Set(['historicalSources', 'quotes', 'sources', 'evidence']);

function factionByName(scenario, name) {
  const f = scenario.factions.find((x) => x.name === name);
  if (!f) throw new Error('没有这个势力：' + name);
  return f;
}

// 在各行政树里找地块：{ treeKey, circuit, leaf }
function findLeaf(scenario, leafId) {
  for (const treeKey of Object.keys(scenario.adminHierarchy)) {
    for (const circuit of scenario.adminHierarchy[treeKey].divisions || []) {
      const leaf = (circuit.children || []).find((l) => l.id === leafId);
      if (leaf) return { treeKey, circuit, leaf };
    }
  }
  throw new Error('行政树里没有地块 ' + leafId);
}

function findCircuit(scenario, circuitId) {
  for (const treeKey of Object.keys(scenario.adminHierarchy)) {
    const circuit = (scenario.adminHierarchy[treeKey].divisions || []).find((c) => c.id === circuitId);
    if (circuit) return { treeKey, circuit };
  }
  throw new Error('行政树里没有道 ' + circuitId);
}

function regionOf(scenario, leaf) {
  const r = scenario.map.regions.find((x) => x.id === leaf.mapRegionId);
  if (!r) throw new Error('地图上没有地块 ' + leaf.mapRegionId);
  return r;
}

function setRegionOwner(region, faction) {
  OWNER_FIELDS.forEach((k) => { if (k in region) region[k] = faction.name; });
  if ('color' in region) region.color = faction.color;
  if ('factionColor' in region) region.factionColor = faction.color;
  if (region.data && 'dejureOwner' in region.data) region.data.dejureOwner = faction.name;
}

// 把一块地从原势力的道改挂到另一势力的道：行政树、地图、省道登记、诸库、两家的财政账、势力领地、驻军、城市
function moveLeaf(scenario, leafId, toCircuitId) {
  const from = findLeaf(scenario, leafId);
  const to = findCircuit(scenario, toCircuitId);
  const fromFaction = factionByName(scenario, from.treeKey);
  const toFaction = factionByName(scenario, to.treeKey);
  const leaf = from.leaf;
  const sibling = (to.circuit.children || [])[0] || null;

  // 行政树
  from.circuit.children = from.circuit.children.filter((l) => l !== leaf);
  to.circuit.children.push(leaf);
  Object.assign(leaf, { parentId: to.circuit.id, circuitName: to.circuit.name });
  if ('parentDivisionId' in leaf) leaf.parentDivisionId = to.circuit.id;
  if ('dejureOwner' in leaf) leaf.dejureOwner = toFaction.name;
  if ('factionId' in leaf) leaf.factionId = toFaction.name;

  // 地图
  const region = regionOf(scenario, leaf);
  Object.assign(region, { parentId: to.circuit.id, circuitName: to.circuit.name });
  region.office = sibling ? regionOf(scenario, sibling).office : to.circuit.name;
  setRegionOwner(region, toFaction);

  // 省道登记与诸库
  const registry = (id) => scenario.map.circuitRegistry.find((r) => r.key === id);
  const fromReg = registry(from.circuit.id);
  if (fromReg) fromReg.memberRegionIds = fromReg.memberRegionIds.filter((id) => id !== leaf.id);
  const toReg = registry(to.circuit.id);
  if (!toReg) throw new Error(to.circuit.name + ' 没有省道登记');
  toReg.memberRegionIds.push(leaf.id);
  const accounts = scenario.publicTreasuryConfig.accounts;
  const fromPool = accounts.find((a) => a.id === 'pool:' + from.circuit.id);
  if (fromPool) fromPool.members = fromPool.members.filter((m) => m !== 'region:' + leaf.id);
  const toPool = accounts.find((a) => a.id === 'pool:' + to.circuit.id);
  if (toPool && !toPool.members.includes('region:' + leaf.id)) toPool.members.push('region:' + leaf.id);
  accounts.forEach((a) => { if (a.id === 'region:' + leaf.id) a.factionId = toFaction.name; });

  // 两家的财政账：本块的吏员与地方开支挪到新主账上，名目照新主同道邻块的写法改（同一势力内换道则不动）
  const moveItems = (key, match) => {
    if (fromFaction === toFaction) return;
    const src = (fromFaction.fiscalConfig && fromFaction.fiscalConfig.fixedExpense && fromFaction.fiscalConfig.fixedExpense[key]) || [];
    const dst = toFaction.fiscalConfig.fixedExpense[key];
    const moving = src.filter(match);
    fromFaction.fiscalConfig.fixedExpense[key] = src.filter((x) => !match(x));
    const siblingItem = sibling ? dst.find((x) => x.regionId === sibling.id) : null;
    moving.forEach((item) => {
      if (siblingItem && siblingItem.name.startsWith(sibling.name)) item.name = leaf.name + siblingItem.name.slice(sibling.name.length);
      if (siblingItem) ['sourceTag', 'sourceName'].forEach((k) => { if (k in siblingItem) item[k] = siblingItem[k]; });
      dst.push(item);
    });
  };
  moveItems('administrativeStaff', (x) => x.regionId === leaf.id);
  moveItems('recurringExpenses', (x) => x.regionId === leaf.id || x.id === 'local-' + leaf.id || String(x.id).startsWith('local-' + leaf.id + '-'));

  // 势力领地
  fromFaction.territories = (fromFaction.territories || []).filter((id) => id !== leaf.id);
  if (!toFaction.territories.includes(leaf.id)) toFaction.territories.push(leaf.id);

  // 驻军与城市
  scenario.military.initialTroops.forEach((t) => {
    if (t.garrison !== leaf.id && t.garrison !== leaf.name && t.location !== leaf.id) return;
    if (t.faction !== fromFaction.name) return;
    TROOP_FACTION_FIELDS.forEach((k) => { if (k in t) t[k] = toFaction.name; });
    if (t.funding && t.funding.factionId === fromFaction.name) t.funding.factionId = toFaction.name;
  });
  scenario.cities.forEach((c) => { if (c.regionId === leaf.mapRegionId && c.faction === fromFaction.name) c.faction = toFaction.name; });

  return { leaf, from: from.treeKey, fromCircuit: from.circuit.name, to: to.treeKey, toCircuit: to.circuit.name };
}

// 撤销已无领地的势力：势力表、地图势力表、行政树、官制登记、省道登记与诸库、关系、财政账户
function dissolveFaction(scenario, name) {
  const faction = factionByName(scenario, name);
  const tree = scenario.adminHierarchy[name];
  const left = (tree.divisions || []).reduce((n, c) => n + (c.children || []).length, 0);
  if (left) throw new Error(name + ' 仍有 ' + left + ' 块地，不能撤销');
  const circuitIds = new Set((tree.divisions || []).map((c) => c.id));
  scenario.factions = scenario.factions.filter((f) => f !== faction);
  delete scenario.map.factions[name];
  delete scenario.adminHierarchy[name];
  if (scenario.officeRegistryByFaction) delete scenario.officeRegistryByFaction[name];
  scenario.map.circuitRegistry = scenario.map.circuitRegistry.filter((r) => !circuitIds.has(r.key));
  scenario.publicTreasuryConfig.accounts = scenario.publicTreasuryConfig.accounts.filter((a) =>
    a.factionId !== name && ![...circuitIds].some((id) => a.id === 'pool:' + id));
  scenario.factionRelations = scenario.factionRelations.filter((r) => r.from !== name && r.to !== name);
  const orphanTroops = scenario.military.initialTroops.filter((t) => t.faction === name);
  if (orphanTroops.length) throw new Error(name + ' 仍有军队：' + orphanTroops.map((t) => t.name).join('、'));
}

// 深度改串：值等于 from 的改为 to；键等于 from 的原位改键，保持键的先后（引文不碰）
function swapExact(node, from, to, counter) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (v === from) { node[i] = to; counter.n += 1; } else if (v && typeof v === 'object') swapExact(v, from, to, counter);
    });
    return;
  }
  if (Object.prototype.hasOwnProperty.call(node, from)) {
    const entries = Object.entries(node);
    Object.keys(node).forEach((k) => { delete node[k]; });
    entries.forEach(([k, v]) => { node[k === from ? to : k] = v; });
    counter.n += 1;
  }
  Object.keys(node).forEach((k) => {
    if (QUOTE_KEYS.has(k)) return;
    const v = node[k];
    if (v === from) { node[k] = to; counter.n += 1; } else if (v && typeof v === 'object') swapExact(v, from, to, counter);
  });
}

// 势力改名：势力 id 就是势力名，全剧本按整串改（键与值），再按前缀改派生名目
function renameFaction(scenario, from, to) {
  if (scenario.factions.some((f) => f.name === to)) throw new Error('已有势力叫 ' + to);
  const counter = { n: 0 };
  swapExact(scenario, from, to, counter);
  return counter.n;
}

// 道改名：行政树、地图各块的道名与机构名、省道登记、诸库账户名
function renameCircuit(scenario, circuitId, name) {
  const { circuit } = findCircuit(scenario, circuitId);
  const old = circuit.name;
  circuit.name = name;
  (circuit.children || []).forEach((leaf) => {
    if (leaf.circuitName === old) leaf.circuitName = name;
    const region = regionOf(scenario, leaf);
    if (region.circuitName === old) region.circuitName = name;
    if (region.office === old) region.office = name;
    if (region.data && region.data.circuitName === old) region.data.circuitName = name;
  });
  scenario.map.circuitRegistry.forEach((r) => { if (r.key === circuitId) r.name = name; });
  scenario.publicTreasuryConfig.accounts.forEach((a) => {
    if (a.id === 'pool:' + circuitId && a.name.startsWith(old)) a.name = name + a.name.slice(old.length);
  });
  return old;
}

// 地块改名：地图各名目字段、行政树、城市、驻军的驻地名，以及按本块 id 挂着的派生名目（吏员、地方开支、诸库、驻军名与说明）。
// 外藩有与唐州同名的地块（新罗康州、朔州、汉州），所以一律按地块 id 找，不按名字找；人物的所在只改本块现主与原主（formerOwner）两家的。
function renameLeaf(scenario, leafId, name, formerOwner) {
  const { treeKey, leaf } = findLeaf(scenario, leafId);
  const old = leaf.name;
  if (old === name) return old;
  const faction = factionByName(scenario, treeKey);
  leaf.name = name;
  const region = regionOf(scenario, leaf);
  ['name', 'title', 'provinceName', 'capital'].forEach((k) => { if (region[k] === old) region[k] = name; });
  if (region.data && region.data.name === old) region.data.name = name;
  (scenario.map.localityLayer || []).forEach((x) => {
    if (x.regionId !== leaf.mapRegionId) return;
    if (x.name === old) x.name = name;
    if (x.localityName === old) x.localityName = name;
  });
  scenario.cities.forEach((c) => { if (c.regionId === leaf.mapRegionId && c.name === old) c.name = name; });
  const prefix = (s) => (typeof s === 'string' && s.startsWith(old) ? name + s.slice(old.length) : s);
  const fe = (faction.fiscalConfig && faction.fiscalConfig.fixedExpense) || {};
  (fe.administrativeStaff || []).forEach((x) => { if (x.regionId === leaf.id) x.name = prefix(x.name); });
  (fe.recurringExpenses || []).forEach((x) => { if (x.regionId === leaf.id || x.id === 'local-' + leaf.id) x.name = prefix(x.name); });
  scenario.publicTreasuryConfig.accounts.forEach((a) => { if (a.id === 'region:' + leaf.id) a.name = prefix(a.name); });
  scenario.military.initialTroops.forEach((t) => {
    if (t.garrison !== leaf.id && t.location !== leaf.id) return;
    ['regionHint', 'garrisonName', 'locationName'].forEach((k) => { if (t[k] === old) t[k] = name; });
    ['name', 'description', 'commandAuthority'].forEach((k) => { t[k] = prefix(t[k]); });
  });
  const owners = new Set([faction.name, formerOwner].filter(Boolean));
  scenario.characters.forEach((c) => { if (c.location === old && owners.has(c.faction)) c.location = name; });
  return old;
}

// 删人物及其一切引用：人物表、五常参考档、各人关系表与顶层关系、军队统兵与领饷、阶层代表、物品、家户、恩怨、官职、家产登记。
// 军队统兵官空缺，说明里的人名改称「守将」；官职改为「未记在任者」。bump(项, 数) 记账供报告用。
function removeCharacters(scenario, wuchang, chars, bump) {
  const ids = new Set(chars.map((c) => c.id));
  const names = new Set(chars.map((c) => c.name));
  const hit = (x) => ids.has(x) || names.has(x);
  scenario.characters = scenario.characters.filter((c) => !ids.has(c.id));
  bump('人物删去', chars.length);
  chars.forEach((c) => { if (wuchang.characters[c.id]) { delete wuchang.characters[c.id]; bump('五常参考档条目删去'); } });
  scenario.characters.forEach((c) => {
    Object.keys(c.relations || {}).forEach((n) => { if (names.has(n)) { delete c.relations[n]; bump('人物关系表条目删去'); } });
  });
  const relBefore = scenario.relations.length;
  scenario.relations = scenario.relations.filter((r) => !hit(r.fromId) && !hit(r.toId) && !hit(r.from) && !hit(r.to));
  bump('顶层关系删去', relBefore - scenario.relations.length);
  scenario.military.initialTroops.forEach((t) => {
    if (hit(t.commanderId) || hit(t.commander)) {
      const old = t.commander;
      t.commander = '';
      t.commanderId = '';
      bump('军队统兵官空缺');
      if (old && t.description && t.description.includes(old)) { t.description = t.description.split(old).join('守将'); bump('军队说明人名改称'); }
    }
    if (Array.isArray(t.payrollRecipients)) {
      const kept = t.payrollRecipients.filter((p) => !hit(p.characterId));
      if (kept.length !== t.payrollRecipients.length) bump('领饷名单删去', t.payrollRecipients.length - kept.length);
      if (kept.length) t.payrollRecipients = kept; else delete t.payrollRecipients;
    }
  });
  scenario.classes.forEach((c) => {
    if (!Array.isArray(c.representativeNpcs)) return;
    const kept = c.representativeNpcs.filter((n) => !hit(n));
    bump('阶层代表人物删去', c.representativeNpcs.length - kept.length);
    c.representativeNpcs = kept;
  });
  const itemsBefore = scenario.items.length;
  scenario.items = scenario.items.filter((i) => !hit(i.owner));
  bump('物品删去', itemsBefore - scenario.items.length);
  const famBefore = scenario.families.length;
  scenario.families = scenario.families.filter((f) => !(f.members || []).some(hit) && !hit(f.currentHead));
  bump('虚构家户删去', famBefore - scenario.families.length);
  const enyuanBefore = scenario.initialEnYuan.length;
  scenario.initialEnYuan = scenario.initialEnYuan.filter((e) => !hit(e.from) && !hit(e.to) && !hit(e.source) && !hit(e.target));
  bump('恩怨删去', enyuanBefore - scenario.initialEnYuan.length);
  const vacate = (p) => {
    if (!hit(p.holderId) && !hit(p.holder)) return;
    p.holder = ''; p.holderId = ''; p.occupancyStatus = 'unrecorded';
    bump('官职改为未记在任者');
  };
  const walkOffices = (nodes) => (nodes || []).forEach((o) => { (o.positions || []).forEach(vacate); walkOffices(o.subs || o.children); });
  scenario.factions.forEach((f) => walkOffices(f.officeTree));
  Object.values(scenario.officeRegistryByFaction || {}).forEach((list) => walkOffices(list));
  walkOffices(scenario.officeTree);
  const econ = scenario.characterEconomyConfig || {};
  if (Array.isArray(econ.assets)) {
    const before = econ.assets.length;
    econ.assets = econ.assets.filter((a) => !ids.has(String(a.ownerEntityId || '').replace(/^[a-z-]+:/, '')));
    bump('家产登记删去', before - econ.assets.length);
  }
  return { ids, names };
}

// 收尾核对：剧本里不应再出现这些串（按 JSON 里带引号的整串查，报出所在路径）
function assertGone(scenario, strings, what) {
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === 'string') { if (strings.has(v)) hits.push(p + '=' + v); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, p + '[' + i + ']')); return; }
    if (v && typeof v === 'object') Object.keys(v).forEach((k) => { if (strings.has(k)) hits.push(p + '.{' + k + '}'); walk(v[k], p + '.' + k); });
  };
  walk(scenario, '');
  if (hits.length) throw new Error(what + '仍有残留：' + hits.slice(0, 8).join('；'));
}

module.exports = {
  OWNER_FIELDS, QUOTE_KEYS, factionByName, findLeaf, findCircuit, regionOf, setRegionOwner,
  moveLeaf, dissolveFaction, swapExact, renameFaction, renameCircuit, renameLeaf, removeCharacters, assertGone
};
