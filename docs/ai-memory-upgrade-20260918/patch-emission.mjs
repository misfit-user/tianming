import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-memory-context-compiler.js', (s, r) => {
  s = r(s, '    var tokenEstimate = packed\n', fs.readFileSync('docs/ai-memory-upgrade-20260918/compiler-emission.fragment.txt', 'utf8') + '    var tokenEstimate = packed\n');
  s = r(s, "      : (CZ && typeof CZ.estimateTokens === 'function' ? CZ.estimateTokens(text) : 0);", "      : (CZ && typeof CZ.estimateTokens === 'function' ? CZ.estimateTokens(text) : tokenCostFromCounts(tokenCharCounts(text)));");
  s = r(s, '      sections: sections,\n      hits: normalized,', '      sections: sections,\n      hits: normalized,\n      injectedSections: injectedSections,\n      injectedHits: injectedHits,');
  s = r(s, "      diagnostics: packed ? packed.diagnostics : { kept: normalized.map(function(hit) { return { id: hit.id, source: hit.source, stage: 'compiled' }; }), suppressed: [] },", '      diagnostics: diagnostics,');
  return s;
});
edit('web/tm-memory-trace.js', (s, r) => {
  s = r(s, 'var hits = Array.isArray(data.items) ? data.items : (Array.isArray(compiled.hits) ? compiled.hits : []);', 'var hits = Array.isArray(compiled.injectedHits) ? compiled.injectedHits : (Array.isArray(data.items) ? data.items : (Array.isArray(compiled.hits) ? compiled.hits : []));');
  s = r(s, '      sectionCounts: sectionCounts(compiled.sections),', '      sectionCounts: sectionCounts(compiled.injectedSections || compiled.sections),\n      candidateCount: Array.isArray(compiled.hits) ? compiled.hits.length : hits.length,\n      injectedCount: hits.length,');
  return s;
});
