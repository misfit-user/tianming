// 从修复前的原版绍宋剧本（rebuild-shaosong.js 的 BASE_COMMIT）抽出各外藩叶子的原账户数与口数，
// 写成 sources/shaosong-original-foreign-leaves.json，供无户口史料可考的外藩按原账比例分（核算组已并成一块）。
// 用法（仓库根目录）：node docs/scenario-data-repair-20260924/tools/extract-original-foreign.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const { flatLeaves } = require(path.join(DIR, 'data/shaosong-common.js'));
const BASE_COMMIT = '5b243f02';
const SCENARIO_REL = 'scenarios/绍宋·建炎元年八月（官方）.json';

const base = JSON.parse(execFileSync('git', ['show', BASE_COMMIT + ':' + SCENARIO_REL], { cwd: REPO, maxBuffer: 512 * 1024 * 1024 }).toString('utf8'));
const out = { baseCommit: BASE_COMMIT, trees: {} };
Object.entries(base.adminHierarchy).forEach(([key, tree]) => {
  if (key === 'player' || key === 'fac_jin') return;
  out.trees[key] = {};
  flatLeaves(tree.divisions[0]).forEach((leaf) => {
    out.trees[key][leaf.name] = { households: leaf.populationDetail.households, mouths: leaf.populationDetail.mouths };
  });
});
const file = path.join(DIR, 'sources/shaosong-original-foreign-leaves.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log('写入 ' + path.relative(REPO, file) + '：' + Object.keys(out.trees).length + ' 棵树');
