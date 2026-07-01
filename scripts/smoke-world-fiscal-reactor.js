/*
 * smoke-world-fiscal-reactor.js — 世界反应总线·财政→民心/阶层（W2b·treasury-strain emitter）
 *   + 与 WorldDigest 因果链（W2c·cause→致→果→牵动）端到端回归
 * node scripts/smoke-world-fiscal-reactor.js
 *
 * W2b 不在 tm-world-reactors.js（那是军事→势力·无活路径才另起）；财政→阶层走已活的
 *   scanRuntimePressures 新增 treasury-strain emitter（复用去重/applyPending/inferClassImpacts）。
 */
global.window = global;
global.TM = global.TM || {};
var SPS = require('../tm-social-political-signals.js');
var WD = require('../tm-world-digest.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

function baseClasses() {
  return [
    { name: '流民', tags: ['refugee', 'displaced', '流民', '灾民', '贫'], satisfaction: 40, influence: 20, demands: '赈济救荒' },
    { name: '农户', tags: ['peasant', 'rural', '农', '民', '税'], satisfaction: 58, influence: 45, demands: '减赋' },
    { name: '士绅', tags: ['gentry', 'scholar', '绅', '士'], satisfaction: 62, influence: 60, demands: '清议' }
  ];
}

// ── 1·破产态 → treasury-strain 触发，牵动流民/农户 ──
var G1 = { turn: 12, classes: baseClasses(), guoku: { balance: 50000, annualIncome: 960000, bankruptcy: { active: true, severity: 0.9 } } };
var s1 = SPS.scanRuntimePressures(G1, { source: 'smoke-fiscal' });
ok(s1.kinds.indexOf('treasury-strain') >= 0, '破产态 → treasury-strain 触发');
var sig1 = G1._socialPoliticalSignals.items.filter(function (x) { return x.kind === 'treasury-strain'; })[0];
ok(sig1 && sig1.cause === '帑廪告罄·国库破产', 'cause=帑廪告罄·国库破产（W2c 上游因）');
ok(sig1 && /府库一空|赈济停摆/.test(sig1.reason) && sig1.sourceSystem === 'smoke-fiscal', 'reason 述破产后果·sourceSystem 正确');
var who1 = (sig1.affectedClasses || []).map(function (c) { return c.name; });
ok(who1.indexOf('流民') >= 0 && who1.indexOf('农户') >= 0, '牵动流民+农户');
ok(who1.indexOf('士绅') < 0, '不误伤无关阶层（士绅）');

// ── 2·赤字态（余额为负·赤字率≥阈值）→ 触发，cause=国库赤字 ──
var G2 = { turn: 12, classes: baseClasses(), guoku: { balance: -300000, annualIncome: 960000, bankruptcy: { active: false } } };
var s2 = SPS.scanRuntimePressures(G2, { source: 'smoke-fiscal' });
var sig2 = G2._socialPoliticalSignals.items.filter(function (x) { return x.kind === 'treasury-strain'; })[0];
ok(sig2 && sig2.cause === '国库赤字·岁入不抵岁出', '赤字态 cause=国库赤字·岁入不抵岁出');

// ── 3·余额健康（无破产·无赤字）→ 不触发（不污染） ──
var G3 = { turn: 12, classes: baseClasses(), guoku: { balance: 800000, annualIncome: 960000, bankruptcy: { active: false } } };
var s3 = SPS.scanRuntimePressures(G3, { source: 'smoke-fiscal' });
ok(s3.kinds.indexOf('treasury-strain') < 0, '国库健康 → 不触发');

// ── 4·小额赤字（赤字率<阈值 0.15）→ 不触发 ──
var G4 = { turn: 12, classes: baseClasses(), guoku: { balance: -50000, annualIncome: 960000, bankruptcy: { active: false } } };
var s4 = SPS.scanRuntimePressures(G4, { source: 'smoke-fiscal' });
ok(s4.kinds.indexOf('treasury-strain') < 0, '小额赤字（<15% 年入）→ 不触发');

// ── 5·去重：同回合同源同 kind 不重复 ──
var s1b = SPS.scanRuntimePressures(G1, { source: 'smoke-fiscal' });
ok(s1b.kinds.indexOf('treasury-strain') < 0, '同回合同源 → treasury-strain 去重不重复');

// ── 6·无 guoku → 不报错不触发（防御） ──
var G6 = { turn: 12, classes: baseClasses() };
var s6 = SPS.scanRuntimePressures(G6, { source: 'smoke-fiscal' });
ok(s6.kinds.indexOf('treasury-strain') < 0, '无 guoku → 安全不触发');

// ── 7·applyPending：treasury-strain 经 gateSatisfaction 落账（流民满意度降） ──
var before = G1.classes[0].satisfaction;
SPS.applyPending(G1, { turn: 12, source: 'smoke-fiscal-apply' });
ok(G1.classes[0].satisfaction < before, 'applyPending → 流民满意度下降（确定性落账·走 gate）');

// ── 8·W2c 端到端：treasury-strain 信号经 WorldDigest 渲成「因→致→果→牵动」三环链 ──
var GD = { turn: 12, classes: baseClasses(), guoku: { balance: -300000, annualIncome: 960000, bankruptcy: { active: false } } };
SPS.scanRuntimePressures(GD, { source: 'fiscal' });
global.GM = GD;
var items = WD.collect(GD, { turnsBack: 1 });
var chain = items.filter(function (it) { return /国库赤字/.test(it.line) && /→致/.test(it.line); })[0];
ok(chain && /国库赤字·岁入不抵岁出 →致 赈济救荒无力.* → 牵动 /.test(chain.line), 'WorldDigest 渲「国库赤字 →致 赈济无力… → 牵动…」三环链');
ok(chain && /财政/.test(chain.domain), '归入「财政」因果域');

console.log('\nsmoke-world-fiscal-reactor: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
