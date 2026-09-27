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

  root.TM = root.TM || {};
  root.TM.fileExport = { isNative: isNative, saveJson: saveJson };
})(window);
