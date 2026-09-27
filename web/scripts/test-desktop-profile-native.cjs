'use strict';
// Opt-in native regression: node web/scripts/test-desktop-profile-native.cjs <temporary-parent>
// Creates only hidden windows, never opens the player's profile, and closes every child/socket.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), cp = require('child_process');
const base = process.argv[2];
if (!base || !path.isAbsolute(base)) throw Error('Supply an absolute temporary parent directory');
fs.mkdirSync(base, { recursive: true });
const dir = fs.mkdtempSync(path.join(base, 'native-profile-')); fs.mkdirSync(path.join(dir, 'profile'));
fs.writeFileSync(path.join(dir, 'fixture.html'), '<!doctype html><title>Storage fixture</title>');
const children = [], sockets = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (fn()) return; await sleep(50); }
  throw Error('Timeout: ' + label);
}
function launch(run, inspect = false) {
  const env = { ...process.env, TM_PROFILE_FIXTURE_DIR: dir, TM_PROFILE_FIXTURE_RUN: run };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = cp.spawn(require('electron'), [...(inspect ? ['--inspect=127.0.0.1:0'] : []), path.join(__dirname, 'lib-desktop-profile-native.cjs')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderrText = ''; child.stderr.on('data', data => { child.stderrText += data; }); child.stdout.resume();
  children.push(child); return child;
}
function result(run) { return JSON.parse(fs.readFileSync(path.join(dir, run + '.json'))); }
async function quit(child, run) {
  fs.writeFileSync(path.join(dir, run + '.quit'), 'quit');
  await until(() => child.exitCode !== null, run + ' exits with its profile released');
  assert.equal(child.exitCode, 0);
}
(async () => {
  const first = launch('first', true);
  await until(() => fs.existsSync(path.join(dir, 'first.json')), 'primary ready');
  assert.equal(result('first').ok, true); assert.equal(result('first').before, null);
  const duplicate = launch('duplicate');
  await until(() => duplicate.exitCode !== null, 'duplicate exits before profile access');
  assert.equal(duplicate.exitCode, 0); assert.equal(fs.existsSync(path.join(dir, 'duplicate.json')), false);
  const endpoint = first.stderrText.match(/ws:\/\/127\.0\.0\.1:\d+\/[^\s]+/);
  assert.ok(endpoint, 'native inspector endpoint exists');
  const socket = new WebSocket(endpoint[0]); sockets.push(socket);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  assert.equal(socket.readyState, WebSocket.OPEN);
  await quit(first, 'first'); // Deliberately keep the debugger attached while quitting.
  await until(() => socket.readyState === WebSocket.CLOSED, 'quit disconnects the debugger');
  const reopened = launch('reopened');
  await until(() => fs.existsSync(path.join(dir, 'reopened.json')), 'reopened profile ready');
  assert.equal(result('reopened').ok, true);
  assert.equal(result('reopened').before, 'fake-test-key');
  assert.deepEqual(result('reopened').previous, { turn: 12, conf: { retained: true } });
  await quit(reopened, 'reopened');
  const evidence = { ok: true, duplicateBlocked: true, attachedDebuggerReleased: true, keyAndSaveSurviveRestart: true, first: result('first'), reopened: result('reopened') };
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log('[test-desktop-profile-native] PASS duplicate blocked; attached debugger closed; key/config/save survive restart. Evidence: ' + path.join(dir, 'result.json'));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const socket of sockets) if (socket.readyState !== WebSocket.CLOSED) socket.close();
  for (const child of children) if (child.exitCode === null) child.kill();
});
