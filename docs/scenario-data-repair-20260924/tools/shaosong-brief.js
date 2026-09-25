// 写绍宋各路数据模块前的取材单：列出一个路下各块的《宋史》首段（等第、郡名、军额、升府年份、土贡）、属县、
// 史料权重、原版民情与地块读数，并算出该路地块读数层的原值均值（数据模块的 regionMeans）。
// 用法（仓库根目录）：node docs/scenario-data-repair-20260924/tools/shaosong-brief.js <路名> [原版剧本 json] [树键，默认 player]
//   原版剧本默认从 git 取 rebuild-shaosong.js 的 BASE_COMMIT。
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const sources = require(path.join(DIR, 'data/shaosong-sources.js'));
const SCENARIO_REL = 'scenarios/绍宋·建炎元年八月（官方）.json';
// 外藩树用各自框架数据的权重函数
const FRAMES = { fac_jin: 'shaosong-jin-frame.js', fac_hebei_yijun: 'shaosong-jin-frame.js', fac_xixia: 'shaosong-xixia.js' };
function frameWeights(name, circuit) {
  const f = FRAMES[process.argv[4] || 'player'];
  if (f) return require(path.join(DIR, 'data', f)).weights(name, circuit);
  const hh = sources.householdWeight(name);
  const comm = sources.commerceWeight(name, circuit);
  return { households: hh.households, householdBasis: hh.basis, commerce: comm.value, commerceBasis: comm.basis };
}

const circuit = process.argv[2];
const baseFile = process.argv[3];
const treeKey = process.argv[4] || 'player';
const base = JSON.parse(baseFile ? fs.readFileSync(baseFile, 'utf8')
  : execFileSync('git', ['show', '5b243f02:' + SCENARIO_REL], { cwd: REPO, maxBuffer: 512 * 1024 * 1024 }).toString('utf8'));
const regions = new Map(base.map.regions.map((r) => [r.id, r]));
const { flatLeaves } = require(path.join(DIR, 'data/shaosong-common.js'));
const leaves = flatLeaves(base.adminHierarchy[treeKey].divisions[0]).filter((l) => regions.get(l.mapRegionId).circuitName === circuit);
if (!leaves.length) { console.error('原版里没有路 ' + circuit); process.exit(2); }

const KEYS = ['development', 'unrest', 'taxBurden', 'armyPressure'];
const means = {};
const w = leaves.reduce((a, l) => a + l.population, 0);
KEYS.forEach((k) => { means[k] = Math.round(leaves.reduce((a, l) => a + regions.get(l.mapRegionId)[k] * l.population, 0) / w * 100) / 100; });
const idxMean = (k) => Math.round(leaves.reduce((a, l) => a + l[k] * l.population, 0) / w * 10) / 10;
console.log('## ' + circuit + '（' + leaves.length + ' 块）');
console.log('regionMeans: ' + JSON.stringify(means));
console.log('原版均值：民心 ' + idxMean('minxinLocal') + '，贪腐 ' + idxMean('corruptionLocal') + '，繁荣 ' + idxMean('prosperity') +
  '，征到 ' + leaves[0].fiscalDetail.compliance + '，截留 ' + leaves[0].fiscalDetail.skimmingRate);
leaves.forEach((l) => {
  const r = regions.get(l.mapRegionId);
  const spec = sources.LEAF_SPECS[l.name] || {};
  const entry = sources.pickSongshi(spec.songshi || l.name);
  const w = frameWeights(l.name, circuit);
  const hh = { households: w.households, basis: w.householdBasis };
  const comm = { value: w.commerce, basis: w.commerceBasis };
  console.log('\n### ' + l.name + '  [' + l.id + '] 地图地形 ' + r.terrain + '；原值 民' + l.minxinLocal + ' 贪' + l.corruptionLocal + ' 繁' + l.prosperity +
    ' | 读数 发展' + r.development + ' 不稳' + r.unrest + ' 税' + r.taxBurden + ' 军' + r.armyPressure);
  console.log('  权重：户 ' + Math.round(hh.households) + '；商税 ' + Math.round(comm.value) + '（' + comm.basis.replace(/^《通考》/, '') + '）');
  if (entry) {
    console.log('  宋史·' + entry.subCircuitS + '·' + entry.nameS + '：' + entry.firstParagraph.slice(0, 260));
    console.log('  属县：' + entry.countiesS.map((c, i) => c + (entry.countyGrades[i] ? '(' + entry.countyGrades[i] + ')' : '')).join('、'));
  } else {
    console.log('  （志中无条目）' + (spec.basis || spec.note || ''));
  }
});
