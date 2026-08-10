#!/usr/bin/env node
// scripts/find-orphans.js — 找出从未被任何 HTML <script src=> 引用的 .js 文件
// 不代表真的可以删除（可能是动态 import 或 worker），但是值得审视的候选

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.bak-r103', '.bak-r106', '.git', 'node_modules', 'scripts', 'docs', 'vendor', '_archive', 'backups', 'godot', '.playwright-cli', '_pw-scratch', '_screenshots', 'dev-tools']);
const SKIP_PATTERNS = [/\.backup/, /\.bak(-r\d+)?/, /_rebuilt/];
function shouldSkip(file, name) {
  if (SKIP_PATTERNS.some(re => re.test(name))) return true;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  return /^preview\/_.*\.js$/i.test(rel);
}

function* walk(dir, ext) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name), ext);
    } else if (e.isFile() && ext.test(e.name)) {
      const file = path.join(dir, e.name);
      if (!shouldSkip(file, e.name)) yield file;
    }
  }
}

const htmlFiles = [...walk(ROOT, /\.html$/)];
const jsFiles = [...walk(ROOT, /\.js$/)];
const referencedSrcs = new Set();

// 从 HTML 收 <script src>
htmlFiles.forEach(f => {
  const html = fs.readFileSync(f, 'utf8');
  const re = /<script\s+[^>]*\bsrc="([^"?]+)(?:\?[^"]*)?"/g;
  let m;
  while ((m = re.exec(html))) {
    if (/^https?:/.test(m[1])) continue;
    const abs = path.resolve(path.dirname(f), m[1]);
    referencedSrcs.add(abs);
  }
});

// 也扫 JS 里的 importScripts / require / import from / new Worker / dynamic import
jsFiles.forEach(f => {
  const js = fs.readFileSync(f, 'utf8');
  // 各种动态引用模式
  const patterns = [
    /(?:importScripts|require)\s*\(['"]([^'"]+)['"]/g,
    /import\s+[^;]+\s+from\s*['"]([^'"]+)['"]/g,
    /import\s*\(['"]([^'"]+)['"]/g,
    /new\s+Worker\s*\(['"]([^'"]+)['"]/g,          // new Worker('tm-worker.js')
    /new\s+SharedWorker\s*\(['"]([^'"]+)['"]/g,
    // Dynamically injected scripts, e.g. var BUNDLE_URL='x.js?v=1';
    // script.src = BUNDLE_URL is intentionally lazy and should not force
    // a large payload into index.html just to appease this checker.
    /\b[A-Za-z0-9_$]*(?:URL|Url|SRC|Src)\b\s*=\s*['"]([^'"]+?\.js)(?:\?[^'"]*)?['"]/g,
    /\b(?:src|href)\s*=\s*['"]([^'"]+?\.js)(?:\?[^'"]*)?['"]/g
  ];
  patterns.forEach(re => {
    let m;
    while ((m = re.exec(js))) {
      if (/^https?:/.test(m[1])) continue;
      const abs = path.resolve(path.dirname(f), m[1]);
      referencedSrcs.add(abs);
    }
  });
});

// 官方剧本采用 manifest 驱动的按需 <script> 注入：index.html 只静态加载
// bundled-scenarios/manifest.js + tm-official-scenario-loader.js，真正的 7-8MB 剧本脚本
// 由 loader 在玩家选中剧本后读取 entry.scriptUrl/builtinScript 再挂载。它们不是传统
// import/src 字面量，不能按孤岛处理；直接把大剧本塞回 index.html 又会破坏首屏懒加载。
const officialManifestPath = path.join(ROOT, 'bundled-scenarios', 'manifest.json');
if (fs.existsSync(officialManifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(officialManifestPath, 'utf8'));
    const entries = manifest && Array.isArray(manifest.entries) ? manifest.entries : [];
    entries.forEach(entry => {
      ['scriptUrl', 'builtinScript'].forEach(key => {
        if (!entry || typeof entry[key] !== 'string') return;
        const rel = entry[key].split(/[?#]/, 1)[0].replace(/\\/g, '/').replace(/^\/+/, '');
        if (!rel || /^https?:/i.test(rel)) return;
        const abs = path.resolve(ROOT, rel);
        const inside = path.relative(ROOT, abs);
        if (inside.startsWith('..') || path.isAbsolute(inside)) {
          console.warn('[find-orphans] 官方剧本清单路径越界，已忽略:', entry[key]);
          return;
        }
        referencedSrcs.add(abs);
      });
    });
  } catch (e) {
    console.warn('[find-orphans] 官方剧本清单扫描失败:', e.message);
  }
}

// package.json scripts 里的 Node 工具入口也是有效引用，例如:
//   "prepare-vendor": "node tools/download-bge-model.js"
const packageJsonPath = path.join(ROOT, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = pkg && pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
    Object.values(scripts).forEach(cmd => {
      if (typeof cmd !== 'string') return;
      const re = /(?:^|[\s;&|])node(?:\.exe)?(?:\s+--?[A-Za-z0-9:_=./\\-]+)*\s+(?:"([^"]+\.js)"|'([^']+\.js)'|([^\s;&|]+\.js))/g;
      let m;
      while ((m = re.exec(cmd))) {
        const rel = m[1] || m[2] || m[3];
        if (!rel || /^https?:/.test(rel)) continue;
        referencedSrcs.add(path.resolve(ROOT, rel));
      }
    });
  } catch (e) {
    console.warn('[find-orphans] package.json scripts 扫描失败:', e.message);
  }
}

// 过滤 .gitignore 里标注为非生产的文件 (dev-only scripts)
const gitignorePath = path.join(ROOT, '.gitignore');
const devOnly = new Set();
if (fs.existsSync(gitignorePath)) {
  const gi = fs.readFileSync(gitignorePath, 'utf8');
  // 找 "本地调试脚本" 附近的条目
  gi.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    if (/\.js$/.test(t) && !t.includes('*')) {
      devOnly.add(path.resolve(ROOT, t));
    }
  });
}

const orphans = jsFiles.filter(f => !referencedSrcs.has(f) && !devOnly.has(f));
const devOnlyCount = jsFiles.filter(f => devOnly.has(f)).length;
console.log(`[find-orphans] 总计 ${jsFiles.length} 个 .js · ${referencedSrcs.size} 个被引用 · ${devOnlyCount} 个 dev-only (gitignored) · ${orphans.length} 个真孤岛`);
if (orphans.length === 0) {
  console.log('[find-orphans] ✓ 没有孤岛文件');
  process.exit(0);
} else {
  console.log('\n真孤岛文件（没有 HTML script src + 没有 Worker/import 引用 + 不在 gitignore 的 dev-only 里）:');
  orphans.forEach(f => {
    const rel = path.relative(ROOT, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    console.log(`  · ${rel} (${lines} 行)`);
  });
  process.exit(1);
}
