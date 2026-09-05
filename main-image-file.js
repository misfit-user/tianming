'use strict';
const path = require('path');
const { readBinaryFileLimited } = require('./main-json-file');
const MAX_IMAGE_BYTES = 32 * 1024 * 1024, MAX_IMAGE_PIXELS = 100 * 1024 * 1024;
function imageDimensions(b, ext) {
  let width, height;
  if (ext === 'png' && b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString('ascii', 12, 16) === 'IHDR') { width = b.readUInt32BE(16); height = b.readUInt32BE(20); }
  else if (['jpg', 'jpeg'].includes(ext) && b[0] === 255 && b[1] === 216) {
    for (let offset = 2; offset + 4 <= b.length;) {
      if (b[offset++] !== 255) break;
      while (b[offset] === 255) offset++;
      const marker = b[offset++]; if ([0xd8, 0x01].includes(marker)) continue;
      if (marker === 0xd9 || marker === 0xda || offset + 2 > b.length) break;
      const length = b.readUInt16BE(offset); if (length < 2 || offset + length > b.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) { height = b.readUInt16BE(offset + 3); width = b.readUInt16BE(offset + 5); break; }
      offset += length;
    }
  } else if (ext === 'webp' && b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') { width = 1 + b.readUIntLE(24, 3); height = 1 + b.readUIntLE(27, 3); }
    else if (kind === 'VP8 ' && b[23] === 0x9d && b[24] === 1 && b[25] === 0x2a) { width = b.readUInt16LE(26) & 0x3fff; height = b.readUInt16LE(28) & 0x3fff; }
    else if (kind === 'VP8L' && b[20] === 0x2f) { const bits = b.readUInt32LE(21); width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff); }
  } else if (ext === 'bmp' && b.length >= 26 && b.toString('ascii', 0, 2) === 'BM') {
    const dib = b.readUInt32LE(14);
    if (dib === 12) { width = b.readUInt16LE(18); height = b.readUInt16LE(20); }
    else if (dib >= 40) { width = b.readInt32LE(18); height = Math.abs(b.readInt32LE(22)); }
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) throw new Error('图片格式或尺寸无效');
  if (width * height > MAX_IMAGE_PIXELS) throw new Error('图片解码像素超过上限');
  return { width, height };
}
async function readImageFile(file, options = {}) {
  const ext = path.extname(file).slice(1).toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[ext];
  if (!mime) throw new Error('不支持的图片格式');
  const bytes = await readBinaryFileLimited(file, { maxBytes: MAX_IMAGE_BYTES, signal: options.signal });
  const dimensions = imageDimensions(bytes, ext);
  return { ...dimensions, dataUrl: 'data:' + mime + ';base64,' + bytes.toString('base64') };
}
module.exports = { readImageFile, imageDimensions, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS };
