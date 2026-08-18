// ============================================================
//  verify-hotupdate-selfheal.js — S2 自愈+卫生验证
//  覆盖：状态原子写 / 损坏修复(promote previous·清空·留尸) / stale 清理 /
//  崩溃环计数与自禁(含 disableSelfHeal 旗标) / 目录清理 / 安装包代码边界
//  运行：node web/scripts/verify-hotupdate-selfheal.js
// ============================================================
'use strict';

process.env.TIANMING_TEST_EXPORTS = '1';

const Module = require('module');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-verify-heal-'));
const USER_DATA = path.join(TMP, 'userData');

const electronStub = {
  app: {
    getPath: () => USER_DATA,
    getVersion: () => '1.3.3.5',
    getAppPath: () => ROOT,
    isPackaged: true, // 自愈逻辑仅 packaged 生效·测试按 packaged 跑
    whenReady: () => new Promise(() => {}),
    on: () => {}, once: () => {}, relaunch: () => {}, exit: () => {}, quit: () => {}
  },
  BrowserWindow: function () { throw new Error('no window in test'); },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {}, shell: {}, Menu: { setApplicationMenu: () => {} },
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

const impl = require(path.join(ROOT, 'main-impl.js'));
const T = impl.__test;
const P = T.paths;

let assertions = 0;
function assert(cond, label) {
  if (cond) { assertions++; console.log('  ok·' + label); }
  else { console.error('  FAIL·' + label); process.exit(1); }
}
function resetState() {
  try { fs.rmSync(P.HOT_UPDATE_DIR, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(P.HOT_UPDATE_VERSIONS_DIR, { recursive: true });
}
function mkVersionDir(ver) {
  const d = path.join(P.HOT_UPDATE_VERSIONS_DIR, ver);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), '<html>v' + ver + '</html>');
  return d;
}
function readState() { return JSON.parse(fs.readFileSync(P.HOT_UPDATE_STATE_FILE, 'utf-8')); }

(async function main() {
  // ── A·原子写·无 .tmp 残留 ──
  resetState();
  T.writeHotUpdateState({ enabled: true, currentVersion: '9.9.9.9' });
  assert(fs.existsSync(P.HOT_UPDATE_STATE_FILE), 'A·状态文件已写');
  const tmpLeft = fs.readdirSync(P.HOT_UPDATE_DIR).filter(n => n.indexOf('.tmp-') !== -1);
  assert(tmpLeft.length === 0, 'A·原子写无 .tmp 残留');

  // ── B·状态文件损坏 → 留尸 + 写全新默认 ──
  resetState();
  fs.writeFileSync(P.HOT_UPDATE_STATE_FILE, '{broken json!!');
  let repairs = T.repairHotUpdateState();
  assert(repairs.indexOf('state-corrupt') !== -1, 'B·损坏被识别并修复');
  assert(fs.readdirSync(P.HOT_UPDATE_DIR).some(n => n.indexOf('.corrupt-') !== -1), 'B·尸体留档 .corrupt-*');
  assert(readState().enabled === true && readState().currentDir === '', 'B·重写为干净默认');

  // ── C·currentDir 失效 + previous 有效 → promote ──
  resetState();
  const prevDir = mkVersionDir('9.9.9.8');
  T.writeHotUpdateState({
    enabled: true,
    currentVersion: '9.9.9.9', currentDir: path.join(P.HOT_UPDATE_VERSIONS_DIR, '9.9.9.9'), // 不存在
    previousVersion: '9.9.9.8', previousDir: prevDir
  });
  repairs = T.repairHotUpdateState();
  assert(repairs.indexOf('current-invalid-promoted-previous') !== -1, 'C·promote previous');
  let st = readState();
  assert(st.currentVersion === '9.9.9.8' && path.resolve(st.currentDir) === path.resolve(prevDir), 'C·previous 升为 current');
  assert(st.lastRepair && st.lastRepair.reasons.length > 0 && st.lastRepair.fromVersion === '9.9.9.9', 'C·lastRepair 记录在案');

  // ── D·current/previous 双失效 → 清空回 bundled ──
  resetState();
  T.writeHotUpdateState({
    enabled: true,
    currentVersion: '9.9.9.9', currentDir: path.join(P.HOT_UPDATE_VERSIONS_DIR, '9.9.9.9'),
    previousVersion: '9.9.9.8', previousDir: path.join(P.HOT_UPDATE_VERSIONS_DIR, '9.9.9.8')
  });
  repairs = T.repairHotUpdateState();
  assert(repairs.indexOf('current-invalid-cleared') !== -1, 'D·双失效清空');
  st = readState();
  assert(st.currentDir === '' && st.previousDir === '', 'D·引用全清·回 bundled');

  // ── E·stale（热更版本 < 安装包 1.3.3.5）→ 清引用 ──
  resetState();
  const staleDir = mkVersionDir('1.2.8.9');
  T.writeHotUpdateState({ enabled: true, currentVersion: '1.2.8.9', currentDir: staleDir });
  repairs = T.repairHotUpdateState();
  assert(repairs.indexOf('stale-cleared') !== -1, 'E·stale 被清（1.2.8.9 < base 1.3.3.5）');
  assert(readState().currentDir === '', 'E·stale 引用清空');

  // ── F·健康状态不动 ──
  resetState();
  const okDir = mkVersionDir('9.9.9.9');
  T.writeHotUpdateState({ enabled: true, currentVersion: '9.9.9.9', currentDir: okDir, previousVersion: '', previousDir: '' });
  repairs = T.repairHotUpdateState();
  assert(repairs.length === 0, 'F·健康状态零修复');

  // ── G·崩溃环·计数 1 → 2 → 自禁 ──
  resetState();
  const gDir = mkVersionDir('9.9.9.9');
  T.writeHotUpdateState({ enabled: true, currentVersion: '9.9.9.9', currentDir: gDir });
  T._bootHealthCheckOnStartup();
  let marker = JSON.parse(fs.readFileSync(P.BOOT_ATTEMPT_FILE, 'utf-8'));
  assert(marker.version === '9.9.9.9' && marker.count === 1, 'G·首次启动计数 1');
  T._bootHealthCheckOnStartup();
  marker = JSON.parse(fs.readFileSync(P.BOOT_ATTEMPT_FILE, 'utf-8'));
  assert(marker.count === 2, 'G·二次启动计数 2');
  T._bootHealthCheckOnStartup();
  st = readState();
  assert(st.enabled === false, 'G·第三次启动（计数≥2）→ 自动停用热更');
  assert(st.lastRepair && st.lastRepair.reasons.indexOf('boot-crash-loop') !== -1, 'G·lastRepair = boot-crash-loop');
  assert(!fs.existsSync(P.BOOT_ATTEMPT_FILE), 'G·marker 已清');

  // ── H·disableSelfHeal 旗标 → 不自禁 ──
  resetState();
  const hDir = mkVersionDir('9.9.9.9');
  T.writeHotUpdateState({ enabled: true, currentVersion: '9.9.9.9', currentDir: hDir, lastFeedFlags: { disableSelfHeal: true } });
  T.writeJsonAtomic(P.BOOT_ATTEMPT_FILE, { version: '9.9.9.9', count: 5, firstAt: 'x' });
  T._bootHealthCheckOnStartup();
  assert(readState().enabled !== false, 'H·disableSelfHeal 在 → 不停用');

  // ── I·热更未激活 → marker 清掉 ──
  resetState();
  T.writeHotUpdateState({ enabled: false, currentVersion: '', currentDir: '' });
  T.writeJsonAtomic(P.BOOT_ATTEMPT_FILE, { version: 'x', count: 9 });
  T._bootHealthCheckOnStartup();
  assert(!fs.existsSync(P.BOOT_ATTEMPT_FILE), 'I·未激活时 marker 清除');

  // ── J·目录清理 ──
  resetState();
  const cur = mkVersionDir('9.9.9.9');
  const prev = mkVersionDir('9.9.9.8');
  mkVersionDir('1.0.0.0'); // 老版本·应删
  T.writeHotUpdateState({ enabled: true, currentVersion: '9.9.9.9', currentDir: cur, previousVersion: '9.9.9.8', previousDir: prev });
  const oldStaging = path.join(P.HOT_UPDATE_DIR, '__staging_old');
  const newStaging = path.join(P.HOT_UPDATE_DIR, '__staging_new');
  fs.mkdirSync(oldStaging); fs.mkdirSync(newStaging);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  fs.utimesSync(oldStaging, twoHoursAgo, twoHoursAgo);
  const dl = path.join(P.HOT_UPDATE_DIR, 'downloads');
  fs.mkdirSync(dl, { recursive: true });
  fs.writeFileSync(path.join(dl, 'a.zip'), 'zz');
  fs.writeFileSync(path.join(dl, 'b.part'), 'pp'); // 新鲜·留作续传
  fs.writeFileSync(path.join(dl, 'c.part'), 'pp');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(path.join(dl, 'c.part'), eightDaysAgo, eightDaysAgo);
  const res = T.cleanupHotUpdateArtifacts();
  assert(res.removedVersions === 1 && !fs.existsSync(path.join(P.HOT_UPDATE_VERSIONS_DIR, '1.0.0.0')), 'J·老版本目录被清·current/previous 保留');
  assert(fs.existsSync(cur) && fs.existsSync(prev), 'J·current+previous 健在');
  assert(!fs.existsSync(oldStaging) && fs.existsSync(newStaging), 'J·>1h staging 清·新 staging 留');
  assert(!fs.existsSync(path.join(dl, 'a.zip')), 'J·完整 zip 清');
  assert(fs.existsSync(path.join(dl, 'b.part')) && !fs.existsSync(path.join(dl, 'c.part')), 'J·新 .part 留·7 天 .part 清');

  // ── K·main/preload 固定在安装包信任边界 ──
  {
    const mainShim = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf-8');
    const preloadShim = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf-8');
    assert(mainShim.includes("require('./main-impl.js')") && !/_detectHotMain|_app_main\.js/.test(mainShim), 'K·main 只加载安装包内实现');
    assert(preloadShim.includes("require('./preload-impl.js')") && !/hot-preload|_app_preload\.js/.test(preloadShim), 'K·preload 只加载安装包内实现');
  }

  console.log('PASS assertions=' + assertions);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
})().catch(e => {
  console.error('VERIFY FAILED·', e && e.stack || e);
  process.exit(1);
});
