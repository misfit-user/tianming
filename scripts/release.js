#!/usr/bin/env node
// ============================================================
//  release.js — 天命两阶段发版工具（dev 侧）
//  2026-07-18·prepare 在短命分支盖戳并产出可审查基线；publish 只接受已合入、
//  clean 且与 origin/main 同步的 main，构建期不再修改 tracked 版本文件。
//
//  prepare：版本扇出盖戳 → 桌面热更构建 → 基线刷新（提交这些 tracked 改动并走 PR）
//  publish：已盖戳版本复验 → 双端重建 → 基线一致性复验 → staging → gh release
//  2026-07-07·大制品不再复制进 staging（旧法多拷 ~3.4GB·两度双盘满 ENOSPC）
//
//  用法：
//    node scripts/release.js --prepare --version 1.3.4.9 --notes "本版说明"
//    node scripts/release.js --publish --version 1.3.4.9 --notes "本版说明"
//  选项：
//    --with-installer        把 E:\版本\测试版<V> 的 latest.yml/exe/blockmap 一起发（exe 同卷别名零拷贝直传）
//    --min-app-version X     热更 feed 标注所需最低本体版本（触发客户端「需更新本体」流程）
//    --no-delta              capgo 只出全量（不出差量 manifest/对象包）
//    --no-upload             publish 的本地构建模式·允许非 main/dirty·绝不写 GitHub/服务器
//    --offline               仅可与 --publish --no-upload 合用·跳过线上只读版本闸
//    --dry-run               只跑闸门并打印计划·不写任何文件
//    --version-code N        显式安卓 versionCode（默认数字拼接·任一段>9 时必须显式给）
//    --self-test             两阶段状态机 + fanOut 对临时副本自测后退出
//    --repo-root DIR         合成仓自测用（默认本仓）
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { mapBuildToSemver } = require('./version-map');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const windowsSigning = require('./lib/windows-signing.js');

const REAL_ROOT = path.resolve(__dirname, '..');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0 && process.argv[i + 1] !== undefined && !String(process.argv[i + 1]).startsWith('--')) return process.argv[i + 1];
  return dflt;
}
function flag(name) { return process.argv.includes('--' + name); }
function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function log(msg) { console.log(msg); }
function today() {
  const d = new Date();
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function readJson(p) {
  let raw = fs.readFileSync(p, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
function cmpVersions(a, b) {
  const aa = String(a || '0').split(/[.+-]/).map(n => { const v = parseInt(n, 10); return Number.isFinite(v) ? v : 0; });
  const bb = String(b || '0').split(/[.+-]/).map(n => { const v = parseInt(n, 10); return Number.isFinite(v) ? v : 0; });
  const n = Math.max(aa.length, bb.length, 4);
  for (let i = 0; i < n; i++) { const av = aa[i] || 0, bv = bb[i] || 0; if (av > bv) return 1; if (av < bv) return -1; }
  return 0;
}

function gateReleaseContracts() {
  const scripts = [
    { path: path.join(CFG.root, 'web', 'scripts', 'sync-official-scenarios.js'), args: ['--check'] },
    { path: path.join(CFG.root, 'web', 'scripts', 'verify-official-scenario-parity.js'), args: [] },
    { path: path.join(CFG.root, 'scripts', 'verify-release-contract.js'), args: [] }
  ];
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [script.path].concat(script.args), { cwd: CFG.root, stdio: 'inherit' });
    if (result.status !== 0) die('release contract failed: ' + path.relative(CFG.root, script.path));
  }
  log('⓪ release contracts·official truth + cross-pipeline parity ✓');
}

const CFG = {
  root: path.resolve(arg('repo-root', REAL_ROOT)),
  version: String(arg('version', '') || '').trim(),
  notes: String(arg('notes', '') || ''),
  minAppVersion: String(arg('min-app-version', '') || ''),
  withInstaller: flag('with-installer'),
  noDelta: flag('no-delta'),
  noUpload: flag('no-upload'),
  prepare: flag('prepare'),
  publish: flag('publish'),
  offline: flag('offline'),
  dryRun: flag('dry-run'),
  versionCodeArg: arg('version-code', ''),
  ts: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
  publishHead: ''
};
const P = {
  pkg: () => path.join(CFG.root, 'package.json'),
  pkgLock: () => path.join(CFG.root, 'package-lock.json'),
  gradle: () => path.join(CFG.root, 'mobile', 'android', 'app', 'build.gradle'),
  mobileReleaseVersion: () => path.join(CFG.root, 'mobile', 'release-version.json'),
  web: () => path.join(CFG.root, 'web'),
  versionJson: () => path.join(CFG.root, 'web', 'version.json'),
  indexHtml: () => path.join(CFG.root, 'web', 'index.html'),
  changelog: () => path.join(CFG.root, 'web', 'changelog.json'),
  hotBaseline: () => path.join(CFG.root, 'web', '.hot-update-manifest.json'),
  releaseHot: () => path.join(CFG.root, 'release-hot'),
  capgoDist: () => path.join(CFG.root, 'mobile', 'capgo-dist'),
  staging: () => path.join(CFG.root, 'release-hot', '_release-' + CFG.version),
  hotBuilder: () => path.join(CFG.root, 'web', 'tools', 'build-hot-update-package.js'),
  hotBaselineSync: () => path.join(CFG.root, 'scripts', 'sync-hot-baseline.js'),
  capgoBuilder: () => path.join(CFG.root, 'mobile', 'scripts', 'build-capgo-bundle.ps1'),
  deployPy: () => path.join(REAL_ROOT, 'scripts', 'deploy.py'),       // deploy 永远取真仓最新版
  verifyArtifacts: () => path.join(REAL_ROOT, 'scripts', 'lib', 'verify-artifacts.js'),
  installerDir: () => 'E:\\版本\\测试版' + CFG.version
};
const PUBLIC_BASE = 'https://api.themisfitserspeople.top/tianming';

// ── ⓪ 两阶段/仓库真值闸 ──────────────────────────────────────────────────────
function validateModeFacts(facts) {
  const problems = [];
  if ((facts.prepare ? 1 : 0) + (facts.publish ? 1 : 0) !== 1) problems.push('须且只能选择 --prepare 或 --publish');
  if (facts.noUpload && !facts.publish) problems.push('--no-upload 仅可与 --publish 合用');
  if (facts.offline && !(facts.publish && facts.noUpload)) problems.push('--offline 仅可与 --publish --no-upload 合用');
  return problems;
}

function gateMode() {
  const problems = validateModeFacts(CFG);
  if (!CFG.noUpload && CFG.root !== REAL_ROOT) problems.push('prepare/正式 publish 不允许 --repo-root 指向其他仓库');
  if (problems.length) die(problems.join('；'));
}

function gitRun(args, root) {
  return spawnSync('git', args, { cwd: root || CFG.root, encoding: 'utf-8' });
}

function gitOutput(args, label, root) {
  const result = gitRun(args, root);
  if (result.status !== 0) die((label || ('git ' + args.join(' '))) + '失败·' + String(result.stderr || result.stdout || '').trim());
  return String(result.stdout || '').trim();
}

function collectRepositoryFacts(root) {
  const cwd = root || CFG.root;
  const status = gitRun(['status', '--porcelain=v1', '--untracked-files=all'], cwd);
  const branch = gitRun(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd);
  const head = gitRun(['rev-parse', 'HEAD'], cwd);
  const originMain = gitRun(['rev-parse', '--verify', 'refs/remotes/origin/main'], cwd);
  const originUrlResult = gitRun(['remote', 'get-url', 'origin'], cwd);
  const originUrl = originUrlResult.status === 0 ? String(originUrlResult.stdout || '').trim() : '';
  const ancestor = originMain.status === 0 && head.status === 0
    ? gitRun(['merge-base', '--is-ancestor', 'refs/remotes/origin/main', 'HEAD'], cwd)
    : { status: 1 };
  return {
    isGit: status.status === 0,
    clean: status.status === 0 && !String(status.stdout || '').trim(),
    dirtySummary: String(status.stdout || '').trim(),
    branch: branch.status === 0 ? String(branch.stdout || '').trim() : '',
    head: head.status === 0 ? String(head.stdout || '').trim() : '',
    originMain: originMain.status === 0 ? String(originMain.stdout || '').trim() : '',
    originUrl,
    officialOrigin: /github\.com[:/]misfit-user\/tianming(?:\.git)?\/?$/i.test(originUrl),
    originMainAncestor: ancestor.status === 0
  };
}

function validatePrepareRepositoryFacts(facts) {
  const problems = [];
  if (!facts.isGit) problems.push('不是 git 工作树');
  if (!facts.clean) problems.push('工作树不干净');
  if (!facts.branch) problems.push('HEAD detached');
  else if (facts.branch === 'main') problems.push('prepare 必须在短命分支，不能直接改 main');
  if (!facts.originMain) problems.push('缺 origin/main');
  else if (!facts.originMainAncestor) problems.push('当前分支不是最新 origin/main 的后代');
  if (!facts.officialOrigin) problems.push('origin 不是 misfit-user/tianming');
  return problems;
}

function validatePublishRepositoryFacts(facts, expectedHead) {
  const problems = [];
  if (!facts.isGit) problems.push('不是 git 工作树');
  if (!facts.clean) problems.push('工作树不干净');
  if (facts.branch !== 'main') problems.push('publish 只允许 main，当前为 ' + (facts.branch || 'detached HEAD'));
  if (!facts.originMain) problems.push('缺 origin/main');
  else if (!facts.head || facts.head !== facts.originMain) problems.push('HEAD 未与 origin/main 精确同步');
  if (!facts.officialOrigin) problems.push('origin 不是 misfit-user/tianming');
  if (expectedHead && facts.head !== expectedHead) problems.push('构建期间 HEAD 改变');
  return problems;
}

function fetchOriginMain() {
  const result = gitRun(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
  if (result.status !== 0) die('读取 origin/main 失败·' + String(result.stderr || result.stdout || '').trim());
}

function gatePrepareRepository() {
  const before = collectRepositoryFacts();
  if (!before.isGit || !before.clean || !before.branch || before.branch === 'main') {
    const p = validatePrepareRepositoryFacts(before).filter(x => !x.includes('origin/main'));
    die('prepare 仓库闸·' + p.join('；') + (before.dirtySummary ? '\n' + before.dirtySummary : ''));
  }
  fetchOriginMain();
  const facts = collectRepositoryFacts();
  const problems = validatePrepareRepositoryFacts(facts);
  if (problems.length) die('prepare 仓库闸·' + problems.join('；') + (facts.dirtySummary ? '\n' + facts.dirtySummary : ''));
  log('⓪ prepare 仓库闸·clean ' + facts.branch + '·origin/main 是 HEAD 祖先 ✓');
  return facts;
}

function gatePublishRepository(label) {
  fetchOriginMain();
  const facts = collectRepositoryFacts();
  const problems = validatePublishRepositoryFacts(facts, CFG.publishHead);
  if (problems.length) die('publish 仓库闸(' + label + ')·' + problems.join('；') + (facts.dirtySummary ? '\n' + facts.dirtySummary : ''));
  if (!CFG.publishHead) CFG.publishHead = facts.head;
  log('⓪ publish 仓库闸(' + label + ')·clean main = origin/main @ ' + facts.head.slice(0, 12) + ' ✓');
  return facts;
}

function validateGitHubOwnerFacts(viewer, owner) {
  if (!viewer || !owner) return ['无法读取 GitHub 当前账号或仓库 owner'];
  if (String(viewer).toLowerCase() !== String(owner).toLowerCase()) return ['当前 gh 账号 ' + viewer + ' 不是仓库 owner ' + owner];
  return [];
}

function gateGitHubOwner() {
  const viewerResult = spawnSync('gh', ['api', 'user', '--jq', '.login'], { cwd: CFG.root, encoding: 'utf-8' });
  if (viewerResult.status !== 0) die('读取 gh 当前账号失败·' + String(viewerResult.stderr || viewerResult.stdout || '').trim());
  const ownerResult = spawnSync('gh', ['api', 'repos/misfit-user/tianming', '--jq', '.owner.login'], { cwd: CFG.root, encoding: 'utf-8' });
  if (ownerResult.status !== 0) die('读取 GitHub 仓库 owner 失败·' + String(ownerResult.stderr || ownerResult.stdout || '').trim());
  const viewer = String(viewerResult.stdout || '').trim();
  const owner = String(ownerResult.stdout || '').trim();
  const problems = validateGitHubOwnerFacts(viewer, owner);
  if (problems.length) die('production owner 闸·' + problems.join('；'));
  log('⓪ production owner 闸·gh=' + viewer + ' ✓');
}

// ── ① 版本闸 ─────────────────────────────────────────────────────────────────
function targetVersionCode() {
  if (!CFG.version) die('缺 --version（如 1.3.4.0）');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(CFG.version)) die('--version 须 4 段数字（如 1.3.4.0）·拿到 ' + CFG.version);
  const parts = CFG.version.split('.').map(Number);
  let code;
  if (CFG.versionCodeArg) {
    code = parseInt(CFG.versionCodeArg, 10);
    if (!Number.isFinite(code)) die('--version-code 非数字');
  } else {
    if (parts.some(p => p > 9)) die('版本某段 >9·数字拼接 versionCode 会歧义（如 1.3.10.0 vs 1.31.0.0）·请显式 --version-code');
    code = parseInt(parts.join(''), 10);
  }
  return code;
}

function gatePrepareVersion() {
  const code = targetVersionCode();
  const pkg = readJson(P.pkg());
  const cur = (pkg.build && pkg.build.buildVersion) || pkg.version;
  if (cmpVersions(CFG.version, cur) <= 0) die('版本不单调·--version ' + CFG.version + ' ≤ 本仓 buildVersion ' + cur);
  const mobileVersion = readJson(P.mobileReleaseVersion());
  if (mobileVersion.version !== cur) die('mobile/release-version.json 与 package buildVersion 漂移·' + mobileVersion.version + ' ≠ ' + cur);
  if (code <= Number(mobileVersion.versionCode)) die('versionCode ' + code + ' ≤ canonical 现值 ' + mobileVersion.versionCode + '（安卓升级要求严格递增）');
  log('① 版本闸·' + cur + ' → ' + CFG.version + '·versionCode ' + mobileVersion.versionCode + ' → ' + code);
  return code;
}

function preparedVersionProblems(code, requireBaseline) {
  const problems = [];
  const pkg = readJson(P.pkg());
  if (!pkg.build || pkg.build.buildVersion !== CFG.version) problems.push('package.json buildVersion 未盖戳');
  if (pkg.version !== mapBuildToSemver(CFG.version)) problems.push('package.json semver 未按四段版本映射');
  if (!fs.existsSync(P.pkgLock())) problems.push('缺 package-lock.json');
  else {
    const lock = readJson(P.pkgLock());
    const lockRootVersion = lock.packages && lock.packages[''] && lock.packages[''].version;
    if (lock.version !== pkg.version || lockRootVersion !== pkg.version) problems.push('package-lock.json 根版本未与 package.json 同步');
  }
  if (pkg.build && pkg.build.directories && !String(pkg.build.directories.output || '').endsWith('测试版' + CFG.version)) problems.push('package.json output 未盖戳');
  if (pkg.build && typeof pkg.build.artifactName === 'string' && !pkg.build.artifactName.includes(CFG.version)) problems.push('package.json artifactName 未盖戳');
  if (!fs.existsSync(P.mobileReleaseVersion())) problems.push('缺 mobile/release-version.json');
  else {
    const mobileVersion = readJson(P.mobileReleaseVersion());
    if (mobileVersion.version !== CFG.version) problems.push('mobile canonical version 未盖戳');
    if (Number(mobileVersion.versionCode) !== code) problems.push('mobile canonical versionCode 未盖戳');
  }
  if (!fs.existsSync(P.versionJson()) || readJson(P.versionJson()).version !== CFG.version) problems.push('web/version.json 未盖戳');
  const html = fs.readFileSync(P.indexHtml(), 'utf-8');
  const escaped = CFG.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!(new RegExp('<meta\\s+name="tm-version"\\s+content="' + escaped + '"')).test(html)) problems.push('index.html meta tm-version 未盖戳');
  if (!(new RegExp('<span id="tm-foot-ver">' + escaped + '<\\/span>')).test(html)) problems.push('index.html footer 未盖戳');
  if (requireBaseline) {
    if (!fs.existsSync(P.hotBaseline())) problems.push('缺 web/.hot-update-manifest.json');
    else if (readJson(P.hotBaseline()).version !== CFG.version) problems.push('热更基线版本未盖戳');
  }
  return problems;
}

function gatePreparedVersion(requireBaseline) {
  const code = targetVersionCode();
  const problems = preparedVersionProblems(code, requireBaseline);
  if (problems.length) die('publish 只接受 prepare 后已合入的版本·' + problems.join('；'));
  log('① 已盖戳版本闸·' + CFG.version + '·versionCode ' + code + (requireBaseline ? '·基线同版' : '') + ' ✓');
  return code;
}

// ── ② changelog 闸 ───────────────────────────────────────────────────────────
function gateChangelog() {
  const cl = readJson(P.changelog());
  const top = cl.entries && cl.entries[0];
  if (!top) die('changelog.json 没有条目');
  if (String(top.module || '').indexOf(CFG.version) !== 0) {
    die('changelog 顶条目 module「' + String(top.module).slice(0, 30) + '…」未以 ' + CFG.version + ' 开头。先写好邸报条目再发版。');
  }
  if (top.date !== today()) log('  WARN·changelog 顶条目日期 ' + top.date + ' ≠ 今天 ' + today() + '（确认是否旧条目）');
  log('② changelog 闸·顶条目 ' + top.date + '·' + String(top.module).slice(0, 40));
}

// ── ③ 线上版本闸（防把更低版本发上去搁浅全体客户端） ─────────────────────────
async function gateLive() {
  if (CFG.offline) { log('③ 线上闸·--offline 跳过'); return { capgoManifest: null }; }
  async function getJson(url) {
    try {
      const r = await fetch(url + '?cb=' + Date.now(), { headers: { 'User-Agent': 'tm-release/1' } });
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }
  const hot = await getJson(PUBLIC_BASE + '/hot/hot-latest.json');
  const capgo = await getJson(PUBLIC_BASE + '/capgo/latest.json');
  if (hot && cmpVersions(CFG.version, hot.version) <= 0) die('线上 hot 已是 v' + hot.version + '·新版本必须更高');
  if (capgo && cmpVersions(CFG.version, capgo.version) <= 0) die('线上 capgo 已是 v' + capgo.version + '·新版本必须更高');
  log('③ 线上闸·hot v' + (hot && hot.version) + '·capgo v' + (capgo && capgo.version) + '·均低于 ' + CFG.version + ' ✓');
  return { capgoManifest: capgo && Array.isArray(capgo.manifest) ? capgo.manifest : null };
}

// ── ④ 版本扇出盖戳（全部带「恰一处匹配」断言 + .bak 备份 + 写后回读复核） ────
function fanOutVersions(code) {
  const edits = [];
  function backup(file) { fs.copyFileSync(file, file + '.bak-release-' + CFG.ts); }
  function regexEdit(file, desc, re, replacement) {
    const src = fs.readFileSync(file, 'utf-8');
    const matches = src.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || [];
    if (matches.length !== 1) die('扇出失败·' + desc + '·期望恰 1 处匹配·实得 ' + matches.length + '（' + file + '）');
    backup(file);
    const next = src.replace(re, replacement);
    fs.writeFileSync(file, next, 'utf-8');
    const verify = fs.readFileSync(file, 'utf-8');
    if (verify.indexOf(typeof replacement === 'string' ? replacement.replace(/\$\d/g, '') : '') === -1 && !re.test(verify) === false) { /* 回读由具体调用断言 */ }
    edits.push(desc);
  }
  // package.json·JSON round-trip（保键序·无注释·安全）
  {
    const file = P.pkg();
    const pkg = readJson(file);
    backup(file);
    // ★2026-07-04·根治「新安装包打开仍旧版」：旧实现 `CFG.version.split('.').slice(0,3)` 把四段
    //   1.3.4.5/1.3.4.6 一律截成 "1.3.4" → electron-builder/NSIS/electron-updater 认它·连续版同版本号
    //   → 新安装包不当升级。改用映射 a.b.(c*100+d)·每版随 buildVersion 递增(见 scripts/version-map.js)。
    pkg.version = mapBuildToSemver(CFG.version);
    pkg.build = pkg.build || {};
    pkg.build.buildVersion = CFG.version;
    if (pkg.build.directories && /测试版[\d.]+$/.test(String(pkg.build.directories.output || ''))) {
      pkg.build.directories.output = String(pkg.build.directories.output).replace(/测试版[\d.]+$/, '测试版' + CFG.version);
    }
    if (typeof pkg.build.artifactName === 'string' && /[\d]+(\.[\d]+){2,3}/.test(pkg.build.artifactName)) {
      pkg.build.artifactName = pkg.build.artifactName.replace(/[\d]+(\.[\d]+){2,3}/, CFG.version);
    }
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    const back = readJson(file);
    if (back.build.buildVersion !== CFG.version) die('扇出回读失败·package.json buildVersion');
    edits.push('package.json·version/buildVersion/output/artifactName');
  }
  // npm lockfile 的项目版本也是 canonical metadata。若 prepare 只改 package.json，
  // npm ci/打包元数据会继续携带旧版本，且下一版 prepare 会重复制造漂移。
  {
    const file = P.pkgLock();
    if (!fs.existsSync(file)) die('扇出失败·缺 package-lock.json');
    const lock = readJson(file);
    if (!lock.packages || !lock.packages['']) die('扇出失败·package-lock.json 缺 packages[""]');
    backup(file);
    const semver = mapBuildToSemver(CFG.version);
    lock.version = semver;
    lock.packages[''].version = semver;
    fs.writeFileSync(file, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
    const back = readJson(file);
    if (back.version !== semver || !back.packages || !back.packages[''] || back.packages[''].version !== semver) {
      die('扇出回读失败·package-lock.json 根版本');
    }
    edits.push('package-lock.json·version/packages[""]');
  }
  {
    const file = P.mobileReleaseVersion();
    if (fs.existsSync(file)) backup(file);
    fs.writeFileSync(file, JSON.stringify({ version: CFG.version, versionCode: code }, null, 2) + '\n', 'utf-8');
    const back = readJson(file);
    if (back.version !== CFG.version || Number(back.versionCode) !== code) die('扇出回读失败·mobile/release-version.json');
    edits.push('mobile/release-version.json·version/versionCode');
  }
  {
    const file = P.versionJson();
    if (fs.existsSync(file)) backup(file);
    fs.writeFileSync(file, JSON.stringify({ version: CFG.version, date: today(), notes: CFG.notes || '' }, null, 2) + '\n', 'utf-8');
    edits.push('web/version.json');
  }
  regexEdit(P.indexHtml(), 'index.html meta tm-version', /(<meta\s+name="tm-version"\s+content=")[\d.]+(")/, '$1' + CFG.version + '$2');
  regexEdit(P.indexHtml(), 'index.html footer 版本号', /(<span id="tm-foot-ver">)[\d.]+(<\/span>)/, '$1' + CFG.version + '$2');
  log('④ 版本扇出·' + edits.length + ' 处盖戳完成（各留 .bak-release-' + CFG.ts + '）');
}

function syncGeneratedAndroidVersion() {
  if (!fs.existsSync(P.gradle())) {
    log('  WARN·本机无 ignored mobile/android/app/build.gradle·Capgo Web bundle 可继续；构建原生 APK 前先 cap add/sync android');
    return false;
  }
  const canonical = readJson(P.mobileReleaseVersion());
  const src = fs.readFileSync(P.gradle(), 'utf-8');
  const codeMatches = src.match(/versionCode\s+\d+/g) || [];
  const nameMatches = src.match(/versionName\s+"[\d.]+"/g) || [];
  if (codeMatches.length !== 1 || nameMatches.length !== 1) die('ignored build.gradle 版本锚点须各恰一处');
  const next = src
    .replace(/versionCode\s+\d+/, 'versionCode ' + canonical.versionCode)
    .replace(/versionName\s+"[\d.]+"/, 'versionName "' + canonical.version + '"');
  fs.writeFileSync(P.gradle(), next, 'utf-8');
  const verify = fs.readFileSync(P.gradle(), 'utf-8');
  if (!verify.includes('versionCode ' + canonical.versionCode) || !verify.includes('versionName "' + canonical.version + '"')) die('ignored build.gradle 同步回读失败');
  log('⑦ native 派生版本同步·mobile/release-version.json → ignored build.gradle ✓');
  return true;
}

// ── ⑤ 桌面构建 ───────────────────────────────────────────────────────────────
function buildDesktop() {
  log('⑤ 桌面热更构建（全量清单·构建器自带 GATE0-6）...');
  // --include-preview 必带·preview/ 有运行时内容（御案图+剧本工坊）·1.3.2.0 发版踩过「桌面端漏 preview 双端不一致」的坑
  // （构建器的 isPreviewMockup 仍会剔掉 ~300MB 设计稿/截图·只留运行时）
  const args = [P.hotBuilder(), '--version', CFG.version, '--out', P.releaseHot(), '--notes', CFG.notes, '--include-preview'];
  if (CFG.minAppVersion) args.push('--min-app-version', CFG.minAppVersion);
  if (CFG.root !== REAL_ROOT) args.push('--web-root', P.web(), '--app-root', CFG.root);
  const r = spawnSync('node', args, { stdio: 'inherit', cwd: CFG.root });
  if (r.status !== 0) die('桌面构建失败（见上方 GATE 输出）');
}

// ── ⑥ 首装增量基线刷新（治「基线腐坏在 1.3.3.4」类沉疴） ─────────────────────
function refreshBaseline() {
  // self-test 的极小合成树没有完整 hot builder；正式仓只走同生产 collector 的可复用同步器。
  if (CFG.root !== REAL_ROOT) {
    const src = path.join(P.releaseHot(), 'manifests', CFG.version + '.json');
    if (fs.existsSync(P.hotBaseline())) fs.copyFileSync(P.hotBaseline(), P.hotBaseline() + '.bak-release-' + CFG.ts);
    fs.copyFileSync(src, P.hotBaseline());
    log('⑥ self-test 基线刷新·manifest fixture → canonical');
    return;
  }
  const result = spawnSync(process.execPath, [P.hotBaselineSync(), '--write', '--version', CFG.version], { cwd: CFG.root, stdio: 'inherit' });
  if (result.status !== 0) die('canonical 热更基线同步失败');
  log('⑥ canonical 基线刷新·production hot collector → web/.hot-update-manifest.json');
}

function comparableManifest(manifest) {
  const copy = Object.assign({}, manifest);
  delete copy.generatedAt;
  return copy;
}

function verifyBuiltBaseline(strict) {
  const builtPath = path.join(P.releaseHot(), 'manifests', CFG.version + '.json');
  if (!fs.existsSync(builtPath)) die('缺重建热更 manifest·' + builtPath);
  const built = comparableManifest(readJson(builtPath));
  const committed = comparableManifest(readJson(P.hotBaseline()));
  const a = JSON.stringify(built);
  const b = JSON.stringify(committed);
  if (a !== b) {
    const message = '重建热更 manifest 与已提交基线不一致·prepare 后源码/发布树发生漂移';
    if (strict) die(message + '·请回短命分支重新 --prepare 并走 PR');
    log('  WARN·' + message + '（--no-upload 本地构建允许继续，不可外写）');
    return false;
  }
  const digest = crypto.createHash('sha256').update(a).digest('hex').slice(0, 16);
  log('⑥ 已提交基线复验·忽略 generatedAt 后语义全等·sha256 ' + digest + ' ✓');
  return true;
}

// ── ⑦ 安卓构建 ───────────────────────────────────────────────────────────────
function buildAndroid(liveCapgoManifest) {
  syncGeneratedAndroidVersion();
  log('⑦ 安卓 capgo 构建（全量 zip' + (CFG.noDelta ? '' : ' + 差量 manifest + 新对象包') + '）...');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', P.capgoBuilder(),
    '-Version', CFG.version, '-WebDir', P.web(), '-OutDir', P.capgoDist()];
  if (!CFG.noDelta) {
    args.push('-Manifest', '-PackFiles');
    if (liveCapgoManifest) {
      const tmp = path.join(os.tmpdir(), 'tm-capgo-baseline-' + CFG.ts + '.json');
      fs.writeFileSync(tmp, JSON.stringify({ manifest: liveCapgoManifest }), 'utf-8');
      args.push('-BaselineManifest', tmp);
      log('  差量基线·线上 manifest ' + liveCapgoManifest.length + ' 条（新对象包只装增量）');
    } else {
      log('  无线上差量基线（首次开差量/离线）·新对象包=全部对象（一次性 ~500MB·之后每版几 MB）');
    }
  }
  const r = spawnSync('powershell', args, { stdio: 'inherit' });
  if (r.status !== 0) die('安卓构建失败');
}

// ── ⑧ feed 合成 + 独立复验闸（不信构建器·二道防线） ──────────────────────────
function composeAndGate() {
  log('⑧ feed 合成 + 制品独立复验...');
  const VA = require(P.verifyArtifacts());
  const hotZip = path.join(P.releaseHot(), 'tianming-hot-' + CFG.version + '.zip');
  const hotFeedPath = path.join(P.releaseHot(), 'hot-latest.json');
  const hotManifestPath = path.join(P.releaseHot(), 'manifests', CFG.version + '.json');
  const d = VA.verifyDesktop({ zipPath: hotZip, feedPath: hotFeedPath, manifestPath: hotManifestPath });
  if (!d.ok) { d.problems.forEach(p => console.error('  桌面制品问题·' + p)); die('桌面制品复验不过'); }
  log('  桌面 ✓ ' + JSON.stringify(d.stats));

  // zip 内 changelog 必须与源 byte 级一致（防并行改动夹带旧 changelog）
  {
    const AdmZip = require(path.join(REAL_ROOT, 'node_modules', 'adm-zip'));
    const z = new AdmZip(hotZip);
    const inZip = z.readFile('changelog.json');
    const onDisk = fs.readFileSync(P.changelog());
    if (!inZip || !inZip.equals(onDisk)) die('zip 内 changelog.json 与 web/changelog.json 不一致（构建间隙被改动？重新构建）');
  }

  let latestJson = null;
  if (!CFG.noDelta) {
    const buildInfo = readJson(path.join(P.capgoDist(), CFG.version + '-build.json'));
    const capgoManifest = readJson(path.join(P.capgoDist(), CFG.version + '-manifest.json'));
    latestJson = {
      version: CFG.version,
      url: PUBLIC_BASE + '/capgo/bundles/' + CFG.version + '.zip',
      size: buildInfo.zipBytes,
      manifest: capgoManifest.manifest
    };
    const c = VA.verifyCapgo({
      manifestPath: path.join(P.capgoDist(), CFG.version + '-manifest.json'),
      zipPath: path.join(P.capgoDist(), CFG.version + '.zip'),
      filesDir: path.join(P.capgoDist(), 'files'),
      filesZipPath: path.join(P.capgoDist(), 'capgo-files-' + CFG.version + '.zip'),
      baseUrl: PUBLIC_BASE + '/capgo',
      version: CFG.version
    });
    if (!c.ok) { c.problems.forEach(p => console.error('  capgo 制品问题·' + p)); die('capgo 制品复验不过'); }
    log('  capgo ✓ ' + JSON.stringify(c.stats));
  } else {
    const zipBytes = fs.statSync(path.join(P.capgoDist(), CFG.version + '.zip')).size;
    latestJson = { version: CFG.version, url: PUBLIC_BASE + '/capgo/bundles/' + CFG.version + '.zip', size: zipBytes };
  }
  return { latestJson };
}

// ── ⑧½ 发版预检对账（2026-07-07·「打进去的就是想发的」）──────────────────────
//   a) 与上一版 manifest 的变更摘要（增/改/删·按顶层目录分桶·owner 发前一眼确认·
//      堵「改了 30 个文件只打进 3 个」1.3.3.4 假更新事故类）
//   b) 双端同树闸：hot 与 capgo manifest 共有路径的 sha 必须全等·
//      不等 = 两端不是同一棵树打的（构建间隙改过文件）→ die
//   c) 零变更警告（大概率打错树/改动没落盘）
//   报告落 staging 并随 release 上传存档（RELEASE-REPORT-<V>.txt）
function computePreflight() {
  const out = { prevVersion: null, added: [], changed: [], removed: [], buckets: {},
    parityMismatches: [], parityCommon: 0, hotOnly: 0, capgoOnly: 0, capgoChecked: false };
  const newMan = readJson(path.join(P.releaseHot(), 'manifests', CFG.version + '.json'));
  const newBySha = new Map(newMan.files.map(f => [f.path, String(f.sha256 || '').toLowerCase()]));
  // a) 上一版 = 本地 manifests/ 里低于本版的最高版
  const manDir = path.join(P.releaseHot(), 'manifests');
  const prevs = (fs.existsSync(manDir) ? fs.readdirSync(manDir) : [])
    .map(n => n.replace(/\.json$/, ''))
    .filter(v => /^\d+\.\d+\.\d+\.\d+$/.test(v) && cmpVersions(v, CFG.version) < 0)
    .sort(cmpVersions);
  if (prevs.length) {
    out.prevVersion = prevs[prevs.length - 1];
    const prevMan = readJson(path.join(manDir, out.prevVersion + '.json'));
    const prevBySha = new Map(prevMan.files.map(f => [f.path, String(f.sha256 || '').toLowerCase()]));
    for (const [p, sha] of newBySha) {
      if (!prevBySha.has(p)) out.added.push(p);
      else if (prevBySha.get(p) !== sha) out.changed.push(p);
    }
    for (const p of prevBySha.keys()) if (!newBySha.has(p)) out.removed.push(p);
    out.changed.concat(out.added).forEach(p => {
      const top = p.indexOf('/') >= 0 ? p.split('/')[0] : '(根)';
      out.buckets[top] = (out.buckets[top] || 0) + 1;
    });
  }
  // b) 双端同树闸
  const capPath = path.join(P.capgoDist(), CFG.version + '-manifest.json');
  if (fs.existsSync(capPath)) {
    out.capgoChecked = true;
    const cap = readJson(capPath);
    const capBySha = new Map((cap.manifest || []).map(m => [m.file_name, String(m.file_hash || '').toLowerCase()]));
    for (const [p, sha] of newBySha) {
      if (capBySha.has(p)) {
        out.parityCommon++;
        if (capBySha.get(p) !== sha) out.parityMismatches.push(p);
      } else out.hotOnly++;
    }
    out.capgoOnly = Math.max(0, capBySha.size - out.parityCommon);
  }
  return out;
}

function preflightReport() {
  const pf = computePreflight();
  const L = [];
  L.push('═══ 发版预检对账·v' + CFG.version + '（自动生成·「打进去的就是想发的」）═══');
  if (pf.prevVersion) {
    L.push('对比基线：上一版 ' + pf.prevVersion + '·变更：改 ' + pf.changed.length + ' · 增 ' + pf.added.length + ' · 删 ' + pf.removed.length);
    const buckets = Object.entries(pf.buckets).sort((a, b) => b[1] - a[1]);
    if (buckets.length) L.push('分布：' + buckets.map(([k, v]) => k + '×' + v).join(' · '));
    const addedSet = new Set(pf.added);
    const listed = pf.changed.concat(pf.added).slice(0, 40);
    listed.forEach(p => L.push('  ' + (addedSet.has(p) ? '+ ' : '~ ') + p));
    const more = pf.changed.length + pf.added.length - listed.length;
    if (more > 0) L.push('  …另 ' + more + ' 个');
    pf.removed.slice(0, 10).forEach(p => L.push('  - ' + p));
    if (pf.changed.length + pf.added.length + pf.removed.length === 0) {
      L.push('⚠⚠ 本版与上一版内容零差异——大概率打错树/改动没落盘·请确认后再发！');
    }
  } else {
    L.push('（本地无上一版 manifest·跳过变更摘要）');
  }
  if (pf.capgoChecked) {
    L.push(pf.parityMismatches.length === 0
      ? ('双端同树闸：共有 ' + pf.parityCommon + ' 文件 sha 全等 ✓（hot 独有 ' + pf.hotOnly + '·capgo 独有 ' + pf.capgoOnly + '=打包器排除口径差·正常）')
      : ('双端同树闸：✗ ' + pf.parityMismatches.length + '/' + pf.parityCommon + ' 个共有文件 sha 不等'));
  } else {
    L.push('（capgo manifest 缺·跳过双端同树闸）');
  }
  const text = L.join('\n') + '\n';
  log(text);
  if (pf.parityMismatches.length) {
    pf.parityMismatches.slice(0, 20).forEach(p => console.error('  ✗ 双端 sha 不等·' + p));
    die('双端同树闸失败·hot 与 capgo 不是同一棵树打的（构建间隙改过 web/ ？）·重跑 release.js 让两端重建');
  }
  return text;
}

// ── ⑨ 安装包就位（可选）─────────────────────────────────────────────────────
//   2026-07-07·不再把 ~950MB exe 拷进 staging——ASCII 别名在安装包目录原地建
//   同卷硬链接（零磁盘占用）·上传直接从 E:\版本\测试版<V> 出
function stageInstaller(stagingDir) {
  if (!CFG.withInstaller) return [];
  const dir = P.installerDir();
  if (!fs.existsSync(path.join(dir, 'latest.yml'))) {
    die('--with-installer 但 ' + dir + ' 没有 latest.yml。先跑 npm run build:win（electron-builder 会产 yml+exe+blockmap）。');
  }
  const yml = fs.readFileSync(path.join(dir, 'latest.yml'), 'utf-8');
  const ypath = (yml.match(/^path:\s*(.+)$/m) || [])[1];
  const ysha = (yml.match(/^sha512:\s*(.+)$/m) || [])[1];
  if (!ypath || !ysha) die('latest.yml 缺 path/sha512');
  const exe = path.join(dir, ypath.trim());
  if (!fs.existsSync(exe)) die('latest.yml path 指向的安装包不存在·' + exe);
  const actual = crypto.createHash('sha512').update(fs.readFileSync(exe)).digest('base64');
  if (actual !== ysha.trim()) die('安装包 sha512 与 latest.yml 不符（构建后被改动？）');
  let signature;
  try {
    const publisher = windowsSigning.requirePublisher(process.env);
    signature = windowsSigning.verifyAuthenticode(exe, publisher);
  } catch (error) {
    die('安装包 Authenticode 发布者/时间戳闸失败·' + (error && error.message || error));
  }
  const alias = 'tianming-setup-' + CFG.version + '-x64.exe';   // gh 资产 ASCII 别名·deploy.py 按 yml path 还原中文名
  fs.copyFileSync(path.join(dir, 'latest.yml'), path.join(stagingDir, 'latest.yml'));
  const out = [
    { name: 'latest.yml', path: path.join(stagingDir, 'latest.yml') },
    { name: alias, path: ensureAlias(exe, path.join(dir, alias)) }
  ];
  const bm = exe + '.blockmap';
  if (fs.existsSync(bm)) out.push({ name: alias + '.blockmap', path: ensureAlias(bm, path.join(dir, alias + '.blockmap')) });
  log('⑨ 安装包就位·' + ypath.trim() + ' → ' + alias + '（sha512 ✓·Authenticode ' + signature.subject + ' ✓·时间戳 ✓·同卷别名零拷贝）');
  return out;
}

// ASCII 别名·同卷硬链接（零磁盘）·不支持硬链接的卷退化为拷贝
function ensureAlias(src, aliasPath) {
  if (fs.existsSync(aliasPath)) fs.rmSync(aliasPath, { force: true });
  try { fs.linkSync(src, aliasPath); }
  catch (e) { log('  （硬链接失败·退化为拷贝·' + ((e && e.code) || e) + '）'); fs.copyFileSync(src, aliasPath); }
  return aliasPath;
}

// ── ⑩ staging 汇总 + deploy.py 按版补丁 + runbook ────────────────────────────
//   2026-07-07·staging 只收小合成件（feed/deploy.py/runbook·<5MB）·
//   三个大 zip 的 basename 即资产名·从构建位直传不再复制——
//   1.3.4.6 双盘满 ENOSPC 的手工绕法转正·staging 从 ~3.4GB 复制降到忽略不计
function stageRelease(latestJson, preflightText) {
  const dir = P.staging();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const entries = [];
  function putSmall(src, name) { fs.copyFileSync(src, path.join(dir, name)); entries.push({ name, path: path.join(dir, name) }); }
  function putText(name, text) { fs.writeFileSync(path.join(dir, name), text, 'utf-8'); entries.push({ name, path: path.join(dir, name) }); }
  function refBig(src) {
    if (!fs.existsSync(src)) die('大制品缺失·' + src);
    entries.push({ name: path.basename(src), path: src });
  }
  refBig(path.join(P.releaseHot(), 'tianming-hot-' + CFG.version + '.zip'));
  putSmall(path.join(P.releaseHot(), 'hot-latest.json'), 'hot-latest.json');
  putSmall(P.changelog(), 'changelog.json');
  refBig(path.join(P.capgoDist(), CFG.version + '.zip'));
  putText('latest.json', JSON.stringify(latestJson, null, 2));
  const pack = path.join(P.capgoDist(), 'capgo-files-' + CFG.version + '.zip');
  if (fs.existsSync(pack)) refBig(pack);
  // deploy.py·补 DEFAULT_TAG → owner 一行命令零参数
  const dp = fs.readFileSync(P.deployPy(), 'utf-8');
  if (!/DEFAULT_TAG = ""/.test(dp)) die('deploy.py 缺 DEFAULT_TAG 锚点');
  putText('deploy.py', dp.replace('DEFAULT_TAG = ""', 'DEFAULT_TAG = "ship-' + CFG.version + '"'));
  const installerEntries = stageInstaller(dir);
  if (preflightText) putText('RELEASE-REPORT-' + CFG.version + '.txt', preflightText);
  // runbook
  const runbook = buildRunbookText(installerEntries.length > 0);
  putText('OWNER-RUNBOOK-' + CFG.version + '.txt', runbook);
  const all = entries.concat(installerEntries);
  const bigCount = all.filter(e => !e.path.startsWith(dir + path.sep)).length;
  log('⑩ staging 完成·' + dir + '·' + all.length + ' 个资产（其中 ' + bigCount + ' 个大件从构建位直传·零复制）');
  return { dir, entries: all };
}

function buildRunbookText(hasInstaller) {
  const L = [];
  L.push('═══ 天命 v' + CFG.version + ' 发版 runbook（自动生成）═══', '');
  L.push('1) 服务器发布（双端热更+邸报' + (hasInstaller ? '+本体通道' : '') + '）：');
  L.push('   · 已装自动部署 → 无需任何操作·≤5 分钟自动上线（状态：python3 /usr/local/bin/tianming-autodeploy.py --status）');
  L.push('   · 未装（一次性安装·此后永久免手动·1Panel 终端）：');
  L.push('     curl -sL https://github.com/misfit-user/tianming/releases/download/autodeploy/server-autodeploy.py -o /usr/local/bin/tianming-autodeploy.py && python3 /usr/local/bin/tianming-autodeploy.py --install');
  L.push('   · 手动兜底（自动部署故障时）：');
  L.push('     curl -sL https://github.com/misfit-user/tianming/releases/download/ship-' + CFG.version + '/deploy.py -o /tmp/d.py && python3 /tmp/d.py');
  L.push('   · capgo 默认发「全量兜底」（latest.json 不带 manifest·与现状一致·绝对安全）');
  L.push('');
  L.push('2) 安卓差量灰度（自愿·建议在自己设备全量更新验证本版正常后再开）：');
  L.push('   python3 /tmp/d.py --only capgo --enable-manifest     ← latest.json 开始携带差量清单');
  L.push('   试验设备（还停在旧版的）启动 → 观察 OTA 卡片 + adb logcat | grep -iE "capgo|Updater"');
  L.push('   出任何问题一键回退： python3 /tmp/d.py --only capgo --disable-manifest');
  L.push('   ※ 首次差量≈全量体积（逐文件下·但断点可续）·从下一版起才是真·几 MB 差量');
  L.push('');
  L.push('3) 验证：');
  L.push('   curl -s ' + PUBLIC_BASE + '/hot/hot-latest.json | head -3');
  L.push('   curl -s ' + PUBLIC_BASE + '/capgo/latest.json | head -3');
  L.push('   桌面端打开游戏 → 启动 8s 内应弹「发现新版本」更新卡');
  L.push('');
  L.push('4) GitHub Pages 在线版：publish 已经 workflow_dispatch 从 main 自触发 pages-production（github-pages 环境只放行 main·不放行 ship-* tag）；如未触发/失败，手动补：gh workflow run pages.yml --ref main');
  return L.join('\n') + '\n';
}

// ── ⑪ gh release 上传 + 资产审计 ─────────────────────────────────────────────
function remoteTagCommit(tag) {
  const result = gitRun(['ls-remote', '--tags', 'origin', 'refs/tags/' + tag, 'refs/tags/' + tag + '^{}']);
  if (result.status !== 0) die('读取远端 tag 失败·' + String(result.stderr || result.stdout || '').trim());
  const rows = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).map(line => line.split(/\s+/));
  const peeled = rows.find(row => row[1] === 'refs/tags/' + tag + '^{}');
  const direct = rows.find(row => row[1] === 'refs/tags/' + tag);
  return (peeled || direct || [])[0] || '';
}

function uploadRelease(staging) {
  if (CFG.noUpload) {
    log('⑪ --no-upload·跳过 GitHub 上传·直传清单（小件在 staging·大件在构建位）：');
    staging.entries.forEach(e => log('    ' + e.name + ' ← ' + e.path));
    return;
  }
  const tag = 'ship-' + CFG.version;
  if (!CFG.publishHead) die('publish HEAD 未锁定·拒绝外写');
  const existingTagCommit = remoteTagCommit(tag);
  if (existingTagCommit && existingTagCommit !== CFG.publishHead) {
    die('远端 tag ' + tag + ' 指向 ' + existingTagCommit.slice(0, 12) + '，不是已锁定 main ' + CFG.publishHead.slice(0, 12));
  }
  let r = spawnSync('gh', ['release', 'view', tag, '--repo', 'misfit-user/tianming'], { encoding: 'utf-8' });
  if (r.status !== 0) {
    log('⑪ 创建 release ' + tag + ' ...');
    r = spawnSync('gh', ['release', 'create', tag, '--repo', 'misfit-user/tianming',
      '--target', CFG.publishHead, '--title', '天命 ' + CFG.version, '--notes', CFG.notes || ('天命 ' + CFG.version)], { encoding: 'utf-8' });
    if (r.status !== 0) die('gh release create 失败·' + (r.stderr || r.stdout));
  }
  const tagCommit = remoteTagCommit(tag);
  if (tagCommit !== CFG.publishHead) die('release tag 提交复验失败·期望 ' + CFG.publishHead + '·实得 ' + (tagCommit || 'missing'));
  log('  tag 真值 ✓ ' + tag + ' → locked main ' + CFG.publishHead.slice(0, 12));
  for (const e of staging.entries) {
    log('  上传 ' + e.name + ' ...');
    r = spawnSync('gh', ['release', 'upload', tag, e.path, '--clobber', '--repo', 'misfit-user/tianming'],
      { encoding: 'utf-8' });
    if (r.status !== 0) die('上传失败·' + e.name + '·' + (r.stderr || r.stdout) + '\n（网络断点可重跑·已传资产 --clobber 覆盖）');
  }
  // 上传审计·每个资产名+大小核对（老流程曾 warn-and-continue 漏传·这里漏一个就报死）
  r = spawnSync('gh', ['release', 'view', tag, '--repo', 'misfit-user/tianming', '--json', 'assets'], { encoding: 'utf-8' });
  if (r.status !== 0) die('gh release view --json assets 失败');
  const assets = JSON.parse(r.stdout).assets || [];
  const byName = new Map(assets.map(a => [a.name, a.size]));
  for (const e of staging.entries) {
    const localSize = fs.statSync(e.path).size;
    if (!byName.has(e.name)) die('审计失败·release 缺资产 ' + e.name);
    if (byName.get(e.name) !== localSize) die('审计失败·' + e.name + ' 大小不符·release=' + byName.get(e.name) + ' local=' + localSize);
  }
  log('⑪ 上传完成 + 审计通过·' + staging.entries.length + ' 个资产');
  // ⑪½ 在线版(GitHub Pages)自触发：github-pages 环境只放行 main·ship-* tag 被拒·
  //   故经 workflow_dispatch 从 main 部署(gh 以仓主身份触发→actor=owner)。非致命·失败不阻断发版。
  try {
    const pr = spawnSync('gh', ['workflow', 'run', 'pages.yml', '--repo', 'misfit-user/tianming', '--ref', 'main'], { encoding: 'utf-8' });
    if (pr.status === 0) log('⑪½ 在线版 Pages 部署已自触发（workflow_dispatch · ref=main）');
    else log('⑪½ WARN·在线版 Pages 自触发失败（不阻断热更发版）·可手动补：gh workflow run pages.yml --ref main\n      ' + String(pr.stderr || pr.stdout || '').trim().slice(0, 160));
  } catch (e) { log('⑪½ WARN·在线版 Pages 自触发异常（不阻断）·' + (e && e.message)); }
}

// ── ⑫ 自动部署指针（2026-07-07·发版零人工的 dev 半边）────────────────────────
//   固定 release `autodeploy` 上的 latest-ship.txt 是服务器 poller 的唯一信号源。
//   只在 ⑪ 上传+审计全部通过后才动它 → poller 永远看不到资产不全的半成品发版。
function updateAutodeployPointer() {
  if (CFG.noUpload) return;
  const tag = 'ship-' + CFG.version;
  let r = spawnSync('gh', ['release', 'view', 'autodeploy', '--repo', 'misfit-user/tianming'], { encoding: 'utf-8' });
  if (r.status !== 0) {
    r = spawnSync('gh', ['release', 'create', 'autodeploy', '--repo', 'misfit-user/tianming', '--prerelease',
      '--title', '自动部署通道（勿删）', '--notes',
      'latest-ship.txt = 最新已审计发版 tag（release.js 每版自动更新）\nserver-autodeploy.py = 服务器 poller（安装见文件头注释）'],
      { encoding: 'utf-8' });
    if (r.status !== 0) { log('⑫ ⚠ autodeploy release 创建失败·本版服务器需手动跑 runbook 第 1 步·' + (r.stderr || r.stdout)); return; }
  }
  // poller 本体随手同步（服务器装/升级都从这拿·内容不变时 clobber 无害）
  r = spawnSync('gh', ['release', 'upload', 'autodeploy', path.join(REAL_ROOT, 'scripts', 'server-autodeploy.py'),
    '--clobber', '--repo', 'misfit-user/tianming'], { encoding: 'utf-8' });
  if (r.status !== 0) log('⑫ ⚠ server-autodeploy.py 同步失败（不影响本版）·' + (r.stderr || r.stdout));
  const tmp = path.join(os.tmpdir(), 'latest-ship.txt');
  fs.writeFileSync(tmp, tag + '\n', 'utf-8');
  r = spawnSync('gh', ['release', 'upload', 'autodeploy', tmp, '--clobber', '--repo', 'misfit-user/tianming'], { encoding: 'utf-8' });
  if (r.status !== 0) { log('⑫ ⚠⚠ latest-ship.txt 指针更新失败·服务器不会自动部署本版·必须手动跑 runbook 第 1 步·' + (r.stderr || r.stdout)); return; }
  log('⑫ 自动部署指针 → ' + tag + '（服务器 poller ≤5 分钟自动发布·未装 poller 则按 runbook 手动）');
}

// ── self-test·fanOut 对合成副本自测 ──────────────────────────────────────────
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-release-selftest-'));
  fs.mkdirSync(path.join(tmp, 'mobile', 'android', 'app'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'web'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
    version: '1.3.3', build: { buildVersion: '1.3.3.5', directories: { output: 'E:\\版本\\测试版1.3.3.5' }, artifactName: '天命-1.3.3.5-${arch}.${ext}' }
  }, null, 2));
  fs.writeFileSync(path.join(tmp, 'package-lock.json'), JSON.stringify({
    name: 'tianming', version: '1.3.3', lockfileVersion: 3, packages: { '': { name: 'tianming', version: '1.3.3' } }
  }, null, 2));
  fs.writeFileSync(path.join(tmp, 'mobile', 'android', 'app', 'build.gradle'),
    'android {\n  defaultConfig {\n        versionCode 1335\n        versionName "1.3.3.5"\n  }\n}\n');
  fs.writeFileSync(path.join(tmp, 'mobile', 'release-version.json'), JSON.stringify({ version: '1.3.3.5', versionCode: 1335 }, null, 2));
  fs.writeFileSync(path.join(tmp, 'web', 'version.json'), JSON.stringify({ version: '1.3.3.5' }));
  fs.writeFileSync(path.join(tmp, 'web', 'index.html'),
    '<meta name="tm-version" content="1.3.3.5"><div class="f-ver">天 命　测试版 <span id="tm-foot-ver">1.3.3.5</span></div>');
  fs.writeFileSync(path.join(tmp, 'web', 'changelog.json'), JSON.stringify({ entries: [{ date: today(), module: '9.9.9.9·t', title: 't', items: [] }] }));
  CFG.root = tmp; CFG.version = '9.9.9.9'; CFG.versionCodeArg = '9999';
  let n = 0;
  const ok = (c, l) => { if (!c) die('selftest FAIL·' + l); n++; console.log('  ok·' + l); };
  ok(validateModeFacts({ prepare: true, publish: false, noUpload: false, offline: false }).length === 0, 'mode·prepare 单选合法');
  ok(validateModeFacts({ prepare: false, publish: true, noUpload: true, offline: true }).length === 0, 'mode·本地 publish offline 合法');
  ok(validateModeFacts({ prepare: false, publish: false, noUpload: false, offline: false }).length > 0, 'mode·缺阶段被拒');
  ok(validateModeFacts({ prepare: true, publish: true, noUpload: false, offline: false }).length > 0, 'mode·双阶段被拒');
  ok(validateModeFacts({ prepare: true, publish: false, noUpload: true, offline: false }).length > 0, 'mode·prepare 不可 no-upload');
  ok(validateModeFacts({ prepare: false, publish: true, noUpload: false, offline: true }).length > 0, 'mode·外发不可 offline');
  const cleanMain = { isGit: true, clean: true, branch: 'main', head: 'abc', originMain: 'abc', originMainAncestor: true, officialOrigin: true };
  ok(validatePublishRepositoryFacts(cleanMain, '').length === 0, 'publish repo·clean main 与 origin/main 同步');
  ok(validatePublishRepositoryFacts(Object.assign({}, cleanMain, { clean: false }), '').some(x => x.includes('不干净')), 'publish repo·dirty 被拒');
  ok(validatePublishRepositoryFacts(Object.assign({}, cleanMain, { branch: 'release/9' }), '').some(x => x.includes('只允许 main')), 'publish repo·非 main 被拒');
  ok(validatePublishRepositoryFacts(Object.assign({}, cleanMain, { head: 'local' }), '').some(x => x.includes('精确同步')), 'publish repo·ahead/behind 被拒');
  ok(validatePublishRepositoryFacts(Object.assign({}, cleanMain, { officialOrigin: false }), '').some(x => x.includes('misfit-user/tianming')), 'publish repo·错误 origin 被拒');
  ok(validatePublishRepositoryFacts(cleanMain, 'old').some(x => x.includes('HEAD 改变')), 'publish repo·构建期间换 HEAD 被拒');
  ok(validateGitHubOwnerFacts('misfit-user', 'misfit-user').length === 0, 'owner·仓主账号允许 production');
  ok(validateGitHubOwnerFacts('scaredpenguin627', 'misfit-user').some(x => x.includes('不是仓库 owner')), 'owner·Write 协作者不能 production');
  const cleanPrepare = Object.assign({}, cleanMain, { branch: 'release/9', head: 'def' });
  ok(validatePrepareRepositoryFacts(cleanPrepare).length === 0, 'prepare repo·clean 短命分支且基于 origin/main');
  ok(validatePrepareRepositoryFacts(Object.assign({}, cleanPrepare, { branch: 'main' })).some(x => x.includes('短命分支')), 'prepare repo·main 被拒');
  ok(validatePrepareRepositoryFacts(Object.assign({}, cleanPrepare, { originMainAncestor: false })).some(x => x.includes('不是最新')), 'prepare repo·陈旧分支被拒');
  const code = gatePrepareVersion();
  ok(code === 9999, 'versionCode 显式');
  gateChangelog();
  fanOutVersions(code);
  ok(preparedVersionProblems(code, false).length === 0, 'publish 读取已盖戳版本·不再 fanOut');
  ok(!fs.existsSync(P.hotBaseline()), 'fresh tree·prepare 前可无 canonical 基线');
  fs.mkdirSync(path.join(tmp, 'release-hot', 'manifests'), { recursive: true });
  const freshManifestPath = path.join(tmp, 'release-hot', 'manifests', '9.9.9.9.json');
  fs.writeFileSync(freshManifestPath, JSON.stringify({
    type: 'tianming-hot-update', version: '9.9.9.9', entry: 'index.html', generatedAt: 'first', files: [], remove: []
  }));
  refreshBaseline();
  ok(fs.existsSync(P.hotBaseline()) && readJson(P.hotBaseline()).version === '9.9.9.9', 'fresh tree·prepare 生成 canonical tracked 基线');
  ok(preparedVersionProblems(code, true).length === 0, 'fresh tree·publish 可读取同版 canonical 基线');
  fs.writeFileSync(freshManifestPath, JSON.stringify({
    type: 'tianming-hot-update', version: '9.9.9.9', entry: 'index.html', generatedAt: 'second', files: [], remove: []
  }));
  ok(verifyBuiltBaseline(true), 'fresh tree·publish 重建基线语义全等');
  const pkg = readJson(path.join(tmp, 'package.json'));
  ok(pkg.version === '9.9.909', 'pkg.version 三段 semver·映射自四段(9.9.9.9→9.9.909·每版递增·不再截断冻结)');
  const lock = readJson(path.join(tmp, 'package-lock.json'));
  ok(lock.version === pkg.version && lock.packages[''].version === pkg.version, 'package-lock 两处根版本与 package.json 同步');
  ok(pkg.build.buildVersion === '9.9.9.9', 'buildVersion 4 段');
  ok(pkg.build.directories.output.endsWith('测试版9.9.9.9'), 'output 目录');
  ok(pkg.build.artifactName === '天命-9.9.9.9-${arch}.${ext}', 'artifactName');
  ok(readJson(path.join(tmp, 'mobile', 'release-version.json')).versionCode === 9999, 'mobile canonical 版本盖戳');
  ok(syncGeneratedAndroidVersion(), '从 canonical 同步本机 ignored Gradle');
  const gradle = fs.readFileSync(path.join(tmp, 'mobile', 'android', 'app', 'build.gradle'), 'utf-8');
  ok(/versionCode 9999/.test(gradle) && /versionName "9\.9\.9\.9"/.test(gradle), 'gradle 两处');
  ok(readJson(path.join(tmp, 'web', 'version.json')).version === '9.9.9.9', 'version.json');
  const html = fs.readFileSync(path.join(tmp, 'web', 'index.html'), 'utf-8');
  ok(/content="9\.9\.9\.9"/.test(html) && />9\.9\.9\.9<\/span>/.test(html), 'index.html meta+footer');
  ok(fs.readdirSync(tmp).some(f => f.indexOf('package.json.bak-release-') === 0), '.bak 备份在');
  // 重跑同版本必被单调闸拒·buildVersion 已盖成目标值 → gateVersion 的 ≤ 判定必触发
  ok(cmpVersions('9.9.9.9', readJson(path.join(tmp, 'package.json')).build.buildVersion) === 0, '重跑同版本会被单调闸拒（buildVersion 已盖戳等值）');
  ok(JSON.stringify(comparableManifest({ generatedAt: 'a', version: '9.9.9.9', files: [] })) === JSON.stringify(comparableManifest({ generatedAt: 'b', version: '9.9.9.9', files: [] })), '基线语义复验只忽略 generatedAt');
  // ensureAlias·同卷零拷贝别名（2026-07-07 直传改造）
  const aSrc = path.join(tmp, 'alias-src.bin');
  fs.writeFileSync(aSrc, 'alias-payload');
  const aDst = ensureAlias(aSrc, path.join(tmp, 'alias-dst.bin'));
  ok(fs.readFileSync(aDst, 'utf-8') === 'alias-payload', 'ensureAlias 别名内容一致');
  const aDst2 = ensureAlias(aSrc, path.join(tmp, 'alias-dst.bin'));
  ok(fs.readFileSync(aDst2, 'utf-8') === 'alias-payload', 'ensureAlias 幂等重跑（已存在先清）');
  // computePreflight·变更摘要 + 双端同树闸（2026-07-07 预检对账）
  fs.mkdirSync(path.join(tmp, 'release-hot', 'manifests'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'mobile', 'capgo-dist'), { recursive: true });
  const man = files => JSON.stringify({ type: 'tianming-hot-update', files });
  fs.writeFileSync(path.join(tmp, 'release-hot', 'manifests', '9.9.9.8.json'),
    man([{ path: 'a.js', sha256: 'aa', size: 1 }, { path: 'b.js', sha256: 'bb', size: 1 }, { path: 'gone.js', sha256: 'gg', size: 1 }]));
  fs.writeFileSync(path.join(tmp, 'release-hot', 'manifests', '9.9.9.9.json'),
    man([{ path: 'a.js', sha256: 'a2', size: 1 }, { path: 'b.js', sha256: 'bb', size: 1 }, { path: 'c.js', sha256: 'cc', size: 1 }]));
  fs.writeFileSync(path.join(tmp, 'mobile', 'capgo-dist', '9.9.9.9-manifest.json'), JSON.stringify({
    version: '9.9.9.9',
    manifest: [{ file_name: 'a.js', file_hash: 'a2' }, { file_name: 'b.js', file_hash: 'bb' }, { file_name: 'c.js', file_hash: 'cc' }, { file_name: 'capgo-extra.js', file_hash: 'xx' }]
  }));
  const pf = computePreflight();
  ok(pf.prevVersion === '9.9.9.8', 'preflight·上一版定位 9.9.9.8');
  ok(pf.changed.length === 1 && pf.changed[0] === 'a.js', 'preflight·改动清单 a.js');
  ok(pf.added.length === 1 && pf.added[0] === 'c.js' && pf.removed.length === 1 && pf.removed[0] === 'gone.js', 'preflight·增删清单');
  ok(pf.parityCommon === 3 && pf.parityMismatches.length === 0 && pf.capgoOnly === 1, 'preflight·双端同树全等（capgo 独有不计罪）');
  fs.writeFileSync(path.join(tmp, 'mobile', 'capgo-dist', '9.9.9.9-manifest.json'), JSON.stringify({
    version: '9.9.9.9', manifest: [{ file_name: 'a.js', file_hash: 'DIFFERENT' }, { file_name: 'b.js', file_hash: 'bb' }, { file_name: 'c.js', file_hash: 'cc' }]
  }));
  const pf2 = computePreflight();
  ok(pf2.parityMismatches.length === 1 && pf2.parityMismatches[0] === 'a.js', 'preflight·两端不同树被逮住（sha 不等）');
  console.log('PASS assertions=' + n);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function prepareRelease() {
  gatePrepareRepository();
  gateReleaseContracts();
  const code = gatePrepareVersion();
  gateChangelog();
  await gateLive();
  if (CFG.dryRun) {
    log('（dry-run）prepare 将执行·④版本扇出(versionCode ' + code + ') → ⑤桌面热更构建 → ⑥基线刷新；不构建安卓、不上传');
    log('prepare dry-run 结束·未写 tracked 文件');
    return;
  }
  fanOutVersions(code);
  buildDesktop();
  refreshBaseline();
  gatePreparedVersion(true);
  verifyBuiltBaseline(true);
  log('');
  log('prepare 完成·请只提交 package.json、mobile/release-version.json、web/version.json、web/index.html、web/.hot-update-manifest.json，并经 PR 合入 main 后再 --publish');
}

async function publishRelease() {
  if (CFG.noUpload) log('⓪ --no-upload 本地构建模式·允许非 main/dirty；所有 GitHub/服务器写入硬关闭');
  else gatePublishRepository('构建前');
  gateReleaseContracts();
  gatePreparedVersion(true);
  gateChangelog();
  const live = await gateLive();
  if (CFG.dryRun) {
    log('（dry-run）publish 将执行·⑤桌面重建 → ⑥已提交基线复验 → ⑦安卓构建'
      + (CFG.noDelta ? '(全量)' : '(差量' + (live.capgoManifest ? '·有线上基线' : '·无基线全打') + ')')
      + ' → ⑧复验 → ⑨⑩staging' + (CFG.withInstaller ? '(含安装包)' : '') + ' → ⑪' + (CFG.noUpload ? '不上传' : '锁定 HEAD 后 gh 上传'));
    log('publish dry-run 结束·未写 tracked 文件、未外写');
    return;
  }
  buildDesktop();
  verifyBuiltBaseline(!CFG.noUpload);
  buildAndroid(live.capgoManifest);
  const { latestJson } = composeAndGate();
  const report = preflightReport();
  const staging = stageRelease(latestJson, report);
  if (!CFG.noUpload) {
    gatePublishRepository('上传前');
    gateGitHubOwner();
  }
  uploadRelease(staging);
  updateAutodeployPointer();
  log('');
  log(fs.readFileSync(path.join(staging.dir, 'OWNER-RUNBOOK-' + CFG.version + '.txt'), 'utf-8'));
}

(async function main() {
  if (flag('self-test')) return selfTest();
  gateMode();
  log('═══ 天命发版·' + (CFG.prepare ? 'PREPARE' : (CFG.noUpload ? 'LOCAL-PUBLISH' : 'PUBLISH')) + '·v' + CFG.version + (CFG.dryRun ? '·DRY-RUN' : '') + ' ═══');
  if (CFG.prepare) return prepareRelease();
  return publishRelease();
})().catch(e => { console.error('✗ 发版中断·', e && e.stack || e); process.exit(1); });
