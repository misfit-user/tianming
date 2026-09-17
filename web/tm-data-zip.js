// Bounded data-only ZIP reader. Names are never filesystem destinations; scripts/symlinks are rejected.
(function (root) {
  'use strict';
  var zip = root.TMZipStore;
  if (!zip && typeof module !== 'undefined' && module.exports) zip = require('./tm-zip-store.js');
  var MAX = 96 * 1024 * 1024;
  function fail(message) {
    var e = new Error(message);
    e.code = 'data-zip-invalid';
    throw e;
  }
  function u16(b, n) {
    return b[n] | (b[n + 1] << 8);
  }
  function u32(b, n) {
    return (b[n] | (b[n + 1] << 8) | (b[n + 2] << 16) | (b[n + 3] << 24)) >>> 0;
  }
  function nameOf(b, utf8) {
    var name;
    try {
      name = new TextDecoder(utf8 ? 'utf-8' : 'gb18030', { fatal: true }).decode(b);
    } catch (_) {
      fail('ZIP 文件名编码不支持');
    }
    name = name.replace(/\\/g, '/').normalize('NFC');
    if (
      !name ||
      name.length > 600 ||
      /^[\/]|^[a-z]:|[\x00-\x1f]/i.test(name) ||
      name.split('/').some(function (p) {
        return p === '..' || p === '.';
      })
    )
      fail('ZIP 路径越界');
    return name;
  }
  async function inflate(data, expected, signal) {
    var stream;
    try {
      stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    } catch (_) {
      fail('此环境不支持安全解压；请解压后导入地图 JSON 和许可资料');
    }
    var reader = stream.getReader(),
      chunks = [],
      total = 0;
    try {
      while (true) {
        if (signal && signal.aborted) throw Error('导入已取消');
        var next = await reader.read();
        if (next.done) break;
        total += next.value.length;
        if (total > expected || total > MAX) fail('ZIP 实际解压体积超过声明或预算');
        chunks.push(next.value);
      }
    } finally {
      try {
        await reader.cancel();
      } catch (_) {}
      reader.releaseLock();
    }
    if (total !== expected) fail('ZIP 解压长度不符');
    var out = new Uint8Array(total),
      at = 0;
    chunks.forEach(function (c) {
      out.set(c, at);
      at += c.length;
    });
    return out;
  }
  async function read(value, options) {
    options = options || {};
    var b = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (b.length < 22 || b.length > MAX) fail('ZIP 字节为空或超出 96 MiB');
    var end = -1;
    for (var n = b.length - 22; n >= Math.max(0, b.length - 65558); n--) {
      if (u32(b, n) === 0x06054b50 && n + 22 + u16(b, n + 20) === b.length) {
        end = n;
        break;
      }
    }
    if (end < 0) fail('ZIP 目录尾缺失');
    var count = u16(b, end + 10),
      offset = u32(b, end + 16),
      length = u32(b, end + 12);
    if (
      u16(b, end + 4) ||
      u16(b, end + 6) ||
      u16(b, end + 8) !== count ||
      count > 2000 ||
      count === 65535 ||
      offset + length !== end
    )
      fail('不支持多盘/ZIP64/超限目录');
    var cursor = offset,
      rows = [],
      names = new Set(),
      total = 0;
    for (var i = 0; i < count; i++) {
      if (cursor + 46 > end || u32(b, cursor) !== 0x02014b50) fail('ZIP 目录损坏');
      var flags = u16(b, cursor + 8),
        method = u16(b, cursor + 10),
        crc = u32(b, cursor + 16),
        packed = u32(b, cursor + 20),
        size = u32(b, cursor + 24),
        nl = u16(b, cursor + 28),
        el = u16(b, cursor + 30),
        cl = u16(b, cursor + 32),
        local = u32(b, cursor + 42),
        mode = u32(b, cursor + 38) >>> 16;
      if (
        flags & 1 ||
        [0, 8].indexOf(method) < 0 ||
        packed === 0xffffffff ||
        size === 0xffffffff ||
        (mode & 0xf000) === 0xa000
      )
        fail('ZIP 包含加密、脚本链接或不支持的压缩');
      if (cursor + 46 + nl + el + cl > end) fail('ZIP 名称超出目录');
      var name = nameOf(b.subarray(cursor + 46, cursor + 46 + nl), !!(flags & 2048));
      cursor += 46 + nl + el + cl;
      if (name.endsWith('/')) continue;
      if (names.has(name.toLowerCase())) fail('ZIP 包含重复覆盖条目');
      names.add(name.toLowerCase());
      if (!/\.(json|geojson|md|txt|csv|png|jpe?g|webp)$|\/(COPYING(?:\.LESSER)?|LICENSE)$/i.test(name))
        fail('普通数据包不能混入可执行脚本：' + name);
      total += size;
      if (total > MAX || size > MAX || size > Math.max(1, packed) * 1000) fail('ZIP 解压总量或倍率超限');
      if (local + 30 > offset || u32(b, local) !== 0x04034b50 || u16(b, local + 8) !== method) fail('ZIP 局部目录不符');
      var ln = u16(b, local + 26),
        le = u16(b, local + 28),
        start = local + 30 + ln + le;
      if (start + packed > offset || nameOf(b.subarray(local + 30, local + 30 + ln), !!(flags & 2048)) !== name)
        fail('ZIP 数据或局部名称不符');
      rows.push({ name: name, method: method, crc: crc, size: size, start: start, packed: packed });
    }
    if (cursor !== end) fail('ZIP 目录长度不符');
    var out = [];
    for (var r of rows) {
      if (options.signal && options.signal.aborted) throw Error('导入已取消');
      var payload = b.slice(r.start, r.start + r.packed),
        data = r.method === 8 ? await inflate(payload, r.size, options.signal) : payload;
      if (data.length !== r.size || zip.crc32(data) !== r.crc) fail('ZIP 字节回读校验失败：' + r.name);
      out.push({ name: r.name, data: data });
    }
    return out;
  }
  root.TM = root.TM || {};
  root.TM.DataZip = { read: read, maxBytes: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.DataZip;
})(typeof window !== 'undefined' ? window : globalThis);
