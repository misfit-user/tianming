// @ts-check
// ============================================================
// tm-memory-adapter.js — 标准外部记忆适配器（2026-04-30 Phase 4.5）
//
// 设计来源：muyoou/st-memory-enhancement 的 window.externalDataAdapter
//   "外部程序可同样规划『工具发指令、系统执统一管线』"
//
// 用途：未来插件/MCP 工具/外部脚本想读写记忆系统·都通过 TianmingMemoryAdapter
// 内部统一走 MemTables.applyAIOps·schema 校验+权限控制·避免直接戳 GM._memTables.X.rows.push(...)
//
// 不复制 MemTables 已有功能·只是 schema-validated 包装 + 多入口（XML/JSON/伪函数调用）
// ============================================================

(function(global) {
  'use strict';

  var STATE = {
    debugMode: false,
    lastError: null,
    callCount: 0
  };

  function _log() {
    if (!STATE.debugMode) return;
    try { console.log.apply(console, ['[TMAdapter]'].concat(Array.from(arguments))); } catch(_e){}
  }

  function _err(msg, e) {
    STATE.lastError = { msg: msg, error: e ? String(e.message || e) : '', ts: Date.now() };
    _log('error:', msg, e);
    return { ok: false, error: msg };
  }

  function _ensureMemTables() {
    if (typeof MemTables === 'undefined' || !MemTables) {
      return _err('MemTables 模块未加载');
    }
    if (!MemTables.ensureInit()) {
      return _err('MemTables 初始化失败 (GM 未就绪?)');
    }
    return null;
  }

  // ────── 入口 1：JSON 数据 ──────
  // 接受形如 [{cmd:'insert'/'update'/'delete', sheet:'eventHistory', rowIdx?, values?}]
  function processJsonData(data, opts) {
    opts = opts || {};
    var pre = _ensureMemTables();
    if (pre) return pre;
    STATE.callCount++;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch(e) { return _err('JSON 解析失败', e); }
    }
    if (!Array.isArray(data)) data = [data];
    var ops = [];
    var rejected = [];
    data.forEach(function(d, i) {
      if (!d || typeof d !== 'object') { rejected.push({ at: i, reason: '非对象' }); return; }
      var sheet = d.sheet || d.sheetKey;
      if (!sheet) { rejected.push({ at: i, reason: '缺 sheet 字段' }); return; }
      var def = MemTables.SHEET_BY_KEY[sheet] || MemTables.SHEET_BY_IDX[sheet];
      if (!def) { rejected.push({ at: i, reason: '未知表: ' + sheet }); return; }
      ops.push({
        cmd: (d.cmd || d.op || 'insert').toLowerCase(),
        tableIdx: def.idx,
        rowIdx: d.rowIdx,
        values: d.values || {}
      });
    });
    if (ops.length === 0) {
      return { ok: false, error: '所有指令被拒绝', rejected: rejected };
    }
    var stats = MemTables.applyAIOps(ops, { actor: opts.actor || 'external' });
    _log('processJsonData·已应用', stats, '·拒绝', rejected.length);
    return { ok: true, stats: stats, rejected: rejected };
  }

  // ────── 入口 2：XML 数据（外部脚本喜好） ──────
  // 接受形如 <tableEdit><!-- insertRow(0, {...}) --></tableEdit> 或仅 <tm><cell sheet="..." op="..." /></tm>
  function processXmlData(xmlText, opts) {
    opts = opts || {};
    var pre = _ensureMemTables();
    if (pre) return pre;
    STATE.callCount++;
    if (!xmlText || typeof xmlText !== 'string') return _err('xmlText 非空字符串');
    // 优先识别 <tableEdit> 走 MemTables.parseTableEdit（与 AI 输出同管线）
    if (xmlText.indexOf('<tableEdit>') >= 0 || xmlText.indexOf('insertRow(') >= 0) {
      var parsed = MemTables.parseTableEdit(xmlText);
      if (!parsed || !parsed.ops || parsed.ops.length === 0) return _err('未解析到任何指令');
      var stats = MemTables.applyAIOps(parsed.ops, { actor: opts.actor || 'external' });
      _log('processXmlData·tableEdit 模式·已应用', stats);
      return { ok: true, stats: stats };
    }
    // 后备：自定义 <tm><cell sheet="X" op="insert" col0="..." col1="..." /></tm>
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(xmlText, 'text/xml');
      var cells = doc.getElementsByTagName('cell');
      var ops2 = [];
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var sheet = c.getAttribute('sheet');
        var op = c.getAttribute('op') || 'insert';
        var def = MemTables.SHEET_BY_KEY[sheet];
        if (!def) continue;
        var values = {};
        for (var j = 0; j < c.attributes.length; j++) {
          var attr = c.attributes[j];
          if (attr.name === 'sheet' || attr.name === 'op' || attr.name === 'rowIdx') continue;
          var m = attr.name.match(/^col(\d+)$/);
          if (m) values[m[1]] = attr.value;
        }
        ops2.push({
          cmd: op,
          tableIdx: def.idx,
          rowIdx: parseInt(c.getAttribute('rowIdx'), 10),
          values: values
        });
      }
      if (ops2.length === 0) return _err('XML 中未找到 <cell> 元素');
      var stats2 = MemTables.applyAIOps(ops2, { actor: opts.actor || 'external' });
      return { ok: true, stats: stats2 };
    } catch(e) {
      return _err('XML 解析失败', e);
    }
  }

  // ────── 入口 3：通用 process（自动检测 JSON / XML / DSL） ──────
  function processData(data, opts) {
    if (data == null) return _err('data 为空');
    if (typeof data === 'object') return processJsonData(data, opts);
    if (typeof data === 'string') {
      var trimmed = data.trim();
      if (trimmed.charAt(0) === '<') return processXmlData(trimmed, opts);
      if (trimmed.charAt(0) === '[' || trimmed.charAt(0) === '{') return processJsonData(trimmed, opts);
      // DSL：直接当 tableEdit 试
      return processXmlData(trimmed, opts);
    }
    return _err('无法识别 data 类型: ' + (typeof data));
  }

  // ────── 入口 4：只读查询 ──────
  function getState() {
    var pre = _ensureMemTables();
    if (pre) return pre;
    var snapshot = {};
    MemTables.SHEET_DEFS.forEach(function(d) {
      var t = MemTables.getSheet(d.key);
      snapshot[d.key] = {
        name: d.name,
        rows: t && t.rows ? t.rows.length : 0,
        lastWriteTurn: t && t._meta ? t._meta.lastWriteTurn : 0,
        historyEntries: t && t._meta && t._meta.cellHistory ? t._meta.cellHistory.length : 0
      };
    });
    return {
      ok: true,
      adapter: { calls: STATE.callCount, lastError: STATE.lastError },
      tables: snapshot
    };
  }

  function getSheet(sheetKey) {
    var pre = _ensureMemTables();
    if (pre) return pre;
    var t = MemTables.getSheet(sheetKey);
    if (!t) return _err('未知表: ' + sheetKey);
    var def = MemTables.SHEET_BY_KEY[sheetKey];
    return {
      ok: true,
      name: def.name,
      columns: def.columns,
      rows: t.rows.slice(),
      meta: t._meta ? { lastWriteTurn: t._meta.lastWriteTurn } : {}
    };
  }

  function setDebugMode(on) { STATE.debugMode = !!on; }
  function getLastError() { return STATE.lastError; }

  // ────── 暴露 API ──────
  global.TianmingMemoryAdapter = {
    processJsonData: processJsonData,
    processXmlData: processXmlData,
    processData: processData,
    getState: getState,
    getSheet: getSheet,
    setDebugMode: setDebugMode,
    getLastError: getLastError,
    VERSION: '1.0.0'
  };
})(typeof window !== 'undefined' ? window : this);
