#!/usr/bin/env node
'use strict';
/* smoke-wentian-agent — 问天升级（2026-07-03）防腐线。
 * §A 区划/官职按名解析器(行为·切片harness·治幽灵对象静默失败最后两缺口)
 * §B agent 循环(行为·脚本化 callAIWithTools：查证→提交·trace·开关·降级)
 * §C 接线契约(教学共源/agent分支/多笔hardChanges/设置开关/index挂载) */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-wentian-agent');

/* ── §A 区划/官职解析器(行为) ─────────────────────────────────── */
console.log('— §A · 区划/官职按名直改(行为) —');
(function () {
  var src = (read('tm-game-loop.js') + read('tm-game-loop-wentian-hardchange.js'));
  var start = src.indexOf('function _wtCanonicalDivisionHardChangeField');
  var end = src.indexOf('function _wtReviseFromPending');
  ok(start >= 0 && end > start, '切片边界在(新解析器位于 hardChange 块内)');
  var ctx = {
    console: console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    requestIdleCallback: function (fn) { return setTimeout(fn, 0); }, cancelIdleCallback: function (id) { clearTimeout(id); },
    GM: {
      adminHierarchy: {
        player: { divisions: [
          { name: '北直隶', divisions: [
            { name: '顺天府', minxin: 60, economyBase: { farmland: 100, saltProduction: 0 } },
            { name: '保定府', minxin: 55, economyBase: { farmland: 80 } }
          ] }
        ] },
        enemy: { divisions: [{ name: '盛京', minxin: 70, economyBase: { farmland: 50 } }] }
      },
      officeTree: [
        { name: '六部', positions: [{ name: '户部尚书', holder: '毕自严', publicTreasury: 500 }],
          subs: [{ name: '户部', positions: [{ name: '户部侍郎', holder: '', publicTreasury: 0 }] }] }
      ],
      chars: [], _listeners: { varChange: [] }
    },
    P: {},
    renderLeftPanel: function () {}, renderGameState: function () {}, renderGuokuPanel: function () {},
    renderNeitangPanel: function () {}, renderRenwu: function () {}, addEB: function () {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  // 需要 _wtNormalizeCharacterLookupToken 等前置——从 _wtNormalizeHardChangePath 起切(与既有问天 smoke 同边界)
  var start2 = src.indexOf('function _wtNormalizeHardChangePath');
  vm.runInContext(src.slice(start2, end), ctx, { filename: 'wt-block.js' });

  var div = ctx.GM.adminHierarchy.player.divisions[0].divisions[0];
  ok(ctx._wtApplyHardChange('divisions[顺天府].economyBase.farmland', 'add', 50) === true && div.economyBase.farmland === 150,
    'divisions[顺天府].economyBase.farmland add 50 → 真叶 150');
  ok(!ctx.GM.economyBase && !ctx.GM.divisions, '无幽灵对象(GM.economyBase/GM.divisions 未被创建)');
  ok(ctx._wtApplyHardChange('区划[顺天府].田亩', 'add', 10) === true && div.economyBase.farmland === 160,
    '中文前缀+别名(区划[顺天府].田亩)同通道');
  ok(ctx._wtApplyHardChange('divisions[顺天府].民心', 'set', 130) === true && div.minxin === 100,
    '区划民心 set 130 → 夹取 100');
  ok(ctx._wtApplyHardChange('divisions[盛京].economyBase.farmland', 'add', 5) === true
    && ctx.GM.adminHierarchy.enemy.divisions[0].economyBase.farmland === 55,
    '非玩家势力区划亦可名中(全树查)');
  var pos = ctx.GM.officeTree[0].positions[0];
  ok(ctx._wtApplyHardChange('office[户部尚书].公库', 'add', 1000) === true && pos.publicTreasury === 1500,
    'office[户部尚书].公库 add 1000 → 1500');
  ok(ctx._wtApplyHardChange('官职[户部尚书].publicTreasury', 'set', -50) === true && pos.publicTreasury === 0,
    '公库负值地板 0');
  ok(ctx._wtResolveDivisionHardChange(['economyBase', 'farmland']) === null,
    '裸 economyBase 路径不被区划解析器接管(须带前缀·防误伤)');
})();

/* ── §B agent 循环(行为) ─────────────────────────────────────── */
console.log('— §B · agent 循环(行为) —');
(function () {
  return (async function () {
    var g = { TM: { Endturn: { AgentReadTools: {
      defs: function () {
        return [
          { name: 'search_save', description: 's', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'get_field', description: 'g', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'get_dossier', description: '聚合工具·刀④起问天带', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'read_records', description: '重工具·问天不该带', parameters: { type: 'object', properties: {}, required: [] } }
        ];
      },
      handle: function (name) { return Promise.resolve({ ok: true, name: name, text: '在档：袁崇焕·loyalty=55·驻宁远' }); }
    } } }, P: { conf: {} }, GM: {} };
    var calls = [];
    g.callAIWithTools = function (transcript, tools, opts) {
      calls.push({ toolNames: tools.map(function (t) { return t.name; }), force: opts && opts.forceTool, hasEvidence: transcript.indexOf('在档：袁崇焕') >= 0 });
      if (calls.length === 1) return Promise.resolve({ toolCalls: [{ name: 'search_save', input: { query: '袁崇焕' } }] });
      return Promise.resolve({ toolCalls: [{ name: 'submit_wentian', input: {
        category: 'hardChange', interpretation: '袁崇焕现忠诚55·设为100',
        hardChanges: [{ path: 'chars[袁崇焕].loyalty', op: 'set', value: 100 }, { path: 'huangwei.index', op: 'add', value: 5 }]
      } }] });
    };
    g.window = g; g.global = g; g.globalThis = g;
    var vmctx = vm.createContext(g);
    vm.runInContext(read('tm-wentian-agent.js'), vmctx, { filename: 'tm-wentian-agent.js' });
    var WA = g.TM.WentianAgent;
    ok(WA && typeof WA.run === 'function' && WA.enabled() === true, '模块加载·基建齐则 enabled');
    var res = await WA.run('让袁崇焕忠诚拉满·皇威+5', { teaching: 'T', ctx: 'C' });
    ok(res && res.ok === true && res.result && res.result.hardChanges.length === 2, '两轮查证→提交·多笔 hardChanges 透传');
    ok(res.trace.length === 1 && res.trace[0] === 'search_save', 'trace 记查证轨迹');
    ok(calls[0].toolNames.indexOf('read_records') < 0 && calls[0].toolNames.indexOf('submit_wentian') >= 0, '问天只带白名单只读工具+终结工具(records 重工具不带)');
    ok(calls[0].toolNames.indexOf('get_dossier') >= 0, 'get_dossier 聚合工具在列(刀④·涉面广指令一调抓全)');
    ok(calls[1].hasEvidence === true, '工具结果滚入 transcript 续轮(第二轮见查证证据)');
    ok(!calls[0].force && !calls[1].force, '未到末轮不强制终结');
    g.P.conf.wentianAgentMode = false;
    ok(WA.enabled() === false, '开关关→enabled false(落回单发)');
    g.P.conf.wentianAgentMode = undefined;
    delete g.callAIWithTools;
    ok(WA.enabled() === false, '无 callAIWithTools 基建→enabled false(永不断问天)');

    /* §B2 submit 校验回路（刀②2026-07-10）：坏笔→校验退回→重提；absolute 不拒只标注 */
    function mkTools() { return { Endturn: { AgentReadTools: {
      defs: function () { return [{ name: 'get_field', description: 'g', parameters: { type: 'object', properties: {}, required: [] } }]; },
      handle: function (name) { return Promise.resolve({ ok: true, name: name, text: '在档字段:_energy=85' }); }
    } } }; }
    var g2calls = [];
    var g2 = { TM: mkTools(), P: { conf: {} }, GM: {},
      _wtDryRunHardChange: function (p) {
        return (p === '_energy' || p === 'huangwei.index')
          ? { ok: true, kind: 'generic', normalized: p }
          : { ok: false, kind: 'ghost', normalized: p, reason: '字段「' + p + '」不存在（拒创建幽灵键）' };
      }
    };
    g2.callAIWithTools = function (transcript) {
      var n = g2calls.push({ sawReject: transcript.indexOf('submit 校验·未通过') >= 0 });
      if (n === 1) return Promise.resolve({ toolCalls: [{ name: 'submit_wentian', input: { category: 'hardChange', interpretation: 'x', hardChanges: [{ path: '精气神', op: 'set', value: 100 }, { path: 'huangwei.index', op: 'add', value: 5 }] } }] });
      return Promise.resolve({ toolCalls: [{ name: 'submit_wentian', input: { category: 'hardChange', interpretation: 'x2', hardChanges: [{ path: '_energy', op: 'set', value: 100 }, { path: 'huangwei.index', op: 'add', value: 5 }] } }] });
    };
    g2.window = g2; g2.global = g2; g2.globalThis = g2;
    vm.runInContext(read('tm-wentian-agent.js'), vm.createContext(g2), { filename: 'tm-wentian-agent.js' });
    var res2 = await g2.TM.WentianAgent.run('精力拉满·皇威+5', { teaching: 'T' });
    ok(res2 && res2.ok === true && g2calls.length === 2, '坏笔第一轮校验退回·第二轮重提成功');
    ok(g2calls[1].sawReject === true, '校验报告滚入 transcript(第二轮可见)');
    ok(res2.trace.indexOf('校验退回×1') >= 0, 'trace 记校验退回');
    ok(res2.result.hardChanges[0]._dryRun && res2.result.hardChanges[0]._dryRun.ok === true, '通过笔带 _dryRun 标注(确认框绿标用)');
    var g3calls = 0;
    var g3 = { TM: mkTools(), P: { conf: {} }, GM: {},
      _wtDryRunHardChange: function (p) { return { ok: false, kind: 'ghost', normalized: p, reason: '不存在' }; }
    };
    g3.callAIWithTools = function () {
      g3calls++;
      return Promise.resolve({ toolCalls: [{ name: 'submit_wentian', input: { category: 'absolute', interpretation: 'y', hardChanges: [{ path: '仙术', op: 'set', value: 1 }], clarify: { question: '哪位王承恩？', options: ['司礼监太监', '蓟州总兵'] } } }] });
    };
    g3.window = g3; g3.global = g3; g3.globalThis = g3;
    vm.runInContext(read('tm-wentian-agent.js'), vm.createContext(g3), { filename: 'tm-wentian-agent.js' });
    var res3 = await g3.TM.WentianAgent.run('天意降下仙术', { teaching: 'T' });
    ok(res3 && res3.ok === true && g3calls === 1, 'absolute 天意档坏笔不退回(造物自由·首轮即提)');
    ok(res3.result.hardChanges[0]._dryRun && res3.result.hardChanges[0]._dryRun.ok === false, 'absolute 坏笔仍带标注(确认框黄标用)');
    ok(res3.result.clarify && res3.result.clarify.question === '哪位王承恩？' && res3.result.clarify.options.length === 2, 'clarify 歧义追问透传(刀⑤)');
  })();
})().then(function () {
  /* ── §C 接线契约 ──────────────────────────────────────────── */
  console.log('— §C · 接线契约 —');
  console.log('\nsmoke-wentian-agent ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
  process.exit(F0 === 0 ? 0 : 1);
}).catch(function (e) {
  console.error('HARNESS ERROR', e && (e.stack || e.message || e));
  process.exit(1);
});
