#!/usr/bin/env node
// smoke-lint-scenario-data.js — 官方剧本数据守卫自测
// 用两份小剧本：干净的一份各规则都应为 0；脏的一份每条埋一个问题，逐条应当报出。
// 死字段判定用传入的语料集合，不依赖真实代码库，结果稳定。
'use strict';

const assert = require('assert');
const path = require('path');
const { RULES, auditScenario } = require(path.join(__dirname, 'lint-scenario-data.js'));

function leaf(id, name, extra) {
  return Object.assign({
    id, name, level: 'prefecture', divisionType: '府', officialPosition: '知府', capital: false,
    mapRegionId: 'r-' + id, regionType: 'normal', dejureOwner: '甲国',
    description: name + '依山带河，市镇相望。',
    terrain: '平原', specialResources: '稻', tags: { hasPort: false },
    population: 100000,
    populationDetail: { mouths: 100000, households: 20000, ding: 30000, fugitives: 100, hiddenCount: 200 },
    minxinLocal: 50, corruptionLocal: 40, prosperity: 50, unrest: 10,
    fiscalDetail: { claimedRevenue: 1000, actualRevenue: 800, compliance: 0.8 },
    economyBase: { farmland: 500000 }
  }, extra || {});
}

function region(id, name, neighbors) {
  return { id, name, owner: 'fac-a', neighbors: neighbors || [], parentId: 'c1' };
}

function cleanScenario() {
  const leaves = [
    leaf('p1', '甲府', { capital: true, population: 180000, populationDetail: { mouths: 180000, households: 36000, ding: 50000, fugitives: 100, hiddenCount: 200 } }),
    leaf('p2', '乙府', { terrain: '丘陵', population: 120000, populationDetail: { mouths: 120000, households: 25000, ding: 33000, fugitives: 100, hiddenCount: 200 } }),
    leaf('p3', '丙州', { terrain: '山地', divisionType: '州', officialPosition: '知州', population: 60000, populationDetail: { mouths: 60000, households: 12000, ding: 16000, fugitives: 100, hiddenCount: 200 } })
  ];
  return {
    startYear: 1627,
    factions: [{ id: 'fac-a', sid: 's', name: '甲国', leader: '张甲', capital: '甲府' }],
    characters: [
      { id: 'c-1', sid: 's', name: '张甲', faction: '甲国', factionId: 'fac-a', age: 40, birthYear: 1588, regionId: 'r-p1' },
      { id: 'c-2', sid: 's', name: '李乙', faction: '甲国', factionId: 'fac-a', age: 30 }
    ],
    parties: [], classes: [],
    map: {
      regions: [region('r-p1', '甲府', ['r-p2']), region('r-p2', '乙府', ['r-p1', 'r-p3']), region('r-p3', '丙州', ['r-p2'])],
      circuitRegistry: [{ id: 'c1', key: 'c1', name: '某道', memberRegionIds: ['r-p1', 'r-p2', 'r-p3'] }]
    },
    adminHierarchy: {
      player: {
        factionId: 'fac-a', factionName: '甲国',
        divisions: [{ id: 'prov', name: '某道', level: 'province', terrain: '平原', specialResources: '稻·茶', tags: { hasPort: true },
          minxinLocal: 45, corruptionLocal: 50, description: '某道控扼江淮，漕路所经。', children: leaves }]
      }
    },
    military: { initialTroops: [{ name: '某营', commander: '张甲', faction: '甲国', garrisonRegionId: 'r-p1' }] }
  };
}

// 语料：把干净剧本里出现的所有字段名都当作「有代码读取」
function corpusOf(scenario) {
  const tokens = new Set();
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    Object.keys(node).forEach((k) => { tokens.add(k); walk(node[k]); });
  })(scenario);
  return tokens;
}

// ---- 干净剧本：所有规则为 0 ----
const clean = cleanScenario();
const corpus = corpusOf(clean);
const cleanResult = auditScenario(clean, corpus);
assert.deepStrictEqual(cleanResult.counts, {}, '干净剧本不应报任何问题：' + JSON.stringify(cleanResult.counts));

// ---- 脏剧本：逐条埋雷 ----
const dirty = cleanScenario();
const tree = dirty.adminHierarchy.player.divisions[0];
dirty.characters.push({ id: 'c-1', sid: 's', name: '王丙', faction: '甲国', factionId: 'fac-a' });   // 重复 id
dirty.characters.push({ id: 'c-4', sid: 's', name: '赵丁', faction: '乙国' });                     // 势力不存在
dirty.adminHierarchy.laterJin = { factionId: 'fac-a', factionName: '甲国', divisions: [] };           // 树键名对不上势力
tree.children[0].population = { mouths: 180000 };                                                    // population 写成对象
tree.children[0].byAge = { 幼: '34%', 青壮: '47%', 老: '19%' };                                       // 字符串百分比
tree.children[1].terrain = 'plains';                                                                  // 英文地形
tree.children[2].description = '某道地块内的州级要地。';                                              // 制作用语
tree.children[2].economyBase = { farmland: 2.36 };                                                    // 耕地量纲
tree.children[2].populationDetail.households = 90000;                                                 // 户多于口
tree.children.push(leaf('p4', '丁府', {                                                               // 照抄上级
  mapRegionId: 'r-p4', terrain: '平原', specialResources: '稻·茶', tags: { hasPort: true }, minxinLocal: 45, corruptionLocal: 50,
  zzqPlantedDeadField: 1                                                                               // 死字段
}));
['p5', 'p6', 'p7'].forEach((id) => tree.children.push(leaf(id, id + '府', { mapRegionId: 'r-' + id, population: 77777,
  populationDetail: { mouths: 77777, households: 15000, ding: 20000, fugitives: 0, hiddenCount: 0 } })));  // 平分
['p4', 'p5', 'p6', 'p7'].forEach((id) => dirty.map.regions.push(region('r-' + id, id === 'p4' ? '丁府' : id + '府')));
dirty.map.circuitRegistry[0].memberRegionIds.push('r-p4', 'r-p5', 'r-p6', 'r-p7');
dirty.map.circuitRegistry.push({ key: 'c2', name: '他道', memberSeeds: ['r-p1'] });                   // 省道登记换结构

const dirtyResult = auditScenario(dirty, corpus);
const c = dirtyResult.counts;
const expectAtLeast = {
  'ref.char.duplicateId': 1,
  'ref.char.faction': 1,
  'ref.admin.treeKey': 1,
  'fmt.population': 1,
  'fmt.percentString': 1,
  'fmt.terrainEnglish': 1,
  'text.meta': 1,
  'num.farmlandUnit': 1,
  'num.householdsOverMouths': 1,
  'leaf.copiedFromParent': 1,
  'leaf.equalSplit': 3,
  'field.dead': 1,
  'fmt.circuitSchema': 1
};
Object.entries(expectAtLeast).forEach(([rule, n]) => {
  assert.ok(RULES[rule], '规则表缺 ' + rule);
  assert.ok((c[rule] || 0) >= n, rule + ' 应至少报 ' + n + ' 处，实为 ' + (c[rule] || 0));
});
assert.ok(dirtyResult.deadList.some((d) => d.key === 'zzqPlantedDeadField'), '死字段清单应列出埋下的字段');
assert.strictEqual(c['ref.char.duplicateName'] || 0, 0, '不同名字的重复 id 不应算作重名');

console.log('[smoke-lint-scenario-data] PASS 干净剧本 0 问题；脏剧本 ' + Object.keys(expectAtLeast).length + ' 条规则逐条报出');
