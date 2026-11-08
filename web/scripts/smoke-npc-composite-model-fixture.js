'use strict';
// Validate the exact Electron transport fixture before launching the large
// official world. Runtime schemas and validity functions are read from source.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Ajv = require('ajv');
const { functionSource } = require('./lib-perf-round1');
const { responseFor } = require('../../scripts/electron/npc-composite-model-fixture.cjs');
const web = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(web, 'tm-endturn-ai.js'), 'utf8');
const c = { console: { log() {}, warn() {}, error() {} }, TM: { Endturn: { AI: {} } }, Date };
c.window = c; vm.createContext(c);
for (const file of ['tm-ai-schema.js', 'tm-ai-output-validator.js', 'tm-endturn-ai-sc1-budget.js']) vm.runInContext(fs.readFileSync(path.join(web, file), 'utf8'), c, { filename: file });
for (const name of ['_hasSc1StructuredResult', '_hasExpectedJsonKey', '_buildGenericArrayObjectSchema', '_buildSc1dJsonSchema', '_buildSc15JsonSchema', '_buildSc15nJsonSchema', '_buildSc16JsonSchema', '_buildSc17JsonSchema', '_buildSc18JsonSchema', '_buildSc2JsonSchema', '_buildSc25cJsonSchema', '_buildSc27JsonSchema', '_buildSc28JsonSchema']) vm.runInContext(functionSource(main, name), c, { filename: 'tm-endturn-ai.js:' + name });
vm.runInContext('var injectedResponseFor = ' + responseFor.toString() + ';', c);
const ajv = new Ajv({ allErrors: true });
const builders = {
  sc1: c.TM.Endturn.AI.subcalls._buildSc1JsonSchema, sc1q: c.TM.Endturn.AI.subcalls._buildSc1qJsonSchema,
  sc1b: c.TM.Endturn.AI.subcalls._buildSc1bJsonSchema, sc1c: c.TM.Endturn.AI.subcalls._buildSc1cJsonSchema,
  sc1d: c._buildSc1dJsonSchema, sc15: c._buildSc15JsonSchema, sc15n: c._buildSc15nJsonSchema,
  sc16: c._buildSc16JsonSchema, sc17: c._buildSc17JsonSchema, sc18: c._buildSc18JsonSchema,
  sc2: c._buildSc2JsonSchema, 'sc25c.tactical': c._buildSc25cJsonSchema,
  'sc25c.strategic': c._buildSc25cJsonSchema, sc27: c._buildSc27JsonSchema, sc28: c._buildSc28JsonSchema
};
let passed = 0;
for (const [kind, build] of Object.entries(builders)) {
  const response = responseFor(kind, '');
  const validate = ajv.compile(JSON.parse(JSON.stringify(build().schema)));
  assert(validate(response), kind + ': ' + JSON.stringify(validate.errors));
  assert.equal(JSON.stringify(c.injectedResponseFor(kind, '')), JSON.stringify(response), 'renderer injection is self-contained: ' + kind);
  if (/^sc1(?:b|c)?$/.test(kind)) {
    const checked = c.TM.validateAIOutput(response, kind, 'turn-full');
    assert(checked && checked.ok, kind + ': ' + JSON.stringify(checked));
    assert.equal(checked.stats.unknownKeys, 0, kind + ' cannot mix other subcall schemas');
    assert.equal(checked.warnings.length, 0, kind + ': ' + JSON.stringify(checked.warnings));
  }
  console.log('PASS real schema and isolated renderer fixture ' + kind); passed++;
}
const mainResponse = responseFor('sc1', '');
assert.equal(c._hasSc1StructuredResult(mainResponse), true, 'SC1 must pass the actual substantive-result gate');
assert.equal(c._hasSc1StructuredResult({ turn_summary: '空调整', shizhengji_basis: '已有来源', events: [], resource_changes: {} }), false, 'the old shallow mixed fixture cannot masquerade as a complete SC1 result');
assert.equal(c.TM.validateAIOutput({ ...mainResponse, battleResult: null }, 'invalid-fixture', 'turn-full').ok, false, 'null is not an absent battle result');
for (const [kind, keys] of Object.entries({ sc0: ['tensions', 'consequences', 'memoryQueries'], sc1q: ['dialogue_commitments', 'collective_resolutions', 'npc_dialogue_intent', 'required_sc1_actions'], sc1b: ['cultural_works', 'npc_letters', 'npc_correspondence', 'npc_interactions'], sc1c: ['faction_events', 'faction_ai_outcomes', 'faction_interactions_advanced', 'npc_schemes', 'scheme_actions'], sc_memwrite: ['memory_writes', 'arc_updates', 'causal_edges'], sc25: ['foreshadow', 'memory', 'state_board', 'event_weights'], sc_audit: ['conflicts', 'auto_patches', 'needs_rerun'] })) {
  const response = responseFor(kind, '');
  assert.equal(c._hasExpectedJsonKey(response, keys), true, kind + ' actual parse/repair precondition');
  for (const key of keys) assert(Object.hasOwn(response, key), kind + '.' + key);
}
assert.deepEqual(responseFor('', '【正式奏疏的完整结构（必须遵守）】'), []);
assert.deepEqual(responseFor('', '你是剧作师·负责推进主要 NPC 的情节弧。'), {});
assert.deepEqual(responseFor('', '依据收到的信息选择行动，允许无事、等待、拒绝和改条件。若无需新方向，返回 planning:null。'), { planning: null });
assert(Array.isArray(responseFor('', 'You calibrate a historical simulation game state.').notes));
assert.equal(responseFor('sc25c', '【sc25c·战术层 tactical】').state_board.recent_summary.length > 0, true);
assert.equal(responseFor('sc25c', '【sc25c·战略层 strategic】').consolidated.length > 0, true);
const reviewPrompt = '天命每回合固定执行的复核与补全 Agent\n';
assert.equal(responseFor('', reviewPrompt + JSON.stringify({ case: { mode: 'routine', issues: [], corrections: [] } })).tools[0].name, 'submit');
assert.throws(() => responseFor('', reviewPrompt + JSON.stringify({ case: { mode: 'routine', issues: [{ text: '实际待核查问题' }] } })), /requires-explicit-evidence/);
assert.throws(() => responseFor('unknown-subcall', 'unrelated request'), /unsupported-composite-model-fixture/);
async function directProducerChecks() {
  const { politicalFixture } = require('./lib-political-action-fixture');
  const d = politicalFixture(), requests = [];
  d.console = { log() {}, warn() {}, error() {} }; d.AbortController = AbortController; d.global = d;
  d.load('tm-ai-infra-json.js');
  d.extractJSON = d.robustParseJSON = JSON.parse;
  d.callAI = async prompt => {
    const out = responseFor('', prompt); requests.push({ prompt, out });
    assert.equal(JSON.stringify(c.injectedResponseFor('', prompt)), JSON.stringify(out), 'direct fixture is self-contained in renderer');
    return typeof out === 'string' ? out : JSON.stringify(out);
  };
  d.callAIMessages = async messages => d.callAI(messages.map(m => m.content).join('\n'));
  vm.runInContext(functionSource(fs.readFileSync(path.join(web, 'tm-ai-infra.js'), 'utf8'), 'callAISmart'), d);
  d.load('tm-party-inference.js');
  d.GM.parties = [{ name: '测试旧党', ideology: '已有主张', influence: 30 }]; d.GM.classes = [{ name: '测试旧阶层', demands: '已有诉求' }];
  const party = await d.TM.PartyInference.tickInference(d.GM);
  assert.equal(party.applied, 0); assert.equal(party.blocked, 0);
  assert(d.GM.parties[0]._identity, 'real identity consumer keeps its documented deterministic fallback');
  assert.equal(requests.length, 2, 'real forge/tick construct distinct requests');
  console.log('PASS actual party identity and action producers, parsers and no-action receipts');

  d.load('tm-faction-npc-settings.js'); d.load('tm-faction-npc-llm-decision.js');
  const treasuryBefore = d.fa.treasury.money;
  const political = await d.TM.FactionNpcLlmDecision.decideFor('甲国', { actorId: 'a', actingPositionId: 'pa', maxAttempts: 1 });
  assert(political.generated && !political.failed, JSON.stringify(political));
  assert.equal(d.fa.treasury.money, treasuryBefore);
  d.GM.turn++; d.TM.PoliticalActions.flush(); assert.equal(d.fa.treasury.money, treasuryBefore);
  assert(requests.some(r => r.prompt.includes('你是当前绑定的真实人物，以列出的本次职任思考。') && Array.isArray(r.out.proposalResponses)));
  console.log('PASS actual political compatibility request, parse, validation and zero proposed effects');

  d.a.importance = 80; d.load('tm-char-arcs.js'); await d.CharArcs.advance({ force: true });
  assert.equal(d.GM._charArcs._lastTurn, d.GM.turn);
  assert.equal(Object.keys(d.GM._charArcs).filter(k => !k.startsWith('_')).length, 0, 'fixture invents no hidden motive or new arc');
  console.log('PASS actual character arc producer and no-new-character-result consumer');

  d.GM.turn = 3;
  vm.runInContext(functionSource(fs.readFileSync(path.join(web, 'tm-three-systems-ext.js'), 'utf8'), '_scThreeSystemsAI'), d);
  await d._scThreeSystemsAI();
  assert.equal(d.GM._npcDecisions.generatedTurn, 3);
  assert.equal(d.GM._npcDecisions.factionActions.length + d.GM._npcDecisions.partyActions.length + d.GM._npcDecisions.generalActions.length, 0);
  console.log('PASS actual three-system prefetch producer and response parser');

  // The actual post-turn memory functions are already loaded by the shared
  // production fixture. Only their outbound model responses are supplied.
  d.GM.shijiHistory = [{ turn: 5, shizhengji: '测试资料：甲已收到来信，赴约尚待本人决定。' }];
  await d._scL2AIGenerate(5);
  assert.equal(d.GM._memoryLayers.L2.find(x => x.turnBucket === 5).aiGenerated, true);
  await d._scL3Condense(30);
  assert.equal(d.GM._memoryLayers.L3.find(x => x.turnBucket === 30).aiGenerated, true);
  d.GM._lastTurnPredictions = { turn: 1, thinking: '本测试未提供额外预测。' };
  await d._scReflect(3, { thinking: '继续读取实际事项结果。', subcall25: { memory: '实际事项仍保存在领域记录。' } });
  assert.equal(d.GM._aiReflections.length, 1);
  assert.equal(d.GM._aiReflections[0].confidence_calibration, 0);
  console.log('PASS actual L2/L3/reflection producers, JSON parsing and saved outputs');

  d._buildLongTermActionsDigest = () => '测试原始长期事项：已收到材料，尚未批准出发；有效期与责任按原事项处理。'.repeat(20);
  vm.runInContext(functionSource(fs.readFileSync(path.join(web, 'tm-endturn-ai-helpers.js'), 'utf8'), 'aiDigestLongTermActions'), d);
  await d.aiDigestLongTermActions();
  assert.equal(d.GM._longTermDigest._fromAI, true);
  assert(d.GM._longTermDigest.text.includes('尚未批准出发'));
  assert(d.GM._longTermDigest.text.length >= 300, 'the real callAISmart minimum uses actual source excerpts, not a retry loop');
  console.log('PASS actual plain-text long-term producer and minimum-length consumer');

  // The small supplemental military/revolt responses go through their real
  // existing no-action consumers. Unsupported destructive story decisions
  // (capture/death/breach) intentionally remain outside this fixture.
  for (const file of ['tm-border-invasion.js', 'tm-revolt-inference.js']) d.load(file);
  const borderPrompt = '你是天命推演引擎的外患演绎官。以下敌国各有心思';
  const revoltPrompt = '你是天命推演引擎的民变演绎官。天下汹汹';
  assert(fs.readFileSync(path.join(web, 'tm-border-invasion.js'), 'utf8').includes(borderPrompt));
  assert(fs.readFileSync(path.join(web, 'tm-revolt-inference.js'), 'utf8').includes(revoltPrompt));
  assert.equal(d.TM.BorderInvasion._applyInvasionActions(d.GM, responseFor('', borderPrompt)).applied, 0);
  assert.equal(d.TM.RevoltInference._applyActions(d.GM, responseFor('', revoltPrompt)).applied, 0);
  assert.throws(() => responseFor('', '你是天命推演引擎的国变演绎官。京师已陷'), /unsupported/);
  console.log('PASS real bounded border/revolt no-action consumers; unsupported irreversible branches fail closed');

  const events = responseFor('', '请将以下游戏事件压缩为200字以内的摘要，格式：\n事件列表：\n[来信] 尚待答复\n\n请直接输出摘要正文：');
  assert.equal(typeof events, 'string'); assert(events.includes('尚待答复'));
  const archive = responseFor('', '请将以下历史纪要压缩为一段100字以内的综述：\n原有纪要：尚未出发。');
  assert.equal(typeof archive, 'string'); assert(archive.includes('尚未出发'));
  const monthly = responseFor('', '【本月事件】\n[来信] 尚待本人答复\n【上月纪事末尾】旧文\n请直接输出纪事正文（不要JSON包裹）：');
  assert.equal(typeof monthly, 'string'); assert(monthly.includes('尚待本人答复')); assert(!monthly.includes('旧文'));
  console.log('PASS declared plain-text memory/chronicle protocols preserve source statements');
  d.load('tm-office-powermap.js'); d.load('tm-office-recall-agent.js');
  d.GM.officeTree = d.fa.officeTree;
  d.callAIWithTools = async (prompt, tools) => {
    const raw = await d.callAI(d._tmAIToolJSON.prompt(prompt, tools));
    return { text: raw, toolCalls: d._tmAIToolJSON.filter(d._tmAIToolJSON.parse(raw), tools) };
  };
  const recall = await d.runOfficeRecall(d.GM, {});
  assert.equal(recall.toolCallCount, 1); assert.equal(recall.toolCalls[0].name, 'query_office');
  assert(recall.text.includes('甲署'), 'real queryOfficeDetail receives a department actually present in its source');
  console.log('PASS actual office-recall producer, tool JSON parser and read-only query consumer');

  const stages = fs.readFileSync(path.join(web, 'tm-endturn-apply-stages.js'), 'utf8');
  const start = stages.indexOf('        try {', stages.indexOf('// 辅臣拟议·AI 生成'));
  const end = stages.indexOf('        // 空体奏疏兜底:', start);
  assert(start > 0 && end > start);
  const originalText = '测试地方材料尚待核处，有司仅报已收到陈情，未曾核准拨款或认定查明。';
  d.GM.memorials = [{ from: '甲代表', type: '民情', title: '待核材料', text: originalText, content: originalText, status: 'pending', _needsAiBody: true, _minxinPressureCandidate: { regionName: '测试地域', className: '测试群体', true: 32, perceived: 36 } }];
  await vm.runInContext('(async function(){' + stages.slice(start, end) + '})()', d);
  assert.equal(d.GM.memorials[0].text, originalText);
  assert.equal(d.GM.memorials[0]._aiBodyDone, true);
  assert.equal(d.GM.memorials[0].status, 'pending');
  assert.equal(d.GM.memorials[0]._fuchenNiyi, undefined, 'fixture proposed no new advice');
  console.log('PASS actual memorial draft/advice source blocks and parsers preserve pending facts');
  return requests.length;
}
directProducerChecks().then(directRequests => console.log(JSON.stringify({ suite: 'npc-composite-model-fixture', schemaCases: passed, directRequests, actualSC1Validator: true, actualSubstantiveGate: true, unknownRequestsFailClosed: true }))).catch(e => { console.error(e.stack); process.exitCode = 1; });
