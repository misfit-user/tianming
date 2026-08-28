#!/usr/bin/env node
// Static regression for the prepare/publish state machine and Pages production gates.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function main() {
  let assertions = 0;
  const ok = (value, label) => {
    assert.ok(value, label);
    assertions++;
    console.log('  ok·' + label);
  };
  const release = fs.readFileSync(path.join(ROOT, 'scripts', 'release.js'), 'utf8').replace(/\r\n/g, '\n');
  const pages = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8').replace(/\r\n/g, '\n');
  const contributing = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
  const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
  const prepareStart = release.indexOf('async function prepareRelease()');
  const publishStart = release.indexOf('async function publishRelease()');
  const mainStart = release.indexOf('(async function main()');
  ok(prepareStart >= 0 && publishStart > prepareStart && mainStart > publishStart, 'release.js 显式 prepare/publish 两阶段');
  const prepare = release.slice(prepareStart, publishStart);
  const publish = release.slice(publishStart, mainStart);
  ok(prepare.includes('gatePrepareRepository()') && prepare.includes('gatePrepareVersion()'), 'prepare 要求 clean 短命分支与新版本');
  ok(prepare.includes('fanOutVersions(code)') && prepare.includes('refreshBaseline()'), '只有 prepare 盖戳并刷新 tracked 基线');
  ok(!prepare.includes('uploadRelease(') && !prepare.includes('updateAutodeployPointer('), 'prepare 无任何发布外写');
  ok(publish.includes("gatePublishRepository('构建前')") && publish.includes("gatePublishRepository('上传前')"), 'publish 构建前/上传前双重仓库闸');
  ok(publish.includes('gatePreparedVersion(true)') && publish.includes('verifyBuiltBaseline(!CFG.noUpload)'), 'publish 只消费已盖戳版本并复验基线');
  ok(!publish.includes('fanOutVersions(') && !publish.includes('refreshBaseline('), 'publish 不修改 tracked 版本/基线');
  ok(publish.indexOf("gatePublishRepository('上传前')") < publish.indexOf('uploadRelease(staging)'), '最终仓库闸先于 GitHub 上传');
  ok(release.includes("if (CFG.noUpload) {\n    log('⑪ --no-upload") && release.includes('if (CFG.noUpload) return;'), '--no-upload 硬关闭 release 与 autodeploy 外写');
  ok(release.includes("'--target', CFG.publishHead") && release.includes('remoteTagCommit(tag)'), 'release tag 锁定已验证 main HEAD');
  ok(release.includes("facts.branch !== 'main'") && release.includes('facts.head !== facts.originMain') && release.includes('!facts.clean'), 'publish 拒绝 dirty/非 main/未同步');
  ok(release.includes('officialOrigin') && release.includes('misfit-user/tianming'), 'prepare/publish 只信官方 origin');
  ok(release.includes('sync-hot-baseline.js') && release.includes("'--write', '--version'"), 'prepare 基线写入复用 production manifest collector');
  ok(release.includes('gateGitHubOwner()') && release.includes('validateGitHubOwnerFacts'), '正式外写前验证 gh 当前账号为仓库 owner');
  ok(release.includes("facts.branch === 'main'") && release.includes('!facts.originMainAncestor'), 'prepare 拒绝 main 与陈旧分支');
  ok(release.includes("--offline 仅可与 --publish --no-upload 合用"), 'offline 不能绕过正式发布线上闸');
  const fanOutStart = release.indexOf('function planVersionFanOut(');
  const fanOutEnd = release.indexOf('function syncGeneratedAndroidVersion(', fanOutStart);
  const fanOut = release.slice(fanOutStart, fanOutEnd);
  ok(fanOutStart >= 0
    && fanOut.includes('function validateVersionFanOutPlan(')
    && fanOut.includes('function applyVersionFanOutPlanAtomically('),
  '版本扇出采用只读规划、全量验证和原子应用三阶段');
  ok(fanOut.indexOf('validateVersionFanOutPlan(plan)') < fanOut.indexOf("edit.path + '.bak-release-'")
    && fanOut.includes("fs.fsyncSync(fd)")
    && fanOut.includes("fs.renameSync(tmp, file)"),
  '版本文件与备份均经同目录 fsync+rename 原子提交');
  ok(fanOut.includes("plan.edits.slice().reverse()")
    && fanOut.includes("_writeReleaseFileAtomic(edit.path, edit.original)")
    && !fanOut.includes('die('),
  '版本扇出深层失败抛错并逆序恢复原字节，不以 process.exit 绕过回滚');

  // 在线版只经 workflow_dispatch 从 main 部署（github-pages 环境不放行 ship-* tag）·安全=actor==owner + ref 在 origin/main
  ok(!pages.includes('release:\n    types: [published]') && !pages.includes("github.event.release"), 'Pages 无 release/tag 触发（改 workflow_dispatch/main）');
  ok(release.includes("'workflow', 'run', 'pages.yml'") && release.includes("'--ref', 'main'"), 'publish 以仓主身份自触发 Pages（workflow_dispatch·ref=main）');
  const requiredPagesFragments = [
    'workflow_dispatch:',
    'fetch-depth: 0',
    'npm ci --ignore-scripts',
    'github.actor == github.repository_owner',
    'git merge-base --is-ancestor HEAD origin/main',
    'node web/scripts/sync-official-scenarios.js',
    'git diff --exit-code',
    'node web/scripts/verify-official-scenario-parity.js',
    'node scripts/verify-release-contract.js',
    'node web/scripts/verify-hot-builder-gates.js',
    'node scripts/lint-arch-all.js',
    'node scripts/ci-smokes.js',
    'node scripts/stage-web-release.js',
    'node scripts/verify-pages-artifact.js',
    'actions/deploy-pages@v4'
  ];
  for (const fragment of requiredPagesFragments) ok(pages.includes(fragment), 'Pages 门禁·' + fragment.split('\n').pop());
  const gateOrder = [
    'sync-official-scenarios.js',
    'git diff --exit-code',
    'verify-official-scenario-parity.js',
    'verify-release-contract.js',
    'verify-hot-builder-gates.js',
    'lint-arch-all.js',
    'ci-smokes.js',
    'stage-web-release.js',
    'verify-pages-artifact.js',
    'actions/deploy-pages@v4'
  ].map(fragment => pages.indexOf(fragment));
  ok(gateOrder.every((value, index) => value >= 0 && (index === 0 || value > gateOrder[index - 1])), 'Pages 完整门禁严格先于部署');
  ok(pages.includes("ref: ${{ inputs.ref }}"), 'deploy 只 checkout dispatch 指定的 ref（默认 main）');
  ok(contributing.includes('--prepare') && contributing.includes('--publish'), 'CONTRIBUTING 记录两阶段发版');
  ok(claude.includes('--prepare') && claude.includes('--publish'), 'CLAUDE 协作约定记录两阶段发版');
  console.log('PASS assertions=' + assertions);
  return assertions;
}

if (require.main === module) {
  try { main(); }
  catch (err) { console.error('FAIL ' + (err && err.stack || err)); process.exit(1); }
}

module.exports = { main };
