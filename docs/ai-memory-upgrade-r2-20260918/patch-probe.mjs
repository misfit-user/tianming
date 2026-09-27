import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-model-detect.js', (s, r) => {
  s = r(s, '  var startedAt = Date.now();\n  var report = {', "  var _memoryPolicy = typeof window !== 'undefined' && window.TM && window.TM.MemoryAdaptive;\n  var _memoryLease = _memoryPolicy ? _memoryPolicy.beginProbe(_tier) : null;\n  var startedAt = Date.now();\n  var report = {");
  s = r(s, "    profile: 'tm-realistic-evidence-v2',", "    profile: 'tm-realistic-evidence-v3',");
  s = r(s, '    var weight = Number(extra.weight || 10);', '    var weight = Number(extra.weight == null ? 10 : extra.weight);');
  s = r(s, '  async function _chat(label, messages, maxTokens, timeoutMs) {', '  async function _chat(label, messages, maxTokens, timeoutMs, extraBody) {');
  s = r(s, '    while (attempt < 2) {\n      attempt += 1;', "    while (attempt < 2) {\n      if ((_memoryLease && !_memoryPolicy.probeCurrent(_memoryLease)) || (opts.signal && opts.signal.aborted)) throw Object.assign(new Error('probe_cancelled_or_stale'), { code: 'probe_cancelled_or_stale' });\n      attempt += 1;");
  s = r(s, "body: JSON.stringify({ model:_aiCfg.model || '', messages:messages, temperature:0, max_tokens:maxTokens || 256, stream:false }),", "body: JSON.stringify(Object.assign({ model:_aiCfg.model || '', messages:messages, temperature:0, max_tokens:maxTokens || 256, stream:false }, extraBody || {})),\n          timeoutMs: timeoutMs || 30000,");
  for (const n of [1,2,3,4,5]) s = r(s, `var j${n} = _tmProbeJsonParse(r${n}.text);`, `var j${n} = _memoryPolicy ? _memoryPolicy.strictJSON(r${n}.text) : _tmProbeJsonParse(r${n}.text);`);
  s = r(s, 'Array.isArray(j1.items) && j1.items.length === 4 && j1.truth === true', 'Array.isArray(j1.items) && JSON.stringify(j1.items) === "[2,4,6,8]" && j1.truth === true');
  s = r(s, "    var matches = (r6.text.match(re) || []);", "    var matches = Array.from(new Set(r6.text.match(re) || []));");
  s = r(s, "  var reqFam = _tmProbeFamily(_aiCfg.model || '');", "  if (_memoryPolicy) await _memoryPolicy.runProbes(_chat, _addCheck, opts);\n  var reqFam = _tmProbeFamily(_aiCfg.model || '');");
  s = r(s, "  if (!P.conf._probeHistory) P.conf._probeHistory = {};\n  var keyName", "  if (_memoryLease && !_memoryPolicy.commitEvidence(report, _memoryLease)) return report;\n  if (!P.conf._probeHistory) P.conf._probeHistory = {};\n  var keyName");
  return s;
});
edit('web/tm-player-settings.js', (s, r) => {
  s = r(s, "  if (evidence) h += _renderEvidenceDetails(evidence);", "  if (window.TM && window.TM.MemoryAdaptive) {\n    var mp = window.TM.MemoryAdaptive.plan({ tier: tier });\n    var ml = { compact: '精简辅助', balanced: '均衡记忆', deep: '深度记忆' };\n    h += '<div>记忆策略：' + escHtml(ml[mp.mode]) + ' · ' + mp.memoryTokens + ' tokens · 自主检索最多 ' + mp.maxRounds + ' 轮 / ' + mp.maxToolCalls + ' 次工具 · ' + (mp.verified ? '近期实测证据' : '未验证或证据已过期') + '</div>';\n  }\n  if (evidence) h += _renderEvidenceDetails(evidence);");
  s = r(s, "    h += '<span style=\"color:' + color + ';\">' + (c.ok ? '通过' : '失败') + '</span>';", "    h += '<span style=\"color:' + color + ';\">' + (c.state === 'unavailable' ? '未测定' : (c.ok ? '通过' : '失败')) + '</span>';");
  const old = '6 次'; if (!s.includes(old)) throw Error('Probe call count notice not found');
  s = s.replaceAll(old, '9 次（原 6 项 + 3 项记忆能力）');
  return s;
});
edit('web/scripts/smoke-model-probe-evidence.js', (s, r) => r(s, "assert(settings.includes('6 次'),", "assert(settings.includes('9 次'),"));
