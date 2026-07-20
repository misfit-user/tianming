#!/usr/bin/env node
// Recompute web/.hot-update-manifest.json with the production hot builder's exact file collector.
// Normal CI uses --check. Tracked writes are reserved for release prepare/owner maintenance via --write.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
function flag(name) { return process.argv.includes('--' + name); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function comparable(manifest) {
  const copy = Object.assign({}, manifest);
  delete copy.generatedAt;
  return copy;
}
function manifestProblems(expected, actual) {
  const problems = [];
  for (const key of ['type', 'version', 'entry']) {
    if (expected && actual && expected[key] !== actual[key]) problems.push(key + ' mismatch: canonical=' + expected[key] + ' actual=' + actual[key]);
  }
  const oldRows = new Map(((expected && expected.files) || []).map(row => [row.path, row]));
  const newRows = new Map(((actual && actual.files) || []).map(row => [row.path, row]));
  for (const [rel, row] of newRows) {
    const old = oldRows.get(rel);
    if (!old) problems.push('missing canonical path: ' + rel);
    else if (old.size !== row.size || old.sha256 !== row.sha256) problems.push('stale canonical hash/size: ' + rel);
  }
  for (const rel of oldRows.keys()) if (!newRows.has(rel)) problems.push('obsolete canonical path: ' + rel);
  if (JSON.stringify((expected && expected.remove) || []) !== JSON.stringify((actual && actual.remove) || [])) problems.push('remove list mismatch');
  return problems;
}

function generate(root, version) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-hot-baseline-'));
  const manifestPath = path.join(tmp, 'manifest.json');
  try {
    const builder = path.join(root, 'web', 'tools', 'build-hot-update-package.js');
    const args = [builder, '--version', version, '--out', path.join(tmp, 'out'), '--manifest-only', '--manifest-out', manifestPath,
      '--include-preview', '--web-root', path.join(root, 'web'), '--app-root', root, '--allow-same-version'];
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('hot manifest collector failed\n' + String(result.stdout || '') + String(result.stderr || ''));
    return readJson(manifestPath);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  if (flag('self-test')) {
    const base = { type: 'tianming-hot-update', version: '1', entry: 'index.html', generatedAt: 'a', files: [{ path: 'a.js', size: 1, sha256: 'aa' }], remove: [] };
    const timeOnly = Object.assign({}, base, { generatedAt: 'b' });
    if (manifestProblems(base, timeOnly).length) throw new Error('self-test generatedAt should be ignored');
    const changed = Object.assign({}, timeOnly, { files: [{ path: 'a.js', size: 1, sha256: 'bb' }, { path: 'b.js', size: 2, sha256: 'cc' }] });
    const p = manifestProblems(base, changed);
    if (!p.some(x => x.includes('stale canonical')) || !p.some(x => x.includes('missing canonical'))) throw new Error('self-test stale/missing paths not detected');
    console.log('PASS assertions=3');
    return;
  }
  const write = flag('write');
  const check = flag('check');
  if ((write ? 1 : 0) + (check ? 1 : 0) !== 1) throw new Error('choose exactly one of --check or --write');
  const root = path.resolve(arg('root', path.resolve(__dirname, '..')));
  const pkg = readJson(path.join(root, 'package.json'));
  const version = String(arg('version', pkg.build && pkg.build.buildVersion || '')).trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error('invalid four-part version: ' + version);
  const target = path.join(root, 'web', '.hot-update-manifest.json');
  const actual = generate(root, version);
  const canonical = fs.existsSync(target) ? readJson(target) : null;
  const problems = canonical ? manifestProblems(canonical, actual) : ['canonical baseline missing'];
  if (check) {
    // 2026-07-20·基线是仓主全量热更树（含未跟踪游戏资产 web/assets/* 等）的真相。OTA(桌面热更+capgo)
    // 是整包替换·必须自带这些资产（1.3.4.8 及以前 OTA 恒含·~828MB）。但 CI / 部分 checkout 只有 git
    // 跟踪文件、磁盘上没有这些资产，generate() 自然不含它们 → 会把「基线有、本 checkout 磁盘无」的资产
    // 条目误报 obsolete。故 --check 容忍：基线里指向「本地磁盘不存在」的条目（=此 checkout 缺席的未跟踪
    // 资产）不算 stale。仍严格校验：在场文件的 hash/size 必须对齐（stale）、且 generate 不得含基线外的多余
    // 文件（missing）。据此恢复含资产 OTA 后·CI(无 assets)仍绿·仓主本机(有 assets)全量逐文件校验。
    const effective = problems.filter(p => {
      const m = /^obsolete canonical path: (.+)$/.exec(p);
      if (!m) return true; // stale/missing/remove-list 等一律照旧严格
      return fs.existsSync(path.join(root, 'web', m[1])); // 文件在场却被 generate 漏掉=真问题；磁盘缺席=此 checkout 无该未跟踪资产·容忍
    });
    if (effective.length) throw new Error('canonical hot baseline stale (' + effective.length + ')\n' + effective.slice(0, 30).join('\n'));
    console.log('PASS canonical hot baseline files=' + actual.files.length + ' version=' + version
      + (effective.length !== problems.length ? '（容忍 ' + (problems.length - effective.length) + ' 条本 checkout 缺席的未跟踪资产条目）' : ''));
    return;
  }
  if (!problems.length && JSON.stringify(comparable(canonical)) === JSON.stringify(comparable(actual))) {
    console.log('UNCHANGED canonical hot baseline files=' + actual.files.length + ' version=' + version);
    return;
  }
  fs.writeFileSync(target, JSON.stringify(actual, null, 2) + '\n', 'utf8');
  console.log('WROTE ' + target + ' files=' + actual.files.length + ' version=' + version + ' fixed=' + problems.length);
}

if (require.main === module) {
  try { main(); }
  catch (err) { console.error('FAIL ' + (err && err.stack || err)); process.exit(1); }
}

module.exports = { comparable, manifestProblems, generate, main };
