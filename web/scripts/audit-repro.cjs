#!/usr/bin/env node
'use strict';
/**
 * Tianming audit: isolated source-level diagnostics (NOT Electron/browser E2E).
 * node audit-repro.cjs
 * node audit-repro.cjs --repo /absolute/path/to/trusted/tianming --expect-clean
 *
 * Checkout adapter for the supplied 2026-09-05 reproduction package. Original fixtures are NOT changed.
 * This copy requires --repo; the original attachment retains its fixed-fixture default behavior.
 * --repo: extracts corresponding functions from a trusted checkout; DOES NOT run npm or its CI suite.
 * DEFECT_PRESENT means the undesired behavior was observed, not that a correctness test passed.
 * New implementations may need additional harness dependencies; HARNESS_ERROR is never a clean pass.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const nodeNet = require('node:net');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const BASELINE = '3f8065cb9cf09b414cf35dc3deccca59560f733b';
const args = process.argv.slice(2);
const repoIndex = args.indexOf('--repo');
if (repoIndex >= 0 && (!args[repoIndex + 1] || args[repoIndex + 1].startsWith('--'))) {
  throw new Error('--repo requires a trusted checkout path');
}
const repo = repoIndex < 0 ? null : path.resolve(args[repoIndex + 1]);
const expectClean = args.includes('--expect-clean');
if (!repo) throw new Error('This checkout adapter requires --repo /absolute/tianming --expect-clean; use the original attachment for fixed fixtures.');
const fixtures = path.join(__dirname, 'fixtures');
const getSource = (real, fixture) => fs.readFileSync(repo ? path.join(repo, real) : path.join(fixtures, fixture), 'utf8');
const mainSource = getSource('main-impl.js', 'main-excerpts.js');
const lifecycleSource = getSource('web/tm-save-lifecycle.js', 'renderer-excerpts.js');
const managerSource = getSource('web/tm-save-manager.js', 'renderer-excerpts.js');
const ciSource = getSource('web/scripts/ci-smokes.js', 'ci-smokes.js');
const turnModulePath = repo ? path.join(repo, 'main-turn-data-commit.js') : path.join(fixtures, 'main-turn-data-commit.js');
function gitBlob(file) {
  const b = fs.readFileSync(file);
  return crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
}
if (!repo) {
  assert.equal(gitBlob(turnModulePath), 'bb007ed1a4f8152866ccc03f335ebc75bf1ee364', 'Full module must match fetched Git blob');
  assert.equal(gitBlob(path.join(fixtures, 'ci-smokes.js')), 'b41186129e366b4293a71280c8a552d4fe1ae0b4', 'CI runner must match fetched Git blob');
}
const { createTurnDataCommitter } = require(turnModulePath);
const quiet = { log() {}, warn() {}, error() {} };
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tianming-audit-'));
const results = [];
let counter = 0;
const tempCase = () => {
  const p = path.join(testRoot, String(++counter));
  fs.mkdirSync(p, { recursive: true });
  return p;
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
// Find an expression's closing brace using JS parser validation, without executing it.
// A syntax/dependency change raises a harness error rather than silently becoming a pass.
function expressionAt(source, start) {
  if (start < 0) throw new Error('Source marker not found');
  for (let end = source.indexOf('}', start); end >= 0; end = source.indexOf('}', end + 1)) {
    const expression = source.slice(start, end + 1);
    try { new vm.Script('(' + expression + ')'); return expression; } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
  throw new Error('No complete function expression found at offset ' + start);
}
function namedFunction(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('^(?:async\\s+)?function\\s+' + escaped + '\\s*\\(', 'm').exec(source);
  if (!m) throw new Error('Function not found: ' + name);
  return expressionAt(source, m.index);
}
function loadMain(names, dependencies = {}) {
  const context = vm.createContext(Object.assign({ fs, path, crypto, process, nodeNet, console: quiet, require: require('module').createRequire(path.join(repo, 'main-impl.js')) }, dependencies));
  for (const name of names) new vm.Script(namedFunction(mainSource, name)).runInContext(context, { timeout: 2000 });
  return context;
}
async function probe(id, label, fn, control = false) {
  try {
    const observed = await fn();
    const status = control ? (observed.ok ? 'CONTROL_PASS' : 'CONTROL_FAIL')
      : (observed.defect ? 'DEFECT_PRESENT' : 'NOT_REPRODUCED');
    const row = { id, label, status, evidence: observed };
    results.push(row);
    console.log(status + ' ' + id + ' ' + label + '\n  ' + JSON.stringify(observed));
  } catch (e) {
    results.push({ id, label, status: 'HARNESS_ERROR', error: String(e.stack || e) });
    console.error('HARNESS_ERROR ' + id + ' ' + String(e.message || e));
  }
}
const storageFns = ['ensureWritableDir', 'sanitize', 'stableStorageKey', 'turnDataRoot', 'turnSeg', 'writeJson', 'writeJsonAtomic', 'writeFileAtomic'];
function turnHarness() {
  const root = tempCase();
  const c = loadMain(storageFns, { TURN_DATA_DIR: root });
  const committer = createTurnDataCommitter({ fs, path, crypto, turnDataDir: root, turnDataRoot: c.turnDataRoot,
    turnSeg: c.turnSeg, ensureWritableDir: c.ensureWritableDir, writeJson: c.writeJson,
    writeJsonAtomic: c.writeJsonAtomic, writeFileAtomic: c.writeFileAtomic });
  return { root, c, committer };
}
function accountHarness() {
  let session = { token: 'DUMMY_TOKEN_A', user: { id: 'A' } };
  const pendingMe = deferred(), pendingLogin = deferred();
  const c = loadMain(['handleOnlineRendererRequest'], {
    normalizeOnlineRendererRoute: (method, pathname) => ({ method, pathname, route: pathname }),
    assertOnlineRendererBodySize() {},
    readAccountSession: () => structuredClone(session),
    writeAccountSession: next => { session = structuredClone(next); },
    clearAccountSession: () => { session = { token: '', user: null }; },
    getOnlineApi: () => pendingMe.promise,
    postOnlineApi: route => route === 'account/login' ? pendingLogin.promise : Promise.resolve({ success: true }),
    sanitizeAccountOnlineResponse: response => ({ success: response.success, user: response.user }),
    sanitizeOnlineResponse: response => ({ success: response.success }),
    toPublicAccountSession: () => ({ loggedIn: !!session.token, user: session.user })
  });
  c.accountRequests = require(path.join(repo, 'main-account-requests')).createAccountRequests({
    read: c.readAccountSession, write: c.writeAccountSession, clear: c.clearAccountSession,
    publicSession: c.toPublicAccountSession, sanitize: c.sanitizeAccountOnlineResponse,
    send: (req, body) => req.method === 'GET' ? c.getOnlineApi() : c.postOnlineApi(req.route, body)
  });
  return { c, pendingMe, pendingLogin, read: () => structuredClone(session) };
}
function runCi(report) {
  let exitCode = 0;
  const messages = [], module = { exports: {} };
  const tests = ['smoke-audio-bgm.js'];
  const expectedReport = { version: 2, complete: true, runId: 'current', head: 'test-head', expected: tests, skipped: [],
    results: (report.results || []).map(row => ({ ...row, exit: row.pass ? 0 : 1, suspect: false, timedOut: false, waivers: [] })) };
  const evidence = require(path.join(repo, 'web/scripts/lib-smoke-evidence'));
  const context = vm.createContext({
    __dirname: path.join(repo, 'web/scripts'), module,
    require(name) {
      if (name === './lib-smoke-evidence') return { discover: () => tests, validateReport: evidence.validateReport };
      if (name === 'crypto') return { randomUUID: () => 'current' };
      if (name === 'child_process') return { execFileSync: () => 'test-head', spawnSync: () => ({ status: report.results.length ? 0 : 1 }) };
      if (name === 'path') return path;
      if (name === 'fs') return { mkdirSync() {}, mkdtempSync: p => p + 'unique', readFileSync: () => JSON.stringify(expectedReport) };
      throw new Error('Unexpected CI dependency: ' + name);
    },
    console: { log: (...v) => messages.push(v.join(' ')), error: (...v) => messages.push(v.join(' ')) },
    process: { execPath: process.execPath }
  });
  new vm.Script(ciSource).runInContext(context, { timeout: 2000 });
  try { module.exports.main(); } catch (error) { exitCode = 1; messages.push(error.message); }
  return { exitCode, messages };
}

(async () => {
  await probe('CONTROL-01', 'stable keys and turn validation reject known aliases', async () => {
    const c = loadMain(['sanitize', 'stableStorageKey', 'turnSeg']);
    const invalid = [-1, 3.5, '03', '3e1', '../3'];
    const rejected = invalid.map(value => { try { c.turnSeg(value); return false; } catch (_) { return true; } });
    return { ok: rejected.every(Boolean) && c.stableStorageKey('a/b') !== c.stableStorageKey('a?b'), rejected };
  }, true);

  await probe('CONTROL-02', 'same turn transaction publish is idempotent', async () => {
    const { committer } = turnHarness();
    const a = { saveName: 'audit-save', turn: 20, campaignId: 'campaign-A', timelineId: 'tml_A',
      transactionId: 'txn-control-0001', stateChecksum: 'hash-A', data: { context: { branch: 'A' } } };
    committer.stage(a);
    const first = committer.publish(a), second = committer.recover(a);
    return { ok: first.success === true && second.success === true && first.path === second.path, recovered: second.recovered };
  }, true);

  await probe('TM-AUD-01', 'different timelines overwrite the same per-turn bundle', async () => {
    const { committer } = turnHarness();
    const a = { saveName: 'audit-save', turn: 20, campaignId: 'campaign-A', timelineId: 'tml_A',
      transactionId: 'txn-branch-A-0001', stateChecksum: 'hash-A', data: { context: { branch: 'A' } } };
    const b = { ...a, timelineId: 'tml_B', transactionId: 'txn-branch-B-0001', stateChecksum: 'hash-B', data: { context: { branch: 'B' } } };
    committer.stage(a); const pa = committer.publish(a);
    committer.stage(b); const pb = committer.publish(b);
    const branchAtOriginalPath = JSON.parse(fs.readFileSync(path.join(pa.path, 'context.json'), 'utf8')).branch;
    let oldRecoveryError = null;
    try { committer.recover(a); } catch (e) { oldRecoveryError = e.message; }
    return { defect: pa.path === pb.path && branchAtOriginalPath === 'B', sameFinalPath: pa.path === pb.path,
      branchAtOriginalPath, oldRecoveryError };
  });

  await probe('TM-AUD-02', 'workshop overwrite loses old package when copying fails', async () => {
    const root = tempCase(), managed = path.join(root, 'managed'), packs = path.join(managed, 'packs'), source = path.join(root, 'incoming'), target = path.join(packs, 'audit-pack');
    fs.mkdirSync(target, { recursive: true }); fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(target, 'old-proof.txt'), 'OLD-CONTENT');
    fs.writeFileSync(path.join(source, 'new.txt'), 'NEW-CONTENT');
    let indexWritten = false;
    const c = loadMain(['installWorkshopPackFromDir'], {
      WORKSHOP_PACKS_DIR: packs,
      validateWorkshopPack: dir => { assert.ok(fs.existsSync(dir)); return { id: 'audit-pack' }; },
      packPublicInfo: p => p, normalizePackId: id => id,
      safeRmDir: (dir, managedRoot) => { assert.equal(dir, path.join(managedRoot, 'audit-pack')); fs.rmSync(dir, { recursive: true, force: true }); },
      copyDirRecursive: (_source, dest) => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, 'partial.txt'), 'PARTIAL'); throw Object.assign(new Error('Injected copy ENOSPC'), { code: 'ENOSPC' }); },
      readWorkshopIndex: () => ({ packs: [{ id: 'audit-pack', version: 'old' }] }),
      writeWorkshopIndex: () => { indexWritten = true; }
    });
    const indexFile = path.join(managed, 'index.json');
    fs.writeFileSync(indexFile, JSON.stringify({ packs: [{ id: 'audit-pack', version: 'old' }] }));
    const io = Object.create(fs);
    io.copyFileSync = (_source, dest) => { fs.writeFileSync(dest, 'PARTIAL'); throw Object.assign(new Error('Injected copy ENOSPC'), { code: 'ENOSPC' }); };
    c.workshopTransactions = require(path.join(repo, 'main-workshop-transaction')).createWorkshopTransactions({
      fs: io, path, crypto, root: managed, packsRoot: packs, indexFile,
      validate: c.validateWorkshopPack, publicInfo: c.packPublicInfo, normalizeId: id => id,
      writeJsonAtomic: (file, data) => { if (file === indexFile) indexWritten = true; const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); }
    });
    let error; try { c.installWorkshopPackFromDir(source, { overwrite: true }); } catch (e) { error = e.message; }
    assert.match(error || '', /Injected copy/, 'The copy fault must actually execute, not a missing harness dependency');
    const oldPreserved = fs.existsSync(path.join(target, 'old-proof.txt'));
    return { defect: !!error && !oldPreserved, error, oldPreserved, partialNewTree: fs.existsSync(path.join(target, 'partial.txt')), indexWritten };
  });

  await probe('TM-AUD-03a', 'stale account/me combines a new token with old account identity', async () => {
    const h = accountHarness();
    const oldMe = h.c.handleOnlineRendererRequest('GET', 'account/me');
    const newLogin = h.c.handleOnlineRendererRequest('POST', 'account/login', {});
    h.pendingLogin.resolve({ success: true, token: 'DUMMY_TOKEN_B', user: { id: 'B' } });
    await newLogin;
    h.pendingMe.resolve({ success: true, user: { id: 'A' } });
    await oldMe;
    const session = h.read();
    return { defect: session.token === 'DUMMY_TOKEN_B' && session.user.id === 'A', tokenOwner: session.token === 'DUMMY_TOKEN_B' ? 'B' : 'other', displayedUser: session.user.id };
  });

  await probe('TM-AUD-03b', 'late login response restores session after logout completed', async () => {
    const h = accountHarness();
    const login = h.c.handleOnlineRendererRequest('POST', 'account/login', {});
    await h.c.handleOnlineRendererRequest('POST', 'account/logout', {});
    const loggedOutBeforeReply = !h.read().token;
    h.pendingLogin.resolve({ success: true, token: 'DUMMY_TOKEN_LATE', user: { id: 'late' } });
    await login;
    return { defect: loggedOutBeforeReply && !!h.read().token, loggedOutBeforeReply, loggedInAfterStaleReply: !!h.read().token };
  });

  await probe('TM-AUD-04', 'manual save callback mutates a different live world', async () => {
    const started = deferred(), io = deferred();
    let entered = 0;
    const c = { console: quiet, GM: { sid: 'world-A', turn: 20, saveName: 'old-A' }, P: { meta: { v: 'test' } },
      _$: () => ({ value: 'SAVE-FOR-A' }), _tmAwaitLoadBarrier: async () => true,
      findScenarioById: sid => ({ name: sid }), getTSText: t => 'T' + t,
      toast() {}, enterGame: () => { entered++; } };
    c._buildSaveState = () => ({ gameState: structuredClone(c.GM) });
    c.tianming = { saveProject: () => { started.resolve(); return io.promise; } };
    c.window = c;
    vm.createContext(c);
    const leaseSource = fs.readFileSync(path.join(repo, 'web/tm-post-turn-jobs.js'), 'utf8');
    for (const name of ['_tmCaptureWorldLease', '_tmWorldLeaseCurrent']) new vm.Script(namedFunction(leaseSource, name)).runInContext(c);
    const marker = lifecycleSource.indexOf('window.desktopDoSave=async function');
    if (marker < 0) throw new Error('desktopDoSave marker changed; adapt extraction');
    const expr = expressionAt(lifecycleSource, lifecycleSource.indexOf('async function', marker));
    new vm.Script('window.desktopDoSave = (' + expr + ');').runInContext(c);
    const pending = c.desktopDoSave();
    await started.promise;
    c.GM = { sid: 'world-B', turn: 1, saveName: 'SAVE-FOR-B' };
    io.resolve({ success: true });
    await pending;
    return { defect: c.GM.sid === 'world-B' && c.GM.saveName === 'SAVE-FOR-A', liveWorld: c.GM.sid, liveSaveName: c.GM.saveName, enterGameCalls: entered };
  });

  await probe('TM-AUD-05', 'legacy save string loads but list-style object is rejected', async () => {
    const root = tempCase(); fs.writeFileSync(path.join(root, '旧档.json'), '{}');
    const c = loadMain(['sanitize', 'stableStorageKey', 'isSafeStorageKey', 'saveFileRef'], { SAVE_DIR: root });
    const stringRef = c.saveFileRef('旧档');
    let error = null;
    try { c.saveFileRef({ name: '旧档', storageKey: '旧档' }); } catch (e) { error = e.message; }
    return { defect: stringRef.legacy === true && !!error, stringReferenceWorks: stringRef.legacy, objectReferenceError: error };
  });

  await probe('TM-AUD-06a', 'CI accepts an empty report after runner failure', async () => {
    const r = runCi({ results: [] });
    return { defect: r.exitCode === 0 && r.messages.some(s => s.includes('PASS')), ...r };
  });

  await probe('TM-AUD-06b', 'CI waives an unrelated syntax failure by file name', async () => {
    const r = runCi({ results: [{ name: 'smoke-audio-bgm.js', pass: false, error: 'SyntaxError: injected non-asset failure' }] });
    return { defect: r.exitCode === 0 && r.messages.some(s => s.includes('PASS')), ...r };
  });

  await probe('TM-AUD-07', 'network predicate misses hexadecimal IPv4-mapped loopback', async () => {
    const c = loadMain(['isPrivateNetworkAddress']);
    const dotted = c.isPrivateNetworkAddress('::ffff:127.0.0.1');
    const hex = c.isPrivateNetworkAddress('::ffff:7f00:1');
    const literalV4 = c.isPrivateNetworkAddress('127.0.0.1');
    return { defect: dotted === true && hex === false, dottedMappedBlocked: dotted, hexMappedBlocked: hex, literalV4Blocked: literalV4, scope: 'predicate only; no DNS/TLS/Electron exploitation attempted' };
  });

  await probe('TM-AUD-08', 'export write failure destroys an existing backup payload', async () => {
    const root = tempCase(), dest = path.join(root, 'backup.json');
    fs.writeFileSync(dest, '{"old":"preserve-me"}');
    const original = fs.readFileSync(dest, 'utf8');
    const faultyFs = Object.assign({}, fs, { writeFileSync(file, ...rest) {
      if (file === dest || typeof file === 'number') { fs.writeFileSync(file, '{'); throw Object.assign(new Error('Injected partial write ENOSPC'), { code: 'ENOSPC' }); }
      return fs.writeFileSync(file, ...rest);
    }});
    const handlers = {};
    const c = loadMain(['ensureWritableDir', 'writeFileAtomic'], { fs: faultyFs, mainWindow: {},
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: dest }) } });
    const marker = mainSource.indexOf("ipcMain.handle('dialog-export',");
    const expr = expressionAt(mainSource, mainSource.indexOf('async (', marker));
    handlers.export = new vm.Script('(' + expr + ')').runInContext(c);
    const response = await handlers.export({}, { next: 'data' }, {});
    const after = fs.readFileSync(dest, 'utf8');
    return { defect: response.success === false && after !== original, reportedFailure: response.success === false, originalPreserved: after === original, resultingBytes: Buffer.byteLength(after) };
  });

  await probe('TM-AUD-09', 'saveToSlot loses both success and failure return values', async () => {
    let next = true;
    const c = { console: quiet, GM: { sid: 'a', turn: 1 }, P: {}, toast() {},
      TM_SaveDB: { isAvailable: () => true, save: async () => next },
      _buildSaveState: () => ({ GM: { turn: 1 }, P: {} }), _updateSaveIndex() {} };
    c.window = c; vm.createContext(c);
    const marker = managerSource.indexOf('saveToSlot: async function');
    if (marker < 0) throw new Error('saveToSlot marker changed; adapt extraction');
    const expr = expressionAt(managerSource, managerSource.indexOf('async function', marker));
    const fn = new vm.Script('(' + expr + ')').runInContext(c);
    const holder = { maxSlots: 10 };
    const successResult = await fn.call(holder, 1, 'case');
    next = false;
    const failureResult = await fn.call(holder, 1, 'case');
    return { defect: successResult === undefined && failureResult === undefined,
      successResult: String(successResult), failureResult: String(failureResult) };
  });

  let testedHead = BASELINE;
  if (repo) { try { testedHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(); } catch (_) { testedHead = 'unknown-checkout'; } }
  const output = { auditBaseline: BASELINE, testedHead, mode: repo ? 'checkout-function-extraction' : 'fetched-source-fixtures',
    node: process.version, platform: process.platform, fullModuleBlob: gitBlob(turnModulePath),
    generatedAt: new Date().toISOString(), boundaries: ['Not Electron E2E', 'Mocked network and renderer dependencies', 'Filesystem failures are injected', 'No real accounts or user saves accessed', 'NOT_REPRODUCED is not proof of correctness'],
    summary: { probes: results.filter(r => !r.id.startsWith('CONTROL')).length,
      defectsPresent: results.filter(r => r.status === 'DEFECT_PRESENT').length,
      controlsPassed: results.filter(r => r.status === 'CONTROL_PASS').length,
      harnessErrors: results.filter(r => r.status === 'HARNESS_ERROR').length }, results };
  const evidenceDir = path.join(repo, 'web/dev-tools/audit-2026-09-05'); fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'repro-adapted-results.json'), JSON.stringify(output, null, 2) + '\n');
  console.log('\nSUMMARY ' + JSON.stringify(output.summary));
  fs.rmSync(testRoot, { recursive: true, force: true });
  if (output.summary.harnessErrors || results.some(r => r.status === 'CONTROL_FAIL') || (expectClean && output.summary.defectsPresent)) process.exitCode = 1;
})().catch(e => { console.error(e.stack || e); fs.rmSync(testRoot, { recursive: true, force: true }); process.exitCode = 2; });
