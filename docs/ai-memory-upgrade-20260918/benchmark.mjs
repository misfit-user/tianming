import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
const load = prefix => {
  const ctx = { console, Date, Math, JSON, Number }; ctx.window = ctx; vm.createContext(ctx);
  for (const file of ['tm-memory-envelope.js', 'tm-memory-governance.js', 'tm-memory-retrieval.js', 'tm-memory-trace.js', 'tm-context-zones.js', 'tm-memory-context-compiler.js']) vm.runInContext(fs.readFileSync(prefix + '/web/' + file, 'utf8'), ctx, { filename: file });
  return ctx.TM;
};
const groups = Array.from({ length: 40 }, (_, i) => ({ query: { purpose: 'issue-' + i }, hits: [
  { id: 'shared-edict', source: 'activeEdict', text: 'Repair the canal and maintain grain deliveries.', turn: 10, importance: 9 },
  { id: 'issue-' + i, source: 'court_record', text: 'Court evidence for district ' + i, turn: 10, importance: 8 }
] }));
const results = {};
for (const [name, prefix] of [['before', '.bak-ai-memory-upgrade-20260918'], ['after', '.']]) {
  const TM = load(prefix), times = []; let result;
  for (let run = 0; run < 25; run++) {
    const start = performance.now();
    result = TM.MemoryRetrieval.packForInjection(groups, { maxTokens: 1200, turn: 10 });
    if (run >= 5) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const hits = result.recallResults.flatMap(group => group.hits);
  const compiled = TM.MemoryContextCompiler.compileRecall(result.recallResults, { maxTokens: 1200, perHitMaxChars: 100, turn: 10 });
  const emittedIds = Array.from(compiled.text.matchAll(/<memory id="([^"]*)"/g), match => match[1]);
  results[name] = { fixtureQueries: groups.length, candidates: 80, selected: hits.length, uniqueRecallFacts: new Set(hits.map(hit => hit.id)).size, recallTokens: result.tokenEstimate, recallMedianMs: Number(times[Math.floor(times.length / 2)].toFixed(3)), emittedUniqueFacts: new Set(emittedIds).size, compiledTokens: compiled.tokenEstimate };
}
fs.writeFileSync('docs/ai-memory-upgrade-20260918/recall-benchmark.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
