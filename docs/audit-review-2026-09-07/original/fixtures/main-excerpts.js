// Source excerpts, not a complete runnable main process.
// misfit-user/tianming@3f8065cb9cf09b414cf35dc3deccca59560f733b
// main-impl.js: source blob cb80693e3321db0c8d55af4eed8cead68c467937.
// Function bodies copied from the connected GitHub source; only surrounding sections/comments omitted.
function ensureWritableDir(dir) {
  if (fs.existsSync(dir)) {
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) return;
    fs.renameSync(dir, dir + '.file-backup-' + Date.now());
  }
  fs.mkdirSync(dir, { recursive: true });
}
function sanitize(name) {
  const s = String(name).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  return /^\.+$/.test(s) ? '_' : s;
}
function stableStorageKey(name) {
  const raw = String(name == null ? '' : name);
  if (!raw.trim()) throw new Error('名称不能为空');
  const stem = sanitize(raw).replace(/[. ]+$/g, '_').substring(0, 72) || '_';
  const digest = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
  return stem + '--' + digest;
}
function isSafeStorageKey(key) {
  key = String(key == null ? '' : key);
  return key.length > 18 && key.length <= 100 && /^[^<>:"/\\|?*]+--[0-9a-f]{16}$/.test(key)
    && path.basename(key) === key && key !== '.' && key !== '..';
}
function saveFileRef(ref) {
  const storageKey = ref && typeof ref === 'object' ? String(ref.storageKey || '') : '';
  if (storageKey) {
    if (!isSafeStorageKey(storageKey)) throw new Error('存档标识非法');
    return { key: storageKey, path: path.join(SAVE_DIR, storageKey + '.json'), legacy: false };
  }
  const displayName = String(ref == null ? '' : ref);
  const key = stableStorageKey(displayName);
  const canonical = path.join(SAVE_DIR, key + '.json');
  if (fs.existsSync(canonical)) return { key, path: canonical, legacy: false };
  const legacy = path.join(SAVE_DIR, sanitize(displayName) + '.json');
  if (fs.existsSync(legacy)) return { key: path.basename(legacy, '.json'), path: legacy, legacy: true };
  return { key, path: canonical, legacy: false };
}
function turnDataRoot(saveName, forWrite) {
  const canonical = path.join(TURN_DATA_DIR, stableStorageKey(saveName));
  if (forWrite || fs.existsSync(canonical)) return canonical;
  const legacy = path.join(TURN_DATA_DIR, sanitize(saveName));
  return fs.existsSync(legacy) ? legacy : canonical;
}
function turnSeg(turn) {
  const raw = typeof turn === 'number' ? turn : String(turn == null ? '' : turn).trim();
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0 || raw > 10000000) throw new Error('非法回合号: ' + turn);
    return String(raw);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error('非法回合号: ' + turn);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > 10000000) throw new Error('非法回合号: ' + turn);
  return String(n);
}
function writeJson(file, data) {
  ensureWritableDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
function writeJsonAtomic(file, data) {
  ensureWritableDir(path.dirname(file));
  writeFileAtomic(file, JSON.stringify(data, null, 2), 'utf-8');
}
function writeFileAtomic(file, data, encoding) {
  ensureWritableDir(path.dirname(file));
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomUUID();
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'wx');
    fs.writeFileSync(fd, data, encoding);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, file);
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
    try { fs.rmSync(tmp, { force: true }); } catch (_) {}
    throw e;
  }
}
function installWorkshopPackFromDir(sourceDir, options = {}) {
  const pack = validateWorkshopPack(sourceDir);
  const target = path.join(WORKSHOP_PACKS_DIR, pack.id);
  if (fs.existsSync(target) && !options.overwrite) {
    return { success: false, error: '已存在同 ID 工坊包：' + pack.id, exists: true, pack: packPublicInfo(pack, target, true) };
  }
  if (fs.existsSync(target)) safeRmDir(target, WORKSHOP_PACKS_DIR);
  copyDirRecursive(sourceDir, target);
  const installed = validateWorkshopPack(target);
  const idx = readWorkshopIndex();
  idx.packs = idx.packs.filter(item => normalizePackId(item.id) !== installed.id);
  idx.packs.push(Object.assign(packPublicInfo(installed, target, true), {
    installedAt: new Date().toISOString(),
    source: options.source || ''
  }));
  writeWorkshopIndex(idx);
  return { success: true, pack: packPublicInfo(installed, target, true) };
}
async function handleOnlineRendererRequest(method, pathname, body) {
  const req = normalizeOnlineRendererRoute(method, pathname);
  assertOnlineRendererBodySize(req.route, body);
  const noAuth = new Set([
    'health', 'account/email-code', 'account/email-login', 'account/login',
    'account/register', 'account/request-reset', 'account/reset'
  ]);
  const options = noAuth.has(req.route) ? { token: '' } : {};
  let response;
  if (req.route === 'account/logout') {
    try { response = await postOnlineApi(req.pathname, body || {}, options); }
    finally { clearAccountSession(); }
  } else if (req.method === 'GET') {
    response = await getOnlineApi(req.pathname, options);
  } else {
    response = await postOnlineApi(req.pathname, body == null ? {} : body, options);
  }

  if (response && response.success && response.token
      && (req.route === 'account/register' || req.route === 'account/login' || req.route === 'account/email-login')) {
    writeAccountSession({ token: response.token, user: response.user || null });
  } else if (response && response.success && response.user
      && (req.route === 'account/me' || req.route === 'account/set-email')) {
    const current = readAccountSession();
    if (current.token) writeAccountSession({ token: current.token, user: response.user });
  }

  const publicResponse = Object.assign(
    { success: false },
    /^account\//.test(req.route) ? sanitizeAccountOnlineResponse(response || {}) : sanitizeOnlineResponse(response || {})
  );
  if (/^account\//.test(req.route)) {
    publicResponse.session = toPublicAccountSession();
    publicResponse.loggedIn = publicResponse.session.loggedIn;
  }
  return publicResponse;
}
function isPrivateNetworkAddress(address) {
  const raw = String(address || '').toLowerCase().split('%')[0];
  if (nodeNet.isIPv4(raw)) {
    const p = raw.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127
      || (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
      || (p[0] === 169 && p[1] === 254)
      || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
      || (p[0] === 192 && (p[1] === 0 || p[1] === 168))
      || (p[0] === 198 && (p[1] === 18 || p[1] === 19 || (p[1] === 51 && p[2] === 100)))
      || (p[0] === 203 && p[1] === 0 && p[2] === 113)
      || p[0] >= 224
      || raw === '168.63.129.16';
  }
  if (nodeNet.isIPv6(raw)) {
    if (raw === '::' || raw === '::1') return true;
    if (/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(raw) || raw.startsWith('2001:db8:')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(raw);
    return !!(mapped && isPrivateNetworkAddress(mapped[1]));
  }
  return true;
}
ipcMain.handle('dialog-export', async (event, data, opts) => {
  const o = opts || {};
  const result = await dialog.showSaveDialog(mainWindow, {
    title: String(o.title || '导出天命项目'),
    defaultPath: String(o.filename || '天命项目.json'),
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, canceled: true };
});
