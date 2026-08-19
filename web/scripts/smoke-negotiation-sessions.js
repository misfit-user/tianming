// smoke-negotiation-sessions.js — 谈判多轮会话引擎（批己·2026-07-22）
//
// 验：会话状态机(open 复用不重开/offers 追加/round 封3/fail-closed id 未命中返 null/玩家 counter 全流/
// 过期 lapse+僵尸使节清)·三生产者接线(revolt pacify_counter 开会话+prompt 注入段/border demand 开会话+
// settlePeace endWar+退兵+贡银走 spendFromGuoku/faction 提议挂会话)·flag OFF 三生产者旧行为等价(行为级)·
// save-lifecycle explicit mirror 登记契约(真源抽取)。不经真 AI：canned 动作直灌 _applyActions/_applyInvasionActions。
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
function load(sandbox, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}
function mkSandbox(extra) {
  var s = { console: console };
  s.window = s; s.global = s;
  s._ebs = [];
  s.addEB = function (cat, msg) { s._ebs.push(cat + '·' + msg); };
  s.robustParseJSON = function (t) { try { return JSON.parse(t); } catch (_) { return null; } };
  Object.keys(extra || {}).forEach(function (k) { s[k] = extra[k]; });
  vm.createContext(s);
  return s;
}

// ═══════════════════════════════════════════════════════════════
console.log('§A 会话状态机（tm-negotiation.js 独立）');
var A = mkSandbox({
  GM: { turn: 5, _pendingAudiences: [] },
  P: { conf: { negotiationSessionsEnabled: true } }
});
load(A, 'tm-negotiation.js');
var N = A.TM.Negotiation;
var GA = A.GM;

var s1 = N.open({ topic: 'pacify', initiator: '闯字营', sourceRef: { kind: 'revolt', refId: 'rvA' }, offer: { by: 'them', terms: '受抚索银十万', silver: 100000 }, turn: 5 });
assert(!!s1 && /^ng-5-\d+$/.test(s1.id), 'open 生成会话·id=ng-<turn>-<seq>');
assert(s1.status === 'open' && s1.round === 1 && s1.topic === 'pacify', '初始 open/round1/topic');
assert(s1.parties.responder === 'player' && s1.parties.initiator === '闯字营', 'parties.responder 恒为 player');
assert(s1.offers.length === 1 && s1.offers[0].by === 'them' && s1.offers[0].silver === 100000, '首 offer 落账(by them·silver)');
assert(s1.expireTurn === 5 + N.EXPIRE_TURNS, 'expireTurn=turn+4');

var s1b = N.open({ topic: 'pacify', initiator: '闯字营', sourceRef: { kind: 'revolt', refId: 'rvA' }, offer: { by: 'them', terms: '再索粮五千' }, turn: 5 });
assert(s1b === s1, '同 sourceRef 已有 open 会话 → 复用不重开(返同一对象)');
assert(s1.offers.length === 2, '复用追加 offer(offers 追加·不新开)');
assert((GA._negotiations || []).length === 1, '会话账本仍只一条(复用非新增)');

var s2 = N.open({ topic: 'peace', initiator: '后金', sourceRef: { kind: 'invasion', refId: '后金' }, offer: { by: 'them', terms: '岁币二十万' }, turn: 5 });
assert(s2 !== s1 && (GA._negotiations || []).length === 2, '异 sourceRef → 新开会话');
var beforeMissingRef = (GA._negotiations || []).length;
assert(N.open({ topic: 'diplomacy', initiator: '无引用甲', offer: { by: 'them', terms: '空引用一' } }) === null
  && N.open({ topic: 'diplomacy', initiator: '无引用乙', sourceRef: { kind: '', refId: '' }, offer: { by: 'them', terms: '空引用二' } }) === null,
  '缺失/空 sourceRef 必须拒绝创建，不能把两个无关谈判误并');
assert((GA._negotiations || []).length === beforeMissingRef, '拒绝空 sourceRef 不得污染会话账本');
assert(N.findOpenByRef('', '') === null, '空来源查找 fail-closed');

console.log('§A2 fail-closed get / playerCounter round 封3');
assert(N.get(s1.id) === s1, 'get 命中返会话');
assert(N.get('ng-999-999') === null, 'fail-closed·带 id 未命中返 null(绝不模糊猜)');
assert(N.get(null) === null, 'get(null) 返 null');
assert(N.playerCounter('ng-nope', '还价', 0) === null, 'playerCounter 未命中 id → null');
assert(N.resolve(s2.id, 'unknown-status') === null && s2.status === 'open', 'resolve 非法状态返回 null 且不改变会话');

var pc1 = N.playerCounter(s1.id, '许银八万', 80000);
assert(pc1 === s1 && s1.round === 2 && s1.offers.length === 3, '玩家回价1 → round2·追 player offer');
assert(s1.offers[s1.offers.length - 1].by === 'player' && s1.offers[s1.offers.length - 1].silver === 80000, '末 offer=玩家还价(by player·silver)');
var pc2 = N.playerCounter(s1.id, '再让一步', 90000);
assert(pc2 === s1 && s1.round === 3, '玩家回价2 → round3');
var pc3 = N.playerCounter(s1.id, '第三次', 95000);
assert(pc3 === null && s1.round === 3 && s1.offers.length === 4, 'round≥3 后不再允许 counter(封3·offers 不再增)');

console.log('§A3 resolve / surfaceEnvoy / tickExpiry 过期 lapse + 僵尸使节清');
N.surfaceEnvoy({ fromName: '后金', reason: '议和：岁币二十万', negotiationId: s2.id, turn: 5, interactionType: 'sue_for_peace' });
assert(GA._pendingAudiences.length === 1 && GA._pendingAudiences[0]._negotiationId === s2.id, 'surfaceEnvoy 入待见队列(带 _negotiationId)');
assert(GA._pendingAudiences[0].isEnvoy === true && GA._pendingAudiences[0].name === '后金来使', '使节形状(isEnvoy·来使)');
N.surfaceEnvoy({ fromName: '后金', reason: '议和：改索十五万', negotiationId: s2.id, turn: 6 });
assert(GA._pendingAudiences.length === 1, '同会话僵尸使节去重(只留最新)');
assert(N.resolve('ng-none', 'accepted') === null, 'resolve 未命中 → null');
N.resolve(s2.id, 'accepted');
assert(s2.status === 'accepted', 'resolve 置终局态');
// s1 仍 open·advance 过期
GA.turn = 5 + N.EXPIRE_TURNS + 1;
N.surfaceEnvoy({ fromName: '闯字营', reason: '讨价', negotiationId: s1.id, turn: 5 });
assert(GA._pendingAudiences.some(function (a) { return a._negotiationId === s1.id; }), 'lapse 前 s1 使节在队');
var ex = N.tickExpiry();
assert(s1.status === 'lapsed' && ex.lapsed === 1, 'tickExpiry → 过期 open 会话置 lapsed');
assert(!GA._pendingAudiences.some(function (a) { return a._negotiationId === s1.id; }), '过期会话对应 _negotiationId 僵尸使节被清');
assert(s2.status === 'accepted', '已 accepted 会话不受过期影响');

// ═══════════════════════════════════════════════════════════════
console.log('\n§B 民变招抚接会话（pacify_counter 开会话 + prompt 注入 + playerResolvePacify）');
var DIVS = { '凤阳府': { name: '凤阳府', militaryRecruits: 3000 } };
var B = mkSandbox({
  TM: { AIChange: { PathUtils: { findDivisionByNameFuzzy: function (G, n) { return DIVS[String(n || '').trim()] || null; } } } },
  GM: {
    turn: 9, eraName: '天下将乱', mapData: {},
    guoku: { balance: 250000, ledgers: { money: { stock: 250000 } } },
    facs: [{ id: 'f1', name: '大明', strength: 70, playerRelation: 100 }],
    chars: [{ name: '朱由检', isPlayer: true, alive: true }],
    armies: [], _pendingAudiences: [],
    minxin: { trueIndex: 30, revolts: [{ id: 'rvA', region: '凤阳', status: 'ongoing', level: 4, turn: 8, _identity: { banner: '闯字营', leaderName: '高闯王', leaderFrom: 'new', creed: '均田免赋', stance: '流动作战', agenda: '窥神京' } }] },
    _edictTracker: [{ turn: 9, category: '政事', content: '着有司招抚凤阳流贼·许以自新' }]
  },
  P: { conf: { revoltEntityEnabled: true, negotiationSessionsEnabled: true } }
});
load(B, 'tm-revolt-entity.js');
load(B, 'tm-negotiation.js');
load(B, 'tm-revolt-inference.js');
var RI = B.TM.RevoltInference, NB = B.TM.Negotiation, GB = B.GM;
B.TM.RevoltEntity.sync(GB);

var rb = RI._applyActions(GB, { stocks: [{ id: 'rvA', actions: [{ type: 'pacify_counter', silverDemand: 150000, officeTitle: '游击将军' }] }] });
assert(rb.applied === 1, 'pacify_counter 落账(仍 _eb 叙事)');
var pns = (GB._negotiations || []).filter(function (n) { return n.topic === 'pacify' && n.sourceRef.refId === 'rvA'; });
assert(pns.length === 1 && pns[0].status === 'open', '讨价 → 开 pacify 会话(sourceRef revolt=rvA)');
assert(pns[0].offers[0].silver === 150000 && pns[0].offers[0].office === '游击将军', '会话 offer=索银/officeTitle');
var env = (GB._pendingAudiences || []).filter(function (a) { return a._negotiationId === pns[0].id; });
assert(env.length === 1 && env[0].isEnvoy && env[0].name === '闯字营来使', '推使节求见进 _pendingAudiences(旗号+来使)');

var nl0 = RI._negotiationLines(GB, 'rvA');
assert(nl0.length >= 1 && nl0[0].indexOf('续谈') >= 0, 'tickInference prompt 注入「待续谈判」段存在');
console.log('§B2 零成本受抚根治：结算台面=末条 them-offer·玩家回价禁准奏·对方回应后方可成局');
var setO = NB.settleableOffer(NB.get(pns[0].id));
assert(setO && setO.by === 'them' && setO.silver === 150000, '结算台面 settleableOffer=末条 them-offer(索银15万·非玩家回价)');
// 玩家回价(纯文本无银·exploit 载体)→ currentOffer 变 player·但 settleableOffer 仍锚 them
NB.playerCounter(pns[0].id, '只授官不予银', 0);
var nl1 = RI._negotiationLines(GB, 'rvA');
assert(nl1[0].indexOf('朝廷已还价') >= 0, '玩家已回价 → 注入段提示「须回应」续演');
assert(NB.currentOffer(NB.get(pns[0].id)).by === 'player', '玩家回价后 currentOffer.by=player');
assert(NB.settleableOffer(NB.get(pns[0].id)).silver === 150000, 'settleableOffer 仍锚 them-offer(玩家回价不改结算台面)');
// 反例③：玩家刚回价·对方未回 → 准奏被禁(根治零成本受抚·不得纯文本回价白捡)
var blockedAcc = RI.playerResolvePacify(GB, 'rvA', { accept: true });
assert(!blockedAcc.ok && /回价/.test(blockedAcc.reason || ''), '反例③ 玩家回价后对方未回 → 准奏被禁(已递回价·俟其回音)');
assert(GB.minxin.revolts[0].status === 'ongoing' && GB.guoku.balance === 250000, '被禁时国库分文未动·股仍 ongoing(零成本受抚封死)');
// 驳回：抚议中辍·义军续叛
var rr = RI.playerResolvePacify(GB, 'rvA', { accept: false });
assert(rr.ok && rr.rejected && GB.minxin.revolts[0].status === 'ongoing', '驳回 → 抚议中辍·义军续叛(仍 ongoing)');
// 反例④：对方回应形成新 them-offer(改索十二万) → 可准奏·按新台面真扣(绝非玩家回价的0)
NB.open({ topic: 'pacify', initiator: '闯字营', sourceRef: { kind: 'revolt', refId: 'rvA' }, offer: { by: 'them', terms: '改索十二万·授游击', silver: 120000, office: '游击将军' }, turn: GB.turn });
assert(NB.currentOffer(NB.get(pns[0].id)).by === 'them', '反例④ 对方回应 → currentOffer.by=them(可结算)');
var ra = RI.playerResolvePacify(GB, 'rvA', { accept: true });
assert(ra.ok && ra.pacified && ra.silver === 120000, '反例④ 按新 them-offer(12万)准奏受抚(非0成本)');
assert(GB.guoku.balance === 130000 && GB.guoku.ledgers.money.stock === 130000, '真扣12万(_spendSilver·money.stock 同步)');
assert(GB.minxin.revolts[0]._pacified.officeTitle === '游击将军', '受抚落账带 them-offer 官职');
var rgone = RI.playerResolvePacify(GB, 'rvA', { accept: true });
assert(!rgone.ok, '已受抚股再准 → fail(不在续谈)');

console.log('§B3 银额兜底：them-offer 无 silver → 回落 level*100000(绝不落 0)');
var F = mkSandbox({
  GM: {
    turn: 12, mapData: {}, guoku: { balance: 500000, ledgers: { money: { stock: 500000 } } },
    facs: [{ id: 'f1', name: '大明', playerRelation: 100 }], chars: [], armies: [], _pendingAudiences: [],
    minxin: { trueIndex: 30, revolts: [{ id: 'rvF', region: '山东', status: 'ongoing', level: 2, turn: 11, _identity: { banner: '张字营', leaderName: '张头领' } }] },
    _edictTracker: [{ turn: 12, content: '着有司招抚山东乱民' }]
  },
  P: { conf: { revoltEntityEnabled: true, negotiationSessionsEnabled: true } }
});
load(F, 'tm-revolt-entity.js'); load(F, 'tm-negotiation.js'); load(F, 'tm-revolt-inference.js');
F.TM.RevoltEntity.sync(F.GM);
F.TM.Negotiation.open({ topic: 'pacify', initiator: '张字营', sourceRef: { kind: 'revolt', refId: 'rvF' }, offer: { by: 'them', terms: '只求招安不索银' }, turn: 12 });
var rf = F.TM.RevoltInference.playerResolvePacify(F.GM, 'rvF', { accept: true });
assert(rf.ok && rf.silver === 200000, 'them-offer 无 silver → 回落 level(2)*100000=20万(绝不落0)');
assert(F.GM.guoku.balance === 300000, '兜底索价真扣20万(帑闸生效)');

// ═══════════════════════════════════════════════════════════════
console.log('\n§C 外患议和接线（demand 结构化贡银 + settlePeace 余额闸/endWar/退兵）');
function borderSandbox(balance, warId, silverInDemand, demandTerms, str) {
  var s = mkSandbox({
    IntegrationBridge: { getLeafDivisions: function () { return [{ name: '蓟州', borderRisk: 80 }]; } },
    GM: {
      turn: 40, adminHierarchy: { player: {} }, _chronicle: [], _pendingAudiences: [],
      guoku: { balance: balance, ledgers: { money: { stock: balance } } },
      facs: [{ id: 'f_hj', name: '后金', strength: str || 80, playerRelation: -90 }],
      armies: [{ id: 'inv1', name: '后金犯边之师', faction: '后金', sourceFacName: '后金', _borderInvasion: true, soldiers: 50000, disbanded: false, location: '蓟州' }],
      activeWars: [{ id: warId, attacker: '大明', defender: '后金' }],
      _edictTracker: []
    },
    P: { conf: { borderInvasionEnabled: true, negotiationSessionsEnabled: true }, playerFactionName: '大明' }
  });
  s._relCalls = [];
  s.CasusBelliSystem = { endWar: function (id) { var i = s.GM.activeWars.findIndex(function (w) { return w.id === id; }); if (i >= 0) s.GM.activeWars.splice(i, 1); } };
  s.setFactionRelation = function (a, b, patch) { s._relCalls.push({ a: a, b: b, delta: patch && patch.delta }); };
  load(s, 'tm-negotiation.js'); load(s, 'tm-border-invasion.js');
  var mv = { type: 'demand', fac: '后金', terms: demandTerms };
  if (silverInDemand != null) mv.silver = silverInDemand;
  s.TM.BorderInvasion._applyInvasionActions(s.GM, { moves: [mv] });
  return s;
}
// 结构化 mv.silver 优先
var C = borderSandbox(250000, 'w1', 200000, '岁币·开边市', 80);
var BI = C.TM.BorderInvasion, NC = C.TM.Negotiation, GC = C.GM;
var pns2 = (GC._negotiations || []).filter(function (n) { return n.topic === 'peace' && n.sourceRef.refId === '后金'; });
assert(pns2.length === 1 && pns2[0].status === 'open', 'demand → 开 peace 会话(sourceRef invasion=后金)');
assert(NC.settleableOffer(pns2[0]).silver === 200000, '结构化 mv.silver=20万 入 offer(clamp 0-30万内)');
var env2 = (GC._pendingAudiences || []).filter(function (a) { return a._negotiationId === pns2[0].id; });
assert(env2.length === 1 && env2[0].interactionType === 'sue_for_peace', 'demand 推议和使节(interactionType=sue_for_peace)');
var sp = BI.settlePeace(GC, '后金', { silver: NC.settleableOffer(pns2[0]).silver, playerFac: '大明' });
assert(sp.ok && sp.endedWar && GC.activeWars.length === 0, 'settlePeace 足额 → endWar 真止战(activeWars 清)');
assert(sp.withdrew && GC.armies[0].disbanded === true, '犯边之师退兵(disbanded·退兵接线)');
assert(C._relCalls.some(function (r) { return r.b === '后金' && r.delta === 28; }), '邦交 delta+28(照 sue_for_peace 语义)');
assert(GC.guoku.balance === 50000 && GC.guoku.ledgers.money.stock === 50000 && sp.tribute === 200000, '贡银20万真扣(余额闸·balance+money.stock 同步·非记欠)');

console.log('§C2 反例①②：文含「岁币」无结构化 silver→派生默认非0 / 国库不足→原子拒绝');
var C2 = borderSandbox(30000, 'w2', null, '岁币不可少·否则南下', 80);
var BI2 = C2.TM.BorderInvasion, NC2 = C2.TM.Negotiation, GC2 = C2.GM;
var pns3 = (GC2._negotiations || []).filter(function (n) { return n.topic === 'peace'; });
var derived = Math.round(Math.max(8000, Math.min(120000, 80 * 600)));   // strength80 → 48000
assert(NC2.settleableOffer(pns3[0]).silver === derived && derived === 48000, '反例① 文含「岁币」无结构化 silver → 派生默认非0(80*600=48000)');
var spBad = BI2.settlePeace(GC2, '后金', { silver: NC2.settleableOffer(pns3[0]).silver, playerFac: '大明' });
assert(!spBad.ok && spBad.reason === '国库不敷', '反例② 国库3万<贡银4.8万 → settlePeace 原子拒绝');
assert(GC2.activeWars.length === 1, '拒绝 → activeWars 仍在(不停战)');
assert(GC2.armies[0].disbanded !== true, '拒绝 → 犯边之师未退');
assert(GC2.guoku.balance === 30000 && GC2.guoku.ledgers.money.stock === 30000, '拒绝 → 国库分文未扣(非尽扣记欠)');
assert(pns3[0].status === 'open' && (GC2._pendingAudiences || []).some(function (a) { return a._negotiationId === pns3[0].id; }), '拒绝 → 会话 open·使节留队(可再议/降价)');

console.log('§C3 反例⑤：纯撤军白和(terms 无贡银语义) → silver=0 合法白和·空帑亦可成');
var C3 = borderSandbox(0, 'w3', null, '但求撤军·两不相犯', 80);
var BI3 = C3.TM.BorderInvasion, NC3 = C3.TM.Negotiation, GC3 = C3.GM;
var pns4 = (GC3._negotiations || []).filter(function (n) { return n.topic === 'peace'; });
assert((NC3.settleableOffer(pns4[0]).silver || 0) === 0, '反例⑤ terms 纯撤军无贡银语义 → offer 无贡银(silver=0·合法白和)');
var spWhite = BI3.settlePeace(GC3, '后金', { silver: 0, playerFac: '大明' });
assert(spWhite.ok && spWhite.endedWar && spWhite.tribute === 0 && GC3.activeWars.length === 0, '白和(silver=0) → 无需出帑·endWar 成');
assert(GC3.armies[0].disbanded === true && GC3.guoku.balance === 0, '白和 → 退兵·国库分文未动(空帑亦可白和)');

// ═══════════════════════════════════════════════════════════════
console.log('\n§D flag OFF 三生产者旧行为等价（行为级）+ 势力提议挂会话（ON）');
// D1·revolt pacify_counter OFF
var D1 = mkSandbox({
  TM: { AIChange: { PathUtils: { findDivisionByNameFuzzy: function () { return null; } } } },
  GM: {
    turn: 9, mapData: {}, guoku: { balance: 250000, ledgers: { money: { stock: 250000 } } },
    facs: [{ id: 'f1', name: '大明', playerRelation: 100 }], chars: [], armies: [], _pendingAudiences: [],
    minxin: { trueIndex: 30, revolts: [{ id: 'rvA', region: '凤阳', status: 'ongoing', level: 4, turn: 8, _identity: { banner: '闯字营', leaderName: '高闯王' } }] },
    _edictTracker: [{ turn: 9, content: '着有司招抚凤阳流贼' }]
  },
  P: { conf: { revoltEntityEnabled: true, negotiationSessionsEnabled: false } }
});
load(D1, 'tm-revolt-entity.js'); load(D1, 'tm-negotiation.js'); load(D1, 'tm-revolt-inference.js');
D1.TM.RevoltEntity.sync(D1.GM);
D1.TM.RevoltInference._applyActions(D1.GM, { stocks: [{ id: 'rvA', actions: [{ type: 'pacify_counter', silverDemand: 150000 }] }] });
assert(!(D1.GM._negotiations && D1.GM._negotiations.length), 'flag OFF·revolt pacify_counter 不开会话');
assert(D1.GM._pendingAudiences.length === 0, 'flag OFF·revolt 不推使节');
assert(D1._ebs.some(function (e) { return e.indexOf('讨价') >= 0; }), 'flag OFF·revolt 旧行为(仍 _eb 讨价)保留');

// D2·border demand OFF
var D2 = mkSandbox({
  IntegrationBridge: { getLeafDivisions: function () { return [{ name: '蓟州', borderRisk: 80 }]; } },
  GM: { turn: 40, adminHierarchy: { player: {} }, _chronicle: [], _pendingAudiences: [], facs: [{ name: '后金', playerRelation: -90 }], armies: [], activeWars: [], _edictTracker: [] },
  P: { conf: { borderInvasionEnabled: true, negotiationSessionsEnabled: false } }
});
load(D2, 'tm-negotiation.js'); load(D2, 'tm-border-invasion.js');
D2.TM.BorderInvasion._applyInvasionActions(D2.GM, { moves: [{ type: 'demand', fac: '后金', terms: '岁币二十万' }] });
assert(!(D2.GM._negotiations && D2.GM._negotiations.length), 'flag OFF·border demand 不开会话');
assert(D2.GM._pendingAudiences.length === 0, 'flag OFF·border 不推使节');
assert(D2._ebs.some(function (e) { return e.indexOf('要挟') >= 0; }) && D2.GM._chronicle.length === 1, 'flag OFF·border 旧行为(_eb 要挟+_chronicle)保留');

// D3·faction 提议：ON 挂会话·OFF 无
function factionSandbox(flag) {
  var s = mkSandbox({
    GM: { turn: 12, facs: [{ name: '后金', playerRelation: -20 }], _pendingAudiences: [], _factionDiplomacyLog: [] },
    P: { conf: { negotiationSessionsEnabled: flag }, playerInfo: { factionName: '大明' } }
  });
  load(s, 'tm-negotiation.js'); load(s, 'tm-faction-diplomacy.js');
  s.TM.FactionDiplomacy.recordProposals('后金', [{ toFaction: '大明', type: 'peace', terms: '媾和罢兵' }], 12);
  return s;
}
var fON = factionSandbox(true);
var faON = (fON.GM._pendingAudiences || []).filter(function (a) { return a._factionProposalId; });
assert(faON.length === 1 && faON[0]._negotiationId != null, '势力提议(ON)：使节挂会话(_negotiationId 非空·玩家可回价)');
assert((fON.GM._negotiations || []).some(function (n) { return n.topic === 'diplomacy' && n.sourceRef.kind === 'proposal'; }), '势力提议(ON)：开 diplomacy 会话(sourceRef proposal)');
var fOFF = factionSandbox(false);
var faOFF = (fOFF.GM._pendingAudiences || []).filter(function (a) { return a._factionProposalId; });
assert(faOFF.length === 1 && faOFF[0]._negotiationId == null, '势力提议(OFF)：旧行为·使节无 _negotiationId·无会话');
assert(!(fOFF.GM._negotiations && fOFF.GM._negotiations.length), '势力提议(OFF)：不开会话');
// countered 结局码已入 _OUTCOME_CN
var fdSrc = fs.readFileSync(path.join(ROOT, 'tm-faction-diplomacy.js'), 'utf8');
assert(/_OUTCOME_CN[\s\S]*countered/.test(fdSrc), 'faction-diplomacy _OUTCOME_CN 含 countered(回价供 decideFor 续演)');

// ═══════════════════════════════════════════════════════════════
console.log('\n§E save-lifecycle explicit mirror 登记契约（真源抽取）');
var slSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
assert(/GM\._negotiations\s*=\s*\[\]/.test(slSrc) && /GM\._negotiationSeq\s*=\s*0/.test(slSrc), 'ensure：_negotiations/_negotiationSeq 初始化');
assert(/GM\._savedNegotiations\s*=\s*_safeClone\(GM\._negotiations\)/.test(slSrc), 'save：_savedNegotiations mirror(不加则跨存档丢)');
assert(/GM\._savedNegotiationSeq\s*=\s*GM\._negotiationSeq/.test(slSrc), 'save：_savedNegotiationSeq mirror');
assert(/GM\._negotiations\s*=\s*GM\._savedNegotiations/.test(slSrc) && /GM\._negotiationSeq\s*=\s*GM\._savedNegotiationSeq/.test(slSrc), 'restore：两字段跨存档复原');
// index.html 三件套 + gm-writes owners
var idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert(/tm-negotiation\.js/.test(idxSrc), 'index.html 挂 tm-negotiation.js script 标签');
var owners = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'arch-baselines', 'gm-writes.json'), 'utf8')).config.owners;
assert(owners.indexOf('tm-negotiation.js') >= 0, 'gm-writes owners 登记 tm-negotiation.js(会话/使节写口)');

// ═══════════════════════════════════════════════════════════════
console.log('');
if (failures.length) {
  console.log('FAIL smoke-negotiation-sessions: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-negotiation-sessions (状态机/复用/round封3/过期清僵尸/招抚接线/议和endWar退兵贡银/势力挂会话/flag OFF等价/mirror契约)');
