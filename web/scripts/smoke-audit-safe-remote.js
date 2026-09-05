'use strict';
const assert = require('assert'), http = require('http'), { EventEmitter } = require('events'), { PassThrough } = require('stream');
const { isPrivateNetworkAddress: blocked, createSafeRemote } = require('../../main-safe-remote');
for (const ip of ['::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:0001', '0:0:0:0:0:0:0:1', '::', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1', '10.0.0.1', '198.51.100.1', 'bad', '::1%lo']) assert.equal(blocked(ip), true, ip);
for (const ip of ['8.8.8.8', '::ffff:808:808', '2606:4700:4700::1111']) assert.equal(blocked(ip), false, ip);
(async () => {
  let dnsCalls = 0, requests = 0;
  const api = createSafeRemote({ resolveUrl: u => { const p = new URL(u); if (p.protocol !== 'https:') throw new Error('HTTPS required'); return p.href; },
    lookup: async host => { dnsCalls++; return [{ address: host === 'private.test' ? '::ffff:7f00:1' : '8.8.8.8', family: host === 'private.test' ? 6 : 4 }]; },
    request(url, options, respond) {
      requests++; assert.equal(options.agent, false); assert.equal(options.rejectUnauthorized, true); assert.equal(options.servername, new URL(url).hostname); assert.equal(options.headers.host, new URL(url).host);
      options.lookup(new URL(url).hostname, {}, (err, address, family) => { assert.ifError(err); assert.equal(address, '8.8.8.8'); assert.equal(family, 4); });
      const req = new EventEmitter(); req.setTimeout = () => {}; req.destroy = e => { if (e) req.emit('error', e); }; req.end = () => queueMicrotask(() => {
        const res = new PassThrough(); res.statusCode = url.includes('/redirect') ? 302 : 200; res.statusMessage = 'OK';
        res.headers = res.statusCode === 302 ? { location: 'https://private.test/data' } : {};
        respond(res); res.end('ok');
      }); return req;
    } });
  const normal = await api.fetchRemoteResponse('https://public.test/data'); assert.equal(await normal.response.text(), 'ok'); assert.equal(dnsCalls, 1);
  await assert.rejects(api.fetchRemoteResponse('https://public.test/redirect'), /私网/); assert.equal(requests, 2);
  await assert.rejects(api.fetchRemoteResponse('https://127.0.0.1/'), /IP/);
  // Actual isolated loopback connection. Validation DNS is mutable, socket lookup must use the captured result only.
  let lookups = 0, seenHost = '';
  const server = http.createServer((req, res) => { seenHost = req.headers.host; if (req.url === '/redirect') { res.writeHead(302, { location: '/ok' }); res.end(); } else res.end('controlled'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://localhost:' + server.address().port;
  const local = createSafeRemote({ resolveUrl: u => new URL(u).href, allowLocal: true, lookup: async () => { lookups++; return [{ address: '127.0.0.1', family: 4 }]; } });
  try {
    const response = await local.fetchRemoteResponse(url + '/redirect'); assert.equal(await response.response.text(), 'controlled'); assert.equal(lookups, 2); assert.equal(seenHost, new URL(url).host);
    const ac = new AbortController(); ac.abort(); await assert.rejects(local.fetchRemoteResponse(url, { signal: ac.signal }), { name: 'AbortError' });
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS address equivalence, pinned lookup and per-hop validation; controlled Node loopback only, not an Electron SSRF attack');
})().catch(e => { console.error(e); process.exitCode = 1; });
