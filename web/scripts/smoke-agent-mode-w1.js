'use strict';
// ============================================================
// smoke-agent-mode-w1.js — 「模式 b · 弱模型动作脚手架」(2026-06·着重加强弱模型)
//   真机逮:弱模型 tool-calling 多步驱动不出任何写(落地0·全程只读)。破法=循环零落地时
//   单发结构化产「动作清单」→ 走正常 _dispatch(同验证闸/记账)→ 真 mechanical 落地 → 再自动收尾。
//   验:① 弱模型空转 → 脚手架兜底真落地 + 自动收尾(完整回合·非回落)
//       ② 模型自主写(强模型路径)→ 脚手架不触发
//       ③ 脚手架只放行写工具(finalize/未知工具被滤)
// ============================================================

const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
require(path.join(ROOT, 'tm-endturn-record-specs.js'));        // 自动收尾深化需 recordSpecs
require(path.join(ROOT, 'tm-endturn-agent-depth-tools.js'));   // 自动收尾套件
require(path.join(ROOT, 'tm-endturn-agent-mode.js'));

const AM = globalThis.TM.Endturn.AgentMode;
assert(AM && typeof AM.run === 'function', 'AgentMode.run 已导出');

function makeGM() {
  return { turn: 7, eraName: '建炎元年', guoku: 12000, neitang: 3000, minxin: 50, chars: [{ id: 'c1', name: '张三', mood: '平', note: '' }], facs: [{ name: '北府' }], evtLog: [], memorials: [] };
}

// 脚手架 + 自动收尾深化套件共用的 callAIMessages stub
function setAIMessages() {
  globalThis.callAIMessages = async function (msgs) {
    var u = (msgs && msgs[1] && msgs[1].content) || '';
    if (/应当落地的具体动作|"actions"/.test(u)) {                 // ← 脚手架单发动作
      return JSON.stringify({ actions: [
        { tool: 'set_field', path: 'chars.0.mood', value: '振', reason: '获重用' },
        { tool: 'set_field', path: 'chars.0.note', value: '委以辽东经略', reason: '任命备注' },
        { tool: 'push_field', path: 'evtLog', value: { turn: 7, type: 'edict', text: '起复经略' }, reason: '诏令落地' },
        { tool: 'finalize_turn', narrative: '不该被脚手架派发' },  // 非写工具·应被滤
        { tool: 'bogus_tool', path: 'x' }                          // 未知工具·应被滤
      ] });
    }
    if (/脉络/.test(u)) return JSON.stringify({ beats: ['甲'], tone: 't' });
    if (/撰写《后人戏说》/.test(u)) return JSON.stringify({ houren_xishuo: '是日宫中无事。' });
    if (/据此产出完整史记/.test(u)) return JSON.stringify({ shizhengji: '本回合时政记。', shilu: '实录。', zhengwen: '政文。', playerStatus: '状态', playerInner: '内心', suggestions: ['进言'], title: '标题', summary: '摘要' });
    if (/causal_edges/.test(u)) return JSON.stringify({ memory: '记忆', state_board: { mood: 'm', recent_summary: 's', open_loops: [], unfulfilled_promises: [] } });
    return JSON.stringify({});  // 其余深化(faction/economy/military/npcs/world)·返空·优雅
  };
}

(async function () {
  globalThis.P = { conf: { agentModeDepthGate: false, agentModeMaxRounds: 8 } };

  // ── 场景1:弱模型空转(每轮只 get_overview·零写零收尾)→ 脚手架兜底真落地 + 自动收尾 ──
  let gm = makeGM(); let ctx = { GM: gm, input: { edicts: ['起复经略辽东', '彻查辽饷'] } };
  globalThis.callAIWithTools = async function () { return { toolCalls: [{ name: 'get_overview', input: {} }], text: '我先看看局面。' }; };
  setAIMessages();
  let res = await AM.run(ctx);
  let meta = gm._agentTurnMeta || {};
  assert(res.ok === true && res.fallback === false, '场景1:弱模型空转·脚手架兜底·仍成功接管(非回落空回合)');
  assert(meta.scaffolded === true, '场景1:meta.scaffolded=true(触发了动作脚手架)');
  assert(meta.scaffoldActions === 3, '场景1:脚手架派发 3 个有效写动作(finalize/bogus 被滤)');
  assert(meta.writeOk >= 3, '场景1:脚手架的写真落地(writeOk≥3)');
  assert(gm.chars[0].mood === '振' && gm.chars[0].note === '委以辽东经略', '场景1:set_field 真改 chars(脚手架→_dispatch→真 mutate)');
  assert(gm.evtLog.some(function (e) { return e && e.text === '起复经略'; }), '场景1:push_field 真追加 evtLog');
  assert(meta.finalized === true, '场景1:脚手架后自动收尾·finalized=true(完整回合)');
  assert(gm._agentChronicle && /时政记/.test(gm._agentChronicle.shizhengji || ''), '场景1:自动收尾补出史记(史记四体齐)');
  // 脚手架的写要进 _turnReport(与模式 a 同构 render)
  assert(gm._turnReport.some(function (e) { return e.type === 'change' && e._agent && /mood/.test(String(e.path)); }), '场景1:脚手架写入 _turnReport(焊缝·面板可见)');

  // ── 场景2:模型自主写(强模型路径)→ 脚手架不触发 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  let i2 = 0;
  globalThis.callAIWithTools = async function () {
    i2++;
    if (i2 === 1) return { toolCalls: [{ name: 'set_field', input: { path: 'chars.0.mood', value: '定', reason: '心安' } }], text: '' };
    return { toolCalls: [{ name: 'finalize_turn', input: { narrative: '本回合无大事。', summary: '平稳' } }], text: '' };
  };
  setAIMessages();
  res = await AM.run(ctx);
  meta = gm._agentTurnMeta || {};
  assert(res.ok === true, '场景2:模型自主写·成功');
  assert(!meta.scaffolded, '场景2:模型自主写(writeOk>0)→ 脚手架不触发(强模型路径零影响)');
  assert(meta.writeOk >= 1 && gm.chars[0].mood === '定', '场景2:模型自己的写生效·非脚手架');

  // ── 场景3:脚手架空(模型彻底无力)但 engine-first 跑过 → auto-suite 仍产完整回合(model-agnostic 核心)──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  globalThis._endTurn_updateSystems = async function () {};  // 引擎先算跑过(engineRan=true·真实在玩态恒真)
  globalThis.callAIWithTools = async function () { return { toolCalls: [{ name: 'get_overview', input: {} }], text: '' }; };
  globalThis.callAIMessages = async function (msgs) {
    var u = (msgs && msgs[1] && msgs[1].content) || '';
    if (/应当落地的具体动作|"actions"/.test(u)) return JSON.stringify({ actions: [] });  // 空动作(模型无力)
    if (/据此产出完整史记/.test(u)) return JSON.stringify({ shizhengji: '时政记。', shilu: '实录。', zhengwen: '政文。', playerStatus: 's', playerInner: 'i', suggestions: [], title: 't', summary: 'm' });
    if (/脉络/.test(u)) return JSON.stringify({ beats: ['甲'] });
    return JSON.stringify({});
  };
  res = await AM.run(ctx);
  meta = gm._agentTurnMeta || {};
  assert(meta.scaffoldActions === 0, '场景3:空 actions → 脚手架 0 落地(不崩)');
  assert(res.ok === true && meta.finalized === true && gm._agentChronicle, '场景3:脚手架空但引擎跑过→auto-suite 仍产完整回合(弱模型零贡献也不空回合)');
  delete globalThis._endTurn_updateSystems;

  // ── 场景4:模型只写1笔即停摆(writeOk=1 < 阈值2·未收尾)→ 脚手架补足动作(着重加强:1笔太薄也补)──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  let i4 = 0;
  globalThis.callAIWithTools = async function () {
    i4++;
    if (i4 === 1) return { toolCalls: [{ name: 'set_field', input: { path: 'minxin', value: 48, reason: '微调' } }], text: '' };
    return { toolCalls: [{ name: 'get_overview', input: {} }], text: '再看看…' };  // 之后只察看·停摆
  };
  setAIMessages();
  res = await AM.run(ctx);
  meta = gm._agentTurnMeta || {};
  assert(meta.scaffolded === true && meta.scaffoldActions === 3, '场景4:模型仅1笔写(<2)且未收尾 → 脚手架补足(scaffolded·3动作)');
  assert(meta.writeOk >= 4, '场景4:模型1笔 + 脚手架3笔 = writeOk≥4(弱模型动作被补厚·不再薄)');

  console.log('[smoke-agent-mode-w1] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
