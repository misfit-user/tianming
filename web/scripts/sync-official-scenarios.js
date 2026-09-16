#!/usr/bin/env node
// 官方剧本唯一生成入口。
//
// 数据真源只有仓根 scenarios/*（官方）.json；本脚本只从真源向下生成：
//   - web/scenarios/*.js                         网页/安卓内置注册脚本
//   - web/tm-official-scenario-bundle.js         Electron seeder bundle
//   - web/preview/official-scenarios-bundle.js   剧本编辑器 fallback bundle
//   - web/preview/scenario-editor-reset-data.js  剧本编辑器 reset 基线
//   - web/bundled-scenarios/*.json + manifest.json（Pages/热更按需加载素材）
//
// 用法：
//   node web/scripts/sync-official-scenarios.js          # 写入全部派生物
//   node web/scripts/sync-official-scenarios.js --check  # 只比较，不写文件
//
// 禁止反向从任何 bundle/内置 JS “导出”覆盖根 JSON。
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web');
const SOURCE_DIR = path.join(REPO_ROOT, 'scenarios');
const ENTRIES = [
  {
    key: 'tianqi7',
    filename: '天启七年·九月（官方）.json',
    id: 'sc-tianqi7-1627',
    builtin: 'scenarios/tianqi7-1627.js'
  },
  {
    key: 'shaosong',
    filename: '绍宋·建炎元年八月（官方）.json',
    id: 'sc-jianyan1-1127-shaosong',
    builtin: 'scenarios/shaosong-jianyan-1127.js'
  },
  {
    key: 'tang840',
    filename: '晚唐·开成五年（官方）.json',
    id: 'sc-tang840-840',
    builtin: 'scenarios/tang840-840.js'
  }
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readSources() {
  return ENTRIES.map((entry) => {
    const sourcePath = path.join(SOURCE_DIR, entry.filename);
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || data.id !== entry.id) {
      throw new Error(entry.filename + ' id 应为 ' + entry.id + '，实为 ' + (data && data.id));
    }
    return Object.assign({}, entry, {
      sourcePath,
      sourceRel: path.relative(REPO_ROOT, sourcePath).replace(/\\/g, '/'),
      raw,
      data,
      hash: sha256(Buffer.from(raw, 'utf8')),
      bytes: Buffer.byteLength(raw, 'utf8')
    });
  });
}

function serializeBuiltin(entry) {
  return [
    '/* GENERATED FILE. Source: ' + entry.sourceRel + '. Run `node web/scripts/sync-official-scenarios.js`. */',
    '(function(global) {',
    '  "use strict";',
    '  var scenario = ' + JSON.stringify(entry.data) + ';',
    '  function register() {',
    '    if (!global.P || !Array.isArray(global.P.scenarios)) { setTimeout(register, 200); return; }',
    '    var i = global.P.scenarios.findIndex(function(s) { return s && s.id === scenario.id; });',
    '    if (i >= 0) global.P.scenarios.splice(i, 1);',
    '    global.P.scenarios.push(scenario);',
    '    try { console.log("[scenario] " + scenario.name + " 已注册 (id=" + scenario.id + ")"); } catch (_) {}',
    '  }',
    '  register();',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');
}

function serializeSeeder(entries) {
  const bundle = entries.map((entry) => ({
    filename: entry.filename.replace(/\.json$/, ''),
    source: '../' + entry.sourceRel,
    data: entry.data
  }));
  return '// GENERATED FILE. Source: ../scenarios/*（官方）.json. Run `node web/scripts/sync-official-scenarios.js`.\n'
    + '(function(global){\n'
    + '  global.TMOfficialScenarioBundle = ' + JSON.stringify(bundle) + ';\n'
    + '})(typeof window !== "undefined" ? window : globalThis);\n';
}

function serializePreview(entries) {
  const bundle = {};
  entries.forEach((entry) => { bundle[entry.key] = entry.data; });
  return '/* GENERATED FILE. Source: ../../scenarios/*（官方）.json. Run `node web/scripts/sync-official-scenarios.js`. */\n'
    + '(function(global){\n'
    + '  global.TM_OFFICIAL_SCENARIOS = ' + JSON.stringify(bundle) + ';\n'
    + '})(typeof window !== "undefined" ? window : globalThis);\n';
}

function serializeEditorResetData(sourceHash) {
  const builder = require('./build-scenario-editor-reset-data.js');
  const payload = builder.buildPayload({ sourceSha256: sourceHash });
  return [
    '/* GENERATED FILE. Run `node web/scripts/sync-official-scenarios.js`. */',
    '(function(global){',
    '  global.TM_SCENARIO_EDITOR_RESET_DATA = ' + JSON.stringify(payload) + ';',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');
}

function buildArtifacts() {
  const entries = readSources();
  const tianqi = entries.find((entry) => entry.key === 'tianqi7');
  const files = new Map();

  entries.forEach((entry) => {
    entry.builtinContent = serializeBuiltin(entry);
    entry.builtinBytes = Buffer.byteLength(entry.builtinContent, 'utf8');
    entry.builtinHash = sha256(Buffer.from(entry.builtinContent, 'utf8'));
    files.set(path.join(WEB_ROOT, entry.builtin), entry.builtinContent);
    files.set(path.join(WEB_ROOT, 'bundled-scenarios', entry.filename), entry.raw);
  });
  files.set(path.join(WEB_ROOT, 'tm-official-scenario-bundle.js'), serializeSeeder(entries));
  files.set(path.join(WEB_ROOT, 'preview', 'official-scenarios-bundle.js'), serializePreview(entries));
  files.set(path.join(WEB_ROOT, 'preview', 'scenario-editor-reset-data.js'), serializeEditorResetData(tianqi.hash));

  const manifest = {
    schemaVersion: 1,
    generatedFrom: 'scenarios/*（官方）.json',
    entries: entries.map((entry) => ({
      key: entry.key,
      id: entry.id,
      name: entry.data.name,
      era: entry.data.era || '',
      role: entry.data.role || '',
      background: entry.data.background || entry.data.overview || '',
      filename: entry.filename,
      source: entry.sourceRel,
      builtinScript: entry.builtin,
      scriptUrl: entry.builtin,
      active: entry.data.active !== false,
      hasMap: !!(entry.data.map && Array.isArray(entry.data.map.regions) && entry.data.map.regions.length),
      counts: {
        characters: Array.isArray(entry.data.characters) ? entry.data.characters.length : 0,
        factions: Array.isArray(entry.data.factions) ? entry.data.factions.length : 0,
        regions: entry.data.map && Array.isArray(entry.data.map.regions) ? entry.data.map.regions.length : 0
      },
      bytes: entry.builtinBytes,
      sha256: entry.builtinHash,
      sourceBytes: entry.bytes,
      sourceSha256: entry.hash
    }))
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  files.set(path.join(WEB_ROOT, 'bundled-scenarios', 'manifest.json'), manifestJson + '\n');
  files.set(
    path.join(WEB_ROOT, 'bundled-scenarios', 'manifest.js'),
    '/* GENERATED FILE. Run `node web/scripts/sync-official-scenarios.js`. */\n'
      + '(function(global){ global.TMOfficialScenarioManifest = ' + JSON.stringify(manifest) + '; })'
      + '(typeof window !== "undefined" ? window : globalThis);\n'
  );
  return { entries, files };
}

function sync(options) {
  const check = !!(options && options.check);
  const built = buildArtifacts();
  const mismatches = [];
  for (const [file, expected] of built.files) {
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (actual === expected) continue;
    // Per-scenario JSON copies are intentionally gitignored inputs for
    // Pages/mobile staging. A fresh checkout may omit them until staging runs
    // sync; if present, however, they must still be byte-current.
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const optionalBundledJson = /^web\/bundled-scenarios\/.*（官方）\.json$/.test(rel);
    if (check && actual === null && optionalBundledJson) continue;
    if (check) {
      mismatches.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, expected, 'utf8');
    console.log('[official-sync] wrote ' + path.relative(REPO_ROOT, file));
  }
  if (check && mismatches.length) {
    throw new Error('官方剧本派生物过期或缺失：\n  - ' + mismatches.join('\n  - ') + '\n运行 node web/scripts/sync-official-scenarios.js 后提交 tracked 产物。');
  }
  console.log('[official-sync] ' + (check ? 'parity PASS' : 'sync PASS') + ' · sources=' + built.entries.length + ' artifacts=' + built.files.size);
  return built;
}

function main(argv) {
  const args = argv || process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node web/scripts/sync-official-scenarios.js [--check]');
    return;
  }
  sync({ check: args.includes('--check') });
}

if (require.main === module) {
  try { main(); }
  catch (err) { console.error('[official-sync] FAIL\n' + (err && err.stack || err)); process.exit(1); }
}

module.exports = { ENTRIES, REPO_ROOT, WEB_ROOT, SOURCE_DIR, buildArtifacts, sync, main };
