#!/usr/bin/env node
// smoke-faction-event-ripple.js
// 验证「势力大事涟漪」(批丙·C1) + 「势力覆灭涟漪」(批丙·C2)：
//   C1 六类扫描(占府/入寇/宣战/民变/拒抚·受抚/条约)各触发+窗外不触发·幂等·24 封顶·玩家/死者跳过·占府三受众·
//     拒抚/招安双向·条约类型分流·仅牵涉玩家的战争/条约才反应·零 world-ledger 写入。
//   C2 覆灭涟漪成员(树倒猢狲散 哀imp7+loyalty-3+stress+8+心绪) + 京中高品(敌覆喜/友覆忧)·幂等·跳过死者/玩家。
//   C3 死链退役契约：army:defeat 无 emitter·world-reactors 承载·不复活(反双扣)。
// 手法:从 tm-endturn-helpers.js 花括号配平抽**真**函数·配桩 GM/记忆/忠诚/promotion/bridge 实跑·非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const SRC = fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8');
const APPLY = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
const EXT = fs.readFileSync(path.join(ROOT, 'tm-three-systems-ext.js'), 'utf8');
const RECON = fs.readFileSync(path.join(ROOT, 'generated/tm-ai-change-applier.bundle.js'), 'utf8');

// ═══════════════════ ① 源契约 ═══════════════════
ok(/function _factionEventRipple\(\)/.test(SRC), '契约:_factionEventRipple 定义存在');
ok(/SettlementPipeline\.register\('factionEventReact', '势力大事涟漪'.*90.*'perturn'\)/.test(SRC), '契约:C1 注册 factionEventReact/priority90/perturn');
ok(/function _factionCollapseRipple\(facName\)/.test(SRC), '契约:_factionCollapseRipple 定义存在');
ok(/GameEventBus\.on\('faction:defeated'/.test(SRC) && /GameEventBus\.on\('faction:collapse'/.test(SRC), '契约:C2 订阅 faction:defeated + faction:collapse 两 emitter');
ok(/_collapseRippleReacted/.test(SRC), '契约:C2 共享幂等标记 _collapseRippleReacted');
ok(/var CAP = 24/.test(SRC), '契约:单回合总封顶 24');
// 六类事件对象幂等标记
['_occupyRippleReacted', '_invRippleReacted', '_rippleReacted', '_upriseRippleReacted', '_amnestyRippleTurn', '_amnestyOkRippleReacted'].forEach(function (mk) {
  ok(SRC.indexOf(mk) >= 0, '契约:幂等标记打在事件对象上 — ' + mk);
});

// ═══════════════════ 花括号配平抽真函数 ═══════════════════
function extractFn(src, decl) {
  const s = src.indexOf(decl);
  if (s < 0) return null;
  let i = src.indexOf('{', s), depth = 0, end = -1;
  for (; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
  return end > s ? src.slice(s, end) : null;
}
const fnC1 = extractFn(SRC, 'function _factionEventRipple()');
const fnC2 = extractFn(SRC, 'function _factionCollapseRipple(facName)');
ok(!!fnC1, '花括号配平抽 C1 真函数');
ok(!!fnC2, '花括号配平抽 C2 真函数');

// world-ledger 零写入(静态)：两函数体内绝不出现禁写口
[['C1', fnC1], ['C2', fnC2]].forEach(function (pair) {
  const body = pair[1] || '';
  ok(!/addEB\(/.test(body) && !/_chronicle/.test(body) && !/evtLog/.test(body) && !/_aiMemory/.test(body) && !/_socialPoliticalSignals/.test(body),
    '契约:' + pair[0] + ' 函数体零 world-ledger 写口(addEB/_chronicle/evtLog/_aiMemory/_socialPoliticalSignals)');
});

// ═══════════════════ 桩 ctx ═══════════════════
function baseCtx() {
  const ctx = { Math: Math, console: { log() {}, warn() {}, error() {} } };
  ctx.findCharByName = function (n) { return (ctx.GM.chars || []).find(function (c) { return c.name === n; }) || null; };
  ctx._loyLog = [];
  ctx.adjustCharacterLoyalty = function (ch, d, r, o) { ch.loyalty = (ch.loyalty == null ? 50 : ch.loyalty) + d; ctx._loyLog.push({ who: ch.name, d: d, src: o && o.source }); return { ok: true }; };
  ctx.NpcMemorySystem = { remember: function (who, ev, emo, imp) { const c = (ctx.GM.chars || []).find(function (x) { return x.name === who; }); if (c) { c._memory = c._memory || []; c._memory.push({ event: ev, emotion: emo, importance: imp }); } } };
  ctx.TMPromotion = { resolveRankLevel: function (c) { return (c && c._lv != null) ? c._lv : 18; } };
  ctx._isSameLocation = function (a, b) { a = String(a || ''); b = String(b || ''); if (!a && !b) return true; if (!a || !b) return false; return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0; };
  ctx.IntegrationBridge = { getDivisionArray: function () { return ctx.GM.__divs || []; } };
  ctx.P = { playerInfo: { factionName: '大明' } };
  return ctx;
}
function runC1(build) {
  const ctx = baseCtx();
  ctx.GM = build(ctx);
  if (ctx.GM.adminHierarchy === undefined) ctx.GM.adminHierarchy = {};
  vm.createContext(ctx);
  vm.runInContext(fnC1, ctx, { filename: 'c1.js' });
  ctx._factionEventRipple();
  return ctx;
}
function runC2(build, facName) {
  const ctx = baseCtx();
  ctx.GM = build(ctx);
  vm.createContext(ctx);
  vm.runInContext(fnC2, ctx, { filename: 'c2.js' });
  ctx._factionCollapseRipple(facName);
  return ctx;
}
function memOf(ctx, name) { const c = (ctx.GM.chars || []).find(function (x) { return x.name === name; }); return (c && c._memory) || []; }
function memCount(ctx) { return (ctx.GM.chars || []).reduce(function (s, c) { return s + ((c._memory && c._memory.length) || 0); }, 0); }

// ═══════════════════ ① 占府/陷城 ═══════════════════
(function () {
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城', evtLog: [], _chronicle: [],
      chars: [
        { name: '知府', alive: true, loyalty: 60 },                                  // div.governor
        { name: '同乡官', alive: true, birthplace: '苏州府' },                        // 籍贯
        { name: '阁老', alive: true, location: '京城', _lv: 3 },                       // 京中高品
        { name: '侍郎', alive: true, location: '京城', _lv: 5 }                        // 京中高品
      ],
      __divs: [{ name: '苏州府', governor: '知府', occupiedBy: '流寇', _occupiedTurn: 10 }]
    };
  });
  const mGov = memOf(ctx, '知府');
  ok(mGov.length === 1 && mGov[0].emotion === '惧' && mGov[0].importance === 8, '①占府 主官 惧/imp8·实=' + JSON.stringify(mGov[0]));
  ok(ctx.GM.chars[0].loyalty === 58 && ctx.GM.chars[0].stress === 10 && ctx.GM.chars[0]._mood === '惧', '①占府 主官 loyalty-2/stress+10/心绪惧·实=' + ctx.GM.chars[0].loyalty + '/' + ctx.GM.chars[0].stress);
  const mBorn = memOf(ctx, '同乡官');
  ok(mBorn.length === 1 && mBorn[0].emotion === '悲' && mBorn[0].importance === 7, '①占府 籍贯官 悲/imp7·实=' + JSON.stringify(mBorn[0]));
  ok(memOf(ctx, '阁老').length === 1 && memOf(ctx, '阁老')[0].emotion === '忧' && memOf(ctx, '阁老')[0].importance === 6, '①占府 在京高品 忧/imp6');
  ok(memOf(ctx, '侍郎').length === 1, '①占府 三受众全反应(主官/籍贯/京中)');
})();

// ① 窗外(旧 _occupiedTurn)不触发 + 幂等
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '知府', alive: true, loyalty: 60 }], __divs: [{ name: '苏州府', governor: '知府', occupiedBy: '流寇', _occupiedTurn: 7 }] };
  });
  ok(memOf(ctx, '知府').length === 0, '①占府 窗外(turn10-占7=3>1)不触发');
})();
(function () {
  const ctx = baseCtx();
  ctx.GM = { turn: 10, _capital: '京城', adminHierarchy: {}, chars: [{ name: '知府', alive: true, loyalty: 60 }], __divs: [{ name: '苏州府', governor: '知府', occupiedBy: '流寇', _occupiedTurn: 10 }] };
  vm.createContext(ctx); vm.runInContext(fnC1, ctx, { filename: 'c1.js' });
  ctx._factionEventRipple(); ctx._factionEventRipple();
  ok(memOf(ctx, '知府').length === 1, '①占府 幂等:两次调用只记一条(div._occupyRippleReacted)·实=' + memOf(ctx, '知府').length);
  ok(ctx.GM.__divs[0]._occupyRippleReacted === true, '①占府 事件对象打标 _occupyRippleReacted');
})();

// ═══════════════════ ② 外患入寇 ═══════════════════
(function () {
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城',
      chars: [
        { name: '蓟辽督师', alive: true },
        { name: '勇将', alive: true, valor: 75 },
        { name: '文帅', alive: true, valor: 30 },
        { name: '兵部尚书', alive: true, location: '京城', _lv: 3 }
      ],
      armies: [
        { _borderInvasion: true, _createdTurn: 10, sourceFacName: '后金', location: '蓟镇' },
        { commander: '勇将', location: '宣府' },
        { commander: '文帅', location: '大同' }
      ],
      __divs: [{ name: '蓟镇', governor: '蓟辽督师' }]
    };
  });
  const mGov = memOf(ctx, '蓟辽督师');
  ok(mGov.length === 1 && mGov[0].emotion === '惧' && mGov[0].importance === 8 && ctx.GM.chars[0].stress === 10, '②入寇 目标区主官 惧/imp8/stress+10');
  ok(memOf(ctx, '兵部尚书').length === 1 && memOf(ctx, '兵部尚书')[0].emotion === '忧', '②入寇 京中高品 忧/imp6');
  ok(memOf(ctx, '勇将').length === 1 && memOf(ctx, '勇将')[0].emotion === '怒', '②入寇 勇烈统军 怒(备战)');
  ok(memOf(ctx, '文帅').length === 1 && memOf(ctx, '文帅')[0].emotion === '忧', '②入寇 文弱统军 忧(备战)');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '蓟辽督师', alive: true }], armies: [{ _borderInvasion: true, _createdTurn: 6, sourceFacName: '后金', location: '蓟镇' }], __divs: [{ name: '蓟镇', governor: '蓟辽督师' }] };
  });
  ok(memOf(ctx, '蓟辽督师').length === 0, '②入寇 窗外(旧 _createdTurn)不触发');
})();

// ═══════════════════ ③ 宣战/开战(仅牵涉玩家) ═══════════════════
(function () {
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城',
      chars: [
        { name: '主战派', alive: true, location: '京城', _lv: 4, valor: 80 },
        { name: '主和派', alive: true, location: '京城', _lv: 5, valor: 20 }
      ],
      activeWars: [
        { attacker: '大明', defender: '后金', startTurn: 10 },   // 玩家涉入
        { attacker: '甲国', defender: '乙国', startTurn: 10 }    // 无玩家·不反应
      ]
    };
  });
  ok(memOf(ctx, '主战派').length === 1 && memOf(ctx, '主战派')[0].emotion === '怒' && memOf(ctx, '主战派')[0].importance === 7, '③宣战 京中勇烈者 怒/imp7');
  ok(memOf(ctx, '主和派').length === 1 && memOf(ctx, '主和派')[0].emotion === '忧' && memOf(ctx, '主和派')[0].importance === 6, '③宣战 京中文弱者 忧/imp6(忧/怒分流)');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '阁老', alive: true, location: '京城', _lv: 3 }], activeWars: [{ attacker: '甲国', defender: '乙国', startTurn: 10 }] };
  });
  ok(memOf(ctx, '阁老').length === 0, '③宣战 不牵涉玩家的战争不触发');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '阁老', alive: true, location: '京城', _lv: 3 }], activeWars: [{ enemy: '闯军起义军', turn: 10, revoltId: 'r1' }] };
  });
  ok(memOf(ctx, '阁老').length === 0, '③宣战 起义军条目(revoltId/enemy含起义军)不在③反应(归④·防双)');
})();

// ═══════════════════ ④ 民变首义 ═══════════════════
(function () {
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城',
      chars: [{ name: '陕西巡抚', alive: true }, { name: '首辅', alive: true, location: '京城', _lv: 2 }],
      _activeRevolts: [{ region: '陕西', leaderName: '王二', startTurn: 10, history: [] }],
      __divs: [{ name: '陕西', governor: '陕西巡抚' }]
    };
  });
  ok(memOf(ctx, '陕西巡抚').length === 1 && memOf(ctx, '陕西巡抚')[0].emotion === '惧' && memOf(ctx, '陕西巡抚')[0].importance === 8, '④民变 起事省主官 惧/imp8');
  ok(memOf(ctx, '首辅').length === 1 && memOf(ctx, '首辅')[0].emotion === '忧', '④民变 京中高品 忧/imp6');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '陕西巡抚', alive: true }], _activeRevolts: [{ region: '陕西', leaderName: '王二', startTurn: 6, history: [] }], __divs: [{ name: '陕西', governor: '陕西巡抚' }] };
  });
  ok(memOf(ctx, '陕西巡抚').length === 0, '④民变 窗外(旧 startTurn)不触发');
})();
(function () {
  // 民变重做·民2b：民变案落地的民变（GM.minxin.revolts·source==='revolt-cases'）也认——主推演宣布的起义并进民变案后不再进 _activeRevolts；
  //   州里不设主官的，落到省里的主官
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城',
      chars: [{ name: '陕西巡抚', alive: true }, { name: '首辅', alive: true, location: '京城', _lv: 2 }],
      minxin: { revolts: [
        { id: 'rv-d-yanan-t10', source: 'revolt-cases', region: '延安府', province: '陕西布政使司', leaderName: '王二', turn: 10, status: 'ongoing', level: 2 },
        { id: 'old-1', region: '某地', turn: 10, status: 'ongoing', level: 2 }
      ] },
      __divs: [{ name: '陕西布政使司', governor: '陕西巡抚' }, { name: '延安府' }]
    };
  });
  ok(memOf(ctx, '陕西巡抚').length === 1 && memOf(ctx, '陕西巡抚')[0].emotion === '惧', '④民变 民变案落地的也认：州不设主官→省主官 惧');
  ok(memOf(ctx, '首辅').length === 1, '④民变 民变案落地的：京中高品 忧（无来源的旧式不认，只记一次）');
  ok(ctx.GM.minxin.revolts[0]._upriseRippleReacted === true && !ctx.GM.minxin.revolts[1]._upriseRippleReacted, '④民变 只认 source=revolt-cases 的，幂等标记打在民变上');
})();

// ═══════════════════ ⑤ 拒抚背约 / 受抚招安 ═══════════════════
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '兵科给事中', alive: true, location: '京城', _lv: 6 }], _activeRevolts: [{ region: '河南', leaderName: '李自成', _amnestyRejectedTurn: 10, history: [] }] };
  });
  const m = memOf(ctx, '兵科给事中');
  ok(m.length === 1 && m[0].emotion === '忧' && m[0].importance === 6, '⑤拒抚 京中高品 忧/imp6');
  // 幂等:同回合再跑不重复
  ctx._factionEventRipple();
  ok(memOf(ctx, '兵科给事中').length === 1, '⑤拒抚 幂等(_amnestyRippleTurn 记 turn 值·同回合不重复)');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '内阁中书', alive: true, location: '京城', _lv: 7 }], _activeRevolts: [{ region: '山东', leaderName: '徐鸿儒', history: [{ turn: 10, event: '招安:某使-accepted' }] }] };
  });
  ok(memOf(ctx, '内阁中书').length === 1 && memOf(ctx, '内阁中书')[0].emotion === '喜' && memOf(ctx, '内阁中书')[0].importance === 6, '⑤受抚招安 京中高品 喜/imp6');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '内阁中书', alive: true, location: '京城', _lv: 7 }], _activeRevolts: [{ region: '山东', leaderName: '徐鸿儒', history: [{ turn: 10, event: '招安:某使-rejected' }] }] };
  });
  ok(memOf(ctx, '内阁中书').length === 0, '⑤受抚 rejected 结果不误触发喜(双向分流)');
})();

// ═══════════════════ ⑥ 条约(仅牵涉玩家·类型分流) ═══════════════════
(function () {
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城',
      chars: [{ name: '清流言官', alive: true, location: '京城', _lv: 5, valor: 80 }, { name: '务实阁臣', alive: true, location: '京城', _lv: 4, valor: 20 }],
      treaties: [{ from: '大明', to: '后金', title: '岁币纳贡之约', turn: 10 }]
    };
  });
  ok(memOf(ctx, '清流言官').length === 1 && memOf(ctx, '清流言官')[0].emotion === '怒' && memOf(ctx, '清流言官')[0].importance === 7, '⑥条约 岁币类 勇烈者 怒/imp7');
  ok(memOf(ctx, '务实阁臣').length === 1 && memOf(ctx, '务实阁臣')[0].emotion === '忧', '⑥条约 岁币类 文弱者 忧/imp6(怒/忧分流)');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '枢辅', alive: true, location: '京城', _lv: 3 }], treaties: [{ parties: [{ name: '大明' }, { name: '朝鲜' }], type: 'alliance', typeName: '同盟', startTurn: 10 }] };
  });
  ok(memOf(ctx, '枢辅').length === 1 && memOf(ctx, '枢辅')[0].emotion === '喜' && memOf(ctx, '枢辅')[0].importance === 5, '⑥条约 结盟类 平/喜/imp5');
})();
(function () {
  const ctx = runC1(function () {
    return { turn: 10, _capital: '京城', chars: [{ name: '枢辅', alive: true, location: '京城', _lv: 3 }], treaties: [{ from: '甲国', to: '乙国', title: '岁币之约', turn: 10 }] };
  });
  ok(memOf(ctx, '枢辅').length === 0, '⑥条约 不牵涉玩家不触发');
})();

// ═══════════════════ ⑥ 条约 否定/解除/混合语义 保守跳过(2026-07-22 Codex 复审) ═══════════════════
(function () {
  function mkTreaty(title) {
    const ctx = baseCtx();
    ctx.GM = { turn: 10, _capital: '京城', adminHierarchy: {}, chars: [{ name: '言官', alive: true, location: '京城', _lv: 4, valor: 80 }], treaties: [{ from: '大明', to: '后金', title: title, turn: 10 }] };
    vm.createContext(ctx); vm.runInContext(fnC1, ctx, { filename: 'c1.js' }); ctx._factionEventRipple();
    return memOf(ctx, '言官').length;
  }
  ok(mkTreaty('拒绝称臣纳贡') === 0, '⑥否定:拒绝称臣纳贡→不触发屈辱怒/忧(前4字含"拒")');
  ok(mkTreaty('废除岁币旧约') === 0, '⑥否定:废除岁币→不触发(前4字含"废")');
  ok(mkTreaty('解除同盟') === 0, '⑥否定:解除同盟→不触发喜(前4字含"解除")');
  ok(mkTreaty('岁币换同盟之议') === 0, '⑥混合:同文含岁币+同盟两组→保守跳过');
  ok(mkTreaty('岁币纳贡之约') === 1, '⑥正向对照:纯岁币纳贡(无否定/混合)仍正常触发');
})();

// ═══════════════════ 玩家势力判定 canonical + 归一(trim/别名不漏判) ═══════════════════
(function () {
  const ctx = baseCtx();
  ctx.P = { playerInfo: { factionName: '  大明  ' } };   // 带首尾空格
  ctx.GM = { turn: 10, _capital: '京城', adminHierarchy: {}, chars: [{ name: '阁老', alive: true, location: '京城', _lv: 3 }], activeWars: [{ attacker: '大明', defender: '后金', startTurn: 10 }] };
  vm.createContext(ctx); vm.runInContext(fnC1, ctx, { filename: 'c1.js' }); ctx._factionEventRipple();
  ok(memOf(ctx, '阁老').length === 1, '玩家判定:P.factionName 带空格 vs war 无空格·_norm(trim)归一后仍判牵涉玩家(不漏判)');
})();
(function () {
  const ctx = baseCtx();
  ctx.P = {};   // 无 playerInfo·走 GM.facs.isPlayer canonical 源
  ctx.GM = { turn: 10, _capital: '京城', adminHierarchy: {}, facs: [{ name: '大明', isPlayer: true }], chars: [{ name: '阁老', alive: true, location: '京城', _lv: 3 }], treaties: [{ from: '大明', to: '后金', title: '岁币之约', turn: 10 }] };
  vm.createContext(ctx); vm.runInContext(fnC1, ctx, { filename: 'c1.js' }); ctx._factionEventRipple();
  ok(memOf(ctx, '阁老').length === 1, '玩家判定:canonical 含 GM.facs.isPlayer 源(P 无 playerInfo 亦判)');
})();

// ═══════════════════ 玩家/死者跳过 + 零 world-ledger ═══════════════════
(function () {
  const ctx = runC1(function () {
    return {
      turn: 10, _capital: '京城', evtLog: [], _chronicle: [],
      chars: [
        { name: '皇帝', alive: true, isPlayer: true, location: '京城', _lv: 1 },   // 玩家·跳过
        { name: '亡臣', alive: false, location: '京城', _lv: 2 },                   // 死者·跳过
        { name: '活臣', alive: true, location: '京城', _lv: 3 }
      ],
      _activeRevolts: [{ region: '陕西', leaderName: '王二', startTurn: 10, history: [] }],
      __divs: [{ name: '陕西', governor: '活臣' }]
    };
  });
  ok(memOf(ctx, '皇帝').length === 0, '玩家(isPlayer)不写记忆');
  ok(memOf(ctx, '亡臣').length === 0, '死者(alive=false)不写记忆');
  ok(memOf(ctx, '活臣').length >= 1, '活臣正常反应(对照)');
  ok((ctx.GM.evtLog || []).length === 0 && (ctx.GM._chronicle || []).length === 0, '零 world-ledger:跑完 evtLog/_chronicle 长度不变(0)');
})();

// ═══════════════════ 24 封顶 ═══════════════════
(function () {
  const chars = [];
  for (let k = 0; k < 4; k++) chars.push({ name: 'CAP' + k, alive: true, location: '京城', _lv: 3 });   // 4 京中高品
  const divs = [];
  for (let k = 0; k < 30; k++) { chars.push({ name: 'GOV' + k, alive: true }); divs.push({ name: 'D' + k, governor: 'GOV' + k, occupiedBy: '寇', _occupiedTurn: 10 }); }
  const ctx = runC1(function () { return { turn: 10, _capital: '京城', chars: chars, __divs: divs }; });
  ok(memCount(ctx) === 24, '24 封顶:30 占府×(主官+京中4)远超 24·实写=' + memCount(ctx) + '(应恰 24)');
})();

// ═══════════════════ C2 覆灭涟漪 ═══════════════════
(function () {
  const ctx = runC2(function () {
    return {
      _capital: '京城', turn: 10, evtLog: [], _chronicle: [],
      facs: [{ name: '东江镇', playerRelation: 30 }],   // 友好(≥0)→京中忧
      chars: [
        { name: '毛部将甲', alive: true, faction: '东江镇', loyalty: 60 },
        { name: '毛部将乙', alive: true, faction: '东江镇', loyalty: 60 },
        { name: '枢辅', alive: true, faction: '大明', location: '京城', _lv: 2 }
      ]
    };
  }, '东江镇');
  const m1 = memOf(ctx, '毛部将甲');
  ok(m1.length === 1 && m1[0].emotion === '哀' && m1[0].importance === 7, 'C2 成员 树倒猢狲散 哀/imp7·实=' + JSON.stringify(m1[0]));
  ok(ctx.GM.chars[0].loyalty === 57 && ctx.GM.chars[0].stress === 8 && ctx.GM.chars[0]._mood === '惧', 'C2 成员 loyalty-3/stress+8/心绪惧');
  ok(memOf(ctx, '毛部将乙').length === 1, 'C2 成员 top8 全反应');
  ok(memOf(ctx, '枢辅').length === 1 && memOf(ctx, '枢辅')[0].emotion === '忧', 'C2 京中高品 友好势力覆灭 忧/imp6');
  ok((ctx.GM.evtLog || []).length === 0 && (ctx.GM._chronicle || []).length === 0, 'C2 零 world-ledger 写入');
})();
(function () {
  const ctx = runC2(function () {
    return { _capital: '京城', turn: 10, facs: [{ name: '后金', playerRelation: -80 }], chars: [{ name: '枢辅', alive: true, faction: '大明', location: '京城', _lv: 2 }] };
  }, '后金');
  ok(memOf(ctx, '枢辅').length === 1 && memOf(ctx, '枢辅')[0].emotion === '喜', 'C2 京中高品 敌对势力覆灭 喜(称快)');
})();
(function () {
  const ctx = baseCtx();
  ctx.GM = { _capital: '京城', turn: 10, facs: [{ name: '东江镇', playerRelation: 30 }], chars: [{ name: '部将', alive: true, faction: '东江镇', loyalty: 60 }] };
  vm.createContext(ctx); vm.runInContext(fnC2, ctx, { filename: 'c2.js' });
  ctx._factionCollapseRipple('东江镇'); ctx._factionCollapseRipple('东江镇');
  ok(memOf(ctx, '部将').length === 1, 'C2 幂等:两次调用只记一条(fac._collapseRippleReacted)');
  ok(ctx.GM.facs[0]._collapseRippleReacted === true, 'C2 fac 对象打标 _collapseRippleReacted');
})();
(function () {
  const ctx = runC2(function () {
    return { _capital: '京城', turn: 10, facs: [{ name: '叛镇', playerRelation: -50 }], chars: [{ name: '叛玩家', alive: true, isPlayer: true, faction: '叛镇' }, { name: '亡将', alive: false, faction: '叛镇' }] };
  }, '叛镇');
  ok(memOf(ctx, '叛玩家').length === 0 && memOf(ctx, '亡将').length === 0, 'C2 玩家/死者成员跳过');
})();

// ═══════════════════ ② apply.js C2 去重裁定契约 ═══════════════════
ok(!/_membersBefore/.test(APPLY), 'apply.js:原内联成员覆灭记忆写已摘(无 _membersBefore 残留)');
ok(/faction:defeated/.test(APPLY) && /_factionCollapseRipple|C2/.test(APPLY), 'apply.js:保留 faction:defeated emit + 指向 _factionCollapseRipple 去重注释');

// ═══════════════════ ③ C3 死链退役契约(反双扣) ═══════════════════
ok(/army:defeat/.test(EXT) && /C3/.test(EXT) && /world-reactors|onBattleResolved/.test(EXT), 'ext.js:C3 裁定注释在 army:defeat 死链处(指向 world-reactors 承载)');
ok(!/emit\(\s*['"]army:defeat['"]/.test(EXT) && !/emit\(\s*['"]army:defeat['"]/.test(RECON), 'C3:army:defeat 无 emitter(死链保持退役·未在 ext/reconcile 复活·反与 world-reactors 双扣)');

console.log('[smoke-faction-event-ripple] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
