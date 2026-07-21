// smoke-revolt-inference.js — 民变演绎层（批三·2026-07-21·AI 主导·宪法闸落账）
//
// owner 重批落地：身份与行为交 AI(起号立领袖 subcall+逐回合行为 subcall)·引擎只验不产。
// 本 smoke 不经真 AI：直接灌 canned 决策进 _applyActions·验全部宪法闸——
// 身份具象化(真旗号/真渠帅)/锻造缓拍/占府闸(师未至·兵力不敌)/裹挟封顶/分裂封5/合流/
// 僭号建国(交AI宪法只记账)/招抚闸(无旨不受抚·帑廪真扣·不足则败局)/受抚清账(授官·解占据)。
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

var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox._ebs = [];
sandbox.addEB = function (cat, msg) { sandbox._ebs.push(cat + '·' + msg); };
var DIVS = {
  '凤阳府': { name: '凤阳府', militaryRecruits: 3000, minxin: 20 },
  '庐州府': { name: '庐州府', militaryRecruits: 40000, minxin: 30 }
};
sandbox.TM = { AIChange: { PathUtils: { findDivisionByNameFuzzy: function (G, n) { return DIVS[String(n || '').trim()] || null; } } } };
sandbox.GM = {
  turn: 6,
  eraName: '天下将乱',
  mapData: {},
  guoku: { balance: 250000, ledgers: { money: { stock: 250000 } } },
  facs: [{ id: 'f1', name: '大明', strength: 70, economy: 60, playerRelation: 100 }],
  chars: [{ name: '朱由校', isPlayer: true, alive: true }],
  armies: [],
  minxin: {
    trueIndex: 30,
    revolts: [{ id: 'rvA', region: '凤阳', status: 'ongoing', level: 4, scale: 200000, turn: 5,
      _identity: { banner: '闯字营', leaderName: '高闯王', leaderFrom: 'new', creed: '均田免赋', stance: '流动作战', agenda: '窥神京' } }]
  },
  _edictTracker: []
};
sandbox.P = { conf: { revoltEntityEnabled: true } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-entity.js'), 'utf8'), sandbox, { filename: 'tm-revolt-entity.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-inference.js'), 'utf8'), sandbox, { filename: 'tm-revolt-inference.js' });

var GM = sandbox.GM;
var RE = sandbox.TM.RevoltEntity;
var RI = sandbox.TM.RevoltInference;

console.log('① AI 锻造身份具象化：真旗号真渠帅(非模板)');
RE.sync(GM);
var fac = GM.facs.find(function (f) { return f._revoltEntity; });
var army = GM.armies.find(function (a) { return a._revoltEntity; });
var leader = GM.chars.find(function (c) { return c._revoltEntity; });
assert(!!fac && fac.name === '闯字营', '旗号=AI 锻造「闯字营」(非「凤阳义军」模板)');
assert(!!leader && leader.name === '高闯王', '渠帅=AI 立的「高闯王」');
assert(!!army && army.commander === '高闯王', '军主帅=渠帅');

console.log('② 身份锻造中缓拍(双轨)');
GM.minxin.revolts.push({ id: 'rvB', region: '山东', status: 'ongoing', level: 3, scale: 30000, turn: 6, _identityPending: 6 });
RE.sync(GM);
assert(!GM.facs.some(function (f) { return f._revoltEntity && f.sourceRevoltId === 'rvB'; }), '锻造中(_identityPending)→本回合不具象化');
GM.turn = 8;
RE.sync(GM);
assert(GM.facs.some(function (f) { return f._revoltEntity && f.sourceRevoltId === 'rvB' && f.name === '山东义军'; }), '锻久未成→模板兜底具象化(双轨)');

console.log('③ 占府宪法闸：师未至/兵力不敌皆拦·合规才易手');
army.location = '陕西'; army.garrison = '陕西';  // 造真「师未至」态(驻地与目标府无涉)
var r1 = RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'occupy', target: '凤阳府' }] }] });
assert(r1.blocked === 1 && !DIVS['凤阳府'].occupiedBy, '师未至(驻陕西·图占凤阳府) → 拦·虚占无效');
RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'move', target: '凤阳府' }] }] });
RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'occupy', target: '凤阳府' }] }] });
assert(DIVS['凤阳府'].occupiedBy === '闯字营', '军至+兵力(60000≥2×3000+2000)→凤阳府真易手 occupiedBy');
assert((fac._occupiedDivs || []).indexOf('凤阳府') >= 0, '_occupiedDivs 记账');
assert(GM.mapData.factionColors && GM.mapData.factionColors['闯字营'], '势力色已注册(地图改色数据层就绪)');
var r3 = RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'move', target: '庐州府' }, { type: 'occupy', target: '庐州府' }] }] });
assert(!DIVS['庐州府'].occupiedBy, '兵力不敌(60000<2×40000+2000)→庐州府拦下·虚占无效');
assert(sandbox._ebs.some(function (e) { return e.indexOf('兵力不敌守备') >= 0; }), '拦下有诚实叙事');

console.log('④ 裹挟封顶 25%');
var before = army.soldiers;
RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'recruit', delta: 999999 }] }] });
assert(army.soldiers === before + Math.round(before * 0.25), '裹挟 999999 → 封顶 +25%');

console.log('⑤ 僭号建国(时机交AI·宪法只记账)');
RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'proclaim', stateName: '大顺' }] }] });
assert(fac.isState === true && fac.stateName === '大顺', '建国落账 isState/国号');
assert(leader.officialTitle === '「大顺」僭号之主', '渠帅称制');
var r5b = RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'proclaim', stateName: '再建' }] }] });
assert(r5b.blocked === 1 && fac.stateName === '大顺', '重复建国拦');

console.log('⑥ 分裂(封5)与合流');
RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'split', banner: '曹字营', leaderName: '罗曹操', creed: '就食于敌', target: '河南' }] }] });
var srv = GM.minxin.revolts.find(function (r) { return r._aiBorn; });
assert(!!srv && srv._identity && srv._identity.banner === '曹字营', '分裂生新股(带 AI 身份)');
RE.sync(GM);
var fac2 = GM.facs.find(function (f) { return f._revoltEntity && f.sourceRevoltId === srv.id; });
assert(!!fac2 && fac2.name === '曹字营', '新股次回合具象化「曹字营」');
RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'merge', target: srv.id }] }] });
assert(srv.status === 'dispersed' && srv._mergedInto === 'rvA', '合流：目标股散·记 _mergedInto');
RE.sync(GM);
assert(!GM.facs.some(function (f) { return f.sourceRevoltId === srv.id; }), '被并股实体清账');

console.log('⑦ 招抚宪法闸：无旨不受抚·帑廪真扣·不足败局');
var r7 = RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'pacify_accept', silverDemand: 100000 }] }] });
assert(r7.blocked === 1 && GM.minxin.revolts[0].status === 'ongoing', '无招抚旨 → 不得自称受抚');
GM._edictTracker.push({ turn: 9, category: '政事', content: '着有司招抚凤阳流贼·许以自新' });
var r7b = RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'pacify_accept', silverDemand: 300000, officeTitle: '游击将军' }] }] });
assert(r7b.blocked === 1 && GM.minxin.revolts[0].status === 'ongoing' && GM.guoku.balance === 250000, '索银30万>帑廪25万 → 抚局败·分文未动');
assert(sandbox._ebs.some(function (e) { return e.indexOf('帑廪不给') >= 0; }), '败局有诚实叙事');
var r7c = RI._applyActions(GM, { stocks: [{ id: 'rvA', actions: [{ type: 'pacify_accept', silverDemand: 200000, officeTitle: '游击将军' }] }] });
assert(GM.minxin.revolts[0].status === 'pacified' && GM.guoku.balance === 50000, '索银20万 → 真扣·受抚成局');
assert(GM.guoku.ledgers.money.stock === 50000, 'money.stock 同步(镜像 openGranary 范式)');

console.log('⑧ 受抚清账：授官·解占据·非溃散');
RE.sync(GM);
assert(leader._revoltPacified === true && leader.officialTitle === '游击将军', '渠帅得授讨来的官职(非「溃散流亡」)');
assert(!GM.facs.some(function (f) { return f.sourceRevoltId === 'rvA'; }), '受抚势力除档');
assert(!DIVS['凤阳府'].occupiedBy, '受抚 → 凤阳府占据解除归还');
assert(sandbox._ebs.some(function (e) { return e.indexOf('受抚罢兵') >= 0; }), '受抚落起居注');

console.log('⑨ 招抚旨匹配器');
var eds = RI._recentPacifyEdicts(GM, { fac: { name: '曹字营' }, r: { region: '河南' }, leader: { name: '罗曹操' } });
assert(eds.length >= 1, '泛旨「招抚…流贼」对任一股可见(点名语义交 AI 读原文)');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-revolt-inference: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-revolt-inference (AI身份具象化/缓拍双轨/占府闸/裹挟顶/建国记账/分合/招抚三闸/受抚清账)');
