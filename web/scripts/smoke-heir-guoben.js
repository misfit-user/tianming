#!/usr/bin/env node
'use strict';
/* smoke-heir-guoben — 皇嗣国本三件（2026-07-07·深挖第五轮④）防腐线。
 * 病灶：后宫逐回合生皇子但只是数据对象非 char——resolveHeir(只认 char)永远选不中·
 * 无立太子动作·退位候选不见亲子·law 未配时 fallback「同势力最强者」=权臣抢先继统。
 * 修：诞育入宗牒+childrenIds 回填/皇嗣总序命名防撞/册立皇太子(designatedHeirId)/
 * resolveHeir 默认嫡长/退位候选储君皇嗣置顶/级联清理兼容对象+储君薨清位。
 * §a 诞育入宗牒(全文件vm)  §b 册立太子  §c resolveHeir 默认嫡长  §d 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-heir-guoben');

var hgSrc = read('tm-houguong.js');
var indexSrc = read('tm-indices.js');

function mkHg(opts) {
  opts = opts || {};
  var ebs = [], rngQ = (opts.rng || []).slice();
  var ctx = {
    GM: {
      turn: opts.turn || 10,
      _campaignId: 'heir-guoben-smoke',
      chars: opts.chars || [{ id: 'char-emperor', name: '天子', isPlayer: true, faction: '大明', alive: true }],
      harem: {
        heirs: opts.heirs || [],
        consorts: opts.consorts || [],
        succession: 'eldest_legitimate', pregnancies: []
      }
    },
    P: { playerInfo: { characterName: '天子' }, scenarios: [], engineConstants: {}, buildings: [], armyTemplates: [], parties: [], classes: [], factions: [], unitSystem: { enabled: false } },
    TM: { errors: { capture: function(){}, captureSilent: function(){} } },
    initDataListeners: function () {},
    SettlementPipeline: { register: function () {} },
    rng: function () { return rngQ.length ? rngQ.shift() : 0.99; },
    addEB: function (cat, txt) { ebs.push(cat + '|' + txt); },
    confirm: opts.confirm === undefined ? function () { return true; } : opts.confirm,
    toast: function () {}, NpcMemorySystem: { addMemory: function () {} },
    document: {
      getElementById: function () { return null; },
      createElement: function () { return { style: {}, classList: { add: function(){} }, setAttribute: function(){} }; },
      head: { appendChild: function () {} },
      readyState: 'complete', addEventListener: function () {}
    },
    setTimeout: function () {}, console: { warn: function(){}, log: function(){} },
    Math: Math, Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean,
    RegExp: RegExp, Map: Map, Set: Set, JSON: JSON, Date: Date,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(indexSrc, ctx, { filename: 'tm-indices.js' });
  vm.runInContext(hgSrc, ctx, { filename: 'tm-houguong.js' });
  ctx._ebs = ebs;
  return ctx;
}

/* ── §a 诞育入宗牒 ─────────────────────────────────────────── */
console.log('— §a · 诞育入宗牒 —');
(function () {
  // 妃子怀胎已满9回合·rng: 存活0.5<0.88 → 皇子0.3<0.5 → 晋位掷0.9(不晋·防耗位)
  var c1 = mk1();
  function mk1() {
    return mkHg({
      turn: 20,
      consorts: [{ name: '王氏', rank: '贵妃', age: 22, favor: 50, status: '有孕', pregnant: true, pregnantSince: 11, children: [], childCount: 0, lastFavoredTurn: 19 }],
      rng: [0.5, 0.3, 0.9]
    });
  }
  c1.TM.hougong.processTurn();
  var kid = c1.GM.chars.find(function (x) { return x._royalChild; });
  ok(!!kid && kid.name === '皇长子' && kid.gender === 'male' && kid.age === 0, '皇长子入宗牒(真char·总序命名)');
  ok(kid && kid.faction === '大明' && kid.father === '天子' && kid.mother === '王氏', '皇子承玩家 faction·父母俱记');
  var pc1 = c1.GM.chars.find(function (x) { return x.isPlayer; });
  ok(pc1 && kid && Array.isArray(pc1.childrenIds) && pc1.childrenIds.indexOf(kid.id) >= 0, '玩家 childrenIds 回填真实稳定 ID(resolveHeir 可及)');
  ok(c1.GM.harem.heirs.length === 1 && c1.GM.harem.heirs[0].name === '皇长子' && c1.GM.harem.heirs[0].id === kid.id, 'heirs 台账同步稳定 ID');

  // 第二胎(另一妃)总序不撞名
  var c2 = mkHg({
    turn: 20,
    heirs: [{ name: '皇长子', mother: '王氏', isPrince: true, alive: true }],
    consorts: [{ name: '李氏', rank: '妃', age: 20, favor: 40, status: '有孕', pregnant: true, pregnantSince: 11, children: [], childCount: 0, lastFavoredTurn: 19 }],
    rng: [0.5, 0.3, 0.9]
  });
  c2.TM.hougong.processTurn();
  ok(c2.GM.harem.heirs.some(function (h) { return h.name === '皇次子'; }), '异母第二子=皇次子(总序防撞·原各母计数两个「皇子1」)');

  // 皇女
  var c3 = mkHg({
    turn: 20,
    consorts: [{ name: '张氏', rank: '嫔', age: 21, favor: 30, status: '有孕', pregnant: true, pregnantSince: 11, children: [], childCount: 0, lastFavoredTurn: 19 }],
    rng: [0.5, 0.8]
  });
  c3.TM.hougong.processTurn();
  var girl = c3.GM.chars.find(function (x) { return x._royalChild; });
  ok(!!girl && girl.name === '皇长女' && girl.gender === 'female', '皇女同入宗牒(皇长女)');

  // 玩家缺位：明确失败且不留下半注册皇嗣
  var c4 = mkHg({
    turn: 20, chars: [],
    consorts: [{ name: '刘氏', rank: '嫔', age: 21, favor: 30, status: '有孕', pregnant: true, pregnantSince: 11, children: [], childCount: 0, lastFavoredTurn: 19 }],
    rng: [0.5, 0.3, 0.9]
  });
  var missingPlayerFailed = false;
  try { c4.TM.hougong.processTurn(); } catch (e) { missingPlayerFailed = /统一名册入口|玩家角色/.test(e.message); }
  ok(missingPlayerFailed && c4.GM.harem.heirs.length === 0 && c4.GM.chars.length === 0, '玩家缺位：明确失败且不留下半注册皇嗣');
})();

/* ── §b 册立皇太子 ─────────────────────────────────────────── */
console.log('— §b · 册立皇太子 —');
(function () {
  function mkCrown(opts) {
    opts = opts || {};
    return mkHg({
      turn: 30,
      chars: [
        { id: 'char-emperor', name: '天子', isPlayer: true, faction: '大明', alive: true },
        { id: 'char-prince', name: '皇长子', _royalChild: true, alive: true, faction: '大明', title: '皇子' },
        { id: 'char-minister', name: '某尚书', alive: true, faction: '大明', officialTitle: '尚书' }
      ],
      heirs: [{ name: '皇长子', mother: '王氏', isPrince: true, alive: true }, { name: '皇长女', mother: '李氏', isPrince: false, alive: true }],
      confirm: opts.confirm
    });
  }
  var c1 = mkCrown();
  var r1 = c1.TM.hougong.crownPrince('皇长子');
  var pc = c1.GM.chars.find(function (x) { return x.isPlayer; });
  var hc = c1.GM.chars.find(function (x) { return x.name === '皇长子'; });
  ok(r1 === true && pc.designatedHeirId === hc.id && c1.GM.harem.crownPrinceId === hc.id, '册立：designatedHeirId 落稳定 ID(resolveHeir 最高优先级)');
  ok(hc.title === '皇太子', '皇子改衔皇太子');
  ok(c1._ebs.some(function (x) { return x.indexOf('国本|') === 0 && /皇太子/.test(x); }), '编年入册(国本以定)');
  ok(c1.TM.hougong.crownPrince('皇长子') === false, '重复册立拒绝');
  ok(c1.TM.hougong.crownPrince('皇长女') === false, '皇女不可立太子(isPrince 门)');

  var c2 = mkCrown();
  c2.GM.chars = c2.GM.chars.filter(function (x) { return x.name !== '皇长子'; });   // 旧档所生未入宗牒
  ok(c2.TM.hougong.crownPrince('皇长子') === false, '未入宗牒(旧档)拒立·诚实给因');

  var c3 = mkCrown({ confirm: function () { return false; } });
  ok(c3.TM.hougong.crownPrince('皇长子') === false && !c3.GM.harem.crownPrince, '取消确认不立');
})();

/* ── §c resolveHeir 默认嫡长 ─────────────────────────────────── */
console.log('— §c · resolveHeir 默认嫡长 —');
(function () {
  var hs = read('tm-endturn-helpers.js');
  var s = hs.indexOf('function resolveHeir(');
  var e = hs.indexOf("SettlementPipeline.register('annualReview'");
  ok(s > 0 && e > s, 'resolveHeir 切片边界在');
  var code = hs.slice(s, e);
  function mkRH(chars, dead) {
    var ctx = {
      GM: { chars: chars, facs: [] },
      findCharByName: function (n) { return chars.find(function (c) { return c.name === n; }) || null; },
      console: console, Math: Math
    };
    ctx.window = ctx; ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'rh-slice.js' });
    return ctx.resolveHeir(dead);
  }
  var kid = { name: '皇长子', alive: true, faction: '明', age: 3, _royalChild: true };
  var kid2 = { name: '皇次子', alive: true, faction: '明', age: 1, _royalChild: true };
  var strong = { name: '权臣', alive: true, faction: '明', intelligence: 99, valor: 99, loyalty: 99, administration: 99 };
  var emp = { name: '天子', isPlayer: true, faction: '明', childrenIds: ['皇长子', '皇次子'] };

  ok(mkRH([emp, kid, kid2, strong], emp) === kid, 'law 未配+有子嗣→默认嫡长(年长者继·不再被「同势力最强者」权臣抢统)');
  var empNoKid = { name: '天子', isPlayer: true, faction: '明' };
  ok(mkRH([empNoKid, strong], empNoKid) === strong, '无子嗣→fallback 最强者原路(零回归)');
  var empDesig = { name: '天子', isPlayer: true, faction: '明', childrenIds: ['皇长子', '皇次子'], designatedHeirId: '皇次子' };
  ok(mkRH([empDesig, kid, kid2, strong], empDesig) === kid2, '已立太子→designated 最高优先(越过长幼)');
  var empSen = { name: '天子', faction: '明', family: '朱', successionLaw: 'seniority', childrenIds: ['皇长子'] };
  var uncle = { name: '皇叔', alive: true, faction: '明', family: '朱', age: 40 };
  ok(mkRH([empSen, kid, uncle], empSen) === uncle, '显式 seniority 剧本不受默认嫡长影响(兄终弟及仍走)');
})();

/* ── §d 接线契约 ─────────────────────────────────────────────── */
console.log('— §d · 接线契约 —');
(function () {
  ok(/gs-harem-heir\.crown\{/.test(hgSrc.replace(/\s/g, '')) || /gs-harem-heir\.crown/.test(hgSrc), '储君 chip 样式在');
})();

console.log('\nsmoke-heir-guoben ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
