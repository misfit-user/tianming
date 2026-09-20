const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-evidence-registry.js',
  'tm-memory-envelope.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const ME = sandbox.window.TM && sandbox.window.TM.MemoryEnvelope;
assert(ME, 'TM.MemoryEnvelope should be exported');

const GM = {
  turn: 22,
  _npcCommitments: {
    'Minister Sun': [
      {
        id: 'sc1q_22_MinisterSun_0',
        task: 'inspect canal accounts',
        status: 'pending',
        assignedTurn: 22,
        deadline: 'before winter',
        sourceRefs: [{ type: 'dialogueCommitment', id: 'court-22-sun', authority: 'court_report', turn: 22 }],
        basisRefs: [{ type: 'jishiRecords', id: 'jishi-22-sun', authority: 'court_report', turn: 22 }],
      },
    ],
  },
};

const envelopes = ME.collect(GM, { turn: GM.turn });
const commitment = envelopes.find((e) => e.id === 'sc1q_22_MinisterSun_0');
assert(commitment, 'npc commitment should project to envelope');
assert(commitment.sourceRefs.some((r) => r.type === 'dialogueCommitment' && r.id === 'court-22-sun'), 'commitment envelope should preserve dialogue source ref');
assert(commitment.basisRefs.some((r) => r.type === 'jishiRecords' && r.id === 'jishi-22-sun'), 'commitment envelope should preserve basis refs');
assert.strictEqual(commitment.authority, 'rule_validated', 'persisted sc1q commitments should stay rule_validated');

const applySource = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
assert(applySource.includes('TM.ImperialOrders.fromDialogue(GM,'), 'endturn routes source-bound reconciliation through its owner');
['tm-tax-policy.js','tm-imperial-orders.js'].forEach(file=>vm.runInNewContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox.window,{filename:file}));
const realGame={turn:22,playerInfo:{factionName:'Court'},facs:[{id:'court',name:'Court'}],chars:[{id:'sun',name:'Minister Sun',faction:'Court',alive:true}],_npcCommitments:{}};
sandbox.window.GM=realGame;sandbox.window.P={time:{daysPerTurn:30}};
sandbox.window.TM.ImperialOrders.fromDialogue(realGame,[{npc:'Minister Sun',task:'inspect canal accounts',source_conv_id:'court-22-sun',category:'query',deadline:'3回合内'}],[]);
const task=realGame._npcCommitments['Minister Sun'][0];
assert(task.sourceRefs.some(r=>r.type==='dialogueCommitment'&&r.id==='court-22-sun'),'runtime writes actual dialogue source refs');
assert.deepStrictEqual(task.basisRefs,task.sourceRefs,'runtime basis refs stay aligned');
const projected=ME.collect(realGame,{turn:22}).find(e=>e.id===task.id);
assert(projected&&projected.sourceRefs.some(r=>r.id==='court-22-sun'),'actual newly registered task keeps source through memory projection');

console.log('smoke-memory-sc1q-commitment-sourcebound ok');
