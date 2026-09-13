// Models discovery never calls inference, invents fallback IDs, or persists API credentials.
(function(global) {
  'use strict';
  function fail(message) { return new Error(message); }
  function endpoint(cfg) {
    var u; try { u = new URL(String(cfg.url || '').trim()); } catch (_) { throw fail('请填写完整的 API 地址'); }
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw fail('API 地址须为 HTTP(S)，且不能含账号密码');
    if (u.search || u.hash) throw fail('拉取模型时请使用不含查询参数的 Base URL，密钥填写在 Key 栏');
    var path = u.pathname.replace(/\/+$/, ''), host = u.hostname.toLowerCase(), mode = 'openai';
    if (/\/messages$/.test(path) || host === 'api.anthropic.com') mode = 'anthropic';
    if ((host === 'generativelanguage.googleapis.com' || /:generateContent$/.test(path)) && !/\/openai(?:\/|$)/.test(path)) mode = 'gemini';
    if (mode === 'gemini') path = path.replace(/\/models\/[^/]+:(?:streamGenerateContent|generateContent)$/, '');
    else path = path.replace(/\/(?:chat\/completions|messages|responses)$/, '');
    if (!path) path = mode === 'anthropic' ? '/v1' : mode === 'gemini' ? '/v1beta' : '';
    u.pathname = /\/models$/.test(path) ? path : path + '/models';
    return { url: u, mode: mode };
  }
  async function list(cfg, options) {
    options = options || {};
    var key = String(cfg.key || '').trim();
    if (!key) throw fail('请先填写 API Key');
    var target = endpoint(cfg), headers = { Accept: 'application/json' };
    if (target.mode === 'anthropic') { headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01'; }
    else if (target.mode === 'gemini') headers['x-goog-api-key'] = key;
    else headers.Authorization = 'Bearer ' + key;
    var ctrl = new AbortController(), signal = options.signal, timedOut = false, timer;
    function cancel() { ctrl.abort(); }
    if (signal) { if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true }); }
    var stop;
    var aborted = new Promise(function(_, reject) {
      stop = function() { var e = fail(timedOut ? '模型列表请求超时，请重试' : '已取消模型列表请求'); e.name = 'AbortError'; reject(e); };
      if (ctrl.signal.aborted) stop(); else ctrl.signal.addEventListener('abort', stop, { once: true });
    });
    timer = setTimeout(function() { timedOut = true; cancel(); }, options.timeoutMs || 20000);
    async function read() {
      var entries = new Map(), tokens = new Set(), partial = false;
      for (var page = 0; page < 20; page++) {
        if (ctrl.signal.aborted) throw fail('请求已取消');
        var resp = await (options.fetch || global.fetch)(target.url.href, {
          method: 'GET', headers: headers, signal: ctrl.signal, redirect: 'error', cache: 'no-store', credentials: 'omit'
        });
        if (!resp.ok) throw fail('模型列表 HTTP ' + resp.status + '；请检查地址、密钥或模型列表权限');
        var data; try { data = await resp.json(); } catch (_) { throw fail('模型列表不是有效 JSON，可能是网页地址或中转响应异常'); }
        if (ctrl.signal.aborted) throw fail('请求已取消');
        var rows = target.mode === 'gemini' ? data && data.models : data && data.data;
        if (!Array.isArray(rows)) throw fail('响应没有模型列表；保留手动填写 Model_ID');
        rows.forEach(function(row) {
          if (!row || typeof row !== 'object') return;
          if (target.mode === 'gemini' && Array.isArray(row.supportedGenerationMethods) && row.supportedGenerationMethods.indexOf('generateContent') < 0) return;
          var id = target.mode === 'gemini' ? row.name : row.id;
          if (typeof id !== 'string' || !id.trim()) return;
          if (target.mode === 'gemini') id = id.replace(/^models\//, '');
          entries.set(id, { id: id });
        });
        var next = target.mode === 'gemini' ? data.nextPageToken : (target.mode === 'anthropic' && data.has_more ? data.last_id : '');
        if (!next) { partial = data.has_more === true; break; }
        if (typeof next !== 'string' || tokens.has(next)) throw fail('模型列表分页异常，请稍后重试');
        tokens.add(next); target.url.searchParams.set(target.mode === 'gemini' ? 'pageToken' : 'after_id', next);
        partial = page === 19;
      }
      return { models: Array.from(entries.values()).sort(function(a, b) { return a.id.localeCompare(b.id); }), partial: partial };
    }
    try { return await Promise.race([read(), aborted]); }
    catch (e) {
      if (e && (e.name === 'AbortError' || /^模型列表|^响应没有/.test(e.message || ''))) throw e;
      throw fail('无法拉取模型列表，请检查网络、跨域许可或地址；仍可手动填写 Model_ID');
    } finally {
      clearTimeout(timer); if (signal) signal.removeEventListener('abort', cancel); ctrl.signal.removeEventListener('abort', stop);
    }
  }
  global.TM = global.TM || {};
  global.TM.APIModels = { endpoint: endpoint, list: list };
})(typeof window !== 'undefined' ? window : globalThis);
