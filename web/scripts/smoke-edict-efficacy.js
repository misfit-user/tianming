'use strict';
// 诏令效力：办结不等于废止；系统一次性条目不挂进现行诏制；有期诏令期满退出；清理不删现行诏令。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WEB = path.resolve(__dirname, '..');
let passed = 0, failed = 0;

function world(turn) {
  const c = { console, Math, JSON, Object, Array, String, Number, RegExp, Date };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-edict-efficacy.js'), 'utf8'), c, { filename: 'tm-edict-efficacy.js' });
  c.GM = { turn: turn || 1, _edictTracker: [] };
  return c;
}
function edict(fields) {
  return Object.assign({ id: 'e' + Math.random().toString(36).slice(2, 8), content: '免江南新垦田赋三年，旧田照常纳税，不得追征。', category: '政令', turn: 1, status: 'pending' }, fields);
}
function ids(list) { return Array.from(list, e => e.id); }
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + (e && e.stack || e)); }
}

test('completed promulgation stays current until AI judges it', () => {
  const c = world(20), E = c.TM.EdictEfficacy;
  const law = edict({ id: 'law', status: 'completed', progressPercent: 100 });
  c.GM._edictTracker.push(law);
  assert.equal(E.stateOf(law), 'unjudged');
  assert.equal(E.isCurrent(law, 20), true);
  assert.deepEqual(ids(E.current(c.GM)), ['law']);
});

test('system one-off entries never linger as current rules', () => {
  const c = world(5), E = c.TM.EdictEfficacy;
  c.GM._edictTracker.push(
    edict({ id: 'appoint_1_甲', content: '擢甲为户部尚书' }),
    edict({ id: 'impeach_1_乙', content: '劾乙', category: '弹劾', _impeach: { target: '乙' } }),
    edict({ id: 'vacancy_death_1_丙', content: '丙身故·所任已缺员', category: '官缺' }),
    edict({ id: 'x1', content: '某职缺员', category: '官缺', _vacancyFromSweep: {} }),
    edict({ id: 'x2', content: '官制树任命', _offTreeAppoint: true }),
    edict({ id: 'x3', content: '赈济试点', _reliefCaseId: 'r1' }),
    edict({ id: 'player', content: '开海禁，许商民出洋贸易。' })
  );
  assert.deepEqual(ids(E.current(c.GM)), ['player']);
});

test('judged states: standing and term are current, the rest are not', () => {
  const c = world(10), E = c.TM.EdictEfficacy;
  const cases = { standing: true, term: true, one_off: false, expired: false, revoked: false, superseded: false };
  Object.keys(cases).forEach(state => {
    const e = edict({ efficacy: { state: state, untilTurn: state === 'term' ? 30 : undefined } });
    assert.equal(E.isCurrent(e, 10), cases[state], state);
  });
});

test('term edict expires after its last turn and tick records it', () => {
  const c = world(10), E = c.TM.EdictEfficacy;
  const e = edict({ id: 'term', status: 'completed', efficacy: { state: 'term', untilTurn: 10 } });
  c.GM._edictTracker.push(e);
  assert.equal(E.isCurrent(e, 10), true, '期限当回合仍有效');
  c.GM.turn = 11;
  assert.equal(E.isCurrent(e, 11), false, '过期后不再现行');
  E.tick(c.GM);
  assert.equal(e.efficacy.state, 'expired');
  assert.equal(e.efficacy.endedTurn, 11);
  assert.equal(e.efficacy.untilTurn, 10, '原期限保留');
});

test('tick gives id-less entries a stable id', () => {
  const c = world(3), E = c.TM.EdictEfficacy;
  const letter = { content: '密旨：着某督抚严查盐引。', category: '政令', turn: 2, status: 'pending', source: 'letter' };
  c.GM._edictTracker.push(letter);
  E.tick(c.GM);
  assert.match(letter.id, /^edict_2_/);
  const first = letter.id;
  E.tick(c.GM);
  assert.equal(letter.id, first);
});

test('prune keeps current laws but still drops finished one-offs after the retention window', () => {
  const c = world(100), E = c.TM.EdictEfficacy;
  c.GM._edictTracker.push(
    edict({ id: 'old-law', turn: 3, status: 'completed' }),                                            // 未判定：现行
    edict({ id: 'old-standing', turn: 4, status: 'completed', efficacy: { state: 'standing' } }),
    edict({ id: 'old-one-off', turn: 5, status: 'completed', efficacy: { state: 'one_off' } }),
    edict({ id: 'old-revoked', turn: 6, status: 'completed', efficacy: { state: 'revoked' } }),
    edict({ id: 'recent-one-off', turn: 90, status: 'completed', efficacy: { state: 'one_off' } }),
    edict({ id: 'old-open', turn: 7, status: 'obstructed', efficacy: { state: 'one_off' } }),
    edict({ id: 'this-turn', turn: 100, status: 'pending', efficacy: { state: 'one_off' } })
  );
  E.prune(c.GM, 24);
  assert.deepEqual(ids(c.GM._edictTracker), ['old-law', 'old-standing', 'recent-one-off', 'old-open', 'this-turn']);
});

test('turn prep delegates clock and pruning to the efficacy module', () => {
  const source = fs.readFileSync(path.join(WEB, 'tm-endturn-prep.js'), 'utf8');
  assert(source.includes('TM.EdictEfficacy.tick(GM)'));
  assert(source.includes('TM.EdictEfficacy.prune(GM,'));
  assert(!/content\.slice\(0,\s*400\)/.test(fs.readFileSync(path.join(WEB, 'tm-endturn-agent-mode.js'), 'utf8')), 'agent 模式登记诏令须存全文');
});

test('standing-edict prompt section carries full text of completed laws and skips this turn and one-offs', () => {
  const c = world(30), E = c.TM.EdictEfficacy;
  const tail = '唯旧田照常纳税，免税期内不得追征，违者以枉法论。';
  c.GM._edictTracker.push(
    edict({ id: 'law', turn: 3, status: 'completed', content: '免江南新垦田赋三年。' + tail }),
    edict({ id: 'sea', turn: 5, status: 'completed', content: '开海禁，许商民出洋贸易。', efficacy: { state: 'standing' } }),
    edict({ id: 'grant', turn: 6, status: 'completed', content: '拨内帑十万两赈陕西。', efficacy: { state: 'one_off' } }),
    edict({ id: 'repealed', turn: 7, status: 'completed', content: '加派辽饷。', efficacy: { state: 'revoked' } }),
    edict({ id: 'term', turn: 8, status: 'completed', content: '暂停漕粮改折。', efficacy: { state: 'term', untilTurn: 40 } }),
    edict({ id: 'now', turn: 30, status: 'pending', content: '本回合新诏。' })
  );
  const text = E.promptSection(c.GM, { excludeTurn: 30 });
  assert(text.includes('【现行诏制'));
  assert(text.includes(tail), '长诏尾部条款完整保留');
  assert(text.includes('#id=law 【未判定'));
  assert(text.includes('#id=sea 【常制'));
  assert(text.includes('#id=term 【有期至T40'));
  for (const gone of ['grant', 'repealed', 'now']) assert(!text.includes('#id=' + gone + ' '), gone + ' 不应出现');
});

test('over budget, every current law is still listed: full text first, the rest as digests', () => {
  const c = world(50), E = c.TM.EdictEfficacy;
  for (let i = 1; i <= 30; i++) {
    c.GM._edictTracker.push(edict({ id: 'L' + i, turn: i, status: 'completed', content: '第' + i + '道常制：' + '条文细目。'.repeat(40), efficacy: { state: 'standing', digest: '要点' + i } }));
  }
  const text = E.promptSection(c.GM, { maxChars: 3000 });
  for (let i = 1; i <= 30; i++) assert(text.includes('#id=L' + i + ' '), 'L' + i + ' 不能静默丢失');
  assert(text.includes('未展开全文'));
  assert(text.includes('要点30'), '未展开的用 AI 要点');
  assert(text.length < 3000 + 30 * 80, '总长受控：' + text.length);
});

test('memory compiler projects a completed-but-current edict and drops a finished one-off', () => {
  const { context } = require('./lib-memory-upgrade-r2');
  const c = context();
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-edict-efficacy.js'), 'utf8'), c, { filename: 'tm-edict-efficacy.js' });
  c.GM.turn = 40;
  c.GM._edictTracker = [
    edict({ id: 'law', turn: 3, status: 'completed', content: '免江南新垦田赋三年，不得追征。' }),
    edict({ id: 'grant', turn: 4, status: 'completed', content: '拨内帑十万两赈陕西。', efficacy: { state: 'one_off' } })
  ];
  const compiled = c.TM.MemoryContextCompiler.compileFromGM(c.GM, { GM: c.GM, turn: 40, audience: 'system', intent: 'turn_inference', maxTokens: 3000, perHitMaxChars: 240 });
  assert(compiled.text.includes('不得追征'), '现行诏令进入编译结果');
  assert(!compiled.text.includes('拨内帑十万两'), '已了结的一次性诏令不再当现行法令');
});

test('main inference and agent mode both read the standing section', () => {
  const ai = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');
  assert(/TM\.EdictEfficacy\.promptSection\(GM, \{ excludeTurn: GM\.turn \}\)/.test(ai));
  const agent = fs.readFileSync(path.join(WEB, 'tm-endturn-agent-mode.js'), 'utf8');
  assert(/_standingEdicts = \(TM\.EdictEfficacy\.promptSection\(gm, \{ excludeTurn: resolutionTurn \}\) \+ TM\.EdictEfficacy\.feedbackGuide\(gm, \{ tool: 'judge_edict' \}\)\)/.test(agent));
  assert(/standing: _standingEdicts/.test(agent) && /_bParts\.standing/.test(agent), 'agent 基线拼装带上现行诏制');
  assert(!/if \(_agentEdictOversightOn\(P\)\)[^\n]*_standingEdicts/.test(agent), '不受督查开关限制');
});

test('AI judgment records standing, term and one-off with digest and history', () => {
  const c = world(12), E = c.TM.EdictEfficacy;
  const law = edict({ id: 'law', turn: 12 });
  c.GM._edictTracker.push(law);
  E.judge(c.GM, law, { efficacy: '常制', digest: '江南新垦田免赋三年，不得追征' });
  assert.equal(law.efficacy.state, 'standing');
  assert.equal(law.efficacy.digest, '江南新垦田免赋三年，不得追征');
  assert.equal(law.efficacy.judgedTurn, 12);
  E.judge(c.GM, law, { efficacy: 'term', until: '三年' });
  assert.equal(law.efficacy.state, 'term');
  assert.equal(law.efficacy.untilTurn, 12 + 36 - 1, '每回合 30 日时三年为 36 回合');
  assert.equal(law.efficacy.digest, '江南新垦田免赋三年，不得追征', '未给新要点时保留旧要点');
  assert.equal(law.efficacy.history.at(-1).state, 'standing', '改判留痕');
  const grant = edict({ id: 'grant', turn: 12, content: '拨内帑十万两赈陕西。' });
  c.GM._edictTracker.push(grant);
  E.judge(c.GM, grant, { efficacy: 'one_off' });
  assert.equal(E.isCurrent(grant, 12), false);
});

test('term parsing follows days per turn and keeps unparseable terms without auto-expiry', () => {
  const c = world(10), E = c.TM.EdictEfficacy;
  assert.equal(E.untilTurnOf(10, '至T40'), 40);
  assert.equal(E.untilTurnOf(10, '第25回合'), 25);
  assert.equal(E.untilTurnOf(10, 5), 14);
  assert.equal(E.untilTurnOf(10, '十个月'), 19);
  assert.equal(E.untilTurnOf(10, '两年'), 33);
  c._getDaysPerTurn = () => 90;   // 一回合一季
  assert.equal(E.untilTurnOf(10, '三年'), 21);
  assert.equal(E.untilTurnOf(10, '半年'), 11);
  assert.equal(E.untilTurnOf(10, '待秋后'), null);
  const e = edict({ id: 'vague', turn: 10 });
  c.GM._edictTracker.push(e);
  E.judge(c.GM, e, { efficacy: 'term', until: '待秋后' });
  assert.equal(e.efficacy.state, 'term');
  assert.equal(e.efficacy.untilText, '待秋后');
  assert.equal(e.efficacy.untilTurn, undefined);
  c.GM.turn = 99;
  assert.equal(E.isCurrent(e, 99), true, '期限无法解析时不自动到期，由 AI 日后报 expired');
  E.judge(c.GM, e, { efficacy: 'expired' });
  assert.equal(E.isCurrent(e, 99), false);
});

test('ended edicts cannot be revived by feedback, and only term edicts can be reported expired', () => {
  const c = world(20), E = c.TM.EdictEfficacy;
  const repealed = edict({ id: 'repealed', efficacy: { state: 'revoked' } });
  const standing = edict({ id: 'standing', efficacy: { state: 'standing' } });
  const withdrawn = edict({ id: 'withdrawn', status: 'cancelled', efficacy: { state: 'standing' } });
  c.GM._edictTracker.push(repealed, standing, withdrawn);
  E.judge(c.GM, repealed, { efficacy: 'standing', digest: '复行' });
  assert.equal(repealed.efficacy.state, 'revoked');
  assert.equal(repealed.efficacy.digest, undefined);
  E.judge(c.GM, standing, { efficacy: 'expired' });
  assert.equal(standing.efficacy.state, 'standing');
  assert.equal(E.isCurrent(withdrawn, 20), false, '执行状态已撤回的诏令不算现行');
});

test('only a newly issued edict can revoke or supersede an older current one', () => {
  const c = world(30), E = c.TM.EdictEfficacy;
  const tax = edict({ id: 'tax', turn: 5, status: 'completed', efficacy: { state: 'standing' } });
  const sea = edict({ id: 'sea', turn: 6, status: 'completed' });
  const oldReport = edict({ id: 'old', turn: 10, status: 'executing' });
  const later = edict({ id: 'later', turn: 29, status: 'completed' });
  const fresh = edict({ id: 'fresh', turn: 30, content: '罢江南免赋之令，复征如旧；另开新海禁章程。' });
  c.GM._edictTracker.push(tax, sea, oldReport, later, fresh);
  E.judge(c.GM, oldReport, { revokes: ['sea'] });
  assert.equal(E.isCurrent(sea, 30), true, '旧诏追报时不能顺手废止别的诏令');
  E.judge(c.GM, fresh, { efficacy: 'standing', revokes: ['tax', 'ghost', 'fresh'], supersedes: 'sea' });
  assert.equal(tax.efficacy.state, 'revoked');
  assert.equal(tax.efficacy.endedBy, 'fresh');
  assert.equal(sea.efficacy.state, 'superseded');
  assert.equal(E.isCurrent(fresh, 30), true, '不能废止自己');
  E.judge(c.GM, later, { revokes: ['fresh'] });
  assert.equal(E.isCurrent(fresh, 30), true, '不能废止比自己更新的诏令');
});

test('feedback guide asks for judgments only when something is unjudged', () => {
  const c = world(40), E = c.TM.EdictEfficacy;
  c.GM._edictTracker.push(edict({ id: 'done', turn: 3, efficacy: { state: 'standing' } }));
  assert.equal(E.feedbackGuide(c.GM), '');
  for (let i = 0; i < 12; i++) c.GM._edictTracker.push(edict({ id: 'legacy' + i, turn: 10 + i, status: 'completed' }));
  c.GM._edictTracker.push(edict({ id: 'now', turn: 40, content: '开海禁，许商民出洋贸易，货税十抽二。' }));
  const guide = E.feedbackGuide(c.GM, { maxUnjudged: 5 });
  assert(guide.includes('edict_feedback'));
  assert(guide.includes('#legacy0') && guide.includes('#legacy4') && !guide.includes('#legacy5'), '积压的旧诏每回合只点名最早几道');
  const agentGuide = E.feedbackGuide(c.GM, { tool: 'judge_edict' });
  assert(agentGuide.includes('judge_edict') && agentGuide.includes('本回合新诏 #id=now'), 'agent 版列出本回合新诏编号');
});

test('agent judge_edict tool shares the same judgment path', () => {
  const { ROOT } = require('./smoke-endturn-baseline-helpers');
  require(path.join(WEB, 'tm-edict-efficacy.js'));
  require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
  require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
  const WT = globalThis.TM.Endturn.AgentWriteTools;
  assert(WT.isToolName('judge_edict'));
  const gm = { turn: 8, _turnReport: [], _edictTracker: [
    edict({ id: 'old-levy', turn: 2, status: 'completed', efficacy: { state: 'standing' } }),
    edict({ id: 'new-edict', turn: 8, content: '停辽饷加派，改由内帑协济。' })
  ] };
  const r = WT.handleSync('judge_edict', { edictId: 'new-edict', efficacy: 'standing', digest: '停辽饷加派', revokes: ['old-levy'], reason: '玩家明诏' }, { GM: gm });
  assert.equal(r.ok, true, r.text);
  assert.equal(gm._edictTracker[1].efficacy.state, 'standing');
  assert.equal(gm._edictTracker[0].efficacy.state, 'revoked');
  assert(gm._turnReport.some(x => x.type === 'edict_efficacy'), '写入回合报告');
  const missing = WT.handleSync('judge_edict', { edictId: 'nope', efficacy: 'standing' }, { GM: gm });
  assert.equal(missing.ok, false);
});

test('main inference applies efficacy only on exact matches', () => {
  const apply = fs.readFileSync(path.join(WEB, 'tm-endturn-apply.js'), 'utf8');
  assert(/_efficacyUnsure = !!tracker;/.test(apply), '兜底匹配时标记不确定');
  assert(/if \(!_efficacyUnsure && TM && TM\.EdictEfficacy\) TM\.EdictEfficacy\.judge\(GM, tracker, ef\);/.test(apply));
  const ai = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');
  assert(/tp1 \+= '  #id=' \+ e\.id \+ ' 【' \+ e\.category \+ '】' \+ e\.content;/.test(ai), '本回合诏令带编号');
  assert(/TM\.EdictEfficacy\.feedbackGuide\(GM\)/.test(ai), '主推演附判定说明');
});

test('crowded memory budget keeps every current law, full clauses and pinned imperial rows', () => {
  // 诊断场景：100 个人物 + 24 道现行诏令，均衡档 3000 tokens；改动前只进 1 道、长条款尾部丢失、皇命表数组行为空
  const { context } = require('./lib-memory-upgrade-r2');
  const c = context();
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-edict-efficacy.js'), 'utf8'), c, { filename: 'tm-edict-efficacy.js' });
  c.GM.turn = 40;
  c.GM.chars = Array.from({ length: 100 }, (_, i) => ({ id: 'p' + i, name: '官员' + i, alive: true, position: '地方官', officialTitle: '知府', loyalty: 50 }));
  c.GM._edictTracker = Array.from({ length: 24 }, (_, i) => ({
    id: 'law' + i, turn: 2 + i, category: '政令', status: i % 2 ? 'completed' : 'executing',
    content: '第' + i + '号常制：' + '某项细则照旧推行，'.repeat(i === 0 ? 30 : 3) + (i === 0 ? '唯边军驻防款不得挪用，违者以枉法论。' : '')
  }));
  c.GM._memTables = { imperialEdict: { rows: [[9, '皇命：宗室禄米减半，永为定制。', '即日起', 3, ''], [8, '天机：密令锦衣卫监视某藩。', '', 4, 'true']] } };
  const text = c.TM.MemoryContextCompiler.compileFromGM(c.GM, { GM: c.GM, turn: 40, audience: 'system', intent: 'turn_inference', maxTokens: 3000, perHitMaxChars: 240 }).text;
  const lawsIn = Array.from({ length: 24 }, (_, i) => text.includes('第' + i + '号常制')).filter(Boolean).length;
  assert.equal(lawsIn, 24, '现行诏令不被人物名单挤掉：' + lawsIn + '/24');
  assert(text.includes('不得挪用'), '长条款尾部的例外保留');
  assert(text.includes('宗室禄米减半'), '皇命表数组行可读');
  const hidden = c.TM.MemoryEnvelope.imperialEdictRecord([8, '天机：密令锦衣卫监视某藩。', '', 4, 'true']);
  assert.equal(hidden.visibility, 'gm_only');
  assert.equal(hidden.readScope, 'system');
  const open = c.TM.MemoryEnvelope.imperialEdictRecord([9, '皇命：宗室禄米减半。', '', 3, '']);
  assert.equal(open.visibility, undefined, '非天机条目沿用读取方默认可见性');
});

console.log(JSON.stringify({ passed, failed }));
process.exitCode = failed ? 1 : 0;
