// 一次性原子推送·1627 财政修复 + 帑廪 UI 央地分线 共 9 个文件
// 通过 gh api (api.github.com) 绕过 git clone 网络抖动
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const REPO = 'misfit-user/tianming';
const BRANCH = 'main';
const ROOT = path.resolve(__dirname, '..');

const FILES = [
  'scenarios/tianqi7-1627.js',
  'tm-fiscal-fixed-expense.js',
  'tm-guoku-panel.js',
  'changelog.json',
  'index.html',
  'tools/smoke-1627-fiscal.js',
  'tools/smoke-1627-runtime.js',
  'tools/debug-officetree.js',
  'tools/push-fiscal-fix.js'
];

const COMMIT_MSG = `1627 财政史实化 + 帑廪 UI 央地分线

修 1627 剧本三处财政偏离 + 加 fixed-expense override 拉俸禄/军饷到史实区间 + 帑廪 UI 央地分线显示

* scenarios/tianqi7-1627.js: fc.taxes 三项显式覆盖 DEFAULT(land_silver/caoliang/salt_iron·避一条鞭法重计)·junhu 改 flat 35 万·太仓银 85 万/粮 1300 万与备注对齐·加 salaryAnnualOverride/armyAnnualOverride 配史实总额
* tm-fiscal-fixed-expense.js: _calcSalary/_calcArmyPay 加 cfg.*Override 短路·避 officeTree 编制 606 + initialTroops 含全 11 势力 197 万兵导致俸禄 1 万军饷 3557 万的失真
* tm-guoku-panel.js: hero『年入』改『中央年入』+ 新增『全国官收(年)』· quickstats『月入』改『中央月入』+ sub 显地留· section badge 改『中央实入·下方三数为全国口径』
* changelog.json: 两条邸报
* index.html: tm-guoku-panel.js v=2026042823 / tm-fiscal-fixed-expense.js v=2026042822 / tianqi7-1627.js v=2026042821
* tools/smoke-1627-fiscal.js: 12 项静态 smoke 全过
* tools/smoke-1627-runtime.js: 22 项端到端 smoke 全过(俸 99 万/年·军 1184 万/年·岁出合计 1505 万/年 ∈ 史实 1500-2000)
* tools/debug-officetree.js: 1627 officeTree 诊断脚本

验证：smoke fiscal 12/12 + runtime 22/22 全过·三数民缴 175 > 应收 115 > 官收 91 ✓·岁入年 749 万(中央)/1098 万(全国官收) ✓
`;

function ghApi(args, opts = {}) {
  return execSync('gh api ' + args, { encoding: 'utf8', cwd: ROOT, ...opts }).trim();
}

function ghApiJson(args, body) {
  const tmp = path.join(os.tmpdir(), 'gh-api-' + Date.now() + Math.random().toString(36).slice(2,8) + '.json');
  fs.writeFileSync(tmp, JSON.stringify(body), 'utf8');
  try {
    return execSync(`gh api ${args} --input "${tmp}"`, { encoding: 'utf8', cwd: ROOT });
  } finally {
    try { fs.unlinkSync(tmp); } catch(_){}
  }
}

(async function main() {
  console.log('[push] step 1: 取 HEAD ref');
  const headRef = JSON.parse(ghApi(`repos/${REPO}/git/ref/heads/${BRANCH}`));
  const headSha = headRef.object.sha;
  console.log('  HEAD = ' + headSha);

  console.log('[push] step 2: 取 base commit + tree');
  const headCommit = JSON.parse(ghApi(`repos/${REPO}/git/commits/${headSha}`));
  const baseTreeSha = headCommit.tree.sha;
  console.log('  baseTree = ' + baseTreeSha);

  console.log('[push] step 3: 创建 ' + FILES.length + ' 个 blob');
  const blobs = [];
  for (const rel of FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.error('  ! 文件不存在: ' + rel);
      continue;
    }
    const content = fs.readFileSync(abs);
    const b64 = content.toString('base64');
    const blob = JSON.parse(ghApiJson(
      `-X POST repos/${REPO}/git/blobs`,
      { content: b64, encoding: 'base64' }
    ));
    blobs.push({ path: rel.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: blob.sha });
    console.log('  ✓ ' + rel + ' → ' + blob.sha.slice(0, 8) + '  (' + content.length + ' bytes)');
  }

  console.log('[push] step 4: 创建新 tree');
  const newTree = JSON.parse(ghApiJson(
    `-X POST repos/${REPO}/git/trees`,
    { base_tree: baseTreeSha, tree: blobs }
  ));
  console.log('  newTree = ' + newTree.sha);

  console.log('[push] step 5: 创建新 commit');
  const newCommit = JSON.parse(ghApiJson(
    `-X POST repos/${REPO}/git/commits`,
    {
      message: COMMIT_MSG,
      tree: newTree.sha,
      parents: [headSha],
      author: { name: 'misfit-user', email: 'slide@doane.edu', date: new Date().toISOString() },
      committer: { name: 'misfit-user', email: 'slide@doane.edu', date: new Date().toISOString() }
    }
  ));
  console.log('  newCommit = ' + newCommit.sha);

  console.log('[push] step 6: 更新 ref heads/' + BRANCH);
  const updated = JSON.parse(ghApiJson(
    `-X PATCH repos/${REPO}/git/refs/heads/${BRANCH}`,
    { sha: newCommit.sha }
  ));
  console.log('  ref → ' + updated.object.sha);

  console.log('\n=== 推送完成 ===');
  console.log('commit: https://github.com/' + REPO + '/commit/' + newCommit.sha);
})().catch(err => {
  console.error('[push] FAILED:', err.message);
  if (err.stdout) console.error('stdout:', err.stdout.toString());
  if (err.stderr) console.error('stderr:', err.stderr.toString());
  process.exit(1);
});
