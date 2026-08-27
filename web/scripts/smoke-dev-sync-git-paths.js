#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const parser = require('../../scripts/dev-sync-latest.js');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-git-z-paths-'));
let assertions = 0;
function assert(condition, label) {
  if (!condition) throw new Error('FAIL·' + label);
  assertions++;
  console.log('  ok·' + label);
}
function git(args, encoding) {
  return execFileSync('git', args, { cwd: TMP, encoding: encoding === undefined ? 'utf8' : encoding });
}

try {
  const statusRows = parser.parseStatusZ(Buffer.from(
    ' M 中文地图.json\0' +
    'A  带 空格.js\0' +
    ' M 含"引号".json\0' +
    '?? tab\tname.js\0' +
    'R  新中文.json\0旧中文.json\0'
  ));
  assert(statusRows[0].path === '中文地图.json', 'status -z 保留中文路径');
  assert(statusRows[1].path === '带 空格.js', 'status -z 保留空格路径');
  assert(statusRows[2].path === '含"引号".json', 'status -z 保留引号路径');
  assert(statusRows[3].path === 'tab\tname.js', 'status -z 保留 tab 路径');
  assert(statusRows[4].path === '新中文.json' && statusRows[4].originalPath === '旧中文.json', 'status -z 按 new/old 解析 rename');

  const diffRows = parser.parseNameStatusZ(Buffer.from(
    'M\0中文地图.json\0' +
    'A\0带 空格.js\0' +
    'D\0含"引号".json\0' +
    'R100\0旧中文.json\0新中文.json\0' +
    'C075\0source.js\0tab\tname.js\0'
  ));
  assert(diffRows[0].path === '中文地图.json' && diffRows[0].kind === 'M', 'name-status -z 解析普通状态');
  assert(diffRows[3].originalPath === '旧中文.json' && diffRows[3].path === '新中文.json', 'name-status -z 按 old/new 解析 rename');
  assert(diffRows[4].kind === 'C' && diffRows[4].path === 'tab\tname.js', 'name-status -z 解析 copy 双路径和 tab');

  git(['init', '-q']);
  git(['config', 'user.email', 'smoke@example.invalid']);
  git(['config', 'user.name', 'Smoke']);
  const initial = {
    '中文地图.json': 'one',
    '带 空格.js': 'two',
    '旧中文.json': 'rename-content'
  };
  Object.keys(initial).forEach((name) => fs.writeFileSync(path.join(TMP, name), initial[name]));
  git(['add', '-A']);
  git(['commit', '-qm', 'initial']);
  fs.appendFileSync(path.join(TMP, '中文地图.json'), '-changed');
  fs.appendFileSync(path.join(TMP, '带 空格.js'), '-changed');
  fs.renameSync(path.join(TMP, '旧中文.json'), path.join(TMP, '新中文.json'));

  const realStatus = parser.parseStatusZ(git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], null));
  const statusPaths = new Set(realStatus.map((row) => row.path));
  assert(statusPaths.has('中文地图.json') && statusPaths.has('带 空格.js'), '真实 Git status 输出逐字保留中文和空格路径');
  assert(realStatus.some((row) => row.path === '新中文.json' || row.originalPath === '旧中文.json'), '真实 Git status 输出保留中文 rename 身份');

  git(['add', '-A']);
  const stagedStatus = parser.parseStatusZ(git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], null));
  assert(stagedStatus.some((row) => row.x === 'R' && row.path === '新中文.json' && row.originalPath === '旧中文.json'),
    '真实 staged status 按 new/old 解析 rename 双路径');
  git(['commit', '-qm', 'changed']);
  const realDiff = parser.parseNameStatusZ(git(['diff', '--name-status', '-z', 'HEAD~1', 'HEAD'], null));
  assert(realDiff.some((row) => row.kind === 'R' && row.originalPath === '旧中文.json' && row.path === '新中文.json'), '真实 Git diff 正确解析中文 rename 双路径');
  assert(realDiff.some((row) => row.path === '中文地图.json') &&
    realDiff.every((row) => !/^".*"$/.test(row.path)), '真实 Git diff 不产生 quoted-path 伪路径');

  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'dev-sync-latest.js'), 'utf8');
  assert(/status'\s*,\s*'--porcelain=v1'\s*,\s*'-z'/.test(source) && /'--name-status'\s*,\s*'-z'/.test(source), '生产同步调用固定使用 NUL 分隔');
  assert(!/line\.split\(['"]\\t['"]\)|replace\(\/\^"\|"\$/.test(source), '生产同步不再手拆 tab 或剥 Git 引号');

  console.log('PASS assertions=' + assertions);
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
}
