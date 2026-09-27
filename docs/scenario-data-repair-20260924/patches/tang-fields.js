// 晚唐剧本·字段清理与格式归一（阶段三第一刀）
//
// 晚唐原账里有近两百个字段名游戏与编辑器一处都不读（制作元数据、几何溯源、重复的道长官、按道套写的财政旁白等），
// 还有几处格式不合：府州 population 写成对象、地形写英文代码、省道登记只有 memberSeeds；
// 地图对象里另存了一整份行政树拷贝（map.adminHierarchy，运行时不读）。
// 本补丁：
//   1. 先把以后几刀要用的原账信息（县名表、原户口、原财政估额、道原官称与长官）存到 sources/tang-original-leaves.json；
//   2. 道节点补正规的 officialPosition（按唐制写节度使、观察使等）与 governor（原账叶子上重复写的道长官）；
//   3. population 改为口数、地形改为引擎认的中文词、省道登记改为 memberRegionIds；
//   4. 删去 map.adminHierarchy，按与 lint-scenario-data 相同的口径删去全部死字段（字典键、几何数据不动）；
//   5. 地图地块上的 data 按清理后的府州重新生成（与原账一样：府州去掉 treasuryBinding），mapData 与 map 保持一致。
// 数字一概不动（户口、钱粮的重建在下一刀）。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-fields.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const WEB_ROOT = path.join(REPO, 'web');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const HARVEST_FILE = path.join(DIR, 'sources', 'tang-original-leaves.json');

// ---------- 运行时语料：与 web/scripts/lint-scenario-data.js 同一口径 ----------
const CORPUS_DIRS = ['', 'battle', 'modules/ai-change-applier', 'preview'];
const CORPUS_EXCLUDE = new Set(['tm-official-scenario-bundle.js', 'preview/official-scenarios-bundle.js', 'preview/scenario-editor-reset-data.js']);
const DICT_KEYS = new Set([
  'adminHierarchy', 'relations', 'byEthnicity', 'byFaith', 'officeRegistryByFaction',
  'geographicReferences', 'aliases', 'imperialAssets', 'attitude', 'resourceMap',
  'regionOverrides', 'byRegion', 'perTax', 'byFaction', 'byClass', 'byCircuit', 'byPrefecture',
  'byParty', 'overrides', 'officeSalaries', 'taxOverrides'
]);
const GEOMETRY_KEYS = new Set(['geometry', 'path', 'd', 'points', 'coords', 'polygon', 'rings', 'arcs', 'outline', 'shape', 'svgPath']);
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

function loadCorpusTokens() {
  const tokens = new Set();
  CORPUS_DIRS.forEach((dir) => {
    const absDir = path.join(WEB_ROOT, dir);
    if (!fs.existsSync(absDir)) return;
    fs.readdirSync(absDir).forEach((name) => {
      if (!name.endsWith('.js')) return;
      const rel = (dir ? dir + '/' : '') + name;
      if (CORPUS_EXCLUDE.has(rel)) return;
      if (dir === 'preview' && name.startsWith('_')) return;
      const text = fs.readFileSync(path.join(absDir, name), 'utf8');
      (text.match(/[A-Za-z_$][\w$]*/g) || []).forEach((t) => tokens.add(t));
    });
  });
  return tokens;
}

// 剧本数据里以字符串值出现的标识符：有的字段由数据按名字引用（税目表 taxList[].base 写
// "seaSaltFiscalAssessment"，引擎按这个名字读府州 economyBase），代码里不出现也是活的。与 lint 同一口径。
function collectReferencedNames(root) {
  const names = new Set();
  (function walk(node) {
    if (typeof node === 'string') { if (IDENT_RE.test(node)) names.add(node); return; }
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    Object.keys(node).forEach((key) => { if (!GEOMETRY_KEYS.has(key)) walk(node[key]); });
  })(root);
  return names;
}

// 删去所有死字段，返回 {字段名: 删去次数}。删掉的块里若有引用别处字段名的字符串，
// 被引用的字段随之失去引用，所以反复做到不再有可删的为止。
function deleteDeadFields(root, runtimeCorpus) {
  const removed = {};
  for (;;) {
    const referenced = collectReferencedNames(root);
    const corpus = { has: (key) => runtimeCorpus.has(key) || referenced.has(key) };
    const round = deleteDeadOnce(root, corpus);
    if (!Object.keys(round).length) return removed;
    Object.entries(round).forEach(([k, n]) => { removed[k] = (removed[k] || 0) + n; });
  }
}

function deleteDeadOnce(root, corpus) {
  const removed = {};
  (function walk(node, parentKey) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((item) => walk(item, parentKey)); return; }
    const isDict = DICT_KEYS.has(parentKey);
    Object.keys(node).forEach((key) => {
      if (GEOMETRY_KEYS.has(key)) return;
      if (!isDict && IDENT_RE.test(key) && !corpus.has(key)) {
        removed[key] = (removed[key] || 0) + 1;
        delete node[key];
        return;
      }
      walk(node[key], isDict ? '' : key);
    });
  })(root, '');
  return removed;
}

// ---------- 口径 ----------

// 地形：地图图例 map.terrains 的中文名；湿地不在引擎词表里，按水乡计
const TERRAIN = { plains: '平原', hills: '丘陵', mountains: '山地', grassland: '草原', desert: '荒漠', forest: '林地', swamp: '水乡' };

// 道长官官称（开成五年）：有原账长官的，与其本人官衔一致（游戏按官衔活绑定道长官）；
// 其余按唐制方镇名号写。河阳三城此时的名号有沿革问题，待第三刀按《唐方镇年表》核定，先不写。
const CIRCUIT_TITLES = {
  京畿: '京兆尹', 河中: '河中节度使', 金商: '金商都防御使', 东都: '东都留守', 陕虢: '陕虢观察使',
  河东: '河东节度使', 振武: '振武节度使', 天德: '天德军防御使', 灵盐: '朔方节度使', 夏绥银: '夏绥银节度使',
  鄜坊: '鄜坊节度使', 丹州防御: '丹州防御使', 邠宁: '邠宁节度使', 泾原: '泾原节度使', 凤翔: '凤翔节度使',
  义武: '义武军节度使', 义昌: '义昌军节度使', 平卢: '平卢节度使', 天平: '天平军节度使', 兖海: '兖海观察使',
  宣武: '宣武节度使', 义成: '义成军节度使', 忠武: '忠武军节度使', 武宁: '武宁军节度使', 淮南: '淮南节度使',
  鄂岳: '鄂岳观察使', 浙西: '浙西观察使', 浙东: '浙东观察使', 宣歙: '宣歙观察使', 福建: '福建观察使',
  江西: '江西观察使', 湖南: '湖南观察使', 荆南: '荆南节度使', 山南东道: '山南东道节度使', 山南西道: '山南西道节度使',
  剑南西川: '剑南西川节度使', 剑南东川: '剑南东川节度使', 黔中: '黔中观察使', 岭南: '岭南节度使', 桂管: '桂管观察使',
  容管: '容管经略使', 邕管: '邕管经略使', 安南: '安南都护',
  魏博: '魏博节度使', 成德: '成德节度使', 卢龙: '卢龙节度使', 昭义: '昭义节度使'
};

function leavesOf(divisions, out) {
  (divisions || []).forEach((d) => {
    if ((d.children || []).length) leavesOf(d.children, out);
    else out.push(d);
  });
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  if (JSON.stringify(scenario.map) !== JSON.stringify(scenario.mapData)) throw new Error('map 与 mapData 不一致，先查清');
  const sizeBefore = raw.length;

  // 1. 存原账信息，供后面几刀取用
  const harvest = { note: '晚唐原账（阶段三第一刀清理前）府州与道的原始信息，供户口重建、官守与描述重写取用；不进剧本。', circuits: [], leaves: [] };
  Object.entries(scenario.adminHierarchy).forEach(([treeKey, tree]) => {
    (tree.divisions || []).forEach((d) => {
      const leaves = leavesOf([d], []);
      harvest.circuits.push({
        tree: treeKey, id: d.id, name: d.name, historicalTitle: d.historicalTitle || '', commandType: d.commandType || '',
        governorEvidence: d.governorEvidence || null,
        governor: [...new Set(leaves.map((l) => l.circuitGovernor).filter(Boolean))]
      });
      leaves.forEach((l) => {
        const e = l.economyBase || {};
        harvest.leaves.push({
          tree: treeKey, circuit: d.name, id: l.id, name: l.name, mapRegionId: l.mapRegionId, terrain: l.terrain,
          counties: (l.historicalCounties || []).map((c) => c.name),
          circuitTitle: l.circuitTitle || '', historicalCommandType: l.historicalCommandType || '',
          populationDetail: l.populationDetail,
          economy: {
            farmland: e.farmland, taxableLand: e.taxableLand, commerceVolume: e.commerceVolume, saltOutput: e.saltOutput,
            seaSalt: e.seaSaltFiscalAssessment, poolSalt: e.poolSaltFiscalAssessment, wellSalt: e.wellSaltFiscalAssessment,
            tea: e.teaTaxableSales, wine: e.wineFiscalAssessment, trade: e.ordinaryTradeFiscalAssessment,
            maritime: e.maritimeFiscalAssessment, mining: e.miningFiscalAssessment
          }
        });
      });
    });
  });

  // 2. 道节点：officialPosition 与 governor
  const circuitRows = [];
  Object.values(scenario.adminHierarchy).forEach((tree) => {
    (tree.divisions || []).forEach((d) => {
      const governors = [...new Set(leavesOf([d], []).map((l) => l.circuitGovernor).filter(Boolean))];
      if (governors.length > 1) throw new Error(d.name + ' 下府州写了不同的道长官：' + governors.join('、'));
      const title = CIRCUIT_TITLES[d.name];
      if (title) d.officialPosition = title;
      if (governors.length) {
        const person = scenario.characters.find((c) => c.name === governors[0]);
        if (!person) throw new Error(d.name + ' 的道长官 ' + governors[0] + ' 不在人物表里');
        if (person.officialTitle !== title) throw new Error(d.name + ' 官称「' + title + '」与长官 ' + person.name + ' 的官衔「' + person.officialTitle + '」不一致');
        d.governor = governors[0];
      }
      if (title || governors.length) circuitRows.push('| ' + d.name + ' | ' + (d.historicalTitle || '') + ' | ' + (title || '（待核）') + ' | ' + (governors[0] || '') + ' |');
    });
  });

  // 3. 格式：人口、地形
  const allLeaves = [];
  Object.values(scenario.adminHierarchy).forEach((tree) => leavesOf(tree.divisions, allLeaves));
  const terrainCount = {};
  allLeaves.forEach((l) => {
    if (l.population && typeof l.population === 'object') {
      if (JSON.stringify(l.population) !== JSON.stringify(l.populationDetail)) throw new Error(l.name + ' 的 population 对象与 populationDetail 不同');
      l.population = l.populationDetail.mouths;
    }
    const zh = TERRAIN[l.terrain];
    if (!zh) throw new Error(l.name + ' 的地形 ' + l.terrain + ' 没有中文对照');
    terrainCount[l.terrain + '→' + zh] = (terrainCount[l.terrain + '→' + zh] || 0) + 1;
    l.terrain = zh;
  });

  // 省道登记：memberSeeds 就是地块 id
  const regionIds = new Set(scenario.map.regions.map((r) => r.id));
  scenario.map.circuitRegistry.forEach((c) => {
    if (!c.memberRegionIds) {
      const ids = c.memberSeeds || [];
      ids.forEach((id) => { if (!regionIds.has(id)) throw new Error('省道 ' + c.name + ' 的 ' + id + ' 不是地块'); });
      c.memberRegionIds = ids.slice();
    }
    delete c.memberSeeds;
  });

  // 4. 地图里的整份行政树拷贝（运行时读的是剧本顶层 adminHierarchy）
  delete scenario.map.adminHierarchy;
  delete scenario.mapData;

  // 通志数据层（tm-map-circuits.js，本刀之后才有）读省道登记与道节点的 commandType，缺道节点值时还拿地块上的
  // circuitTitle、circuitGovernor 作后备。晚唐这三个字段的值是原作的制作用语（登记里的「剧本地理行政编组」、
  // 地块上的「地理观察编组·河陇」之类）与各州重复写的道长官旧名，留着会在通志页顶替道的名号与长官，仍按死字段删去；
  // 道长官已由第 2 步写到道节点 governor 上。道节点的 historicalTitle（如「河东节度」）是正经名号，照代码在读保留。
  const corpus = loadCorpusTokens();
  ['commandType', 'circuitTitle', 'circuitGovernor'].forEach((key) => corpus.delete(key));
  const removed = deleteDeadFields(scenario, corpus);

  // 5. 地块 data 按清理后的府州重新生成；mapData 与 map 一致
  const byRegion = new Map(scenario.map.regions.map((r) => [r.id, r]));
  allLeaves.forEach((l) => {
    const region = byRegion.get(l.mapRegionId);
    if (!region) throw new Error(l.name + ' 绑定的地块不在地图上');
    const data = JSON.parse(JSON.stringify(l));
    delete data.treasuryBinding;
    region.data = data;
  });
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));

  const out = JSON.stringify(scenario) + '\n';
  const removedRows = Object.entries(removed).sort((a, b) => b[1] - a[1]);
  const report = ['# 晚唐·字段清理与格式归一报告', '',
    '真源由 ' + (sizeBefore / 1e6).toFixed(1) + 'MB 减为 ' + (out.length / 1e6).toFixed(1) + 'MB；删去 map.adminHierarchy（运行时不读的整份行政树拷贝）与 ' + removedRows.length + ' 个死字段名共 ' +
      removedRows.reduce((a, r) => a + r[1], 0) + ' 处（按删一次计；map 删后整份复制为 mapData）。原账信息另存 `sources/tang-original-leaves.json`。', '',
    '## 格式', '',
    '- population：' + allLeaves.length + ' 个府州由对象改为口数（明细原已在 populationDetail）。',
    '- 地形：' + Object.entries(terrainCount).map(([k, n]) => k + ' ' + n).join('，') + '。地块自身的 terrain 仍是地图图例键，不动。',
    '- 省道登记：' + scenario.map.circuitRegistry.length + ' 组 memberSeeds 改为 memberRegionIds。', '',
    '## 道长官', '',
    '| 道 | 原账官称 | 改写 officialPosition | governor |', '| --- | --- | --- | --- |', ...circuitRows, '',
    '## 删去的死字段', '', '| 字段 | 处数 |', '| --- | --- |', ...removedRows.map(([k, n]) => '| ' + k + ' | ' + n + ' |')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(HARVEST_FILE, JSON.stringify(harvest, null, 1) + '\n');
    fs.writeFileSync(SCENARIO_FILE, out);
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, HARVEST_FILE));
  }
}

main();
