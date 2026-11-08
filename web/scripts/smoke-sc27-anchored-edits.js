#!/usr/bin/env node
// sc27 叙事审查 smoke：改句、增补按原句锚定就地施用，不再整段接在正文后面（原段与重写段并存、读来重复）；
// 诏令原句不改；改动同时落到 sc2 结果（记录收口 preserveNarrative 先取 sc2），否则会被盖回。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const src = fs.readFileSync(path.join(WEB, 'tm-endturn-followup.js'), 'utf8');
const c = { console: { log() {}, warn() {}, error() {} }, TM: {} };
c.window = c;
c.globalThis = c;
vm.createContext(c);
vm.runInContext(src, c, { filename: 'tm-endturn-followup.js' });
const ns = c.TM.Endturn.AI.followup;
ok(typeof ns._sc27AnchoredEdits === 'function' && typeof ns._sc27ApplyEdits === 'function', '助手挂在 TM.Endturn.AI.followup');

const text = '天启七年九月，京师秋雨连绵。帝坐文华殿，召阁臣议事，众皆默然。是日黄昏，司礼监奏事毕退。'
  + '有旨：着户部即发太仓银十万两赈济陕西饥民。';
const edict = '诏：着户部即发太仓银十万两赈济陕西饥民。';

// ── 1. 改句就地替换、增补接在锚句之后，正文不重复 ──
{
  const r = ns._sc27AnchoredEdits(text, {
    rewrites: [{ original: '召阁臣议事，众皆默然', revised: '召阁臣议辽事，诸臣面面相觑，久之无一言' }],
    additions: [{ after: '京师秋雨连绵。', text: '宫檐滴水，彻夜未歇。' }]
  }, edict);
  eq(r.skipped, 0, '两条都认得');
  const out = ns._sc27ApplyEdits(text, r.edits);
  ok(out.indexOf('召阁臣议辽事，诸臣面面相觑，久之无一言。') >= 0 && out.indexOf('众皆默然') < 0, '改句就地替换，原句不留');
  ok(out.indexOf('京师秋雨连绵。宫檐滴水，彻夜未歇。帝坐文华殿') >= 0, '增补接在锚句之后');
  eq(out.length, text.length + '辽'.length + '诸臣面面相觑，久之无一言'.length - '众皆默然'.length + '宫檐滴水，彻夜未歇。'.length, '没有整段另写一遍');
}

// ── 2. 照录不准、出现多次、太短、诏令原句：一律不动 ──
{
  const r = ns._sc27AnchoredEdits(text, {
    rewrites: [
      { original: '召阁臣议事，诸臣默然', revised: '甲' },          // 照录不准
      { original: '着户部即发太仓银十万两', revised: '着户部速发帑银' }, // 诏令原句
      { original: '九月', revised: '秋九月' }                       // 太短
    ],
    additions: [{ after: '。', text: '乙' }]                         // 锚句太短、又多处出现
  }, edict);
  eq(r.edits.length, 0, '一条都不施用');
  eq(r.skipped, 4, '四条都记为跳过');
}

// ── 3. 旧字段没有锚点，不进正文 ──
{
  const r = ns._sc27AnchoredEdits(text, { rewritten_passages: '重写的整段……', added_details: '补充的细节……' }, edict);
  eq(r.edits.length, 0, '旧字段 rewritten_passages/added_details 不再接到正文后面');
}

// ── 4. 接线：旧的追加写法已去掉；改动同时落到 sc2 结果，免被记录收口盖回 ──
{
  ok(!/zhengwen = zhengwen \+ '\\n\\n' \+ p27\.rewritten_passages/.test(src), '旧的整段追加已去掉');
  const at = src.indexOf('var _ed27 = _sc27AnchoredEdits(zhengwen, p27, _edictText27);');
  ok(at > 0, 'sc27 用锚定改句');
  const tail = src.slice(at, at + 1200);
  ok(/hourenXishuo = _sc27ApplyEdits\(hourenXishuo, _ed27\.edits\)/.test(tail), '后人戏说一并改');
  ok(/p2\[k\] = _sc27ApplyEdits\(p2\[k\], _ed27\.edits\)/.test(tail), 'sc2 结果里的正文字段一并改');
  ok(/"rewrites":\[\{"original"/.test(src) && /"additions":\[\{"after"/.test(src), '提示词要原句照录的改句与增补');
}

console.log('smoke-sc27-anchored-edits ok checks=' + checks);
