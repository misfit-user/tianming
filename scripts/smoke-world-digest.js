/*
 * smoke-world-digest.js — 天下牵动·因果综述（W1a）回归
 * node scripts/smoke-world-digest.js
 */
global.window = global;
var WD = require('../tm-world-digest.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function setup() {
  global.GM = {
    turn: 10,
    _chronicle: [
      { turn: 10, type: '军事↔势力', text: '后金军胜·辽东镇 strength-5', tags: ['联动', '军事', '势力'] },
      { turn: 10, type: '势力↔党派', text: '东林失势·清流党 cohesion-30', tags: ['联动'] },
      { turn: 10, type: '日常', text: '寻常起居·非联动', tags: ['起居'] },
      { turn: 3, type: '军事↔势力', text: '旧回合·应排除', tags: ['联动'] }
    ],
    _socialPoliticalSignals: { items: [
      { turn: 10, sourceSystem: 'minxin', kind: 'unrest', reason: '辽饷加派民不堪命', intensity: 8, affectedClasses: [{ name: '农户' }, { name: '流民' }], affectedParties: [] },
      { turn: 10, sourceSystem: 'building', kind: 'globalrule', reason: '实学之制推行', intensity: 5, affectedClasses: [{ name: '士绅' }], affectedParties: [] },
      { turn: 10, sourceSystem: 'fiscal', kind: 'tax', reason: '微弱信号', intensity: 1, affectedClasses: [{ name: '商贾' }], affectedParties: [] },
      { turn: 3, sourceSystem: 'minxin', kind: 'old', reason: '旧信号应排除', intensity: 9, affectedClasses: [{ name: '农户' }], affectedParties: [] }
    ] }
  };
}

// 1·collect 只收本回合内（turnsBack=1）
setup();
var items = WD.collect(GM, { turnsBack: 1 });
ok(items.every(function (it) { return it.turn === 10; }), 'collect 排除旧回合条目');
ok(!items.some(function (it) { return /应排除|寻常/.test(it.line); }), '非联动 chronicle + 旧信号被排除');

// 2·跨系统联动 chronicle 被收
ok(items.some(function (it) { return it.domain === '军事↔势力' && /辽东镇/.test(it.line); }), '军事↔势力 联动被收');
ok(items.some(function (it) { return it.domain === '势力↔党派'; }), '势力↔党派 联动被收');

// 3·社政信号重组为「因 → 牵动谁」+ 域映射
ok(items.some(function (it) { return it.domain === '民心' && /辽饷加派.*→ 牵动 农户、流民/.test(it.line); }), '社政信号重组为因果行');
ok(items.some(function (it) { return it.domain === '风气'; }), 'building 源 → 风气域');
ok(WD._domainOf('huangwei') === '皇权' && WD._domainOf('army') === '军事' && WD._domainOf('huji') === '户口', '域映射正确');

// 4·intensity 排序 + spLimit
setup();
var lim = WD.collect(GM, { turnsBack: 1, spLimit: 1 });
var spItems = lim.filter(function (it) { return /→ 牵动/.test(it.line); });
ok(spItems.length === 1 && /辽饷加派/.test(spItems[0].line), 'spLimit + 按 intensity 取最要者');

// 5·promptBlock 按域分组 + 空则返空
setup();
var block = WD.promptBlock(GM, { turnsBack: 1 });
ok(block.indexOf('天下牵动') >= 0 && block.indexOf('[军事↔势力]') >= 0 && block.indexOf('[民心]') >= 0, 'promptBlock 按域分组');
global.GM = { turn: 10, _chronicle: [], _socialPoliticalSignals: { items: [] } };
ok(WD.promptBlock(GM, { turnsBack: 1 }) === '', '无反应则返空（不污染 prompt）');

// 6·去重
global.GM = { turn: 5, _chronicle: [
  { turn: 5, type: '军事↔势力', text: '同条', tags: ['联动'] },
  { turn: 5, type: '军事↔势力', text: '同条', tags: ['联动'] }
], _socialPoliticalSignals: { items: [] } };
ok(WD.collect(GM, { turnsBack: 1 }).length === 1, '同域同文去重');

// 7·W1b·_couplingReport 折进综述（剥前缀/尾注·标 [时局联动]）
setup();
GM._couplingReport = '【状态联动参考】民负过重→建议minxin-2(当前60)；边患加剧→建议borderThreat+3(当前40)。以上仅为参考，AI可根据实际局势自行决定实际变化幅度。';
var b7 = WD.promptBlock(GM, { turnsBack: 1 });
ok(b7.indexOf('[时局联动]') >= 0 && b7.indexOf('民负过重→建议minxin-2') >= 0, '_couplingReport 折进综述');
ok(b7.indexOf('【状态联动参考】') < 0 && b7.indexOf('以上仅为参考') < 0, '剥去前缀与尾注');

// 8·仅有 coupling、无 items 时也渲染（不漏耦合）
global.GM = { turn: 5, _chronicle: [], _socialPoliticalSignals: { items: [] }, _couplingReport: '【状态联动参考】钱荒→建议commerce-1(当前30)。以上仅为参考，AI可自行决定。' };
var b8 = WD.promptBlock(GM, { turnsBack: 1 });
ok(b8.indexOf('天下牵动') >= 0 && b8.indexOf('钱荒→建议commerce-1') >= 0, '仅耦合也渲染综述');

// 9·无 coupling 字符串不报错
global.GM = { turn: 5, _chronicle: [], _socialPoliticalSignals: { items: [] } };
ok(WD.promptBlock(GM, { turnsBack: 1 }) === '', '无 coupling 且无 items 返空');

// 10·W1c·真因果链：信号带 cause → 渲成「因 →致 果 → 牵动谁」三环链
global.GM = { turn: 8, _chronicle: [], _socialPoliticalSignals: { items: [
  { turn: 8, sourceSystem: 'fiscal', kind: 'levy', cause: '边镇军费缺口', reason: '加派辽饷', intensity: 7, affectedClasses: [{ name: '农户' }, { name: '流民' }], affectedParties: [] },
  { turn: 8, sourceSystem: 'minxin', kind: 'unrest', reason: '无上游因·只渲果', intensity: 5, affectedClasses: [{ name: '士绅' }], affectedParties: [] }
] } };
var c10 = WD.collect(GM, { turnsBack: 1 });
var chain = c10.filter(function (it) { return /加派辽饷/.test(it.line); })[0];
ok(chain && /边镇军费缺口 →致 加派辽饷 → 牵动 农户、流民/.test(chain.line), '带 cause → 因→致→果→牵动 三环链');
var plain = c10.filter(function (it) { return /无上游因/.test(it.line); })[0];
ok(plain && plain.line.indexOf('→致') < 0 && /无上游因·只渲果 → 牵动 士绅/.test(plain.line), '无 cause → 仍渲果→牵动（不强插→致）');

// 11·W4·趋势预演 previewBlock：扫濒危态前瞻「若不干预将如何牵动」
global.GM = {
  turn: 20,
  classes: [{ name: '流民', satisfaction: 14 }, { name: '士绅', satisfaction: 70 }],
  minxin: { trueIndex: 24 },
  guoku: { balance: -50000, trend: 'down', bankruptcy: { active: false } },
  corruption: { trueIndex: 78 },
  huangwei: { index: 26 },
  huangquan: { powerMinister: { name: '魏忠贤' } },
  _activePlots: [{ ringleader: '温体仁', stage: 'ripe' }]
};
var pv = WD.previewBlock(GM, { limit: 4 });
ok(/天下气运·若不干预之趋势/.test(pv) && /逆之即「改命」/.test(pv), 'previewBlock 头部·逆天改命主轴');
ok(/\[阶层\] 流民 满意 14·已濒离心/.test(pv), '阶层濒危（流民 14）入预演');
ok(/\[民心\]/.test(pv) && /\[财政\]|\[吏治\]|\[皇权\]|\[阴谋\]/.test(pv), '多域濒危态被收');
ok(pv.split('\n').filter(function (l) { return /^· \[/.test(l); }).length <= 4, 'limit=4·至多4条（不过载）');
ok(pv.indexOf('士绅') < 0, '健康项（士绅 70）不入预演');
// 严重度排序：流民满意14(sev86) 应在前；powerMinister 取 .name 不报错
ok(/魏忠贤/.test(WD.previewBlock(GM, { limit: 8 })), '权臣 powerMinister.name（对象形）正确解析');
// 全健康 → 返空不污染
global.GM = { turn: 20, classes: [{ name: '农户', satisfaction: 60 }], minxin: { trueIndex: 65 }, guoku: { balance: 90000, trend: 'up' }, corruption: { trueIndex: 28 }, huangwei: { index: 66 }, huangquan: {} };
ok(WD.previewBlock(GM) === '', '太平无濒危 → 返空（不污染 prompt）');

console.log('\nsmoke-world-digest: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
