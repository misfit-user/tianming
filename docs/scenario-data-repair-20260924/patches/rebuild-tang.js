// 从修复前的原版晚唐剧本出发，按顺序重跑本目录的晚唐补丁，重新生成真源与报告。
// 各补丁都是确定性的，重跑结果应逐字节相同；改了补丁或数据模块之后，用它整体重建。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/rebuild-tang.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_REL = 'scenarios/晚唐·开成五年（官方）.json';

// 晚唐修复开始时，真源最后一次改动的提交；这之后晚唐真源只被本目录的补丁改过
const BASE_COMMIT = 'ffb2db25';

function run(args) {
  const out = execFileSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.trim().split('\n').pop();
}

function main() {
  const original = execFileSync('git', ['show', BASE_COMMIT + ':' + SCENARIO_REL], { cwd: REPO, maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(path.join(REPO, SCENARIO_REL), original);
  console.log('已写回原版（' + BASE_COMMIT + '）');
  // 第一刀：死字段清理、格式归一、道长官官称
  console.log('字段清理：' + run([path.join(DIR, 'patches/tang-fields.js'), '--report', path.join(DIR, 'reports/tang-fields.md'), '--write']));
  // 第二刀：唐廷与河朔、昭义四镇道内各州按天宝户重分户口与随人口走的账，开局账按财政引擎重算
  console.log('户口重建：' + run([path.join(DIR, 'patches/tang-households.js'), '--report', path.join(DIR, 'reports/tang-households.md'), '--write']));
}

main();
