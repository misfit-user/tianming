// 晚唐补丁共用：一组地块按人口倍数重分随人口走的各项，再用财政引擎按年预算重算开局账。
// 户口重建（tang-households.js）与外藩一刀（tang-foreign.js）都用。
// 重分办法：每块的量按「原账数 × 本块人口变动倍数」重分，再按本组原合计归一，
// 因此组合计不变，原账为零的项仍为零，各块原有的在籍率、垦田率等差别保留。
// 原账各地块的开局账 fiscalDetail 正是引擎按年预算的结果（调用方先核对），重分后照同一办法重算。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '../../..');

// 随人口走的户口账字段（mouthsPerDing 是比率，不在内）
const POP_FIELDS = ['mouths', 'households', 'ding', 'registeredMouths', 'registeredHouseholds', 'taxableMouths', 'taxableHouseholds',
  'hiddenCount', 'hidden', 'fugitives', 'registeredDing', 'hiddenDing', 'fledDing', 'baselineExemptDing', 'exemptDing', 'registeredLand'];
// 课额（盐、茶、酒、商税、舶货、坑冶）是按州定的旧额，不随人口走；只重分经济底数
const ECON_FIELDS = ['farmland', 'taxableLand', 'commerceVolume'];
const INT_ECON = new Set(['farmland', 'taxableLand', 'commerceVolume']);
const MONEY_KEYS = ['claimedRevenue', 'actualRevenue', 'collectedRevenue', 'remittedToCenter', 'retainedBudget', 'skimmed', 'lostInTransit'];

// 按份额分整数，保持合计不变（最大余数法）
function apportion(total, shares) {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (!sum) return shares.map(() => 0);
  const exact = shares.map((s) => (total * s) / sum);
  const out = exact.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { out[i] += 1; rest -= 1; } });
  return out;
}

// 一组量按「原值 × 倍数」重分并归一到原合计
function redistribute(values, factors, integer) {
  const total = values.reduce((a, b) => a + b, 0);
  const raw = values.map((v, i) => v * factors[i]);
  if (integer) return apportion(Math.round(total), raw);
  const sum = raw.reduce((a, b) => a + b, 0);
  return sum ? raw.map((r) => (total * r) / sum) : values.slice();
}

function leavesOf(nodes, out) {
  nodes.forEach((n) => { if ((n.children || []).length) leavesOf(n.children, out); else out.push(n); });
  return out;
}

// 行政树键 → 势力 id（唐廷的树键是 player）
function factionOfTree(key) {
  return key === 'player' ? '唐朝廷' : key;
}

// ---------- 财政引擎（与 smoke-tang840-fiscal-detail 同样的开局构造） ----------
// 返回 Map(地块 id → 按年预算的 resources)，只算 treeKeys 这几棵行政树
function fiscalPreview(scenario, treeKeys) {
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const s = scenario;
  const g = {
    sid: s.id, turn: 1, turnDays: 10, playerInfo: copy(s.playerInfo), facs: copy(s.factions), chars: copy(s.characters),
    officeTree: copy(s.officeTree), adminHierarchy: copy(s.adminHierarchy), armies: copy(s.military.initialTroops),
    fiscalConfig: copy(s.fiscalConfig), guoku: { money: s.guoku.initialMoney, grain: s.guoku.initialGrain, cloth: s.guoku.initialCloth },
    neitang: { money: s.neitang.initialMoney, grain: s.neitang.initialGrain, cloth: s.neitang.initialCloth }, publicTreasuryConfig: copy(s.publicTreasuryConfig)
  };
  const c = { GM: g, P: { time: copy(s.time), playerInfo: copy(s.playerInfo), fiscalConfig: copy(s.fiscalConfig) }, console: { log() {}, warn() {}, error() {} },
    Math, JSON, Date, setTimeout() {}, clearTimeout() {}, _getDaysPerTurn: () => 10, findScenarioById: () => s };
  c.window = c; c.globalThis = c; vm.createContext(c);
  ['tm-field-pipelines.js', 'tm-public-treasury.js', 'tm-char-economy-ledger.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js']
    .forEach((file) => vm.runInContext(fs.readFileSync(path.join(REPO, 'web', file), 'utf8'), c, { filename: file }));
  c.FiscalEngine.initializePublicTreasuries({ game: g, scenario: s });
  const byRegion = new Map();
  treeKeys.forEach((key) => {
    const budget = c.CascadeTax.previewBudget({ game: g, faction: factionOfTree(key), turnDays: 360 });
    if (!budget) throw new Error(key + ' 没有财政预算');
    budget.regions.forEach((r) => byRegion.set(r.id, r.resources));
  });
  return byRegion;
}

// 核对：这几棵树各地块的开局账就是引擎按年预算，否则不能按引擎重算
function assertLedgersAreEnginePreview(scenario, treeKeys) {
  const preview = fiscalPreview(scenario, treeKeys);
  treeKeys.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const r = preview.get(l.id);
    if (!r || JSON.stringify(r) !== JSON.stringify(l.fiscalDetail.resources)) throw new Error(l.name + ' 的开局账不是引擎按年预算，不能按引擎重算');
  }));
}

// 重分所需的账面索引：城市、户口镜像、地方开支与吏员（只取这几份财政配置里本块的 local-块-… 与吏员）
function ledgerIndex(scenario, fiscalConfigs) {
  const cities = new Map(scenario.cities.map((c) => [c.regionId, c]));
  const byRegionPop = (scenario.populationConfig && scenario.populationConfig.initial && scenario.populationConfig.initial.byRegion) || {};
  const expenseItems = (id) => {
    const rows = [];
    fiscalConfigs.forEach((cfg) => {
      const fe = cfg.fixedExpense || {};
      // 只取本块的地方开支（local-块-…）；酒坊工本随酒课旧额，中枢各项即使写了所在州也不动
      (fe.recurringExpenses || []).forEach((x) => {
        if (String(x.id).startsWith('local-' + id + '-') || x.id === 'local-' + id) rows.push({ kind: 'local', item: x });

      });
      (fe.administrativeStaff || []).forEach((x) => { if (x.regionId === id) rows.push({ kind: 'staff', item: x }); });
    });
    return rows;
  };
  return { cities, byRegionPop, expenseItems };
}

// 同组各块按倍数重分：户口账、经济底数（econFields）、府库开局存量、城市人口、地方开支与吏员
function redistributeGroup(leaves, factors, index, econFields) {
  // 户口账
  POP_FIELDS.forEach((k) => {
    if (!leaves.some((l) => typeof l.populationDetail[k] === 'number')) return;
    const next = redistribute(leaves.map((l) => l.populationDetail[k] || 0), factors, true);
    leaves.forEach((l, i) => { if (typeof l.populationDetail[k] === 'number') l.populationDetail[k] = next[i]; });
  });
  leaves.forEach((l) => {
    const p = l.populationDetail;
    l.population = p.mouths;
    const mirror = index.byRegionPop[l.id];
    if (mirror) Object.keys(mirror).forEach((k) => { if (k in p) mirror[k] = p[k]; });
  });
  // 经济与府库
  econFields.forEach((k) => {
    if (!leaves.some((l) => typeof l.economyBase[k] === 'number')) return;
    const next = redistribute(leaves.map((l) => l.economyBase[k] || 0), factors, INT_ECON.has(k));
    leaves.forEach((l, i) => { if (typeof l.economyBase[k] === 'number') l.economyBase[k] = next[i]; });
  });
  ['money', 'grain', 'cloth'].forEach((k) => {
    const next = redistribute(leaves.map((l) => (l.publicTreasuryInit || {})[k] || 0), factors, true);
    leaves.forEach((l, i) => { if (l.publicTreasuryInit && k in l.publicTreasuryInit) l.publicTreasuryInit[k] = next[i]; });
  });
  const cityRows = leaves.map((l) => index.cities.get(l.mapRegionId));
  if (cityRows.every(Boolean)) {
    const next = redistribute(cityRows.map((c) => c.population || 0), factors, true);
    cityRows.forEach((c, i) => { c.population = next[i]; });
  }
  // 地方开支：水利驿路仓储随人口，吏员人数随人口
  const items = leaves.map((l) => index.expenseItems(l.id));
  const byId = {};
  items.forEach((list, i) => list.filter((x) => x.kind === 'local').forEach((x) => {
    const key = x.item.id.replace(leaves[i].id, '#');
    (byId[key] = byId[key] || []).push({ i, item: x.item });
  }));
  Object.values(byId).forEach((group) => {
    ['money', 'grain', 'cloth'].forEach((res) => {
      const vals = group.map((g) => (g.item.monthly || {})[res] || 0);
      const next = redistribute(vals, group.map((g) => factors[g.i]), false);
      group.forEach((g, j) => { if (g.item.monthly && res in g.item.monthly) g.item.monthly[res] = next[j]; });
    });
  });
  const staff = [];
  items.forEach((list, i) => list.filter((x) => x.kind === 'staff').forEach((x) => staff.push({ i, item: x.item })));
  if (staff.length) {
    const next = redistribute(staff.map((s) => s.item.count || 0), staff.map((s) => factors[s.i]), true);
    staff.forEach((s, j) => { s.item.count = next[j]; });
  }
}

// 用引擎按年预算重算这几棵树的开局账，并把府州写回地块 data 与 mapData
function refreshLedgers(scenario, treeKeys) {
  const after = fiscalPreview(scenario, treeKeys);
  treeKeys.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const r = after.get(l.id);
    l.fiscalDetail.resources = JSON.parse(JSON.stringify(r));
    MONEY_KEYS.forEach((k) => { l.fiscalDetail[k] = r.money[k]; });
  }));
  const byMap = new Map(scenario.map.regions.map((r) => [r.id, r]));
  treeKeys.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, []).forEach((l) => {
    const data = JSON.parse(JSON.stringify(l));
    delete data.treasuryBinding;
    byMap.get(l.mapRegionId).data = data;
  }));
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));
}

module.exports = {
  POP_FIELDS, ECON_FIELDS, apportion, redistribute, fiscalPreview, assertLedgersAreEnginePreview,
  ledgerIndex, redistributeGroup, refreshLedgers, factionOfTree
};
