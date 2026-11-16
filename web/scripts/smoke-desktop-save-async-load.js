'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const { readJsonFileOffMainThread } = require(path.join(ROOT, 'main-json-file.js'));

let pass = 0;
let fail = 0;
function ok(condition, message) {
  if (condition) {
    pass++;
    console.log('  PASS - ' + message);
  } else {
    fail++;
    console.error('  FAIL - ' + message);
  }
}

async function run() {
  console.log('[smoke-desktop-save-async-load]');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tianming-json-worker-'));
  const largeFile = path.join(tempRoot, 'large-save.json');
  const badFile = path.join(tempRoot, 'bad-save.json');
  try {
    const payload = {
      name: 'large-save',
      gameState: { turn: 88 },
      padding: '天命'.repeat(3 * 1024 * 1024)
    };
    fs.writeFileSync(largeFile, JSON.stringify(payload));
    fs.writeFileSync(badFile, '{"broken":');

    let heartbeats = 0;
    const timer = setInterval(() => { heartbeats++; }, 1);
    const loaded = await readJsonFileOffMainThread(largeFile, {
      workerThresholdBytes: 1,
      timeoutMs: 30000
    });
    clearInterval(timer);

    ok(loaded && loaded.name === 'large-save' && loaded.gameState.turn === 88,
      'large desktop JSON is parsed correctly by the worker path');
    ok(heartbeats > 0, 'main event loop remains responsive while the large JSON is parsed');

    let parseError = null;
    try {
      await readJsonFileOffMainThread(badFile, { workerThresholdBytes: 1, timeoutMs: 30000 });
    } catch (error) {
      parseError = error;
    }
    ok(parseError instanceof Error, 'worker parse failures reject instead of returning partial data');

    ok(Array.isArray(packageJson.build && packageJson.build.files)
      && packageJson.build.files.includes('main-json-file.js'),
    'the packaged Electron app includes the JSON worker module');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('\n[smoke-desktop-save-async-load] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
