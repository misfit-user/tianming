// Shared JSON export: Android chooses the destination in the system document picker.
(function (root) {
  'use strict';
  var busy = false;

  function isNative() {
    var cap = root.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  }

  function safeName(value) {
    var name = String(value || 'tianming.json').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    if (!/\.json$/i.test(name)) name += '.json';
    return name;
  }

  async function saveJson(data, filename) {
    if (typeof data !== 'string' || !data.length) throw new Error('导出内容为空');
    var name = safeName(filename);
    if (isNative()) {
      if (busy) throw new Error('已有导出窗口打开，请先完成或取消该次导出');
      var cap = root.Capacitor;
      var plugin = cap.Plugins && cap.Plugins.TianmingFileExport;
      if ((typeof cap.isPluginAvailable === 'function' && !cap.isPluginAvailable('TianmingFileExport')) ||
          !plugin || typeof plugin.saveFile !== 'function') {
        throw new Error('当前手机版暂不支持选择导出位置，请安装支持此功能的新版安装包');
      }
      busy = true;
      try {
        var result = await plugin.saveFile({ fileName: name, data: data, mimeType: 'application/json' });
        if (result && result.cancelled) return { mode: 'canceled' };
        if (!result || !result.saved) throw new Error('文件未保存，请重新选择导出位置');
        return { mode: 'native', path: result.fileName || name, fileName: result.fileName || name, uri: result.uri };
      } finally {
        busy = false;
      }
    }

    var blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    return { mode: 'download', fileName: name };
  }

  // 2026-10-14：分块导出。手机「抄送副本」闪退的根子是整档一次性过桥；这里逐块交给原生侧 beginExport/appendChunk/finishExport
  // 写进缓存临时文件，再弹系统保存窗口。旧壳（没有分块接口）退回整串 saveFile；桌面/网页端用 Blob 多段拼，不再先拼成一个大字符串。
  var CHUNK_TARGET = 1024 * 1024;  // 每次过桥约 1MB
  function isUnimplemented(err) {
    var code = err && (err.code || err.errorCode);
    return code === 'UNIMPLEMENTED' || /not implemented|unimplemented/i.test(String(err && err.message || ''));
  }
  async function saveJsonParts(parts, filename) {
    if (!Array.isArray(parts) || !parts.length) throw new Error('导出内容为空');
    var name = safeName(filename);
    if (isNative()) {
      if (busy) throw new Error('已有导出窗口打开，请先完成或取消该次导出');
      var cap = root.Capacitor;
      var plugin = cap.Plugins && cap.Plugins.TianmingFileExport;
      if ((typeof cap.isPluginAvailable === 'function' && !cap.isPluginAvailable('TianmingFileExport')) || !plugin) {
        throw new Error('当前手机版暂不支持选择导出位置，请安装支持此功能的新版安装包');
      }
      busy = true;
      try {
        var began = false;
        if (typeof plugin.beginExport === 'function') {
          try { await plugin.beginExport({ fileName: name, mimeType: 'application/json' }); began = true; }
          catch (e) { if (!isUnimplemented(e)) throw e; }
        }
        if (!began) {
          if (typeof plugin.saveFile !== 'function') throw new Error('当前手机版暂不支持选择导出位置，请安装支持此功能的新版安装包');
          busy = false;  // 旧壳退回整串 saveFile，由它自己占 busy
          return await saveJson(parts.join(''), name);
        }
        try {
          // 每次过桥严格不超过 CHUNK_TARGET 个 UTF-16 码元：超大单段（真实大档的地图数组一段近 30MB）在段内切开，
          // 切口不落在代理对中间（2026-10-17·复审 F3：原来先拼整段再判阈值，大段整段过桥）。
          var buf = '';
          for (var i = 0; i < parts.length; i++) {
            var part = String(parts[i]), pos = 0;
            while (pos < part.length) {
              var end = Math.min(part.length, pos + CHUNK_TARGET - buf.length);
              if (end < part.length && end > pos) { var hi = part.charCodeAt(end - 1); if (hi >= 0xD800 && hi <= 0xDBFF) end--; }
              buf += part.slice(pos, end); pos = end;
              if (buf.length >= CHUNK_TARGET - 1) {
                // 上一段恰好以高代理收尾时，留到下一块与下一段开头的低代理一起过桥（二次复审 F3 补充边界）
                var last = buf.charCodeAt(buf.length - 1), hold = last >= 0xD800 && last <= 0xDBFF ? buf.slice(-1) : '';
                await plugin.appendChunk({ chunk: hold ? buf.slice(0, -1) : buf }); buf = hold;
              }
            }
          }
          if (buf.length) await plugin.appendChunk({ chunk: buf });
          var result = await plugin.finishExport({});
          if (result && result.cancelled) return { mode: 'canceled' };
          if (!result || !result.saved) throw new Error('文件未保存，请重新选择导出位置');
          return { mode: 'native', path: result.fileName || name, fileName: result.fileName || name, uri: result.uri };
        } catch (e2) {
          try { if (typeof plugin.cancelExport === 'function') await plugin.cancelExport({}); } catch (_) {}
          throw e2;
        }
      } finally {
        busy = false;
      }
    }

    var blob = new Blob(parts, { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    return { mode: 'download', fileName: name };
  }

  root.TM = root.TM || {};
  root.TM.fileExport = { isNative: isNative, saveJson: saveJson, saveJsonParts: saveJsonParts };
})(window);
