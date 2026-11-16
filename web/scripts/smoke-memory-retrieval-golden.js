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
assert.strictEqual(typeof MR.collectPriorityHits, 'function', 'MemoryRetrieval should collect priority deterministic hits');

const GM = {
  turn: 30,
  activeEdicts: [
    { name: '辽东军饷追拨', category: 'military', status: 'active', startedTurn: 18, reason: '辽东军饷不得再拖欠' },
    { name: '无关礼制整饬', category: 'ritual', status: 'active', startedTurn: 29, reason: '太庙礼制' },
  ],
  _edictTracker: [
    { id: 'ed-1', turn: 21, status: 'executing', category: 'military', content: '追拨辽东军饷十万两，优先补发欠饷', progressPercent: 40, feedback: '户部称库银不足' },
    { id: 'ed-2', turn: 12, status: 'completed', category: 'finance', content: '已结案旧税案' },
  ],
  _npcCommitments: {
    '孙承宗': [
      { id: 'c1', task: '核验辽东欠饷并三日内具奏', status: 'executing', assignedTurn: 27, deadline: 3, progress: 50, feedback: '已移文辽镇' },
      { id: 'c2', task: '修葺太庙', status: 'completed', assignedTurn: 10, deadline: 3 },
    ],
  },
};

const sc1q = {
  dialogue_commitments: [
    { npc: '袁崇焕', task: '回辽东清查军饷去向', deadline: '三回合内', source_type: '御前', source_conv_id: 'T30-袁崇焕', willingness: 0.8, required_npc_action: '清查辽东军饷' },
  ],
};

const hits = MR.collectPriorityHits(GM, {
  keywords: ['辽东', '军饷'],
  participant: '孙承宗',
  purpose: '追查辽东军饷旧令和对话承诺',
}, { sc1q });

assert(hits.some((h) => h.source === 'activeEdict' && h.id === 'active-edict-0'), 'activeEdicts should produce priority hits');
assert(hits.some((h) => h.source === 'activeEdict' && h.id === 'ed-1'), '_edictTracker executing edict should produce priority hits');
assert(hits.some((h) => h.source === 'commitment' && h.id === 'c1'), 'pending/executing NPC commitments should produce priority hits');
assert(hits.some((h) => h.source === 'commitment' && String(h.id).includes('T30')), 'sc1q dialogue commitments should produce priority hits');
assert(!hits.some((h) => h.id === 'ed-2'), 'completed edicts should not be priority recall hits');
assert(!hits.some((h) => h.id === 'c2'), 'completed commitments should not be priority recall hits');

const ranked = MR.rankHits(hits.concat([
  { id: 'vec-hot', source: 'vector', text: '辽东军饷相关片段但只是向量相似', sim: 0.99, turn: 30, importance: 2 },
]), { turn: 30 });

assert.notStrictEqual(ranked[0].id, 'vec-hot', 'deterministic priority hits should outrank pure vector similarity');
assert(ranked.slice(0, 3).some((h) => h.source === 'activeEdict'), 'top recall set should include active edict evidence');
assert(ranked.slice(0, 4).some((h) => h.source === 'commitment'), 'top recall set should include live commitments');

console.log('smoke-memory-retrieval-golden ok');
