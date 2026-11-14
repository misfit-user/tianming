#!/usr/bin/env node
/* eslint-env node */
// smoke-region-status.js — 地块状态系统实跑断言（2026-06-12）
// 验：normalize 硬闸（econPct/minxin/工期封顶）→ add 同源替换/上限 → econMult →
//     tick（过期/民心摊叶/繁荣缓变；扫游戏里那份与剧本库那份、同一州只结一次；地板顶只拦往那一头走）→
//     建筑钩子（工成投利/失修撤/拆毁撤）→
//     cascade 乘子 vm 实跑 → 五处接线源码契约。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js')); // 注册 globalThis.TM.FieldPipes（近账 ledger 依赖）
const RS = require(path.join(WEB, 'tm-region-status.js'));

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}

// ── 1. normalize 硬闸 ──
const n1 = RS.normalize({ kind: 'disaster', name: '蝗灾', econPct: -0.9, minxinPerTurn: -9, durationTurns: 99 }, { turn: 5 });
ok(n1.econPct === -0.25, 'econPct -90% 夹到 -25%');
ok(n1.minxinPerTurn === -2, '民心 -9 夹到 -2/回合');
ok(n1.expiresTurn === 29, '工期 99 夹到 24（5+24=29）');
ok(RS.normalize({ kind: 'wonder' }, { turn: 1 }) === null, '无名状态不立账');
ok(RS.normalize({ name: '空效', kind: 'event' }, { turn: 1 }) === null, '全空效果且无叙述不立账');
const n2 = RS.normalize({ name: '永续观', kind: 'wonder', econPct: 0.1 }, { turn: 3 });
ok(n2.expiresTurn === null && n2.kind === 'wonder', '缺省工期 = 永续');
ok(RS.normalize({ name: 'X', kind: '邪门类', econPct: 0.1 }, { turn: 1 }).kind === 'event', '未知 kind 归风云');

// ── 2. add：同源同名替换 + 每地上限 ──
const div = { name: '河南', minxin: 60, prosperity: 50 };
RS.add(div, { kind: 'event', name: '丰年', econPct: 0.1 }, { turn: 1 });
RS.add(div, { kind: 'event', name: '丰年', econPct: 0.05 }, { turn: 2 });
ok(div.statusEffects.length === 1 && div.statusEffects[0].econPct === 0.05, '同源同名替换不重复立账');
for (let i = 0; i < 15; i++) RS.add(div, { kind: 'event', name: '杂事' + i, econPct: 0.01 }, { turn: 3 });
ok(div.statusEffects.length === 12, '每地状态封顶 12 条');
ok(Array.isArray(div._fieldLedger.status), 'S7 近账：状态立账入环账');

// ── 3. econMult ──
const d2 = { statusEffects: [{ econPct: 0.1 }, { econPct: -0.05 }] };
ok(RS.econMult(d2) === 1.045, '乘子 1.1×0.95 = 1.045（4 位精度）');
ok(RS.econMult({}) === 1, '零状态乘子 = 1（行为不变）');
const d3 = { statusEffects: [{ econPct: 0.25 }, { econPct: 0.25 }, { econPct: 0.25 }, { econPct: 0.25 }] };
ok(RS.econMult(d3) === 1.6, '乘子封顶 1.6');

// ── 4. tick：过期 / 民心摊叶 / 繁荣缓变 ──
const td = {
  name: '山东', minxin: 60, prosperity: 50,
  statusEffects: [
    { id: 'a', kind: 'disaster', name: '水患', econPct: -0.2, minxinPerTurn: -1, expiresTurn: 11 },
    { id: 'b', kind: 'event', name: '将过期', econPct: 0.1, minxinPerTurn: 0, expiresTurn: 10 }
  ]
};
const tP = { adminHierarchy: { player: { divisions: [td] } } };
let st = RS.tick({ turn: 10 }, tP);
ok(td.statusEffects.length === 1 && td.statusEffects[0].id === 'a', '到期状态清除（expiresTurn=10·turn=10）');
ok(st.expired === 1, 'tick 统计 expired');
ok(td.minxin === 59, '状态民心 -1 摊叶 60→59');
// 繁荣缓变：minxin 59 → +0.08；econMult 0.8 → -0.8；净 -0.72 → 50-0.72=49.28
ok(td.prosperity === 49.28, '繁荣缓变：灾异之地 50→49.28（民心+状态乘子合算）');
ok(Array.isArray(td._fieldLedger.prosperity), 'S7 近账：繁荣缓变入环账');
// 无 prosperity 字段不凭空造
const td2 = { name: '无繁荣', minxin: 80, statusEffects: [{ kind: 'event', name: '祥瑞', econPct: 0.2, minxinPerTurn: 0, expiresTurn: null }] };
tP.adminHierarchy.player.divisions.push(td2);
RS.tick({ turn: 11 }, tP);
ok(td2.prosperity === undefined, '无 prosperity 字段不凭空造字段');

// ── 4b. tick 扫两份区划（11-14·同志定「乙」）：游戏里那份（GM.adminHierarchy，开局、读档是剧本库那份的深拷贝）上挂的状态
//   照样过期、摊民心、繁荣缓变；剧本库那份（P.adminHierarchy）照旧扫；同一州只结一次 ──
const gLeaf = { name: '延安府', minxin: 30, prosperity: 40, statusEffects: [
  { id: 'r', kind: 'disaster', name: '民变扰攘', econPct: -0.04, minxinPerTurn: -0.4, expiresTurn: 12, source: 'revolt' },
  { id: 'q', kind: 'disaster', name: '流寇劫掠', econPct: -0.1, minxinPerTurn: -1, expiresTurn: 11, source: 'roving' }
] };
const pLeaf = { name: '延安府', minxin: 15, prosperity: 40 };   // 剧本库那份：同名、另一个对象、没挂状态
const gGM = { turn: 11, adminHierarchy: { player: { divisions: [{ name: '陕西', children: [gLeaf] }] } } };
const gP = { adminHierarchy: { player: { divisions: [{ name: '陕西', children: [pLeaf] }] } } };
const st4b = RS.tick(gGM, gP);
ok(gLeaf.statusEffects.length === 1 && gLeaf.statusEffects[0].id === 'r' && st4b.expired === 1, '游戏里那份：到期的「流寇劫掠」撤掉（原先只扫剧本库那份，挂上就永远压征收）');
ok(gLeaf.minxin === 29.6, '游戏里那份：状态民心 −0.4 落到州上 30→29.6（实得 ' + gLeaf.minxin + '）');
// 繁荣：民心 29.6 → (29.6−55)×0.02＝−0.508；乘子 0.96 → −0.16；净 −0.668 → 39.33
ok(gLeaf.prosperity === 39.33, '游戏里那份：繁荣缓变 40→39.33（实得 ' + gLeaf.prosperity + '）');
ok(pLeaf.minxin === 15 && pLeaf.prosperity === 39.2, '剧本库那份照旧扫（没挂状态，只繁荣缓变 40→39.2）');
const shared = { name: '开封府', minxin: 50, statusEffects: [{ id: 's', kind: 'disaster', name: '水患', econPct: 0, minxinPerTurn: -1, expiresTurn: null }] };
const sharedAH = { player: { divisions: [shared] } };
RS.tick({ turn: 5, adminHierarchy: sharedAH }, { adminHierarchy: sharedAH });
ok(shared.minxin === 49, '两份是同一对象：同一州只结一次 50→49（实得 ' + shared.minxin + '）');
const shared2 = { name: '归德府', minxin: 50, statusEffects: [{ id: 's2', kind: 'disaster', name: '水患', econPct: 0, minxinPerTurn: -1, expiresTurn: null }] };
const P2 = { adminHierarchy: { player: { divisions: [shared2] } } };
RS.tick({ turn: 5, adminHierarchy: { player: P2.adminHierarchy.player } }, P2);
ok(shared2.minxin === 49, '两份共用同一州对象：也只结一次 50→49（实得 ' + shared2.minxin + '）');

// ── 4c. 地板 20、顶 100 只拦往那一头走（11-14）：本就低于 20 的州，负的状态不再把它抬回 20；正的不再一下拉到 20 ──
const mkMx = (mx) => ({ name: 'd' + mx, minxin: mx });
const low = mkMx(11), mid = mkMx(25), edge = mkMx(20.2), upLow = mkMx(11);
[low, mid, edge].forEach((d) => RS.add(d, { name: '民变扰攘', kind: 'disaster', minxinPerTurn: -0.4, durationTurns: 2, source: 'revolt' }, { turn: 3 }));
RS.add(upLow, { name: '赈济', kind: 'player', minxinPerTurn: 0.5, durationTurns: 2, source: 'relief' }, { turn: 3 });
RS.tick({ turn: 3 }, { adminHierarchy: { player: { divisions: [low, mid, edge, upLow] } } });
ok(low.minxin === 11, '民心 11 遇 −0.4：不再被抬到 20（实得 ' + low.minxin + '）');
ok(mid.minxin === 24.6, '民心 25 遇 −0.4 → 24.6');
ok(edge.minxin === 20, '民心 20.2 遇 −0.4：停在地板 20');
ok(upLow.minxin === 11.5, '民心 11 遇 +0.5 → 11.5（不再一下拉到 20）');

// ── 5. 建筑钩子（require building-works·statusApi 经 globalThis.TM 找到本模块）──
const BW = require(path.join(WEB, 'tm-building-works.js'));
const bd = {
  name: '湖北', minxin: 60,
  economyBase: { commerceVolume: 10000 },
  publicTreasury: { money: { stock: 99999, available: 99999 } },
  buildings: [{ name: '织造大坊', level: 1, status: 'building', remainingTurns: 1, costActual: 30000 }]
};
const bP = { buildingSystem: { enabled: true, buildingTypes: [] }, adminHierarchy: { player: { divisions: [bd] } } };
BW.tick({ turn: 20 }, bP);
const grant = (bd.statusEffects || []).find(e => e.name.indexOf('织造大坊') >= 0);
ok(!!grant && grant.kind === 'building', '完工投「工成之利」状态');
ok(grant.econPct === 0.015, '之利幅度 = cost/200万 = 1.5%');
// 失修撤
bd.publicTreasury.money.stock = 0; bd.publicTreasury.money.available = 0;
BW.tick({ turn: 21 }, bP); BW.tick({ turn: 22 }, bP); BW.tick({ turn: 23 }, bP);
ok(bd.buildings[0].status === 'neglected', '连欠失修（前置）');
ok(!(bd.statusEffects || []).some(e => e.name.indexOf('织造大坊') >= 0), '失修 → 之利撤');
// 修缮复用复挂
bd.publicTreasury.money.stock = 99999;
BW.tick({ turn: 24 }, bP);
ok((bd.statusEffects || []).some(e => e.name.indexOf('织造大坊') >= 0), '修缮复用 → 之利复挂');
// 拆毁撤
BW.revertBuilding(bd, bd.buildings[0]);
ok(!(bd.statusEffects || []).some(e => e.name.indexOf('织造大坊') >= 0), '拆毁 → 之利撤');

// ── 6. cascade 乘子 vm 实跑 ──
const fiscalSrc = fs.readFileSync(path.join(WEB, 'tm-fiscal-engine.js'), 'utf8').replace(/\r\n/g, '\n');
const i0 = fiscalSrc.indexOf('function taxBase(div, tax)');
const i1 = fiscalSrc.indexOf('function splitCascadeAmount');
const ctx = {
  safeNumber: function (v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); },
  _ensureEconomyBase: function (d) { return (d && d.economyBase) || {}; },
  TM: { RegionStatus: RS },
  window: undefined, console: console
};
ctx.global = ctx; // Preserve the real fiscal IIFE closure while testing the extracted function.
vm.createContext(ctx);
vm.runInContext(fiscalSrc.slice(i0, i1) + '\nthis.__cta = computeTaxAmount;', ctx);
const landTax = { base: 'land', rate: 0.1 };
ok(ctx.__cta({ economyBase: { farmland: 100000 } }, landTax, {}) === 10000, '零状态：田 10 万×10% = 10000（行为不变）');
ok(ctx.__cta({ economyBase: { farmland: 100000 }, statusEffects: [{ econPct: -0.2 }] }, landTax, {}) === 8000, '灾异 -20% → 8000（状态→经济闭环）');
ok(ctx.__cta({ economyBase: { farmland: 100000 }, statusEffects: [{ econPct: 0.1 }] }, landTax, {}) === 11000, '奇观 +10% → 11000');

// ── 7. cascade 归零病修 vm 实跑：claimedTotal=0 不抹账 ──
const j0 = fiscalSrc.indexOf('function cascadeDivision(div, taxes, ctx, ledgers, totals, G)');
const j1 = fiscalSrc.indexOf('function aggregateParentFiscal');
ok(j0 > 0 && j1 > j0, 'cascadeDivision 源码段可抽出');
const idleGuard = fiscalSrc.slice(j0, j1).includes('claimedTotal <= 0 && actualTotal <= 0');
ok(idleGuard, 'cascade 一文未征不抹账守卫在位');

// ── 8. 接线源码契约 ──
function srcHas(file, re, msg) {
  const s = fs.readFileSync(path.join(WEB, file), 'utf8');
  ok(re.test(s), msg);
}
srcHas('tm-endturn-core.js', /TM\.RegionStatus\.tick/, 'endturn-core：RegionStatus.tick 挂载');
srcHas('index.html', /tm-region-status\.js/, 'index.html：模块已挂载');
srcHas('tm-endturn-apply.js', /region_status_changes/, 'apply：AI 状态通道处理器');
srcHas('tm-endturn-prompt.js', /region_status_changes/, 'prompt：状态通道教学');
srcHas('tm-ai-schema.js', /region_status_changes/, 'schema：状态通道声明');
srcHas('tm-ai-output-validator.js', /region_status_changes/, 'validator：状态通道白名单');
srcHas('phase8-formal-map-dossier.js', /bk-zhuangkuang/, '方志：状态卷接线（第二十五拆迁至 dossier sibling）');
srcHas('phase8-formal-map-dossier.js', /armyRegionIndex/, '方志：军地绑定索引接线（第二十五拆迁至 dossier sibling）');
srcHas('phase8-formal-bridge-styles.js', /bk-zt-list/, 'CSS：状态卡样式注入'); // 第二十七拆·CSS迁出至 -styles 片
srcHas('phase8-formal-bridge-styles.js', /bk-jun-list/, 'CSS：活军卡样式注入'); // 第二十七拆·CSS迁出至 -styles 片

console.log('\n[smoke-region-status] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
