#!/usr/bin/env node
/* dev-sync-latest —— 启动器前置同步：把本机正式游戏锁到「本机最新成刀版本」（2026-07-21·owner
   二拍「不是本地已知的最新 main·是最新本地文件·即使没推也是最新」）
   背景：主库工作树常被并行会话占着（HEAD 落后 + 未提交 WIP），游戏(启动天命.bat→npm start)吃的是
   工作树文件——合入 main 甚至刚在 worktree 落 commit 的活都到不了本机游戏。本脚本在 npm start 前跑。
   目标选取：扫本地所有分支 + 各 worktree HEAD·只认「origin/main 的后代」（从旧 main 分出去的
   修理线/半成品旧线天然排除）·取 committer 时间最新者；无后代则 origin/main 本身。
   规则：① 干净跟踪文件 → 覆盖到目标
        ② 「脏」文件三分：内容已=目标 → 记台账放行；内容=本脚本上次所写(台账核对) → 属自动同步残留·
           继续推进；其余 = 真人 WIP → 跳过并列名·绝不清别人的稿
        ③ 绝不删文件（上游删除只报数）  ④ fetch 失败/断网 → 降级用本地已知引用照常选
        ⑤ 逃生口 TM_NO_SYNC=1 跳过·--dry 只看不写
   自写台账在 .git/dev-sync-state.json（不进版本库）。输出全 ASCII+路径（bat 控制台 OEM936·中文会碎）。 */
'use strict';
var childProcess = require('child_process');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var STATE_PATH = path.join(ROOT, '.git', 'dev-sync-state.json');
var DRY = process.argv.indexOf('--dry') >= 0;
var MAXBUF = 64 * 1024 * 1024;

function git(args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: MAXBUF });
}
function gitBuffer(args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: MAXBUF });
}
function nulFields(buffer) {
  var fields = Buffer.isBuffer(buffer) ? buffer.toString('utf8').split('\0') : String(buffer || '').split('\0');
  if (fields.length && fields[fields.length - 1] === '') fields.pop();
  return fields;
}
// `git status --porcelain=v1 -z`: rename/copy is `XY newPath\0oldPath\0`.
function parseStatusZ(buffer) {
  var fields = nulFields(buffer);
  var rows = [];
  for (var i = 0; i < fields.length;) {
    var record = fields[i++];
    if (!record || record.length < 3 || record.charAt(2) !== ' ') {
      throw new Error('invalid git status -z record');
    }
    var xy = record.slice(0, 2);
    var row = { x:xy.charAt(0), y:xy.charAt(1), status:xy, path:record.slice(3), originalPath:null };
    if (/[RC]/.test(xy)) {
      if (i >= fields.length) throw new Error('truncated git status rename/copy record');
      row.originalPath = fields[i++];
    }
    rows.push(row);
  }
  return rows;
}
// `git diff --name-status -z`: `status\0path\0`, rename/copy adds old + new paths.
function parseNameStatusZ(buffer) {
  var fields = nulFields(buffer);
  var rows = [];
  for (var i = 0; i < fields.length;) {
    var status = fields[i++];
    if (!status || !/^[A-Z]/.test(status) || i >= fields.length) {
      throw new Error('invalid git diff --name-status -z record');
    }
    var kind = status.charAt(0);
    var firstPath = fields[i++];
    var row = { status:status, kind:kind, path:firstPath, originalPath:null };
    if (kind === 'R' || kind === 'C') {
      if (i >= fields.length) throw new Error('truncated git diff rename/copy record');
      row.originalPath = firstPath;
      row.path = fields[i++];
    }
    rows.push(row);
  }
  return rows;
}
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) || { files: {} }; } catch (_e) { return { files: {} }; }
}
function isAncestor(a, b) {
  try { childProcess.execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: ROOT, stdio: 'ignore' }); return true; }
  catch (_e) { return false; }
}
function commitDate(ref) {
  try { return parseInt(git(['show', '-s', '--format=%ct', ref]).trim(), 10) || 0; } catch (_e) { return 0; }
}
// 目标=「本机最新成刀版本」：origin/main 的后代（本地分支/各 worktree HEAD）里 committer 最新者
function pickTarget(base) {
  var best = { sha: base, date: commitDate(base), label: 'origin/main' };
  var cands = {};
  try {
    git(['for-each-ref', '--format=%(objectname) %(committerdate:unix) %(refname:short)', 'refs/heads']).split('\n').forEach(function (l) {
      var m = l.match(/^([0-9a-f]{40}) (\d+) (.+)$/);
      if (m) cands[m[1]] = { date: parseInt(m[2], 10), label: m[3] };
    });
  } catch (_e) {}
  try {
    git(['worktree', 'list', '--porcelain']).split('\n').forEach(function (l) {
      var m = l.match(/^HEAD ([0-9a-f]{40})$/);
      if (m && !cands[m[1]]) cands[m[1]] = { date: 0, label: 'worktree-HEAD' };
    });
  } catch (_e) {}
  Object.keys(cands).forEach(function (cs) {
    if (cs === base) return;
    var c = cands[cs];
    if (!c.date) c.date = commitDate(cs);
    if (c.date <= best.date) return;             // 先比时间（便宜）再验血统（贵）
    if (!isAncestor(base, cs)) return;           // 不站在当前 main 之上的一律不认
    best = { sha: cs, date: c.date, label: c.label };
  });
  return best;
}

function main() {
  if (process.env.TM_NO_SYNC === '1') { console.log('[sync] TM_NO_SYNC=1 -> skipped'); return; }
  try {
    childProcess.execFileSync('git', ['fetch', 'origin', 'main', '--quiet'], { cwd: ROOT, timeout: 15000, stdio: 'ignore' });
  } catch (_e) { console.log('[sync] fetch failed/offline -> using local refs as-is'); }
  var base = '';
  try { base = git(['rev-parse', 'origin/main']).trim(); } catch (_e2) { console.log('[sync] no origin/main ref -> skipped'); return; }
  var pick = pickTarget(base);
  var target = pick.sha;
  var state = loadState();
  if (!state.files) state.files = {};
  // 本地有账的跟踪文件（暂存或未暂存）·untracked 与同步无关
  var dirty = {};
  parseStatusZ(gitBuffer(['status', '--porcelain=v1', '-z', '--untracked-files=all'])).forEach(function (row) {
    if (row.status === '??' || row.status === '!!') return;
    if (row.path) dirty[row.path] = 1;
    if (row.originalPath) dirty[row.originalPath] = 1;
  });
  var diff = parseNameStatusZ(gitBuffer(['diff', '--name-status', '-z', 'HEAD', target]));
  var updated = 0, advanced = 0, same = 0, skippedWip = [], removedUpstream = 0;
  diff.forEach(function (row) {
    var st = row.kind;
    var p = row.path;   // rename/copy 行取新路径·旧路径按「不删」原则原地保留
    if (st === 'D') { removedUpstream++; return; }
    var blob = childProcess.spawnSync('git', ['show', target + ':' + p], { cwd: ROOT, maxBuffer: MAXBUF });
    if (blob.status !== 0 || blob.stdout == null) return;
    var abs = path.join(ROOT, p);
    var cur = null;
    try { cur = fs.existsSync(abs) ? fs.readFileSync(abs) : null; } catch (_e3) {}
    var targetSha = sha(blob.stdout);
    if (cur && cur.equals(blob.stdout)) { same++; state.files[p] = targetSha; return; }   // 已是目标·记台账(手动同步过的也收编)
    if (dirty[p] && cur) {
      var curSha = sha(cur);
      if (state.files[p] !== curSha) { skippedWip.push(p); return; }   // 真人 WIP·保
      // 台账对上=上次自动同步所写·继续推进
      if (!DRY) fs.writeFileSync(abs, blob.stdout);
      state.files[p] = targetSha; advanced++; return;
    }
    if (!DRY) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, blob.stdout);
    }
    state.files[p] = targetSha; updated++;
  });
  if (!DRY) {
    try { fs.writeFileSync(STATE_PATH, JSON.stringify({ target: target, files: state.files })); } catch (_e4) {}
  }
  console.log('[sync] game locked to ' + pick.label + ' @' + target.slice(0, 8) +
    (target !== base ? ' (local commit, not yet on origin/main)' : '') + (DRY ? ' (dry-run, nothing written)' : ''));
  console.log('[sync] updated ' + updated + ' | advanced-auto ' + advanced + ' | already-current ' + same +
    (skippedWip.length ? ' | kept-human-WIP ' + skippedWip.length : '') +
    (removedUpstream ? ' | upstream-deleted-kept ' + removedUpstream : ''));
  skippedWip.slice(0, 12).forEach(function (p) { console.log('  [wip-kept] ' + p); });
  if (skippedWip.length > 12) console.log('  [wip-kept] ... and ' + (skippedWip.length - 12) + ' more');
}

module.exports = {
  parseStatusZ: parseStatusZ,
  parseNameStatusZ: parseNameStatusZ
};

if (require.main === module) {
  try { main(); } catch (e) {
    console.log('[sync] error (game will launch anyway): ' + (e && e.message ? e.message.split('\n')[0] : e));
  }
}
