'use strict';
// CI 用全量 smoke 跑批：--no-retry 严格模式 + 缺资产白名单豁免。
// fresh checkout 没有 web/assets 大件（立绘/字体/音频不入 git·走 release 全量包），
// 依赖这些资产的 smoke 在 CI 上必红——登记在 arch-baselines/ci-smoke-allowlist.json，
// 其余任何 FAIL 都算真破坏。白名单新增须协作双方点头（见 CONTRIBUTING.md §八）。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..');
const ALLOW = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'arch-baselines/ci-smoke-allowlist.json'), 'utf8'))
    .map(n => n.replace(/\.js$/, ''))
);

try {
  execSync('node scripts/run-smokes.js --no-retry', { stdio: 'inherit', cwd: WEB });
} catch (e) {
  // 退出码交给下面按报告逐项裁定（白名单豁免后可能仍是绿）
}

const report = JSON.parse(fs.readFileSync(path.join(WEB, 'dev-tools/arch-guard/smoke-report.json'), 'utf8'));
const fails = (report.results || []).filter(r => !r.pass);
const waived = fails.filter(r => ALLOW.has(String(r.name).replace(/\.js$/, '')));
const real = fails.filter(r => !ALLOW.has(String(r.name).replace(/\.js$/, '')));

waived.forEach(r => console.log('[ci-smokes] 豁免(缺资产白名单):', r.name));
if (real.length) {
  console.error('[ci-smokes] FAIL — ' + real.length + ' 个非白名单失败：');
  real.forEach(r => console.error('   ' + r.name));
  process.exit(1);
}
console.log('[ci-smokes] PASS — 共 ' + (report.results || []).length + ' 个 · 白名单豁免 ' + waived.length + ' 个');
