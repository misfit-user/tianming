// 画布缓存：程序现画的大贴图（案面、立轴、匾、楹联……）第一次画完存进 IndexedDB，之后启动直接取图，不再重画。
// 键带版本号：改了画法就把 VERSION 加一，旧图自动作废。存取失败（隐私模式、配额满）就照常现画。
const DB = 'tm_ui_texcache';
const STORE = 'canvas';
const VERSION = 1;
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB, 1);
      } catch (_e) {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch (_e) {
      resolve(null);
    }
  });
}

async function blobToCanvas(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  return c;
}

// cachedCanvas('desk-top@4096', () => 画布或 Promise<画布>, { type: 'image/jpeg' | 'image/png' })
export async function cachedCanvas(key, draw, { type = 'image/png', quality = 0.92 } = {}) {
  const fullKey = `v${VERSION}:${key}`;
  const db = await openDb();
  if (db) {
    const blob = await tx(db, 'readonly', (s) => s.get(fullKey));
    if (blob) {
      try {
        return await blobToCanvas(blob);
      } catch (_e) {
        // 存坏了：往下现画并覆盖
      }
    }
  }
  const canvas = await draw();
  if (db) {
    canvas.toBlob((blob) => { if (blob) tx(db, 'readwrite', (s) => s.put(blob, fullKey)); }, type, quality);
  }
  return canvas;
}

// 一次画出几张的（立轴的色、粗糙度、金属度三张）：任一张没缓存就整组重画
export async function cachedCanvases(keys, drawAll, { type = 'image/png' } = {}) {
  const db = await openDb();
  if (db) {
    const blobs = await Promise.all(keys.map((k) => tx(db, 'readonly', (s) => s.get(`v${VERSION}:${k}`))));
    if (blobs.every(Boolean)) {
      try {
        return await Promise.all(blobs.map(blobToCanvas));
      } catch (_e) {
        // 存坏了：整组重画
      }
    }
  }
  const canvases = await drawAll();
  if (db) {
    canvases.forEach((c, i) => c.toBlob((blob) => { if (blob) tx(db, 'readwrite', (s) => s.put(blob, `v${VERSION}:${keys[i]}`)); }, type));
  }
  return canvases;
}

export async function clearTexCache() {
  const db = await openDb();
  if (db) await tx(db, 'readwrite', (s) => s.clear());
}
