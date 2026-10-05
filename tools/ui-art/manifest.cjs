#!/usr/bin/env node
// 新前端资产清单：web/ui/assets 下的二进制资产（模型、光照贴图、贴图、字体、高程）不进 git，
// 在 web/ui/assets/manifest.json 里逐件记 字节、sha256、由谁重建。
//   node tools/ui-art/manifest.cjs build   重写清单（资产重建之后跑）
//   node tools/ui-art/manifest.cjs check   核对现有文件与清单：缺、改、多一律报出，有出入退出码 1（发版前置）
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'web', 'ui', 'assets');
const MANIFEST = path.join(ASSETS, 'manifest.json');
const SKIP = new Set(['.gitignore', 'manifest.json']);

// 路径 → 重建方法（源件常驻 D:/tianming-ui-rebuild-20260926，不放 Temp）
const RULES = [
  [/^fonts\//, 'python tools/ui-art/fonts/build-fonts.py ← 字体原件（OFL，见 fonts/LICENSES.md）'],
  [/^study\/room\.glb$|^study\/room-lightmap\.hdr$/, 'blender -b --factory-startup -P tools/ui-art/blender/build_room.py -- bake=2048 samples=192'],
  [/^study\/props\.glb$/, 'blender -b --factory-startup -P tools/ui-art/blender/build_props.py'],
  [/^study\/tex\//, 'python tools/ui-art/tex/make_textures.py ← art/r3、art/r4 生图原稿与 art/pd 公有领域名画'],
  [/^map\/dem\.png$/, 'python tools/ui-art/map/build_dem.py ← Terrain Tiles（SRTM、GMTED2010、ETOPO1，见 map/NOTICE.md）']
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (!SKIP.has(e.name) && !e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function rel(file) {
  return path.relative(ASSETS, file).replace(/\\/g, '/');
}

function build() {
  const files = walk(ASSETS).sort();
  const entries = {};
  let unknown = 0;
  for (const f of files) {
    const r = rel(f);
    const rule = RULES.find(([re]) => re.test(r));
    if (!rule) unknown++;
    entries[r] = { bytes: fs.statSync(f).size, sha256: sha256(f), rebuild: rule ? rule[1] : '未登记重建方法' };
  }
  const total = Object.values(entries).reduce((a, e) => a + e.bytes, 0);
  const doc = { schema: 'tm-ui-assets/1', generatedBy: 'tools/ui-art/manifest.cjs', fileCount: files.length, totalBytes: total, files: entries };
  fs.writeFileSync(MANIFEST, JSON.stringify(doc, null, 1) + '\n');
  console.log(`[ui-assets] 写出清单：${files.length} 件，共 ${(total / 1e6).toFixed(1)} MB${unknown ? `；${unknown} 件未登记重建方法` : ''}`);
  return unknown ? 1 : 0;
}

function check() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('[ui-assets] 没有清单 web/ui/assets/manifest.json');
    return 1;
  }
  const doc = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const want = doc.files || {};
  const have = new Map(walk(ASSETS).map((f) => [rel(f), f]));
  const problems = [];
  for (const [r, e] of Object.entries(want)) {
    const f = have.get(r);
    if (!f) problems.push(`缺：${r}（${e.rebuild}）`);
    else if (fs.statSync(f).size !== e.bytes || sha256(f) !== e.sha256) problems.push(`改：${r}`);
  }
  for (const r of have.keys()) if (!want[r]) problems.push(`多：${r}（清单里没有）`);
  if (problems.length) {
    console.error(`[ui-assets] FAIL ${problems.length} 处与清单不符：`);
    problems.slice(0, 40).forEach((p) => console.error('  ' + p));
    if (problems.length > 40) console.error(`  …另 ${problems.length - 40} 处`);
    return 1;
  }
  console.log(`[ui-assets] PASS ${Object.keys(want).length} 件与清单一致`);
  return 0;
}

const cmd = process.argv[2];
process.exit(cmd === 'build' ? build() : cmd === 'check' ? check() : (console.error('用法：manifest.cjs build|check'), 2));
