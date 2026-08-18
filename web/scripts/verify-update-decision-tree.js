// ============================================================
//  verify-update-decision-tree.js — S5 本体更新决策树验证
//  ① feed.minAppVersion → check 返回 needsInstaller·install 前置拒绝
//  ② 无 minAppVersion / minAppVersion ≤ 本体 → 不拦
//  ③ 构建器 --min-app-version → hot-latest.json 带 minAppVersion
//  运行：node web/scripts/verify-update-decision-tree.js
// ============================================================
'use strict';

process.env.TIANMING_TEST_EXPORTS = '1';

const Module = require('module');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-verify-tree-'));

const electronStub = {
  app: {
    getPath: () => path.join(TMP, 'userData'),
    getVersion: () => '1.3.3.5',
    getAppPath: () => ROOT,
    isPackaged: false,
    whenReady: () => new Promise(() => {}),
    on: () => {}, once: () => {}, relaunch: () => {}, exit: () => {}, quit: () => {}
  },
  BrowserWindow: function () {},
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {}, shell: {}, Menu: {},
  protocol: { registerSchemesAsPrivileged: () => {}, handle: () => {} },
  net: { fetch: (url, init) => fetch(url, init) }
};
electronStub.BrowserWindow.getAllWindows = () => [];
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return electronStub;
  if (request === 'electron-updater') {
    return { autoUpdater: { on: () => {}, setFeedURL: () => {}, checkForUpdates: async () => null, downloadUpdate: async () => [], quitAndInstall: () => {} } };
  }
  return origLoad.apply(this, arguments);
};

const T = require(path.join(ROOT, 'main-impl.js')).__test;
const { createTestUpdateServer } = require(path.join(ROOT, 'web', 'scripts', 'test-update-server.js'));

let assertions = 0;
function assert(cond, label) {
  if (cond) { assertions++; console.log('  ok·' + label); }
  else { console.error('  FAIL·' + label); process.exit(1); }
}

(async function main() {
  const srvRoot = path.join(TMP, 'srv');
  fs.mkdirSync(srvRoot, { recursive: true });

  function writeFeed(extra) {
    fs.writeFileSync(path.join(srvRoot, 'hot-latest.json'), JSON.stringify(Object.assign({
      type: 'tianming-hot-update-feed',
      version: '9.9.9.9',
      packageUrl: 'no-such.zip',
      sha256: 'ab', size: 1, notes: 'n'
    }, extra || {})));
  }

  const srv = createTestUpdateServer({ root: srvRoot });
  await srv.listen(0);
  const FEED = 'http://127.0.0.1:' + srv.port + '/hot-latest.json';
  // 生产 renderer 已不能传 feed URL；合成服务器只能通过显式开发环境变量注入。
  process.env.TIANMING_DEV_HOT_UPDATE_FEED_URL = FEED;

  // ── A·minAppVersion 高于本体（1.3.3.5）→ readHotUpdateFeed 透出 + install 前置拒绝 ──
  writeFeed({ minAppVersion: '9.0.0.0' });
  const infoA = await T.readHotUpdateFeed({ feedUrl: 'https://attacker.invalid/hot-latest.json' });
  assert(infoA.minAppVersion === '9.0.0.0', 'A·feed.minAppVersion 透出');
  assert(srv.requests.some(function(row){ return row.path === '/hot-latest.json'; }), 'A·renderer feedUrl 被忽略·只访问主进程开发配置');
  const resA = await T.installHotUpdateFromFeed({ feedUrl: FEED });
  assert(resA.success === false && resA.needsInstaller === true, 'A·install 前置拒绝·needsInstaller=true');
  assert(/先更新本体/.test(resA.message), 'A·拒绝文案友好');

  // ── B·minAppVersion 等于本体 → 不拦（往下走到下载·包不存在 → 抛错而非 needsInstaller） ──
  writeFeed({ minAppVersion: '1.3.3.5' });
  let threwB = null;
  try { await T.installHotUpdateFromFeed({ feedUrl: FEED }); } catch (e) { threwB = e; }
  assert(threwB && !/先更新本体/.test(threwB.message || ''), 'B·minAppVersion=本体 → 过闸（死于下载 404 而非本体门）');

  // ── C·无 minAppVersion（旧 feed）→ 过闸 ──
  writeFeed({});
  let threwC = null;
  try { await T.installHotUpdateFromFeed({ feedUrl: FEED }); } catch (e) { threwC = e; }
  assert(threwC && !/先更新本体/.test(threwC.message || ''), 'C·旧 feed 无字段 → 行为不变');

  // ── D·版本不高 → blockedDowngrade 优先 ──
  writeFeed({ version: '1.0.0.0', minAppVersion: '9.0.0.0' });
  const resD = await T.installHotUpdateFromFeed({ feedUrl: FEED });
  assert(resD.blockedDowngrade === true && !resD.needsInstaller, 'D·降级拒绝先于本体门');

  await srv.close();

  // ── E·构建器 --min-app-version → feed 带字段（--files 快速路径） ──
  {
    const outDir = path.join(TMP, 'out');
    execFileSync('node', [
      path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js'),
      '--version', '9.9.9.9',
      '--files', 'changelog.json',
      '--allow-partial-DANGEROUS', // S7 GATE-0·部分包仅限调试·此处为验证 feed 字段
      '--min-app-version', '2.0.0.0',
      '--out', outDir,
      '--notes', 'decision-tree-verify',
      '--unsigned-test-only'
    ], { cwd: ROOT, stdio: 'pipe' });
    const feed = JSON.parse(fs.readFileSync(path.join(outDir, 'hot-latest.json'), 'utf-8'));
    assert(feed.minAppVersion === '2.0.0.0', 'E·构建器把 minAppVersion 写进 feed');
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifests', '9.9.9.9.json'), 'utf-8'));
    assert(manifest.minAppVersion === '2.0.0.0', 'E·manifest 同字段仍在（装前最后防线）');
  }

  console.log('PASS assertions=' + assertions);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
})().catch(e => {
  console.error('VERIFY FAILED·', e && e.stack || e);
  process.exit(1);
});
