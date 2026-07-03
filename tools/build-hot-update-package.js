#!/usr/bin/env node
/*
 * Build a Tianming renderer hot-update package.
 *
 * Usage:
 *   node web/tools/build-hot-update-package.js --version 1.2.0.1 --out release-hot --notes "fix ui"
 *
 * Output:
 *   release-hot/tianming-hot-1.2.0.1.zip
 *   release-hot/hot-latest.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

// 2026-06-11·S7 测试缝·--web-root/--app-root 可注入合成树（验证脚本用）·默认不变
const WEB_ROOT = (function () {
  const i = process.argv.indexOf('--web-root');
  if (i >= 0 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  return path.resolve(__dirname, '..');
})();
const APP_ROOT = (function () {
  const i = process.argv.indexOf('--app-root');
  if (i >= 0 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  return path.resolve(WEB_ROOT, '..');
})();
const DEFAULT_MIN_APP_VERSION = '';

const ALLOWED_EXTS = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json', '.geojson', '.png', '.jpg', '.jpeg', '.webp',
  '.bmp', '.svg', '.ico', '.mp3', '.ogg', '.wav', '.md', '.txt', '.csv', '.woff', '.woff2',
  '.ttf', '.wasm', '.map',
  '.glb'   // 御驾亲征战术战斗 3D 兵模(web/battle/assets/models/)·缺则线上端静默回退程序化兵模
]);
const KNOWN_WEB_TOP_DIRS = [
  'assets',
  'css',
  'docs',
  'fonts',
  'img',
  'images',
  'js',
  'scenarios',
  'scripts',
  'sounds',
  'audio',
  'tools',
  'preview'
];

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', '.cache', '.tmp', 'tmp', 'dist', 'build', 'release', 'coverage',
  // 本地开发产物·绝不入热更包
  '_archive', 'backups', '_screenshots', 'test-results', '_codex_tmp', '.playwright-cli',
  // 内部文档·开发工具·smoke 测试脚本·运行时不依赖·不入热更包(瘦身~89MB·审计P0-2)
  'dev-tools', 'docs', 'scripts',
  // godot 端 WIP 移植·web 运行时不依赖·package.json 也用 !web/godot/**/* 排掉
  'godot'
]);

// 额外按前缀排除·.bak-rNN 历史快照目录
function _isExcludedDir(name) {
  if (EXCLUDED_DIRS.has(name)) return true;
  if (name.startsWith('.bak-')) return true;
  if (name.startsWith('_codex')) return true; // _codex_tmp / _codex_preview_*.png 等 codex 临时产物·不入热更包
  return false;
}

function arg(name, fallback) {
  const idx = process.argv.indexOf('--' + name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function flag(name) {
  return process.argv.includes('--' + name);
}

function listArg(name) {
  const raw = arg(name, '');
  if (!raw) return [];
  return raw.split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// 2026-06-11·S7·4 段数值版本比较（与 main-impl compareVersions 同语义）
function cmpVersions(a, b) {
  const aa = String(a || '0').split(/[.+-]/).map(n => { const v = parseInt(n, 10); return Number.isFinite(v) ? v : 0; });
  const bb = String(b || '0').split(/[.+-]/).map(n => { const v = parseInt(n, 10); return Number.isFinite(v) ? v : 0; });
  const n = Math.max(aa.length, bb.length, 4);
  for (let i = 0; i < n; i++) {
    const av = aa[i] || 0, bv = bb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function normalizeRel(file) {
  return path.relative(WEB_ROOT, file).replace(/\\/g, '/');
}

function isValidManifestRelPath(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/');
  if (!normalized) return false;
  if (normalized === '.' || normalized === '..') return false;
  if (normalized.startsWith('../') || normalized.includes('/../')) return false;
  if (path.posix.normalize(normalized).startsWith('/')) return false;
  if (/[<>:"|?*]/.test(normalized)) return false;
  if (/[\u0000-\u001F\u007F-\u009F\uF000-\uF8FF]/.test(normalized)) return false;
  return true;
}

function isRecoveredPath(rel) {
  const raw = String(rel || '');
  return /[A-Za-z]:/.test(raw) || raw.includes('\uFF1A') || /C\u00a0/.test(raw);
}

function inferRecoveredRelPath(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const webPos = lower.indexOf('web');
  if (webPos < 0) return '';
  const tail = normalized.slice(webPos + 3);
  if (!tail || tail.startsWith('/')) return '';
  for (const top of KNOWN_WEB_TOP_DIRS) {
    if (!tail.startsWith(top)) continue;
    if (tail.length <= top.length) continue;
    if (!/[A-Za-z0-9_.-]/.test(tail[top.length])) continue;
    const candidate = 'web/' + top + '/' + tail.slice(top.length);
    if (isValidManifestRelPath(candidate)) return candidate;
  }
  return '';
}

function resolveManifestRel(filePath) {
  const raw = normalizeRel(filePath);
  if (isValidManifestRelPath(raw) && !isRecoveredPath(raw)) {
    return { path: raw, recovered: false };
  }
  const recovered = inferRecoveredRelPath(raw);
  if (recovered && isValidManifestRelPath(recovered)) {
    return { path: recovered, recovered: true };
  }
  throw new Error('invalid manifest relative path: ' + raw);
}

function addManifestEntry(entries, filePath, fileSize, fileSha, explicitRel) {
  // explicitRel: for files bundled at a fixed in-zip path (e.g. bundled-scenarios/<name>) that live
  // outside WEB_ROOT — skip the web-relative resolve (which rejects ../ paths) and use it verbatim.
  const { path: rel, recovered } = explicitRel
    ? { path: explicitRel, recovered: false }
    : resolveManifestRel(filePath);
  const existing = entries.get(rel);
  const shouldReplace = !existing || (!existing.recovered && !recovered && fileSize > existing.size) || (existing.recovered && !recovered);
  if (shouldReplace) {
    entries.set(rel, {
      path: rel,
      sha256: fileSha,
      size: fileSize,
      absPath: filePath,
      recovered
    });
  }
}

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (_isExcludedDir(entry.name)) return;
      walk(abs, out);
      return;
    }
    if (!entry.isFile()) return;
    // 安装包专用的「首装增量基线」清单·不入热更包(apply 时 finalize 会写当版真 manifest)·避免自引用/陈旧
    if (entry.name === '.hot-update-manifest.json') return;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) return;
    const stat = fs.statSync(abs);
    addManifestEntry(out, abs, stat.size, sha256File(abs));
  });
}

// 2026-05-23·主进程实现热更·把 APP_ROOT/main-impl.js 打到 zip 根·命名 _app_main.js
// installer 里的 main.js shim 会优先 require hot dir 的 _app_main.js·让 main 实现也能 hot ship
function collectIndexReferencedLocalFiles() {
  const indexPath = path.join(WEB_ROOT, 'index.html');
  if (!fs.existsSync(indexPath)) return new Set();
  const html = fs.readFileSync(indexPath, 'utf-8');
  const refs = new Set();
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = scriptRe.exec(html))) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const srcMatch = /\bsrc="([^"?]+)(?:\?[^"]*)?"/.exec(attrs);
    if (srcMatch && !/^https?:\/\//.test(srcMatch[1])) refs.add(srcMatch[1].replace(/\\/g, '/'));
    const dynamicSrcRe = /\bsrc\s*=\s*['"]([^'"]+\.js)(?:\?[^'"]*)?['"]/g;
    let dynamicMatch;
    while ((dynamicMatch = dynamicSrcRe.exec(body))) {
      if (!/^https?:\/\//.test(dynamicMatch[1])) refs.add(dynamicMatch[1].replace(/\\/g, '/'));
    }
  }
  return refs;
}

function shouldKeepInDefaultHotPackage(file, indexRefs) {
  if (!file.path.startsWith('preview/')) return true;
  return indexRefs && indexRefs.has(file.path);
}

// --include-preview 时仍剔掉 preview 里的 mockup(设计截图/codemod/日志·非运行时·~300MB)·
// 只留运行时:preview/img/**(御案UI图+底图数据)、preview/scenario-editor-*(剧本工坊)、*-bundle.js、少量 html/css。
function isPreviewMockup(p) {
  if (!p.startsWith('preview/')) return false;
  var base = p.split('/').pop();
  if (base.charAt(0) === '_') return true;                         // 任何 _前缀 = 开发脚本/临时(含 img/_remove-white-bg.js)·剔
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(base)) {                 // 图片:
    return !p.startsWith('preview/img/');                          //   只留 preview/img/ 下的运行时御案图·其余(含 *-verify.png 验证截图)剔
  }
  if (/\.(log|txt|ya?ml)$/i.test(base)) return true;               // 杂项·剔
  return false;                                                    // 其余 js/html/css(含剧本工坊 scenario-editor-*、bundle、御案img数据)保留
}

function walkAppMainImpl() {
  const APP_MAIN_IMPL = path.join(APP_ROOT, 'main-impl.js');
  if (!fs.existsSync(APP_MAIN_IMPL)) return [];
  return [{ abs: APP_MAIN_IMPL, zipPath: '_app_main.js' }];
}

// 2026-05-23·preload 也热更·APP_ROOT/preload-impl.js → zip 根 _app_preload.js
// installer 里的 preload.js shim 通过 process.argv (main 透传) 找 hot _app_preload.js·失败 fallback bundled
function walkAppPreloadImpl() {
  const APP_PRELOAD_IMPL = path.join(APP_ROOT, 'preload-impl.js');
  if (!fs.existsSync(APP_PRELOAD_IMPL)) return [];
  return [{ abs: APP_PRELOAD_IMPL, zipPath: '_app_preload.js' }];
}

// 2026-05-22·扫 APP_ROOT/scenarios·把官方剧本 JSON 也打进 zip·路径 bundled-scenarios/<file>
// 让 hot update 也能 ship scenarios 改动·不必等下个 installer
function walkBundledScenarios() {
  const SCENARIOS_SRC = path.join(APP_ROOT, 'scenarios');
  // 本地自用/测试剧本不入热更包(防夹带发给玩家)·文件名含这些子串的一律跳过·只 ship 官方剧本
  const SKIP_SUBSTRINGS = ['111', '自用', '测试', '挽天倾', '崇祯'];
  const out = [];
  if (!fs.existsSync(SCENARIOS_SRC)) return out;
  fs.readdirSync(SCENARIOS_SRC, { withFileTypes: true }).forEach(entry => {
    if (!entry.isFile()) return;
    if (SKIP_SUBSTRINGS.some(s => entry.name.includes(s))) return;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.json') return;  // 只 ship 官方 JSON 剧本
    out.push({
      abs: path.join(SCENARIOS_SRC, entry.name),
      zipPath: 'bundled-scenarios/' + entry.name
    });
  });
  return out;
}

function main() {
  const version = String(arg('version', '')).trim();
  if (!version) {
    console.error('Missing --version, example: --version 1.2.0.1');
    process.exit(1);
  }
  const outDir = path.resolve(APP_ROOT, arg('out', 'release-hot'));
  const notes = String(arg('notes', '') || '');
  const minAppVersion = String(arg('min-app-version', DEFAULT_MIN_APP_VERSION) || '');
  const packageName = arg('package-name', 'tianming-hot-' + version + '.zip');
  const packageUrl = arg('package-url', packageName);
  const includePreview = flag('include-preview');
  const explicitFiles = listArg('files');
  const indexRefs = collectIndexReferencedLocalFiles();

  // ════ S7 防呆闸门·2026-06-11·1.3.3.4 事故（--files 部分清单 → 玩家假更新/装失败）后加 ════
  // GATE-0·--files 部分包模式默认禁用·增量客户端把 manifest.files 当「完整树」·部分清单必出事
  if (explicitFiles.length && !flag('allow-partial-DANGEROUS')) {
    console.error('[GATE-0] --files 部分包模式已禁用：1.3.3.4 事故根源（清单不完整 → 玩家假更新/更新失败）。');
    console.error('         正式发版一律全量清单。确属本地调试需要请加 --allow-partial-DANGEROUS。');
    process.exit(1);
  }
  // GATE-3·版本单调·同一 outDir 里已有 feed 时新版本必须严格更高（防把旧版本号发出去 → 全员拒装/搁浅）
  if (!flag('allow-same-version')) {
    try {
      const prevFeedPath = path.join(outDir, 'hot-latest.json');
      if (fs.existsSync(prevFeedPath)) {
        const prevFeed = JSON.parse(fs.readFileSync(prevFeedPath, 'utf-8'));
        const cmp = cmpVersions(version, String(prevFeed.version || '0'));
        if (cmp <= 0) {
          console.error('[GATE-3] 版本不单调：--version ' + version + ' ≤ 现有 feed ' + prevFeed.version
            + '（' + prevFeedPath + '）。发布更低/相同版本会让全部客户端拒装。--allow-same-version 可跳过（仅限本地重打）。');
          process.exit(1);
        }
      }
    } catch (e) {
      if (e && /GATE-3/.test(e.message || '')) throw e;
      console.warn('[GATE-3] 旧 feed 读取失败(跳过单调检查)·' + (e && e.message || e));
    }
  }
  // GATE-5·版本戳一致·web/version.json 与 index.html <meta name="tm-version"> 必须等于 --version
  //   （发版工具 release.js 负责盖戳·手工构建请先盖戳或 --skip-stamp-check）
  if (!explicitFiles.length && !flag('skip-stamp-check')) {
    const stampProblems = [];
    try {
      const vj = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, 'version.json'), 'utf-8'));
      if (String(vj.version || '').trim() !== version) stampProblems.push('version.json=' + vj.version);
    } catch (_e) { stampProblems.push('version.json 缺失/不可读'); }
    try {
      const html = fs.readFileSync(path.join(WEB_ROOT, 'index.html'), 'utf-8');
      const m = html.match(/<meta\s+name="tm-version"\s+content="([^"]*)"/);
      if (!m || m[1].trim() !== version) stampProblems.push('index.html meta tm-version=' + (m ? m[1] : '(无)'));
    } catch (_e) { stampProblems.push('index.html 不可读'); }
    if (stampProblems.length) {
      console.error('[GATE-5] 版本戳不一致（目标 ' + version + '）：' + stampProblems.join('·'));
      console.error('         请用 scripts/release.js 统一盖戳后构建·或确属调试加 --skip-stamp-check。');
      process.exit(1);
    }
  }

  const manifestEntries = new Map();
  if (explicitFiles.length) {
    explicitFiles.forEach(rel => {
      const abs = path.resolve(WEB_ROOT, rel);
      const relFromRoot = path.relative(WEB_ROOT, abs).replace(/\\/g, '/');
      if (!relFromRoot || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
        console.error('file outside web root:', rel);
        process.exit(1);
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        console.error('file not found:', rel);
        process.exit(1);
      }
      const stat = fs.statSync(abs);
      addManifestEntry(manifestEntries, abs, stat.size, sha256File(abs));
    });
  } else {
    walk(WEB_ROOT, manifestEntries);
  }
  const filtered = explicitFiles.length
    ? Array.from(manifestEntries.values())
    : includePreview
      ? Array.from(manifestEntries.values()).filter(file => !isPreviewMockup(file.path))
      : Array.from(manifestEntries.values()).filter(file => shouldKeepInDefaultHotPackage(file, indexRefs));
  if (!explicitFiles.length && !filtered.some(file => file.path === 'index.html')) {
    console.error('index.html not found in hot-update file list');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, packageName);
  const zip = new AdmZip();
  filtered
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach(entry => {
      zip.addLocalFile(entry.absPath, path.dirname(entry.path) === '.' ? '' : path.dirname(entry.path));
    });

  // 2026-05-22·bundled scenarios·热更也能 ship 官方剧本 JSON 改动
  const bundledScenarios = walkBundledScenarios();
  bundledScenarios.forEach(entry => {
    const stat = fs.statSync(entry.abs);
    zip.addLocalFile(entry.abs, 'bundled-scenarios');
    addManifestEntry(manifestEntries, entry.abs, stat.size, sha256File(entry.abs), entry.zipPath);
  });
  if (bundledScenarios.length) {
    console.log('[hot-update] bundled scenarios·' + bundledScenarios.length + ' file(s)·' + bundledScenarios.map(e => path.basename(e.abs)).join(', '));
  }

  // 2026-05-23·主进程实现·main-impl.js → _app_main.js·shim 会找
  const appMains = walkAppMainImpl();
  appMains.forEach(entry => {
    const stat = fs.statSync(entry.abs);
    zip.addLocalFile(entry.abs, '', '_app_main.js');
    addManifestEntry(manifestEntries, entry.abs, stat.size, sha256File(entry.abs), '_app_main.js');
  });
  if (appMains.length) {
    console.log('[hot-update] app main impl·_app_main.js·' + (fs.statSync(appMains[0].abs).size/1024).toFixed(1) + ' KB');
  } else {
    console.warn('[hot-update] WARN·APP_ROOT/main-impl.js 不存在·main shim 将无 hot 实现可加载·只能 fallback bundled');
  }

  // 2026-05-23·preload 实现·preload-impl.js → _app_preload.js·shim 会找 (sandbox: false 在 main-impl webPreferences)
  const appPreloads = walkAppPreloadImpl();
  appPreloads.forEach(entry => {
    const stat = fs.statSync(entry.abs);
    zip.addLocalFile(entry.abs, '', '_app_preload.js');
    addManifestEntry(manifestEntries, entry.abs, stat.size, sha256File(entry.abs), '_app_preload.js');
  });
  if (appPreloads.length) {
    console.log('[hot-update] app preload impl·_app_preload.js·' + (fs.statSync(appPreloads[0].abs).size/1024).toFixed(1) + ' KB');
  } else {
    console.warn('[hot-update] WARN·APP_ROOT/preload-impl.js 不存在·preload shim 将无 hot 实现可加载·只能 fallback bundled');
  }

  // manifest must list ONLY files that are actually in the package (zip archive built from `filtered`).
  // mirror the archive's preview filter (line ~242) so the manifest never advertises preview/ files that
  // aren't shipped — otherwise applyHotUpdateBundle's per-file existence check throws '热更新文件不存在'.
  const finalManifestFiles = Array.from(manifestEntries.values())
    .filter(entry => explicitFiles.length ? true : (includePreview ? !isPreviewMockup(entry.path) : shouldKeepInDefaultHotPackage(entry, indexRefs)))
    .map(entry => ({ path: entry.path, sha256: entry.sha256, size: entry.size, absPath: entry.absPath }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(entry => ({ path: entry.path, sha256: entry.sha256, size: entry.size }));

  // GATE-2·必含文件 + index.html 引用闭包 ⊆ 清单（1.3.3.4 的病灶正是 index 引的脚本不在清单里）
  if (!explicitFiles.length) {
    const manifestPathSet = new Set(finalManifestFiles.map(f => f.path));
    const problems = [];
    const required = ['index.html', 'changelog.json', 'styles.css', 'version.json'];
    if (fs.existsSync(path.join(APP_ROOT, 'main-impl.js'))) required.push('_app_main.js');
    if (fs.existsSync(path.join(APP_ROOT, 'preload-impl.js'))) required.push('_app_preload.js');
    required.forEach(p => { if (!manifestPathSet.has(p)) problems.push('必含文件缺失·' + p); });
    indexRefs.forEach(ref => {
      if (!manifestPathSet.has(ref)) problems.push('index.html 引用不在清单·' + ref);
    });
    if (problems.length) {
      console.error('[GATE-2] 清单完整性不过关（' + problems.length + ' 处）：');
      problems.slice(0, 20).forEach(p => console.error('         ' + p));
      if (problems.length > 20) console.error('         …等共 ' + problems.length + ' 处');
      process.exit(1);
    }
  }

  const manifest = {
    type: 'tianming-hot-update',
    version,
    entry: 'index.html',
    generatedAt: new Date().toISOString(),
    files: finalManifestFiles,
    remove: []
  };
  if (minAppVersion) manifest.minAppVersion = minAppVersion;
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));
  zip.writeZip(zipPath);

  // GATE-4·zip ↔ manifest 双向一致·重开写好的 zip 对账（结构性堵死「打进包但没记账/记了账没打包」）
  {
    const written = new AdmZip(zipPath);
    const zipSet = new Set(written.getEntries().filter(e => !e.isDirectory).map(e => e.entryName.replace(/\\/g, '/')));
    zipSet.delete('manifest.json');
    const manifestSet = new Set(finalManifestFiles.map(f => f.path));
    const onlyZip = [...zipSet].filter(p => !manifestSet.has(p));
    const onlyManifest = [...manifestSet].filter(p => !zipSet.has(p));
    if (onlyZip.length || onlyManifest.length) {
      console.error('[GATE-4] zip 与 manifest 不一致·包内多出 ' + onlyZip.length + '·清单多出 ' + onlyManifest.length);
      onlyZip.slice(0, 10).forEach(p => console.error('         仅在 zip·' + p));
      onlyManifest.slice(0, 10).forEach(p => console.error('         仅在清单·' + p));
      try { fs.rmSync(zipPath, { force: true }); } catch (_) {}
      process.exit(1);
    }
  }

  const zipStat = fs.statSync(zipPath);
  // GATE-6·体积理智线（警告不拦）·全量包异常大小往往意味着排除规则坏了
  if (!explicitFiles.length) {
    if (zipStat.size < 100 * 1024 * 1024) console.warn('[GATE-6] WARN·全量包仅 ' + (zipStat.size / 1048576).toFixed(0) + ' MB·低于 100MB·确认排除规则没把运行时内容剔掉');
    if (zipStat.size > 700 * 1024 * 1024) console.warn('[GATE-6] WARN·全量包高达 ' + (zipStat.size / 1048576).toFixed(0) + ' MB·高于 700MB·确认没把开发产物夹带进来');
  }
  // 2026-05-23·incremental update 字段·old client 读不到 manifestUrl 自动 fallback 走 packageUrl 全包路径
  //   manifestUrl·per-version manifest·{path,sha256,size}·客户端 diff 本地 .hot-update-manifest.json
  //   filesBaseUrl·sha-content-addressable file store·客户端按 `${filesBaseUrl}<sha2>/<sha-rest>/<basename>` 取
  const feed = {
    type: 'tianming-hot-update-feed',
    version,
    packageUrl,
    manifestUrl: 'manifests/' + version + '.json',
    filesBaseUrl: 'files/',
    sha256: sha256File(zipPath),
    size: zipStat.size,
    notes,
    generatedAt: manifest.generatedAt
  };
  // 2026-06-11·minAppVersion 提升到 feed 层·客户端「下载前」即可判定要不要先升本体（needsInstaller）
  //   旧客户端忽略未知字段·manifest 内同名字段仍是装前最后防线
  if (minAppVersion) feed.minAppVersion = minAppVersion;
  fs.writeFileSync(path.join(outDir, 'hot-latest.json'), JSON.stringify(feed, null, 2), 'utf-8');
  // 同步把 manifest 单独写到 outDir·upload-hot.py 直接拾·SCP 到 server hot/manifests/<ver>.json
  fs.mkdirSync(path.join(outDir, 'manifests'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'manifests', version + '.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('[hot-update] package:', zipPath);
  console.log('[hot-update] feed:', path.join(outDir, 'hot-latest.json'));
  console.log('[hot-update] files:', finalManifestFiles.length);
}

main();
