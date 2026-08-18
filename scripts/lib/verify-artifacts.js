// ============================================================
//  verify-artifacts.js — 发布制品独立复验器（不信构建器·二道防线）
//  2026-06-11·更新功能全面升级 S8
//
//  capgo·   验差量 manifest schema（@capgo/capacitor-updater 契约）/ 全量 zip ↔ manifest
//           对账 / 对象库覆盖（每个 hash 在 files 库或新对象包或基线里）/ 抽样重哈希
//  desktop· 验热更 zip ↔ manifest 双向一致 / feed sha256·size 对账 / 必含文件
//
//  模块用法（release.js）·
//    const { verifyCapgo, verifyDesktop } = require('./lib/verify-artifacts.js');
//  CLI 用法·
//    node scripts/lib/verify-artifacts.js capgo --manifest <p> [--zip <p>] [--files-dir <d>]
//         [--files-zip <p>] [--baseline <p>] [--base-url <u>] [--version <v>]
//    node scripts/lib/verify-artifacts.js desktop --zip <p> --feed <p> --manifest <p>
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJson(file) {
  let raw = fs.readFileSync(file, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // 容 BOM
  return JSON.parse(raw);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const HEX64 = /^[0-9a-f]{64}$/;

function verifyAuthenticatedDocument(document, expectedType, publicKeyPath) {
  const problems = [];
  const auth = document && document.auth;
  if (!auth || auth.algorithm !== 'Ed25519') return { ok: false, problems: ['缺少 Ed25519 发布者签名'], payload: null };
  if (typeof auth.payload !== 'string' || typeof auth.signature !== 'string') {
    return { ok: false, problems: ['签名字段不完整'], payload: null };
  }
  let payloadBytes;
  let signature;
  try {
    payloadBytes = Buffer.from(auth.payload, 'base64');
    signature = Buffer.from(auth.signature, 'base64');
  } catch (_) {
    return { ok: false, problems: ['签名不是有效 base64'], payload: null };
  }
  if (!payloadBytes.length || signature.length !== 64
      || payloadBytes.toString('base64') !== auth.payload
      || signature.toString('base64') !== auth.signature) {
    problems.push('签名编码不是规范 Ed25519/base64');
  }
  const keyFile = path.resolve(publicKeyPath || path.join(__dirname, '..', '..', 'resources', 'hot-update-public-key.pem'));
  if (!fs.existsSync(keyFile)) return { ok: false, problems: problems.concat(['固定热更新公钥缺失']), payload: null };
  let publicKey;
  try { publicKey = crypto.createPublicKey(fs.readFileSync(keyFile)); }
  catch (error) { return { ok: false, problems: problems.concat(['固定热更新公钥不可解析·' + error.message]), payload: null }; }
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const keyId = crypto.createHash('sha256').update(der).digest('hex').slice(0, 24);
  if (auth.keyId !== keyId) problems.push('签名 keyId 与固定公钥不匹配');
  if (signature.length === 64 && !crypto.verify(null, payloadBytes, publicKey, signature)) problems.push('Ed25519 发布者签名无效');
  let payload = null;
  try { payload = JSON.parse(payloadBytes.toString('utf8')); }
  catch (_) { problems.push('已签名载荷不是有效 JSON'); }
  if (payload) {
    if (payload.type !== expectedType) problems.push('已签名载荷 type 异常·' + payload.type);
    if (payload.appId !== 'com.tianming.history') problems.push('已签名载荷 appId 异常·' + payload.appId);
    if (!/^(stable|beta)$/.test(String(payload.channel || ''))) problems.push('已签名载荷 channel 异常·' + payload.channel);
    const expiry = Date.parse(payload.expiresAt || '');
    if (!Number.isFinite(expiry) || expiry < Date.now() - 5 * 60 * 1000) problems.push('已签名载荷已过期或无有效期');
    const outer = Object.assign({}, document);
    delete outer.auth;
    if (JSON.stringify(outer) !== JSON.stringify(payload)) problems.push('签名外层字段与已签名载荷不一致');
  }
  return { ok: problems.length === 0, problems, payload };
}

// ── capgo 差量制品复验 ────────────────────────────────────────────────────────
// opts: { manifestPath, zipPath?, filesDir?, filesZipPath?, baselinePath?, baseUrl?, version?, sampleN? }
function verifyCapgo(opts) {
  const problems = [];
  const stats = {};
  const m = readJson(opts.manifestPath);
  const arr = Array.isArray(m.manifest) ? m.manifest : [];
  stats.manifestCount = arr.length;

  if (opts.version && String(m.version) !== String(opts.version)) {
    problems.push('manifest.version=' + m.version + ' ≠ 期望 ' + opts.version);
  }
  if (!arr.length) problems.push('manifest 数组为空');

  const baseUrl = String(opts.baseUrl || '').replace(/\/$/, '');
  const names = new Set();
  arr.forEach(e => {
    const fn = String(e.file_name || '');
    const fh = String(e.file_hash || '');
    const du = String(e.download_url || '');
    if (!fn || fn.startsWith('/') || fn.indexOf('..') !== -1) problems.push('file_name 非法·' + fn);
    if (names.has(fn)) problems.push('file_name 重复·' + fn);
    names.add(fn);
    if (!HEX64.test(fh)) problems.push('file_hash 非 64 位小写 hex·' + fn + '·' + fh);
    if (baseUrl && du !== baseUrl + '/files/' + fh) problems.push('download_url 不合约·' + fn + '·' + du);
  });
  if (!names.has('index.html')) problems.push('manifest 缺 index.html（Capgo bundle 必须有入口）');

  // 全量 zip ↔ manifest 对账（同一棵 staging 树两种产物·必须一致）
  if (opts.zipPath) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(opts.zipPath);
    const zipSet = new Set(zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName.replace(/\\/g, '/')));
    stats.zipCount = zipSet.size;
    const onlyZip = [...zipSet].filter(p => !names.has(p));
    const onlyManifest = [...names].filter(p => !zipSet.has(p));
    onlyZip.slice(0, 10).forEach(p => problems.push('仅在 zip 不在 manifest·' + p));
    onlyManifest.slice(0, 10).forEach(p => problems.push('仅在 manifest 不在 zip·' + p));
    if (onlyZip.length > 10 || onlyManifest.length > 10) problems.push('…对账差异共 ' + (onlyZip.length + onlyManifest.length) + ' 处');
  }

  // 对象覆盖·每个 hash 必须能落位（files 库 / 新对象包 / 基线已在服务器）
  const baselineSet = new Set();
  if (opts.baselinePath && fs.existsSync(opts.baselinePath)) {
    const b = readJson(opts.baselinePath);
    const bArr = Array.isArray(b) ? b : (Array.isArray(b.manifest) ? b.manifest : []);
    bArr.forEach(e => { if (e.file_hash) baselineSet.add(String(e.file_hash).toLowerCase()); });
  }
  const packSet = new Set();
  if (opts.filesZipPath && fs.existsSync(opts.filesZipPath)) {
    const AdmZip = require('adm-zip');
    new AdmZip(opts.filesZipPath).getEntries().forEach(e => { if (!e.isDirectory) packSet.add(path.basename(e.entryName)); });
    stats.packCount = packSet.size;
  }
  const inFilesDir = h => opts.filesDir && fs.existsSync(path.join(opts.filesDir, h));
  let uncovered = 0;
  arr.forEach(e => {
    const h = String(e.file_hash || '').toLowerCase();
    if (!HEX64.test(h)) return;
    if (!baselineSet.has(h) && !packSet.has(h) && !inFilesDir(h)) {
      uncovered++;
      if (uncovered <= 10) problems.push('对象无处落位（不在基线/对象包/files库）·' + e.file_name + '·' + h);
    }
  });
  if (uncovered > 10) problems.push('…未覆盖对象共 ' + uncovered + ' 个');

  // 抽样重哈希·防对象库被写坏（≤sampleN·小集合全验）
  const sampleN = Number(opts.sampleN || 25);
  const verifiable = arr.filter(e => inFilesDir(String(e.file_hash).toLowerCase()));
  const step = Math.max(1, Math.floor(verifiable.length / sampleN));
  let sampled = 0;
  for (let i = 0; i < verifiable.length; i += step) {
    const e = verifiable[i];
    const h = String(e.file_hash).toLowerCase();
    const actual = sha256File(path.join(opts.filesDir, h));
    sampled++;
    if (actual !== h) problems.push('对象内容与哈希不符（库被写坏）·' + e.file_name + '·存 ' + h + ' 实 ' + actual);
  }
  stats.sampled = sampled;

  return { ok: problems.length === 0, problems, stats };
}

// ── desktop 热更制品复验 ──────────────────────────────────────────────────────
// opts: { zipPath, feedPath, manifestPath }
function verifyDesktop(opts) {
  const problems = [];
  const stats = {};
  const AdmZip = require('adm-zip');
  const feedDocument = readJson(opts.feedPath);
  const manifestDocument = readJson(opts.manifestPath);
  const feedAuth = verifyAuthenticatedDocument(feedDocument, 'tianming-hot-update-feed', opts.publicKeyPath);
  const manifestAuth = verifyAuthenticatedDocument(manifestDocument, 'tianming-hot-update', opts.publicKeyPath);
  feedAuth.problems.forEach(problem => problems.push('feed auth·' + problem));
  manifestAuth.problems.forEach(problem => problems.push('manifest auth·' + problem));
  const feed = feedAuth.payload || feedDocument;
  const manifest = manifestAuth.payload || manifestDocument;

  if (feed.type !== 'tianming-hot-update-feed') problems.push('feed.type 异常·' + feed.type);
  if (manifest.type !== 'tianming-hot-update') problems.push('manifest.type 异常·' + manifest.type);
  if (String(feed.version) !== String(manifest.version)) problems.push('feed/manifest 版本不一致·' + feed.version + ' vs ' + manifest.version);

  const zipStat = fs.statSync(opts.zipPath);
  if (Number(feed.size) !== zipStat.size) problems.push('feed.size=' + feed.size + ' ≠ zip 实际 ' + zipStat.size);
  const actualSha = sha256File(opts.zipPath);
  if (String(feed.sha256 || '').toLowerCase() !== actualSha) problems.push('feed.sha256 与 zip 实际不符');

  const zip = new AdmZip(opts.zipPath);
  const embeddedEntry = zip.getEntry('manifest.json');
  if (!embeddedEntry) problems.push('zip 缺 manifest.json');
  else {
    try {
      const embeddedDocument = JSON.parse(embeddedEntry.getData().toString('utf8'));
      const embeddedAuth = verifyAuthenticatedDocument(embeddedDocument, 'tianming-hot-update', opts.publicKeyPath);
      embeddedAuth.problems.forEach(problem => problems.push('zip manifest auth·' + problem));
      if (JSON.stringify(embeddedDocument) !== JSON.stringify(manifestDocument)) problems.push('zip manifest 与独立 manifest 不同字节语义');
    } catch (error) {
      problems.push('zip manifest 不可解析·' + error.message);
    }
  }
  const zipSet = new Set(zip.getEntries().filter(e => !e.isDirectory).map(e => e.entryName.replace(/\\/g, '/')));
  zipSet.delete('manifest.json');
  const mSet = new Set((manifest.files || []).map(f => f.path));
  stats.zipCount = zipSet.size;
  stats.manifestCount = mSet.size;
  const onlyZip = [...zipSet].filter(p => !mSet.has(p));
  const onlyManifest = [...mSet].filter(p => !zipSet.has(p));
  onlyZip.slice(0, 10).forEach(p => problems.push('仅在 zip·' + p));
  onlyManifest.slice(0, 10).forEach(p => problems.push('仅在清单·' + p));
  if (onlyZip.length > 10 || onlyManifest.length > 10) problems.push('…对账差异共 ' + (onlyZip.length + onlyManifest.length) + ' 处');

  ['index.html', 'changelog.json'].forEach(p => {
    if (!mSet.has(p)) problems.push('必含文件缺失·' + p);
  });
  ['_app_main.js', '_app_preload.js'].forEach(p => {
    if (mSet.has(p) || zipSet.has(p)) problems.push('内容 OTA 禁止携带 Electron 可执行代码·' + p);
  });

  return { ok: problems.length === 0, problems, stats };
}

module.exports = { verifyCapgo, verifyDesktop, verifyAuthenticatedDocument, readJson, sha256File, sha256Buffer };

// ── CLI ──
if (require.main === module) {
  const mode = process.argv[2];
  const arg = (name, dflt) => {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
  };
  let res;
  if (mode === 'capgo') {
    res = verifyCapgo({
      manifestPath: arg('manifest'),
      zipPath: arg('zip', ''),
      filesDir: arg('files-dir', ''),
      filesZipPath: arg('files-zip', ''),
      baselinePath: arg('baseline', ''),
      baseUrl: arg('base-url', 'https://api.themisfitserspeople.top/tianming/capgo'),
      version: arg('version', ''),
      sampleN: Number(arg('sample', 25))
    });
  } else if (mode === 'desktop') {
    res = verifyDesktop({ zipPath: arg('zip'), feedPath: arg('feed'), manifestPath: arg('manifest') });
  } else {
    console.error('用法: verify-artifacts.js capgo|desktop --…（见文件头）');
    process.exit(2);
  }
  console.log('[verify-artifacts] ' + mode + '·' + JSON.stringify(res.stats));
  if (!res.ok) {
    res.problems.forEach(p => console.error('  问题·' + p));
    console.error('FAIL·' + res.problems.length + ' 处问题');
    process.exit(1);
  }
  console.log('PASS·制品复验通过');
}
