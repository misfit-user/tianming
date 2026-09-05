'use strict';
const net = require('net'), http = require('http'), https = require('https'), { Readable } = require('stream'), zlib = require('zlib');
function isPrivateNetworkAddress(address) {
  const raw = String(address || '').toLowerCase();
  if (net.isIPv4(raw)) {
    const p = raw.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
      || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
      || (p[0] === 192 && (p[1] === 0 || p[1] === 168))
      || (p[0] === 198 && (p[1] === 18 || p[1] === 19 || (p[1] === 51 && p[2] === 100)))
      || (p[0] === 203 && p[1] === 0 && p[2] === 113) || p[0] >= 224 || raw === '168.63.129.16';
  }
  if (!net.isIPv6(raw) || raw.includes('%')) return true;
  // URL canonicalizes dotted mapped addresses to hex; compare numeric words, not spelling.
  const normalized = new URL('http://[' + raw + ']/').hostname.slice(1, -1);
  const parts = normalized.split('::'), left = parts[0] ? parts[0].split(':') : [], right = parts[1] ? parts[1].split(':') : [];
  const words = (parts.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left).map(x => parseInt(x, 16));
  if (words.length !== 8 || words.some(x => !Number.isInteger(x))) return true;
  if (words.slice(0, 5).every(x => x === 0) && words[5] === 0xffff) {
    return isPrivateNetworkAddress([words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join('.'));
  }
  return words.slice(0, 6).every(x => x === 0) // unspecified, loopback and deprecated compatible addresses
    || (words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80 || (words[0] & 0xff00) === 0xff00
    || (words[0] === 0x2001 && words[1] === 0xdb8);
}
function createSafeRemote(deps) {
  async function validate(rawUrl) {
    const url = deps.resolveUrl(rawUrl), parsed = new URL(url), hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    const local = deps.allowLocal === true && /^(localhost|127\.0\.0\.1|::1)$/i.test(hostname);
    if (net.isIP(hostname) && !local) throw new Error('远程地址不允许直接使用 IP，已拒绝');
    const records = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await deps.lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some(r => !net.isIP(r.address) || (!local && isPrivateNetworkAddress(r.address)))) throw new Error('远程地址 DNS 解析到私网或保留地址，已拒绝');
    return { url, hostname, records: records.map(r => ({ address: r.address, family: net.isIP(r.address) })) };
  }
  function request(target, init) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(target.url), headers = new Headers(init.headers || {});
      headers.set('host', parsed.host); headers.set('accept-encoding', 'identity');
      const timeout = Math.max(1000, Math.min(120000, Number(init.timeoutMs) || 30000));
      const transport = deps.request || (parsed.protocol === 'https:' ? https.request : http.request);
      let req, response, timer, settled = false;
      const signal = init.signal;
      const cleanup = () => { clearTimeout(timer); if (signal) signal.removeEventListener('abort', abort); };
      const abort = () => { const e = new Error('Remote request aborted'); e.name = 'AbortError'; if (req) req.destroy(e); };
      const fail = error => { cleanup(); if (response) response.destroy(error); if (!settled) { settled = true; reject(error); } };
      if (signal && signal.aborted) { const e = new Error('Remote request aborted'); e.name = 'AbortError'; reject(e); return; }
      try {
        req = transport(target.url, {
          method: init.method || 'GET', headers: Object.fromEntries(headers),
          // No Electron proxy, global agent, connection reuse, environment proxy or automatic retry.
          agent: false, autoSelectFamily: false, proxyEnv: {}, rejectUnauthorized: true,
          servername: net.isIP(target.hostname) ? '' : target.hostname,
          lookup(hostname, options, callback) {
            if (hostname !== target.hostname) return callback(new Error('Validated hostname changed'));
            if (options && options.all) return callback(null, target.records.slice());
            callback(null, target.records[0].address, target.records[0].family);
          }
        }, res => {
          response = res; clearTimeout(timer);
          res.once('close', cleanup); res.once('error', fail);
          try {
            const hs = new Headers(); for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) hs.set(k, Array.isArray(v) ? v.join(', ') : v);
            const encoding = String(hs.get('content-encoding') || '').toLowerCase();
            let stream = res;
            if (encoding && encoding !== 'identity') {
              const decoder = encoding === 'gzip' ? zlib.createGunzip() : encoding === 'deflate' ? zlib.createInflate() : encoding === 'br' ? zlib.createBrotliDecompress() : null;
              if (!decoder) throw new Error('Unsupported content encoding');
              res.on('error', e => decoder.destroy(e)); decoder.on('close', () => res.destroy()); stream = res.pipe(decoder);
              hs.delete('content-encoding'); hs.delete('content-length');
            }
            const redirect = [301, 302, 303, 307, 308].includes(res.statusCode);
            const noBody = redirect || init.method === 'HEAD' || [204, 205, 304].includes(res.statusCode);
            if (redirect) res.destroy(); else if (noBody) res.resume();
            settled = true;
            resolve(new Response(noBody ? null : Readable.toWeb(stream), { status: res.statusCode, statusText: res.statusMessage, headers: hs }));
          } catch (error) { req.destroy(error); fail(error); }
        });
        req.once('error', fail);
        req.setTimeout(timeout, abort); // body idle timeout remains active after headers
        timer = setTimeout(abort, timeout);
        if (signal) signal.addEventListener('abort', abort, { once: true });
        req.end(init.body);
      } catch (error) { if (req) req.destroy(); fail(error); }
    });
  }
  async function fetchRemoteResponse(rawUrl, init = {}, maxRedirects = 5) {
    let current = deps.resolveUrl(rawUrl); const initialOrigin = new URL(current).origin, method = String(init.method || 'GET').toUpperCase();
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const target = await validate(current), response = await request(target, { ...init, method });
      if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: current };
      if (response.body) await response.body.cancel();
      if (hop === maxRedirects) throw new Error('远程地址重定向次数超过上限');
      if (!['GET', 'HEAD'].includes(method)) throw new Error('非只读请求不允许重定向');
      const location = response.headers.get('location'); if (!location) throw new Error('远程响应缺少重定向地址');
      const next = deps.resolveUrl(new URL(location, current).href);
      if (new URL(next).origin !== initialOrigin && Array.from(new Headers(init.headers || {}).keys()).some(n => /^(authorization|proxy-authorization|cookie|x-api-key)$/i.test(n))) throw new Error('带凭据请求不允许跨源重定向');
      current = next;
    }
    throw new Error('远程请求失败');
  }
  return { validate, fetchRemoteResponse, assertSafeRemoteUrl: async url => (await validate(url)).url };
}
module.exports = { createSafeRemote, isPrivateNetworkAddress };
