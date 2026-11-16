/* smoke-renli-prompt-context.js — 刀D·Renli 役政农情喂 AI 上下文
 * 验：① 未推行役政→formatForPrompt 返 null（休眠零注入）② 种子省→真值摘要（役负/缺粮/抛荒/逃亡 标签）
 *   ③ 危情重者排前（severity 序）④ §5 全崩→★濒乱标记 ⑤ 未种子地域不入摘要 ⑥ limit 限额 ⑦ 装配接线 ⑧ 中立
 * 跑：node scripts/smoke-renli-prompt-context.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.TM = global.TM || {};
var R = require('../tm-renli.js');

// ── T1 未激活→null ──
global.P = { adminHierarchy: { player: { divisions: [
  { id: 'div_x', name: '某府', populationDetail: { ding: 100000, fugitives: 0 } } // 无 renliSeed
] } } };
var GM0 = { turn: 5, renli: { byRegion: {}, reported: {} } };
ok(R.formatForPrompt(GM0, { limit: 10 }) === null, '1·无已种子地域→formatForPrompt 返 null（未激活·AI 零注入）');

// ── 种子局 ──
global.P = { adminHierarchy: { player: { divisions: [
  { id: 'div_xa', name: '西安府', renliSeed: { soilBase: 60 }, populationDetail: { ding: 100000, fugitives: 30000 } }, // 重灾
  { id: 'div_ya', name: '延安府', renliSeed: { soilBase: 55 }, populationDetail: { ding: 80000, fugitives: 0 } },     // 安
  { id: 'div_song', name: '松江府', populationDetail: { ding: 100000, fugitives: 1000 } }                              // 未种子
] } } };
var GM = { turn: 8, renli: { byRegion: {
  div_xa: { corveeRate: 0.45, foodNeed: 100000, foodDeficit: 60000, fallowLand: 50000, deficitTurns: 3, levyPolicy: {} },
  div_ya: { corveeRate: 0.15, foodNeed: 80000, foodDeficit: 0, fallowLand: 0, deficitTurns: 0, levyPolicy: {} }
}, reported: {} } };

var out = R.formatForPrompt(GM, { limit: 10 });
ok(typeof out === 'string' && out.indexOf('役政农情') >= 0, '2·种子局→真值摘要带表头「役政农情」');
ok(out.indexOf('西安府') >= 0 && out.indexOf('延安府') >= 0, '2·两已种子府均入摘要');
ok(out.indexOf('松江府') < 0, '5·★未种子松江府不入摘要（门控种子省）');
// 西安府 标签
ok(/西安府[：:].*役负苛\(45%\)/.test(out), '2·西安府 役负苛(45%)·实得 ' + (out.match(/西安府[^\n]*/) || [''])[0]);
ok(out.indexOf('缺粮60%') >= 0, '2·西安府 缺粮60%');
ok(out.indexOf('抛荒50000亩') >= 0, '2·西安府 抛荒50000亩');
ok(out.indexOf('逃亡30%') >= 0, '2·西安府 逃亡30%');
ok(out.indexOf('★流民载道·濒乱') >= 0, '4·§5全崩(逃亡30%>20% ∧ 连续亏空3≥2)→★濒乱标记（门生密报口径喂 AI）');
// 延安府 标签
ok(/延安府[：:].*役负轻\(15%\)/.test(out), '2·延安府 役负轻(15%)');
ok(/延安府[：:].*粮足/.test(out), '2·延安府 粮足');
// 排序：西安府(危)在 延安府(安)前
ok(out.indexOf('西安府') < out.indexOf('延安府'), '3·危情重者排前（西安府在延安府之前）');

// ── T6 limit 限额（worst-first）──
var out1 = R.formatForPrompt(GM, { limit: 1 });
ok(out1.indexOf('西安府') >= 0 && out1.indexOf('延安府') < 0, '6·limit=1→只留最危的西安府');

// ── T7 装配接线 + T8 中立 ──
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'tm-renli.js'), 'utf8');
var fpBody = src.slice(src.indexOf('function formatForPrompt'), src.indexOf('function formatForPrompt') + 1400);
ok(!/天启|陕西|延安|西安|sc-tianqi/.test(fpBody), '8·formatForPrompt 无朝代/地名硬编（中立·地名来自数据）');

console.log('\n[smoke-renli-prompt-context] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
