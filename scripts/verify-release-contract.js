#!/usr/bin/env node
// Static, read-only contract gate shared by installer/hot/Capgo/APK/Pages.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const releaseTree = require('./lib/release-tree.js');
const official = require('../web/scripts/sync-official-scenarios.js');
const releaseWorkflow = require('./verify-release-workflow-contract.js');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function ok(value, label) { assert.ok(value, label); assertions++; console.log('  ok·' + label); }

function main() {
  const configInfo = releaseTree.loadConfig(ROOT);
  const config = configInfo.config;
  ok(Array.isArray(config.dirs) && Array.isArray(config.prefixes) && Array.isArray(config.globs), 'release-excludes schema');
  ok(config.requiredFiles.includes('.hot-update-manifest.json'), 'canonical 热更基线是发布树 required file');
  ok(new Set(config.dirs).size === config.dirs.length && new Set(config.prefixes).size === config.prefixes.length, 'release-excludes 无重复');
  for (const value of config.dirs.concat(config.prefixes).concat(config.globs)) {
    ok(value && !String(value).includes('..') && !path.isAbsolute(String(value)), '安全排除项 ' + value);
  }

  const sourceTree = releaseTree.walkTree(path.join(ROOT, 'web'), config);
  const sourceProblems = releaseTree.validateSource(path.join(ROOT, 'web'), sourceTree, config);
  const limits = releaseTree.enforceLimits(sourceTree.kept, config);
  ok(sourceProblems.length === 0, 'web 运行时引用/required files 未被误排：' + sourceProblems.join('; '));
  ok(limits.problems.length === 0, 'web 源体积/文件数在闸内：' + limits.problems.join('; '));
  const sourcePaths = new Set(sourceTree.kept.map(row => row.rel));
  ok(sourcePaths.has('preview/scenario-editor-reset-app.js') && sourcePaths.has('preview/img/east-asia-basemap-data.js'), '发布树保留 preview 运行时与 preview/img（目录探针不可误杀整树）');
  ok(!sourcePaths.has('_game-entry-shot.png') && !Array.from(sourcePaths).some((rel) => /^_ingame.*\.png$/i.test(rel)), '发布树排除根目录游戏截图');
  const rootDevFiles = ['_audit_deadhandlers.py', 'analyze_globals.py', 'final_scan.sh', 'scan.sh', 'start-server.bat', 'tm-tools.d.ts', 'types.d.ts'];
  ok(rootDevFiles.every((rel) => !sourcePaths.has(rel)), '发布树排除根目录开发脚本与类型声明');
  const strayReleaseFiles = [
    'detect_globals.js', 'scan_globals.js', 'preview-launch.html', 'preview-launch-v2.html', 'preview-launch-v3.html',
    'data/maps/tianqi-ming2/tianqi-ming2.preview-data.js', 'assets/ui/home/home-menu-imperial-study-v1-ambient.gif'
  ];
  ok(strayReleaseFiles.every((rel) => !sourcePaths.has(rel)), '发布树排除审计脚本、旧启幕稿、无引用预览数据与失配 GIF');
  ['.claude/launch.json', 'output/playwright/shot.png', 'maps/asia-map.png', 'preview-launch-assets/hero-bg.png'].forEach((rel) => {
    ok(!!releaseTree.excludedReason(rel, config), '发布树明确排除本机开发产物:' + rel);
  });
  ['preview/img/topbar-imperial-rail.png', 'battle/assets/models/unit_lod.glb', 'vendor/models/Xenova/bge-small-zh-v1.5/onnx/model_quantized.onnx'].forEach((rel) => {
    ok(!releaseTree.excludedReason(rel, config), '发布树不误杀运行资产:' + rel);
  });

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const mobileVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'mobile', 'release-version.json'), 'utf8'));
  ok(mobileVersion.version === pkg.build.buildVersion && Number.isInteger(mobileVersion.versionCode), 'tracked mobile canonical version 与 buildVersion 同版');
  const files = new Set(pkg.build && pkg.build.files || []);
  for (const dir of config.dirs) ok(files.has('!web/**/' + dir + '/**/*'), 'electron-builder 消费 dir:' + dir);
  for (const prefix of config.prefixes) {
    ok(files.has('!web/**/' + prefix + '*'), 'electron-builder 消费 prefix file:' + prefix);
    ok(files.has('!web/**/' + prefix + '*/**/*'), 'electron-builder 消费 prefix dir:' + prefix);
  }
  for (const glob of config.globs) {
    const normalized = glob.replace(/^web\//, '');
    ok(files.has('!web/' + normalized), 'electron-builder 消费 glob:' + glob);
  }
  ok(files.has('!web/preview/**/*.{png,jpg,jpeg,webp,gif,bmp}') && files.has('web/preview/img/**/*'), 'electron-builder 消费 previewMockup 例外');

  const discovered = fs.readdirSync(path.join(ROOT, 'scenarios')).filter((name) => /（官方）\.json$/.test(name)).sort();
  const declared = official.ENTRIES.map((entry) => entry.filename).sort();
  ok(JSON.stringify(discovered) === JSON.stringify(declared), '所有官方 JSON 均登记进统一生成器');
  declared.forEach((name) => ok(files.has('scenarios/' + name), 'electron installer 包含官方剧本 ' + name));

  const hotSource = fs.readFileSync(path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js'), 'utf8');
  ok(hotSource.includes("scripts/lib/release-tree.js") && hotSource.includes('excludedReason'), 'hot builder 消费共享 release-tree');
  ok(["'.glb'", "'.gltf'", "'.bin'", "'.onnx'"].every((ext) => hotSource.includes(ext)), 'hot builder 收集战斗模型与本地语义模型扩展名');
  ok(hotSource.includes('HOT_EXT_MIN_APP_VERSION') && hotSource.includes("'.glb': '1.3.4.10'")
    && hotSource.includes("'.onnx': '1.3.4.12'") && hotSource.includes('minAppVersion 自动抬升'),
  '新扩展名自动携带旧壳阻断所需 minAppVersion');
  const shellSource = fs.readFileSync(path.join(ROOT, 'main-impl.js'), 'utf8');
  ok(shellSource.includes("'.glb', '.gltf', '.bin'") && shellSource.includes("'.onnx'"), '桌面壳层放行 collector 会发出的运行资产扩展名');
  const semanticSource = fs.readFileSync(path.join(ROOT, 'web', 'tm-semantic-recall.js'), 'utf8');
  ok(semanticSource.includes("probeSemanticAsset(localModelPath + 'onnx/model_quantized.onnx')"), '本地模型完整性探针包含 ONNX 主体，拒绝半包误判');
  const capgoSource = fs.readFileSync(path.join(ROOT, 'mobile', 'scripts', 'build-capgo-bundle.ps1'), 'utf8');
  const mobileStage = fs.readFileSync(path.join(ROOT, 'mobile', 'scripts', 'stage-web-for-cap.ps1'), 'utf8');
  ok(capgoSource.includes('stage-web-release.js') && mobileStage.includes('stage-web-release.js'), 'Capgo/APK 消费共享 release-tree');
  ok(capgoSource.includes('sync-official-scenarios.js') && mobileStage.includes('sync-official-scenarios.js'), 'Capgo/APK staging 先生成官方剧本派生物');

  const capConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'mobile', 'capacitor.config.json'), 'utf8'));
  const mobilePkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'mobile', 'package.json'), 'utf8'));
  const nativeVerify = fs.readFileSync(path.join(ROOT, 'mobile', 'scripts', 'verify-staged-web.ps1'), 'utf8');
  const stageWebSource = fs.readFileSync(path.join(ROOT, 'scripts', 'stage-web-release.js'), 'utf8');
  ok(capConfig.webDir === 'www', 'Capacitor 只读取派生 www');
  ok(/npm run stage.*cap sync android.*verify:native/.test(mobilePkg.scripts.sync), 'npm sync 强制 stage→cap sync→native hash verify');
  ok(mobilePkg.scripts.open.startsWith('npm run sync') && mobilePkg.scripts.run.startsWith('npm run sync'), 'open/run 不可绕过 sync gate');
  ok(mobilePkg.scripts['verify:native'].includes('-CapacitorNative')
    && !mobilePkg.scripts['verify:staging'].includes('-CapacitorNative')
    && nativeVerify.includes("'--capacitor-native'")
    && stageWebSource.includes("Object.freeze(['cordova.js', 'cordova_plugins.js'])"),
  'native 仅容忍 Capacitor 两个注入文件');
  const extraFixture = releaseTree.splitTargetExtras(
    new Map([['index.html', {}]]),
    [
      { rel: 'index.html' }, { rel: 'cordova.js' }, { rel: 'cordova_plugins.js' },
      { rel: 'evil.js' }, { rel: 'nested/cordova.js' }
    ],
    ['cordova.js', 'cordova_plugins.js']
  );
  ok(extraFixture.allowed.length === 2 && extraFixture.forbidden.length === 2
    && extraFixture.forbidden.includes('evil.js') && extraFixture.forbidden.includes('nested/cordova.js')
    && extraFixture.comparable.length === 3,
  'native extra allowlist 仅放两项，其余仍 fail-closed');

  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  ok(ignore.includes('mobile/www/') && ignore.includes('web/bundled-scenarios/*.json'), '派生目录已 ignore');
  const ignoreLines = ignore.split(/\r?\n/).map(line => line.trim());
  ok(!ignoreLines.includes('.hot-update-manifest.json') && !ignoreLines.includes('web/.hot-update-manifest.json'), 'web canonical 热更基线未被 ignore');
  const baseline = readJson(path.join(ROOT, 'web', '.hot-update-manifest.json'));
  ok(baseline.type === 'tianming-hot-update' && baseline.version === pkg.build.buildVersion && Array.isArray(baseline.files), 'canonical 热更基线存在且与 buildVersion 同版');
  const baselinePaths = new Set(baseline.files.map((row) => row.path));
  ok(['assets/ui/home/home-menu-imperial-study-v1.png', 'preview/img/topbar-imperial-rail.png',
    'battle/assets/models/unit_lod.glb', 'vendor/models/Xenova/bge-small-zh-v1.5/onnx/model_quantized.onnx']
    .every((rel) => baselinePaths.has(rel)), 'canonical 基线自带首页、正式 UI、战斗模型与语义模型运行资产');
  ok(['detect_globals.js', 'scan_globals.js', 'preview-launch.html', 'preview-launch-v2.html', 'preview-launch-v3.html',
    'maps/asia-map.png', 'output/playwright/A_main_yuan.png', '.claude/launch.json',
    'data/maps/tianqi-ming2/tianqi-ming2.preview-data.js', 'assets/ui/home/home-menu-imperial-study-v1-ambient.gif']
    .every((rel) => !baselinePaths.has(rel)), 'canonical 基线不夹带开发产物、旧设计稿与无引用大文件');
  const baselineCheck = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'sync-hot-baseline.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  ok(baselineCheck.status === 0, 'canonical 基线逐路径/hash/size 对齐当前 production hot tree：' + String(baselineCheck.stderr || baselineCheck.stdout || '').trim().slice(0, 800));
  const webRoot = path.join(ROOT, 'web');
  ok(assertThrows(() => releaseTree.assertSafeStageTarget(ROOT, webRoot, path.join(webRoot, '_unsafe-stage'))), 'staging 拒绝清空 web 源码子目录');
  ok(assertThrows(() => releaseTree.assertSafeStageTarget(ROOT, webRoot, path.join(ROOT, 'scripts'))), 'staging 拒绝清空已有普通目录');
  ok(!assertThrows(() => releaseTree.assertSafeStageTarget(ROOT, webRoot, path.join(ROOT, 'mobile', 'www'))), 'staging 仅放行已知 mobile/www 派生目录');
  ok(releaseWorkflow.main() > 0, '两阶段 release/Pages 静态契约');
  console.log('PASS assertions=' + assertions + ' files=' + sourceTree.kept.length + ' bytes=' + limits.totalBytes);
}

function assertThrows(fn) {
  try { fn(); return false; } catch (_) { return true; }
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

try { main(); }
catch (err) { console.error('FAIL ' + (err && err.stack || err)); process.exit(1); }
