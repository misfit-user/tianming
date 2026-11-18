#!/usr/bin/env node
// 派生文件：一条命令按依赖顺序重生成，或检查它们是否过期。
//
//   node scripts/regen-derived.js                 重生成（按工作区内容）
//   node scripts/regen-derived.js --staged        两份哈希清单按暂存区内容算——只提交一部分改动时用
//   node scripts/regen-derived.js --check         只检查；过期则列出并以 1 退出
//   node scripts/regen-derived.js --check --head  按已提交内容检查（推送钩子用：工作区里没提交的改动不算数）
//   其它：--scenarios / --no-scenarios  强制带上或跳过官方剧本那一组（默认：相对主干改过才带；跳过时随包剧本在基线里沿用已提交的值）
//         --after-lint                  刚跑过 lint-arch-all，复用它留下的 global-providers 报告
//
// 为什么要有它：主干上六成提交都得跟着改 web/.hot-update-manifest.json 与 web/tm-start-runtime-manifest.json
// （它们记着每个脚本的哈希），几条线一变基就在这两份文件上相撞。相撞时不必手工解——取哪一侧都行，
// 变基完跑一次本脚本，结果只取决于最终的文件内容。配套的合并驱动见 .gitattributes 与 CONTRIBUTING。
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'web');

const RUNTIME_MANIFEST = 'web/tm-start-runtime-manifest.json';
const PHASE_MANIFEST = 'web/startup-script-phases.json';
const HOT_BASELINE = 'web/.hot-update-manifest.json';

// 本脚本管的派生文件（仓内相对路径；以 / 结尾的是目录前缀）。.gitattributes 里挂合并驱动的是同一批。
const DERIVED_OUTPUTS = [
  RUNTIME_MANIFEST,
  PHASE_MANIFEST,
  HOT_BASELINE,
  'web/scenarios/',
  'web/bundled-scenarios/',
  'web/preview/official-scenarios-bundle.js',
  'web/preview/scenario-editor-reset-data.js',
  'web/data/maps/scenario-library/'
];

// 官方剧本那一组的产物（DERIVED_OUTPUTS 里除去三份清单的那几项）
const SCENARIO_OUTPUTS = DERIVED_OUTPUTS.filter((rel) => ![RUNTIME_MANIFEST, PHASE_MANIFEST, HOT_BASELINE].includes(rel));

// 官方剧本那一组的输入：真源、生成器、以及产物本身（产物被动过也要重新对一遍）
const SCENARIO_INPUTS = [
  'scenarios/',
  'main-official-scenario.js',
  'scripts/build-map-editor-scenario-library.cjs',
  'web/map-editor-scenario-geometry.js',
  'web/scripts/sync-official-scenarios.js',
  'web/scripts/official-scenario-source.js',
  'web/scripts/official-scenario-expression.js',
  'web/scripts/build-scenario-editor-reset-data.js',
  'web/scripts/editor-reset-inventory.js',
  'web/scenarios/',
  'web/bundled-scenarios/',
  'web/preview/official-scenarios-bundle.js',
  'web/preview/scenario-editor-reset-data.js',
  'web/data/maps/scenario-library/'
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function matchesAny(rel, list) {
  return list.some((item) => (item.endsWith('/') ? rel.startsWith(item) : rel === item));
}

function isDerivedOutput(rel) {
  return matchesAny(rel, DERIVED_OUTPUTS);
}

// ---------- git ----------

function git(args, options) {
  const result = spawnSync('git', args, Object.assign({ cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 }, options || {}));
  return { ok: !result.error && result.status === 0, stdout: result.stdout || Buffer.alloc(0) };
}

// 以 NUL 分隔的路径清单；命令失败返回 null（不在 git 检出里、或浅克隆里拿不到某个引用）
function gitPaths(args) {
  const result = git(args);
  if (!result.ok) return null;
  return result.stdout.toString('utf8').split('\0').filter(Boolean);
}

// 一次取多份对象的内容；取不到的记 null
function gitBlobs(specs) {
  const blobs = new Map();
  if (!specs.length) return blobs;
  const result = git(['cat-file', '--batch'], { input: specs.join('\n') + '\n' });
  if (!result.ok) throw new Error('git cat-file --batch 失败');
  const out = result.stdout;
  let pos = 0;
  for (const spec of specs) {
    const lineEnd = out.indexOf(10, pos);
    const header = out.slice(pos, lineEnd).toString('utf8');
    pos = lineEnd + 1;
    if (/ missing$/.test(header)) { blobs.set(spec, null); continue; }
    const size = Number(header.split(' ')[2]);
    blobs.set(spec, Buffer.from(out.slice(pos, pos + size)));
    pos += size + 1;
  }
  return blobs;
}

// 「看哪一份内容」：
//   worktree  磁盘上是什么就是什么
//   index     将要提交的内容（HEAD 加上已暂存的）
//   head      已经提交的内容
// 没改动的文件直接读磁盘；只有与所看那份不一致的文件才去 git 里取。
function makeView(mode) {
  const lsFiles = gitPaths(['ls-files', '-z']);
  if (mode === 'worktree' || !lsFiles) {
    const tracked = lsFiles ? new Set(lsFiles) : null;
    return {
      mode: 'worktree',
      dirty: new Set(),
      has: (rel) => (tracked ? tracked.has(rel) : true),
      read: (rel) => fs.readFileSync(path.join(ROOT, rel)),
      prefetch() {}
    };
  }
  const head = mode === 'head';
  const tracked = new Set(head ? (gitPaths(['ls-tree', '-r', '-z', '--name-only', 'HEAD']) || []) : lsFiles);
  const diffArgs = ['diff', '-z', '--name-only', '--no-renames'].concat(head ? ['HEAD'] : []);
  const dirty = new Set(gitPaths(diffArgs) || []);
  const prefix = head ? 'HEAD:' : ':';
  const cache = new Map();
  function prefetch(rels) {
    const wanted = rels.filter((rel) => dirty.has(rel) && tracked.has(rel) && !cache.has(rel));
    const blobs = gitBlobs(wanted.map((rel) => prefix + rel));
    for (const rel of wanted) cache.set(rel, blobs.get(prefix + rel));
  }
  function read(rel) {
    if (!dirty.has(rel)) return fs.readFileSync(path.join(ROOT, rel));
    if (!cache.has(rel)) prefetch([rel]);
    const blob = cache.get(rel);
    if (!blob) throw new Error(rel + ' 不在' + (head ? '已提交的内容' : '暂存区') + '里');
    return blob;
  }
  return { mode, dirty, has: (rel) => tracked.has(rel), read, prefetch };
}

// 相对「与 origin/main 的分叉点」改过的路径。拿不到分叉点（浅克隆、没有 origin/main）返回 null，调用方按「都算改过」处理。
function changedSinceBase(view) {
  const base = git(['merge-base', 'HEAD', 'origin/main']);
  if (!base.ok) return null;
  const baseSha = base.stdout.toString('utf8').trim();
  if (!baseSha) return null;
  const committedOnly = view.mode === 'head';
  const changed = gitPaths(['diff', '-z', '--name-only', '--no-renames', baseSha].concat(committedOnly ? ['HEAD'] : []));
  if (!changed) return null;
  const set = new Set(changed);
  if (!committedOnly) (gitPaths(['ls-files', '-z', '--others', '--exclude-standard']) || []).forEach((rel) => set.add(rel));
  return set;
}

// git 认识的路径：HEAD 与分叉点两棵树里跟踪着的，加上分叉点之后各次提交动过的（中途加了又删的也算）。
// 基线里某条对应的文件不见了，靠它分辨是「被删掉的跟踪文件」还是「本工作区缺席的未跟踪资产」——
// 未跟踪资产从不出现在 git 的记录里，所以永远不会被当成前者。
function trackedInHistory() {
  const set = new Set(gitPaths(['ls-tree', '-r', '-z', '--name-only', 'HEAD']) || []);
  const base = git(['merge-base', 'HEAD', 'origin/main']);
  const baseSha = base.ok ? base.stdout.toString('utf8').trim() : '';
  if (baseSha) {
    (gitPaths(['ls-tree', '-r', '-z', '--name-only', baseSha]) || []).forEach((rel) => set.add(rel));
    (gitPaths(['log', '-z', '--name-only', '--no-renames', '--format=', baseSha + '..HEAD']) || [])
      .forEach((rel) => { const clean = rel.replace(/^\n+/, ''); if (clean) set.add(clean); });
  }
  return set;
}

// ---------- 热更基线：纯函数部分 ----------

// 把「按磁盘算出来的清单」校正成「按所看那份内容算」的清单。
//   actual      热更打包器照磁盘现状算出的清单
//   canonical   仓里现有的基线
//   view        makeView 的结果
//   fromDisk    这些路径一律按磁盘算（重生成时，本次刚写出的派生文件还没暂存）
// 返回 { manifest, skippedUntracked }：skippedUntracked 是磁盘上有、git 不认识、基线里也没有的文件——不替人擅自收进基线。
function adjustForView(actual, canonical, view, fromDisk) {
  const canonicalPaths = new Set(((canonical && canonical.files) || []).map((row) => row.path));
  const keepDisk = fromDisk || (() => false);
  const rows = new Map();
  const skippedUntracked = [];
  const dirtyWeb = [];
  for (const row of actual.files) {
    const rel = 'web/' + row.path;
    if (!view.has(rel)) {
      // 未跟踪：基线里本来就有的（立绘、模型这类未跟踪资产，或随包剧本那几份生成物）照磁盘算；基线里没有的不收
      if (canonicalPaths.has(row.path)) rows.set(row.path, row);
      else skippedUntracked.push(row.path);
      continue;
    }
    rows.set(row.path, row);
    if (view.dirty.has(rel) && !keepDisk(rel)) dirtyWeb.push(row.path);
  }
  // 所看那份里有、磁盘上被删了的文件：基线里原本有它，就按那份内容补回来
  for (const rel of view.dirty) {
    if (!rel.startsWith('web/') || keepDisk(rel) || !view.has(rel)) continue;
    const webRel = rel.slice(4);
    if (!rows.has(webRel) && canonicalPaths.has(webRel)) dirtyWeb.push(webRel);
  }
  view.prefetch(dirtyWeb.map((webRel) => 'web/' + webRel));
  for (const webRel of dirtyWeb) {
    const bytes = view.read('web/' + webRel);
    rows.set(webRel, { path: webRel, sha256: sha256(bytes), size: bytes.length });
  }
  const files = actual.files.filter((row) => rows.has(row.path)).map((row) => rows.get(row.path));
  const listed = new Set(files.map((row) => row.path));
  for (const [webRel, row] of rows) if (!listed.has(webRel)) files.push(row);
  return { manifest: Object.assign({}, actual, { files }), skippedUntracked };
}

// 把新算出的清单并进现有基线，不整份重写：
//   - 现有各条保持原来的位置，只换哈希与大小；
//   - 新文件按路径插到相应位置；
//   - 现有某条对应的文件不在新清单里：文件还在磁盘上（发布规则把它排除了）或是被删掉的跟踪文件 → 去掉；
//     否则是本工作区缺席的未跟踪资产（立绘、模型）→ 原样保留。整份重写会把这些条目抹掉，这正是不能用 --write 的原因。
function mergeBaseline(canonical, fresh, probes) {
  const incoming = new Map(fresh.files.map((row) => [row.path, row]));
  const files = [];
  const stats = { updated: [], added: [], removed: [], keptAbsent: 0 };
  for (const row of canonical.files) {
    const next = incoming.get(row.path);
    if (next) {
      if (next.sha256 !== row.sha256 || next.size !== row.size) stats.updated.push(row.path);
      files.push({ path: row.path, sha256: next.sha256, size: next.size });
      incoming.delete(row.path);
    } else if (probes.existsOnDisk(row.path) || probes.trackedInHistory(row.path)) {
      stats.removed.push(row.path);
    } else {
      files.push(row);
      stats.keptAbsent++;
    }
  }
  for (const webRel of Array.from(incoming.keys()).sort()) {
    const row = incoming.get(webRel);
    let at = files.findIndex((existing) => existing.path > webRel);
    if (at < 0) at = files.length;
    files.splice(at, 0, { path: row.path, sha256: row.sha256, size: row.size });
    stats.added.push(webRel);
  }
  const merged = {};
  for (const key of Object.keys(canonical)) {
    if (key === 'files') merged.files = files;
    else if (key === 'generatedAt') merged.generatedAt = canonical.generatedAt;
    else merged[key] = key in fresh ? fresh[key] : canonical[key];
  }
  for (const key of Object.keys(fresh)) if (!(key in merged)) merged[key] = key === 'files' ? files : fresh[key];
  return { manifest: merged, stats };
}

// 官方剧本那一组跳过时（真源与生成器相对主干都没改），剧本产物就该是主干上那份。跟踪着的产物变基时 git 会换成新的，
// 未跟踪的随包剧本（web/bundled-scenarios 下那几份大 JSON）却还是变基前生成的旧货——照磁盘算，旧哈希就进了基线。
// 11-17：本工作区 11-09 生成的晚唐产物在主干改过真源（ba687990）后没重生成，3497707d 把它的旧哈希写进基线，
// 推送钩子拿同一份旧产物比也看不出，main 上 CI 才报 stale（ed15692c 修回）。
// 所以这时这几条一律沿用基线现有的值；磁盘上的对不上，列出来提示重生成（只是本地跑游戏会用旧剧本，不拦）。
//   actual  热更打包器照磁盘算出的清单；返回 { manifest, stale }，stale 是磁盘上与基线对不上的那几份
function pinScenarioProducts(actual, canonical, view) {
  const canonicalRows = new Map(((canonical && canonical.files) || []).map((row) => [row.path, row]));
  const stale = [];
  const files = actual.files.map((row) => {
    const rel = 'web/' + row.path;
    if (view.has(rel) || !matchesAny(rel, SCENARIO_OUTPUTS)) return row;
    const pinned = canonicalRows.get(row.path);
    if (!pinned) return row;
    if (pinned.sha256 !== row.sha256 || pinned.size !== row.size) stale.push(row.path);
    return { path: pinned.path, sha256: pinned.sha256, size: pinned.size };
  });
  return { manifest: Object.assign({}, actual, { files }), stale };
}

function staleProductsNote(stale) {
  if (!stale.length) return '';
  return '      本地这几份随包剧本与基线对不上（多半是变基后没重生成；基线照旧取已提交的值）：'
    + stale.slice(0, 5).join('、') + (stale.length > 5 ? ' …' : '')
    + '\n      本地跑游戏会用到旧剧本，要换成新的：node scripts/regen-derived.js --scenarios';
}

// 基线相对新清单的问题。容忍一种：基线里指向本工作区磁盘上不存在的文件（缺席的未跟踪资产）——
// 除非那是分叉点之后被删掉的跟踪文件，那就是这次改动留下的残条。
function baselineProblems(canonical, fresh, probes) {
  const sync = require('./sync-hot-baseline.js');
  return sync.manifestProblems(canonical, fresh).filter((problem) => {
    const obsolete = /^obsolete canonical path: (.+)$/.exec(problem);
    if (!obsolete) return true;
    return probes.existsOnDisk(obsolete[1]) || probes.trackedInHistory(obsolete[1]);
  });
}

// ---------- 各步 ----------

// 没装依赖的工作区（git worktree 多半如此）借主检出的 node_modules，免得每次手工设 NODE_PATH
let cachedModulePath = null;
function modulePath() {
  if (cachedModulePath !== null) return cachedModulePath;
  const roots = [path.join(ROOT, 'node_modules')];
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const common = commonDir.ok ? commonDir.stdout.toString('utf8').trim() : '';
  if (common) roots.push(path.join(path.dirname(common), 'node_modules'));
  const inherited = String(process.env.NODE_PATH || '').trim();
  cachedModulePath = roots.filter((dir) => fs.existsSync(dir)).concat(inherited ? [inherited] : []).join(path.delimiter);
  return cachedModulePath;
}

function runNode(scriptRel, args, cwd) {
  const result = spawnSync(process.execPath, [path.join(ROOT, scriptRel)].concat(args || []), {
    cwd: cwd || ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true,
    env: Object.assign({}, process.env, { NODE_PATH: modulePath() })
  });
  const output = (String(result.stdout || '') + String(result.stderr || '')).trim();
  return { ok: !result.error && result.status === 0, output };
}

function tail(text, lines) {
  return String(text || '').split(/\r?\n/).filter(Boolean).slice(-(lines || 6)).map((line) => '      ' + line.slice(0, 220)).join('\n');
}

function readJsonText(text) {
  return JSON.parse(String(text).replace(/^﻿/, ''));
}

// 官方剧本：真源 → 内置脚本、随包清单、编辑器重置数据、地图库
function stepScenarios(ctx) {
  const label = '官方剧本产物';
  if (!ctx.runScenarios) return { label, state: 'skipped', note: '真源与生成器相对主干没改动，--scenarios 可强制' };
  const advisory = ctx.view.mode !== 'worktree' && Array.from(ctx.view.dirty).some((rel) => matchesAny(rel, SCENARIO_INPUTS));
  const sync = runNode('web/scripts/sync-official-scenarios.js', ctx.check ? ['--check'] : []);
  if (!sync.ok) return { label, state: ctx.check ? 'stale' : 'failed', advisory, note: tail(sync.output) };
  const library = runNode('scripts/build-map-editor-scenario-library.cjs', [ctx.check ? '--check' : '--write']);
  if (!library.ok) return { label, state: ctx.check ? 'stale' : 'failed', advisory, note: tail(library.output) };
  return { label, state: ctx.check ? 'fresh' : 'done' };
}

// 启动分期清单：index.html 的脚本顺序 + 各脚本提供、消费的全局名
function stepPhases(ctx) {
  const label = '启动分期清单';
  const advisory = ctx.view.mode !== 'worktree'
    && Array.from(ctx.view.dirty).some((rel) => rel === PHASE_MANIFEST || /^web\/[^/]+\.(js|html)$/.test(rel) || rel.startsWith('web/ui/'));
  if (!ctx.afterLint) {
    const providers = runNode('web/scripts/lint-global-providers.js', [], WEB);
    if (!providers.ok) return { label, state: 'failed', advisory, note: 'lint-global-providers 没过，分期清单算不了：\n' + tail(providers.output) };
  }
  const before = fs.existsSync(path.join(ROOT, PHASE_MANIFEST)) ? fs.readFileSync(path.join(ROOT, PHASE_MANIFEST)) : Buffer.alloc(0);
  const build = runNode('web/scripts/build-startup-phase-manifest.js', ctx.check ? ['--check'] : [], WEB);
  if (!build.ok) return { label, state: ctx.check ? 'stale' : 'failed', advisory, file: PHASE_MANIFEST, note: tail(build.output, 3) };
  if (ctx.check) return { label, state: 'fresh' };
  const changed = !before.equals(fs.readFileSync(path.join(ROOT, PHASE_MANIFEST)));
  return { label, state: changed ? 'written' : 'unchanged', file: PHASE_MANIFEST };
}

// 启动清单：index.html 里每个脚本、样式的哈希
function stepRuntimeManifest(ctx) {
  const label = '启动清单';
  const { build } = require('./build-native-preparation-manifest.cjs');
  const read = (absolute) => ctx.view.read(path.relative(ROOT, absolute).replace(/\\/g, '/'));
  let text;
  try {
    text = JSON.stringify(build(ROOT, read)) + '\n';
  } catch (error) {
    // 按已提交或暂存的内容算时，磁盘上缺了那份内容里引用的文件就算不出来；这种情形交给 CI 判
    if (ctx.view.mode !== 'worktree') return { label, state: 'stale', advisory: true, file: RUNTIME_MANIFEST, note: '      算不出来：' + error.message };
    return { label, state: 'failed', file: RUNTIME_MANIFEST, note: '      ' + error.message };
  }
  const target = path.join(ROOT, RUNTIME_MANIFEST);
  if (ctx.check) {
    let current = '';
    try { current = ctx.view.read(RUNTIME_MANIFEST).toString('utf8'); } catch (_) { /* 那份内容里没有这个文件：按过期算 */ }
    return current === text ? { label, state: 'fresh' } : { label, state: 'stale', file: RUNTIME_MANIFEST };
  }
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current === text) return { label, state: 'unchanged', file: RUNTIME_MANIFEST };
  fs.writeFileSync(target, text);
  return { label, state: 'written', file: RUNTIME_MANIFEST };
}

// 热更基线：发布树里每个文件的哈希。必须最后算——前面几步的产物都在它里面。
function stepHotBaseline(ctx) {
  const label = '热更基线';
  const sync = require('./sync-hot-baseline.js');
  const pkg = readJsonText(ctx.view.read('package.json').toString('utf8'));
  const version = String((pkg.build && pkg.build.buildVersion) || '').trim();
  const tempRoot = String(process.env.TIANMING_RELEASE_TEMP_ROOT || '').trim();
  const target = path.join(ROOT, HOT_BASELINE);
  let actual;
  try {
    actual = sync.generate(ROOT, version, '', tempRoot ? path.resolve(tempRoot) : '');
  } catch (error) {
    return { label, state: 'failed', file: HOT_BASELINE, note: tail(error.message, 8) };
  }
  const history = trackedInHistory();
  const probes = {
    existsOnDisk: (webRel) => fs.existsSync(path.join(WEB, webRel)),
    trackedInHistory: (webRel) => history.has('web/' + webRel)
  };
  if (ctx.check) {
    let canonical = null;
    try { canonical = readJsonText(ctx.view.read(HOT_BASELINE).toString('utf8')); } catch (_) { /* 没有基线 */ }
    if (!canonical) return { label, state: 'stale', file: HOT_BASELINE, note: '      基线文件不存在' };
    const pinnedCheck = ctx.runScenarios ? { manifest: actual, stale: [] } : pinScenarioProducts(actual, canonical, ctx.view);
    const fresh = adjustForView(pinnedCheck.manifest, canonical, ctx.view).manifest;
    const problems = baselineProblems(canonical, fresh, probes);
    const staleNote = staleProductsNote(pinnedCheck.stale);
    if (!problems.length) return staleNote ? { label, state: 'fresh', note: staleNote } : { label, state: 'fresh' };
    return { label, state: 'stale', file: HOT_BASELINE, note: problems.slice(0, 12).map((line) => '      ' + line).join('\n') + (problems.length > 12 ? '\n      …共 ' + problems.length + ' 条' : '') + (staleNote ? '\n' + staleNote : '') };
  }
  const currentText = fs.readFileSync(target, 'utf8');
  const canonical = readJsonText(currentText);
  const pinned = ctx.runScenarios ? { manifest: actual, stale: [] } : pinScenarioProducts(actual, canonical, ctx.view);
  actual = pinned.manifest;
  // 重生成时，本脚本管的派生文件一律按磁盘算：它们刚写出来，还没暂存
  const adjusted = adjustForView(actual, canonical, ctx.view, isDerivedOutput);
  const merged = mergeBaseline(canonical, adjusted.manifest, probes);
  const text = JSON.stringify(merged.manifest, null, 2) + '\n';
  const notes = [];
  const { updated, added, removed } = merged.stats;
  if (updated.length || added.length || removed.length) notes.push('      换哈希 ' + updated.length + ' 条、新增 ' + added.length + ' 条、去掉 ' + removed.length + ' 条');
  if (adjusted.skippedUntracked.length) {
    notes.push('      有 ' + adjusted.skippedUntracked.length + ' 个未跟踪文件没收进基线（要随包发就先 git add 再重跑）：'
      + adjusted.skippedUntracked.slice(0, 5).join('、') + (adjusted.skippedUntracked.length > 5 ? ' …' : ''));
  }
  if (pinned.stale.length) notes.push(staleProductsNote(pinned.stale));
  if (text === currentText) return { label, state: 'unchanged', file: HOT_BASELINE, note: notes.join('\n') };
  fs.writeFileSync(target, text);
  return { label, state: 'written', file: HOT_BASELINE, note: notes.join('\n') };
}

const STEPS = [stepScenarios, stepPhases, stepRuntimeManifest, stepHotBaseline];

// ---------- 入口 ----------

function main(argv) {
  const args = argv || process.argv.slice(2);
  const known = ['--check', '--head', '--staged', '--scenarios', '--no-scenarios', '--after-lint', '--help', '-h'];
  const unknown = args.filter((arg) => !known.includes(arg));
  if (unknown.length) throw new Error('不认识的参数：' + unknown.join(' '));
  if (args.includes('--help') || args.includes('-h')) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 10).map((line) => line.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  const check = args.includes('--check');
  if (args.includes('--head') && !check) throw new Error('--head 只和 --check 连用（重生成要按工作区或暂存区的内容）');
  if (args.includes('--head') && args.includes('--staged')) throw new Error('--head 与 --staged 只能选一个');
  const view = makeView(args.includes('--head') ? 'head' : args.includes('--staged') ? 'index' : 'worktree');
  let runScenarios = !args.includes('--no-scenarios');
  if (runScenarios && !args.includes('--scenarios')) {
    const changed = changedSinceBase(view);
    runScenarios = !changed || Array.from(changed).some((rel) => matchesAny(rel, SCENARIO_INPUTS));
  }
  const ctx = { check, view, runScenarios, afterLint: args.includes('--after-lint') };

  if (view.mode !== 'worktree' && view.dirty.size) {
    console.log('[regen] 工作区有 ' + view.dirty.size + ' 个文件与' + (view.mode === 'head' ? '已提交的内容' : '暂存区') + '不同，哈希按' + (view.mode === 'head' ? '已提交的内容' : '暂存区') + '算');
  }

  const results = [];
  for (const step of STEPS) {
    const result = step(ctx);
    results.push(result);
    const words = {
      skipped: '跳过', fresh: '没过期', stale: result.advisory ? '可能过期（工作区有相关的未提交改动，以 CI 为准）' : '过期',
      unchanged: '没变', written: '已更新', done: '已重生成', failed: '失败'
    };
    console.log('[regen] ' + result.label + '：' + words[result.state] + (result.file && result.state !== 'fresh' ? '  ' + result.file : '')
      + (result.state === 'skipped' && result.note ? '（' + result.note + '）' : ''));
    if (result.note && result.state !== 'skipped') console.log(result.note);
    if (result.state === 'failed') break;
  }

  if (results.some((result) => result.state === 'failed')) {
    console.error('[regen] 有一步没跑成，后面的没再算。');
    return 1;
  }
  if (check) {
    const stale = results.filter((result) => result.state === 'stale' && !result.advisory);
    if (stale.length) {
      console.error('[regen] 派生文件过期。修法：node scripts/regen-derived.js（只提交一部分改动时加 --staged），把变动的派生文件一并提交。');
      return 1;
    }
    console.log('[regen] PASS 派生文件与' + (view.mode === 'head' ? '已提交的内容' : '工作区') + '一致');
    return 0;
  }
  const dirtyOutputs = (gitPaths(['diff', '-z', '--name-only', '--no-renames']) || []).filter(isDerivedOutput);
  if (dirtyOutputs.length) console.log('[regen] 这些派生文件有待提交的变动：\n      git add ' + dirtyOutputs.join(' '));
  else console.log('[regen] 派生文件都是新的，没有要提交的变动。');
  const driver = git(['config', '--get', 'merge.tm-derived.driver']);
  if (!driver.ok || !driver.stdout.toString('utf8').trim()) {
    console.log('[regen] 提示：这个仓还没装「派生文件变基时自动取一侧」的合并驱动，装一次即可（所有工作区共用）：\n      git config merge.tm-derived.driver true');
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error('[regen] FAIL ' + ((error && error.message) || error));
    process.exitCode = 1;
  }
}

module.exports = { DERIVED_OUTPUTS, SCENARIO_INPUTS, SCENARIO_OUTPUTS, isDerivedOutput, matchesAny, adjustForView, pinScenarioProducts, mergeBaseline, baselineProblems, makeView, main };
