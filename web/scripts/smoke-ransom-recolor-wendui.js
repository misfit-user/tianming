// smoke-ransom-recolor-wendui.js — 批五三刀（2026-07-21·赎驾链/占据覆色/受抚渠帅入问对）
//
// 刀A 占据覆色：factionColors 条目须为 {main,...} 对象(裸字符串被 updateMapColors 取 .main
//   渲成灰=批三真bug已修)·渲染层 updateMapColors 挂 occupiedBy 走表+压轴覆色(静态契约验)。
// 刀C 赎驾链(北狩残局最小闭环)：ransom_demand 须真挟君·release_captive 三闸(挟君+赎驾旨+
//   帑廪真扣)·放还真放(_captured 清)。
// 刀B 受抚渠帅：授官落位京师(问对在京判定可召对)·举旗往事入 NpcMemorySystem(召对有据)。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

var memSeeds = [];
var DIVS = { '凤阳府': { name: '凤阳府', militaryRecruits: 3000, minxin: 20 } };
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox._ebs = [];
sandbox.addEB = function (cat, msg) { sandbox._ebs.push(cat + '·' + msg); };
sandbox.NpcMemorySystem = { addMemory: function (name, text, w, catg) { memSeeds.push({ name: name, text: text, catg: catg }); } };
sandbox.TM = { AIChange: { PathUtils: { findDivisionByNameFuzzy: function (G, n) { return DIVS[String(n || '').trim()] || null; } } } };
sandbox.GM = {
  turn: 30,
  eraName: '社稷倾危',
  _capital: '顺天府',
  mapData: {},
  guoku: { balance: 400000, ledgers: { money: { stock: 400000 } } },
  facs: [{ id: 'f1', name: '大明', strength: 60, playerRelation: 100 }],
  chars: [{ name: '朱由检', isPlayer: true, alive: true }],
  armies: [],
  minxin: {
    trueIndex: 25,
    revolts: [{ id: 'rvR', region: '凤阳', status: 'ongoing', level: 5, scale: 1000000, turn: 20,
      _identity: { banner: '闯字营', leaderName: '高闯王', leaderFrom: 'new', creed: '均田免赋', stance: '挟众自重', agenda: '问鼎' } }]
  },
  _edictTracker: [],
  _chronicle: []
};
sandbox.P = { conf: { revoltEntityEnabled: true } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-entity.js'), 'utf8'), sandbox, { filename: 'tm-revolt-entity.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-inference.js'), 'utf8'), sandbox, { filename: 'tm-revolt-inference.js' });

var GM = sandbox.GM;
var RE = sandbox.TM.RevoltEntity;
var RI = sandbox.TM.RevoltInference;

console.log('① 覆色数据层：factionColors 条目=对象形状(裸字符串致灰之 bug 已修)');
RE.sync(GM);
var army = GM.armies.find(function (a) { return a._revoltEntity; });
RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'move', target: '凤阳府' }] }] });
RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'occupy', target: '凤阳府' }] }] });
var cEntry = GM.mapData.factionColors['闯字营'];
assert(DIVS['凤阳府'].occupiedBy === '闯字营', '占据落账(前提)');
assert(cEntry && typeof cEntry === 'object' && /^#/.test(cEntry.main || ''), '色条目={main:#hex,...} 对象·updateMapColors 可取 .main');
assert(/^rgba\(/.test(cEntry.alpha || ''), 'alpha=rgba 串(与剧本色派生形状同构)');

console.log('② 渲染层静态契约：updateMapColors 挂 occupiedBy 走表+压轴覆色');
var mapSrc = fs.readFileSync(path.join(ROOT, 'tm-map-system.js'), 'utf8');
assert(/_regionOccupiedMap/.test(mapSrc) && /d\.occupiedBy && Array\.isArray\(d\.mappedRegions\)/.test(mapSrc), '占据走表(division.occupiedBy→region.id)已挂');
assert(/义军占据覆色压轴/.test(mapSrc) && /region\.occupiedBy = _occ/.test(mapSrc), '压轴覆色+region.occupiedBy 标记已挂(退据自动还色)');

console.log('③ 挟君索赎：不挟君不得挟');
var r3 = RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'ransom_demand', silverDemand: 500000 }] }] });
assert(r3.blocked === 1, '未挟君 → ransom_demand 拦');
// 破京被俘(批四菜单)→挟君成立
RE._applyBreachOutcome(GM, GM.minxin.revolts[0], { fate: 'captured' });
var player = GM.chars[0];
assert(player._captured === true && player._capturedBy === '闯字营', '君上被执于「闯字营」');
assert(player._capturedLocation === '闯字营军中', '_capturedLocation 落位(endturn 社稷悬议段消费)');
var r3b = RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'ransom_demand', silverDemand: 500000, terms: '并索割凤阳为质' }] }] });
assert(r3b.applied === 1 && sandbox._ebs.some(function (e) { return e.indexOf('挟君上以令朝廷') >= 0; }), '挟君索赎落起居注');
assert(GM._chronicle.some(function (c) { return String(c.text).indexOf('挟君索赎') >= 0; }), '要挟入史(玩家可据以下旨)');

console.log('④ 放还三闸：无赎驾旨拦·帑廪不足败局·银足真放');
var r4 = RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'release_captive', silverDemand: 300000 }] }] });
assert(r4.blocked === 1 && player._captured === true, '无赎驾旨 → 不得放还(宪法)');
GM._edictTracker.push({ turn: 31, category: '国变', content: '倾内帑以赎圣驾·着有司速办迎銮' });
var r4b = RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'release_captive', silverDemand: 500000 }] }] });
assert(r4b.blocked === 1 && player._captured === true && GM.guoku.balance === 400000, '索赎50万>帑廪40万 → 赎局败·分文未动·君仍在贼营');
assert(sandbox._ebs.some(function (e) { return e.indexOf('赎局遂败') >= 0; }), '败局有诚实叙事');
var r4c = RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'release_captive', silverDemand: 350000 }] }] });
assert(player._captured === false && !player._capturedBy && !player._capturedLocation, '银足 → 銮驾真还(_captured 全清)');
assert(GM.guoku.balance === 50000 && GM.guoku.ledgers.money.stock === 50000, '赎银 35 万真扣+stock 同步');
assert(sandbox._ebs.some(function (e) { return e.indexOf('銮驾得还') >= 0; }), '还驾落起居注');

console.log('⑤ 受抚渠帅入朝：落位京师(可召对)+往事入记忆');
GM._edictTracker.push({ turn: 32, category: '政事', content: '招抚凤阳流贼·许以官爵' });
RI._applyActions(GM, { stocks: [{ id: 'rvR', actions: [{ type: 'pacify_accept', silverDemand: 30000, officeTitle: '游击将军' }] }] });
assert(GM.minxin.revolts[0].status === 'pacified', '受抚成局(前提)');
RE.sync(GM);
var leader = GM.chars.find(function (c) { return c.name === '高闯王'; });
assert(leader && leader._revoltPacified === true && leader.officialTitle === '游击将军', '渠帅授官入朝');
assert(leader.location === '顺天府', '落位 GM._capital(问对在京判定 → 可召对)');
assert(leader._revoltPast && leader._revoltPast.banner === '闯字营', '_revoltPast 留档(banner/抚银/授官)');
assert(memSeeds.some(function (m) { return m.name === '高闯王' && m.text.indexOf('闯字营') >= 0 && m.catg === 'career'; }), '举旗受抚往事入 NPC 记忆(career)');
assert(memSeeds.some(function (m) { return m.name === '高闯王' && m.catg === 'political'; }), '居朝心态入 NPC 记忆(political·召对 AI 有据)');
assert(!DIVS['凤阳府'].occupiedBy, '受抚 → 占据解除(覆色随 updateMapColors 自动还色)');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-ransom-recolor-wendui: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-ransom-recolor-wendui (色对象修形/渲染契约/挟君闸/赎驾三闸/真放人/受抚入朝记忆落位)');
