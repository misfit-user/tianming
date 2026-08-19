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
  ipcMain: { handle() {}, on() {} },
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
  const originalNetFetch = electronStub.net.fetch;
  let bodyAbortObserved = false;
  electronStub.net.fetch = async function(_url, init) {
    return {
      ok: true, status: 200, statusText: 'OK', headers: { get: () => null },
      body: {
        getReader() {
          return {
            read() {
              return new Promise((resolve, reject) => {
                if (init.signal.aborted) return reject(new Error('aborted'));
                init.signal.addEventListener('abort', () => { bodyAbortObserved = true; reject(new Error('aborted')); }, { once: true });
              });
            },
            async cancel() {},
            releaseLock() {}
          };
        }
      }
    };
  };
  const callerAbort = new AbortController();
  const stalled = await T.fetchRemoteResponse('http://127.0.0.1/stalled', { signal: callerAbort.signal, timeoutMs: 10000 });
  const stalledRead = T.readRemoteTextLimited(stalled.response, 100, 1000).catch(error => error);
  setTimeout(() => callerAbort.abort(), 5);
  const stalledError = await stalledRead;
  electronStub.net.fetch = originalNetFetch;
  check(bodyAbortObserved && /aborted/.test(String(stalledError && stalledError.message)), 'caller abort remains connected after response headers and stops a stalled body');
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

  const publicSession = T.toPublicAccountSession({ token: 'secret', user: { id: 7 }, loggedInAt: 'now' });
  check(publicSession.loggedIn === true && publicSession.user.id === 7 && !Object.prototype.hasOwnProperty.call(publicSession, 'token'),
    'renderer account session exposes identity without bearer token');
  const sanitized = T.sanitizeOnlineResponse({ success: true, token: 'secret', nested: { refreshToken: 'refresh', value: 1 } });
  check(sanitized.success && sanitized.nested.value === 1 && !('token' in sanitized) && !('refreshToken' in sanitized.nested),
    'account responses recursively remove session secrets');
  check(T.normalizeOnlineRendererRoute('GET', 'workshop/pack?id=x').route === 'workshop/pack'
    && throws(() => T.normalizeOnlineRendererRoute('GET', 'https://attacker.invalid/steal'), /非法|授权/)
    && throws(() => T.normalizeOnlineRendererRoute('POST', '../account/login'), /非法|授权/),
    'renderer online proxy accepts only fixed methods and routes');

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

  const mainSource = fs.readFileSync(path.join(ROOT, 'main-impl.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(ROOT, 'preload-impl.js'), 'utf8');
  const builderSource = fs.readFileSync(path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js'), 'utf8');
  check(mainSource.includes("redirect: 'manual'") && mainSource.includes('dns.lookup(hostname, { all: true')
    && mainSource.includes("credentials: 'omit'") && mainSource.includes("referrerPolicy: 'no-referrer'"), 'network proxy revalidates DNS/redirects and omits ambient credentials');
  check(mainSource.includes('WORKSHOP_CATALOG_AUTHORIZATIONS.get(packageUrl)')
    && mainSource.includes('工坊包地址未获官方目录授权'), 'remote workshop install is bound to the last official catalog snapshot');
  check(!/checkHotUpdate:\s*\([^)]*feedUrl/.test(preloadSource) && !/installHotUpdate:\s*\([^)]*feedUrl/.test(preloadSource)
    && !/checkForUpdate:\s*\([^)]*feedUrl/.test(preloadSource), 'renderer bridge cannot provide ordinary/hot update feed URLs');
  check(!builderSource.includes("addLocalFile(path.join(APP_ROOT, 'main")
    && !builderSource.includes("addLocalFile(path.join(APP_ROOT, 'preload"), 'content OTA builder cannot package main/preload executable code');

  // 打包进程即使继承测试环境变量，也不得暴露任何测试出口。
  electronStub.app.isPackaged = true;
  delete require.cache[require.resolve(path.join(ROOT, 'main-impl.js'))];
  const packagedModule = require(path.join(ROOT, 'main-impl.js'));
  check(!packagedModule.__test, 'packaged build ignores TIANMING_TEST_EXPORTS and exposes no test internals');
  check(/const allowUnsignedTest = TEST_MODE;/.test(mainSource)
    && /isLocalHttp && TEST_MODE/.test(mainSource)
    && /const localDev = TEST_MODE/.test(mainSource),
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
