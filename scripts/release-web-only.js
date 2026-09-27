'use strict';
// Explicit source + Pages publication. Never creates installer/OTA archives or moves OTA feeds.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
function run(command, args, root) {
  const r = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
  if (r.status !== 0) throw Error(command + ' failed: ' + String(r.stderr || r.stdout));
  return String(r.stdout || '').trim();
}
function stage(root, version) {
  const parent = process.env.TIANMING_RELEASE_TEMP_ROOT || os.tmpdir();
  fs.mkdirSync(parent, { recursive: true });
  const target = path.join(fs.mkdtempSync(path.join(parent, 'tianming-web-only-')), 'pages');
  run(process.execPath, ['scripts/stage-web-release.js', '--target', target, '--label', 'web-only-' + version], root);
  run(process.execPath, ['scripts/verify-pages-artifact.js', '--target', target], root);
  return target;
}
function tagCommit(root, tag) {
  const lines = run('git', ['ls-remote', '--tags', 'origin', 'refs/tags/' + tag, 'refs/tags/' + tag + '^{}'], root).split(/\r?\n/).filter(Boolean).map(s => s.split(/\s+/));
  return (lines.find(r => r[1].endsWith('^{}')) || lines[0] || [])[0] || '';
}
function publish({ root, version, head, notes }) {
  if (!/^[a-f0-9]{40}$/.test(head)) throw Error('Missing locked main commit');
  const tag = 'ship-' + version, repository = 'misfit-user/tianming';
  const existing = tagCommit(root, tag);
  if (existing && existing !== head) throw Error('Existing release tag does not match locked main');
  const view = spawnSync('gh', ['release', 'view', tag, '--repo', repository, '--json', 'tagName'], { cwd: root, encoding: 'utf8' });
  if (view.status !== 0) run('gh', ['release', 'create', tag, '--repo', repository, '--target', head, '--latest=false', '--title', '天命 ' + version + ' · 网页与源码版', '--notes', notes], root);
  if (tagCommit(root, tag) !== head) throw Error('Published tag verification failed');
  // Workflow executes from main; the checkout is pinned to the already verified release commit.
  run('gh', ['workflow', 'run', 'pages.yml', '--repo', repository, '--ref', 'main', '-f', 'ref=' + head], root);
  console.log('WEB_ONLY_PUBLISHED ' + tag + ' ' + head + '; Pages dispatched; installer/OTA channels unchanged');
  return { tag, head, pagesDispatched: true, otaPublished: false, installerBuilt: false };
}
module.exports = { stage, publish, tagCommit };
