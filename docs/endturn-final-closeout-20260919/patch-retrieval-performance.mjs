import {edit} from './patch-utils.mjs';
edit('web/tm-memory-hybrid.js',(s,r)=>{
 const helper=`  // Cache pure token counts by exact input text, never by a mutable world ID.
  var tokenCache = new Map(), cacheChars = 0, cacheWorld = null;
  function countsFor(text) {
    if (cacheWorld !== root.GM) { tokenCache.clear(); cacheChars = 0; cacheWorld = root.GM; }
    var cached = tokenCache.get(text);
    if (cached) { tokenCache.delete(text); tokenCache.set(text, cached); return cached; }
    var words = tokens(text), counts = Object.create(null);
    words.forEach(function(word) { counts[word] = (counts[word] || 0) + 1; });
    var result = { counts: counts, length: words.length };
    if (text.length <= 16000) {
      tokenCache.set(text, result); cacheChars += text.length;
      while (tokenCache.size > 2048 || cacheChars > 2000000) { var key = tokenCache.keys().next().value; cacheChars -= key.length; tokenCache.delete(key); }
    }
    return result;
  }
`;
 s=r(s,'  function lexical(hits, query, limit) {',helper+'  function lexical(hits, query, limit) {');
 s=r(s,"      var words = tokens(body(hit) + ' ' + (hit.entities || []).join(' ') + ' ' + (hit.char || '')), counts = Object.create(null);\n      words.forEach(function(word) { counts[word] = (counts[word] || 0) + 1; });","      var cached = countsFor(body(hit) + ' ' + (hit.entities || []).join(' ') + ' ' + (hit.char || '')), counts = cached.counts;");
 s=r(s,'      totalLength += words.length; return { hit: hit, counts: counts, length: words.length };','      totalLength += cached.length; return { hit: hit, counts: counts, length: cached.length };');
 s=r(s,'    var candidates = Object.keys(pool).map(function(id) { return pool[id]; }), selected = [];','    var candidates = Object.keys(pool).map(function(id) { var row = pool[id]; row.words = new Set(tokens(body(row.hit))); row.similarity = 0; return row; }), selected = [];');
 s=r(s,'      candidates.forEach(function(row) { var similarity = selected.reduce(function(max, s) { return Math.max(max, overlap(row.hit, s.hit)); }, 0); row.utility = row.score * (1 - 0.35 * similarity); });','      var latest = selected.length ? selected[selected.length - 1] : null;\n      candidates.forEach(function(row) {\n        if (latest) { var count = 0; row.words.forEach(function(word) { if (latest.words.has(word)) count++; }); row.similarity = Math.max(row.similarity, count / Math.max(1, row.words.size + latest.words.size - count)); }\n        row.utility = row.score * (1 - 0.35 * row.similarity);\n      });');
 return s;
});
