#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');
const { verifyAuthenticatedDocument: verifyArtifactDocument } = require(path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'verify-artifacts.js'));

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-security-boundary-'));
let assertions = 0;
function check(value, label) {
  if (!value) throw new Error('[smoke-security-trust-boundary] ' + label);
  assertions++;
}
function throws(fn, pattern) {
  try { fn(); return false; }
  catch (error) { return !pattern || pattern.test(String(error && (error.message || error))); }
}

const keys = crypto.generateKeyPairSync('ed25519');
const publicKeyPath = path.join(TMP, 'public.pem');
fs.writeFileSync(publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' }));
process.env.TIANMING_TEST_EXPORTS = '1';
process.env.TIANMING_HOT_UPDATE_PUBLIC_KEY = publicKeyPath;
const ipcHandlers = new Map();

const electronStub = {
  app: {
    getPath: () => path.join(TMP, 'userData'),
    getVersion: () => '1.3.4.11',
    getAppPath: () => ROOT,
    isPackaged: false,
    whenReady: () => new Promise(() => {}),
    on() {}, once() {}, relaunch() {}, exit() {}, quit() {}
  },
  BrowserWindow: function BrowserWindow() {},
  ipcMain: { handle(channel, listener) { ipcHandlers.set(channel, listener); }, on() {} },
  dialog: {}, shell: {}, Menu: {},
  protocol: { registerSchemesAsPrivileged() {}, handle() {} },
  net: { fetch: (url, init) => fetch(url, init) },
  session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } }
};
electronStub.BrowserWindow.getAllWindows = () => [];
const originalLoad = Module._load;
Module._load = function(request) {
  if (request === 'electron') return electronStub;
  if (request === 'electron-updater') {
    return { autoUpdater: { on() {}, setFeedURL() {}, checkForUpdates: async () => null, downloadUpdate: async () => [], quitAndInstall() {} } };
  }
  return originalLoad.apply(this, arguments);
};

const T = require(path.join(ROOT, 'main-impl.js')).__test;

async function main() {
  const payload = {
    type: 'tianming-hot-update-feed',
    appId: 'com.tianming.history',
    channel: 'stable',
    version: '9.9.9.9',
    packageUrl: 'https://example.invalid/hot.zip',
    sha256: 'a'.repeat(64),
    size: 123,
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const auth = {
    algorithm: 'Ed25519',
    keyId: crypto.createHash('sha256').update(keys.publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 24),
    payload: payloadBytes.toString('base64'),
    signature: crypto.sign(null, payloadBytes, keys.privateKey).toString('base64')
  };
  const signed = Object.assign({}, payload, { auth });
  const verified = T.verifyAuthenticatedUpdateDocument(signed, 'tianming-hot-update-feed');
  check(verified.version === payload.version && verified.packageUrl === payload.packageUrl, 'valid Ed25519 document returns only authenticated payload');
  const artifactVerified = verifyArtifactDocument(signed, 'tianming-hot-update-feed', publicKeyPath);
  check(artifactVerified.ok && artifactVerified.payload.version === payload.version, 'independent artifact verifier accepts the same valid signed document');
  check(throws(() => T.verifyAuthenticatedUpdateDocument(Object.assign({}, signed, { version: '9.9.9.8' }), 'tianming-hot-update-feed'), /外层字段/),
    'tampered outer field is rejected even when embedded payload remains signed');
  const badSignature = Object.assign({}, signed, { auth: Object.assign({}, auth, { signature: Buffer.alloc(64).toString('base64') }) });
  check(throws(() => T.verifyAuthenticatedUpdateDocument(badSignature, 'tianming-hot-update-feed'), /签名验证失败/), 'tampered Ed25519 signature is rejected');
  check(!verifyArtifactDocument(badSignature, 'tianming-hot-update-feed', publicKeyPath).ok, 'independent artifact verifier rejects signature tampering');
  const badEncoding = Object.assign({}, signed, { auth: Object.assign({}, auth, { payload: auth.payload + '\n' }) });
  check(throws(() => T.verifyAuthenticatedUpdateDocument(badEncoding, 'tianming-hot-update-feed'), /编码非法/), 'non-canonical base64 is rejected');
  check(!verifyArtifactDocument(Object.assign({}, signed, { version: '9.9.9.8' }), 'tianming-hot-update-feed', publicKeyPath).ok,
    'independent artifact verifier rejects outer-field tampering');
  // Exercise the actual pinned Node transport with an isolated ephemeral server.
  const http = require('http');
  let bodyAbortObserved = false;
  let observeClose;
  const closedBody = new Promise(resolve => { observeClose = resolve; });
  const server = http.createServer((req, res) => {
    res.on('close', () => { bodyAbortObserved = true; observeClose(); });
    res.writeHead(200); res.flushHeaders();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let stalledError;
  try {
    const callerAbort = new AbortController();
    const stalled = await T.fetchRemoteResponse('http://127.0.0.1:' + server.address().port + '/stalled', { signal: callerAbort.signal, timeoutMs: 10000 });
    const stalledRead = T.readRemoteTextLimited(stalled.response, 100, 1000).catch(error => error);
    setTimeout(() => callerAbort.abort(), 5);
    stalledError = await stalledRead;
  } finally { await new Promise(resolve => server.close(resolve)); await closedBody; }
  check(bodyAbortObserved && /abort/i.test(String(stalledError && stalledError.message)), 'caller abort remains connected after response headers and stops a stalled body: ' + bodyAbortObserved + ' / ' + String(stalledError && stalledError.message));
  check(T.verifyAuthenticatedUpdateDocument(payload, 'tianming-hot-update-feed') === payload,
    'unsigned fixtures are allowed only inside explicit unpackaged test mode');
  check(T.isAllowedRemoteUrl('http://127.0.0.1/test') === true,
    'localhost HTTP is available inside explicit unpackaged test mode');

  const trustedUrl = pathToFileURL(path.join(ROOT, 'web', 'index.html')).toString();
  const mainFrame = { url: trustedUrl, parent: null };
  check(!throws(() => T.assertTrustedIpcSender({ senderFrame: mainFrame, sender: { mainFrame } })), 'top-level bundled renderer is accepted');
  check(throws(() => T.assertTrustedIpcSender({ senderFrame: { url: trustedUrl, parent: {} }, sender: { mainFrame: {} } }), /top-level/), 'nested frame IPC is rejected');
  const foreignFrame = { url: 'https://attacker.invalid/', parent: null };
  check(throws(() => T.assertTrustedIpcSender({ senderFrame: foreignFrame, sender: { mainFrame: foreignFrame } }), /untrusted/), 'remote renderer IPC is rejected');
  const outsideFrame = { url: pathToFileURL(path.join(TMP, 'index.html')).toString(), parent: null };
  check(throws(() => T.assertTrustedIpcSender({ senderFrame: outsideFrame, sender: { mainFrame: outsideFrame } }), /untrusted/), 'file URL outside bundled/active web roots is rejected');

  ['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '::1', 'fc00::1', '2001:db8::1']
    .forEach(address => check(T.isPrivateNetworkAddress(address), 'private/reserved address rejected: ' + address));
  check(!T.isPrivateNetworkAddress('8.8.8.8') && !T.isPrivateNetworkAddress('2606:4700:4700::1111'), 'public IPv4/IPv6 remain eligible after DNS validation');
  check(T.isAllowedRemoteUrl('https://example.com/path') && !T.isAllowedRemoteUrl('https://example.com:444/path')
    && !T.isAllowedRemoteUrl('https://user:pass@example.com/path'), 'URL parser enforces HTTPS default port and no userinfo');
  let ipError = null;
  try { await T.assertSafeRemoteUrl('https://10.0.0.1/path'); } catch (error) { ipError = error; }
  check(ipError && /IP/.test(ipError.message), 'production remote requests reject IP literals before fetch');

  const publicSession = T.toPublicAccountSession({
    token: 'secret',
    user: { id: 7, username: '史官', nickname: '史官', email: 'user@example.invalid', passwordHash: 'hash', internalFlags: ['admin'], access_token: 'nested-secret' },
    loggedInAt: 'now'
  });
  check(publicSession.loggedIn === true && publicSession.user.id === 7 && publicSession.user.email === 'user@example.invalid'
    && !Object.prototype.hasOwnProperty.call(publicSession, 'token') && !('passwordHash' in publicSession.user)
    && !('internalFlags' in publicSession.user) && !('access_token' in publicSession.user),
    'renderer account session exposes only allowlisted identity fields without bearer or future internal fields');
  const sanitized = T.sanitizeOnlineResponse({ success: true, token: 'secret', nested: { refreshToken: 'refresh', access_token: 'snake', passwordHash: 'hash', value: 1 } });
  check(sanitized.success && sanitized.nested.value === 1 && !('token' in sanitized) && !('refreshToken' in sanitized.nested)
    && !('access_token' in sanitized.nested) && !('passwordHash' in sanitized.nested),
    'account responses recursively remove session secrets');
  const publicAccountResponse = T.sanitizeAccountOnlineResponse({ success: true, user: { id: 8, username: '公开', internalFlags: ['secret'], recoveryCodes: ['x'] } });
  check(publicAccountResponse.user.id === 8 && publicAccountResponse.user.username === '公开'
    && !('internalFlags' in publicAccountResponse.user) && !('recoveryCodes' in publicAccountResponse.user),
    'login/register/me response user uses the same explicit public DTO');
  check(T.normalizeOnlineRendererRoute('GET', 'workshop/pack?id=x').route === 'workshop/pack'
    && throws(() => T.normalizeOnlineRendererRoute('GET', 'https://attacker.invalid/steal'), /非法|授权/)
    && throws(() => T.normalizeOnlineRendererRoute('POST', '../account/login'), /非法|授权/),
    'renderer online proxy accepts only fixed methods and routes');
  check(T.getOnlineRendererBodyLimit('feed/post') === 1024 * 1024
    && T.getOnlineRendererBodyLimit('workshop/upload') === 4 * 1024 * 1024,
    'online proxy applies route-specific JSON body limits');
  check(throws(() => T.assertOnlineRendererBodySize('feed/post', { text: 'x'.repeat(2 * 1024 * 1024) }), /1MB/)
    && !throws(() => T.assertOnlineRendererBodySize('workshop/upload', { text: 'x'.repeat(2 * 1024 * 1024) }))
    && throws(() => T.assertOnlineRendererBodySize('workshop/upload', { text: 'x'.repeat(5 * 1024 * 1024) }), /4MB/),
    'main process repeats body-size validation even if preload is bypassed');

  const oversizedHeaders = { get: name => name === 'content-length' ? '20' : null };
  let bodyError = null;
  try { await T.readRemoteTextLimited({ headers: oversizedHeaders, arrayBuffer: async () => Buffer.from('x') }, 10, 50); }
  catch (error) { bodyError = error; }
  check(bodyError && /大小上限/.test(bodyError.message), 'declared oversized response is rejected before buffering');
  const actualHeaders = { get: () => null };
  bodyError = null;
  try { await T.readRemoteTextLimited({ headers: actualHeaders, arrayBuffer: async () => Buffer.from('01234567890') }, 10, 50); }
  catch (error) { bodyError = error; }
  check(bodyError && /大小上限/.test(bodyError.message), 'undeclared oversized response is rejected after bounded read');

  const hostileSaveName = '<img src=x onerror="globalThis.__desktopSaveOwned=1">';
  const preparedSidecarPayload = T.prepareDesktopSavePayload({
    _saveMeta: { name: hostileSaveName, scenario: '<script>owned()</script>', turn: 0 },
    gameState: { turn: 0, _campaignId: 'campaign-sidecar', _timelineId: 'tml_sidecar_12345678', privatePayload: 'must-not-leak' }
  }, 'payload-generation-sidecar-0001');
  const sidecar = T.desktopSaveMetadataFromData(preparedSidecarPayload.data, 'manual-save-key',
    { size: 123, mtimeMs: 456, ctimeMs: 457, ino: 9 }, preparedSidecarPayload.generation);
  check(sidecar.name === hostileSaveName && sidecar.meta.turn === 0
    && sidecar.meta.campaignId === 'campaign-sidecar' && sidecar.meta.timelineId === 'tml_sidecar_12345678'
    && sidecar.version === 3 && sidecar.payload.size === 123 && sidecar.payload.mtimeMs === 456
    && sidecar.payload.ctimeMs === 457 && sidecar.payload.ino === 9
    && sidecar.payloadGeneration === 'payload-generation-sidecar-0001'
    && preparedSidecarPayload.data.__tmDesktopSaveGeneration === sidecar.payloadGeneration
    && preparedSidecarPayload.text.startsWith('{"__tmDesktopSaveGeneration":"payload-generation-sidecar-0001"')
    && !Object.prototype.hasOwnProperty.call(sidecar, 'gameState') && !Object.prototype.hasOwnProperty.call(sidecar.meta, 'privatePayload'),
  'desktop save sidecar preserves display text and identity, binds a payload generation, and never copies world payloads');
  const rotatedPayload = T.prepareDesktopSavePayload({ __tmDesktopSaveGeneration: 'old-payload-generation-0001', marker: true });
  check(rotatedPayload.generation !== 'old-payload-generation-0001'
    && rotatedPayload.text.startsWith('{"__tmDesktopSaveGeneration":"' + rotatedPayload.generation + '"'),
  'every desktop save commit rotates the embedded payload generation instead of trusting a renderer-carried old value');
  const autoSidecar = T.desktopSaveMetadataFromData({ gameState: { turn: 3, saveName: '玩家档名' } }, '__autosave__');
  check(autoSidecar.name === '__autosave__', 'desktop canonical autosave remains hidden from manual-save listings');

  const bombPath = path.join(TMP, 'workshop-bomb.tm-pack');
  const bombZip = new AdmZip();
  bombZip.addFile('manifest.json', Buffer.from('{"id":"bomb","type":"scenario","entry":"payload.json"}'));
  bombZip.addFile('payload.json', Buffer.alloc(2 * 1024 * 1024, 0x41));
  bombZip.writeZip(bombPath);
  const tempNamesBefore = new Set(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('tianming-pack-')));
  let bombError = null;
  try { await T.extractZipToTemp(bombPath); } catch (error) { bombError = error; }
  const tempNamesAfter = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('tianming-pack-'));
  check(bombError && /压缩比异常|ZIP 炸弹/.test(bombError.message), 'high-ratio workshop ZIP is rejected during central-directory preflight');
  check(tempNamesAfter.every(name => tempNamesBefore.has(name)), 'rejected ZIP creates no extraction directory and writes no expanded payload');

  const safeZipPath = path.join(TMP, 'workshop-safe.tm-pack');
  const safeZip = new AdmZip();
  safeZip.addFile('manifest.json', Buffer.from('{"id":"safe","type":"scenario","entry":"scenario.json"}'));
  safeZip.addFile('scenario.json', Buffer.from('{"id":"safe-scenario","name":"安全测试"}'));
  safeZip.writeZip(safeZipPath);
  const extractedSafe = await T.extractZipToTemp(safeZipPath);
  check(JSON.parse(fs.readFileSync(path.join(extractedSafe, 'scenario.json'), 'utf8')).id === 'safe-scenario',
    'valid workshop ZIP is extracted entry-by-entry after preflight');
  fs.rmSync(extractedSafe, { recursive: true, force: true });

  const hotBombPath = path.join(TMP, 'hot-size-header-bomb.zip');
  const hotBombZip = new AdmZip();
  hotBombZip.addFile('index.html', Buffer.from('<!doctype html>'));
  const hotBombBytes = hotBombZip.toBuffer();
  const centralHeader = hotBombBytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  check(centralHeader >= 0, 'hot-update fixture contains a central-directory header');
  // 0xffffffff is the ZIP64 sentinel; use 4GB-2 so the parser exposes the malicious declared size
  // to our quota validator without requiring a ZIP64 extra field.
  hotBombBytes.writeUInt32LE(0xfffffffe, centralHeader + 24);
  fs.writeFileSync(hotBombPath, hotBombBytes);
  const hotTempsBefore = new Set(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('tianming-hot-')));
  let hotBombError = null;
  try { await T.extractZipToTempChecked(hotBombPath, 'tianming-hot-'); } catch (error) { hotBombError = error; }
  const hotTempsAfter = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('tianming-hot-'));
  check(hotBombError && /声明解压体积|单文件声明解压体积|ZIP 炸弹/.test(hotBombError.message),
    'hot-update ZIP with a 4GB declared size is rejected during central-directory preflight; actual=' + String(hotBombError && hotBombError.message));
  check(hotTempsAfter.every(name => hotTempsBefore.has(name)), 'rejected hot-update ZIP allocates no extraction directory');

  const mainSource = fs.readFileSync(path.join(ROOT, 'main-impl.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(ROOT, 'preload-impl.js'), 'utf8');
  const builderSource = fs.readFileSync(path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const listSavesStart = mainSource.indexOf("ipcMain.handle('list-saves'");
  const listSavesEnd = mainSource.indexOf("ipcMain.handle('delete-save'", listSavesStart);
  const listSavesSource = mainSource.slice(listSavesStart, listSavesEnd);
  const loadProjectStart = mainSource.indexOf("ipcMain.handle('load-project'");
  const loadProjectEnd = mainSource.indexOf("ipcMain.handle('list-saves'", loadProjectStart);
  const loadProjectSource = mainSource.slice(loadProjectStart, loadProjectEnd);
  const loadAutoStart = mainSource.indexOf("ipcMain.handle('load-auto-save'");
  const loadAutoEnd = mainSource.indexOf("ipcMain.handle('dialog-export'", loadAutoStart);
  const loadAutoSource = mainSource.slice(loadAutoStart, loadAutoEnd);
  check(loadProjectStart >= 0 && loadProjectEnd > loadProjectStart
    && loadAutoStart >= 0 && loadAutoEnd > loadAutoStart
    && !/prepareDesktopSavePayload|writeFileAtomic|writeDesktopSaveMetadata|invalidateDesktopSaveGeneration/.test(loadProjectSource)
    && !/prepareDesktopSavePayload|writeFileAtomic|writeDesktopSaveMetadata|invalidateDesktopSaveGeneration|persistAutoSaveSessionToken/.test(loadAutoSource),
  'desktop manual and autosave read handlers never rewrite payloads or sidecars during load');
  check(listSavesStart >= 0 && listSavesEnd > listSavesStart
    && /readDesktopSaveGeneration\(storageKey, fp\)/.test(listSavesSource)
    && /readDesktopSaveMetadata\(storageKey, stats, payloadGeneration\)/.test(listSavesSource)
    && !/readFileSync\(fp|JSON\.parse\(raw/.test(listSavesSource),
  'desktop save listing reads lightweight sidecars without parsing every world payload');
  const desktopSaveDir = path.join(TMP, 'userData', 'saves');
  const desktopMetadataDir = path.join(desktopSaveDir, '.metadata');
  fs.mkdirSync(desktopMetadataDir, { recursive: true });
  for (let i = 0; i < 100; i++) {
    const storageKey = 'large-save-' + i;
    const payloadPath = path.join(desktopSaveDir, storageKey + '.json');
    const payloadGeneration = 'fixture-payload-generation-' + String(i).padStart(4, '0');
    fs.writeFileSync(payloadPath, '{"__tmDesktopSaveGeneration":"' + payloadGeneration + '","invalid":"' + 'x'.repeat(64 * 1024));
    const payloadStats = fs.statSync(payloadPath);
    fs.writeFileSync(path.join(desktopMetadataDir, storageKey + '.json'), JSON.stringify({
      version: 3,
      storageKey,
      name: '大型存档 ' + i,
      meta: { scenario: '测试剧本', turn: i, campaignId: 'campaign-sidecars', timelineId: 'tml_sidecars_12345678' },
      payload: {
        size: payloadStats.size, mtimeMs: payloadStats.mtimeMs, ctimeMs: payloadStats.ctimeMs,
        birthtimeMs: payloadStats.birthtimeMs, ino: payloadStats.ino, dev: payloadStats.dev
      },
      payloadGeneration,
      metadataGeneration: 'fixture-' + i,
      updatedAt: Date.now()
    }));
    fs.writeFileSync(path.join(desktopMetadataDir, storageKey + '.generation.json'), JSON.stringify({
      version: 1, storageKey, payloadGeneration, updatedAt: Date.now()
    }));
  }
  const listHandler = ipcHandlers.get('list-saves');
  check(typeof listHandler === 'function', 'desktop list-saves IPC handler is registered through the trusted gate');
  const readPaths = [];
  const originalReadFile = fs.promises.readFile;
  fs.promises.readFile = function(file) {
    readPaths.push(path.resolve(String(file)));
    return originalReadFile.apply(this, arguments);
  };
  let listed;
  try { listed = await listHandler({ senderFrame: mainFrame, sender: { mainFrame } }); }
  finally { fs.promises.readFile = originalReadFile; }
  check(listed && listed.success === true && listed.files.length === 100
    && listed.files.every(file => file.meta && file.meta.timelineId === 'tml_sidecars_12345678'),
  '100 desktop saves list successfully even when every full payload is deliberately unparsable');
  check(readPaths.length === 200 && readPaths.every(file => path.dirname(file) === path.resolve(desktopMetadataDir)),
    'desktop listing reads only small sidecar/generation records plus bounded payload prefixes, never full world payloads');
  const refHandler = ipcHandlers.get('list-save-timeline-refs');
  const refs = await refHandler({ senderFrame: mainFrame, sender: { mainFrame } });
  check(refs && refs.success === true && refs.complete === true && refs.refs.length === 100
    && refs.refs.every(ref => ref.campaignId === 'campaign-sidecars' && ref.timelineId === 'tml_sidecars_12345678'),
    'desktop timeline reference registry is complete when every payload has a current v3 sidecar generation');

  const stalePayloadPath = path.join(desktopSaveDir, 'large-save-0.json');
  fs.appendFileSync(stalePayloadPath, 'new-generation');
  const staleListed = await listHandler({ senderFrame: mainFrame, sender: { mainFrame } });
  const staleRow = staleListed.files.find(file => file.storageKey === 'large-save-0');
  const staleRefs = await refHandler({ senderFrame: mainFrame, sender: { mainFrame } });
  check(staleRow && staleRow.metadataPending === true && staleRow.meta === null && staleRow.name === 'large-save-0',
    'payload overwrite with a failed sidecar update is shown as metadataPending, never as trusted stale metadata');
  check(staleRefs && staleRefs.success === true && staleRefs.complete === false,
    'timeline GC reference registry fails closed while any desktop sidecar is missing or stale');

  const sameStampPayloadPath = path.join(desktopSaveDir, 'large-save-1.json');
  const sameStampBefore = fs.statSync(sameStampPayloadPath);
  const sameStampBytes = fs.readFileSync(sameStampPayloadPath);
  fs.writeFileSync(sameStampPayloadPath, Buffer.alloc(sameStampBytes.length, 0x79));
  fs.utimesSync(sameStampPayloadPath, sameStampBefore.atime, sameStampBefore.mtime);
  const sameStampListed = await listHandler({ senderFrame: mainFrame, sender: { mainFrame } });
  const sameStampRow = sameStampListed.files.find(file => file.storageKey === 'large-save-1');
  check(sameStampRow && sameStampRow.metadataPending === true && sameStampRow.meta === null,
    'same-size payload replacement with restored mtime is rejected by the embedded payload generation');

  const legacyReadOnlyPath = path.join(desktopSaveDir, 'legacy-readonly.json');
  const legacyReadOnlyData = {
    _saveMeta: { name: '只读旧档', scenario: '兼容测试', turn: 7 },
    gameState: { turn: 7, _campaignId: 'campaign-readonly', _timelineId: 'tml_readonly_12345678' }
  };
  fs.writeFileSync(legacyReadOnlyPath, JSON.stringify(legacyReadOnlyData));
  const legacyBytesBefore = fs.readFileSync(legacyReadOnlyPath);
  const legacyStatBefore = fs.statSync(legacyReadOnlyPath);
  const loadHandler = ipcHandlers.get('load-project');
  check(typeof loadHandler === 'function', 'desktop load-project IPC handler is registered through the trusted gate');
  const originalOpenSync = fs.openSync;
  fs.openSync = function(file, flags) {
    if (/[wax+]/.test(String(flags || ''))) {
      const error = new Error('simulated read-only storage');
      error.code = 'ENOSPC';
      throw error;
    }
    return originalOpenSync.apply(this, arguments);
  };
  let legacyLoaded;
  try {
    legacyLoaded = await loadHandler({ senderFrame: mainFrame, sender: { mainFrame } }, 'legacy-readonly');
  } finally {
    fs.openSync = originalOpenSync;
  }
  const legacyStatAfter = fs.statSync(legacyReadOnlyPath);
  check(legacyLoaded && legacyLoaded.success === true && legacyLoaded.metadataPending === true
    && legacyLoaded.data.gameState.turn === 7,
  'legacy desktop payload without a generation still loads when every attempted write would fail');
  check(fs.readFileSync(legacyReadOnlyPath).equals(legacyBytesBefore)
    && legacyStatAfter.mtimeMs === legacyStatBefore.mtimeMs,
  'loading a legacy desktop payload preserves its bytes and modification time');

  const legacyAutoPath = path.join(desktopSaveDir, '__autosave__.json');
  const legacyAutoData = {
    __tmAutoSaveEnvelope: 1,
    sessionToken: 'readonly-session-token-1234',
    data: { gameState: { turn: 8, _campaignId: 'campaign-auto-readonly', _timelineId: 'tml_auto_readonly_12345678' } }
  };
  fs.writeFileSync(legacyAutoPath, JSON.stringify(legacyAutoData));
  const legacyAutoBytes = fs.readFileSync(legacyAutoPath);
  const legacyAutoStat = fs.statSync(legacyAutoPath);
  const loadAutoHandler = ipcHandlers.get('load-auto-save');
  check(typeof loadAutoHandler === 'function', 'desktop load-auto-save IPC handler is registered through the trusted gate');
  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = function() {
    const error = new Error('simulated read-only autosave storage');
    error.code = 'EACCES';
    throw error;
  };
  let legacyAutoLoaded;
  try {
    legacyAutoLoaded = await loadAutoHandler({ senderFrame: mainFrame, sender: { mainFrame } });
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }
  const legacyAutoStatAfter = fs.statSync(legacyAutoPath);
  check(legacyAutoLoaded && legacyAutoLoaded.success === true && legacyAutoLoaded.metadataPending === true
    && legacyAutoLoaded.data.gameState.turn === 8,
  'legacy autosave adopts a missing session sidecar in memory and still loads on read-only storage');
  check(fs.readFileSync(legacyAutoPath).equals(legacyAutoBytes)
    && legacyAutoStatAfter.mtimeMs === legacyAutoStat.mtimeMs,
  'loading a legacy autosave preserves its payload bytes and modification time');
  const remoteSource = fs.readFileSync(path.join(ROOT, 'main-safe-remote.js'), 'utf8');
  check(mainSource.includes('safeRemote.fetchRemoteResponse') && remoteSource.includes('await validate(current)')
    && remoteSource.includes('lookup(hostname, options, callback)') && remoteSource.includes('agent: false')
    && remoteSource.includes('proxyEnv: {}') && !remoteSource.includes('net.fetch('), 'network transport validates every hop and uses pinned direct sockets without browser credentials or proxy agents');
  check(mainSource.includes('WORKSHOP_CATALOG_AUTHORIZATIONS.get(packageUrl)')
    && mainSource.includes('工坊包地址未获官方目录授权'), 'remote workshop install is bound to the last official catalog snapshot');
  check(!/checkHotUpdate:\s*\([^)]*feedUrl/.test(preloadSource) && !/installHotUpdate:\s*\([^)]*feedUrl/.test(preloadSource)
    && !/checkForUpdate:\s*\([^)]*feedUrl/.test(preloadSource), 'renderer bridge cannot provide ordinary/hot update feed URLs');
  check(!builderSource.includes("addLocalFile(path.join(APP_ROOT, 'main")
    && !builderSource.includes("addLocalFile(path.join(APP_ROOT, 'preload"), 'content OTA builder cannot package main/preload executable code');
  check(!/require\(['"]adm-zip['"]\)/.test(mainSource)
    && /tempDir = await extractZipToTempChecked\(/.test(mainSource)
    && /preflightHotUpdateZip\(zipPath\)/.test(mainSource),
  'production hot-update extraction uses awaited bounded yauzl streaming instead of adm-zip');
  check(!packageJson.dependencies['adm-zip'] && /^\^?0\.6\./.test(packageJson.devDependencies['adm-zip'])
    && packageLock.packages['node_modules/adm-zip'].version === '0.6.0'
    && packageLock.packages['node_modules/adm-zip'].dev === true,
  'adm-zip is build/read tooling only, excluded from the production dependency closure');
  check(/^\^?6\.8\.9$/.test(packageJson.dependencies['electron-updater'])
    && packageLock.packages['node_modules/electron-updater'].version === '6.8.9'
    && packageLock.packages['node_modules/electron-updater/node_modules/builder-util-runtime'].version === '9.7.0',
  'runtime updater stack includes the cross-origin credential redirect fix');
  check(packageLock.packages['node_modules/js-yaml'].version === '4.3.2',
  'runtime YAML parser also bounds repeated empty merge sources');

  // 打包进程即使继承测试环境变量，也不得暴露任何测试出口。
  electronStub.app.isPackaged = true;
  delete require.cache[require.resolve(path.join(ROOT, 'main-impl.js'))];
  const packagedModule = require(path.join(ROOT, 'main-impl.js'));
  check(!packagedModule.__test, 'packaged build ignores TIANMING_TEST_EXPORTS and exposes no test internals');
  check(/const allowUnsignedTest = TEST_MODE;/.test(mainSource)
    && /isLocalHttp && TEST_MODE/.test(mainSource)
    && /allowLocal: TEST_MODE/.test(mainSource) && /deps.allowLocal === true/.test(remoteSource),
    'unsigned updates, localhost HTTP and test exports share the same unpackaged TEST_MODE gate');

  console.log('[smoke-security-trust-boundary] PASS assertions=' + assertions);
}

main().finally(() => {
  Module._load = originalLoad;
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
}).catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
