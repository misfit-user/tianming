// Trusted native document construction. Scenario JSON never becomes executable markup.
(function (root) {
  'use strict';
  var MAX_RESOURCE = 16 * 1024 * 1024,
    MAX_TOTAL = 48 * 1024 * 1024;
  function error(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }
  function validRow(row, inline) {
    if (
      !row ||
      !Number.isSafeInteger(row.byteLength) ||
      row.byteLength < 0 ||
      row.byteLength > MAX_RESOURCE ||
      !/^[a-f0-9]{64}$/.test(row.sha256)
    )
      throw error('runtime-manifest-row', '原生资源清单条目无效');
    if (Object.prototype.hasOwnProperty.call(row, 'text')) {
      if (!inline || typeof row.text !== 'string' || row.file || row.request)
        throw error('runtime-manifest-inline', '原生脚本条目冲突');
    } else {
      if (
        typeof row.file !== 'string' ||
        !/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/.test(row.file) ||
        row.file.split('/').some(function (p) {
          return !p || p === '.' || p === '..';
        }) ||
        typeof row.request !== 'string' ||
        row.request.split('?')[0] !== row.file ||
        !/^[a-zA-Z0-9_./-]+(?:\?[a-zA-Z0-9_=.-]+)?$/.test(row.request)
      )
        throw error('runtime-resource-path', '原生资源路径不在固定应用目录内');
    }
  }
  async function validate(manifest, compiler) {
    if (
      !manifest ||
      manifest.schemaVersion !== 'tm-native-runtime-manifest/1' ||
      typeof manifest.template !== 'string' ||
      manifest.template.length > 2 * 1024 * 1024 ||
      !Array.isArray(manifest.scripts) ||
      manifest.scripts.length < 1 ||
      manifest.scripts.length > 800 ||
      !Array.isArray(manifest.styles) ||
      manifest.styles.length > 40 ||
      !/^[a-f0-9]{64}$/.test(manifest.indexHash) ||
      !/^[a-f0-9]{64}$/.test(manifest.runtimeHash) ||
      !Number.isSafeInteger(manifest.totalResourceBytes) ||
      manifest.totalResourceBytes > MAX_TOTAL
    )
      throw error('runtime-manifest', '原生准备清单缺失或超出预算');
    if (
      /<script\b/i.test(manifest.template) ||
      !/<head\b/i.test(manifest.template) ||
      !/<\/body\s*>/i.test(manifest.template)
    )
      throw error('runtime-template', '原生模板含未登记脚本或结构无效');
    var inputs = new Map(),
      total = 0;
    manifest.scripts.forEach(function (r) {
      validRow(r, true);
    });
    manifest.styles.forEach(function (r) {
      validRow(r, false);
    });
    manifest.scripts.concat(manifest.styles).forEach(function (r) {
      if (!r.file) return;
      if (
        inputs.has(r.file) &&
        (inputs.get(r.file).sha256 !== r.sha256 || inputs.get(r.file).byteLength !== r.byteLength)
      )
        throw error('runtime-resource-conflict', '同一原生资源的版本不一致');
      if (!inputs.has(r.file)) {
        inputs.set(r.file, r);
        total += r.byteLength;
      }
    });
    if (total !== manifest.totalResourceBytes || total > MAX_TOTAL)
      throw error('runtime-resource-budget', '原生资源总预算不一致');
    var copy = Object.assign({}, manifest);
    delete copy.runtimeHash;
    var hash = await compiler.sha256(new root.TextEncoder().encode(JSON.stringify(copy)));
    if (hash !== manifest.runtimeHash) throw error('runtime-manifest-hash', '原生清单指纹不符');
    return Array.from(inputs.values());
  }
  function bootstrap(config, scripts, styles) {
    var state = { errors: [], loaded: 0, ready: false, storage: 'volatile-only' };
    Object.defineProperty(window, '__tmNativePreparation', { value: Object.freeze(config) });
    Object.defineProperty(window, '__tmNativePreparationState', { value: state });
    function record(value) {
      if (state.errors.length < 30) state.errors.push(String(value).slice(0, 512));
    }
    addEventListener('error', function (e) {
      record(e.message || e.error);
    });
    addEventListener('unhandledrejection', function (e) {
      record((e.reason && e.reason.message) || e.reason);
    });
    function storage() {
      var rows = Object.create(null),
        size = 0;
      return {
        getItem: function (k) {
          k = String(k);
          return Object.prototype.hasOwnProperty.call(rows, k) ? rows[k] : null;
        },
        setItem: function (k, v) {
          k = String(k);
          v = String(v);
          var next = size - (rows[k] || '').length + v.length;
          if (next > 64 * 1024 * 1024)
            throw new DOMException('Private preparation storage budget exceeded', 'QuotaExceededError');
          rows[k] = v;
          size = next;
        },
        removeItem: function (k) {
          k = String(k);
          size -= (rows[k] || '').length;
          delete rows[k];
        },
        clear: function () {
          rows = Object.create(null);
          size = 0;
        },
        key: function (i) {
          return Object.keys(rows)[i] || null;
        },
        get length() {
          return Object.keys(rows).length;
        },
      };
    }
    Object.defineProperty(window, 'localStorage', { value: storage(), configurable: false });
    Object.defineProperty(window, 'sessionStorage', { value: storage(), configurable: false });
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: false });
    styles.forEach(function (text) {
      var s = document.createElement('style');
      s.textContent = text;
      document.head.appendChild(s);
    });
    scripts.forEach(function (text) {
      var s = document.createElement('script');
      s.nonce = config.nonce;
      s.textContent = text;
      document.head.appendChild(s);
      state.loaded++;
    });
    addEventListener('DOMContentLoaded', function () {
      state.ready = true;
    });
  }
  function create(manifest, texts, config) {
    if (
      !config ||
      !/^[a-f0-9]{48}$/.test(config.nonce) ||
      !/^[a-f0-9]{48}$/.test(config.token) ||
      !/^[a-f0-9]{48}$/.test(config.requestId) ||
      config.runtimeHash !== manifest.runtimeHash
    )
      throw error('runtime-session', '准备会话标识无效');
    function text(row) {
      var value = row.file ? texts.get(row.file) : row.text;
      if (typeof value !== 'string') throw error('runtime-resource-missing', '准备资源尚未读取');
      return value;
    }
    var payload = JSON.stringify([config, manifest.scripts.map(text), manifest.styles.map(text)])
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    var code = '(' + bootstrap.toString() + ').apply(null,' + payload + ');';
    var csp =
      "default-src 'none'; script-src 'nonce-" +
      config.nonce +
      "'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    var html = manifest.template.replace(/<head\b[^>]*>/i, function (all) {
      return all + '<meta http-equiv="Content-Security-Policy" content="' + csp + '">';
    });
    return html.replace(/<\/body\s*>/i, function () {
      return '<script nonce="' + config.nonce + '">' + code + '</script></body>';
    });
  }
  var api = {
    validate: validate,
    create: create,
    error: error,
    maxResourceBytes: MAX_RESOURCE,
    maxTotalBytes: MAX_TOTAL,
  };
  (root.TM || (root.TM = {})).StartPreparationDocument = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
