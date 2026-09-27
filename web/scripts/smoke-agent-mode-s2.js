'use strict';
// ============================================================
// smoke-agent-mode-s2.js — 「模式 b · agent 模式」S2 只读工具集守卫
//   验:6 工具每个取数正确 + 纯只读不 mutate + 缺失优雅兜底 + recall 复用② + index.html 注册
// ============================================================

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
const RT = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.AgentReadTools;
assert(RT && typeof RT.handle === 'function', 'AgentReadTools.handle 已导出');
assert(RT.defs().length === 12 && RT.isToolName('read_memory') && RT.isToolName('recall_related'), '12 个只读工具：原十项保留，增加证据展开与关联追查');
assert(RT.isToolName('get_field') && RT.isToolName('search_save') && RT.isToolName('get_dossier') && RT.isToolName('get_relations') && !RT.isToolName('set_field'), 'isToolName 认只读工具(含高阶)·拒写工具');

// 造一份代表性 mock GM
function makeGM() {
  return {
    turn: 7, eraName: '建炎元年', guoku: 12000, neitang: 3000, population: 4500000,
    chars: [
      { id: 'c1', name: '张三', office: '户部尚书', loyalty: 80, _secret: '内部脏字段' },
      { name: '李四', post: '兵部侍郎' }
    ],
    facs: [ { name: '北府', strength: 88 }, { name: '西路', strength: 50 } ],
    armies: [ { name: '禁军', troops: 5000 } ],
    evtLog: [ { turn: 6, type: 'war', text: '北方边境告急' }, { turn: 7, type: 'court', text: '廷议增税' } ],
    memorials: [ { from: '王五', text: '请罢苛捐以安民' } ],
    activeEdicts: [ { title: '轻徭薄赋' } ],
    activeWars: []
  };
}

(async function () {
  const gm = makeGM();
  const snapshot = JSON.stringify(gm);  // 用于「纯只读」校验
  const ctx = { GM: gm };

  // get_overview
  let r = await RT.handle('get_overview', {}, ctx);
  assert(r.ok && /回合 7/.test(r.text) && /国库/.test(r.text) && /chars 计 2 项/.test(r.text), 'get_overview 含回合/国库/实体计数');
  assert(/北方边境告急/.test(r.text), 'get_overview 含近期大事');

  // get_field — 标量 / 嵌套数组下标 / 不存在 / 不略 _ 字段
  r = await RT.handle('get_field', { path: 'guoku' }, ctx);
  assert(r.ok && /12000/.test(r.text), 'get_field 读标量 guoku=12000');
  r = await RT.handle('get_field', { path: 'chars.0.name' }, ctx);
  assert(/张三/.test(r.text), 'get_field 读嵌套 chars.0.name=张三');
  r = await RT.handle('get_field', { path: 'chars.0' }, ctx);
  assert(/_secret/.test(r.text), 'get_field 不略 _ 字段(想看什么看什么)');
  r = await RT.handle('get_field', { path: 'GM.guoku' }, ctx);
  assert(/12000/.test(r.text), 'get_field 容忍 "GM." 前缀');
  r = await RT.handle('get_field', { path: 'nope.nope' }, ctx);
  assert(/未找到/.test(r.text), 'get_field 不存在路径→优雅兜底');

  // list_entities
  r = await RT.handle('list_entities', { kind: 'chars' }, ctx);
  assert(r.ok && /张三/.test(r.text) && /李四/.test(r.text) && /共 2 项/.test(r.text), 'list_entities chars 列全');
  assert(/office:户部尚书/.test(r.text), 'list_entities 附关键字段摘要');
  r = await RT.handle('list_entities', { kind: 'factions' }, ctx);
  assert(/北府/.test(r.text) && /西路/.test(r.text), 'list_entities factions(facs 别名解析)');
  r = await RT.handle('list_entities', { kind: 'nonesuch' }, ctx);
  assert(/无此类|为空/.test(r.text), 'list_entities 未知 kind→兜底');

  // inspect_entity — by name / by id / by index / 未找到
  r = await RT.handle('inspect_entity', { kind: 'chars', id: '张三' }, ctx);
  assert(r.ok && /户部尚书/.test(r.text) && /loyalty/.test(r.text), 'inspect_entity by name 出完整记录');
  r = await RT.handle('inspect_entity', { kind: 'chars', id: 'c1' }, ctx);
  assert(/张三/.test(r.text), 'inspect_entity by id');
  r = await RT.handle('inspect_entity', { kind: 'chars', id: '1' }, ctx);
  assert(/李四/.test(r.text), 'inspect_entity by 下标');
  r = await RT.handle('inspect_entity', { kind: 'chars', id: '查无此人' }, ctx);
  assert(/未找到/.test(r.text), 'inspect_entity 未找到→兜底');

  // search_save — 跨类命中
  r = await RT.handle('search_save', { query: '北方' }, ctx);
  assert(r.ok && /events/.test(r.text) && /告急/.test(r.text), 'search_save 命中 evtLog');
  r = await RT.handle('search_save', { query: '苛捐' }, ctx);
  assert(/memorials/.test(r.text), 'search_save 命中 memorials');
  r = await RT.handle('search_save', { query: '虚无缥缈xyz' }, ctx);
  assert(/未检索到/.test(r.text), 'search_save 无命中→兜底');

  // recall_history — 复用②(stub exec·验签名 terms:[query] + hits 格式化)
  let capturedExec = null;
  globalThis.TM.MemoryAgentTools = {
    exec: async function (name, input, g) { capturedExec = { name: name, input: input }; return { ok: true, hits: [{ text: '先例:本朝曾因苛税激民变' }] }; }
  };
  r = await RT.handle('recall_history', { query: '税' }, ctx);
  assert(capturedExec && capturedExec.name === 'recall_by_term', 'recall_history 调②exec(recall_by_term)');
  assert(capturedExec.input && Array.isArray(capturedExec.input.terms) && capturedExec.input.terms[0] === '税', 'recall_history 传 terms:[query]');
  assert(/先例:本朝曾因苛税/.test(r.text), 'recall_history 格式化②的 hits');
  // ②未加载→兜底
  delete globalThis.TM.MemoryAgentTools;
  r = await RT.handle('recall_history', { query: '税' }, ctx);
  assert(/②未加载/.test(r.text), 'recall_history ②缺失→兜底不抛');

  // ★纯只读:跑完所有工具后 GM 不变
  assert(JSON.stringify(gm) === snapshot, '所有工具纯只读·GM 未被 mutate');

  // 未知工具兜底
  r = await RT.handle('frobnicate', {}, ctx);
  assert(r.ok === false && /未知只读工具/.test(r.text), '未知工具→{ok:false}兜底');

  // ── 源码/注册守卫 ──
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const regRead = indexSrc.indexOf('tm-endturn-agent-read-tools.js');
  const regAgent = indexSrc.indexOf('tm-endturn-agent-mode.js');
  assert(regRead >= 0, 'index.html 注册 tm-endturn-agent-read-tools.js');
  assert(regAgent >= 0 && regRead > regAgent, '只读工具在 agent-mode 模块之后加载');

  console.log('[smoke-agent-mode-s2] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
