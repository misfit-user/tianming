#!/usr/bin/env node
// 派生文件重生成（scripts/regen-derived.js）：热更基线「按所看的那份内容校正」「并入而不整份重写」两段逻辑，
// 以及推送钩子、合并驱动清单、启动清单生成器的接线。
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const regen = require(path.join(ROOT, 'scripts', 'regen-derived.js'));

let checks = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  checks++;
}
const sha = (text) => crypto.createHash('sha256').update(Buffer.from(text)).digest('hex');
const row = (file, tag, size) => ({ path: file, sha256: tag, size: size === undefined ? 1 : size });
const paths = (manifest) => manifest.files.map((entry) => entry.path).join(' ');

// ---------- 并入现有基线 ----------
const canonical = {
  type: 'tianming-hot-update',
  version: '1.0.0.0',
  entry: 'index.html',
  generatedAt: '2026-01-01T00:00:00.000Z',
  files: [
    row('a.js', 'old-a'),
    row('assets/p.png', 'asset', 9),   // 本工作区缺席的未跟踪资产
    row('b.js', 'same-b'),
    row('gone.js', 'gone'),            // 被删掉的跟踪文件
    row('excluded.js', 'excluded')     // 文件还在，但发布规则已把它排除
  ],
  remove: []
};
const fresh = {
  type: 'tianming-hot-update',
  version: '1.0.0.1',
  entry: 'index.html',
  generatedAt: '2026-11-16T00:00:00.000Z',
  files: [row('a.js', 'new-a', 2), row('aa.js', 'new-aa'), row('b.js', 'same-b'), row('c.js', 'new-c')],
  remove: []
};
const probes = {
  existsOnDisk: (file) => file === 'excluded.js',
  trackedInHistory: (file) => file === 'gone.js'
};
const merged = regen.mergeBaseline(canonical, fresh, probes);
ok(paths(merged.manifest) === 'a.js aa.js assets/p.png b.js c.js', '原有各条位置不动，新文件按路径插到相应位置');
ok(merged.manifest.files[0].sha256 === 'new-a' && merged.manifest.files[0].size === 2, '改过的文件换成新哈希与大小');
ok(merged.manifest.files[2].sha256 === 'asset' && merged.manifest.files[2].size === 9, '本工作区缺席的未跟踪资产原样保留');
ok(JSON.stringify(merged.stats.updated) === '["a.js"]' && JSON.stringify(merged.stats.added) === '["aa.js","c.js"]', '统计出换哈希与新增的各条');
ok(JSON.stringify(merged.stats.removed) === '["gone.js","excluded.js"]' && merged.stats.keptAbsent === 1, '被删的跟踪文件、被规则排除的文件去掉；缺席资产记为保留');
ok(merged.manifest.generatedAt === canonical.generatedAt, '生成时间不动，免得每次都多一行改动');
ok(merged.manifest.version === '1.0.0.1', '版本号跟新算出的清单');
ok(JSON.stringify(Object.keys(merged.manifest)) === JSON.stringify(Object.keys(canonical)), '顶层键顺序不变');
ok(merged.manifest.files.every((entry) => JSON.stringify(Object.keys(entry)) === '["path","sha256","size"]'), '每条只有 path、sha256、size 三个键');
ok(!('absPath' in canonical.files[0]) && canonical.files.length === 5, '不改传入的基线对象');

const again = regen.mergeBaseline(merged.manifest, fresh, { existsOnDisk: () => false, trackedInHistory: () => false });
ok(JSON.stringify(again.manifest) === JSON.stringify(merged.manifest), '再并一次结果不变');
ok(!again.stats.updated.length && !again.stats.added.length && !again.stats.removed.length, '再并一次没有任何变动');

const untouched = regen.mergeBaseline(canonical, Object.assign({}, canonical, { files: canonical.files.slice(0, 3) }), {
  existsOnDisk: () => false, trackedInHistory: () => false
});
ok(JSON.stringify(untouched.manifest, null, 2) === JSON.stringify(canonical, null, 2), '内容没变时写出的文本与原基线逐字相同');

// ---------- 按「所看的那份内容」校正 ----------
function fakeView(mode, tracked, dirtyBlobs) {
  const trackedSet = new Set(tracked);
  const fetched = [];
  return {
    mode,
    dirty: new Set(Object.keys(dirtyBlobs)),
    has: (rel) => trackedSet.has(rel),
    read(rel) {
      if (!(rel in dirtyBlobs) || dirtyBlobs[rel] === null) throw new Error('unexpected read ' + rel);
      return Buffer.from(dirtyBlobs[rel]);
    },
    prefetch: (rels) => fetched.push(...rels),
    fetched
  };
}
const baseline = { files: [row('a.js', 'x'), row('b.js', 'x'), row('assets/p.png', 'x'), row('deleted.js', 'x'), row('out.json', 'x')] };
const disk = {
  files: [
    row('a.js', 'disk-a'),
    row('assets/p.png', 'disk-asset'),
    row('b.js', 'disk-b'),
    row('junk.tmp', 'disk-junk'),
    row('out.json', 'disk-out'),
    row('staged-new.js', 'disk-new')
  ]
};
const view = fakeView(
  'index',
  ['web/a.js', 'web/b.js', 'web/staged-new.js', 'web/deleted.js', 'web/out.json', 'docs/x.md'],
  { 'web/b.js': 'B-as-staged', 'web/deleted.js': 'D', 'web/out.json': 'OUT-as-staged', 'docs/x.md': null }
);
const adjusted = regen.adjustForView(disk, baseline, view, (rel) => rel === 'web/out.json');
const byPath = new Map(adjusted.manifest.files.map((entry) => [entry.path, entry]));
ok(byPath.get('a.js').sha256 === 'disk-a', '没有未提交改动的文件直接用磁盘上的哈希');
ok(byPath.get('b.js').sha256 === sha('B-as-staged') && byPath.get('b.js').size === 11, '有未暂存改动的文件按暂存区那份内容算');
ok(byPath.get('staged-new.js').sha256 === 'disk-new', '已暂存的新文件收进来');
ok(!byPath.has('junk.tmp') && JSON.stringify(adjusted.skippedUntracked) === '["junk.tmp"]', '未跟踪、基线里也没有的文件不擅自收进基线，单独列出');
ok(byPath.get('assets/p.png').sha256 === 'disk-asset', '基线里本来就有的未跟踪资产照磁盘算');
ok(byPath.get('deleted.js').sha256 === sha('D'), '磁盘上删了、暂存区里还在的文件按暂存区补回');
ok(byPath.get('out.json').sha256 === 'disk-out', '本次刚重生成的派生文件一律按磁盘算');
ok(view.fetched.includes('web/b.js') && view.fetched.includes('web/deleted.js') && !view.fetched.includes('web/out.json'), '只去 git 里取确实需要的那几份');
ok(disk.files.length === 6 && disk.files[2].sha256 === 'disk-b', '不改传入的清单');

const plain = regen.adjustForView(disk, baseline, fakeView('worktree', ['web/a.js', 'web/b.js', 'web/out.json', 'web/staged-new.js'], {}));
ok(paths(plain.manifest) === 'a.js assets/p.png b.js out.json staged-new.js', '按工作区算时只筛掉不认识的未跟踪文件，其余原样');

// ---------- 剧本那组跳过时，随包剧本沿用基线的值 ----------
// 11-17：未跟踪的随包剧本是变基前生成的旧货，照磁盘算就把旧哈希写进了基线（3497707d，CI 报 stale）
const pinBaseline = { files: [row('a.js', 'base-a'), row('bundled-scenarios/w.json', 'main-w', 5), row('scenarios/t.js', 'base-t'), row('bundled-scenarios/same.json', 'same', 3)] };
const pinDisk = {
  version: '1.0.0.1',
  files: [
    row('a.js', 'disk-a'),
    row('bundled-scenarios/w.json', 'stale-w', 4),   // 未跟踪、变基前生成的旧产物
    row('bundled-scenarios/same.json', 'same', 3),   // 未跟踪、与基线一致
    row('bundled-scenarios/new.json', 'disk-new'),   // 未跟踪、基线里没有（交给 adjustForView 去筛）
    row('scenarios/t.js', 'disk-t')                  // 跟踪着的产物：git 会换成新的，照磁盘算
  ]
};
const pinView = fakeView('worktree', ['web/a.js', 'web/scenarios/t.js'], {});
const pinned = regen.pinScenarioProducts(pinDisk, pinBaseline, pinView);
const pinnedBy = new Map(pinned.manifest.files.map((entry) => [entry.path, entry]));
ok(pinnedBy.get('bundled-scenarios/w.json').sha256 === 'main-w' && pinnedBy.get('bundled-scenarios/w.json').size === 5, '未跟踪的随包剧本沿用基线里的哈希与大小');
ok(JSON.stringify(pinned.stale) === '["bundled-scenarios/w.json"]', '磁盘上与基线对不上的随包剧本列出来提示重生成，一致的不列');
ok(pinnedBy.get('scenarios/t.js').sha256 === 'disk-t' && pinnedBy.get('a.js').sha256 === 'disk-a', '跟踪着的产物与别的文件照磁盘算');
ok(pinnedBy.get('bundled-scenarios/new.json').sha256 === 'disk-new', '基线里没有的不在这里处理');
ok(pinned.manifest.version === '1.0.0.1' && pinDisk.files[1].sha256 === 'stale-w', '其余字段照新算的清单，不改传入的清单');
const pinMerged = regen.mergeBaseline(
  { files: pinBaseline.files.slice() },
  regen.adjustForView(pinned.manifest, pinBaseline, pinView, regen.isDerivedOutput).manifest,
  { existsOnDisk: () => true, trackedInHistory: () => false }
);
ok(!pinMerged.stats.updated.includes('bundled-scenarios/w.json'), '重生成时旧产物不再把基线里那条哈希改掉');
const rawMerged = regen.mergeBaseline(
  { files: pinBaseline.files.slice() },
  regen.adjustForView(pinDisk, pinBaseline, pinView, regen.isDerivedOutput).manifest,
  { existsOnDisk: () => true, trackedInHistory: () => false }
);
ok(rawMerged.stats.updated.includes('bundled-scenarios/w.json'), '对照：不沿用时，旧产物会把基线那条改掉（11-17 就是这样）');
ok(regen.SCENARIO_OUTPUTS.includes('web/bundled-scenarios/') && !regen.SCENARIO_OUTPUTS.includes('web/.hot-update-manifest.json'), '剧本产物那几项不含三份清单');

// ---------- 过期判断 ----------
const staleProblems = regen.baselineProblems(
  { type: 't', version: '1', entry: 'index.html', files: [row('a.js', 'old'), row('assets/p.png', 'asset'), row('gone.js', 'gone')], remove: [] },
  { type: 't', version: '1', entry: 'index.html', files: [row('a.js', 'new'), row('extra.js', 'extra')], remove: [] },
  { existsOnDisk: () => false, trackedInHistory: (file) => file === 'gone.js' }
);
ok(staleProblems.some((line) => line.includes('stale canonical hash/size: a.js')), '哈希对不上算过期');
ok(staleProblems.some((line) => line.includes('missing canonical path: extra.js')), '发布树里有、基线里没有算过期');
ok(staleProblems.some((line) => line.includes('obsolete canonical path: gone.js')), '删掉的跟踪文件还留在基线里算过期');
ok(!staleProblems.some((line) => line.includes('assets/p.png')), '本工作区缺席的未跟踪资产不算过期');

// ---------- 路径归类 ----------
ok(regen.isDerivedOutput('web/tm-start-runtime-manifest.json') && regen.isDerivedOutput('web/scenarios/tianqi7-1627.js'), '认得派生文件（单个文件与目录前缀）');
ok(!regen.isDerivedOutput('web/tm-border-invasion.js') && !regen.isDerivedOutput('scenarios/x.json'), '普通源文件不算派生文件');
ok(regen.matchesAny('scenarios/x.json', regen.SCENARIO_INPUTS) && !regen.matchesAny('web/tm-x.js', regen.SCENARIO_INPUTS), '官方剧本那一组只在真源或生成器改动时才带上');

// ---------- 接线 ----------
const hook = fs.readFileSync(path.join(ROOT, 'hooks', 'pre-push'), 'utf8');
ok(/regen-derived\.js --check --head/.test(hook), '推送钩子按已提交的内容检查派生文件');
const attributeLines = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8').split(/\r?\n/)
  .filter((line) => /\smerge=tm-derived\s*$/.test(line)).map((line) => line.split(/\s+/)[0]);
for (const output of regen.DERIVED_OUTPUTS) {
  const covered = output.endsWith('/') ? attributeLines.some((line) => line.startsWith(output)) : attributeLines.includes(output);
  ok(covered, '.gitattributes 给 ' + output + ' 挂了合并驱动');
}
ok(attributeLines.every((line) => regen.isDerivedOutput(line.replace(/\*.*$/, ''))), '挂了合并驱动的都是本脚本管的派生文件');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
ok(pkg.scripts.regen === 'node scripts/regen-derived.js', 'npm run regen 指向本脚本');

// 启动清单生成器：换一个读文件的口，结果不变，且真的经过这个口
const { build } = require(path.join(ROOT, 'scripts', 'build-native-preparation-manifest.cjs'));
const seen = [];
const viaReader = build(ROOT, (absolute) => { seen.push(path.basename(absolute)); return fs.readFileSync(absolute); });
ok(seen.includes('index.html') && seen.length > 100, '启动清单生成器读文件都经过传入的读取口');
ok(JSON.stringify(viaReader) === JSON.stringify(build(ROOT)), '经读取口算出的启动清单与直接读磁盘的相同');

console.log('[smoke-regen-derived] PASS ' + checks + ' checks');
