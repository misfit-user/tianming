'use strict';
// 国师「读网页」的主进程通道（2026-10-16）。
//   - 只读公网 https 页面：GET、不带 cookie 与凭据、不走代理；地址校验、逐跳 DNS 校验、钉住解析出的地址
//     全部交给 main-safe-remote（私网、本机、保留地址一律拒）。
//   - 同站跳转照跟；跳到别的网站不跟，原样报回——那是另一个网站，要让玩家再点一次头。
//   - 只取正文字节：最多 3MB，超出截断并标明；不认的压缩、超时都报错。解码与转正文留给网页那边做。
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Tianming-Guoshi';

function siteKey(url) {
  return String(new URL(url).hostname || '').toLowerCase().replace(/^www\./, '');
}

async function readLimited(response, maxBytes, timeoutMs) {
  if (!response.body || typeof response.body.getReader !== 'function') return { bytes: new Uint8Array(0), truncated: false };
  const reader = response.body.getReader(), chunks = [];
  let total = 0, truncated = false;
  try {
    while (true) {
      let timer;
      const chunk = await Promise.race([
        reader.read(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('网页读取超时')), timeoutMs); })
      ]).finally(() => clearTimeout(timer));
      if (chunk.done) break;
      const piece = Buffer.from(chunk.value);
      if (total + piece.length > maxBytes) {
        chunks.push(piece.subarray(0, maxBytes - total));
        total = maxBytes; truncated = true;
        break;
      }
      chunks.push(piece); total += piece.length;
    }
  } finally {
    try { await reader.cancel(); } catch (_) {}
    try { reader.releaseLock(); } catch (_) {}
  }
  return { bytes: new Uint8Array(Buffer.concat(chunks, total)), truncated };
}

function createWebFetch(deps) {
  const maxBytes = deps.maxBytes || MAX_BYTES, timeoutMs = deps.timeoutMs || TIMEOUT_MS;
  async function fetchPage(rawUrl) {
    const text = String(rawUrl || '').trim();
    if (!text || text.length > 2048) throw new Error('网址为空或太长');
    let start;
    try { start = new URL(text); } catch (_) { throw new Error('不是有效的网址：' + text.slice(0, 120)); }
    if (start.protocol !== 'https:' && start.protocol !== 'http:') throw new Error('只能读 http(s) 网页');
    if (start.username || start.password) throw new Error('网址里不能带账号密码');
    const startSite = siteKey(start.href);
    const fetched = await deps.fetchRemoteResponse(start.href, {
      method: 'GET',
      timeoutMs,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6'
      },
      stopRedirect: (next) => {
        try { return siteKey(next) !== startSite || new URL(next).protocol !== 'https:'; } catch (_) { return true; }
      }
    }, 5);
    const response = fetched.response;
    if (fetched.redirect) return { url: fetched.url, status: response.status, contentType: '', redirect: fetched.redirect, body: new Uint8Array(0), truncated: false };
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const mime = contentType.split(';')[0].trim();
    const textual = !mime || mime.startsWith('text/') || /\b(json|xml|javascript)\b/.test(mime) || mime === 'application/xhtml+xml';
    if (!textual) {
      try { if (response.body) await response.body.cancel(); } catch (_) {}
      return { url: fetched.url, status: response.status, contentType, binary: true, body: new Uint8Array(0), truncated: false };
    }
    const read = await readLimited(response, maxBytes, timeoutMs);
    return { url: fetched.url, status: response.status, contentType, body: read.bytes, truncated: read.truncated };
  }
  return { fetchPage };
}

module.exports = { createWebFetch, MAX_BYTES };
