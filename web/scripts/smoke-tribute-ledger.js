#!/usr/bin/env node
'use strict';
// smoke-tribute-ledger — 封建持有年贡、羁縻贡赋一年一次、走帑廪册（11-10）
//   原先每逢正月直接加到 guoku.money、不记账；一回合不足一月的剧本（晚唐十天一回合）正月里要交好几回；
//   封建持有忠诚低于 0.15 时每月 2% 随机记「叛」——只改一个没人读的状态、写一行字。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function sliceFn(src, marker) { const a = src.indexOf(marker); if (a < 0) return null; let i = src.indexOf('{', a), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(a, j); }

console.log('smoke-tribute-ledger');
const ethnic = fs.readFileSync(path.join(ROOT, 'tm-ethnic-religion.js'), 'utf8');
const feudal = fs.readFileSync(path.join(ROOT, 'tm-feudal-warfare.js'), 'utf8');
const jimiSrc = sliceFn(ethnic, 'function _tickJimiHoldings(');
const typesSrc = sliceFn(feudal, 'var FEUDAL_HOLDING_TYPES = {');
const feudalSrc = sliceFn(feudal, 'function _tickFeudalHoldings(');
ok(jimiSrc && typesSrc && feudalSrc, '三段源码抽取成功');
ok(!/guoku\.money\s*=/.test(jimiSrc + feudalSrc), '两处都不再直接改 guoku.money');

// 晚唐式：十天一回合，正月有三回合，只有跨年那一回合算新年
function run(holdings, jimi, turns, yearTurns) {
  const calls = [], events = [];
  const GM = { turn: 0, month: 1, guoku: { money: 1000 }, huangwei: { index: 50 }, feudalHoldings: holdings, population: { jimiHoldings: jimi } };
  const ctx = {
    Math: Object.assign(Object.create(Math), { random: () => 0 }), Number, Object, Array, isFinite,
    GM, FiscalEngine: { addToGuoku: (amt, tag) => { calls.push({ amt, tag }); return { ok: true }; } },
    isYearBoundary: (t) => yearTurns.indexOf(t) >= 0,
    addEB: (cat, text) => events.push(cat + ':' + text)
  };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(typesSrc + ';\n' + feudalSrc + '\nvar global = this;\n' + jimiSrc + '\nthis.tickFeudal = _tickFeudalHoldings; this.tickJimi = _tickJimiHoldings;', ctx);
  for (let t = 1; t <= turns; t++) { GM.turn = t; GM.month = 1; ctx.tickFeudal({}, 1 / 3); ctx.tickJimi({}, 1 / 3); }
  return { calls, events, GM };
}

{
  const fh = { name: '某封国', type: 'imperial_clan', tribute: { annual: 30000 }, loyalty: 0.1 };
  const r = run([fh], [], 3, [1]);
  const tribute = r.calls.filter((c) => c.tag === '藩属年贡');
  ok(tribute.length === 1 && tribute[0].amt.money === 30000, '正月三回合只交一次年贡，走帑廪册「藩属年贡」');
  ok(r.GM.guoku.money === 1000, 'guoku.money 不被直接加');
  ok(fh.status === undefined && !r.events.some((e) => /叛/.test(e)), '忠诚 0.1、随机数恒为 0：不再随机记「叛」');
}
{
  const r = run([], [{ name: '某土司', autonomy: 0.7, tribute: { annual: 8000 }, loyalty: 60 }, { name: '远土司', autonomy: 0.9, tribute: { annual: 5000 } }], 3, [1]);
  const tribute = r.calls.filter((c) => c.tag === '羁縻贡赋');
  ok(tribute.length === 1 && tribute[0].amt.money === 8000, '羁縻：自治七成的一年贡一次，走「羁縻贡赋」；自治九成的不贡');
}
{
  const r = run([{ name: '某封国', type: 'imperial_clan', tribute: { annual: 30000 } }], [], 3, []);
  ok(r.calls.length === 0, '不跨年的回合不交');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
