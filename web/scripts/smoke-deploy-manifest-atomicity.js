// Desktop/Capgo deployment manifest/path/hash/streaming/concurrency regression.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..', '..');
const DEPLOY = path.join(ROOT, 'scripts', 'deploy.py');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-deploy-atomicity-'));
const VER = '9.7.0.1';
const PY_ENV = Object.assign({}, process.env, { PYTHONUTF8: '1' });
let assertions = 0;

function assert(condition, label) {
  if (!condition) throw new Error('FAIL·' + label);
  assertions++;
  console.log('  ok·' + label);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writeSmallAssets(directory, editManifest, editZip) {
  fs.mkdirSync(directory, { recursive: true });
  const files = [
    { path: 'a.js', data: Buffer.from('var deployAtomicity = true;\n') },
    { path: 'nested/中文.json', data: Buffer.from('{"ok":true}\n') }
  ];
  const manifest = {
    version: VER,
    files: files.map((row) => ({ path: row.path, sha256: sha256(row.data), size: row.data.length }))
  };
  if (editManifest) editManifest(manifest, files);
  const zip = new AdmZip();
  files.forEach((row) => zip.addFile(row.path, row.data));
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
  if (editZip) editZip(zip, manifest, files);
  const zipPath = path.join(directory, 'tianming-hot-' + VER + '.zip');
  zip.writeZip(zipPath);
  const zipBytes = fs.readFileSync(zipPath);
  fs.writeFileSync(path.join(directory, 'hot-latest.json'), JSON.stringify({
    version: VER,
    sha256: sha256(zipBytes),
    size: zipBytes.length
  }));
  return { manifest, files, zipPath };
}

function deployArgs(server, assets, extra, channel) {
  return [DEPLOY, '--version', VER, '--base-dir', server, '--assets-dir', assets,
    '--skip-verify', '--only', channel || 'desktop'].concat(extra || []);
}

function runDeploy(server, assets, extra, channel) {
  return spawnSync('python', deployArgs(server, assets, extra, channel), {
    encoding: 'utf8', env: PY_ENV, maxBuffer: 32 * 1024 * 1024
  });
}

function spawnDeploy(server, assets, extra, channel) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', deployArgs(server, assets, extra, channel), { env: PY_ENV });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function objectPath(server, row) {
  return path.join(server, 'hot', 'files', row.sha256.slice(0, 2), row.sha256.slice(2), path.basename(row.path));
}

function capgoObjectPath(server, objectHash) {
  return path.join(server, 'capgo', 'files', objectHash);
}

function writeCapgoAssets(directory, options) {
  options = options || {};
  fs.mkdirSync(directory, { recursive: true });
  const expectedData = options.expectedData || Buffer.from('capgo-object-content\n');
  const entryData = options.entryData || expectedData;
  const objectHash = options.objectHash || sha256(expectedData);
  const pack = new AdmZip();
  pack.addFile(objectHash, entryData);
  if (options.duplicate) pack.addFile('duplicate/' + objectHash, entryData);
  pack.writeZip(path.join(directory, 'capgo-files-' + VER + '.zip'));
  const bundle = Buffer.from('capgo-full-bundle\n');
  fs.writeFileSync(path.join(directory, VER + '.zip'), bundle);
  const latest = {
    version: VER,
    url: 'https://example.invalid/' + VER + '.zip',
    size: bundle.length,
    manifest: [{
      file_name: 'capgo-object.bin',
      file_hash: objectHash,
      download_url: 'https://example.invalid/files/' + objectHash
    }]
  };
  fs.writeFileSync(path.join(directory, 'latest.json'), JSON.stringify(latest));
  return { objectHash, expectedData, latest };
}

function tempLeaks(root) {
  const leaks = [];
  (function walk(directory) {
    if (!fs.existsSync(directory)) return;
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name !== '.deploy.lock' &&
          (entry.name.startsWith('.deploy-') || /\.(?:tmp|new|part)$/.test(entry.name))) leaks.push(full);
    });
  })(root);
  return leaks;
}

function createLargeAssets(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const script = [
    'import hashlib,json,os,sys,zipfile',
    'out=sys.argv[1]',
    'ver=sys.argv[2]',
    'size=300*1024*1024',
    'chunk=b"\\0"*(1024*1024)',
    'h=hashlib.sha256()',
    'zp=os.path.join(out,"tianming-hot-"+ver+".zip")',
    'with zipfile.ZipFile(zp,"w",zipfile.ZIP_DEFLATED,compresslevel=1) as z:',
    '  with z.open("large.bin","w",force_zip64=True) as target:',
    '    for _ in range(300):',
    '      target.write(chunk); h.update(chunk)',
    '  manifest={"version":ver,"files":[{"path":"large.bin","sha256":h.hexdigest(),"size":size}]}',
    '  z.writestr("manifest.json",json.dumps(manifest,separators=(",",":")))',
    'zh=hashlib.sha256()',
    'with open(zp,"rb") as source:',
    '  for part in iter(lambda:source.read(1024*1024),b""): zh.update(part)',
    'feed={"version":ver,"sha256":zh.hexdigest(),"size":os.path.getsize(zp)}',
    'open(os.path.join(out,"hot-latest.json"),"w",encoding="utf8").write(json.dumps(feed))'
  ].join('\n');
  const result = spawnSync('python', ['-c', script, directory, VER], { encoding: 'utf8', env: PY_ENV });
  assert(result.status === 0, '300MB 流式测试制品生成');
  return readJson(path.join(directory, 'hot-latest.json'));
}

function createLargeCapgoAssets(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const script = [
    'import hashlib,json,os,sys,zipfile',
    'out=sys.argv[1]',
    'ver=sys.argv[2]',
    'chunk=b"\\0"*(1024*1024)',
    'h=hashlib.sha256()',
    'for _ in range(300): h.update(chunk)',
    'object_hash=h.hexdigest()',
    'pack=os.path.join(out,"capgo-files-"+ver+".zip")',
    'with zipfile.ZipFile(pack,"w",zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:',
    '  with z.open(object_hash,"w",force_zip64=True) as target:',
    '    for _ in range(300): target.write(chunk)',
    'bundle=b"capgo-full-bundle\\n"',
    'open(os.path.join(out,ver+".zip"),"wb").write(bundle)',
    'latest={"version":ver,"url":"https://example.invalid/"+ver+".zip","size":len(bundle),"manifest":[{"file_name":"large.bin","file_hash":object_hash,"download_url":"https://example.invalid/files/"+object_hash}]}',
    'open(os.path.join(out,"latest.json"),"w",encoding="utf8").write(json.dumps(latest))'
  ].join('\n');
  const result = spawnSync('python', ['-c', script, directory, VER], { encoding: 'utf8', env: PY_ENV });
  assert(result.status === 0, '300MB Capgo 流式测试制品生成');
  return readJson(path.join(directory, 'latest.json'));
}

async function main() {
  try {
    const goodAssets = path.join(TMP, 'assets-good');
    const good = writeSmallAssets(goodAssets);
    const goodServer = path.join(TMP, 'server-good');
    let result = runDeploy(goodServer, goodAssets);
    assert(result.status === 0, '合法 manifest 部署成功');
    const firstObject = objectPath(goodServer, good.manifest.files[0]);
    assert(fs.existsSync(firstObject), '对象按已验证 sha256 寻址');
    assert(sha256(fs.readFileSync(firstObject)) === good.manifest.files[0].sha256, '落盘对象内容 hash 正确');
    assert(readJson(path.join(goodServer, 'hot', 'hot-latest.json')).version === VER, '内容与 manifest 后才发布 feed');
    assert(tempLeaks(goodServer).length === 0, '成功部署不残留共享或唯一临时文件');

    const invalidCases = [
      ['sha 路径载荷', (manifest) => { manifest.files[0].sha256 = '../../..'; }, 'MANIFEST_SHA_INVALID'],
      ['非 hex sha', (manifest) => { manifest.files[0].sha256 = 'g'.repeat(64); }, 'MANIFEST_SHA_INVALID'],
      ['63 位 sha', (manifest) => { manifest.files[0].sha256 = 'a'.repeat(63); }, 'MANIFEST_SHA_INVALID'],
      ['65 位 sha', (manifest) => { manifest.files[0].sha256 = 'a'.repeat(65); }, 'MANIFEST_SHA_INVALID'],
      ['越界 path', (manifest) => { manifest.files[0].path = '../escape.js'; }, 'MANIFEST_PATH_INVALID'],
      ['重复 manifest path', (manifest) => { manifest.files.push(Object.assign({}, manifest.files[0])); }, 'MANIFEST_PATH_DUPLICATE'],
      ['ZIP size 不符', (manifest) => { manifest.files[0].size += 1; }, 'MANIFEST_SIZE_MISMATCH']
    ];
    invalidCases.forEach((row, index) => {
      const assets = path.join(TMP, 'assets-invalid-' + index);
      writeSmallAssets(assets, row[1]);
      const server = path.join(TMP, 'server-invalid-' + index);
      const attempt = runDeploy(server, assets);
      assert(attempt.status === 3 && attempt.stdout.includes(row[2]), row[0] + ' 在写盘前拒绝');
      assert(!fs.existsSync(path.join(server, 'hot', 'hot-latest.json')), row[0] + ' 不发布 feed');
    });

    const mismatchAssets = path.join(TMP, 'assets-hash-mismatch');
    writeSmallAssets(mismatchAssets, null, (zip, _manifest, files) => {
      zip.updateFile('a.js', Buffer.alloc(files[0].data.length, 0x78));
    });
    const mismatchServer = path.join(TMP, 'server-hash-mismatch');
    fs.mkdirSync(path.join(mismatchServer, 'hot'), { recursive: true });
    const oldFeedBytes = Buffer.from('{"version":"9.6.9.9","sentinel":"unchanged"}\n');
    fs.writeFileSync(path.join(mismatchServer, 'hot', 'hot-latest.json'), oldFeedBytes);
    result = runDeploy(mismatchServer, mismatchAssets);
    if (result.status !== 3 || !result.stdout.includes('OBJECT_HASH_MISMATCH')) {
      throw new Error('FAIL·实际 entry hash 不符时拒绝\n' + (result.stdout + result.stderr).slice(-800));
    }
    assert(true, '实际 entry hash 不符时拒绝');
    assert(fs.readFileSync(path.join(mismatchServer, 'hot', 'hot-latest.json')).equals(oldFeedBytes), '中途失败时 live feed 字节不变');
    assert(!fs.existsSync(path.join(mismatchServer, 'hot', 'manifests', VER + '.json')), '内容失败时版本 manifest 不发布');
    assert(tempLeaks(mismatchServer).length === 0, '内容失败清理唯一临时文件');
    const goodFeedBeforeRetry = fs.readFileSync(path.join(goodServer, 'hot', 'hot-latest.json'));
    result = runDeploy(goodServer, mismatchAssets);
    assert(result.status === 3 && result.stdout.includes('OBJECT_HASH_MISMATCH'), '已有正确对象也不能遮蔽 ZIP 内损坏 entry');
    assert(fs.readFileSync(path.join(goodServer, 'hot', 'hot-latest.json')).equals(goodFeedBeforeRetry), '幂等重跑内容损坏时 feed 仍不变');

    const largeAssets = path.join(TMP, 'assets-large');
    createLargeAssets(largeAssets);
    const memoryServer = path.join(TMP, 'server-memory');
    result = runDeploy(memoryServer, largeAssets, ['--dry-run', '--report-peak-memory']);
    const peakMatch = result.stdout.match(/PEAK_TRACED_BYTES=(\d+)/);
    assert(result.status === 0 && peakMatch, '300MB 条目 dry-run 完整校验成功并报告峰值');
    const peakBytes = Number(peakMatch[1]);
    assert(peakBytes < 48 * 1024 * 1024, '300MB 条目 Python traced peak < 48MiB（实际 ' + Math.round(peakBytes / 1048576) + 'MiB）');

    const capgoAssets = path.join(TMP, 'assets-capgo-good');
    const capgoGood = writeCapgoAssets(capgoAssets);
    const capgoServer = path.join(TMP, 'server-capgo-good');
    const corruptObject = capgoObjectPath(capgoServer, capgoGood.objectHash);
    fs.mkdirSync(path.dirname(corruptObject), { recursive: true });
    fs.writeFileSync(corruptObject, 'truncated');
    result = runDeploy(capgoServer, capgoAssets, [], 'capgo');
    assert(result.status === 0, 'Capgo 对象包部署成功');
    assert(result.stdout.includes('既有对象损坏·重新写入'), '同名损坏 Capgo 对象不会被错误跳过');
    assert(sha256File(corruptObject) === capgoGood.objectHash, '损坏 Capgo 对象被原子重写为正确内容');
    assert(fs.readFileSync(corruptObject).equals(capgoGood.expectedData), 'Capgo 对象落盘内容完整');
    assert(readJson(path.join(capgoServer, 'capgo', 'latest.json')).version === VER, 'Capgo 对象完成后才发布 latest feed');
    assert(tempLeaks(capgoServer).length === 0, 'Capgo 成功部署不残留临时文件');

    const duplicateCapgoAssets = path.join(TMP, 'assets-capgo-duplicate');
    writeCapgoAssets(duplicateCapgoAssets, { duplicate: true });
    const duplicateCapgoServer = path.join(TMP, 'server-capgo-duplicate');
    fs.mkdirSync(path.join(duplicateCapgoServer, 'capgo'), { recursive: true });
    const duplicateFeedBytes = Buffer.from('{"version":"9.6.9.9","sentinel":"duplicate-unchanged"}\n');
    fs.writeFileSync(path.join(duplicateCapgoServer, 'capgo', 'latest.json'), duplicateFeedBytes);
    result = runDeploy(duplicateCapgoServer, duplicateCapgoAssets, [], 'capgo');
    assert(result.status === 7 && result.stdout.includes('CAPGO_OBJECT_DUPLICATE'), 'Capgo 对象包重复 hash 在任何对象写入前拒绝');
    assert(fs.readFileSync(path.join(duplicateCapgoServer, 'capgo', 'latest.json')).equals(duplicateFeedBytes), 'Capgo 重复对象失败不改变 live feed');
    assert(tempLeaks(duplicateCapgoServer).length === 0, 'Capgo 重复对象失败清理临时文件');

    const mismatchCapgoAssets = path.join(TMP, 'assets-capgo-mismatch');
    writeCapgoAssets(mismatchCapgoAssets, {
      expectedData: Buffer.from('expected-capgo-object\n'),
      entryData: Buffer.from('corrupt-capgo-object\n')
    });
    const mismatchCapgoServer = path.join(TMP, 'server-capgo-mismatch');
    fs.mkdirSync(path.join(mismatchCapgoServer, 'capgo'), { recursive: true });
    const mismatchCapgoFeedBytes = Buffer.from('{"version":"9.6.9.9","sentinel":"hash-unchanged"}\n');
    fs.writeFileSync(path.join(mismatchCapgoServer, 'capgo', 'latest.json'), mismatchCapgoFeedBytes);
    result = runDeploy(mismatchCapgoServer, mismatchCapgoAssets, [], 'capgo');
    assert(result.status === 7 && result.stdout.includes('CAPGO_OBJECT_HASH_MISMATCH'), 'Capgo 对象名实不符时拒绝');
    assert(fs.readFileSync(path.join(mismatchCapgoServer, 'capgo', 'latest.json')).equals(mismatchCapgoFeedBytes), 'Capgo hash 失败不改变 live feed');
    assert(tempLeaks(mismatchCapgoServer).length === 0, 'Capgo hash 失败不残留临时文件');

    const largeCapgoAssets = path.join(TMP, 'assets-capgo-large');
    createLargeCapgoAssets(largeCapgoAssets);
    const largeCapgoServer = path.join(TMP, 'server-capgo-memory');
    result = runDeploy(largeCapgoServer, largeCapgoAssets, ['--dry-run', '--report-peak-memory'], 'capgo');
    const capgoPeakMatch = result.stdout.match(/PEAK_TRACED_BYTES=(\d+)/);
    assert(result.status === 0 && capgoPeakMatch, '300MB Capgo 对象 dry-run 完整校验成功并报告峰值');
    const capgoPeakBytes = Number(capgoPeakMatch[1]);
    assert(capgoPeakBytes < 48 * 1024 * 1024, '300MB Capgo 对象 Python traced peak < 48MiB（实际 ' + Math.round(capgoPeakBytes / 1048576) + 'MiB）');
    assert(tempLeaks(largeCapgoServer).length === 0, 'Capgo 大对象 dry-run 不残留临时文件');

    const concurrentServer = path.join(TMP, 'server-concurrent');
    const first = spawnDeploy(concurrentServer, largeAssets);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = spawnDeploy(concurrentServer, largeAssets);
    const pair = await Promise.all([first, second]);
    assert(pair[0].status === 0 && pair[1].status === 0, '两个并发部署进程均完成');
    assert(pair.some((item) => item.stdout.includes('等待部署锁')), '并发进程通过部署互斥锁串行化');
    const largeManifest = readJson(path.join(concurrentServer, 'hot', 'manifests', VER + '.json'));
    const largeObject = objectPath(concurrentServer, largeManifest.files[0]);
    assert(fs.statSync(largeObject).size === 300 * 1024 * 1024, '并发后 300MB 对象完整');
    assert(sha256File(largeObject) === largeManifest.files[0].sha256, '并发后对象 hash 正确');
    assert(readJson(path.join(concurrentServer, 'hot', 'hot-latest.json')).version === VER, '并发后 live feed 有效');
    assert(tempLeaks(concurrentServer).length === 0, '并发部署不残留临时文件');

    console.log('PASS assertions=' + assertions);
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((error) => {
  console.error(error && error.stack || error);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  process.exit(1);
});
