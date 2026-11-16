#!/usr/bin/env node
'use strict';
// smoke-benji-compose — 帝王本纪·终局回顾式修史（鼎革R1g·2026-07-07）
// owner：玩家死时按在位回合每12回合一卷(≈一年一卷)串行分段修纂·前卷末200字衔接·
// 末卷并书身后事+「赞曰」·体例仿实录(prompt钉)·素材=起居注/实录/编年(窗内)·散佚如实短卷·
// 成品入 GM._benji+战绩侧·中途断卷保已成·flag benjiEnabled 默认关·无 key 诚实不修。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }

function mkCtx(over) {
  over = over || {};
  const store = {};
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, Promise, parseInt, parseFloat, isFinite, isNaN };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, _store: store };
  ctx.getTSText = (t) => '纪年' + t;
  ctx.escHtml = (s) => String(s == null ? '' : s);
  ctx._prompts = [];
  ctx.callAISmart = over.callAISmart || function (prompt) { ctx._prompts.push(prompt); return Promise.resolve('卷文·第' + ctx._prompts.length + '段正文'); };
  ctx.P = over.P || { conf: { benjiEnabled: true }, ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
  ctx.GM = over.GM || {
    sid: 'tianqi7', turn: 36,
    qijuHistory: [
      { turn: 3, content: '上御门听政，纳谏罢矿税' },
      { turn: 15, content: '上亲祀南郊' },
      { turn: 35, content: '流寇逼畿辅，上下诏罪己' }
    ],
    shijiHistory: [
      { turn: 5, shilu: '五月，河南大旱，诏发帑赈之' },
      { turn: 20, shizhengji: '兵部议辽饷，加派四方' },
      { turn: 33, shilu: '贼陷洛阳，福王遇害' }
    ],
    biannianItems: [{ startTurn: 8, title: '东林党争起' }, { startTurn: 30, title: '闯军围城' }]
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-benji.js'), 'utf8'), ctx, { filename: 'tm-benji.js' });
  return ctx;
}

// ── flag 默认关/无 key：诚实不修 ──
var c0 = mkCtx({ P: { conf: {}, ai: { key: 'k' } } });
var c0b = mkCtx({ P: { conf: { benjiEnabled: true }, ai: {} } });
Promise.all([
  c0.TM.Benji.compose(c0.GM, { P: c0.P }),
  c0b.TM.Benji.compose(c0b.GM, { P: c0b.P })
]).then(function (rs) {
  assert(rs[0].ok === false && rs[0].reason === 'disabled' && c0._prompts.length === 0, '① flag 默认关不修(零调用)');
  assert(rs[1].ok === false && rs[1].reason === 'no_ai', '② 无 key 诚实不修');

  // ── 36回合=3卷串行·衔接·末卷赞曰 ──
  var c1 = mkCtx();
  var onSec = [];
  return c1.TM.Benji.compose(c1.GM, { deathLine: '上崩于乱军之中。', playerName: '天子', onSection: function (i, t, txt) { onSec.push(i + '/' + t); } }).then(function (r) {
    assert(r.ok === true && r.sections === 3, '③ 36回合→ceil(36/12)=3卷(owner裁定12回合一卷)');
    assert(c1._prompts.length === 3, '④ 3次串行调用(一卷一调)');
    assert(onSec.join(',') === '0/3,1/3,2/3', '⑤ 逐卷回调(终局屏逐卷上屏用)');
    var p1 = c1._prompts[0], p2 = c1._prompts[1], p3 = c1._prompts[2];
    assert(p1.indexOf('纳谏罢矿税') >= 0 && p1.indexOf('河南大旱') >= 0 && p1.indexOf('东林党争起') >= 0, '⑥ 首卷素材=窗内起居注+实录+编年');
    assert(p1.indexOf('流寇逼畿辅') < 0 && p1.indexOf('闯军围城') < 0, '⑦ 窗外素材不混入(12回合窗)');
    assert(p1.indexOf('文言') >= 0 && p1.indexOf('编年直书') >= 0 && p1.indexOf('「上」') >= 0, '⑧ 体例钉死(文言/编年直书/称上)');
    assert(p1.indexOf('赞曰') < 0 || p1.indexOf('唯本卷为末卷') < 0, '⑨ 非末卷无赞曰指令');
    assert(p2.indexOf('前卷之末') >= 0 && p2.indexOf('第1段正文') >= 0, '⑩ 次卷带前卷末文衔接');
    assert(p3.indexOf('赞曰') >= 0 && p3.indexOf('上崩于乱军之中') >= 0, '⑪ 末卷并书身后事+赞曰');
    assert(c1.GM._benji.sections.length === 3 && c1.GM._benji.sections[2].isLast === true, '⑫ 成品入 GM._benji(随终局档)');
    var ft = c1.TM.Benji.fullText(c1.GM);
    assert(ft.indexOf('【卷一·起纪年1 讫纪年12】') >= 0 && ft.indexOf('【卷三') >= 0, '⑬ fullText 按卷编次(起讫纪年)');
    return c1;
  });
}).then(function () {
  // ── 战绩侧留存(匹配 sid+turns 的战绩条) ──
  var c2 = mkCtx();
  c2.localStorage.setItem('tm_playHistory', JSON.stringify([{ sid: 'tianqi7', turns: 36, outcome: '流寇破京' }, { sid: 'other', turns: 5 }]));
  return c2.TM.Benji.compose(c2.GM, {}).then(function () {
    var arr = JSON.parse(c2.localStorage._store['tm_playHistory']);
    assert(arr[0].benji && arr[0].benji.indexOf('【卷一') >= 0, '⑭ 本纪存入战绩条(历代亲历可重读)');
    assert(!arr[1].benji, '⑮ 不误挂他局战绩');
  });
}).then(function () {
  // ── 素材散佚窗：如实短卷指令 ──
  var c3 = mkCtx({ GM: { sid: 's', turn: 24, qijuHistory: [], shijiHistory: [{ turn: 20, shilu: '仅次窗有史料' }], biannianItems: [] } });
  return c3.TM.Benji.compose(c3.GM, {}).then(function (r) {
    assert(r.sections === 2 && c3._prompts[0].indexOf('史阙有间') >= 0, '⑯ 散佚窗如实短卷(勿虚构)');
    assert(c3._prompts[1].indexOf('仅次窗有史料') >= 0, '⑰ 有料窗照常入料');
  });
}).then(function () {
  // ── 中途断卷：已成之卷保留 ──
  var calls = 0;
  var c4 = mkCtx({ callAISmart: function () { calls++; return calls === 1 ? Promise.resolve('首卷成文') : Promise.reject(new Error('网络断')); } });
  return c4.TM.Benji.compose(c4.GM, {}).then(function (r) {
    assert(r.ok === false && r.reason === 'ai_error' && r.sections === 1, '⑱ 中途断卷:已成1卷保留·诚实报未竟');
    assert(c4.GM._benji.sections[0].text === '首卷成文', '⑲ 半卷可读(可重触发续修)');
  });
}).then(function () {
  // ── 静态契约 ──
  console.log('smoke-benji-compose OK — ' + N + ' 断言全绿（12回合一卷/串行衔接/末卷赞曰/散佚短卷/断卷保成/战绩留存/flag闸）');
}).catch(function (e) {
  console.error('SMOKE ERROR:', e && e.stack || e);
  process.exit(1);
});
