// 从修复前的原版天启剧本出发，按顺序重跑本目录的全部补丁，重新生成真源与各省报告。
// 各补丁都是确定性的（只读省级总数与数据模块），重跑结果应与逐刀提交的结果逐字节相同；
// 改了某个数据模块或补丁引擎之后，用它整体重建，报告里「前」一栏始终是原版数值。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/rebuild-tianqi.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_REL = 'scenarios/天启七年·九月（官方）.json';

// 修复开始前的主干提交；这之后天启真源只被本目录的补丁改过
const BASE_COMMIT = '7ca411c8';

// 各省数据模块，按首次落刀的顺序
const PROVINCES = [
  'nanzhili', 'beizhili',
  'zhejiang', 'jiangxi', 'fujian', 'shandong',
  'huguang', 'shanxi', 'henan', 'shaanxi',
  'sichuan', 'guangdong', 'guangxi', 'yunnan', 'guizhou',
  'liaodong', 'wusizang', 'duogan'
];

function run(args) {
  const out = execFileSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = out.trim().split('\n');
  return lines[lines.length - 1];
}

function main() {
  const original = execFileSync('git', ['show', BASE_COMMIT + ':' + SCENARIO_REL], { cwd: REPO, maxBuffer: 512 * 1024 * 1024 });
  fs.writeFileSync(path.join(REPO, SCENARIO_REL), original);
  console.log('原版真源（' + BASE_COMMIT + '）已写回');

  console.log('势力引用：' + run([path.join(DIR, 'patches/tianqi-faction-refs.js'), '--write']));
  PROVINCES.forEach((key) => {
    const moduleFile = path.join(DIR, 'data', 'tianqi-' + key + '.js');
    const reportFile = path.join(DIR, 'reports', 'tianqi-' + key + '.md');
    const last = run([path.join(DIR, 'patches/tianqi-prefectures.js'), moduleFile, '--report', reportFile, '--write']);
    console.log(key + '：' + last);
  });
}

main();
