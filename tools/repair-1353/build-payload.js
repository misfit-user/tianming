#!/usr/bin/env node
'use strict';
// 从当前工作树生成 1.3.5.3 修复包的 payload/ 与 payload-manifest.json。
//   node tools/repair-1353/build-payload.js
// 清单是修复器 repair-1353.ps1 的唯一真相源：文件列表、1.3.5.3 原文件哈希（refuse 其它构建）、
// 此前修复包写入过的哈希（允许覆盖已修过一次的文件）、是否存在于热更新目录（main-impl.js 只在 app.asar 里）。
// 原文件哈希来自 git 标签 full-1.3.5.3 的 blob（与安装包 app.asar 内字节逐一相同，已核）。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const KIT = __dirname;
const PAYLOAD = path.join(KIT, 'payload');
const VERSION = '1.3.5.3';

// 1.3.5.3 完整安装版原文件 SHA-256（git show full-1.3.5.3:<path>）
const ORIGINAL = {
  'web/editor-authoring-agent.js': '6a4891ad1e8ca16e6ece9e6a788c201b440c3aa69605959db6b1f75ea1676c8e',
  'web/editor-authoring-agent-ui.js': 'ecc4c234633a07e91ab75f074107744f913fbe6e6af5e08176f3d8f8d5b04f6b',
  'web/map-editor-juben-handoff.js': '98c995c0a5fcf3e23b39a8ec10e4861b3ea18e9c31df67e3c437af2883c16882',
  'web/map-editor-to-game.js': '01c95b2767d24bf4a151775254a46bd642d12f9f973475ba7bc583273818ec87',
  'web/tm-save-lifecycle.js': '70fc3100b5aa89011504f1deaccda434f50d75548c04291a248de76a9369cc97',
  'web/tm-save-world-validation.js': 'f4bda4cd928a699a895197c932c7de2165732eb77644760629fab840504efff1',
  'web/tm-endturn-edict.js': 'c787acbd1c36a042a8967d55f091748d736679ba2f3dfce99d0f69f3e90b636b',
  'web/tm-endturn-prep.js': 'cf4212811c0aedd6d88b6612938be5e917f4efe0050891fdd09fb8f39148f78c',
  'web/tm-tax-policy.js': 'bf1ecac91e094095264780a51356ef987b3406622dc8eccf81828bed0650072e',
  'web/tm-endturn-core.js': 'deba2faf6f311f675ac1cbdd44516c3561e09a38564fbd28f8d0ebb24ba76174',
  'web/tm-endturn-timing-ledger.js': '689d6258f97b4adb70458074c90641471587cad391ac59a5d9df0d0779be291a',
  'main-impl.js': '4454c59e7de3932af1a4c8359041cad18ac144bb0d76d942008e096642c75d87'
};
// 此前发给玩家的修复包写入过的哈希（v1·2026-10-13 凌晨）：已修过一次的 app.asar 允许再次覆盖。
const PRIOR = {
  'web/editor-authoring-agent.js': ['0a7c20dbd99bc477b3975dabb0d54d6255753cabfd67fce94e934b8742921650'],
  'web/editor-authoring-agent-ui.js': ['76bc0a2575fff2f5a5c2a3b8b331161c970ab1d7ac1f2906617a5cdad54febf2'],
  'web/map-editor-juben-handoff.js': ['6c470a6eb43e575d795be56f3015f5e288ed2455f72f9053af67a0f83ccd930f'],
  'web/map-editor-to-game.js': ['40e945cc992f9e422d8bc6e31582e8b81c5327c3d113d39a4dded40b36e5ce63'],
  'web/tm-save-lifecycle.js': ['f8630477e9a55d6d064daeeada04472dbb4918dfb0d902aa5e2f53310c3d9b18']
};
// hotUpdate=false 的文件不在热更新目录（content/hot-updates/versions/1.3.5.3）里，只修 app.asar。
const FILES = [
  { asarPath: 'web/editor-authoring-agent.js', hotUpdate: true },
  { asarPath: 'web/editor-authoring-agent-ui.js', hotUpdate: true },
  { asarPath: 'web/map-editor-juben-handoff.js', hotUpdate: true },
  { asarPath: 'web/map-editor-to-game.js', hotUpdate: true },
  { asarPath: 'web/tm-save-lifecycle.js', hotUpdate: true },
  { asarPath: 'web/tm-save-world-validation.js', hotUpdate: true },
  { asarPath: 'web/tm-endturn-edict.js', hotUpdate: true },
  { asarPath: 'web/tm-endturn-prep.js', hotUpdate: true },
  { asarPath: 'web/tm-tax-policy.js', hotUpdate: true },
  { asarPath: 'web/tm-endturn-core.js', hotUpdate: true },
  { asarPath: 'web/tm-endturn-timing-ledger.js', hotUpdate: true },
  { asarPath: 'main-impl.js', hotUpdate: false }
];

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

fs.mkdirSync(PAYLOAD, { recursive: true });
const keep = new Set();
const entries = FILES.map(function (file) {
  const src = path.join(ROOT, file.asarPath);
  const name = path.basename(file.asarPath);
  const buffer = fs.readFileSync(src);
  const hash = sha256(buffer);
  if (!ORIGINAL[file.asarPath]) throw new Error('missing original hash for ' + file.asarPath);
  if (hash === ORIGINAL[file.asarPath]) console.warn('[build-payload] WARN unchanged against 1.3.5.3: ' + file.asarPath);
  fs.writeFileSync(path.join(PAYLOAD, name), buffer);
  keep.add(name);
  return {
    path: name,
    asarPath: file.asarPath,
    hotUpdate: file.hotUpdate,
    sha256: hash,
    bytes: buffer.length,
    originalSha256: ORIGINAL[file.asarPath],
    priorSha256: PRIOR[file.asarPath] || []
  };
});
fs.readdirSync(PAYLOAD).forEach(function (name) {
  if (!keep.has(name)) { fs.rmSync(path.join(PAYLOAD, name), { force: true }); console.log('[build-payload] removed stale payload file ' + name); }
});
const manifest = { schema: 2, product: 'tianming', version: VERSION, generatedAt: new Date().toISOString(), files: entries };
fs.writeFileSync(path.join(KIT, 'payload-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
entries.forEach(function (e) { console.log('[build-payload] ' + e.asarPath + '  ' + e.bytes + ' bytes  ' + e.sha256 + (e.hotUpdate ? '' : '  (asar only)')); });
console.log('[build-payload] wrote ' + entries.length + ' files to ' + path.relative(ROOT, PAYLOAD));
