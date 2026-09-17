#!/usr/bin/env node
'use strict';
/* smoke-guoshi-memskills — 国师 CC 对照三件套（记忆/技能/能力包·2026-07-03）行为级防腐线。
 * M 记忆(≈CC memdir)：四型条目·同名更新·≤3条免调用直注入·>3条副模型选择召回·失败回退关键词。
 * S 技能(≈CC SkillTool)：内置+用户+能力包合并清单·useSkill 展开·内置同名拒存。
 * P 能力包(≈CC plugin)：默认启用·停用即技能退场·JSON 导出导入(跨玩家分发)。
 * E2E：mock caller 全链——system 带技能清单/召回注入首 user/useSkill 展开回对话/agent saveMemory 暂存并在批准边界落库。 */
global.localStorage = (function () { var s = {}; return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null; }, setItem: function (k, v) { s[k] = String(v); }, removeItem: function (k) { delete s[k]; } }; })();
global.window = global;
require('../editor-authoring-agent.js');
var AA = global.TM.AuthoringAgent;
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-guoshi-memskills');

console.log('— M 记忆 —');
ok(AA.memories.save({ name: 'test-mem', type: 'user', description: '玩家偏好考据向', body: '玩家不喜欢奇幻元素' }).ok, 'saveMemory ok');
ok(AA.memories.save({ name: 'test-mem', type: 'feedback', description: '更新', body: '更新体' }).updated, '同名覆盖更新');
ok(AA.memories.save({ name: '', type: 'user', description: 'x', body: 'y' }).ok === false, '缺 name 拒存');
ok(AA.memories.list().length === 1, '库计数正确');

console.log('— S 技能 · P 能力包 —');
ok(AA.skills.list().some(function (s) { return s.name === '人物塑造章法'; }), '内置技能在清单');
ok(AA.skills.list().some(function (s) { return s.name === '人物立绘生成规范'; }), '能力包技能并入清单');
ok(AA.skills.save({ name: '我的技能', body: '步骤' }).ok, '用户 saveSkill ok');
ok(AA.skills.save({ name: '人物塑造章法', body: 'x' }).ok === false, '与内置同名拒存');
var packs = AA.packs.list();
ok(packs.length >= 2 && packs.every(function (p) { return p.enabled; }), '内置能力包默认启用(立绘工坊/疆域工坊)');
AA.packs.setEnabled('立绘工坊', false);
ok(!AA.skills.list().some(function (s) { return s.name === '人物立绘生成规范'; }), '停用包→其技能退场');
AA.packs.setEnabled('立绘工坊', true);
var exp = AA.packs.exportJSON('疆域工坊');
ok(!!exp && /疆域与地图调整法/.test(exp), '能力包导出 JSON');
var imp = AA.packs.importJSON(exp.replace(/疆域工坊/g, '玩家自制包'));
ok(imp.ok && AA.packs.list().some(function (p) { return p.name === '玩家自制包'; }), '导入 JSON 成新包');

console.log('— 召回三路径 —');
['甲', '乙', '丙', '丁'].forEach(function (n, i) { AA.memories.save({ name: 'bg-' + i, type: 'project', description: '背景' + n, body: '内容' + n }); });
var mockSel = function (msgs, tools, o) { return Promise.resolve({ text: '', toolCalls: [{ id: 'r', name: 'selectMemories', input: { names: ['bg-0'] } }] }); };
var failSel = function () { return Promise.reject(new Error('down')); };
AA.memories.recall('需求', null, mockSel).then(function (blk) {
  ok(/bg-0/.test(blk) && !/bg-1/.test(blk), '副模型选择性召回');
  return AA.memories.recall('背景丁 相关', null, failSel);
}).then(function (blk) {
  ok(/bg-3/.test(blk), '调用失败回退关键词命中');

  console.log('— E2E · mock caller 全链 —');
  var draft = AA.makeDraft({ name: '测试剧本', characters: [{ name: '张三' }], factions: [] });
  var calls = 0, sawSystem = '', sawFirstUser = '';
  var mockCaller = function (msgs, tools, o) {
    if (tools.length === 1 && tools[0].name === 'selectMemories') {
      return Promise.resolve({ text: '', toolCalls: [{ id: 'r', name: 'selectMemories', input: { names: ['bg-0'] } }] });
    }
    calls++;
    if (calls === 1) {
      sawSystem = o.system || ''; sawFirstUser = msgs[0].text || '';
      return Promise.resolve({ text: '', toolCalls: [{ id: 't1', name: 'useSkill', input: { name: '人物塑造章法' } }] });
    }
    if (calls === 2) {
      var toolMsg = JSON.stringify(msgs[msgs.length - 1]);
      ok(/技能·人物塑造章法/.test(toolMsg) && /searchEntities/.test(toolMsg), 'useSkill 展开全文回到对话');
      return Promise.resolve({ text: '', toolCalls: [{ id: 't2', name: 'saveMemory', input: { name: 'owner-pref', type: 'user', description: '玩家重视人物血肉', body: '玩家要求人物都要有小传' } }] });
    }
    return Promise.resolve({ text: '', toolCalls: [{ id: 't3', name: 'finish', input: { summary: '完成测试：看了技能并记了记忆。' } }] });
  };
  return AA.runAuthoringLoop(draft, '把张三丰满一下', { caller: mockCaller, cfg: {}, maxIterations: 6, toolPacks: ['knowledge'] }).then(function (r) {
    ok(/可用技能/.test(sawSystem) && /人物塑造章法/.test(sawSystem) && /疆域与地图调整法/.test(sawSystem), 'system 含技能清单(内置+能力包)');
    ok(/相关记忆/.test(sawFirstUser) && /bg-0/.test(sawFirstUser) && !/bg-1/.test(sawFirstUser), '召回选择性注入首条 user');
    ok(!AA.memories.list().some(function (m) { return m.name === 'owner-pref'; }) && r.sideEffects.length === 1, 'agent saveMemory 先暂存·运行期不越过玩家批准');
    var fxCommit = AA.commitSideEffects(r.sideEffects);
    ok(fxCommit.ok && AA.memories.list().some(function (m) { return m.name === 'owner-pref'; }), '玩家批准边界后 saveMemory 落库');
    ok(r.finished, 'run 正常收尾');
  });
}).then(function () {
  console.log('— UI 曝光(源码契约·2026-07-03 二轮) —');
  var fs2 = require('fs'), path2 = require('path');
  var uiSrc = fs2.readFileSync(path2.resolve(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + fs2.readFileSync(path2.resolve(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + fs2.readFileSync(path2.resolve(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  var adSrc = fs2.readFileSync(path2.resolve(__dirname, '..', 'preview', 'scenario-editor-reset-adapters.js'), 'utf8');
  ok(/function showMemoriesUI/.test(uiSrc) && /function showSkillsUI/.test(uiSrc) && /function showPacksUI/.test(uiSrc) && /function showUsageUI/.test(uiSrc), 'UI 四卡函数在(记忆册/技能册/能力包/用量)');
  ok(/showMemories: showMemoriesUI/.test(uiSrc), 'UI 四卡导出 TM_AuthoringAgentUI(供 je-cmdk 调)');
  ok(/data-pack-tg/.test(uiSrc) && /data-pack-imp/.test(uiSrc) && /data-mem-del/.test(uiSrc), 'UI 卡内交互(启停/导入/删)接线');
  ok(/tokensBreakdown/.test(uiSrc) && /真口径/.test(uiSrc) && /_lastRunMeta/.test(uiSrc), 'UI 用量卡吃 G1 真口径构成(codex-token-usage/claude-hud 思路)');
  ok(/记忆册/.test(adSrc) && /用量·上下文/.test(adSrc), '工坊 je-cmdk 四命令接线(双入口可达)');
  console.log('\nsmoke-guoshi-memskills ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
  process.exit(F === 0 ? 0 : 1);
}).catch(function (e) { console.error('CHAIN FAIL', e && e.message); process.exit(1); });
