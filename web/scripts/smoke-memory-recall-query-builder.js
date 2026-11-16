const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-memory-retrieval.js'), 'utf8');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(src, sandbox.window, { filename: 'tm-memory-retrieval.js' });

const MR = sandbox.window.TM && sandbox.window.TM.MemoryRetrieval;
assert(MR, 'TM.MemoryRetrieval should be exported');
assert.strictEqual(typeof MR.buildRecallQueries, 'function', 'MemoryRetrieval should expose buildRecallQueries');

const GM = {
  turn: 72,
  chars: [
    { name: 'Wei Zhongxian', alive: true },
    { name: 'Yuan Chonghuan', alive: true },
    { name: 'Unmentioned Minister', alive: true },
  ],
  playerDecisions: [
    { turn: 71, type: 'summon', content: 'Summon Wei Zhongxian to discuss palace security' },
  ],
  activeEdicts: [
    { id: 'edict-ningyuan', status: 'active', content: 'Order Yuan Chonghuan to secure Ningyuan defenses' },
  ],
};

const baseQueries = [
  { keywords: ['salt tax'], purpose: 'SC0 requested fiscal recall' },
];

const queries = MR.buildRecallQueries(GM, baseQueries, {
  sc1q: {
    dialogue_commitments: [
      { npc: 'Sun Chengzong', task: 'deliver border memorial', deadline: 'next turn' },
    ],
  },
  maxQueries: 6,
});

assert.strictEqual(queries[0].keywords[0], 'salt tax', 'SC0 query should stay first');
assert(queries.some((q) => q.participant === 'Wei Zhongxian' && q._source === 'player_decision'), 'player decision should derive character query');
assert(queries.some((q) => q.participant === 'Yuan Chonghuan' && q._source === 'active_edict'), 'active edict should derive character query');
assert(queries.some((q) => q.participant === 'Sun Chengzong' && q._source === 'dialogue_commitment'), 'dialogue commitment should derive NPC query');
assert(!queries.some((q) => q.participant === 'Unmentioned Minister'), 'unmentioned character should not get an auto query');
assert(queries.every((q) => Array.isArray(q.keywords) && q.keywords.length > 0), 'each query should carry keywords');
assert(queries.filter((q) => q.participant === 'Wei Zhongxian').length === 1, 'auto queries should dedupe by participant');

const emptyBaseQueries = MR.buildRecallQueries(GM, [], {
  sc1q: { dialogue_commitments: [{ npc: 'Sun Chengzong', task: 'deliver border memorial' }] },
  maxQueries: 4,
});
assert(emptyBaseQueries.length > 0, 'priority sources should produce recall queries even when SC0 gives none');
assert(emptyBaseQueries.length <= 4, 'query builder should respect maxQueries');

const deduped = MR.buildRecallQueries(GM, [
  { keywords: ['Wei Zhongxian'], participant: 'Wei Zhongxian', purpose: 'SC0 already asked' },
], { maxQueries: 6 });
assert.strictEqual(deduped.filter((q) => q.participant === 'Wei Zhongxian').length, 1, 'base query should suppress duplicate auto participant query');

console.log('smoke-memory-recall-query-builder ok');
