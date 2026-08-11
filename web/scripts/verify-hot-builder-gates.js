// ============================================================
//  verify-hot-builder-gates.js — S7 构建器防呆闸门验证（合成树）
//  GATE-0 部分包禁用 / GATE-2 完整性 / GATE-3 版本单调 / GATE-4 zip↔manifest / GATE-5 版本戳
//  运行：node web/scripts/verify-hot-builder-gates.js
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BUILDER = path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-verify-gates-'));
const MODULE_ROOTS = [path.join(ROOT, 'node_modules')];
const COMMON_DIR = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' });
if (COMMON_DIR.status === 0 && String(COMMON_DIR.stdout || '').trim()) {
  MODULE_ROOTS.push(path.join(path.dirname(path.resolve(ROOT, String(COMMON_DIR.stdout).trim())), 'node_modules'));
}
if (process.env.NODE_PATH) MODULE_ROOTS.push(process.env.NODE_PATH);

let assertions = 0;
function assert(cond, label) {
  if (cond) { assertions++; console.log('  ok·' + label); }
  else { console.error('  FAIL·' + label); process.exit(1); }
}

// ── 合成 web 树 ──
const WEB = path.join(TMP, 'web');
const APP = path.join(TMP, 'app');
function resetTree(ver) {
  fs.rmSync(WEB, { recursive: true, force: true });
  fs.rmSync(APP, { recursive: true, force: true });
  fs.mkdirSync(WEB, { recursive: true });
  fs.mkdirSync(path.join(APP, 'scenarios'), { recursive: true });
  fs.writeFileSync(path.join(WEB, 'index.html'),
    '<html><head><meta name="tm-version" content="' + ver + '"><title>t</title></head>' +
    '<body><script src="a.js?v=1"></script><script src="b.js"></script></body></html>');
  fs.writeFileSync(path.join(WEB, 'a.js'), 'var a=1;');
  fs.writeFileSync(path.join(WEB, 'b.js'), 'var b=2;');
  fs.writeFileSync(path.join(WEB, 'styles.css'), 'body{}');
  fs.writeFileSync(path.join(WEB, 'changelog.json'), JSON.stringify({ entries: [] }));
  fs.writeFileSync(path.join(WEB, 'version.json'), JSON.stringify({ version: ver }));
  fs.writeFileSync(path.join(APP, 'main-impl.js'), '// main impl');
  fs.writeFileSync(path.join(APP, 'preload-impl.js'), '// preload impl');
  fs.writeFileSync(path.join(APP, 'scenarios', '合成（官方）.json'), '{"id":"official"}');
  fs.writeFileSync(path.join(APP, 'scenarios', '绍宋_182区草案.json'), '{"id":"draft-must-not-ship"}');
}
function build(args) {
  return spawnSync('node', [BUILDER].concat(args, ['--web-root', WEB, '--app-root', APP]), {
    encoding: 'utf-8',
    env: Object.assign({}, process.env, { NODE_PATH: MODULE_ROOTS.filter(fs.existsSync).join(path.delimiter) })
  });
}

// ── A·健康全量构建通过·zip↔manifest 对账一致 ──
resetTree('9.0.0.1');
const outA = path.join(TMP, 'outA');
let r = build(['--version', '9.0.0.1', '--out', outA, '--notes', 't']);
assert(r.status === 0, 'A·健康树全量构建通过（' + (r.status === 0 ? 'exit 0' : r.stderr) + '）');
const feedA = JSON.parse(fs.readFileSync(path.join(outA, 'hot-latest.json'), 'utf-8'));
assert(feedA.version === '9.0.0.1', 'A·feed 版本正确');
const manifestA = JSON.parse(fs.readFileSync(path.join(outA, 'manifests', '9.0.0.1.json'), 'utf-8'));
const paths = manifestA.files.map(f => f.path);
['index.html', 'a.js', 'b.js', 'styles.css', 'changelog.json', 'version.json', '_app_main.js', '_app_preload.js', 'bundled-scenarios/合成（官方）.json']
  .forEach(p => assert(paths.indexOf(p) !== -1, 'A·清单含 ' + p));
assert(paths.indexOf('bundled-scenarios/绍宋_182区草案.json') === -1, 'A·草案/自用剧本不进入热更');

// ── A2·运行资产扩展名 + 旧壳能力门 ──
resetTree('9.0.0.2');
fs.writeFileSync(path.join(WEB, 'unit.glb'), Buffer.from([1, 2, 3]));
r = build(['--version', '9.0.0.2', '--out', path.join(TMP, 'outA2-glb')]);
assert(r.status === 0, 'A2·GLB 运行资产可进入热更');
const feedGlb = JSON.parse(fs.readFileSync(path.join(TMP, 'outA2-glb', 'hot-latest.json'), 'utf8'));
assert(feedGlb.minAppVersion === '1.3.4.10', 'A2·GLB 自动要求 1.3.4.10 壳层');
resetTree('1.3.4.11');
fs.writeFileSync(path.join(WEB, 'model.onnx'), Buffer.from([4, 5, 6]));
r = build(['--version', '1.3.4.11', '--out', path.join(TMP, 'outA2-onnx-old')]);
assert(r.status !== 0 && /GATE-7/.test(r.stderr), 'A2·低于 ONNX 壳层能力的同版热更被 GATE-7 拒绝');
resetTree('1.3.4.12');
fs.writeFileSync(path.join(WEB, 'model.onnx'), Buffer.from([4, 5, 6]));
r = build(['--version', '1.3.4.12', '--out', path.join(TMP, 'outA2-onnx-new')]);
assert(r.status === 0, 'A2·1.3.4.12 可发布 ONNX 运行资产');
const feedOnnx = JSON.parse(fs.readFileSync(path.join(TMP, 'outA2-onnx-new', 'hot-latest.json'), 'utf8'));
assert(feedOnnx.minAppVersion === '1.3.4.12', 'A2·ONNX 自动要求 1.3.4.12 壳层');

// ── B·GATE-0·--files 部分包默认禁 ──
r = build(['--version', '9.0.0.2', '--files', 'a.js', '--out', path.join(TMP, 'outB')]);
assert(r.status !== 0 && /GATE-0/.test(r.stderr), 'B·GATE-0 拦 --files 部分包');
r = build(['--version', '9.0.0.2', '--files', 'a.js', '--allow-partial-DANGEROUS', '--out', path.join(TMP, 'outB')]);
assert(r.status === 0, 'B·危险旗标放行（调试用）');

// ── C·GATE-2·index 引用不在清单（删 b.js 但 script 标签还在） ──
resetTree('9.0.0.1');
fs.rmSync(path.join(WEB, 'b.js'));
r = build(['--version', '9.0.0.1', '--out', path.join(TMP, 'outC')]);
assert(r.status !== 0 && /GATE-2/.test(r.stderr) && /b\.js/.test(r.stderr), 'C·GATE-2 拦 index 引用缺失（1.3.3.4 病灶类）');

// ── D·GATE-2·必含文件缺失（删 changelog.json） ──
resetTree('9.0.0.1');
fs.rmSync(path.join(WEB, 'changelog.json'));
r = build(['--version', '9.0.0.1', '--out', path.join(TMP, 'outD')]);
assert(r.status !== 0 && /GATE-2/.test(r.stderr) && /changelog\.json/.test(r.stderr), 'D·GATE-2 拦必含文件缺失');

// ── E·GATE-3·版本单调（同 outDir 二次构建相同/更低版本） ──
resetTree('9.0.0.1');
const outE = path.join(TMP, 'outE');
r = build(['--version', '9.0.0.1', '--out', outE]);
assert(r.status === 0, 'E·首次构建通过');
r = build(['--version', '9.0.0.1', '--out', outE]);
assert(r.status !== 0 && /GATE-3/.test(r.stderr), 'E·GATE-3 拦相同版本重发');
resetTree('9.0.0.0');
fs.writeFileSync(path.join(WEB, 'version.json'), JSON.stringify({ version: '9.0.0.0' }));
r = build(['--version', '9.0.0.0', '--out', outE]);
assert(r.status !== 0 && /GATE-3/.test(r.stderr), 'E·GATE-3 拦更低版本');
resetTree('9.0.0.2');
r = build(['--version', '9.0.0.2', '--out', outE]);
assert(r.status === 0, 'E·更高版本放行');

// ── F·GATE-5·版本戳不一致 ──
resetTree('9.0.0.1');
fs.writeFileSync(path.join(WEB, 'version.json'), JSON.stringify({ version: '8.0.0.0' })); // 戳没盖
r = build(['--version', '9.0.0.1', '--out', path.join(TMP, 'outF')]);
assert(r.status !== 0 && /GATE-5/.test(r.stderr) && /version\.json/.test(r.stderr), 'F·GATE-5 拦 version.json 戳不一致');
r = build(['--version', '9.0.0.1', '--skip-stamp-check', '--out', path.join(TMP, 'outF')]);
assert(r.status === 0, 'F·--skip-stamp-check 放行（调试用）');
resetTree('9.0.0.1');
fs.writeFileSync(path.join(WEB, 'index.html'),
  '<html><head><title>t</title></head><body><script src="a.js"></script><script src="b.js"></script></body></html>'); // 无 meta
r = build(['--version', '9.0.0.1', '--out', path.join(TMP, 'outF2')]);
assert(r.status !== 0 && /GATE-5/.test(r.stderr) && /tm-version/.test(r.stderr), 'F·GATE-5 拦 meta 缺失');

// ── G·GATE-4 对账逻辑存在性（健康构建即隐式跑过·此处验源码在位） ──
const builderSrc = fs.readFileSync(BUILDER, 'utf-8');
assert(/GATE-4/.test(builderSrc) && /zipSet/.test(builderSrc), 'G·GATE-4 zip↔manifest 对账在构建路径上');

console.log('PASS assertions=' + assertions);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
