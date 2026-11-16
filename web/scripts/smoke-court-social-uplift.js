#!/usr/bin/env node
'use strict';
/* smoke-court-social-uplift — 廷议议题/立场升级 + 御前完善 + 策名入局接线（2026-07-03）防腐线。
 * §A 廷议：党争先验入 initial(行为)/议题保鲜冷却(行为)/NPC上书去stub(行为)/运动议题+迁移判定接活(契约)
 * §B 御前：心腹之见聚合/决断落 courtRecords/违众记忆(行为)/prompt补注+泄密硬后果(契约)
 * §C 策名：归朝/配党/记忆种子(行为·本地路) */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function fakeEl() {
  return { classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, style: { cssText: '' },
    appendChild(c){ return c; }, removeChild(c){ return c; }, setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, querySelector(){ return fakeEl(); }, querySelectorAll(){ return []; },
    children: [], innerHTML: '', textContent: '', dataset: {}, remove(){}, parentNode: null };
}
function baseSandbox(extra) {
  var sb = { console: { log(){}, warn(){}, error(){} }, setTimeout: function(){}, clearTimeout: function(){},
    setInterval: function(){}, clearInterval: function(){}, Math, Date, JSON, RegExp, Error, Promise,
    Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
    document: { getElementById: () => fakeEl(), querySelector: () => fakeEl(), querySelectorAll: () => [],
      createElement: () => fakeEl(), body: fakeEl(), head: fakeEl(), addEventListener(){}, readyState: 'complete' },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    navigator: { userAgent: 'node' }, performance: { now: () => Date.now() },
    fetch: () => Promise.reject(new Error('no fetch')), alert(){}, confirm: () => true, prompt: () => null,
    HTMLElement: function(){}, requestAnimationFrame: cb => cb(),
    escHtml: v => String(v == null ? '' : v),
    addCYBubble(){}, addEB(){}, toast(){}, closeChaoyi(){}, showLoading(){}, hideLoading(){} };
  Object.keys(extra || {}).forEach(function(k){ sb[k] = extra[k]; });
  sb.window = sb; sb.global = sb; sb.globalThis = sb;
  sb.addEventListener = function(){}; sb.removeEventListener = function(){};
  vm.createContext(sb);
  return sb;
}
function load(sb, f) { vm.runInContext(read(f), sb, { filename: f }); }
console.log('smoke-court-social-uplift');

/* ══ §A 廷议 ══════════════════════════════════════════════════ */
console.log('— §A · 廷议党争先验(行为) —');
(function() {
  var sb = baseSandbox({ _ty2_enterDecide(){} });
  load(sb, 'tm-tinyi-v3-persona.js'); load(sb, 'tm-tinyi-v3.js'); load(sb, 'tm-tinyi-v3-edict-personnel.js'); load(sb, 'tm-tinyi-v3-parties.js');
  sb.GM = { turn: 20, parties: [{ name: '甲党', cohesion: 70 }, { name: '乙党', cohesion: 40 }],
    partyState: { '甲党': { cohesion: 70 }, '乙党': { cohesion: 40 } },
    _pendingTinyiTopics: [], _ccHeldItems: [], chars: [], qijuHistory: [], evtLog: [], vars: {} };
  var bias = sb._ty3_partyStanceBias;
  ok(typeof bias === 'function', '_ty3_partyStanceBias 导出');
  var loyalist = { name: '某臣', party: '甲党', aggregateDims: { loyalty: 0.6, cunning: 0.3 } };
  var b1 = bias(loyalist, { sourceParty: '甲党' });
  ok(b1 && b1.stance === 'support' && b1.intensity > 0.5, '本党所倡→倾支持·党纪随凝聚 (' + JSON.stringify(b1) + ')');
  var b2 = bias(loyalist, { sourceParty: '乙党', opposingParties: ['甲党'] });
  ok(b2 && b2.stance === 'oppose', '名列反对方→倾反对');
  var slippery = { name: '滑吏', party: '甲党', aggregateDims: { cunning: 0.9, loyalty: 0.2 } };
  ok(bias(slippery, { sourceParty: '甲党' }) === null, '巨猾低忠不受党纪拘(全由性格)');
  ok(bias({ name: '白身' }, { sourceParty: '甲党' }) === null, '无党者无先验');

  console.log('— §A · 议题保鲜/冷却(行为) —');
  sb.GM._pendingTinyiTopics = [];
  var pushed = sb._ty3_pushPendingTinyiTopic({ topic: '试议一' }, '试议一', []);
  ok(pushed && sb.GM._pendingTinyiTopics[0].expiresAt === 30, 'scan 议题得 10 回合寿限 (expiresAt=' + sb.GM._pendingTinyiTopics[0].expiresAt + ')');
  for (var i = 0; i < 30; i++) sb._ty3_pushPendingTinyiTopic({ topic: '灌池' + i }, '灌池' + i, []);
  ok(sb.GM._pendingTinyiTopics.length <= 24, '议题池封顶 24 淘最老 (得 ' + sb.GM._pendingTinyiTopics.length + ')');
  ok(sb._ty3_spawnCooldownReady('fiscal-deficit', 4) === true, '冷却初始就绪');
  sb._ty3_spawnCooldownStamp('fiscal-deficit');
  ok(sb._ty3_spawnCooldownReady('fiscal-deficit', 4) === false, '盖戳后 4 回合内不再刷');
  sb.GM.turn = 24;
  ok(sb._ty3_spawnCooldownReady('fiscal-deficit', 4) === true, '过冷却期恢复');

  console.log('— §A · NPC 上书去 stub(行为) —');
  sb.GM.turn = 20;
  sb.GM._pendingTinyiTopics = [];
  sb.GM.parties = [{ name: '甲党', leader: '魁首公', currentAgenda: '开源节流·清丈田亩', enemies: ['乙党'] }];
  sb.GM.chars = [{ name: '魁首公', party: '甲党', alive: true, prestige: 85, loyalty: 60 }];
  sb.findCharByName = function(n){ return sb.GM.chars.find(function(c){ return c.name === n; }) || null; };
  sb._ty3_npcProposeTinyiTopicsTick();
  var npcT = sb.GM._pendingTinyiTopics[0];
  ok(!!npcT, '党魁上书成议 (' + (npcT && npcT.topic) + ')');
  ok(npcT && npcT.topic.indexOf('urgency') < 0, '标题不再带 urgency 数字(去 stub)');
  ok(npcT && /党议·/.test(npcT.topic) && npcT.topic.indexOf('开源节流') >= 0, '标题带本党真实目标');
  ok(npcT && npcT.sourceParty === '甲党' && Array.isArray(npcT.opposingParties), '带 sourceParty/opposingParties meta(下游注入吃得到)');
})();
console.log('— §A · 运动议题/迁移判定(契约) —');

/* ══ §B 御前 ══════════════════════════════════════════════════ */
console.log('— §B · 御前决断落账(行为) —');
(function() {
  var mems = [], chrs = [];
  var sb = baseSandbox({
    _$: function(){ return fakeEl(); },
    findCharByName: function(n){ return { name: n, loyalty: 60 }; },
    _cy_jishiAdd(){}, uid: function(){ return 'u1'; },
    NpcMemorySystem: { remember: function(n, e){ mems.push({ n: n, e: e }); } },
    ChronicleTracker: { upsert: function(x){ chrs.push(x); } },
    AuthorityEngines: { adjustHuangwei(){} }
  });
  load(sb, 'tm-chaoyi-yuqian.js');
  sb.GM = { turn: 9, _courtRecords: [], _edictTracker: [], qijuHistory: [] };
  sb.P = { playerInfo: { characterName: '朕' }, ai: null };
  sb.CY = { _yq2: { topic: '议边饷', topicType: 'military', advisors: ['甲', '乙', '丙'], record: 'keep',
    opinions: { '甲': { stance: '支持', line: 'x' }, '乙': { stance: '反对', line: 'y' }, '丙': { stance: '反对', line: 'z' } },
    _transcript: '' } };
  var c = sb._yq2_opinionCounts();
  ok(c.approve === 1 && c.oppose === 2 && c.hedge === 0, '心腹之见聚合 1赞/2阻 (' + JSON.stringify(c) + ')');
  sb._yq2_decide('approve');
  var cr = sb.GM._courtRecords[0];
  ok(!!cr && cr.mode === 'yuqian' && cr.topic === '议边饷' && cr.secret === false, '决断写 _courtRecords(治开完白开)');
  ok(cr && cr.stances && cr.stances['乙'] && cr.stances['乙'].current === '反对', '决议带全体立场');
  var dissent = mems.filter(function(m){ return /吾谏未纳/.test(m.e); });
  ok(dissent.length === 2 && dissent.every(function(m){ return m.n === '乙' || m.n === '丙'; }), '违众而断→2 异见心腹各记一笔');
  ok(chrs.length === 1 && chrs[0].type === 'yuqian_pending', '公开决议挂 ChronicleTracker 待落实卡');
  ok(sb.GM._edictTracker.length === 1, '诏令照旧入 _edictTracker');
})();
console.log('— §B · 御前 prompt/泄密(契约) —');

/* ══ §C 策名 ══════════════════════════════════════════════════ */
console.log('— §C · 策名入局接线(行为·本地路) —');
(function() {
  var mems = [];
  var sb = baseSandbox({
    NpcMemorySystem: { remember: function(n, e){ mems.push({ n: n, e: e }); } }
  });
  sb.TM = sb.TM || {};
  sb.P = { conf: { gameMode: 'yanyi' }, ai: null, playerInfo: { factionName: '大梁朝廷', characterName: '朕' } };
  sb.GM = { year: 1628, turn: 3, chars: [], parties: [{ name: '东林党' }], _indices: { charByName: new Map() } };
  sb.findCharByName = function(n){ return sb.GM.chars.find(function(ch){ return ch && ch.name === n; }) || null; };
  sb.HISTORICAL_CHAR_PROFILES = {
    p1: { name: '测君甲', birthYear: 1580, deathYear: 1650, historicalFaction: '东林书院清流', dynasty: '明' },
    p2: { name: '测君乙', birthYear: 900, deathYear: 960, historicalFaction: '塞北汗庭', dynasty: '五代' }
  };
  sb.createCharFromProfile = function(id){
    var p = sb.HISTORICAL_CHAR_PROFILES[id];
    return { name: p.name, faction: (id === 'p2') ? '塞北汗庭' : '', socialClass: '文士' };
  };
  load(sb, 'tm-indices.js');
  load(sb, 'tm-faction-membership.js');   // 转籍已收口到 FactionMembership 单一写口(2026-07-04)·沙箱须与运行时同形态
  load(sb, 'tm-ceming.js');
  return (async function() {
    var r1 = await sb.TM.ceming.summonByProfile('p1');
    ok(r1 && r1.char && r1.char.faction === '大梁朝廷', '当世策名归玩家朝廷(空势力补齐)');
    ok(r1.char.party === '东林党', 'historicalFaction 模糊配党(东林书院清流→东林党)');
    ok(mems.some(function(m){ return m.n === '测君甲' && /策名入朝/.test(m.e); }), '本地路记忆种子·不再空白人');
    var m1 = mems.length;
    var r2 = await sb.TM.ceming.summonByProfile('p2');
    ok(r2.char.faction === '大梁朝廷' && r2.char._historicalFaction === '塞北汗庭', '敌营原属归朝·原属记档供叙事(治条件孤魂)');
    ok(r2.char.party == null || r2.char.party === '', '配不上党则白身(不硬塞)');
    ok(mems.filter(function(m){ return m.n === '测君乙'; }).length === 2 && mems.length === m1 + 2, '跨时空另记时空之惑(两笔)');
    var _cm = read('tm-ceming.js');
    ok(!/assignPost/.test(_cm), '策名仍不占编制(D1 by design)');
  })();
})().then(function() {
  console.log('\nsmoke-court-social-uplift ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
  process.exit(F0 === 0 ? 0 : 1);
}).catch(function(e) {
  console.error('HARNESS ERROR', e && (e.stack || e.message || e));
  process.exit(1);
});
