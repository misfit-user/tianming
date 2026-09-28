#!/usr/bin/env node
'use strict';
/* smoke-agency-watch — 密探常侦(S4·2026-07-02)
 * 常设直属天子密探机构(corruption.supervision.institutions·独立性≤30)在阴谋引擎 tick 内
 * 逐回合确定性推高在酿阴谋败露。常侦默认开启，显式关闭后 exposure 不变。
 * 不复用 _sweep：常侦静默积累 exposure·不置 _knownToPlayer(不向玩家亮牌)。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const W = path.join(__dirname, '..');

let A = 0, F = 0;
function ok(cond, msg) { if (cond) { A++; console.log('  ✓ ' + msg); } else { F++; console.log('  ✗ ' + msg); } }

const src = fs.readFileSync(path.join(W, 'tm-conspiracy.js'), 'utf8');
const sandbox = { console: console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const CE = sandbox.ConspiracyEngine;
ok(!!CE && typeof CE._agencyWatch === 'function', '引擎加载·_agencyWatch 已导出');

function mkG(insts) {
  return {
    turn: 10,
    _activePlots: [{ ringleader: '某甲', conspirators: [], exposure: 20, momentum: 50, secrecy: 70 }],
    corruption: { supervision: { institutions: insts } }
  };
}
const FULL = { independence: 5, radius: 100, corruption: 20, vacancies: 0.1 };  // 东厂形制

// ① flag 关 → 0·exposure 不动（零回归）
sandbox.P = { conf: { agencyWatchEnabled: false } };
let G = mkG([FULL]);
ok(CE._agencyWatch(G) === 0 && G._activePlots[0].exposure === 20, '① flag 关 → 无效果(零回归)');
ok(CE._agencyWatchOn() === false, '① 显式关闭常侦仍生效');

// ② flag 开 + 直属密探机构 → 确定性侦缉
sandbox.P = { conf: { agencyWatchEnabled: true } };
G = mkG([FULL]);
let it = CE._agencyWatch(G);
ok(it === 5, '② 东厂形制(radius100·腐败20·缺员0.1) → 强度=' + it + '(期望5·round(6×1×0.86×0.9))');
ok(G._activePlots[0].exposure === 25, '② exposure 20→25 确定性加法');
ok(!G._activePlots[0]._knownToPlayer, '② 常侦静默·不置 _knownToPlayer(不亮牌)');

// ③ 台谏(独立性高) → 不做暗侦
G = mkG([{ independence: 60, radius: 70, corruption: 10, vacancies: 0 }]);
ok(CE._agencyWatch(G) === 0 && G._activePlots[0].exposure === 20, '③ 独立性60(台谏) → 不侦缉');

// ④ 多机构叠加封顶 agencyCap
G = mkG([{ independence: 5, radius: 100, corruption: 0, vacancies: 0 }, { independence: 10, radius: 100, corruption: 0, vacancies: 0 }, { independence: 20, radius: 100, corruption: 0, vacancies: 0 }]);
it = CE._agencyWatch(G);
ok(it === 16, '④ 三满效机构 18→封顶 ' + it + '(期望16=agencyCap)');

// ⑤ 机构烂透(腐败100) → 效力大折但不为负
G = mkG([{ independence: 5, radius: 100, corruption: 100, vacancies: 0 }]);
it = CE._agencyWatch(G);
ok(it === 2, '⑤ 腐败100 → 强度=' + it + '(期望2=round(6×0.3)·烂衙门只剩三成眼线)');

// ⑥ 无机构/空数组 → 0
G = mkG([]);
ok(CE._agencyWatch(G) === 0, '⑥ 无机构 → 0');
G = { turn: 10, _activePlots: [] };
ok(CE._agencyWatch(G) === 0, '⑥ 无 corruption 结构 → 0 安全');

// ⑥b S2·密探回禀：露端倪之谋 → 御案递密报(每谋一报)
G = mkG([FULL]);
G.currentIssues = [];
G._activePlots[0]._knownToPlayer = true;
G._activePlots[0].momentum = 80;
CE._agencyWatch(G);
ok(G.currentIssues.length === 1 && /密探回禀/.test(G.currentIssues[0].title), '⑥b 露端倪之谋 → 御案密报');
ok(/事似将发/.test(G.currentIssues[0].description) && /查办/.test(G.currentIssues[0].description), '⑥b 措辞留白+查办指引');
CE._agencyWatch(G);
ok(G.currentIssues.length === 1, '⑥b 每谋一报·不重复');
G = mkG([FULL]);
G.currentIssues = [];
CE._agencyWatch(G);
ok(G.currentIssues.length === 0, '⑥b 未露端倪(静默常侦中) → 不回禀');
G = mkG([FULL]);
G._activePlots[0]._knownToPlayer = true;
ok(CE._agencyWatch(G) > 0, '⑥b 无 currentIssues 数组 → 安全跳过不炸');

// ⑦ CFG 可调项就位
ok(CE.CFG.agencyBase === 6 && CE.CFG.agencyCap === 16 && CE.CFG.agencyIndepMax === 30, '⑦ CFG agency* 三项可调');

// ⑧ tick 接线契约：applyPlayerCounterIntel 之后调 _agencyWatch
const tickSeg = src.slice(src.indexOf('function tick('), src.indexOf('function activePlots'));
ok(/applyPlayerCounterIntel\(G\);[\s\S]*_agencyWatch\(G\);[\s\S]*_spawn\(/.test(tickSeg), '⑧ tick 内序:反制→常侦→萌发');

// ⑨ 设置面板契约
const patchesSrc = (fs.readFileSync(path.join(W, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(W, 'tm-patches-start.js'), 'utf8'));
ok(patchesSrc.indexOf("'agencyWatchEnabled'") >= 0 && /密探常侦/.test(patchesSrc), '⑨ 设置「玩法机制·深化」有开关');

console.log('\n' + (F === 0 ? 'ALL PASS' : 'FAIL') + ' (' + A + ' pass / ' + F + ' fail)');
process.exit(F === 0 ? 0 : 1);
