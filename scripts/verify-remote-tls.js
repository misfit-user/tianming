'use strict';
// Controlled loopback TLS only. Real production transport; no production services,
// credentials, disabled TLS verification, external DNS or purported SSRF exploit.
const fs = require('fs'), os = require('os'), path = require('path'), https = require('https');
const assert = require('assert/strict'), { spawnSync } = require('child_process');
const { createSafeRemote } = require('../main-safe-remote.js');
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-remote-tls-'));
  const openssl = process.platform === 'win32' ? path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/usr/bin/openssl.exe') : 'openssl';
  let server; let passed = 0;
  try {
    const key = path.join(temp, 'key.pem'), cert = path.join(temp, 'cert.pem');
    const generated = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
      '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { encoding: 'utf8', windowsHide: true });
    if (generated.error || generated.status !== 0) throw new Error('TLS fixture certificate generation failed: ' + (generated.error || generated.stderr));
    const ca = fs.readFileSync(cert), seen = [];
    server = https.createServer({ key: fs.readFileSync(key), cert: ca }, (req, res) => {
      seen.push({ path: req.url, host: req.headers.host, sni: req.socket.servername, peer: req.socket.remoteAddress });
      if (req.url === '/redirect') { res.writeHead(302, { location: '/ok' }); res.end(); }
      else if (req.url === '/private') { res.writeHead(302, { location: 'https://private.invalid:' + server.address().port + '/ok' }); res.end(); }
      else { res.end('real-tls-response'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const url = 'https://localhost:' + server.address().port;
    const resolveUrl = value => { const parsed = new URL(value); assert.equal(parsed.protocol, 'https:'); return parsed.href; };
    async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
    await test('validated address remains pinned after DNS source changes; Host and SNI preserved', async () => {
      let dns = '127.0.0.1', lookups = 0, requests = 0;
      const remote = createSafeRemote({ resolveUrl, allowLocal: true,
        lookup: async () => { lookups++; return [{ address: dns, family: 4 }]; },
        request(target, options, callback) {
          requests++; dns = '127.0.0.2'; // would not reach our server if transport re-resolved
          assert.equal(options.agent, false); assert.equal(options.rejectUnauthorized, true);
          assert.equal(options.autoSelectFamily, false); assert.deepEqual(options.proxyEnv, {});
          assert.equal(options.servername, 'localhost');
          return https.request(target, { ...options, ca }, callback); // trust only this ephemeral fixture CA
        } });
      const result = await remote.fetchRemoteResponse(url + '/ok'); assert.equal(await result.response.text(), 'real-tls-response');
      assert.equal(lookups, 1); assert.equal(requests, 1);
      assert.deepEqual(seen.at(-1), { path: '/ok', host: 'localhost:' + server.address().port, sni: 'localhost', peer: '127.0.0.1' });
    });
    const transport = (target, options, callback) => https.request(target, { ...options, ca }, callback);
    await test('each redirect performs new validation and uses a separate connection', async () => {
      let validations = 0;
      const remote = createSafeRemote({ resolveUrl, allowLocal: true, request: transport,
        lookup: async () => { validations++; return [{ address: '127.0.0.1', family: 4 }]; } });
      const result = await remote.fetchRemoteResponse(url + '/redirect'); assert.equal(await result.response.text(), 'real-tls-response'); assert.equal(validations, 2);
    });
    await test('redirect private address is rejected before a connection to that hop', async () => {
      const before = seen.length;
      const remote = createSafeRemote({ resolveUrl, allowLocal: true, request: transport,
        lookup: async () => [{ address: '127.0.0.1', family: 4 }] });
      await assert.rejects(remote.fetchRemoteResponse(url + '/private'), /私网或保留地址/);
      assert.equal(seen.length, before + 1);
    });
    await test('cross-origin credentials cannot follow redirect', async () => {
      const before = seen.length;
      const remote = createSafeRemote({ resolveUrl, allowLocal: true, request: transport,
        lookup: async () => [{ address: '127.0.0.1', family: 4 }] });
      await assert.rejects(remote.fetchRemoteResponse(url + '/private', { headers: { authorization: 'test-only-not-a-token' } }), /带凭据请求不允许跨源重定向/);
      assert.equal(seen.length, before + 1);
    });
    await test('untrusted TLS certificate is rejected, no HTTP request or silent retry', async () => {
      const before = seen.length;
      const remote = createSafeRemote({ resolveUrl, allowLocal: true,
        lookup: async () => [{ address: '127.0.0.1', family: 4 }] });
      await assert.rejects(remote.fetchRemoteResponse(url + '/ok'), /self.signed|certificate/i); assert.equal(seen.length, before);
    });
    console.log(JSON.stringify({ complete: true, PASS: passed, FAIL: 0, SKIP: 0, WAIVED: 0, runtime: process.version, platform: process.platform, scope: 'controlled loopback TLS, actual main-safe-remote transport; not a production SSRF attack' }));
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    // This is exclusively the mkdtemp fixture above, never application/user data.
    fs.rmSync(temp, { recursive: true });
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
