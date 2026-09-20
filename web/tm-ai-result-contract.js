// Shared output boundaries. No generated facts or world writes.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.AIResultContract) return;
  var TEXT_KEYS = ['content', 'text', 'narrative', 'body', 'paragraphs', 'sections'];
  var RECORD_KEYS = ['shizhengji','zhengwen','playerStatus','playerInner','turnSummary','shiluText','szjTitle','szjSummary','hourenXishuo'];
  var OUTPUT_KEYS = ['shizhengji','zhengwen','narrative','shilu_text','turn_summary','player_status','player_inner','szj_title','szj_summary','houren_xishuo'];
  function invalid(field) {
    var e = new TypeError('叙事字段结构无法安全转换：' + String(field || 'text') + '；保留原响应，须修复结构后重试');
    e.code = 'ai-narrative-shape'; e.field = field || 'text'; throw e;
  }
  function text(value, field, seen) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    var visited = seen || new Set();
    if (typeof value !== 'object' || visited.has(value)) return invalid(field);
    visited.add(value);
    try {
      if (Array.isArray(value)) return value.map(function(v) { return text(v, field, visited); }).join('\n');
      if (Object.prototype.toString.call(value) !== '[object Object]') return invalid(field);
      var selected = null;
      for (var i = 0; i < TEXT_KEYS.length; i++) {
        var key = TEXT_KEYS[i];
        if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null) {
          var candidate = text(value[key], field, visited);
          if (selected != null && selected !== candidate && candidate.trim() && selected.trim()) return invalid(field);
          if (selected == null || candidate.trim()) selected = candidate;
        }
      }
      return selected == null ? invalid(field) : selected;
    } finally { visited.delete(value); }
  }
  function normalize(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    var changes = {};
    keys.forEach(function(k) { if (Object.prototype.hasOwnProperty.call(value, k)) changes[k] = text(value[k], k); });
    Object.keys(changes).forEach(function(k) { value[k] = changes[k]; });
    return value;
  }
  function historyText(value) {
    try { return text(value, 'historical-narrative'); }
    catch (_) { var seen = new Set(); return '[旧档结构化记录，非正文] ' + JSON.stringify(value, function(k,v) { if (v && typeof v === 'object') { if (seen.has(v)) return '[重复或循环引用]'; seen.add(v); } return v; }); }
  }
  function policyTags(value) {
    if (value == null) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.map(function(v) { return typeof v === 'string' ? v : historyText(v); });
    if (typeof value === 'object') return Object.keys(value).map(function(k) { return k + '：' + historyText(value[k]); });
    return [String(value)];
  }
  function mainFailure(error) {
    return !!error && (error.writebackFailures || error.validity || error.mainWriteback === true ||
      /^(ai-writeback-|writeback-|ai-narrative-|sc1-result-unavailable)/.test(error.code || ''));
  }
  TM.AIResultContract = { text: text, historyText: historyText, policyTags: policyTags, mainFailure: mainFailure,
    normalizeRecord: function(record) { return normalize(record, RECORD_KEYS); },
    normalizeOutput: function(output) { return normalize(output, OUTPUT_KEYS); } };
})(typeof window !== 'undefined' ? window : globalThis);
