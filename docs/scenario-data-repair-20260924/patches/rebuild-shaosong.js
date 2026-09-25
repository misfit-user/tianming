// 从修复前的原版绍宋剧本出发，按顺序重跑本目录的绍宋补丁，重新生成真源与各路报告。
// 各补丁都是确定性的（只读原版数字、史料与数据模块），重跑结果应逐字节相同；
// 改了数据模块、来源库或补丁引擎之后，用它整体重建，报告里「前」一栏始终是原版数值。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/rebuild-shaosong.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_REL = 'scenarios/绍宋·建炎元年八月（官方）.json';

// 绍宋修复开始时的主干提交；这之后绍宋真源只被本目录的补丁改过
const BASE_COMMIT = '5b243f02';

// 各路数据模块，按落刀顺序
const CIRCUITS = ['liangzhe', 'jingji', 'jingdong', 'jingxi', 'huainan', 'jiangnan', 'jinghu-fujian', 'guangnan-dong', 'guangnan-xi', 'chuan-west', 'chuan-east', 'xibei'];

// 外藩：先用各自的框架数据补路一级，再跑逐块数据模块（框架与逐块数据可在同一文件）
const FOREIGN = [
  { key: 'jin', frame: 'shaosong-jin-frame.js' },
  { key: 'hebei-yijun', frame: 'shaosong-hebei-yijun.js' },
  { key: 'xixia', frame: 'shaosong-xixia.js' }
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

  console.log('补路一级：' + run([path.join(DIR, 'patches/shaosong-circuits.js'), '--report', path.join(DIR, 'reports/shaosong-circuits.md'), '--write']));
  CIRCUITS.forEach((key) => {
    const moduleFile = path.join(DIR, 'data', 'shaosong-' + key + '.js');
    const reportFile = path.join(DIR, 'reports', 'shaosong-' + key + '.md');
    const last = run([path.join(DIR, 'patches/tianqi-prefectures.js'), moduleFile, '--report', reportFile, '--write']);
    console.log(key + '：' + last);
  });
  FOREIGN.forEach(({ key, frame }) => {
    const circuits = run([path.join(DIR, 'patches/shaosong-circuits.js'), path.join(DIR, 'data', frame),
      '--report', path.join(DIR, 'reports', 'shaosong-' + key + '-circuits.md'), '--write']);
    console.log(key + ' 补路一级：' + circuits);
    const last = run([path.join(DIR, 'patches/tianqi-prefectures.js'), path.join(DIR, 'data', 'shaosong-' + key + '.js'),
      '--report', path.join(DIR, 'reports', 'shaosong-' + key + '.md'), '--write']);
    console.log(key + '：' + last);
  });
}

main();
