'use strict';
const crypto = require('node:crypto'),
  fs = require('node:fs');
// The only destination is the native dialog result; renderer paths are never accepted.
function createArtifactExporter({ dialog, window, writeFileAtomic }) {
  return async function exportArtifact(input, meta) {
    meta = meta || {};
    if (!(input instanceof Uint8Array) || !input.length || input.length > 96 * 1024 * 1024)
      throw Error('Artifact byte budget exceeded');
    if (
      typeof meta.filename !== 'string' ||
      meta.filename.length > 120 ||
      /[\\/:\x00-\x1f]/.test(meta.filename) ||
      !/^[-\w.\u4e00-\u9fff]+\.(json|zip|png|csv|md)$/i.test(meta.filename) ||
      /^(con|prn|aux|nul|com\d|lpt\d)\./i.test(meta.filename)
    )
      throw Error('Artifact filename is not a safe basename');
    const bytes = Buffer.from(input),
      sha = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha !== meta.sha256) throw Error('Artifact source digest mismatch');
    const result = await dialog.showSaveDialog(window(), {
      title: '保存已验证天命制品',
      defaultPath: meta.filename,
      filters: [{ name: '天命数据制品', extensions: [meta.filename.split('.').pop()] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    if(fs.existsSync(result.filePath))return{success:false,error:'目标文件已存在，请另选文件名；未覆盖旧文件',code:'artifact-target-exists'};
    const preparedPath = result.filePath + '.tm-export-' + crypto.randomUUID() + '.tmp';
    try {
      writeFileAtomic(preparedPath, bytes);
      const prepared = fs.readFileSync(preparedPath);
      if (prepared.length !== bytes.length || crypto.createHash('sha256').update(prepared).digest('hex') !== sha)
        throw Error('Artifact prepared disk readback mismatch');
      // Linking a prepared sibling file is atomic and refuses an existing target,
      // including one created after the save dialog. Never fall back to overwrite.
      fs.linkSync(preparedPath, result.filePath);
      const back = fs.readFileSync(result.filePath),
        actual = crypto.createHash('sha256').update(back).digest('hex');
      if (actual !== sha || back.length !== bytes.length) throw Error('Artifact disk readback mismatch');
      return { success: true, sha256: actual, byteLength: back.length };
    } catch (e) {
      return { success: false, code: e.code || 'artifact-export-failed', error: e.code === 'EEXIST' ? '目标文件已出现，请另选文件名；未覆盖旧文件' : e.message };
    } finally {
      try { fs.unlinkSync(preparedPath); } catch (_) { /* Only this operation's temporary sibling is eligible. */ }
    }
  };
}
module.exports = { createArtifactExporter };
