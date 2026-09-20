import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-memory-context-compiler.js', (s, r) => {
  s = r(s, "    var text = hit.safeBody != null && hit.safeBody !== ''", '    var text = hit.safeBody != null');
  s = r(s, '    out.text = safeTextOf(out, opts && opts.perHitMaxChars || 180);', '    out._factText = safeTextOf(out, Number.MAX_SAFE_INTEGER);\n    out.text = safeTextOf(out, opts && opts.perHitMaxChars || 180);');
  s = r(s, '  function compileHitsInner(hits, opts) {', fs.readFileSync('docs/ai-memory-upgrade-20260918/compiler-policy.fragment.txt', 'utf8') + '  function compileHitsInner(hits, opts) {');
  s = r(s, '    var normalizedInput = (Array.isArray(hits) ? hits : [])', '    var normalizedInput = governCompilerHits(Array.isArray(hits) ? hits : [], opts, suppressed)');
  s = r(s, '    var seenStableIds = {};\n    var seenFacts = {};', '    var seenStableIds = Object.create(null);\n    var seenFacts = Object.create(null);');
  s = r(s, "      var factKey = String(hit.source || '') + '|' + String(hit.text || '').replace(/\\s+/g, ' ').trim();", "      var factKey = String(hit.source || '') + '|' + String(hit.readScope || hit.ownerScope || '') + '|' + String(hit._factText || hit.text || '').replace(/\\s+/g, ' ').trim();");
  s = r(s, "          reason: key\n        };", "          reason: key,\n          allowTruncate: false\n        };");
  s = r(s, '            var cost = plan.tokenCostForCount(mid);\n            if (mid > 0 && cost <= limit) {', '            var candidate = plan.textForCount(mid);\n            var cost = info && typeof info.estimateTokens === "function" ? info.estimateTokens(candidate) : plan.tokenCostForCount(mid);\n            if (cost <= limit) {');
  const start = s.indexOf("    if (MR && typeof MR.rankHitsDetailed === 'function') {", s.indexOf('  function compileFromGM('));
  const end = s.indexOf('    var mergedOpts = {};', start);
  if (start < 0 || end < start) throw Error('compileFromGM rank boundary missing');
  s = r(s, s.slice(start, end), '');
  s = r(s, '    mergedOpts.suppressed = arr(opts.suppressed).concat(suppressed);', '    mergedOpts.GM = GM;\n    mergedOpts.turn = opts.turn != null ? opts.turn : (GM && GM.turn);\n    mergedOpts.suppressed = arr(opts.suppressed).concat(suppressed);');
  s = r(s, 'var envelopes = ME.collect(GM || {}, { turn: opts.turn || (GM && GM.turn), sc1q: opts.sc1q });', 'var envelopes = ME.collect(GM || {}, { turn: opts.turn != null ? opts.turn : (GM && GM.turn), sc1q: opts.sc1q });');
  return s;
});
