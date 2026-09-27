// 晚唐·承载力（第十四刀）。--report <文件> 生成核查与前后账，--write 写回标准单行 JSON。
// 数据估计集中在 data/tang-carrying.js；引擎的亩/口混用与旧环境 tick 不在本刀改动范围。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { TREE_KEYS, SOURCES, METHOD } = require('../data/tang-carrying.js');
const lib = require('./tang-redistribute.js');
const REPO = path.resolve(__dirname, '../../..');
const FILE = path.join(REPO, 'scenarios/晚唐·开成五年（官方）.json');
const clone = (x) => JSON.parse(JSON.stringify(x));
const sum = (a) => a.reduce((v, x) => v + x, 0);
const round = (n) => Number(n.toFixed(8));
const regime = (load) => load < 0.55 ? 'abundant' : load < 0.75 ? 'sustainable' : load < 0.97 ? 'strained' : 'overload';
const RES = ['money', 'grain', 'cloth'];
const fmt = (v) => RES.map((k) => v[k]).join('/');

function context(scenario, files) {
  const s = scenario;
  const g = {
    sid: s.id, turn: 1, turnDays: 10, playerInfo: clone(s.playerInfo), facs: clone(s.factions), chars: clone(s.characters),
    officeTree: clone(s.officeTree), adminHierarchy: clone(s.adminHierarchy), armies: clone(s.military.initialTroops), regions: [],
    fiscalConfig: clone(s.fiscalConfig), publicTreasuryConfig: clone(s.publicTreasuryConfig),
    guoku: { money: s.guoku.initialMoney, grain: s.guoku.initialGrain, cloth: s.guoku.initialCloth },
    neitang: { money: s.neitang.initialMoney, grain: s.neitang.initialGrain, cloth: s.neitang.initialCloth },
    population: { national: { mouths: s.populationConfig.initial.nationalMouths, households: s.populationConfig.initial.nationalHouseholds }, byRegion: {} }
  };
  const c = { GM: g, P: { time: clone(s.time), playerInfo: clone(s.playerInfo), fiscalConfig: clone(s.fiscalConfig) },
    console: { log() {}, warn() {}, error() {} }, Math, JSON, Date, setTimeout() {}, clearTimeout() {}, _getDaysPerTurn: () => 10, findScenarioById: () => s };
  c.window = c; c.globalThis = c; vm.createContext(c);
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(REPO, 'web', f), 'utf8'), c, { filename: f }));
  return c;
}

// 使用生产桥与补齐器，顺序同 tm-game-loop：Env init → PhaseB → IntegrationBridge。
// 这是可复现的子系统开局；收尾另用 doActualStart 完整开局逐道对照，不把公式计算冒充运行时结果。
function environmentPreview(s) {
  const c = context(s, ['tm-integration-bridge.js', 'tm-region-enrich.js', 'tm-economy-engine.js']);
  c.EnvCapacityEngine.init(s);
  c.IntegrationBridge.getDivisionArray(c.GM).forEach((d) => c.PhaseB.enrichRegion(d));
  c.IntegrationBridge.init({ strict: true });
  const rows = c.GM.adminHierarchy.player.divisions.map((d) => ({ id: d.id, name: d.name,
    carryingCapacity: clone(d.carryingCapacity), environment: clone(c.GM.environment.byRegion[d.id]) }));
  assert.strictEqual(rows.length, 45);
  return rows;
}

function budgetPreview(s) {
  const c = context(s, ['tm-field-pipelines.js', 'tm-public-treasury.js', 'tm-char-economy-ledger.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js']);
  c.FiscalEngine.initializePublicTreasuries({ game: c.GM, scenario: s });
  const b = c.CascadeTax.previewBudget({ game: c.GM, faction: 'player', turnDays: 360 });
  assert(b && b.regions.length === 249);
  return clone({ central: b.totals.central, local: b.totals.localRetain, expense: b.expenses.central, salary: b.expenses.salary });
}

function capacity(arable, water, historicalCap, mouths) {
  [arable, water, historicalCap, mouths].forEach((n) => assert(Number.isSafeInteger(n) && n > 0, '承载/人口须正整数'));
  const load = mouths / historicalCap;
  assert(load <= 1.5, '超出户籍 currentLoad 上限，须重新核算');
  return { arable, water, climate: 1, historicalCap, currentLoad: round(load), carryingRegime: regime(load) };
}

function apply(s) {
  const beforeText = JSON.stringify(s);
  lib.assertLedgersAreEnginePreview(s, TREE_KEYS);
  const beforeEnvironment = environmentPreview(s), beforeBudget = budgetPreview(s);
  const maps = [s.map, s.mapData].map((m) => new Map(m.regions.map((r) => [r.id, r])));
  const edits = [], leaves = [], circuits = [];
  function set(obj, key, value) {
    edits.push({ obj, key, had: Object.prototype.hasOwnProperty.call(obj, key), old: obj[key], value });
    obj[key] = value;
  }
  TREE_KEYS.forEach((key) => {
    assert(s.adminHierarchy[key], '缺行政树 ' + key);
    s.adminHierarchy[key].divisions.forEach((d) => {
      assert((d.children || []).length, d.name + ' 不是府州父节点');
      assert(!d.carryingCapacity, d.name + ' 已有承载力，请整体重建');
      d.children.forEach((l) => {
        assert(!(l.children || []).length, l.name + ' 出现额外层级');
        assert.deepStrictEqual(l.carryingCapacity, {}, l.name + ' 改前承载不是空对象');
        const r = l.renliSeed, land = l.economyBase.farmland, mouths = l.populationDetail.mouths;
        assert(r && Number.isSafeInteger(land) && land > 0 && l.terrain, l.name + ' 缺田亩、农政种子或地形');
        ['annualYieldPerMu', 'doubleCropping', 'annualFoodNeedPerMouth'].forEach((f) => assert(Number.isFinite(r[f]) && r[f] > 0, l.name + ' 缺 ' + f));
        const arable = Math.round(land * r.annualYieldPerMu * r.doubleCropping / r.annualFoodNeedPerMouth);
        const cc = capacity(arable, arable, arable, mouths);
        maps.forEach((m) => {
          const map = m.get(l.mapRegionId);
          assert(map && map.data, l.name + ' 地图镜像不存在');
          assert.deepStrictEqual(map.data.carryingCapacity, l.carryingCapacity, l.name + ' 承载三份改前不一致');
        });
        set(l, 'carryingCapacity', cc);
        maps.forEach((m) => set(m.get(l.mapRegionId).data, 'carryingCapacity', clone(cc)));
        leaves.push({ tree: key, circuit: d.name, id: l.id, name: l.name, terrain: l.terrain, land, mouths,
          yield: r.annualYieldPerMu, cropping: r.doubleCropping, food: r.annualFoodNeedPerMouth, capacity: clone(cc) });
      });
      // 原道级 population 是 mouths/households=0 占位，且无 populationDetail。
      // 桥的环境比值明确读 populationDetail.mouths，不补合计会以 1 为分母；这些只是现有府州户口的合计镜像。
      const pd = {};
      lib.POP_FIELDS.forEach((field) => {
        if (d.children.some((l) => typeof l.populationDetail[field] === 'number')) {
          pd[field] = sum(d.children.map((l) => l.populationDetail[field] || 0));
        }
      });
      if (pd.ding) pd.mouthsPerDing = round(pd.mouths / pd.ding);
      assert.strictEqual(pd.mouths, sum(d.children.map((l) => l.populationDetail.mouths)));
      set(d, 'populationDetail', pd);
      set(d, 'population', Object.assign({}, d.population, { mouths: pd.mouths, households: pd.households }));
      const values = ['arable', 'water', 'historicalCap'].map((f) => sum(d.children.map((l) => l.carryingCapacity[f])));
      const cc = capacity(...values, pd.mouths);
      set(d, 'carryingCapacity', cc);
      circuits.push({ tree: key, id: d.id, name: d.name, mouths: pd.mouths, children: d.children.length, capacity: clone(cc) });
      ['arable', 'water', 'historicalCap'].forEach((f) => assert.strictEqual(cc[f], sum(d.children.map((l) => l.carryingCapacity[f])), d.name + f + ' 合计错误'));
    });
  });
  assert.strictEqual(leaves.length, 273);
  assert.strictEqual(circuits.length, 49);
  // 所有未申报字段逐字节不动；撤销再应用，避免整份大 JSON 深拷贝占用磁盘或额外内存。
  for (const e of edits.slice().reverse()) { if (e.had) e.obj[e.key] = e.old; else delete e.obj[e.key]; }
  assert.strictEqual(JSON.stringify(s), beforeText, '补承载以外的字段被修改');
  edits.forEach((e) => { e.obj[e.key] = e.value; });

  const preview = lib.fiscalPreview(s, TREE_KEYS);
  const changedLedgers = leaves.filter((r) => {
    const leaf = s.adminHierarchy[r.tree].divisions.flatMap((d) => d.children).find((l) => l.id === r.id);
    return JSON.stringify(leaf.fiscalDetail.resources) !== JSON.stringify(preview.get(r.id));
  });
  // 若承载曾影响开局税基，沿用既有方法刷新各府州财政镜像；不能凭「应当不变」略过对账。
  if (changedLedgers.length) lib.refreshLedgers(s, TREE_KEYS);
  lib.assertLedgersAreEnginePreview(s, TREE_KEYS);
  const afterEnvironment = environmentPreview(s), afterBudget = budgetPreview(s);
  const outsiders = Object.entries(s.adminHierarchy).filter(([k]) => !TREE_KEYS.includes(k)).map(([k, t]) => ({ tree: k,
    circuits: t.divisions.length, leaves: t.divisions.reduce((n, d) => n + (d.children || []).length, 0) }));
  return { beforeEnvironment, afterEnvironment, beforeBudget, afterBudget, leaves, circuits, outsiders, changedLedgers: changedLedgers.length };
}

function report(r) {
  const env = (x) => {
    const e = x.environment;
    return [e.arableLand, e.waterCapacity, round(e.currentLoad), e.carryingRegime, round(e.carrying.farmland), round(e.carrying.water)].join('/');
  };
  const delta = (a, b) => Object.fromEntries(RES.map((k) => [k, round(b[k] - a[k])]));
  return ['# 晚唐·承载力报告', '',
    '唐廷 45 道 249 府州、河朔昭义四镇 4 道 24 府州，共补 49 道、273 府州；府州的行政树与两份地图 data 同步（819 份叶子记录）。49 道同时补府州户口合计镜像，使整合桥有正确口数作分母。未改引擎、府州户口、田亩、农政种子与 environmentConfig。', '',
    '## 字段口径与原文', '', ...METHOD.map((x) => '- ' + x), '',
    '| 编号 | 出处 | 原文（逐字） | 用途与边界 |', '| --- | --- | --- | --- |',
    ...SOURCES.map((s) => '| ' + s.id + ' | [' + s.source + '](' + s.url + ') | ' + s.text + ' | ' + s.use + ' |'), '',
    '引文按指定原文库逐字核验，仅除空白和 -{斗}- 等排版标记；原文 H，套用到州级承载的估计 L。', '',
    '## 读取路径与开局、逐回合影响', '',
    '| 路径 | 实际读取与影响 |', '| --- | --- |',
    '| tm-integration-bridge.js:190–203、416–468 | 玩家道级承载转为 environment，arable/water 除 populationDetail.mouths 成比例，同时复制 arableLand、waterCapacity、currentLoad、carryingRegime；byRegion 只有玩家 45 道。原道口数是零占位且缺 populationDetail，故本刀补叶子合计，不额外增加人口。 |',
    '| tm-region-enrich.js:103–122、_getRegionsArray | 对所有行政树补字段，缺对象时默认 arable=30000、water=80000；叶子已有 {} 为真值，不触发补数。本刀完整对象跳过此兜底。 |',
    '| tm-huji-engine.js:1154–1180、1324–1332 | 所有势力叶子可达，以 historicalCap 为口数分母，更新 currentLoad 并钳至 1.5；不自动重算 carryingRegime，也不自动从本字段制造生死或迁移。 |',
    '| tm-fiscal-engine.js:1215–1286、815–825、1868 | 旧财政可把 arable 当缺失 farmland 的兜底，也把 historicalCap、arable×1.2 与亩数混用；currentLoad 控制开垦率。本剧本 farmland 已有值，且 tm-fiscal-ledger/2 走 previewBudget/collectUnifiedRevenue，跳过旧 cascadeDivision 的田亩流转。不能据旧代码就宣称开局增收。 |',
    '| tm-endturn-province.js:1564、1657 | 展示完整承载账与田亩对照；把 arable 标成“亩”与编辑器、户籍的可养口数矛盾。本刀沿天启/绍宋口径，不用错误 UI 单位反改数据。 |',
    '| tm-class-mobility.js:129 | 作物采用加成试图改 population.byRegion 行上的 carryingCapacity.arable；现桥的叶级人口代理是 populationDetail，不附此对象，本刀不额外造代理镜像。 |',
    '| tm-renli.js:656–677 | 气候系数调整逐回合 weather；本刀 climate=1 为常年，不改变现有农政种子的收成。 |',
    '| tm-economy-engine.js:178–235、424–555 | EnvCapacityEngine.init 从 GM.regions 建账，当前完整开局该表为空，initialCarrying/initialScars 仍未进入新账。环境 tick 另读 arableArea/soilFertility 等字段，不读 arableLand，仍会用默认物理参数重新算 carryingMax/currentLoad；补 carryingCapacity 解决开局与户籍基准，不能宣称根治后续环境重算。 |',
    '| editor-division-deep、map-editor-core/io/panel/to-game/merge-split、phase8-formal-map/dossier、tm-help-social | 编辑器与地图传递、编辑、显示对象；地图拆分旧逻辑还按比例缩 currentLoad，属于既有比率处理问题，本刀不触发拆分。tm-custom-build-agent 的 population.carryingCapacity 是另一标量，不是本对象。 |', '',
    '## 开局环境账：45 道前后', '',
    '由生产 EnvCapacityEngine、PhaseB、IntegrationBridge 按开局顺序实跑；每格依次为可耕承载/水承载/负载/档位/耕地支持比/水支持比，前三项口、口、比率。旧账 farmland=30000 是缺道级口数分母导致的原状，不是正确的人均支持比。', '',
    '| 道 | 改前环境账 | 改后环境账 |', '| --- | --- | --- |',
    ...r.beforeEnvironment.map((b, i) => { const a = r.afterEnvironment[i]; assert.strictEqual(b.id, a.id); return '| ' + b.name + ' | ' + env(b) + ' | ' + env(a) + ' |'; }), '',
    '## 开局一年财政：承载力这一刀前后', '',
    '年预算为 360 日，钱/粮/布为贯/石/匹；不是推进一年后的结算。改前已经应用京官料钱补丁，故本表单独隔离承载力影响。', '',
    '| 项 | 改前 | 改后 | 变化 |', '| --- | --- | --- | --- |',
    ...['central', 'local', 'expense', 'salary'].map((k) => '| ' + ({ central: '唐廷中央收入', local: '地方留存', expense: '中央支出', salary: '官员职位俸给（引擎去兼领）' })[k] + ' | ' + fmt(r.beforeBudget[k]) + ' | ' + fmt(r.afterBudget[k]) + ' | ' + fmt(delta(r.beforeBudget[k], r.afterBudget[k])) + ' |'), '',
    '273 个府州开局财政账已先核对是生产引擎年预演，再补承载、重新预演对账；受影响并刷新的府州数 ' + r.changedLedgers + '。未受影响的原账保留，未硬改税额去抵消京官开支。', '',
    '## 道级合计', '', '| 势力树 | 道 | 府州数 | 口数 | arable=water=historicalCap | 负载 | 档位 |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...r.circuits.map((d) => '| ' + d.tree + ' | ' + d.name + ' | ' + d.children + ' | ' + d.mouths + ' | ' + d.capacity.arable + ' | ' + d.capacity.currentLoad + ' | ' + d.capacity.carryingRegime + ' |'), '',
    '## 府州逐项推算（改前均为空对象，可信度 L）', '',
    '| 势力树/道 | 府州 | 地形 | 原田亩 | 原年亩产 | 原复种 | 原年口粮 | 原口数 | arable=water=historicalCap | currentLoad | carryingRegime |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...r.leaves.map((l) => '| ' + l.tree + '/' + l.circuit + ' | ' + l.name + ' | ' + l.terrain + ' | ' + l.land + ' | ' + l.yield + ' | ' + l.cropping + ' | ' + l.food + ' | ' + l.mouths + ' | ' + l.capacity.arable + ' | ' + l.capacity.currentLoad + ' | ' + l.capacity.carryingRegime + ' |'), '',
    '## 外藩可达性与保留范围', '',
    '其余 37 树 302 叶子可由 PhaseB、户籍与各势力财政读取，不能说“无人读取”。它们不进入唐廷 45 道环境账。本刀保留：游牧、渔猎、海外地区不能一律按唐地农田粮食估完整承载，原数据缺相应的草场、水文与食物结构依据；按既有农田直接套会出现约 2–10 倍负载。这是待核范围，不假称已补完天下。', '',
    '| 势力树 | 道数 | 叶子数 | 运行时可达 | 处理 |', '| --- | --- | --- | --- | --- |',
    ...r.outsiders.map((x) => '| ' + x.tree + ' | ' + x.circuits + ' | ' + x.leaves + ' | 户籍/补齐器/势力财政；唐廷环境表不收 | 原样，待本地生计依据 |'), '',
    '## 拿不准的地方', '',
    '- 此刀数值是按现有农政种子推导的估计，唐地年亩产/全口口粮不是逐州史实统计。若另核亩产、损耗、非粮来源，须修改种子或本模块规则后整体重建，不能在 JSON 上手调负载。',
    '- water 无独立史料，暂与 arable 同值；historicalCap 不是人口普查峰值。arable 不代表亩数，UI/旧田亩流转量纲冲突保留待修。',
    '- 开局之后旧 EnvCapacityEngine 会重算另一套物理账，carryingRegime 与道级负载也没有随户籍逐回合自动汇总更新；本刀只补剧本输入，不声称实现了这两项引擎修复。'
  ].join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2), raw = fs.readFileSync(FILE, 'utf8'), s = JSON.parse(raw);
  assert.strictEqual(JSON.stringify(s) + '\n', raw, '剧本不是标准 JSON.stringify 输出，拒绝改写');
  const r = apply(s), i = args.indexOf('--report');
  if (i >= 0) { assert(args[i + 1], '--report 缺文件'); fs.writeFileSync(args[i + 1], report(r)); }
  console.log('承载力：' + r.circuits.length + ' 道、' + r.leaves.length + ' 府州；中央岁入 ' + fmt(r.beforeBudget.central) + ' → ' + fmt(r.afterBudget.central));
  if (args.includes('--write')) { fs.writeFileSync(FILE, JSON.stringify(s) + '\n'); console.log('已写入 ' + path.relative(REPO, FILE)); }
}

module.exports = { apply, report, environmentPreview, budgetPreview };
if (require.main === module) main();
