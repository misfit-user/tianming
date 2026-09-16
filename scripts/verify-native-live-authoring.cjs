'use strict';
// Opt-in acceptance, NEVER part of CI. Secret config is child IPC only, not argv,
// environment, renderer storage, logs or artifacts. Every HTTP attempt is reserved.
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  args = process.argv.slice(2),
  value = (k) => args[args.indexOf(k) + 1];
if (
  !args.includes('--authorized-five-requests') ||
  !args.includes('--config-reader') ||
  !args.includes('--profile') ||
  !args.includes('--python')
)
  throw Error('Explicit five-request acceptance and a read-only config reader are required');
const retest = args.includes('--retest-after-map-id-fix'),
  suffix = retest ? '-retest' : '';
const ledgerFile = path.join(root, 'docs/native-start-workbench/real-api-budget-20260915' + suffix + '.json');
function ledger() {
  const l = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  if (
    l.maximumRequests !== 5 ||
    !Number.isInteger(l.requestsReserved) ||
    l.requestsReserved < 0 ||
    l.requestsReserved > 5 ||
    l.requests.length !== l.requestsReserved
  )
    throw Error('Invalid acceptance budget');
  return l;
}
if (ledger().requestsReserved >= 5) throw Error('Authorized real API budget exhausted');
const profile = path.resolve(value('--profile'));
function profileHash() {
  const h = crypto.createHash('sha256');
  for (const name of fs.readdirSync(profile).sort()) {
    if (!/^(\d+\.(ldb|sst|log)|CURRENT|MANIFEST-\d+)$/.test(name)) continue;
    const p = path.join(profile, name);
    if (fs.statSync(p).isFile()) h.update(name).update(fs.readFileSync(p));
  }
  return h.digest('hex');
}
const before = profileHash(),
  read = cp.spawnSync(value('--python'), ['-B', path.resolve(value('--config-reader')), profile, '--private-ipc'], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
if (read.status !== 0) throw Error('Read-only local config reader failed; secret output suppressed');
const saved = JSON.parse(read.stdout),
  cfg = saved.config;
if (!cfg || !cfg.key || !cfg.url) throw Error('No local API configuration');
const redact = (s) => String(s).split(cfg.key).join('[REDACTED]');
const id = crypto.randomUUID(),
  dir = path.join(root, 'web/dev-tools/electron-bridge', id);
fs.mkdirSync(dir, { recursive: true });
const temp = fs.mkdtempSync(path.join(root, '_codex_tmp/live-acceptance-'));
const reportFile = path.join(dir, 'native-start-live-authoring.json');
const env = {
  ...process.env,
  TEMP: temp,
  TMP: temp,
  TM_BRIDGE_TEST_ROOT: root,
  TM_BRIDGE_TEST_REPORT: reportFile,
  TM_BRIDGE_TEST_MODE: 'native-start-live-authoring',
  TM_BRIDGE_TEST_USERDATA: path.join(temp, 'production'),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.TIANMING_TEST_EXPORTS;
const child = cp.spawn(require('electron'), [path.join(__dirname, 'electron/native-live-authoring-main.cjs')], {
  cwd: root,
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
});
let log = '',
  killed = false;
child.stdout.on('data', (b) => {
  log += redact(b.toString());
});
child.stderr.on('data', (b) => {
  log += redact(b.toString());
});
function saveLedger(l) {
  const file = ledgerFile + '.tmp-' + id;
  const fd = fs.openSync(file, 'wx');
  try {
    fs.writeFileSync(fd, JSON.stringify(l, null, 2) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(file, ledgerFile);
}
child.on('message', (message) => {
  if (message.type === 'reserve') {
    try {
      const l = ledger();
      if (
        l.requestsReserved >= 5 ||
        l.requests.some((r) => r.id === message.id) ||
        !Number.isSafeInteger(message.bodyBytes) ||
        message.bodyBytes < 1 ||
        message.bodyBytes > 2 * 1024 * 1024
      )
        throw Error('budget denied');
      l.requestsReserved++;
      l.requests.push({
        id: message.id,
        runId: id,
        at: new Date().toISOString(),
        host: saved.host,
        model: saved.model,
        bodyBytes: message.bodyBytes,
        status: 'reserved-result-unknown',
      });
      saveLedger(l);
      child.send({ type: 'reservation', id: message.id, ok: true });
      console.log('REAL_API_RESERVED ' + l.requestsReserved + '/5');
    } catch (_) {
      child.send({ type: 'reservation', id: message.id, ok: false });
    }
  } else if (message.type === 'outcome') {
    const l = ledger(),
      r = l.requests.find((r) => r.id === message.id);
    if (r) {
      Object.assign(r, {
        status: message.status,
        httpStatus: message.httpStatus || null,
        responseBytes: message.responseBytes || 0,
        elapsedMs: message.elapsedMs,
      });
      saveLedger(l);
    }
  }
});
child.send({ type: 'private-config', config: cfg, remaining: 5 - ledger().requestsReserved });
const timeout = setTimeout(() => {
  killed = true;
  child.kill();
}, 600000);
child.on('error', () => {
  killed = true;
});
child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  fs.writeFileSync(path.join(dir, 'transport.log'), redact(log));
  let detail;
  try {
    detail = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  } catch (_) {}
  const afterRead = cp.spawnSync(
    value('--python'),
    ['-B', path.resolve(value('--config-reader')), profile, '--private-ipc'],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  let apiUnchanged = false;
  try {
    apiUnchanged =
      afterRead.status === 0 && JSON.stringify(JSON.parse(afterRead.stdout).config) === JSON.stringify(cfg);
  } catch (_) {}
  const result = {
    runId: id,
    head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    complete: !!detail?.complete,
    ok: !killed && !signal && code === 0 && detail?.ok === true && apiUnchanged,
    exitCode: code,
    signal: signal || null,
    localConfigurationSource: saved.source,
    localProfileUnchanged: before === profileHash(),
    localApiConfigurationUnchanged: apiUnchanged,
    model: saved.model,
    host: saved.host,
    requestsReserved: ledger().requestsReserved,
    budgetLedger: path.relative(root, ledgerFile).replace(/\\/g, '/'),
    detail,
  };
  const output = redact(JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'report.json'), output);
  fs.writeFileSync(path.join(root, 'docs/native-start-workbench/live-acceptance-20260915' + suffix + '.json'), output);
  console.log(
    JSON.stringify({
      ok: result.ok,
      model: result.model,
      requestsReserved: result.requestsReserved,
      localProfileUnchanged: result.localProfileUnchanged,
      report: path.relative(root, path.join(dir, 'report.json')),
    }),
  );
  process.exitCode = result.ok ? 0 : 1;
});
