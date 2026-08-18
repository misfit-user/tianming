// ============================================================
//  verify-deploy-local.js — S9 通用 deploy.py 本地全链路模拟
//  合成制品（桌面 zip+feed / capgo zip+manifest+对象包+latest / 安装包 yml+exe）→
//  python deploy.py --base-dir <模拟服务器> --assets-dir <本地资产>
//  场景：全量部署 / 幂等重跑 / enable-manifest / disable-manifest 回退 /
//        zip 篡改中止 / 版本降级闸 / manifest 缺对象闸 / dry-run 零写 / 清单缺文件中止
//  运行：node web/scripts/verify-deploy-local.js
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEPLOY = path.join(ROOT, 'scripts', 'deploy.py');
const HOT_BUILDER = path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js');
const CAPGO_BUILDER = path.join(ROOT, 'mobile', 'scripts', 'build-capgo-bundle.ps1');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-verify-deploy-'));
const VER = '9.0.0.1';

let assertions = 0;
function assert(cond, label) {
  if (cond) { assertions++; console.log('  ok·' + label); }
  else { console.error('  FAIL·' + label); process.exit(1); }
}
function readJson(p) {
  let raw = fs.readFileSync(p, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

// ── 合成制品 ──────────────────────────────────────────────────────────────────
const ASSETS = path.join(TMP, 'assets');
const SIM = path.join(TMP, 'srv');
fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(SIM, { recursive: true });

// 桌面侧·合成 web 树 → 真构建器产 zip+feed
const WEB = path.join(TMP, 'web');
const APP = path.join(TMP, 'app');
fs.mkdirSync(WEB, { recursive: true });
fs.mkdirSync(path.join(APP, 'scenarios'), { recursive: true });
fs.writeFileSync(path.join(WEB, 'index.html'),
  '<html><head><meta name="tm-version" content="' + VER + '"></head><body><script src="a.js"></script></body></html>');
fs.writeFileSync(path.join(WEB, 'a.js'), 'var a=1;');
fs.writeFileSync(path.join(WEB, 'styles.css'), 'body{}');
fs.writeFileSync(path.join(WEB, 'changelog.json'), JSON.stringify({ entries: [{ date: '2026-06-11', module: VER + '·更新功能升级测试', title: 't', items: [] }] }));
fs.writeFileSync(path.join(WEB, 'version.json'), JSON.stringify({ version: VER }));
fs.writeFileSync(path.join(APP, 'main-impl.js'), '// main');
fs.writeFileSync(path.join(APP, 'preload-impl.js'), '// preload');
let r = spawnSync('node', [HOT_BUILDER, '--version', VER, '--out', ASSETS, '--notes', 'deploy-verify',
  '--web-root', WEB, '--app-root', APP, '--unsigned-test-only'], { encoding: 'utf-8' });
assert(r.status === 0, '制品·桌面热更构建（' + (r.status === 0 ? 'ok' : r.stderr) + '）');
fs.copyFileSync(path.join(WEB, 'changelog.json'), path.join(ASSETS, 'changelog.json'));

// 安卓侧·真构建器产全量 zip + manifest + 对象包
r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', CAPGO_BUILDER,
  '-Version', VER, '-WebDir', WEB, '-OutDir', ASSETS, '-Manifest', '-PackFiles'], { encoding: 'utf-8' });
assert(r.status === 0, '制品·capgo 构建（' + (r.status === 0 ? 'ok' : (r.stderr || r.stdout)) + '）');
const capgoManifest = readJson(path.join(ASSETS, VER + '-manifest.json'));
const capgoBuild = readJson(path.join(ASSETS, VER + '-build.json'));
fs.writeFileSync(path.join(ASSETS, 'latest.json'), JSON.stringify({
  version: VER,
  url: 'https://api.themisfitserspeople.top/tianming/capgo/bundles/' + VER + '.zip',
  size: capgoBuild.zipBytes,
  manifest: capgoManifest.manifest
}));

// 安装包侧·假 exe + blockmap + latest.yml（sha512 base64 真算）
const exeBytes = crypto.randomBytes(64 * 1024);
const sha512b64 = crypto.createHash('sha512').update(exeBytes).digest('base64');
fs.writeFileSync(path.join(ASSETS, 'tianming-setup-' + VER + '-x64.exe'), exeBytes);
fs.writeFileSync(path.join(ASSETS, 'tianming-setup-' + VER + '-x64.exe.blockmap'), 'BLOCKMAP');
fs.writeFileSync(path.join(ASSETS, 'latest.yml'),
  'version: 9.0.0\n' +
  'files:\n' +
  '  - url: 天命-9.0.0-x64.exe\n' +
  '    sha512: ' + sha512b64 + '\n' +
  '    size: ' + exeBytes.length + '\n' +
  'path: 天命-9.0.0-x64.exe\n' +
  'sha512: ' + sha512b64 + '\n' +
  'size: ' + exeBytes.length + '\n' +
  'releaseDate: 2026-06-11\n');

function deploy(args) {
  return spawnSync('python', [DEPLOY, '--version', VER, '--base-dir', SIM, '--assets-dir', ASSETS, '--skip-verify'].concat(args || []),
    { encoding: 'utf-8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
}

// ── A·全量首发 ──
r = deploy([]);
assert(r.status === 0, 'A·全量部署 exit 0（' + (r.status === 0 ? 'ok' : (r.stdout + r.stderr).slice(-400)) + '）');
const hotFeed = readJson(path.join(SIM, 'hot', 'hot-latest.json'));
assert(hotFeed.version === VER, 'A·hot-latest.json 发布');
assert(fs.existsSync(path.join(SIM, 'hot', 'tianming-hot-' + VER + '.zip')), 'A·热更整包就位');
assert(fs.existsSync(path.join(SIM, 'hot', 'manifests', VER + '.json')), 'A·manifest 就位');
const desktopManifest = readJson(path.join(SIM, 'hot', 'manifests', VER + '.json'));
const sampleFile = desktopManifest.files[0];
assert(fs.existsSync(path.join(SIM, 'hot', 'files', sampleFile.sha256.slice(0, 2), sampleFile.sha256.slice(2), path.basename(sampleFile.path))), 'A·sha 寻址库落位');
assert(readJson(path.join(SIM, 'changelog.json')).entries[0].module.indexOf(VER) === 0, 'A·邸报落位');
const capgoLatest1 = readJson(path.join(SIM, 'capgo', 'latest.json'));
assert(capgoLatest1.version === VER && capgoLatest1.url && !capgoLatest1.manifest, 'A·capgo latest 默认剥 manifest（全量兜底·灰度前安全态）');
assert(fs.existsSync(path.join(SIM, 'capgo', 'bundles', VER + '.zip')), 'A·capgo bundle 就位');
const objCount = fs.readdirSync(path.join(SIM, 'capgo', 'files')).length;
assert(objCount === capgoBuild.packedCount, 'A·capgo 对象库 ' + objCount + ' 个全落位');
assert(fs.existsSync(path.join(SIM, 'releases', 'win', '天命-9.0.0-x64.exe')), 'A·安装包按 yml path 还原中文名');
assert(fs.existsSync(path.join(SIM, 'releases', 'win', '天命-9.0.0-x64.exe.blockmap')), 'A·blockmap 就位（差量安装）');
assert(fs.existsSync(path.join(SIM, 'releases', 'win', 'latest.yml')), 'A·latest.yml 最后发布');

// ── B·幂等重跑 ──
r = deploy([]);
assert(r.status === 0 && /已是 v/.test(r.stdout), 'B·同版本重跑·feed 跳过·exit 0');
assert(/已有跳过/.test(r.stdout) || /skipped/.test(r.stdout), 'B·对象库 skip-if-exists');

// ── C·--enable-manifest 灰度开差量 ──
r = deploy(['--only', 'capgo', '--enable-manifest']);
assert(r.status === 0, 'C·enable-manifest exit 0');
const capgoLatest2 = readJson(path.join(SIM, 'capgo', 'latest.json'));
assert(Array.isArray(capgoLatest2.manifest) && capgoLatest2.manifest.length === capgoManifest.manifest.length, 'C·latest.json 已带差量 manifest');
assert(capgoLatest2.url && capgoLatest2.size, 'C·url+size 兜底字段仍在（旧客户端契约）');

// ── D·--disable-manifest 即时回退 ──
r = deploy(['--only', 'capgo', '--disable-manifest']);
assert(r.status === 0, 'D·disable-manifest exit 0');
assert(!readJson(path.join(SIM, 'capgo', 'latest.json')).manifest, 'D·manifest 已剥·全量回退');
assert(fs.readdirSync(path.join(SIM, 'capgo')).some(n => n.indexOf('latest.json.bak-') === 0), 'D·旧 feed 留 .bak');

// ── E·zip 篡改 → 中止·服务器不动 ──
{
  const SIM2 = path.join(TMP, 'srv2');
  fs.mkdirSync(SIM2, { recursive: true });
  const zipAsset = path.join(ASSETS, 'tianming-hot-' + VER + '.zip');
  const orig = fs.readFileSync(zipAsset);
  const bad = Buffer.from(orig); bad[100] = bad[100] ^ 0xff;
  fs.writeFileSync(zipAsset, bad);
  r = spawnSync('python', [DEPLOY, '--version', VER, '--base-dir', SIM2, '--assets-dir', ASSETS, '--skip-verify', '--only', 'desktop'], { encoding: 'utf-8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
  assert(r.status === 2 && /sha256/.test(r.stdout), 'E·zip 篡改 → sha 闸中止 exit 2');
  assert(!fs.existsSync(path.join(SIM2, 'hot', 'hot-latest.json')), 'E·feed 未发布·服务器不动');
  fs.writeFileSync(zipAsset, orig);
}

// ── F·版本降级闸 ──
{
  // 把模拟服务器的 hot feed 版本抬高 → 再部署 9.0.0.1 = 降级
  const hp = path.join(SIM, 'hot', 'hot-latest.json');
  const f = readJson(hp); f.version = '9.9.9.9';
  fs.writeFileSync(hp, JSON.stringify(f));
  r = deploy(['--only', 'desktop']);
  assert(r.status === 5 && /不单调/.test(r.stdout), 'F·降级 → 单调闸中止 exit 5');
  r = deploy(['--only', 'desktop', '--force']);
  assert(r.status === 0 && /--force 放行/.test(r.stdout), 'F·--force 显式放行');
}

// ── G·capgo manifest 缺对象 → latest.json 拒发 ──
{
  // 删一个对象 + 拿走对象包资产（模拟后补 enable 时对象已不可再落）
  const objs = fs.readdirSync(path.join(SIM, 'capgo', 'files'));
  fs.rmSync(path.join(SIM, 'capgo', 'files', objs[0]));
  const packAsset = path.join(ASSETS, 'capgo-files-' + VER + '.zip');
  const packBak = packAsset + '.hold';
  fs.renameSync(packAsset, packBak);
  r = deploy(['--only', 'capgo', '--enable-manifest']);
  assert(r.status === 7 && /不在 capgo\/files/.test(r.stdout), 'G·缺对象 → 完备闸拒发 exit 7');
  fs.renameSync(packBak, packAsset);
  r = deploy(['--only', 'capgo', '--enable-manifest']);
  assert(r.status === 0, 'G·对象包归位 → 重跑自愈通过');
}

// ── H·dry-run 零写 ──
{
  const SIM3 = path.join(TMP, 'srv3');
  fs.mkdirSync(SIM3, { recursive: true });
  r = spawnSync('python', [DEPLOY, '--version', VER, '--base-dir', SIM3, '--assets-dir', ASSETS, '--skip-verify', '--dry-run'], { encoding: 'utf-8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
  assert(r.status === 0, 'H·dry-run exit 0');
  const leftovers = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else leftovers.push(p);
    });
  })(SIM3);
  assert(leftovers.length === 0, 'H·dry-run 不留任何文件（' + leftovers.length + '）');
}

// ── I·清单列了 zip 里没有的文件 → ABORT_INCOMPLETE ──
{
  const SIM4 = path.join(TMP, 'srv4');
  fs.mkdirSync(SIM4, { recursive: true });
  const AdmZip = require('adm-zip');
  const zipAsset = path.join(ASSETS, 'tianming-hot-' + VER + '.zip');
  const orig = fs.readFileSync(zipAsset);
  const z = new AdmZip(zipAsset);
  const m = JSON.parse(z.readAsText('manifest.json'));
  m.files.push({ path: 'ghost.js', sha256: 'a'.repeat(64), size: 1 });
  z.updateFile('manifest.json', Buffer.from(JSON.stringify(m)));
  z.writeZip(zipAsset);
  // feed sha 也要跟上（否则死在 sha 闸·测不到完备闸）
  const feed = readJson(path.join(ASSETS, 'hot-latest.json'));
  feed.sha256 = crypto.createHash('sha256').update(fs.readFileSync(zipAsset)).digest('hex');
  feed.size = fs.statSync(zipAsset).size;
  fs.writeFileSync(path.join(ASSETS, 'hot-latest.json'), JSON.stringify(feed));
  r = spawnSync('python', [DEPLOY, '--version', VER, '--base-dir', SIM4, '--assets-dir', ASSETS, '--skip-verify', '--only', 'desktop'], { encoding: 'utf-8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
  assert(r.status === 3 && /ABORT_INCOMPLETE/.test(r.stdout), 'I·清单幽灵文件 → ABORT_INCOMPLETE exit 3（1.3.3.4 服务器侧最后防线）');
  assert(!fs.existsSync(path.join(SIM4, 'hot', 'hot-latest.json')), 'I·feed 未发布');
  fs.writeFileSync(zipAsset, orig);
}

console.log('PASS assertions=' + assertions);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
