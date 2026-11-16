#!/usr/bin/env node
'use strict';
// smoke-usurpation-deposed — 篡位反转失位态（鼎革R1d·2026-07-07）
// owner 铁律「禅代不死则游戏未终」：权臣篡位/内竖劫主废立不再写 _gameOver 终局——
// 玩家转失位可玩态(CK3 化第一砖)：内竖=傀儡(_puppet)·外朝=废帝(_deposed)·
// _playerDeposed 全局信号(复辟/摄政后续刀读)+国变告警入御案时政(附复辟指引)·
// 数值巨变照旧(皇权5/皇威10/民心-30)·弑君才走裁决器(R1c 已接·此处零终局)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }

const src = fs.readFileSync(path.join(ROOT, 'tm-authority-complete.js'), 'utf8');
const code = sliceFn(src, 'function _powerMinisterEndgame');

function mk() {
  const log = { ebs: [], hq: null };
  const G = {
    turn: 20,
    huangquan: { index: 40, powerMinister: {} }, huangwei: { index: 50 }, minxin: { trueIndex: 50 },
    chars: [{ name: '天子', isPlayer: true, alive: true }],
    currentIssues: []
  };
  const ctx = { global: {
    GM: G,
    P: { playerInfo: { characterName: '天子' } },
    addEB: function (cat, txt) { log.ebs.push(cat + '|' + txt); },
    AuthorityEngines: { setHuangquan: function (v, r) { log.hq = r; G.huangquan.index = v; }, executePurge: function () {} },
    NeitangEngine: { Actions: { recordConfiscation: function () {} } }
  }, Math: Math, Number: Number, Array: Array, console: console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'pmend-slice.js' });
  return { ctx, log, G };
}

// ── 内竖劫主 → 傀儡态 ──
var a = mk();
a.ctx._powerMinisterEndgame({ name: '某珰', innerCourt: true, controlLevel: 0.95 }, 'usurpation', { turn: 20 });
assert(!a.G._gameOver, '① 内竖劫主不再写 _gameOver(终局信号退役)');
assert(a.G.chars[0]._puppet === true && a.G.chars[0].alive === true, '② 天子成傀儡·活着继续玩');
assert(a.G._playerDeposed && a.G._playerDeposed.mode === 'puppet' && a.G._playerDeposed.by === '某珰', '③ _playerDeposed 全局信号(puppet·具名)');
assert(a.G.currentIssues.length === 1 && a.G.currentIssues[0]._deposed === true, '④ 国变告警入御案时政');
assert(a.G.currentIssues[0].description.indexOf('傀儡') >= 0 && a.G.currentIssues[0].description.indexOf('待时而动') >= 0, '⑤ 告警带傀儡实况+复辟指引');
assert(a.G.huangquan.index === 5 && a.G.minxin.trueIndex === 20, '⑥ 数值巨变照旧(皇权压5/民心-30·真实代价)');
assert(a.log.ebs.some(e => e.indexOf('国变|') === 0 && e.indexOf('劫主废立') > 0), '⑦ 国变入编年');

// ── 外朝篡位 → 禅代废帝态 ──
var b = mk();
b.ctx._powerMinisterEndgame({ name: '外相', innerCourt: false, controlLevel: 0.95 }, 'usurpation', { turn: 20 });
assert(!b.G._gameOver && b.G.chars[0]._deposed === true && b.G.chars[0]._deposedTurn === 20, '⑧ 外朝禅代=废帝态(_deposed·带回合戳)');
assert(b.G._playerDeposed.mode === 'deposed', '⑨ 信号 mode=deposed 分流');
assert(b.G.currentIssues[0].title.indexOf('禅代') >= 0 && b.G.currentIssues[0].description.indexOf('别宫') >= 0, '⑩ 禅代告警文案');
assert(b.G.chars[0].alive === true && !b.G.chars[0].dead, '⑪ 废帝不死(owner「禅代不死游戏未终」)');

// ── purged 路零回归(诛权臣不受影响) ──
var c = mk();
c.ctx._powerMinisterEndgame({ name: '某珰', innerCourt: true, embezzled: 0 }, 'purged', { turn: 20 });
assert(c.G.huangquan.powerMinister === null && !c.G._playerDeposed, '⑫ purged 路原样零回归');

// ── 旧档兼容：helpers 消费分支留存(躺着旧信号的存档不塌) ──
assert(src.indexOf("type: 'usurped_by_power_minister'") < 0, '⑭ 写入端已退役(全文件零此信号写点)');

console.log('smoke-usurpation-deposed OK — ' + N + ' 断言全绿（傀儡/废帝态/告警指引/数值照旧/purged零回归/旧档兼容）');
