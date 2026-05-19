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

const WEB_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(WEB_ROOT, '..');

const ALLOWED_EXTS = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json', '.geojson', '.png', '.jpg', '.jpeg', '.webp',
  '.bmp', '.svg', '.ico', '.mp3', '.ogg', '.wav', '.md', '.txt', '.csv', '.woff', '.woff2',
  '.ttf', '.wasm', '.map'
]);

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', '.cache', '.tmp', 'tmp', 'dist', 'build', 'release', 'coverage'
]);

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

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function normalizeRel(file) {
  return path.relative(WEB_ROOT, file).replace(/\\/g, '/');
}

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const abs = path.join(dir, entry.name);
    const rel = normalizeRel(abs);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) return;
      walk(abs, out);
      return;
    }
    if (!entry.isFile()) return;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) return;
    out.push(abs);
  });
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf-8'));
    return (pkg.build && pkg.build.buildVersion) || pkg.version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

function main() {
  const version = String(arg('version', '')).trim();
  if (!version) {
    console.error('Missing --version, example: --version 1.2.0.1');
    process.exit(1);
  }
  const outDir = path.resolve(APP_ROOT, arg('out', 'release-hot'));
  const notes = String(arg('notes', '') || '');
  const minAppVersion = String(arg('min-app-version', readPackageVersion()) || '');
  const packageName = arg('package-name', 'tianming-hot-' + version + '.zip');
  const packageUrl = arg('package-url', packageName);
  const includePreview = flag('include-preview');
  const explicitFiles = listArg('files');

  const files = [];
  if (explicitFiles.length) {
    explicitFiles.forEach(rel => {
      const abs = path.resolve(WEB_ROOT, rel);
      if (!abs.startsWith(WEB_ROOT + path.sep)) {
        console.error('file outside web root:', rel);
        process.exit(1);
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        console.error('file not found:', rel);
        process.exit(1);
      }
      files.push(abs);
    });
  } else {
    walk(WEB_ROOT, files);
  }
  const filtered = includePreview || explicitFiles.length ? files : files.filter(file => !normalizeRel(file).startsWith('preview/'));
  if (!explicitFiles.length && !filtered.some(file => normalizeRel(file) === 'index.html')) {
    console.error('index.html not found in hot-update file list');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, packageName);
  const zip = new AdmZip();
  const manifestFiles = filtered.sort().map(file => {
    const rel = normalizeRel(file);
    const stat = fs.statSync(file);
    zip.addLocalFile(file, path.dirname(rel) === '.' ? '' : path.dirname(rel));
    return { path: rel, sha256: sha256File(file), size: stat.size };
  });

  const manifest = {
    type: 'tianming-hot-update',
    version,
    entry: 'index.html',
    minAppVersion,
    generatedAt: new Date().toISOString(),
    files: manifestFiles,
    remove: []
  };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));
  zip.writeZip(zipPath);

  const zipStat = fs.statSync(zipPath);
  const feed = {
    type: 'tianming-hot-update-feed',
    version,
    packageUrl,
    sha256: sha256File(zipPath),
    size: zipStat.size,
    notes,
    generatedAt: manifest.generatedAt
  };
  fs.writeFileSync(path.join(outDir, 'hot-latest.json'), JSON.stringify(feed, null, 2), 'utf-8');

  console.log('[hot-update] package:', zipPath);
  console.log('[hot-update] feed:', path.join(outDir, 'hot-latest.json'));
  console.log('[hot-update] files:', manifestFiles.length);
}

main();
