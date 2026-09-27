import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-memory-retrieval.js', (s, r) => {
  s = r(s, '    var maxTokens = Number(opts.maxTokens || 0);', "    var hasBudget = opts.maxTokens != null && opts.maxTokens !== '';\n    var numericBudget = Number(opts.maxTokens);\n    var maxTokens = hasBudget ? (Number.isFinite(numericBudget) && numericBudget >= 0 ? Math.floor(numericBudget) : 8192) : 0;");
  s = r(s, '    function itemKey(item) {', fs.readFileSync('docs/ai-memory-upgrade-20260918/recall-dedupe.fragment.txt', 'utf8') + '    function itemKey(item) {');
  s = r(s, '      var canFit = !maxTokens || (used + item.cost <= maxTokens);', '      var canFit = !hasBudget || (used + item.cost <= maxTokens);');
  return s;
});
edit('web/tm-endturn-ai.js', (s, r) => {
  s = r(s, 'var _maxRecallTokens = (P && P.conf && P.conf.memoryRecallTokenBudget) || 1200;', 'var _maxRecallTokens = P && P.conf && P.conf.memoryRecallTokenBudget != null ? P.conf.memoryRecallTokenBudget : 1200;');
  s = r(s, '                  maxTokens: _maxRecallTokens,\n                  perHitMaxChars: 100', "                  maxTokens: _maxRecallTokens,\n                  GM: GM, turn: GM && GM.turn, audience: 'system',\n                  perHitMaxChars: 100");
  s = r(s, "                maxTokens: (P && P.conf && (P.conf.memoryRecallZoneTokenBudget || P.conf.memoryRecallTokenBudget)) || 1200,", "                GM: GM, audience: 'system', intent: 'historical_evidence',\n                maxTokens: P && P.conf && P.conf.memoryRecallZoneTokenBudget != null ? P.conf.memoryRecallZoneTokenBudget : (P && P.conf && P.conf.memoryRecallTokenBudget != null ? P.conf.memoryRecallTokenBudget : 1200),");
  s = r(s, 'items: (_compiledRecall.hits || []).map(function(hit) {', 'items: (_compiledRecall.injectedHits || _compiledRecall.hits || []).map(function(hit) {');
  s = r(s, '          } else {\n          var _recallTraceStart = _recentHistory.length;', '          } else if (!_compiledRecall) {\n          var _recallTraceStart = _recentHistory.length;');
  s = r(s, '            _compiledRecall = null;\n          }\n          if (_compiledRecall && _compiledRecall.text)', "            _compiledRecall = { text: '', injectedHits: [], suppressed: [{ reason: 'compiler_error' }] };\n            _dbg('[SC_RECALL] memory compiler failed; unsafe fallback skipped:', _compileRecallE);\n          }\n          if (_compiledRecall && _compiledRecall.text)");
  s = r(s, '                    items: _sc1CompiledContext.hits || [],', '                    items: _sc1CompiledContext.injectedHits || _sc1CompiledContext.hits || [],');
  return s;
});
