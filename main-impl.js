/*
 * ============================================================
 *  天命 · AI历史模拟 — Electron 主进程
 *  这个文件控制桌面窗口、文件读写、菜单等功能
 * ============================================================
 */

// 引入 Electron 和 Node.js 的模块
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');

// ============================================================
//  基本配置
// ============================================================

// 存档保存位置（项目目录下）
// 2026-06-10·热更 main (_app_main.js) 下 __dirname = 热更版本目录·安装包资源须锚 app.getAppPath()
//   （app 模块 require 时即可用·函数声明提升使 bundledAppRoot 在此可调）
const APP_ROOT_DIR = (function () {
  try {
    const p = app.getAppPath && app.getAppPath();
    if (p && typeof p === 'string') return p;
  } catch (_) {}
  return __dirname;
})();
const USER_DATA_DIR = app.getPath('userData');
const BUNDLED_SCENARIOS_DIR = path.join(APP_ROOT_DIR, 'scenarios');
const OFFICIAL_SCENARIO_FILES = [
  '天启七年·九月（官方）.json',
  '绍宋·建炎元年八月（官方）.json'
];

// Writable runtime data must live under userData. Packaged builds may place
// __dirname inside app.asar, which is readable but not a directory for writes.
const SAVE_DIR      = path.join(USER_DATA_DIR, 'saves');
const SCENARIOS_DIR = path.join(USER_DATA_DIR, 'scenarios');
const TURN_DATA_DIR = path.join(USER_DATA_DIR, 'turn-data');
const CONFIG_FILE   = path.join(USER_DATA_DIR, 'app_config.json');
const UPDATE_DIR    = path.join(USER_DATA_DIR, 'updates');
const CONTENT_DIR   = path.join(USER_DATA_DIR, 'content');
const OFFICIAL_CONTENT_DIR = path.join(CONTENT_DIR, 'official');
const WORKSHOP_DIR  = path.join(CONTENT_DIR, 'workshop');
const WORKSHOP_PACKS_DIR = path.join(WORKSHOP_DIR, 'packs');
const WORKSHOP_INDEX_FILE = path.join(WORKSHOP_DIR, 'workshop-index.json');
const HOT_UPDATE_DIR = path.join(CONTENT_DIR, 'hot-updates');
const HOT_UPDATE_VERSIONS_DIR = path.join(HOT_UPDATE_DIR, 'versions');
const HOT_UPDATE_STATE_FILE = path.join(HOT_UPDATE_DIR, 'hot-update-state.json');
const ACCOUNT_SESSION_FILE = path.join(CONTENT_DIR, 'account-session.json');
const DEFAULT_HOT_UPDATE_FEED_URL = 'https://api.themisfitserspeople.top/tianming/hot/hot-latest.json';
const DEFAULT_WORKSHOP_CATALOG_URL = 'https://api.themisfitserspeople.top/tianming-api/workshop/catalog';
const DEFAULT_ONLINE_API_URL = 'https://api.themisfitserspeople.top/tianming-api/';

// ============================================================
//  调试日志 (debug logger)·2026-05-28
//  启动即在 userData/logs/ 落盘一个时间戳命名的 .log·
//  劫持主进程 console.* + 接收前端 console.* (IPC debug-log)·
//  崩溃/异常后打开日志目录即可按时间线快速定位问题。
// ============================================================
const LOG_DIR = path.join(USER_DATA_DIR, 'logs');
const DEBUG_LOG_KEEP = 20;   // 仅保留最近 N 个日志文件
let _logStream = null;
let _logFilePath = '';

function _logPad2(n) { return n < 10 ? '0' + n : '' + n; }
function _logStamp(d) {
  return d.getFullYear() + '-' + _logPad2(d.getMonth() + 1) + '-' + _logPad2(d.getDate())
       + '_' + _logPad2(d.getHours()) + _logPad2(d.getMinutes()) + _logPad2(d.getSeconds());
}
function _logFmtArg(a) {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack || (a.name + ': ' + a.message);
  try { var s = JSON.stringify(a); return s == null ? String(a) : s; }
  catch (_) { return String(a); }
}
function appendDebugLog(level, source, message) {
  if (!_logStream) return;
  try {
    _logStream.write(new Date().toISOString() + ' [' + (source || 'main') + '] '
      + String(level || 'log').toUpperCase() + ' ' + String(message) + '\n');
  } catch (_) {}
}
function _cleanupOldLogs() {
  try {
    fs.readdirSync(LOG_DIR)
      .filter(function (f) { return /^tianming-.*\.log$/.test(f); })
      .map(function (f) { return { f: f, t: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }; })
      .sort(function (a, b) { return b.t - a.t; })
      .slice(DEBUG_LOG_KEEP)
      .forEach(function (e) { try { fs.rmSync(path.join(LOG_DIR, e.f), { force: true }); } catch (_) {} });
  } catch (_) {}
}
function initDebugLogger() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    _logFilePath = path.join(LOG_DIR, 'tianming-' + _logStamp(new Date()) + '.log');
    _logStream = fs.createWriteStream(_logFilePath, { flags: 'a' });
    _cleanupOldLogs();
    // 劫持主进程 console.*·原样输出 + 落盘
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (lvl) {
      var orig = console[lvl] ? console[lvl].bind(console) : function () {};
      console[lvl] = function () {
        var args = Array.prototype.slice.call(arguments);
        try { appendDebugLog(lvl, 'main', args.map(_logFmtArg).join(' ')); } catch (_) {}
        orig.apply(null, args);
      };
    });
    // 进程级未捕获异常·只记录不改变默认行为以外的语义（不退出，由 Electron 处理）
    process.on('uncaughtException', function (e) { appendDebugLog('error', 'main:uncaught', (e && e.stack) || String(e)); });
    process.on('unhandledRejection', function (r) { appendDebugLog('error', 'main:rejection', (r && r.stack) || String(r)); });
    appendDebugLog('info', 'main', '=== 天命启动·v' + app.getVersion() + '·' + process.platform + ' ===');
  } catch (_) { _logStream = null; }
}
initDebugLogger();

// 确保各目录存在
function isDirectorySafe(dir) {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch (e) {
    return false;
  }
}

function ensureWritableDir(dir) {
  if (fs.existsSync(dir)) {
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) return;
    fs.renameSync(dir, dir + '.file-backup-' + Date.now());
  }
  fs.mkdirSync(dir, { recursive: true });
}

function ensureSaveDir() {
  [SAVE_DIR, SCENARIOS_DIR, TURN_DATA_DIR, UPDATE_DIR, OFFICIAL_CONTENT_DIR, WORKSHOP_DIR, WORKSHOP_PACKS_DIR, HOT_UPDATE_DIR, HOT_UPDATE_VERSIONS_DIR].forEach(d => {
    ensureWritableDir(d);
  });
}

// 文件名清理（防止特殊字符导致问题）
function sanitize(name) {
  const s = String(name).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  // 2026-07-09·加固：纯点段（. .. …）会让 path.join(dir, name) 上跳目录·整体替占位
  return /^\.+$/.test(s) ? '_' : s;
}

// 回合号段消毒：只允许数字·防 '../' 路径穿越（saveName 已 sanitize·turn 之前漏网，见审核报告 P1）
function turnSeg(turn) {
  const s = String(turn).replace(/[^0-9]/g, '');
  if (!s) throw new Error('非法回合号: ' + turn);
  return s;
}

function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureWritableDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// 2026-06-10·原子写（tmp + rename·同目录 NTFS 原子）·热更状态文件写一半掉电不再损毁
function writeJsonAtomic(file, data) {
  ensureWritableDir(path.dirname(file));
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function scenarioFileName(filename) {
  return sanitize(String(filename || '').replace(/\.json$/i, '')) + '.json';
}

function countScenarioArray(data, keys) {
  return keys.reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0);
}

function countScenarioVariables(data) {
  if (Array.isArray(data.variables)) return data.variables.length;
  if (data.variables && typeof data.variables === 'object') {
    return Object.values(data.variables).reduce((sum, val) => sum + (Array.isArray(val) ? val.length : 0), 0);
  }
  return 0;
}

function scenarioListItem(filePath, fileName, source) {
  const stats = fs.statSync(filePath);
  let meta = { id: '', playable: true, counts: null, title: fileName.replace('.json', '') };
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const id = data && data.id ? String(data.id) : '';
    const counts = {
      characters: countScenarioArray(data, ['characters', 'chars']),
      factions: countScenarioArray(data, ['factions', 'facs']),
      parties: countScenarioArray(data, ['parties']),
      classes: countScenarioArray(data, ['classes']),
      variables: countScenarioVariables(data),
      events: countScenarioArray(data, ['events']),
      relations: countScenarioArray(data, ['relations'])
    };
    const playableScore = counts.characters + counts.factions + counts.parties + counts.classes + counts.variables + counts.events + counts.relations;
    meta = {
      id,
      playable: playableScore > 0,
      counts,
      title: data.name || data.title || fileName.replace('.json', '')
    };
  } catch (e) {
    meta = { id: '', playable: false, counts: null, title: fileName.replace('.json', ''), parseError: e.message };
  }
  return {
    name: fileName.replace('.json', ''),
    title: meta.title,
    id: meta.id,
    playable: meta.playable,
    counts: meta.counts,
    parseError: meta.parseError,
    size: stats.size,
    modified: stats.mtimeMs,
    modifiedStr: new Date(stats.mtimeMs).toLocaleString('zh-CN'),
    source,
    readonly: source === 'official'
  };
}

// 2026-05-22·返回 active hot update 中的 bundled-scenarios/ 目录·让 scenarios 改动也能热更
function getActiveBundledScenariosDir() {
  try {
    const active = getActiveHotUpdate();
    if (!active || !active.active || !active.root) return '';
    const hotBundled = path.join(active.root, 'bundled-scenarios');
    if (fs.existsSync(hotBundled)) return hotBundled;
  } catch (_) {}
  return '';
}

function resolveScenarioPath(filename) {
  const file = scenarioFileName(filename);
  const userPath = path.join(SCENARIOS_DIR, file);
  if (fs.existsSync(userPath)) return { path: userPath, file, source: 'user' };
  if (OFFICIAL_SCENARIO_FILES.includes(file)) {
    // 1. 优先 hot update 中的 bundled-scenarios·让 scenarios JSON 改动跟代码改动一起热更
    const hotBundledDir = getActiveBundledScenariosDir();
    if (hotBundledDir) {
      const hotPath = path.join(hotBundledDir, file);
      if (fs.existsSync(hotPath)) return { path: hotPath, file, source: 'hot-update' };
    }
    // 2. fallback·bundled with installer (.exe ship 时打包的)
    const officialPath = path.join(BUNDLED_SCENARIOS_DIR, file);
    if (fs.existsSync(officialPath)) return { path: officialPath, file, source: 'official' };
  }
  return { path: '', file, source: '' };
}

function isInsideDir(parent, target) {
  const rel = path.relative(path.resolve(parent), path.resolve(target));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeRmDir(target, root) {
  if (!isInsideDir(root, target)) throw new Error('Refuse to remove path outside managed directory');
  fs.rmSync(target, { recursive: true, force: true });
}

function compareVersions(a, b) {
  const aa = String(a || '0').split(/[.+-]/).map(n => parseInt(n, 10)).map(n => Number.isFinite(n) ? n : 0);
  const bb = String(b || '0').split(/[.+-]/).map(n => parseInt(n, 10)).map(n => Number.isFinite(n) ? n : 0);
  const n = Math.max(aa.length, bb.length, 4);
  for (let i = 0; i < n; i++) {
    const av = aa[i] || 0;
    const bv = bb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

// 2026-06-10·安装包根锚点·热更 main (_app_main.js) 下 __dirname = 热更版本目录·
//   安装包内资源（web/、preload.js shim、package.json、scenarios/）必须锚到 app.getAppPath()
//   （= 启动入口 main.js shim 所在的 asar/app 根·无论 main 实现从哪加载都不变）·
//   否则热更 main 一上线·zip 兜底基线 / preload shim / 版本读取 / stale 回退全部断链
function bundledAppRoot() {
  try {
    const p = app.getAppPath && app.getAppPath();
    if (p && typeof p === 'string') return p;
  } catch (_) {}
  return __dirname;
}

function getPackageBuildVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(bundledAppRoot(), 'package.json'), 'utf-8'));
    return (pkg.build && pkg.build.buildVersion) || pkg.version || app.getVersion();
  } catch (e) {
    return app.getVersion();
  }
}

function getDefaultUpdateFeedUrl() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(bundledAppRoot(), 'package.json'), 'utf-8'));
    const publish = pkg.build && pkg.build.publish;
    const first = Array.isArray(publish) ? publish[0] : publish;
    return (first && first.provider === 'generic' && first.url) ? String(first.url) : '';
  } catch (e) {
    return '';
  }
}

// 展示/热更门基线的权威版本 = 四段 buildVersion(玩家可见·index.html <meta tm-version> 亦四段)。
// 2026-07-04·不再 max(buildVersion, appVersion)：package.json `version` 现为独立递增的三段 semver
//   (仅供 electron-updater/NSIS/Windows 认版本·数值上可能高于 buildVersion·如 1.3.405 映射自显示 1.3.4.5)·
//   若再喂进 max 会把显示与热更门基线错误抬到那个 semver 上。buildVersion 是四段版本的唯一真相。
function getCurrentComparableVersion() {
  return getPackageBuildVersion();
}

// 整包(electron-updater)更新比较·必须 semver↔semver：latest.yml 的 version 与 app.getVersion()
//   同为 package.json `version`(三段 semver·electron-builder 打包时写入 latest.yml)。不能拿四段
//   buildVersion 去比(数字体系不同→compareVersions 误判)。★热更路径另有 isStrictRendererUpgrade
//   (按四段 buildVersion 比)·两条勿混。
function isStrictUpgrade(remoteVersion) {
  return compareVersions(remoteVersion, app.getVersion()) > 0;
}

function getHotUpdateState() {
  const state = readJsonSafe(HOT_UPDATE_STATE_FILE, {});
  return Object.assign({
    enabled: true,
    currentVersion: '',
    currentDir: '',
    previousVersion: '',
    previousDir: '',
    installedAt: ''
  }, state || {});
}

function writeHotUpdateState(state) {
  writeJsonAtomic(HOT_UPDATE_STATE_FILE, Object.assign(getHotUpdateState(), state || {}));
}

// dev override·从 env / app_config.json 取自定义 web 目录·避免 installer-packaged app 只能读自己 bundled web 的问题
function _isValidWebRoot(dir) {
  try {
    return !!dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()
           && fs.existsSync(path.join(dir, 'index.html'));
  } catch (_) { return false; }
}

function getWebRootOverride() {
  var env = String(process.env.TIANMING_WEB_OVERRIDE || '').trim();
  if (env) {
    if (_isValidWebRoot(env)) return { path: path.resolve(env), source: 'env' };
    try { console.warn('[web-root-override] TIANMING_WEB_OVERRIDE 路径无效·已忽略·' + env); } catch (_) {}
  }
  var cfg = readJsonSafe(CONFIG_FILE, {});
  var saved = String((cfg && cfg.webRootOverride) || '').trim();
  if (saved) {
    if (_isValidWebRoot(saved)) return { path: path.resolve(saved), source: 'config' };
    try { console.warn('[web-root-override] app_config.webRootOverride 路径无效·已忽略·' + saved); } catch (_) {}
  }
  return null;
}

function getBaseWebRoot() {
  var override = getWebRootOverride();
  if (override) {
    try { console.log('[web-root] dev override (' + override.source + ') = ' + override.path); } catch (_) {}
    return override.path;
  }
  // 2026-06-10·锚定安装包根·热更 main 下 __dirname/web 不存在（stale 回退曾因此白屏）
  return path.join(bundledAppRoot(), 'web');
}

function getActiveHotUpdate() {
  const state = getHotUpdateState();
  // dev / `npm start` (electron .): always run the local web/ source, never the hot-update cache, so
  // the launcher (启动天命.bat → npm start) always reflects the latest local code. Packaged builds keep
  // using hot-updates for players.
  if (!app.isPackaged) {
    return {
      active: false, state,
      version: String(state.currentVersion || '').trim(),
      root: state.currentDir ? path.resolve(state.currentDir) : '',
      reason: 'dev-local'
    };
  }
  const baseVersion = getCurrentComparableVersion();
  const hotRoot = state.currentDir ? path.resolve(state.currentDir) : '';
  const hotVersion = String(state.currentVersion || '').trim();
  const hasValidHotVersion = hotVersion && compareVersions(hotVersion, baseVersion) >= 0;
  if (
    state.enabled &&
    hasValidHotVersion &&
    hotRoot &&
    isInsideDir(HOT_UPDATE_VERSIONS_DIR, hotRoot) &&
    fs.existsSync(path.join(hotRoot, 'index.html'))
  ) {
    return { active: true, state, version: hotVersion, root: hotRoot, reason: '' };
  }
  let reason = '';
  if (state.enabled && hotVersion && compareVersions(hotVersion, baseVersion) < 0) {
    reason = 'stale-hot-update';
  }
  return { active: false, state, version: hotVersion, root: hotRoot, reason };
}

function getEffectiveRendererVersion() {
  const active = getActiveHotUpdate();
  if (active.active) return active.version;
  return getCurrentComparableVersion();
}

function isStrictRendererUpgrade(remoteVersion) {
  return compareVersions(remoteVersion, getEffectiveRendererVersion()) > 0;
}

function getActiveWebRoot() {
  const active = getActiveHotUpdate();
  return active.active ? active.root : getBaseWebRoot();
}

// 2026-05-23·preload 也可热更·从 active hot dir 找 _app_preload.js·main shim 通过 additionalArguments 传给 preload shim
//   active hot 判定与 getActiveHotUpdate 一致 (gate enabled + version > buildVersion)
//   返回·string·有 hot _app_preload.js 时 absolute path·没 hot 时 ''
function getHotPreloadCandidate() {
  try {
    const active = getActiveHotUpdate();
    if (!active.active || !active.root) return '';
    const candidate = path.join(active.root, '_app_preload.js');
    if (fs.existsSync(candidate)) return candidate;
  } catch (_) {}
  return '';
}

function getHotUpdatePublicStatus() {
  const active = getActiveHotUpdate();
  const state = active.state;
  const activeWebRoot = getActiveWebRoot();
  const activeHot = active.active;
  const versions = isDirectorySafe(HOT_UPDATE_VERSIONS_DIR)
    ? fs.readdirSync(HOT_UPDATE_VERSIONS_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => compareVersions(b, a))
    : [];
  return {
    enabled: state.enabled !== false,
    activeHot,
    appVersion: app.getVersion(),
    buildVersion: getPackageBuildVersion(),
    baseVersion: getCurrentComparableVersion(),
    rendererVersion: getEffectiveRendererVersion(),
    currentVersion: activeHot ? (state.currentVersion || '') : '',
    installedHotVersion: state.currentVersion || '',
    staleHotUpdate: active.reason === 'stale-hot-update',
    inactiveReason: active.reason || '',
    previousVersion: state.previousVersion || '',
    installedAt: state.installedAt || '',
    activeWebRoot,
    defaultFeedUrl: DEFAULT_HOT_UPDATE_FEED_URL,
    versions,
    // 2026-06-10·自愈可见性·renderer 一次性提示「已自动恢复」用；isPackaged 供前端判 dev 静默
    lastRepair: state.lastRepair || null,
    isPackaged: app.isPackaged
  };
}

function normalizePackId(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || ('pack-' + Date.now());
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(file);
  hash.update(buf);
  return hash.digest('hex');
}

// 2026-06-10·更新内核鲁棒性·流式哈希（大 zip 不再整读进内存）
function sha256FileStream(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytesMain(n) {
  n = Number(n) || 0;
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

// 磁盘空间预检·fs.promises.statfs (Node ≥18.15) 不在则静默跳过（旧热更 main 安全）
async function checkDiskSpace(dir, requiredBytes) {
  try {
    const statfs = fs.promises && fs.promises.statfs;
    if (typeof statfs !== 'function') return { ok: true, skipped: true };
    const s = await statfs(dir);
    const free = Number(s.bavail) * Number(s.bsize);
    if (!Number.isFinite(free) || free <= 0) return { ok: true, skipped: true };
    return { ok: free >= requiredBytes, free, required: requiredBytes };
  } catch (_) {
    return { ok: true, skipped: true };
  }
}

async function ensureDiskSpace(dir, requiredBytes, label) {
  const res = await checkDiskSpace(dir, requiredBytes);
  if (!res.ok) {
    const err = new Error('磁盘空间不足：' + (label || '更新') + '需要约 ' + formatBytesMain(res.required)
      + '，当前剩余 ' + formatBytesMain(res.free) + '。请清理磁盘后重试。');
    err._noRetry = true;
    throw err;
  }
  return res;
}

// 有界并发池·一个失败立即停止取新任务并抛第一个错（已在跑的任务自然结束）
async function runWorkerPool(items, limit, worker) {
  let next = 0;
  let aborted = false;
  let firstErr = null;
  async function lane() {
    while (!aborted) {
      const i = next++;
      if (i >= items.length) return;
      try {
        await worker(items[i], i);
      } catch (e) {
        aborted = true;
        if (!firstErr) firstErr = e;
      }
    }
  }
  const lanes = Math.max(1, Math.min(Number(limit) || 1, items.length));
  await Promise.all(Array.from({ length: lanes }, lane));
  if (firstErr) throw firstErr;
}

autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;

protocol.registerSchemesAsPrivileged([{
  scheme: 'tm-content',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

let lastUpdateInfo = null;

function sendUpdateStatus(kind, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', Object.assign({ kind }, payload || {}));
    }
  } catch (e) {}
}

function sendHotUpdateStatus(kind, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hot-update-status', Object.assign({ kind }, payload || {}));
    }
  } catch (e) {}
}

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-not-available', info => {
  lastUpdateInfo = null;
  sendUpdateStatus('not-available', { info, currentVersion: getCurrentComparableVersion() });
});
autoUpdater.on('update-available', info => {
  if (!info || !isStrictUpgrade(info.version)) {
    lastUpdateInfo = null;
    sendUpdateStatus('blocked-downgrade', {
      info,
      currentVersion: getCurrentComparableVersion(),
      message: '远端版本不高于当前版本，已拒绝下载。'
    });
    return;
  }
  lastUpdateInfo = info;
  sendUpdateStatus('available', { info, currentVersion: getCurrentComparableVersion() });
});
autoUpdater.on('download-progress', progress => sendUpdateStatus('download-progress', { progress }));
autoUpdater.on('update-downloaded', info => {
  lastUpdateInfo = info || lastUpdateInfo;
  sendUpdateStatus('downloaded', { info: lastUpdateInfo });
});
autoUpdater.on('error', error => sendUpdateStatus('error', { error: error ? error.message : 'unknown update error' }));

const BLOCKED_PACK_EXTS = new Set([
  '.js', '.mjs', '.cjs', '.html', '.htm', '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs',
  '.dll', '.scr', '.lnk', '.com', '.jar', '.hta', '.reg'
]);
const ALLOWED_PACK_EXTS = new Set([
  '.json', '.geojson', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.mp3', '.ogg', '.wav',
  '.md', '.txt', '.csv',
  '.glb', '.gltf' // 工坊 3D 资产（不收 .bin：玩家互传的包不放行无法识别的裸二进制）
]);
const ALLOWED_HOT_UPDATE_EXTS = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json', '.geojson', '.png', '.jpg', '.jpeg', '.webp',
  '.bmp', '.svg', '.ico', '.mp3', '.ogg', '.wav', '.md', '.txt', '.csv', '.woff', '.woff2',
  '.ttf', '.wasm', '.map',
  '.glb', '.gltf', '.bin' // 3D 资产（御驾亲征兵模等）。此名单在壳层、热更改不到，放宽只能随安装包发布
]);

function walkPackFiles(root) {
  const out = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const fp = path.join(dir, entry.name);
      const stat = fs.lstatSync(fp);
      if (stat.isSymbolicLink()) throw new Error('工坊包不允许包含符号链接: ' + entry.name);
      if (entry.isDirectory()) {
        walk(fp);
      } else {
        out.push({ path: fp, rel: path.relative(root, fp).replace(/\\/g, '/'), size: stat.size });
      }
    });
  }
  walk(root);
  return out;
}

function validateWorkshopPack(packDir) {
  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('工坊包缺少 manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const id = normalizePackId(manifest.id || manifest.name || path.basename(packDir));
  const type = String(manifest.type || 'scenario').toLowerCase();
  const entry = String(manifest.entry || manifest.scenario || 'scenario.json');
  const entryPath = path.resolve(packDir, entry);
  if (!isInsideDir(packDir, entryPath)) throw new Error('工坊包入口路径越界');

  const files = walkPackFiles(packDir);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > 250 * 1024 * 1024) throw new Error('工坊包超过 250MB 上限');
  files.forEach(f => {
    const ext = path.extname(f.rel).toLowerCase();
    if (BLOCKED_PACK_EXTS.has(ext)) throw new Error('工坊包含有禁止类型文件: ' + f.rel);
    if (!ALLOWED_PACK_EXTS.has(ext)) throw new Error('工坊包含有未允许的文件类型: ' + f.rel);
  });

  let entryData = null;
  if (type === 'scenario') {
    if (!fs.existsSync(entryPath)) throw new Error('剧本包缺少入口文件: ' + entry);
    entryData = JSON.parse(fs.readFileSync(entryPath, 'utf-8'));
  }

  return {
    id,
    title: String(manifest.title || manifest.name || (entryData && (entryData.name || entryData.title)) || id),
    version: String(manifest.version || '1.0.0'),
    type,
    entry,
    author: String(manifest.author || ''),
    description: String(manifest.description || ''),
    tags: Array.isArray(manifest.tags) ? manifest.tags.slice(0, 20).map(String) : [],
    size: totalSize,
    fileCount: files.length,
    manifest,
    entryData
  };
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(entry => {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  });
}

function copyFileWithDirs(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function createTempDir(prefix) {
  fs.mkdirSync(WORKSHOP_DIR, { recursive: true });
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function extractZipToTemp(zipPath) {
  const temp = createTempDir('tianming-pack-');
  const zip = new AdmZip(zipPath);
  zip.getEntries().forEach(entry => {
    const target = path.resolve(temp, entry.entryName);
    if (!isInsideDir(temp, target)) throw new Error('压缩包包含越界路径: ' + entry.entryName);
  });
  zip.extractAllTo(temp, true);
  return temp;
}

function extractZipToTempChecked(zipPath, prefix) {
  const temp = createTempDir(prefix || 'tianming-hot-');
  const zip = new AdmZip(zipPath);
  zip.getEntries().forEach(entry => {
    const target = path.resolve(temp, entry.entryName);
    if (!isInsideDir(temp, target)) throw new Error('压缩包包含越界路径: ' + entry.entryName);
  });
  zip.extractAllTo(temp, true);
  return temp;
}

function createScenarioPackFromJson(jsonPath) {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const title = raw.name || raw.title || path.basename(jsonPath, path.extname(jsonPath));
  const id = normalizePackId(raw.id || title);
  const temp = createTempDir('tianming-scenario-');
  fs.copyFileSync(jsonPath, path.join(temp, 'scenario.json'));
  writeJson(path.join(temp, 'manifest.json'), {
    id,
    title,
    version: String(raw.version || '1.0.0'),
    type: 'scenario',
    entry: 'scenario.json',
    author: raw.author || '',
    description: raw.overview || raw.description || ''
  });
  return temp;
}

function readWorkshopIndex() {
  const idx = readJsonSafe(WORKSHOP_INDEX_FILE, { packs: [] });
  if (!Array.isArray(idx.packs)) idx.packs = [];
  return idx;
}

function writeWorkshopIndex(idx) {
  idx.updatedAt = new Date().toISOString();
  writeJson(WORKSHOP_INDEX_FILE, idx);
}

function packPublicInfo(pack, installPath, enabled) {
  return {
    id: pack.id,
    title: pack.title,
    version: pack.version,
    type: pack.type,
    entry: pack.entry,
    author: pack.author,
    description: pack.description,
    tags: pack.tags,
    size: pack.size,
    fileCount: pack.fileCount,
    enabled: enabled !== false,
    path: installPath
  };
}

function registerContentProtocol() {
  protocol.handle('tm-content', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'workshop') return new Response('not found', { status: 404 });
      const rawParts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
      const packId = normalizePackId(rawParts.shift() || '');
      if (!packId || !rawParts.length) return new Response('not found', { status: 404 });
      const packRoot = path.join(WORKSHOP_PACKS_DIR, packId);
      const filePath = path.resolve(packRoot, rawParts.join(path.sep));
      if (!isInsideDir(packRoot, filePath) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return new Response('not found', { status: 404 });
      }
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_PACK_EXTS.has(ext)) return new Response('forbidden', { status: 403 });
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (e) {
      return new Response('bad request', { status: 400 });
    }
  });
}

function isAllowedRemoteUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const isLocalHttp = parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname);
  return parsed.protocol === 'https:' || isLocalHttp;
}

function resolveRemoteUrl(rawUrl, baseUrl) {
  const resolved = new URL(rawUrl, baseUrl || undefined).toString();
  if (!isAllowedRemoteUrl(resolved)) throw new Error('远程地址必须使用 HTTPS；本机调试允许 localhost HTTP。');
  return resolved;
}

async function fetchJsonRemote(rawUrl, maxBytes = 2 * 1024 * 1024) {
  const url = resolveRemoteUrl(rawUrl);
  const resp = await net.fetch(url, { bypassCustomProtocolHandlers: true });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
  const text = await resp.text();
  if (Buffer.byteLength(text, 'utf-8') > maxBytes) throw new Error('远程 JSON 超过大小上限');
  return JSON.parse(text);
}

async function requestJsonRemote(rawUrl, options = {}) {
  const url = resolveRemoteUrl(rawUrl);
  const method = String(options.method || 'GET').toUpperCase();
  const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
  const init = { method, headers, bypassCustomProtocolHandlers: true };
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const resp = await net.fetch(url, init);
  const text = await resp.text();
  const maxBytes = options.maxBytes || 2 * 1024 * 1024;
  if (Buffer.byteLength(text || '', 'utf-8') > maxBytes) throw new Error('远程 JSON 超过大小上限');
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || ('HTTP ' + resp.status + ' ' + resp.statusText);
    throw new Error(msg);
  }
  return data;
}

// 2026-06-10·更新内核鲁棒性·下载带重试（指数退避）+ 断点续传（HTTP Range·写 .part）
//   opts·{ retries: 0, retryBaseDelayMs: 1200, resume: false, headers: {} }
//   - resume=true·写 dest+'.part'·重试/下次调用从已有字节继续（Range）·完成后 rename 为 dest
//     续传无法在线累计哈希·完成后流式重算（sha256FileStream）
//   - 服务器若无视 Range 回 200·自动从头重下（truncate）·416 视为 .part 已坏·删掉重来
//   - err._noRetry=true 的错误（磁盘不足/大小超限等）不重试直接抛
async function downloadRemoteFile(rawUrl, dest, maxBytes = 2 * 1024 * 1024 * 1024, onProgress, opts = {}) {
  const url = resolveRemoteUrl(rawUrl);
  const retries = Math.max(0, Number(opts.retries || 0));
  const baseDelay = Math.max(100, Number(opts.retryBaseDelayMs || 1200));
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(15000, baseDelay * Math.pow(2, attempt - 1));
      console.warn('[download] 第 ' + attempt + '/' + retries + ' 次重试·' + delay + 'ms 后·上次错误·'
        + (lastErr && lastErr.message || lastErr) + '·' + url);
      await _sleep(delay);
    }
    try {
      return await _downloadRemoteFileOnce(url, dest, maxBytes, onProgress, opts);
    } catch (e) {
      lastErr = e;
      if (e && e._noRetry) throw e;
      if (e && e._httpStatus === 416 && opts.resume) {
        try { fs.rmSync(dest + '.part', { force: true }); } catch (_) {}
      }
    }
  }
  throw lastErr;
}

async function _downloadRemoteFileOnce(url, dest, maxBytes, onProgress, opts = {}) {
  const resume = !!opts.resume;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const partPath = resume ? dest + '.part' : dest;
  let startByte = 0;
  if (resume) {
    try { if (fs.existsSync(partPath)) startByte = fs.statSync(partPath).size; } catch (_) { startByte = 0; }
  }
  const headers = Object.assign({}, opts.headers || {});
  if (resume && startByte > 0) headers.Range = 'bytes=' + startByte + '-';
  // 2026-07-20·停滞超时：连接挂起但不断流（socket 不断、数据不来·Cloudflare/弱网极常见）时，
  //   reader.read() 会永久阻塞、不报错 → 上层重试（只在抛错时触发）永不启动 → UI「莫名卡住」。
  //   用 AbortController + 空闲计时器：每次等新数据块超过 idleTimeoutMs（默认 30s·首字节/续读通用）
  //   就 abort → 抛错 → 走 downloadRemoteFile 的可续传重试（从 .part 断点续）。
  const IDLE_MS = Math.max(5000, Number(opts.idleTimeoutMs || 30000));
  const _ac = new AbortController();
  let _idleTimer = null;
  const _armIdle = () => { if (_idleTimer) clearTimeout(_idleTimer); _idleTimer = setTimeout(() => { try { _ac.abort(); } catch (_) {} }, IDLE_MS); };
  const _disarmIdle = () => { if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; } };
  _armIdle();
  let resp;
  try {
    resp = await net.fetch(url, { bypassCustomProtocolHandlers: true, headers, signal: _ac.signal });
  } finally {
    _disarmIdle();
  }
  if (resp.status === 416) {
    const err = new Error('HTTP 416 Range Not Satisfiable（本地半成品与远端不符）');
    err._httpStatus = 416;
    throw err;
  }
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);

  let received = 0;
  let total = 0;
  let writeFlags = 'w';
  if (resume && startByte > 0 && resp.status === 206) {
    // 服务器支持 Range·从 startByte 续写
    writeFlags = 'a';
    received = startByte;
    const cr = String(resp.headers.get('content-range') || '');
    const m = cr.match(/\/(\d+)\s*$/);
    total = m ? parseInt(m[1], 10) : (startByte + (Number(resp.headers.get('content-length') || 0) || 0));
    console.log('[download] 断点续传·已有 ' + formatBytesMain(startByte) + '·' + url);
  } else {
    // 全新下载（或服务器无视 Range 回 200 → 从头重下）
    total = Number(resp.headers.get('content-length') || 0) || 0;
  }

  // 非续传保持在线哈希（行为与旧版一致）·续传模式完成后流式重算
  const inlineHash = resume ? null : crypto.createHash('sha256');

  if (resp.body && typeof resp.body.getReader === 'function') {
    const reader = resp.body.getReader();
    const out = fs.createWriteStream(partPath, { flags: writeFlags });
    try {
      while (true) {
        _armIdle();                 // 等下一数据块·超过 IDLE_MS 无数据即 abort
        const chunk = await reader.read();
        _disarmIdle();              // 已拿到响应（块/结束）·写盘期间不误触发超时
        if (chunk.done) break;
        const buf = Buffer.from(chunk.value);
        received += buf.length;
        if (received > maxBytes) {
          const err = new Error('下载文件超过大小上限');
          err._noRetry = true;
          throw err;
        }
        if (inlineHash) inlineHash.update(buf);
        await new Promise((resolve, reject) => {
          out.write(buf, err => err ? reject(err) : resolve());
        });
        if (typeof onProgress === 'function') onProgress({ received, total, percent: total ? (received / total * 100) : 0 });
      }
    } finally {
      _disarmIdle();
      await new Promise(resolve => out.end(resolve));
      // 中断时取消 body·让底层 HTTP 请求真正中止（不取消会泄漏挂起连接）
      try { reader.cancel().catch(() => {}); } catch (e) {}
      try { reader.releaseLock(); } catch (e) {}
    }
    // 流正常走完才算完成·中途 throw 不会到这里（.part 留给下次续传）
    if (resume) {
      try { if (fs.existsSync(dest)) fs.rmSync(dest, { force: true }); } catch (_) {}
      fs.renameSync(partPath, dest);
      const sha = await sha256FileStream(dest);
      return { path: dest, size: received, sha256: sha };
    }
    return { path: dest, size: received, sha256: inlineHash.digest('hex') };
  }

  _armIdle();
  let ab;
  try { ab = await resp.arrayBuffer(); } finally { _disarmIdle(); }
  const buf = Buffer.from(ab);
  if (buf.length > maxBytes) {
    const err = new Error('下载文件超过大小上限');
    err._noRetry = true;
    throw err;
  }
  fs.writeFileSync(dest, buf);
  received = buf.length;
  if (typeof onProgress === 'function') onProgress({ received, total: total || received, percent: 100 });
  return { path: dest, size: buf.length, sha256: sha256File(dest) };
}

function getOnlineApiUrl(options = {}) {
  const raw = String(options.apiUrl || options.url || DEFAULT_ONLINE_API_URL || '').trim();
  if (!raw) return '';
  const resolved = resolveRemoteUrl(raw);
  return resolved.endsWith('/') ? resolved : resolved + '/';
}

async function readOnlineServiceStatus(options = {}) {
  const apiUrl = getOnlineApiUrl(options);
  if (!apiUrl) throw new Error('缺少在线服务地址');
  const healthUrl = new URL('health', apiUrl).toString();
  const health = await fetchJsonRemote(healthUrl, 1024 * 1024);
  return { apiUrl, health };
}

function readAccountSession() {
  const session = readJsonSafe(ACCOUNT_SESSION_FILE, {});
  return {
    token: String(session.token || ''),
    apiUrl: String(session.apiUrl || DEFAULT_ONLINE_API_URL),
    user: session.user && typeof session.user === 'object' ? session.user : null,
    loggedInAt: session.loggedInAt || ''
  };
}

function writeAccountSession(session) {
  ensureSaveDir();
  writeJson(ACCOUNT_SESSION_FILE, {
    token: String(session.token || ''),
    apiUrl: String(session.apiUrl || DEFAULT_ONLINE_API_URL),
    user: session.user || null,
    loggedInAt: session.loggedInAt || new Date().toISOString()
  });
}

function clearAccountSession() {
  try {
    if (fs.existsSync(ACCOUNT_SESSION_FILE)) fs.rmSync(ACCOUNT_SESSION_FILE, { force: true });
  } catch (e) {}
}

function getAccountApiUrl(options = {}) {
  const session = readAccountSession();
  return getOnlineApiUrl({ apiUrl: options.apiUrl || session.apiUrl || DEFAULT_ONLINE_API_URL });
}

function getAccountAuthHeaders(options = {}) {
  const token = String(options.token || readAccountSession().token || '').trim();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function postOnlineApi(pathname, body, options = {}) {
  const apiUrl = getAccountApiUrl(options);
  const url = new URL(String(pathname || '').replace(/^\//, ''), apiUrl).toString();
  const headers = Object.assign({}, getAccountAuthHeaders(options), options.headers || {});
  return requestJsonRemote(url, { method: 'POST', headers, body, maxBytes: options.maxBytes });
}

async function getOnlineApi(pathname, options = {}) {
  const apiUrl = getAccountApiUrl(options);
  const url = new URL(String(pathname || '').replace(/^\//, ''), apiUrl).toString();
  const headers = Object.assign({}, getAccountAuthHeaders(options), options.headers || {});
  return requestJsonRemote(url, { method: 'GET', headers, maxBytes: options.maxBytes });
}

function updateInfoSize(info) {
  if (!info) return 0;
  if (Number(info.size) > 0) return Number(info.size);
  const files = Array.isArray(info.files) ? info.files : [];
  return files.reduce((sum, f) => sum + (Number(f && f.size) || 0), 0);
}

function validateHotUpdateBundle(bundleDir) {
  const manifestPath = path.join(bundleDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('热更新包缺少 manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (manifest.type !== 'tianming-hot-update') throw new Error('manifest.type 必须是 tianming-hot-update');
  const version = String(manifest.version || '').trim();
  if (!version) throw new Error('热更新包缺少 version');
  if (!isStrictRendererUpgrade(version)) throw new Error('热更新版本不高于当前前端版本，已拒绝。');
  if (manifest.minAppVersion && compareVersions(getCurrentComparableVersion(), manifest.minAppVersion) < 0) {
    throw new Error('当前安装包版本低于该热更新要求的最低本体版本。');
  }
  if (manifest.maxAppVersion && compareVersions(getCurrentComparableVersion(), manifest.maxAppVersion) > 0) {
    throw new Error('当前安装包版本高于该热更新支持的最高本体版本。');
  }
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) throw new Error('热更新包 manifest.files 不能为空');
  let totalSize = 0;
  files.forEach(item => {
    const rel = String(item.path || '').replace(/\\/g, '/');
    if (!rel || rel.startsWith('/') || rel.includes('..')) throw new Error('热更新文件路径非法: ' + rel);
    const ext = path.extname(rel).toLowerCase();
    if (!ALLOWED_HOT_UPDATE_EXTS.has(ext)) throw new Error('热更新包含未允许的文件类型: ' + rel);
    const src = path.resolve(bundleDir, rel);
    if (!isInsideDir(bundleDir, src) || !fs.existsSync(src) || !fs.statSync(src).isFile()) throw new Error('热更新文件不存在: ' + rel);
    const size = fs.statSync(src).size;
    totalSize += size;
    if (item.size != null && Number(item.size) !== size) throw new Error('热更新文件大小不一致: ' + rel);
    const actualHash = sha256File(src).toLowerCase();
    const expectedHash = String(item.sha256 || '').toLowerCase();
    if (!expectedHash || expectedHash !== actualHash) throw new Error('热更新文件 hash 不一致: ' + rel);
  });
  if (totalSize > 2 * 1024 * 1024 * 1024) throw new Error('热更新文件总量超过 2GB 上限');
  const entry = String(manifest.entry || 'index.html');
  if (entry.startsWith('/') || entry.includes('..')) throw new Error('热更新入口路径非法: ' + entry);
  if (Array.isArray(manifest.remove)) {
    manifest.remove.forEach(raw => {
      const rel = String(raw || '').replace(/\\/g, '/');
      if (!rel || rel.startsWith('/') || rel.includes('..')) throw new Error('热更新删除路径非法: ' + rel);
    });
  }
  return { manifest, version, files, entry };
}

function installHotUpdateFromBundle(bundleDir, sourceInfo = {}) {
  const hot = validateHotUpdateBundle(bundleDir);
  ensureSaveDir();
  const staging = path.join(HOT_UPDATE_DIR, '__staging_' + Date.now());
  if (fs.existsSync(staging)) safeRmDir(staging, HOT_UPDATE_DIR);
  fs.mkdirSync(staging, { recursive: true });

  copyDirRecursive(path.join(bundledAppRoot(), 'web'), staging);  // 2026-06-10·热更 main 下 __dirname/web 不存在·锚定安装包根
  if (Array.isArray(hot.manifest.remove)) {
    hot.manifest.remove.forEach(raw => {
      const rel = String(raw || '').replace(/\\/g, '/');
      if (!rel || rel.startsWith('/') || rel.includes('..')) return;
      const targetPath = path.resolve(staging, rel);
      if (isInsideDir(staging, targetPath) && fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });
    });
  }
  hot.files.forEach(item => {
    const rel = String(item.path || '').replace(/\\/g, '/');
    copyFileWithDirs(path.resolve(bundleDir, rel), path.resolve(staging, rel));
  });
  return _finalizeStagingInstall(staging, hot, sourceInfo);
}

// 2026-05-23·提出 finalize·复用给 incremental·incremental staging 已自带全文件·不需基层 copy + overlay
function _finalizeStagingInstall(staging, hot, sourceInfo) {
  ensureSaveDir();
  const state = getHotUpdateState();
  const target = path.join(HOT_UPDATE_VERSIONS_DIR, sanitize(hot.version));
  writeJson(path.join(staging, '.hot-update-manifest.json'), hot.manifest);
  if (!fs.existsSync(path.join(staging, hot.entry))) throw new Error('安装后的热更新入口文件不存在');
  if (fs.existsSync(target)) safeRmDir(target, HOT_UPDATE_VERSIONS_DIR);
  fs.renameSync(staging, target);
  writeHotUpdateState({
    enabled: true,
    currentVersion: hot.version,
    currentDir: target,
    previousVersion: state.currentVersion || '',
    previousDir: state.currentDir || '',
    installedAt: new Date().toISOString(),
    source: sourceInfo
  });
  // 2026-06-10·装好后顺手清理（current/previous 之外的旧版本目录等）·延后不阻塞安装返回
  setTimeout(() => { try { cleanupHotUpdateArtifacts(); } catch (_) {} }, 3000);
  return { version: hot.version, dir: target, manifest: hot.manifest };
}

// 2026-05-23·incremental install·feed 有 manifestUrl + filesBaseUrl 且 local 有 manifest·diff + 按需下载
//   ·unchanged 文件从 currentDir hardlink (NTFS 支持·跨盘 fallback copy)
//   ·changed 文件按 sha-addressed URL 拉·sha 验证后入 staging
//   ·失败 throw·caller fallback 自基线重建 → 全 zip
// 2026-07-07·拆出 _fetchIncrementalManifest / _incrementalSyncFromReuseMap·
//   与「自基线重建」(installHotUpdate_rebaseline) 共用同一套 staging/下载/验证内核
async function _fetchIncrementalManifest(feedInfo) {
  const manifestUrl = resolveRemoteUrl(feedInfo.feed.manifestUrl, feedInfo.feedUrl);
  const filesBaseUrlRaw = String(feedInfo.feed.filesBaseUrl || '');
  if (!filesBaseUrlRaw) throw new Error('feed.filesBaseUrl missing');
  // resolveRemoteUrl 把相对路径解析到 feed 同一目录·确保结尾 /
  let filesBaseUrl = resolveRemoteUrl(filesBaseUrlRaw, feedInfo.feedUrl);
  if (!filesBaseUrl.endsWith('/')) filesBaseUrl += '/';
  const newManifest = await fetchJsonRemote(manifestUrl, 5 * 1024 * 1024);
  if (newManifest.type !== 'tianming-hot-update') throw new Error('manifest type mismatch');
  if (String(newManifest.version || '').trim() !== feedInfo.version) throw new Error('manifest version != feed version');
  const newFiles = Array.isArray(newManifest.files) ? newManifest.files : [];
  if (!newFiles.length) throw new Error('manifest.files 空');
  return { manifestUrl, filesBaseUrl, newManifest, newFiles };
}

async function installHotUpdate_incremental(feedInfo, currentState) {
  sendHotUpdateStatus('incremental-start', { version: feedInfo.version });
  const plan = await _fetchIncrementalManifest(feedInfo);

  const localManifest = readJsonSafe(path.join(currentState.currentDir, '.hot-update-manifest.json'), null);
  if (!localManifest || !Array.isArray(localManifest.files)) throw new Error('local manifest 缺失或损坏·走自基线重建/全 zip 兜底');
  const localShaByPath = Object.create(null);
  localManifest.files.forEach(f => { if (f && f.path) localShaByPath[String(f.path)] = String(f.sha256 || '').toLowerCase(); });

  // 本地 manifest 声称 sha 相同的文件从 currentDir 复用·manifest 说谎由末端 validate sha 终检兜住
  const reuseSrcByPath = Object.create(null);
  plan.newFiles.forEach(f => {
    const sha = String(f.sha256 || '').toLowerCase();
    if (sha && localShaByPath[String(f.path)] === sha) {
      reuseSrcByPath[String(f.path)] = path.resolve(currentState.currentDir, String(f.path).replace(/\\/g, '/'));
    }
  });
  return await _incrementalSyncFromReuseMap(feedInfo, plan, reuseSrcByPath, 'incremental-hot-update');
}

// 2026-07-07·自基线重建·第二道增量（介于 manifest 增量与全 zip 之间）：
//   老安装无 .hot-update-manifest.json / 本地 manifest 失真 / manifest 增量中途失败时·
//   不信任何本地账本·对着新 manifest 逐文件现算本地 sha（currentDir 优先·安装包内 web/ 兜底）·
//   命中=复用·未命中/缺失=按 sha 仓下载。全树 hash 数秒级·换掉动辄数百 MB 的全 zip 兜底。
//   kill-switch：feed flags.disableRebaseline（改服务器 JSON 即时生效·同 forceFullZip 家族）。
async function installHotUpdate_rebaseline(feedInfo, currentState) {
  sendHotUpdateStatus('rebaseline-start', { version: feedInfo.version });
  const plan = await _fetchIncrementalManifest(feedInfo);

  const baseDirs = [];
  const curDir = currentState && currentState.currentDir ? path.resolve(currentState.currentDir) : '';
  if (curDir && fs.existsSync(curDir)) baseDirs.push(curDir);
  const bundledWeb = path.resolve(bundledAppRoot(), 'web');
  if (fs.existsSync(bundledWeb) && !baseDirs.includes(bundledWeb)) baseDirs.push(bundledWeb);
  if (!baseDirs.length) throw new Error('rebaseline·无可用本地基线目录');

  const reuseSrcByPath = Object.create(null);
  let scanned = 0, matched = 0, lastScanEvt = 0;
  for (const f of plan.newFiles) {
    const rel = String(f.path || '').replace(/\\/g, '/');
    const want = String(f.sha256 || '').toLowerCase();
    scanned++;
    if (rel && want && !rel.startsWith('/') && !rel.includes('..')) {
      for (const base of baseDirs) {
        const cand = path.resolve(base, rel);
        if (!isInsideDir(base, cand)) break;
        let st = null;
        try { st = fs.statSync(cand); } catch (_) { continue; }
        if (!st.isFile()) continue;
        if (f.size != null && Number(f.size) !== st.size) continue; // 尺寸不符免 hash
        let got = '';
        try { got = (await sha256FileStream(cand)).toLowerCase(); } catch (_) { continue; }
        if (got === want) { reuseSrcByPath[String(f.path)] = cand; matched++; break; }
      }
    }
    const nowTs = Date.now();
    if (nowTs - lastScanEvt >= 200 || scanned === plan.newFiles.length) {
      lastScanEvt = nowTs;
      sendHotUpdateStatus('rebaseline-scan', { version: feedInfo.version, scanned, total: plan.newFiles.length, matched });
    }
  }
  console.log('[hot-update-rb] 自基线重建·' + matched + '/' + plan.newFiles.length + ' 文件本地命中可复用');
  return await _incrementalSyncFromReuseMap(feedInfo, plan, reuseSrcByPath, 'rebaseline-hot-update');
}

async function _incrementalSyncFromReuseMap(feedInfo, plan, reuseSrcByPath, installedFrom) {
  const { manifestUrl, filesBaseUrl, newManifest, newFiles } = plan;
  const toFetch = newFiles.filter(f => {
    const sha = String(f.sha256 || '').toLowerCase();
    return !sha || !reuseSrcByPath[String(f.path)];
  });
  const toFetchBytes = toFetch.reduce((s, f) => s + (Number(f.size) || 0), 0);
  console.log('[hot-update-inc] ' + toFetch.length + '/' + newFiles.length + ' files need fetch·' + (toFetchBytes/1024/1024).toFixed(2) + ' MB');
  sendHotUpdateStatus('incremental-plan', {
    version: feedInfo.version,
    total: newFiles.length,
    fetch: toFetch.length,
    reuse: newFiles.length - toFetch.length,
    fetchBytes: toFetchBytes,
    mode: installedFrom
  });

  // 2026-06-10·磁盘空间预检·复用源在 versions 目录内=hardlink（同卷不占空间）·
  //   其它来源（安装包内 web/ 等）linkSync 会失败落 copy·按拷贝体积计
  const fetchPathSet = new Set(toFetch.map(f => f.path));
  let reuseCopyBytes = 0;
  for (const f of newFiles) {
    if (fetchPathSet.has(f.path)) continue;
    const src = reuseSrcByPath[String(f.path)];
    if (!src || !isInsideDir(HOT_UPDATE_VERSIONS_DIR, path.resolve(src))) reuseCopyBytes += Number(f.size) || 0;
  }
  await ensureDiskSpace(HOT_UPDATE_DIR, toFetchBytes * 2 + reuseCopyBytes + 200 * 1024 * 1024, '增量更新');

  ensureSaveDir();
  const staging = path.join(HOT_UPDATE_DIR, '__staging_inc_' + Date.now());
  if (fs.existsSync(staging)) safeRmDir(staging, HOT_UPDATE_DIR);
  fs.mkdirSync(staging, { recursive: true });

  try {
    // hardlink unchanged·fallback copy
    let linked = 0, copied = 0;
    for (const f of newFiles) {
      if (fetchPathSet.has(f.path)) continue;
      const rel = String(f.path || '').replace(/\\/g, '/');
      const src = reuseSrcByPath[String(f.path)];
      const dst = path.resolve(staging, rel);
      if (!isInsideDir(staging, dst)) throw new Error('illegal staging path: ' + rel);
      if (!src || !fs.existsSync(src)) {
        throw new Error('local source missing·' + rel + ' (currentDir may have been corrupted·走下一级兜底)');
      }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      try { fs.linkSync(src, dst); linked++; }
      catch (_lE) { fs.copyFileSync(src, dst); copied++; }
    }
    console.log('[hot-update-inc] reused·' + linked + ' hardlinked·' + copied + ' copied');

    // fetch changed·2026-06-10·有界并发池（默认 4 路·feed flags.maxConcurrency 可调）+ 单文件重试 3 次
    //   进度事件保留 done/total 旧字段·新增 bytesDone/fetchBytes（消费方可算字节级百分比）·150ms 限频
    let done = 0;
    let bytesDone = 0;
    let lastProgressAt = 0;
    const flagConcurrency = Number(feedInfo.flags && feedInfo.flags.maxConcurrency);
    const concurrency = Math.max(1, Math.min(8, Number.isFinite(flagConcurrency) && flagConcurrency > 0 ? flagConcurrency : 4));
    await runWorkerPool(toFetch, concurrency, async (f) => {
      const sha = String(f.sha256 || '').toLowerCase();
      if (!sha) {
        const e = new Error('manifest entry missing sha256·' + f.path);
        e._noRetry = true;
        throw e;
      }
      const baseName = path.basename(f.path);
      const url = filesBaseUrl + sha.slice(0, 2) + '/' + sha.slice(2) + '/' + encodeURIComponent(baseName);
      const dst = path.resolve(staging, String(f.path).replace(/\\/g, '/'));
      if (!isInsideDir(staging, dst)) throw new Error('illegal staging path: ' + f.path);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const maxBytes = Math.max(1024 * 1024, Number(f.size || 0) * 2 + 64 * 1024);
      const got = await downloadRemoteFile(url, dst, maxBytes, null, { retries: 3 });
      if (String(got.sha256 || '').toLowerCase() !== sha) {
        throw new Error('sha mismatch fetched·' + f.path + '·expected ' + sha + ' got ' + got.sha256);
      }
      done++;
      bytesDone += Number(f.size || 0);
      const nowTs = Date.now();
      if (nowTs - lastProgressAt >= 150 || done === toFetch.length) {
        lastProgressAt = nowTs;
        sendHotUpdateStatus('incremental-progress', {
          version: feedInfo.version, done, total: toFetch.length, bytesDone, fetchBytes: toFetchBytes
        });
      }
    });

    // write manifest.json (required by validate)
    writeJson(path.join(staging, 'manifest.json'), newManifest);

    // validate + finalize·validate 会 sha-check 每个文件·hardlinked + fetched 都过一遍·安全
    const hot = validateHotUpdateBundle(staging);
    return _finalizeStagingInstall(staging, hot, {
      feedUrl: feedInfo.feedUrl,
      manifestUrl,
      filesBaseUrl,
      sha256: feedInfo.sha256,
      notes: feedInfo.notes,
      installedFrom,
      reusedFiles: newFiles.length - toFetch.length,
      fetchedFiles: toFetch.length,
      fetchedBytes: toFetchBytes
    });
  } catch (e) {
    try { if (fs.existsSync(staging)) safeRmDir(staging, HOT_UPDATE_DIR); } catch (_) {}
    throw e;
  }
}

function getHotUpdateFeedUrl(options = {}) {
  return String(options.feedUrl || options.url || DEFAULT_HOT_UPDATE_FEED_URL || '').trim();
}

async function readHotUpdateFeed(options = {}) {
  const feedUrl = resolveRemoteUrl(getHotUpdateFeedUrl(options));
  const feed = await fetchJsonRemote(feedUrl, 1024 * 1024);
  if (feed.type && feed.type !== 'tianming-hot-update-feed') throw new Error('hot update feed type mismatch');
  const version = String(feed.version || '').trim();
  if (!version) throw new Error('hot update feed missing version');
  const packageRef = feed.packageUrl || feed.url || feed.file || feed.zip;
  if (!packageRef) throw new Error('hot update feed missing packageUrl');
  const packageUrl = resolveRemoteUrl(String(packageRef), feedUrl);
  return {
    feed,
    feedUrl,
    packageUrl,
    version,
    // 2026-07-07·zip 整包备用下载源（gh release 等）·主源失败逐个换·旧客户端忽略
    packageUrlMirrors: (Array.isArray(feed.packageUrlMirrors) ? feed.packageUrlMirrors : [])
      .map(u => { try { return resolveRemoteUrl(String(u), feedUrl); } catch (_) { return ''; } })
      .filter(Boolean),
    sha256: String(feed.sha256 || feed.hash || '').toLowerCase(),
    size: Number(feed.size || feed.bytes || 0) || 0,
    notes: feed.notes || feed.releaseNotes || feed.description || '',
    // 2026-06-11·feed 层 minAppVersion·下载前判定是否须先升本体安装包
    minAppVersion: String(feed.minAppVersion || '').trim(),
    // 2026-06-10·feed 级开关（旧客户端忽略未知字段·新客户端按需降级）·
    //   forceFullZip / maxConcurrency / disableAutoCheck / disableSelfHeal
    flags: (feed.flags && typeof feed.flags === 'object') ? feed.flags : {}
  };
}

async function installHotUpdateFromFeed(options = {}) {
  let tempDir = null;
  let zipPath = null;
  const feedInfo = await readHotUpdateFeed(options);
  const rendererVersion = getEffectiveRendererVersion();
  if (!isStrictRendererUpgrade(feedInfo.version)) {
    return {
      success: false,
      blockedDowngrade: true,
      currentVersion: rendererVersion,
      remoteVersion: feedInfo.version,
      message: '热更新版本不高于当前前端版本，已拒绝安装。'
    };
  }
  // 2026-06-11·本体版本门·下载前拒绝（manifest 内 minAppVersion 校验仍是装前最后防线）
  if (feedInfo.minAppVersion && compareVersions(getCurrentComparableVersion(), feedInfo.minAppVersion) < 0) {
    return {
      success: false,
      needsInstaller: true,
      currentVersion: rendererVersion,
      remoteVersion: feedInfo.version,
      minAppVersion: feedInfo.minAppVersion,
      message: '此更新需要更新本体安装包，请先更新本体。'
    };
  }
  // 2026-05-23·incremental 优先·feed 有 manifestUrl + filesBaseUrl 且本地有装过 → diff + per-file fetch
  //   失败 throw → 落到自基线重建 → zip 全包 fallback·不阻塞玩家
  const currentState = getHotUpdateState();
  // 2026-06-02·首装也能增量·currentDir 空(从未装过热更)时回退到打包内 web/ 作 diff 基线·
  //   需 web/.hot-update-manifest.json 一起打包·incremental 从 asar 内 web/ copy 未变文件·
  //   任何失败 throw → 优雅回退下一级兜底·零倒退风险。
  const incState = (currentState && currentState.currentDir)
    ? currentState
    : Object.assign({}, currentState, { currentDir: path.join(bundledAppRoot(), 'web') });
  const canIncremental = !!(feedInfo.feed && feedInfo.feed.manifestUrl && feedInfo.feed.filesBaseUrl);
  const hasLocalManifest = incState.currentDir
    && fs.existsSync(path.join(incState.currentDir, '.hot-update-manifest.json'));
  // 2026-06-10·feed flags.forceFullZip = 服务器端 kill-switch·增量链路出问题时一键全员回全 zip
  const feedForceFullZip = !!(feedInfo.flags && feedInfo.flags.forceFullZip);
  // 2026-07-07·feed flags.disableRebaseline = 自基线重建的独立 kill-switch
  const feedDisableRebaseline = !!(feedInfo.flags && feedInfo.flags.disableRebaseline);
  if (canIncremental && !options.forceFullZip && !feedForceFullZip) {
    if (hasLocalManifest) {
      try {
        const installed = await installHotUpdate_incremental(feedInfo, incState);
        sendHotUpdateStatus('installed', { version: installed.version, status: getHotUpdatePublicStatus(), mode: 'incremental' });
        return { success: true, installed, status: getHotUpdatePublicStatus(), notes: feedInfo.notes, mode: 'incremental' };
      } catch (incErr) {
        console.warn('[hot-update] incremental 失败·转自基线重建·' + (incErr && incErr.message || incErr));
        sendHotUpdateStatus('incremental-fallback', { version: feedInfo.version, reason: String(incErr && incErr.message || incErr) });
        // fall through → rebaseline
      }
    }
    // 2026-07-07·自基线重建·老安装(无本地 manifest)/manifest 增量失败 → 现算本地 sha 只补差·
    //   把「一失手就整包全下」改成「最多多花几秒 hash」。
    if (!feedDisableRebaseline && !options.skipRebaseline) {
      try {
        const installed = await installHotUpdate_rebaseline(feedInfo, incState);
        sendHotUpdateStatus('installed', { version: installed.version, status: getHotUpdatePublicStatus(), mode: 'rebaseline' });
        return { success: true, installed, status: getHotUpdatePublicStatus(), notes: feedInfo.notes, mode: 'rebaseline' };
      } catch (rbErr) {
        console.warn('[hot-update] rebaseline 失败·fallback 全 zip·' + (rbErr && rbErr.message || rbErr));
        sendHotUpdateStatus('rebaseline-fallback', { version: feedInfo.version, reason: String(rbErr && rbErr.message || rbErr) });
        // fall through → zip
      }
    }
  }
  // 兜底·原 zip 全包路径 (增量与自基线均不可用或失败)
  return await installHotUpdateFromFeed_zipFallback(feedInfo, options);
}

async function installHotUpdateFromFeed_zipFallback(feedInfo, options = {}) {
  let tempDir = null;
  let zipPath = null;
  const rendererVersion = getEffectiveRendererVersion();
  if (!isStrictRendererUpgrade(feedInfo.version)) {
    return {
      success: false,
      blockedDowngrade: true,
      currentVersion: rendererVersion,
      remoteVersion: feedInfo.version,
      message: '热更新版本不高于当前前端版本，已拒绝安装。'
    };
  }
  try {
    sendHotUpdateStatus('download-start', { version: feedInfo.version, feedUrl: feedInfo.feedUrl });
    // 2026-06-10·磁盘预检（zip + 解压临时 + staging ≈ 3 倍）·路径去掉 Date.now() → .part 可跨次续传
    await ensureDiskSpace(HOT_UPDATE_DIR, (feedInfo.size || 0) * 3 + 300 * 1024 * 1024, '完整更新包');
    zipPath = path.join(HOT_UPDATE_DIR, 'downloads', 'tianming-hot-' + sanitize(feedInfo.version) + '.zip');
    // 2026-07-07·多源下载·主源(自服/CDN)失败逐个换镜像（feed packageUrlMirrors·如 gh release）·
    //   .part 跨源续传安全：内容同一·装前 sha 终检兜底
    const candidates = [feedInfo.packageUrl].concat(feedInfo.packageUrlMirrors || []).filter(Boolean);
    let fileInfo = null;
    let lastDlErr = null;
    for (let ci = 0; ci < candidates.length; ci++) {
      const srcUrl = candidates[ci];
      try {
        fileInfo = await downloadRemoteFile(srcUrl, zipPath, 2 * 1024 * 1024 * 1024, progress => {
          sendHotUpdateStatus('download-progress', {
            version: feedInfo.version,
            feedUrl: feedInfo.feedUrl,
            packageUrl: srcUrl,
            size: progress.total || feedInfo.size || 0,
            transferred: progress.received || 0,
            percent: progress.percent || 0
          });
        }, { retries: ci === 0 ? 3 : 2, resume: true });
        break;
      } catch (dlErr) {
        lastDlErr = dlErr;
        if (ci < candidates.length - 1) {
          console.warn('[hot-update] 下载源失败·换备用源·' + srcUrl + '·' + (dlErr && dlErr.message || dlErr));
          sendHotUpdateStatus('mirror-switch', { version: feedInfo.version, from: srcUrl, to: candidates[ci + 1] });
        }
      }
    }
    if (!fileInfo) throw (lastDlErr || new Error('全部下载源失败'));
    if (feedInfo.sha256 && feedInfo.sha256 !== fileInfo.sha256.toLowerCase()) {
      throw new Error('hot update package sha256 mismatch');
    }
    sendHotUpdateStatus('downloaded', { version: feedInfo.version, size: fileInfo.size, sha256: fileInfo.sha256 });
    tempDir = extractZipToTempChecked(zipPath, 'tianming-hot-');
    sendHotUpdateStatus('verifying', { version: feedInfo.version });
    const installed = installHotUpdateFromBundle(tempDir, {
      feedUrl: feedInfo.feedUrl,
      packageUrl: feedInfo.packageUrl,
      sha256: fileInfo.sha256,
      notes: feedInfo.notes,
      installedFrom: 'online-hot-update'
    });
    sendHotUpdateStatus('installed', { version: installed.version, status: getHotUpdatePublicStatus() });
    return { success: true, installed, status: getHotUpdatePublicStatus(), notes: feedInfo.notes };
  } finally {
    try { if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    try { if (zipPath && isInsideDir(HOT_UPDATE_DIR, zipPath) && fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true }); } catch (e) {}
  }
}

// ============================================================
//  热更自愈与卫生·2026-06-10
//  原则·热更系统是唯一坏了就没法用更新修自己的系统：
//  ① 状态损坏 → 启动时修（promote previous / 回 bundled）·绝不让玩家卡死
//  ② 热更版本连续启动失败 → 自动停用热更（boot-attempt 计数·所有旧 shim 都认 enabled:false）
//  ③ 旧版本目录 / staging 残骸 / 下载残留 → 启动后 15s 静默清理（不占启动关键路径）
//  全部仅 packaged 生效·dev (npm start) 与 packaged 共用 userData·dev 的版本号不可信·不碰玩家状态
// ============================================================

const BOOT_ATTEMPT_FILE = path.join(HOT_UPDATE_DIR, 'boot-attempt.json');

function _isValidHotDir(dir) {
  try {
    if (!dir) return false;
    const p = path.resolve(dir);
    return isInsideDir(HOT_UPDATE_VERSIONS_DIR, p)
      && fs.existsSync(path.join(p, 'index.html'));
  } catch (_) { return false; }
}

// 启动期状态修复·返回修了什么（[] = 无须修）
function repairHotUpdateState() {
  const repairs = [];
  if (!app.isPackaged) return repairs;
  try {
    // ① 状态文件存在但解析不了 → 留尸改名·写全新默认
    if (fs.existsSync(HOT_UPDATE_STATE_FILE)) {
      try {
        JSON.parse(fs.readFileSync(HOT_UPDATE_STATE_FILE, 'utf-8'));
      } catch (_parseErr) {
        const corpse = HOT_UPDATE_STATE_FILE + '.corrupt-' + Date.now();
        try { fs.renameSync(HOT_UPDATE_STATE_FILE, corpse); } catch (_) {}
        writeJsonAtomic(HOT_UPDATE_STATE_FILE, {
          enabled: true, currentVersion: '', currentDir: '', previousVersion: '', previousDir: '', installedAt: ''
        });
        repairs.push('state-corrupt');
      }
    }
    const state = getHotUpdateState();
    const fromVersion = state.currentVersion || '';
    // ② currentDir 失效（目录没了 / index.html 没了 / 越界）→ promote previous·否则清空回 bundled
    if (state.currentDir && !_isValidHotDir(state.currentDir)) {
      if (_isValidHotDir(state.previousDir)) {
        writeHotUpdateState({
          currentVersion: state.previousVersion || path.basename(path.resolve(state.previousDir)),
          currentDir: path.resolve(state.previousDir),
          previousVersion: '', previousDir: ''
        });
        repairs.push('current-invalid-promoted-previous');
      } else {
        writeHotUpdateState({ currentVersion: '', currentDir: '', previousVersion: '', previousDir: '' });
        repairs.push('current-invalid-cleared');
      }
    } else if (state.currentDir && state.currentVersion
        && compareVersions(state.currentVersion, getCurrentComparableVersion()) < 0) {
      // ③ stale·安装包已升过热更版本 → 清引用·shim 下次也不再加载旧热更 main
      writeHotUpdateState({ currentVersion: '', currentDir: '', previousVersion: '', previousDir: '' });
      repairs.push('stale-cleared');
    }
    if (repairs.length) {
      const after = getHotUpdateState();
      writeHotUpdateState({
        lastRepair: {
          at: new Date().toISOString(),
          reasons: repairs.slice(),
          fromVersion,
          toVersion: after.currentVersion || ''
        }
      });
      console.warn('[hot-repair] 热更状态已修复·' + repairs.join('+') + '·' + fromVersion + ' → ' + (after.currentVersion || '(bundled)'));
    }
  } catch (e) {
    console.warn('[hot-repair] 修复失败(忽略·不阻塞启动)·' + (e && e.message || e));
  }
  return repairs;
}

// 崩溃环检测·启动时计数·同一热更版本连续 ≥2 次没达到健康点 → enabled:false（老 shim 通认）
//   本次会话仍跑着热更 main（shim 已加载）·但 web 即刻回 bundled·下次启动三层全回安装包
function _bootHealthCheckOnStartup() {
  if (!app.isPackaged) return;
  try {
    const active = getActiveHotUpdate();
    if (!active.active) {
      try { fs.rmSync(BOOT_ATTEMPT_FILE, { force: true }); } catch (_) {}
      return;
    }
    const marker = readJsonSafe(BOOT_ATTEMPT_FILE, null);
    const flags = (active.state && active.state.lastFeedFlags) || {};
    if (marker && marker.version === active.version && Number(marker.count) >= 2) {
      if (flags.disableSelfHeal) {
        console.warn('[boot-health] 连续 ' + marker.count + ' 次启动未达健康·但 feed flags.disableSelfHeal 在·只记录不停用');
      } else {
        console.warn('[boot-health] 热更 ' + active.version + ' 连续 ' + marker.count + ' 次启动未达健康·自动停用热更·回安装包内置版本');
        writeHotUpdateState({
          enabled: false,
          lastRepair: { at: new Date().toISOString(), reasons: ['boot-crash-loop'], fromVersion: active.version, toVersion: '' }
        });
        try { fs.rmSync(BOOT_ATTEMPT_FILE, { force: true }); } catch (_) {}
        return;
      }
    }
    const sameVer = marker && marker.version === active.version;
    writeJsonAtomic(BOOT_ATTEMPT_FILE, {
      version: active.version,
      count: sameVer ? (Number(marker.count) || 0) + 1 : 1,
      firstAt: sameVer && marker.firstAt ? marker.firstAt : new Date().toISOString()
    });
  } catch (e) {
    console.warn('[boot-health] 启动检查失败(忽略)·' + (e && e.message || e));
  }
}

// 健康点判定·ready-to-show 后 5s 渲染层无致命事件 → 清启动计数；干净退出同样视为健康
function _armBootHealthClear(win) {
  if (!app.isPackaged || !win) return;
  let failed = false;
  let readyFired = false;
  const clear = () => { try { fs.rmSync(BOOT_ATTEMPT_FILE, { force: true }); } catch (_) {} };
  try {
    win.webContents.on('render-process-gone', (_e, details) => {
      failed = true;
      console.warn('[boot-health] 渲染进程崩溃·' + (details && details.reason || 'unknown') + '·保留启动计数');
    });
    win.webContents.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) {  // -3 = ABORTED·正常导航中断不算
        failed = true;
        console.warn('[boot-health] 主框架加载失败·' + code + ' ' + desc + '·保留启动计数');
      }
    });
  } catch (_) {}
  win.once('ready-to-show', () => {
    readyFired = true;
    setTimeout(() => { if (!failed) clear(); }, 5000);
  });
  app.once('before-quit', () => { if (readyFired && !failed) clear(); });
}

// 磁盘卫生·只留 current + previous 两个版本目录·清 staging 残骸与下载残留
function cleanupHotUpdateArtifacts() {
  const result = { removedVersions: 0, removedStaging: 0, removedDownloads: 0 };
  if (!app.isPackaged) return result;
  try {
    const state = getHotUpdateState();
    const keep = new Set();
    [state.currentDir, state.previousDir].forEach(d => {
      if (d) { try { keep.add(path.basename(path.resolve(d))); } catch (_) {} }
    });
    try {
      const activeRoot = path.resolve(getActiveWebRoot());
      if (isInsideDir(HOT_UPDATE_VERSIONS_DIR, activeRoot)) keep.add(path.basename(activeRoot));
    } catch (_) {}
    if (isDirectorySafe(HOT_UPDATE_VERSIONS_DIR)) {
      fs.readdirSync(HOT_UPDATE_VERSIONS_DIR, { withFileTypes: true }).forEach(ent => {
        if (!ent.isDirectory() || keep.has(ent.name)) return;
        try { safeRmDir(path.join(HOT_UPDATE_VERSIONS_DIR, ent.name), HOT_UPDATE_VERSIONS_DIR); result.removedVersions++; } catch (_) {}
      });
    }
    if (isDirectorySafe(HOT_UPDATE_DIR)) {
      const hourAgo = Date.now() - 60 * 60 * 1000;
      fs.readdirSync(HOT_UPDATE_DIR, { withFileTypes: true }).forEach(ent => {
        if (!ent.isDirectory() || ent.name.indexOf('__staging_') !== 0) return;
        const p = path.join(HOT_UPDATE_DIR, ent.name);
        try { if (fs.statSync(p).mtimeMs < hourAgo) { safeRmDir(p, HOT_UPDATE_DIR); result.removedStaging++; } } catch (_) {}
      });
    }
    const dlDir = path.join(HOT_UPDATE_DIR, 'downloads');
    if (isDirectorySafe(dlDir)) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      fs.readdirSync(dlDir, { withFileTypes: true }).forEach(ent => {
        if (!ent.isFile()) return;
        const p = path.join(dlDir, ent.name);
        try {
          if (/\.zip$/i.test(ent.name)) { fs.rmSync(p, { force: true }); result.removedDownloads++; }
          else if (/\.part$/i.test(ent.name) && fs.statSync(p).mtimeMs < weekAgo) { fs.rmSync(p, { force: true }); result.removedDownloads++; }
        } catch (_) {}  // 正在写的文件删不掉·下次再清
      });
    }
    if (result.removedVersions || result.removedStaging || result.removedDownloads) {
      console.log('[hot-cleanup] 清理·旧版本目录 ' + result.removedVersions
        + '·staging 残骸 ' + result.removedStaging + '·下载残留 ' + result.removedDownloads);
    }
  } catch (e) {
    console.warn('[hot-cleanup] 清理失败(忽略)·' + (e && e.message || e));
  }
  return result;
}

// ============================================================
//  主窗口
// ============================================================
let mainWindow = null;

function createWindow() {
  // 尝试读取上次关闭时的窗口位置和大小
  let winState = { width: 1440, height: 900 };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (saved.window) winState = saved.window;
    }
  } catch (e) { /* 第一次启动没有配置文件，忽略 */ }

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: winState.width || 1440,
    height: winState.height || 900,
    x: winState.x,
    y: winState.y,
    minWidth: 960,
    minHeight: 640,
    title: '天命',
    backgroundColor: '#08080c',
    // 桌面端默认沉浸式全屏：去掉 Windows 原生标题栏与右上角窗口按钮
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      // 2026-06-10·preload shim 只在安装包里（热更包只带 _app_preload.js）·热更 main 下 __dirname 指错地方
      preload: path.join(bundledAppRoot(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 2026-05-23·sandbox: false·让 preload shim 能 require 外部文件 (hot dir 的 _app_preload.js / bundled preload-impl.js)
      //   contextIsolation 仍 true·renderer 仍无法访问 preload 全局·安全模型仅 preload 信任域扩大
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      // 2026-05-23·把 hot _app_preload.js 路径 (有则) 透传给 preload shim·preload 进程读 process.argv 取
      additionalArguments: (function(){
        var hp = getHotPreloadCandidate();
        return hp ? ['--hot-preload=' + hp] : [];
      })()
    },
    show: false,
    focusable: true,
    icon: path.join(bundledAppRoot(), 'web', 'icon.png'),
  });

  // 加载游戏网页：热更新启用时优先加载用户目录中已校验的 web 前端。
  mainWindow.loadFile(path.join(getActiveWebRoot(), 'index.html'));

  // 页面加载完成后再显示窗口（这样不会看到白屏）
  mainWindow.once('ready-to-show', () => {
    mainWindow.setFullScreen(true);
    mainWindow.show();
    // 用户可以手动按 F12 打开开发者工具
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.focus();
  });

  // 窗口关闭前，保存窗口的位置和大小·merge 进 CONFIG_FILE 而不是覆盖 (保 webRootOverride 等字段)
  mainWindow.on('close', () => {
    try {
      const bounds = mainWindow.getBounds();
      const prev = readJsonSafe(CONFIG_FILE, {});
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(Object.assign({}, prev, { window: bounds }), null, 2), 'utf-8');
    } catch (e) { /* 忽略 */ }
  });

  // 设置菜单栏
  createMenu();
}

// ============================================================
//  菜单栏
// ============================================================
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入项目...',
          accelerator: 'CmdOrCtrl+O',    // 快捷键 Ctrl+O
          click: () => handleMenuImport()
        },
        {
          label: '导出项目...',
          accelerator: 'CmdOrCtrl+S',    // 快捷键 Ctrl+S
          click: () => mainWindow.webContents.send('menu-action', 'export-project')
        },
        { type: 'separator' },   // 分隔线
        {
          label: '打开存档目录',
          click: () => { ensureSaveDir(); shell.openPath(SAVE_DIR); }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '创作者模式',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.send('menu-action', 'mode-editor')
        },
        {
          label: '玩家模式',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.send('menu-action', 'mode-game')
        },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: '开发·选 web 目录覆盖...',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: '选择含 index.html 的 web 目录·覆盖 bundled web (重启后生效)',
              properties: ['openDirectory']
            });
            if (result.canceled || !result.filePaths || !result.filePaths[0]) return;
            const picked = path.resolve(result.filePaths[0]);
            if (!_isValidWebRoot(picked)) {
              dialog.showMessageBox(mainWindow, {
                type: 'error', title: '路径无效',
                message: '所选目录中没有 index.html',
                detail: picked
              });
              return;
            }
            try {
              const prev = readJsonSafe(CONFIG_FILE, {});
              fs.writeFileSync(CONFIG_FILE, JSON.stringify(
                Object.assign({}, prev, { webRootOverride: picked }), null, 2), 'utf-8');
              const choice = await dialog.showMessageBox(mainWindow, {
                type: 'info', title: 'dev web override 已保存',
                message: '已保存·' + picked,
                detail: '需要重新加载窗口才生效。是否立即 reload?',
                buttons: ['立即 Reload', '稍后'], defaultId: 0, cancelId: 1
              });
              if (choice.response === 0) {
                await mainWindow.loadFile(path.join(getActiveWebRoot(), 'index.html'));
              }
            } catch (e) {
              dialog.showMessageBox(mainWindow, { type: 'error', title: '保存失败', message: String(e && e.message || e) });
            }
          }
        },
        {
          label: '开发·清除 web 目录覆盖',
          click: async () => {
            try {
              const prev = readJsonSafe(CONFIG_FILE, {});
              if (!prev.webRootOverride) {
                dialog.showMessageBox(mainWindow, { type: 'info', title: '无覆盖', message: '当前没有设置 web 目录覆盖' });
                return;
              }
              delete prev.webRootOverride;
              fs.writeFileSync(CONFIG_FILE, JSON.stringify(prev, null, 2), 'utf-8');
              const choice = await dialog.showMessageBox(mainWindow, {
                type: 'info', title: '已清除',
                message: '已清除 web 目录覆盖·回到 bundled web',
                detail: '是否立即 reload?',
                buttons: ['立即 Reload', '稍后'], defaultId: 0, cancelId: 1
              });
              if (choice.response === 0) {
                await mainWindow.loadFile(path.join(getActiveWebRoot(), 'index.html'));
              }
            } catch (e) {
              dialog.showMessageBox(mainWindow, { type: 'error', title: '清除失败', message: String(e && e.message || e) });
            }
          }
        },
        {
          label: '开发·显示当前 web root',
          click: () => {
            const override = getWebRootOverride();
            const cfg = readJsonSafe(CONFIG_FILE, {});
            dialog.showMessageBox(mainWindow, {
              type: 'info', title: 'web root 当前状态',
              message: '正在加载的 web root',
              detail: '当前·' + getActiveWebRoot()
                    + '\n\nbundled web·' + path.join(bundledAppRoot(), 'web')
                    + '\nenv TIANMING_WEB_OVERRIDE·' + (process.env.TIANMING_WEB_OVERRIDE || '(未设)')
                    + '\nconfig webRootOverride·' + (cfg.webRootOverride || '(未设)')
                    + '\nhot update active·' + (getActiveHotUpdate().active ? '是 (v' + getActiveHotUpdate().version + ')' : '否')
                    + '\n\n生效 override·' + (override ? override.source + ' = ' + override.path : '(无·走 bundled)')
            });
          }
        },
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于天命',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于天命',
              message: '天命 · AI历史模拟推演 v1.0.0',
              detail: '一款 AI 驱动的历史模拟推演游戏。\n支持自定义剧本、角色、规则、地图。'
            });
          }
        },
        {
          label: '打开存档目录',
          click: () => { ensureSaveDir(); shell.openPath(SAVE_DIR); }
        },
        {
          label: '打开日志目录',
          click: () => { try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {} shell.openPath(LOG_DIR); }
        }
      ]
    }
  ];

  // 隐藏菜单栏但保留快捷键（菜单功能通过快捷键访问）
  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  mainWindow.setMenuBarVisibility(false);
}

// 从菜单触发导入
async function handleMenuImport() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入天命项目',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      mainWindow.webContents.send('import-project-data', data);
    } catch (e) {
      dialog.showErrorBox('导入失败', e.message);
    }
  }
}

// ============================================================
//  IPC：响应网页发来的请求
//  网页通过 preload.js 桥接调用这些函数
// ============================================================

// --- 存档：保存 ---
ipcMain.handle('save-project', async (event, { filename, data }) => {
  try {
    ensureSaveDir();
    const filepath = path.join(SAVE_DIR, sanitize(filename) + '.json');
    // 2026-06-10·紧凑写盘:同 auto-save·缩进占体积 55%·手动存档同步砍半
    fs.writeFileSync(filepath, JSON.stringify(data), 'utf-8');
    return { success: true, path: filepath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- 存档：读取 ---
ipcMain.handle('load-project', async (event, filename) => {
  try {
    const filepath = path.join(SAVE_DIR, sanitize(filename) + '.json');
    if (!fs.existsSync(filepath)) return { success: false, error: '文件不存在' };
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- 存档：列出所有存档 ---
ipcMain.handle('list-saves', async () => {
  try {
    ensureSaveDir();
    const files = fs.readdirSync(SAVE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fp = path.join(SAVE_DIR, f);
        const stats = fs.statSync(fp);
        let _saveMeta = null;
        try {
          const raw = fs.readFileSync(fp, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed._saveMeta) _saveMeta = parsed._saveMeta;
        } catch (e) {}
        return {
          name: f.replace('.json', ''),
          size: stats.size,
          modified: stats.mtimeMs,
          modifiedStr: new Date(stats.mtimeMs).toLocaleString('zh-CN'),
          _saveMeta
        };
      })
      .sort((a, b) => b.modified - a.modified);
    return { success: true, files };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- 存档：删除 ---
ipcMain.handle('delete-save', async (event, filename) => {
  try {
    const filepath = path.join(SAVE_DIR, sanitize(filename) + '.json');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- 自动存档 ---·2026-05-22 C1 fix·
// 老版 fs.writeFileSync 同步阻塞主进程·MB 级 JSON 在 Win 上 1-3 秒·IPC 回包前 renderer await 卡住
// 新版·async fs.promises.writeFile 到 .tmp + rename·atomic·不阻塞·失败半写不污染最终文件
const AUTO_SAVE_FILE = path.join(SAVE_DIR, '__autosave__.json');
const AUTO_SAVE_SESSION_FILE = path.join(SAVE_DIR, '__autosave__.session');
let autoSaveSessionToken = '';
let autoSaveSessionLoaded = false;

function normalizeAutoSaveSessionToken(token) {
  token = String(token || '').trim();
  return token.length >= 16 && token.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(token) ? token : '';
}

function getAutoSaveSessionToken() {
  if (autoSaveSessionLoaded) return autoSaveSessionToken;
  autoSaveSessionLoaded = true;
  try {
    autoSaveSessionToken = normalizeAutoSaveSessionToken(fs.readFileSync(AUTO_SAVE_SESSION_FILE, 'utf-8'));
  } catch (_) { autoSaveSessionToken = ''; }
  return autoSaveSessionToken;
}

function persistAutoSaveSessionToken(token) {
  token = normalizeAutoSaveSessionToken(token);
  if (!token) throw new Error('自动存档 session token 非法');
  ensureSaveDir();
  const tmp = AUTO_SAVE_SESSION_FILE + '.tmp';
  fs.writeFileSync(tmp, token, 'utf-8');
  fs.renameSync(tmp, AUTO_SAVE_SESSION_FILE);
  autoSaveSessionToken = token;
  autoSaveSessionLoaded = true;
  return token;
}

function autoSaveSessionMatches(token) {
  token = normalizeAutoSaveSessionToken(token);
  return !!token && token === getAutoSaveSessionToken();
}

ipcMain.on('auto-save-session-current', (event) => {
  event.returnValue = { success: true, token: getAutoSaveSessionToken() };
});

ipcMain.on('auto-save-session-rotate', (event, requestedToken) => {
  try {
    event.returnValue = { success: true, token: persistAutoSaveSessionToken(requestedToken) };
  } catch (e) {
    event.returnValue = { success: false, error: e.message };
  }
});

let autoSaveWriteQueue = Promise.resolve();
ipcMain.handle('auto-save', (event, payload) => {
  const wrapped = !!(payload && payload.__tmAutoSaveEnvelope === 1);
  const data = wrapped ? payload.data : payload;
  let requestToken = normalizeAutoSaveSessionToken(wrapped ? payload.sessionToken : (data && data._tmAutoSaveSessionToken));
  // 所有 renderer 调用共享同一 .tmp；主进程串行化才可保证 write+rename 这一对不互踩。
  const task = autoSaveWriteQueue.then(async () => {
    try {
      ensureSaveDir();
      let currentToken = getAutoSaveSessionToken();
      // 新桥第一次运行且尚无 sidecar 时，由主进程创建 token 并随回包同步给 preload。
      if (wrapped && !requestToken && !currentToken) {
        requestToken = persistAutoSaveSessionToken(crypto.randomUUID());
        currentToken = requestToken;
      } else if (wrapped && !requestToken && currentToken) {
        requestToken = currentToken;
      } else if (requestToken && !currentToken) {
        currentToken = persistAutoSaveSessionToken(requestToken);
      }
      // 一旦启用 session 契约，旧桥/旧局的无 token 请求与已失效 token 一律不得覆盖 canonical 文件。
      if (currentToken && !autoSaveSessionMatches(requestToken)) {
        return { success: false, stale: true, error: '自动存档请求已跨档失效', sessionToken: currentToken };
      }
      const tmpFile = AUTO_SAVE_FILE + '.tmp';
      const diskPayload = requestToken
        ? { __tmAutoSaveEnvelope: 1, sessionToken: requestToken, data: data }
        : data;
      // 2026-06-10·紧凑写盘:pretty-print 缩进占存档体积 55%(实测 113MB→48MB)·机器读写无人看·JSON.parse 两者通吃
      await fs.promises.writeFile(tmpFile, JSON.stringify(diskPayload), 'utf-8');
      // writeFile 在途可跨越 renderer 的同步 rotate；rename 前必须按 sidecar 再验。
      if (requestToken && !autoSaveSessionMatches(requestToken)) {
        try { await fs.promises.unlink(tmpFile); } catch (_) {}
        return { success: false, stale: true, error: '自动存档写入期间已跨档失效', sessionToken: getAutoSaveSessionToken() };
      }
      await fs.promises.rename(tmpFile, AUTO_SAVE_FILE);
      // rotate 可与原子 rename 的系统调用并行完成；即使旧 envelope 已落下，sidecar 不匹配也使其不可恢复。
      if (requestToken && !autoSaveSessionMatches(requestToken)) {
        return { success: false, stale: true, error: '自动存档提交期间已跨档失效', sessionToken: getAutoSaveSessionToken() };
      }
      return { success: true, sessionToken: requestToken || '' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  autoSaveWriteQueue = task.then(() => undefined, () => undefined);
  return task;
});

ipcMain.handle('load-auto-save', async () => {
  try {
    if (!fs.existsSync(AUTO_SAVE_FILE)) return { success: false };
    const parsed = JSON.parse(fs.readFileSync(AUTO_SAVE_FILE, 'utf-8'));
    if (parsed && parsed.__tmAutoSaveEnvelope === 1) {
      const fileToken = normalizeAutoSaveSessionToken(parsed.sessionToken);
      let currentToken = getAutoSaveSessionToken();
      // 兼容 sidecar 丢失但 canonical envelope 完整的安装：以文件 token 自愈 sidecar。
      if (!currentToken && fileToken) currentToken = persistAutoSaveSessionToken(fileToken);
      if (!fileToken || fileToken !== currentToken) {
        return { success: false, stale: true, error: '自动存档属于已失效的旧局' };
      }
      return { success: true, data: parsed.data, sessionToken: fileToken };
    }
    // 首次升级前的无 envelope 旧档仅在 sidecar 尚不存在时兼容读取。
    if (getAutoSaveSessionToken()) return { success: false, stale: true, error: '旧自动存档已被新局失效' };
    return { success: true, data: parsed, sessionToken: '' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- 系统对话框：导出 ---
// 2026-07-10 扩第三参 opts { filename, title }（剧本工坊导出用·治「导出无法选文件夹」）·旧两参调用不受影响
ipcMain.handle('dialog-export', async (event, data, opts) => {
  const o = opts || {};
  const result = await dialog.showSaveDialog(mainWindow, {
    title: String(o.title || '导出天命项目'),
    defaultPath: String(o.filename || '天命项目.json'),
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, canceled: true };
});

// --- 系统对话框：导入 ---
ipcMain.handle('dialog-import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入天命项目',
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      return { success: true, data, path: result.filePaths[0] };
    } catch (e) {
      return { success: false, error: '文件解析失败: ' + e.message };
    }
  }
  return { success: false, canceled: true };
});

// --- 系统对话框：选择地图图片 ---
ipcMain.handle('dialog-load-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择地图图片',
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
    ],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const buffer = fs.readFileSync(result.filePaths[0]);
      const ext = path.extname(result.filePaths[0]).toLowerCase().replace('.', '');
      const mimeMap = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', bmp:'image/bmp' };
      const dataUrl = `data:${mimeMap[ext]||'image/png'};base64,${buffer.toString('base64')}`;
      return { success: true, dataUrl };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, canceled: true };
});

// --- 系统对话框：选择 GeoJSON ---
ipcMain.handle('dialog-load-geojson', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入 GeoJSON 地图数据',
    filters: [{ name: 'GeoJSON', extensions: ['json', 'geojson'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, data: JSON.parse(raw) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, canceled: true };
});

// --- 打开存档目录 ---
ipcMain.handle('open-save-dir', () => {
  ensureSaveDir();
  shell.openPath(SAVE_DIR);
});

// --- 退出应用 ---
ipcMain.handle('app-quit', () => {
  app.quit();
});

// ============================================================
//  窗口显示模式：全屏 / 窗口 切换（设置·界面显示）
//  注：窗口为无边框（frame:false），窗口模式给一个居中的合理尺寸，
//      玩家可拖动边缘缩放、用应用内「退出」按钮关闭，或切回全屏。
// ============================================================
ipcMain.handle('set-fullscreen', (event, flag) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const want = !!flag;
    mainWindow.setFullScreen(want);
    if (!want) {
      try {
        const { screen } = require('electron');
        const wa = screen.getPrimaryDisplay().workAreaSize;
        const w = Math.min(1600, Math.round(wa.width * 0.86));
        const h = Math.min(1000, Math.round(wa.height * 0.86));
        mainWindow.setResizable(true);
        mainWindow.setSize(w, h);
        mainWindow.center();
      } catch (_) {}
    }
    return mainWindow.isFullScreen();
  } catch (_) {
    return false;
  }
});
ipcMain.handle('get-fullscreen', () => {
  try {
    return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen());
  } catch (_) {
    return false;
  }
});

// ============================================================
//  剧本 (scenarios) IPC
// ============================================================

// 列出所有剧本
ipcMain.handle('list-scenarios', async () => {
  try {
    ensureSaveDir();
    const seen = new Set();
    const files = [];
    if (isDirectorySafe(SCENARIOS_DIR)) {
      fs.readdirSync(SCENARIOS_DIR)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
          seen.add(f);
          files.push(scenarioListItem(path.join(SCENARIOS_DIR, f), f, 'user'));
        });
    }
    // 2026-05-22·热更 bundled-scenarios 优先于原生 bundled·与 resolveScenarioPath 一致
    const hotBundledDir = getActiveBundledScenariosDir();
    OFFICIAL_SCENARIO_FILES.forEach(f => {
      if (seen.has(f)) return;
      if (hotBundledDir) {
        const hotFp = path.join(hotBundledDir, f);
        if (fs.existsSync(hotFp)) {
          files.push(scenarioListItem(hotFp, f, 'official'));
          return;
        }
      }
      const fp = path.join(BUNDLED_SCENARIOS_DIR, f);
      if (fs.existsSync(fp)) files.push(scenarioListItem(fp, f, 'official'));
    });
    files.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'official' ? -1 : 1;
      return b.modified - a.modified;
    });
    return { success: true, files };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 保存剧本
ipcMain.handle('save-scenario', async (event, { filename, data }) => {
  try {
    ensureSaveDir();
    const filepath = path.join(SCENARIOS_DIR, scenarioFileName(filename));
    writeJson(filepath, data);
    return { success: true, path: filepath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 读取剧本
ipcMain.handle('load-scenario', async (event, filename) => {
  try {
    const resolved = resolveScenarioPath(filename);
    if (!resolved.path) return { success: false, error: 'Scenario file not found' };
    const data = JSON.parse(fs.readFileSync(resolved.path, 'utf-8'));
    return { success: true, data, source: resolved.source, path: resolved.path };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 删除剧本
ipcMain.handle('delete-scenario', async (event, filename) => {
  try {
    const filepath = path.join(SCENARIOS_DIR, scenarioFileName(filename));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    else {
      const resolved = resolveScenarioPath(filename);
      if (resolved.source === 'official') return { success: false, error: 'Official scenarios are bundled read-only content.' };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 打开剧本目录
ipcMain.handle('open-scenarios-dir', () => {
  ensureSaveDir();
  shell.openPath(SCENARIOS_DIR);
});

// ============================================================
//  每回合数据 (turn-data) IPC
// ============================================================

// 写入一回合的数据  { saveName, turn, data }
// data 结构：{ context, playerInput, aiResults, varChanges, scenario (仅首回合) }
ipcMain.handle('write-turn-data', async (event, { saveName, turn, data }) => {
  try {
    ensureSaveDir();
    const saveRoot = path.join(TURN_DATA_DIR, sanitize(saveName));
    const turnDir = path.join(saveRoot, turnSeg(turn));
    fs.mkdirSync(turnDir, { recursive: true });

    // 1. 主上下文文件（兼容旧格式：如果data没有子结构，直接写入）
    if (data.context) {
      fs.writeFileSync(path.join(turnDir, 'context.json'), JSON.stringify(data.context, null, 2), 'utf-8');
    } else {
      // 兼容旧调用方式
      fs.writeFileSync(path.join(turnDir, 'context.json'), JSON.stringify(data, null, 2), 'utf-8');
    }

    // 2. 玩家操作记录
    if (data.playerInput) {
      fs.writeFileSync(path.join(turnDir, 'player-input.json'), JSON.stringify(data.playerInput, null, 2), 'utf-8');
    }

    // 3. AI推演全部结果（各Sub-call的原始返回值）
    if (data.aiResults) {
      fs.writeFileSync(path.join(turnDir, 'ai-results.json'), JSON.stringify(data.aiResults, null, 2), 'utf-8');
    }

    // 4. 变量资源变化文件
    if (data.varChanges) {
      fs.writeFileSync(path.join(turnDir, 'var-changes.json'), JSON.stringify(data.varChanges, null, 2), 'utf-8');
    }

    // 5. 剧本快照（仅首回合或指定时保存）
    if (data.scenario) {
      const scenarioFile = path.join(saveRoot, 'scenario.json');
      if (!fs.existsSync(scenarioFile)) {
        fs.writeFileSync(scenarioFile, JSON.stringify(data.scenario, null, 2), 'utf-8');
      }
    }

    // 6. 严格史实模式的参考文件
    if (data.refText) {
      const refFile = path.join(saveRoot, 'reference.txt');
      if (!fs.existsSync(refFile)) {
        fs.writeFileSync(refFile, data.refText, 'utf-8');
      }
    }

    return { success: true, path: turnDir };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 读取某存档某回合数据（返回该回合目录下所有文件）
ipcMain.handle('read-turn-data', async (event, { saveName, turn }) => {
  try {
    const turnDir = path.join(TURN_DATA_DIR, sanitize(saveName), turnSeg(turn));
    if (!fs.existsSync(turnDir)) return { success: false, error: '数据不存在' };
    const result = {};
    const files = fs.readdirSync(turnDir).filter(f => f.endsWith('.json'));
    files.forEach(f => {
      try {
        const key = f.replace('.json', '');
        result[key] = JSON.parse(fs.readFileSync(path.join(turnDir, f), 'utf-8'));
      } catch (e) { /* skip corrupt files */ }
    });
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 批量读取多回合数据摘要（供AI打包推演用）
ipcMain.handle('read-turns-summary', async (event, { saveName, fromTurn, toTurn }) => {
  try {
    const saveDir = path.join(TURN_DATA_DIR, sanitize(saveName));
    if (!fs.existsSync(saveDir)) return { success: true, turns: [] };
    const turns = [];
    let _from = Math.floor(Number(fromTurn)), _to = Math.floor(Number(toTurn));
    if (!Number.isFinite(_from) || !Number.isFinite(_to)) return { success: true, turns: [] };
    // 2026-07-09·加固：钳安全整数域 + 回合上限 + 跨度封顶
    //   防 (a) toTurn≫fromTurn 十亿级循环冻结主进程·(b) ≥2^53 时 t++ 自增停滞死循环·
    //   (c) 负 fromTurn 经 turnSeg 别名读错回合。上限 1e7 远超任何真实对局。
    if (!Number.isSafeInteger(_from) || !Number.isSafeInteger(_to)) return { success: true, turns: [] };
    if (_from < 0) _from = 0;
    if (_to < _from) return { success: true, turns: [] };
    _from = Math.min(_from, 10000000);
    _to   = Math.min(_to, _from + 20000, 10000000);
    if (_to < _from) return { success: true, turns: [] };
    for (let t = _from; t <= _to; t++) {
      const contextFile = path.join(saveDir, turnSeg(t), 'context.json');
      if (fs.existsSync(contextFile)) {
        try {
          const ctx = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
          // 只提取摘要级别的数据（控制大小）
          turns.push({
            turn: t,
            time: ctx.time || '',
            shizhengji: (ctx.shizhengji || '').substring(0, 150),
            playerStatus: ctx.playerStatus || '',
            playerInner: ctx.playerInner || ''
          });
        } catch (e) { /* skip */ }
      }
    }
    return { success: true, turns };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 列出某存档的所有回合
ipcMain.handle('list-turn-data', async (event, saveName) => {
  try {
    const saveDir = path.join(TURN_DATA_DIR, sanitize(saveName));
    if (!fs.existsSync(saveDir)) return { success: true, turns: [] };
    const turns = fs.readdirSync(saveDir)
      .filter(d => /^\d+$/.test(d))
      .map(d => parseInt(d))
      .sort((a, b) => a - b);
    return { success: true, turns };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 打开回合数据目录
ipcMain.handle('open-turn-data-dir', () => {
  ensureSaveDir();
  shell.openPath(TURN_DATA_DIR);
});

// --- 调试日志 ---
ipcMain.handle('debug-log', (event, entries) => {
  try {
    (Array.isArray(entries) ? entries : [entries]).forEach(function (e) {
      if (!e) return;
      appendDebugLog(e.level || 'log', e.source || 'web', String(e.message == null ? '' : e.message));
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-log-dir', () => {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (_) {}
  shell.openPath(LOG_DIR);
  return { success: true, dir: LOG_DIR };
});

ipcMain.handle('debug-log-info', () => ({ success: true, dir: LOG_DIR, file: _logFilePath }));

// --- 获取应用信息 ---
// ============================================================
//  在线更新 IPC
// ============================================================

ipcMain.handle('update-check', async (event, options = {}) => {
  try {
    const feedUrl = String(options.feedUrl || options.url || getDefaultUpdateFeedUrl() || '').trim();
    if (!feedUrl) return { success: false, error: '请先填写更新源地址（latest.yml 所在目录）。' };
    const parsed = new URL(feedUrl);
    const isLocalHttp = parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocalHttp) {
      return { success: false, error: '更新源必须使用 HTTPS；本机调试允许 localhost HTTP。' };
    }
    ensureSaveDir();
    lastUpdateInfo = null;
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
    const result = await autoUpdater.checkForUpdates();
    const info = (result && result.updateInfo) || lastUpdateInfo;
    const currentVersion = getCurrentComparableVersion();
    if (!info || !info.version) return { success: true, hasUpdate: false, currentVersion };
    if (!isStrictUpgrade(info.version)) {
      lastUpdateInfo = null;
      return { success: true, hasUpdate: false, blockedDowngrade: true, currentVersion, remoteVersion: info.version, message: '远端版本不高于当前版本，已拒绝下载。' };
    }
    lastUpdateInfo = info;
    return { success: true, hasUpdate: true, currentVersion, remoteVersion: info.version, size: updateInfoSize(info), info };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-download', async () => {
  try {
    if (!lastUpdateInfo || !isStrictUpgrade(lastUpdateInfo.version)) return { success: false, error: '没有可下载的高版本更新。' };
    const files = await autoUpdater.downloadUpdate();
    return { success: true, files, info: lastUpdateInfo, size: updateInfoSize(lastUpdateInfo) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-install', async () => {
  try {
    if (!lastUpdateInfo || !isStrictUpgrade(lastUpdateInfo.version)) return { success: false, error: '没有可安装的高版本更新。' };
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ============================================================
//  热更新 IPC（仅更新 renderer/web 资源；主进程和 preload 仍走安装包）
// ============================================================

ipcMain.handle('hot-update-status', async () => {
  try {
    ensureSaveDir();
    return { success: true, status: getHotUpdatePublicStatus() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('hot-update-check', async (event, options = {}) => {
  try {
    ensureSaveDir();
    const feedInfo = await readHotUpdateFeed(options);
    const currentVersion = getEffectiveRendererVersion();
    const hasUpdate = isStrictRendererUpgrade(feedInfo.version);
    // 2026-06-11·本体版本门·feed.minAppVersion > 当前安装包版本 → 须先升本体（needsInstaller）
    const needsInstaller = !!(feedInfo.minAppVersion
      && compareVersions(getCurrentComparableVersion(), feedInfo.minAppVersion) < 0);
    // 2026-06-10·把 feed flags 持久化进状态（变了才写）·崩溃环自禁等离线路径读 lastFeedFlags
    try {
      const prevFlags = JSON.stringify(getHotUpdateState().lastFeedFlags || {});
      const nextFlags = JSON.stringify(feedInfo.flags || {});
      if (prevFlags !== nextFlags) writeHotUpdateState({ lastFeedFlags: feedInfo.flags || {} });
    } catch (_) {}
    return {
      success: true,
      hasUpdate,
      blockedDowngrade: !hasUpdate,
      currentVersion,
      remoteVersion: feedInfo.version,
      feedUrl: feedInfo.feedUrl,
      packageUrl: feedInfo.packageUrl,
      size: feedInfo.size,
      notes: feedInfo.notes,
      flags: feedInfo.flags || {},
      minAppVersion: feedInfo.minAppVersion || '',
      baseVersion: getCurrentComparableVersion(),
      needsInstaller,
      status: getHotUpdatePublicStatus(),
      message: hasUpdate
        ? (needsInstaller ? '发现新版本，但需要先更新本体安装包。' : '发现可用热更新。')
        : '远端热更新版本不高于当前前端版本。'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('hot-update-download-install', async (event, options = {}) => {
  try {
    ensureSaveDir();
    return await installHotUpdateFromFeed(options);
  } catch (e) {
    sendHotUpdateStatus('error', { error: e.message });
    return { success: false, error: e.message, status: getHotUpdatePublicStatus() };
  }
});

ipcMain.handle('hot-update-set-enabled', async (event, enabled) => {
  try {
    ensureSaveDir();
    writeHotUpdateState({ enabled: !!enabled });
    return { success: true, status: getHotUpdatePublicStatus() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('hot-update-rollback', async () => {
  try {
    ensureSaveDir();
    const state = getHotUpdateState();
    const prevDir = state.previousDir ? path.resolve(state.previousDir) : '';
    if (prevDir && isInsideDir(HOT_UPDATE_VERSIONS_DIR, prevDir) && fs.existsSync(path.join(prevDir, 'index.html'))) {
      writeHotUpdateState({
        enabled: true,
        currentVersion: state.previousVersion || path.basename(prevDir),
        currentDir: prevDir,
        previousVersion: state.currentVersion || '',
        previousDir: state.currentDir || '',
        rolledBackAt: new Date().toISOString()
      });
      return { success: true, status: getHotUpdatePublicStatus(), message: '已回滚到上一个热更版本。' };
    }
    writeHotUpdateState({
      enabled: false,
      previousVersion: state.currentVersion || '',
      previousDir: state.currentDir || '',
      rolledBackAt: new Date().toISOString()
    });
    return { success: true, status: getHotUpdatePublicStatus(), message: '没有可回滚热更版本，已暂停热更新并回到安装包内置前端。' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('hot-update-reload', async () => {
  // 2026-05-23·B1 修·main + preload 也热更后·loadFile 只重 renderer·main/preload 不换 (module cache 锁死)
  //   必须完整重启 app·main shim 重新 detect hot _app_main / _app_preload·三层都新
  //   游戏 state 全在 disk (saves / localStorage / IndexedDB)·重启安全·user 看 app 闪一下
  try {
    setTimeout(() => {  // 让 IPC return 先发回去·renderer 拿到 ack 再被关
      try { app.relaunch(); app.exit(0); }
      catch (e) { console.warn('[hot-update-reload] relaunch failed:', e && e.message || e); }
    }, 100);
    return { success: true, status: getHotUpdatePublicStatus(), relaunch: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('hot-update-open-dir', async () => {
  try {
    ensureSaveDir();
    await shell.openPath(HOT_UPDATE_DIR);
    return { success: true, path: HOT_UPDATE_DIR };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ============================================================
//  在线服务 IPC（游戏内联网入口；失败不影响离线游玩）
// ============================================================

ipcMain.handle('online-service-status', async (event, options = {}) => {
  try {
    const res = await readOnlineServiceStatus(options);
    return { success: true, apiUrl: res.apiUrl, health: res.health };
  } catch (e) {
    return { success: false, error: e.message, apiUrl: getOnlineApiUrl(options) || DEFAULT_ONLINE_API_URL };
  }
});

ipcMain.handle('account-session', async () => ({ success: true, session: readAccountSession() }));

ipcMain.handle('account-register', async (event, options = {}) => {
  try {
    const payload = {
      username: String(options.username || '').trim(),
      password: String(options.password || ''),
      nickname: String(options.nickname || '').trim()
    };
    const res = await postOnlineApi('account/register', payload, { apiUrl: options.apiUrl });
    if (res && res.success && res.token) {
      writeAccountSession({ token: res.token, apiUrl: getAccountApiUrl(options), user: res.user || null });
    }
    return Object.assign({ success: false }, res || {});
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('account-login', async (event, options = {}) => {
  try {
    const payload = {
      username: String(options.username || '').trim(),
      password: String(options.password || '')
    };
    const res = await postOnlineApi('account/login', payload, { apiUrl: options.apiUrl });
    if (res && res.success && res.token) {
      writeAccountSession({ token: res.token, apiUrl: getAccountApiUrl(options), user: res.user || null });
    }
    return Object.assign({ success: false }, res || {});
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('account-me', async (event, options = {}) => {
  try {
    const session = readAccountSession();
    if (!session.token) return { success: true, loggedIn: false, session };
    const res = await getOnlineApi('account/me', { apiUrl: options.apiUrl || session.apiUrl, token: session.token });
    if (res && res.success && res.user) writeAccountSession({ token: session.token, apiUrl: options.apiUrl || session.apiUrl, user: res.user });
    return Object.assign({ loggedIn: !!(res && res.user), session: readAccountSession() }, res || {});
  } catch (e) {
    return { success: false, error: e.message, session: readAccountSession() };
  }
});

ipcMain.handle('account-logout', async (event, options = {}) => {
  try {
    const session = readAccountSession();
    if (session.token) {
      try { await postOnlineApi('account/logout', {}, { apiUrl: options.apiUrl || session.apiUrl, token: session.token }); } catch (e) {}
    }
    clearAccountSession();
    return { success: true };
  } catch (e) {
    clearAccountSession();
    return { success: true, warning: e.message };
  }
});

// ============================================================
//  创意工坊 / 内容包 IPC
// ============================================================

function listWorkshopPacksInternal() {
  ensureSaveDir();
  const idx = readWorkshopIndex();
  return idx.packs.map(item => {
    const installPath = path.join(WORKSHOP_PACKS_DIR, normalizePackId(item.id));
    return Object.assign({}, item, { enabled: item.enabled !== false, installed: fs.existsSync(installPath), path: installPath });
  });
}

function installWorkshopPackFromDir(sourceDir, options = {}) {
  const pack = validateWorkshopPack(sourceDir);
  const target = path.join(WORKSHOP_PACKS_DIR, pack.id);
  if (fs.existsSync(target) && !options.overwrite) {
    return { success: false, error: '已存在同 ID 工坊包：' + pack.id, exists: true, pack: packPublicInfo(pack, target, true) };
  }
  if (fs.existsSync(target)) safeRmDir(target, WORKSHOP_PACKS_DIR);
  copyDirRecursive(sourceDir, target);
  const installed = validateWorkshopPack(target);
  const idx = readWorkshopIndex();
  idx.packs = idx.packs.filter(item => normalizePackId(item.id) !== installed.id);
  idx.packs.push(Object.assign(packPublicInfo(installed, target, true), {
    installedAt: new Date().toISOString(),
    source: options.source || ''
  }));
  writeWorkshopIndex(idx);
  return { success: true, pack: packPublicInfo(installed, target, true) };
}

async function readWorkshopCatalog(options = {}) {
  const catalogUrl = resolveRemoteUrl(String(options.catalogUrl || options.url || DEFAULT_WORKSHOP_CATALOG_URL || '').trim());
  const catalog = await fetchJsonRemote(catalogUrl, 4 * 1024 * 1024);
  if (catalog.type && catalog.type !== 'tianming-workshop-catalog') throw new Error('workshop catalog type mismatch');
  const packs = Array.isArray(catalog.packs) ? catalog.packs : [];
  return {
    catalogUrl,
    title: String(catalog.title || '天命创意工坊'),
    updatedAt: catalog.updatedAt || '',
    packs: packs.map(item => {
      const packageRef = item.packageUrl || item.url || item.file || item.pack;
      return {
        id: normalizePackId(item.id || item.name || item.title || packageRef),
        title: String(item.title || item.name || item.id || '未命名工坊包'),
        version: String(item.version || '1.0.0'),
        author: String(item.author || ''),
        description: String(item.description || ''),
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 20).map(String) : [],
        type: String(item.type || 'scenario'),
        size: Number(item.size || item.bytes || 0) || 0,
        sha256: String(item.sha256 || item.hash || '').toLowerCase(),
        packageUrl: packageRef ? resolveRemoteUrl(String(packageRef), catalogUrl) : ''
      };
    }).filter(item => item.packageUrl)
  };
}

ipcMain.handle('content-status', async () => {
  ensureSaveDir();
  return {
    success: true,
    appVersion: app.getVersion(),
    buildVersion: getPackageBuildVersion(),
    currentVersion: getCurrentComparableVersion(),
    defaultUpdateFeedUrl: getDefaultUpdateFeedUrl(),
    defaultHotUpdateFeedUrl: DEFAULT_HOT_UPDATE_FEED_URL,
    defaultWorkshopCatalogUrl: DEFAULT_WORKSHOP_CATALOG_URL,
    defaultOnlineApiUrl: DEFAULT_ONLINE_API_URL,
    hotUpdate: getHotUpdatePublicStatus(),
    account: readAccountSession(),
    dirs: { saveDir: SAVE_DIR, scenariosDir: SCENARIOS_DIR, bundledScenariosDir: BUNDLED_SCENARIOS_DIR, turnDataDir: TURN_DATA_DIR, updateDir: UPDATE_DIR, officialContentDir: OFFICIAL_CONTENT_DIR, workshopDir: WORKSHOP_DIR, workshopPacksDir: WORKSHOP_PACKS_DIR, hotUpdateDir: HOT_UPDATE_DIR },
    workshopPacks: listWorkshopPacksInternal()
  };
});

ipcMain.handle('workshop-list-packs', async () => ({ success: true, packs: listWorkshopPacksInternal() }));

ipcMain.handle('workshop-catalog', async (event, options = {}) => {
  try {
    ensureSaveDir();
    const catalog = await readWorkshopCatalog(options);
    return { success: true, catalog };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('workshop-install-from-url', async (event, options = {}) => {
  let tempDir = null;
  let zipPath = null;
  try {
    ensureSaveDir();
    const packageUrl = resolveRemoteUrl(String(options.packageUrl || options.url || '').trim());
    if (!packageUrl) return { success: false, error: '缺少工坊包下载地址。' };
    zipPath = path.join(WORKSHOP_DIR, 'downloads', 'tianming-workshop-' + Date.now() + '.tm-pack');
    const fileInfo = await downloadRemoteFile(packageUrl, zipPath, 250 * 1024 * 1024);
    const expectedHash = String(options.sha256 || options.hash || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expectedHash)) throw new Error('工坊包缺少 sha256 校验值，拒绝安装（请更新工坊目录使其携带 hash）。');
    if (expectedHash !== fileInfo.sha256.toLowerCase()) throw new Error('工坊包 sha256 不一致');
    tempDir = extractZipToTemp(zipPath);
    return installWorkshopPackFromDir(tempDir, { overwrite: !!options.overwrite, source: packageUrl });
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    try { if (zipPath && isInsideDir(WORKSHOP_DIR, zipPath) && fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true }); } catch (e) {}
  }
});

ipcMain.handle('workshop-publish-pack', async (event, options = {}) => {
  try {
    ensureSaveDir();
    const session = readAccountSession();
    if (!session.token) return { success: false, error: '请先登录账号再发布工坊内容。' };
    const payload = {
      id: normalizePackId(options.id || options.title || ''),
      title: String(options.title || '').trim(),
      version: String(options.version || '1.0.0').trim(),
      description: String(options.description || '').trim(),
      type: String(options.type || 'scenario').trim(),
      tags: Array.isArray(options.tags) ? options.tags.slice(0, 20).map(String) : String(options.tags || '').split(/[，,;；\s]+/).filter(Boolean).slice(0, 20),
      packageUrl: String(options.packageUrl || '').trim(),
      sha256: String(options.sha256 || options.hash || '').trim().toLowerCase(),
      size: Number(options.size || 0) || 0
    };
    if (!payload.title) return { success: false, error: '请填写工坊标题。' };
    if (!payload.packageUrl) return { success: false, error: '请填写工坊包下载地址。' };
    payload.packageUrl = resolveRemoteUrl(payload.packageUrl);
    const res = await postOnlineApi('workshop/publish', payload, { apiUrl: session.apiUrl, token: session.token, maxBytes: 4 * 1024 * 1024 });
    return Object.assign({ success: false }, res || {});
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('workshop-open-dir', async () => {
  ensureSaveDir();
  await shell.openPath(WORKSHOP_DIR);
  return { success: true, path: WORKSHOP_DIR };
});

ipcMain.handle('workshop-import-pack', async (event, options = {}) => {
  let tempDir = null;
  try {
    ensureSaveDir();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入天命工坊包',
      filters: [{ name: '天命工坊包 / 剧本', extensions: ['tm-pack', 'zip', 'json'] }, { name: '全部文件', extensions: ['*'] }],
      properties: ['openFile', 'openDirectory']
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    const selected = result.filePaths[0];
    const stat = fs.statSync(selected);
    let sourceDir = selected;
    if (!stat.isDirectory()) {
      const ext = path.extname(selected).toLowerCase();
      if (ext === '.zip' || ext === '.tm-pack') {
        tempDir = extractZipToTemp(selected);
        sourceDir = tempDir;
      } else if (ext === '.json') {
        tempDir = createScenarioPackFromJson(selected);
        sourceDir = tempDir;
      } else {
        return { success: false, error: '不支持的工坊包格式。' };
      }
    }
    const pack = validateWorkshopPack(sourceDir);
    const target = path.join(WORKSHOP_PACKS_DIR, pack.id);
    if (fs.existsSync(target) && !options.overwrite) return { success: false, error: '已存在同 ID 工坊包：' + pack.id, exists: true, pack: packPublicInfo(pack, target, true) };
    if (fs.existsSync(target)) safeRmDir(target, WORKSHOP_PACKS_DIR);
    copyDirRecursive(sourceDir, target);
    const installed = validateWorkshopPack(target);
    const idx = readWorkshopIndex();
    idx.packs = idx.packs.filter(item => normalizePackId(item.id) !== installed.id);
    idx.packs.push(Object.assign(packPublicInfo(installed, target, true), { installedAt: new Date().toISOString() }));
    writeWorkshopIndex(idx);
    return { success: true, pack: packPublicInfo(installed, target, true) };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
});

ipcMain.handle('workshop-set-enabled', async (event, { id, enabled }) => {
  try {
    const packId = normalizePackId(id);
    const idx = readWorkshopIndex();
    const item = idx.packs.find(p => normalizePackId(p.id) === packId);
    if (!item) return { success: false, error: '找不到工坊包：' + packId };
    item.enabled = !!enabled;
    writeWorkshopIndex(idx);
    return { success: true, pack: item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('workshop-uninstall', async (event, id) => {
  try {
    const packId = normalizePackId(id);
    const target = path.join(WORKSHOP_PACKS_DIR, packId);
    if (fs.existsSync(target)) safeRmDir(target, WORKSHOP_PACKS_DIR);
    const idx = readWorkshopIndex();
    idx.packs = idx.packs.filter(item => normalizePackId(item.id) !== packId);
    writeWorkshopIndex(idx);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('workshop-load-enabled-scenarios', async () => {
  try {
    ensureSaveDir();
    const packs = listWorkshopPacksInternal().filter(p => p.enabled !== false && p.installed && p.type === 'scenario');
    const scenarios = [];
    packs.forEach(pack => {
      try {
        const entryPath = path.join(pack.path, pack.entry || 'scenario.json');
        if (!isInsideDir(pack.path, entryPath) || !fs.existsSync(entryPath)) return;
        const data = JSON.parse(fs.readFileSync(entryPath, 'utf-8'));
        scenarios.push({ pack: { id: pack.id, title: pack.title, version: pack.version, author: pack.author, assetBase: 'tm-content://workshop/' + encodeURIComponent(pack.id) + '/' }, data });
      } catch (e) {
        scenarios.push({ pack: { id: pack.id, title: pack.title }, error: e.message });
      }
    });
    return { success: true, scenarios };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  buildVersion: getPackageBuildVersion(),
  defaultUpdateFeedUrl: getDefaultUpdateFeedUrl(),
  saveDir: SAVE_DIR,
  scenariosDir: SCENARIOS_DIR,
  bundledScenariosDir: BUNDLED_SCENARIOS_DIR,
  turnDataDir: TURN_DATA_DIR,
  updateDir: UPDATE_DIR,
  officialContentDir: OFFICIAL_CONTENT_DIR,
  workshopDir: WORKSHOP_DIR,
  logDir: LOG_DIR,
  currentLogFile: _logFilePath,
  hotUpdateDir: HOT_UPDATE_DIR,
  hotUpdate: getHotUpdatePublicStatus(),
  defaultHotUpdateFeedUrl: DEFAULT_HOT_UPDATE_FEED_URL,
  defaultWorkshopCatalogUrl: DEFAULT_WORKSHOP_CATALOG_URL,
  defaultOnlineApiUrl: DEFAULT_ONLINE_API_URL,
  platform: process.platform,
}));

// ============================================================
//  不安全 TLS·中转站证书放行（2026-06-11）
//  ── 背景 ──
//   玩家 BYOK 用的第三方 API 中转站常证书配错（域名与访问地址不匹配 /
//   自签名 / 证书链不全）→ Chromium 网络栈拒绝 → 渲染层 fetch 失败 →
//   「所有有反代的中转站都用不了」。
//  ── 设计（owner 拍板：开关 + 只放行玩家填的 API 地址）──
//   • 默认严格（callback(false)）。仅当玩家在设置里开启开关、且请求 host
//     精确命中玩家配置的中转站 host 时才放行（event.preventDefault + callback(true)）。
//   • 官方域名（热更/账号/工坊）写死永不放行——纵深防御·杜绝 MITM 推恶意热更。
//   • 配置经 IPC set-insecure-tls-config 由渲染层下发·并落盘 CONTENT_DIR·
//     下次启动先读盘（覆盖渲染层尚未下发的启动窗口）。
// ============================================================
const INSECURE_TLS_FILE = path.join(CONTENT_DIR, 'insecure-tls-config.json');
// 官方服务域名永不放行（即便白名单误含也拒绝）
const INSECURE_TLS_OFFICIAL_DENY = ['api.themisfitserspeople.top', 'themisfitserspeople.top'];
let _insecureTlsState = { enabled: false, hosts: [] };

function _insecureTlsHostOf(u) {
  try {
    if (!u) return '';
    var s = String(u).trim();
    if (!s) return '';
    // 已是裸 host（无协议/路径/端口分隔）直接用
    if (s.indexOf('://') < 0 && s.indexOf('/') < 0 && s.indexOf(':') < 0) return s.toLowerCase();
    var parsed = new URL(s.indexOf('://') >= 0 ? s : ('https://' + s));
    return (parsed.hostname || '').toLowerCase();
  } catch (e) { return ''; }
}

function _insecureTlsShouldBypass(url) {
  var st = _insecureTlsState;
  if (!st || !st.enabled || !st.hosts || !st.hosts.length) return false;
  var host = _insecureTlsHostOf(url);
  if (!host) return false;
  if (INSECURE_TLS_OFFICIAL_DENY.indexOf(host) >= 0) return false;  // 官方域名永不放行
  for (var i = 0; i < st.hosts.length; i++) {
    if (host === st.hosts[i]) return true;
  }
  return false;
}

// 启动先读盘·让渲染层尚未下发前的早期请求也按上次配置
try {
  if (fs.existsSync(INSECURE_TLS_FILE)) {
    var _itRaw = JSON.parse(fs.readFileSync(INSECURE_TLS_FILE, 'utf-8'));
    if (_itRaw && typeof _itRaw === 'object') {
      _insecureTlsState = {
        enabled: !!_itRaw.enabled,
        hosts: Array.isArray(_itRaw.hosts) ? _itRaw.hosts.filter(function (h) { return typeof h === 'string' && h; }) : []
      };
    }
  }
} catch (e) { console.warn('[insecure-tls] 读盘失败(忽略)·' + (e && e.message || e)); }

// 渲染层下发：{ enabled:boolean, hosts:string[] }
ipcMain.handle('set-insecure-tls-config', async (event, options = {}) => {
  try {
    var enabled = !!(options && options.enabled);
    var hosts = [];
    if (options && Array.isArray(options.hosts)) {
      options.hosts.forEach(function (h) {
        var hh = _insecureTlsHostOf(h);
        if (hh && INSECURE_TLS_OFFICIAL_DENY.indexOf(hh) < 0 && hosts.indexOf(hh) < 0) hosts.push(hh);
      });
    }
    _insecureTlsState = { enabled: enabled, hosts: hosts };
    try { fs.writeFileSync(INSECURE_TLS_FILE, JSON.stringify(_insecureTlsState), 'utf-8'); } catch (_) {}
    console.log('[insecure-tls] 配置更新·enabled=' + enabled + '·hosts=[' + hosts.join(',') + ']');
    return { success: true, enabled: enabled, hosts: hosts };
  } catch (e) {
    return { success: false, error: e && e.message || String(e) };
  }
});

// 证书校验失败时·仅对玩家显式放行的中转站 host 放行·其余一律严格拒绝
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  try {
    if (_insecureTlsShouldBypass(url)) {
      console.warn('[insecure-tls] 放行证书错误·host=' + _insecureTlsHostOf(url) + '·err=' + error);
      event.preventDefault();
      callback(true);
      return;
    }
  } catch (e) {
    console.warn('[insecure-tls] certificate-error 处理异常·' + (e && e.message || e));
  }
  callback(false);  // 默认严格（官方通道防 MITM）
});

// 更可靠的拦截：Electron 33(network service) 下 certificate-error 对渲染层 fetch 触发不稳，
// setCertificateVerifyProc 在握手期对每个请求生效。放行 host 返回 0(接受)，
// 其余返回 -3(用 Chromium 默认校验结果·保持严格)——绝不返回 0 以免弱化全局。
function _installCertVerifyProc() {
  try {
    var ses = session && session.defaultSession;
    if (!ses || typeof ses.setCertificateVerifyProc !== 'function') return;
    ses.setCertificateVerifyProc(function (request, callback) {
      try {
        if (_insecureTlsShouldBypass(request && request.hostname)) { callback(0); return; }
      } catch (e) { /* 落到默认严格 */ }
      callback(-3);  // -3 = 用 Chromium 默认验证结果（严格）
    });
  } catch (e) {
    console.warn('[insecure-tls] setCertificateVerifyProc 安装失败(忽略)·' + (e && e.message || e));
  }
}

// ============================================================
//  应用生命周期
// ============================================================

// 应用准备好后创建窗口
app.whenReady().then(() => {
  // 2026-06-11·中转站证书放行·握手期拦截器（defaultSession 在 ready 后可用）
  try { _installCertVerifyProc(); } catch (_) {}
  // 2026-06-10·热更自愈三连·修状态 → 崩溃环检测 → 建窗·磁盘清理延后 15s 不占启动关键路径
  try { repairHotUpdateState(); } catch (_) {}
  try { _bootHealthCheckOnStartup(); } catch (_) {}
  registerContentProtocol();
  createWindow();
  try { _armBootHealthClear(mainWindow); } catch (_) {}
  setTimeout(() => { try { cleanupHotUpdateArtifacts(); } catch (_) {} }, 15000);
});

// 所有窗口关闭后退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// macOS：点击 Dock 图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============================================================
//  测试出口·仅 TIANMING_TEST_EXPORTS=1 时暴露·生产零影响
//  （verify-* 脚本用 Module._load 桩掉 electron 后 require 本文件取内部函数）
// ============================================================
if (process.env.TIANMING_TEST_EXPORTS) {
  module.exports.__test = {
    compareVersions,
    getCurrentComparableVersion,
    getPackageBuildVersion,
    isStrictUpgrade,
    isStrictRendererUpgrade,
    sanitize,
    downloadRemoteFile,
    sha256FileStream,
    sha256File,
    runWorkerPool,
    checkDiskSpace,
    ensureDiskSpace,
    formatBytesMain,
    readHotUpdateFeed,
    getHotUpdateState,
    writeHotUpdateState,
    writeJsonAtomic,
    getHotUpdatePublicStatus,
    installHotUpdateFromFeed,
    installHotUpdate_rebaseline,
    validateHotUpdateBundle,
    bundledAppRoot,
    repairHotUpdateState,
    cleanupHotUpdateArtifacts,
    _bootHealthCheckOnStartup,
    getActiveHotUpdate,
    _insecureTls: {
      hostOf: _insecureTlsHostOf,
      shouldBypass: _insecureTlsShouldBypass,
      setState: function (s) { _insecureTlsState = s; },
      installCertVerifyProc: _installCertVerifyProc,
      officialDeny: INSECURE_TLS_OFFICIAL_DENY
    },
    paths: {
      HOT_UPDATE_DIR,
      HOT_UPDATE_VERSIONS_DIR,
      HOT_UPDATE_STATE_FILE,
      BOOT_ATTEMPT_FILE
    }
  };
}
