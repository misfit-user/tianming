'use strict';
// ============================================================
// smoke-agent-mode-tools.js — 「模式 b · 高阶聚合读工具」(2026-06·owner"给 agent 更高工具·一调抓全·省计费调用")
//   验 get_dossier(一调抓全维度) / read_chronicle(编年长期事势) / read_records(回顾往事·史记/御批回听)
//   纯只读·断言聚合内容正确。
// ============================================================
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');
const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
const RT = globalThis.TM.Endturn.AgentReadTools;
assert(RT && typeof RT.handle === 'function', 'AgentReadTools.handle 已导出');

function makeGM() {
  return {
    turn: 5, eraName: '崇祯元年', guoku: 340000, neitang: 200000, minxin: 45,
    vars: { '银荒指数': { value: 55 }, '党争烈度': { value: 58 }, '辽饷积欠': { value: 460 }, '民心': { value: 45 } },
    facs: [{ name: '阉党', power: 92, stance: '敌对·伺机', intent: '排除异己专权' }, { name: '东林', power: 4, stance: '蛰伏' }],
    armies: [{ name: '关宁军', strength: 8 }, { name: '京营', strength: 5 }], activeWars: [],
    chars: [{ name: '魏忠贤', loyalty: 8, ambition: 98, officialTitle: '司礼监秉笔', alive: true, relations: [{ target: '崔呈秀', type: '党羽', value: 80 }, { target: '东林党', type: 'political', value: -90, hostility: 90 }] }, { name: '袁崇焕', loyalty: 83, ambition: 40, officialTitle: '蓟辽督师', alive: true }],
    factionRelationsMap: { '阉党': { '东林': { type: '敌对', value: -85 }, '后金': { type: '中立', value: 0 } } },
    evtLog: [{ turn: 5, text: '户部清查辽饷亏空三十万两' }, { turn: 5, text: '后金掠辽西弃二堡' }, { turn: 5, text: '江南商民因税罢市' }],
    _chronicleTracks: [{ type: 'edict', title: '彻查辽饷亏空', status: 'active', currentStage: '核账', progress: 30, actor: '户部', narrative: '户部核账旬日得亏空逾三十万' }, { type: 'project', title: '关宁筑城', status: 'active', progress: 50 }, { title: '旧科举案', status: 'completed', result: '已结' }],
    shijiHistory: [{ turn: 3, szjTitle: '诛阉初动', shilu: '三月，锦衣卫田尔耕下狱。', shizhengji: '时政记·三月诛阉。', playerInner: '不除此獠寝食难安。' }, { turn: 4, szjTitle: '起袁查饷', shilu: '四月，起袁崇焕为蓟辽督师。', shizhengji: '时政记·四月起袁。' }],
    qijuHistory: [{ turn: 3, text: '帝御文华殿批奏疏至夜' }, { turn: 4, text: '帝召孙承宗议辽事', _annotation: '辽事托付卿矣，勿负朕望' }],
    // ④ 深取记忆(超窗·压缩≠删·可查全)
    _consolidatedMemory: [{ turn: 1, summary: '崇祯登基诛阉布局' }, { turn: 2, summary: '魏党田尔耕下狱' }, { turn: 3, summary: '起袁崇焕查辽饷' }, { turn: 4, summary: '辽饷亏空牵出阉党' }],
    _sagaMemory: { turn: 4, text: '崇祯初政主线:诛阉→起袁查饷→党争成焦点。' }
  };
}

(async function () {
  const gm = makeGM(); const ctx = { GM: gm };

  // ── get_dossier 各维度 ──
  let r = await RT.handle('get_dossier', { dimension: 'fiscal' }, ctx);
  assert(/财政全貌/.test(r.text) && /340000/.test(r.text), 'get_dossier fiscal:含国库');
  assert(/银荒指数/.test(r.text) && /辽饷积欠/.test(r.text), 'get_dossier fiscal:按关键词抓到相关变量(银荒/辽饷)');
  assert(/辽饷亏空三十万/.test(r.text), 'get_dossier fiscal:抓到相关近期事件');

  r = await RT.handle('get_dossier', { dimension: '军事' }, ctx);
  assert(/军事边防/.test(r.text) && /关宁军/.test(r.text), 'get_dossier 军事:含军队实体');
  assert(/后金掠辽西/.test(r.text), 'get_dossier 军事:抓到军事近事');

  r = await RT.handle('get_dossier', { dimension: 'diplomacy' }, ctx);
  assert(/势力外交/.test(r.text) && /阉党/.test(r.text) && /权势92/.test(r.text) && /敌对/.test(r.text), 'get_dossier 外交:含势力权势+态度+意图');

  r = await RT.handle('get_dossier', { dimension: 'court' }, ctx);
  assert(/朝局党争/.test(r.text) && /魏忠贤/.test(r.text) && /野98/.test(r.text), 'get_dossier 党争:按野心列关键人物');

  r = await RT.handle('get_dossier', { dimension: 'personnel' }, ctx);
  assert(/人事铨选/.test(r.text) && /蓟辽督师/.test(r.text), 'get_dossier 人事:列在任官员+职衔');

  r = await RT.handle('get_dossier', { dimension: '辽东' }, ctx);  // 未预置维度 → 主题深查兜底
  assert(/主题深查|检索/.test(r.text), 'get_dossier 未知维度:回落主题全局深查(不崩)');

  // ── read_chronicle ──
  r = await RT.handle('read_chronicle', {}, ctx);
  assert(/编年/.test(r.text) && /彻查辽饷亏空/.test(r.text) && /核账/.test(r.text), 'read_chronicle:列进行中长期事势+阶段');
  assert(/关宁筑城/.test(r.text), 'read_chronicle:多条进行中');
  assert(/旧科举案/.test(r.text), 'read_chronicle:近完成也列(在"近完成"区)');

  // ── read_records ──
  r = await RT.handle('read_records', { kind: 'shiji', count: 3 }, ctx);
  assert(/史记/.test(r.text) && /起袁崇焕为蓟辽督师/.test(r.text) && /诛阉初动/.test(r.text), 'read_records shiji:回顾过往实录/时政');
  assert(/君心/.test(r.text), 'read_records shiji:含君心(playerInner)');

  r = await RT.handle('read_records', { kind: 'qiju' }, ctx);
  assert(/御批回听|起居注/.test(r.text) && /辽事托付卿/.test(r.text), 'read_records qiju:回顾起居注+御批回听(玩家往昔御批)');

  // ④ read_records kind=memory:深取固化记忆(超窗的早期回合·压缩≠删·可主动查全)
  r = await RT.handle('read_records', { kind: 'memory', count: 20 }, ctx);
  assert(/固化记忆.*深取/.test(r.text) && /诛阉布局/.test(r.text) && /多回合综合脉络/.test(r.text), 'read_records memory:深取全量固化记忆(含早期第1回)+ saga 脉络');
  r = await RT.handle('read_records', { kind: 'memory', fromTurn: 1, toTurn: 2 }, ctx);
  assert(/诛阉布局/.test(r.text) && /田尔耕下狱/.test(r.text) && !/起袁崇焕查辽饷/.test(r.text), 'read_records memory:按 fromTurn/toTurn 查特定旧时段(只1-2回)');

  // ── get_relations 关系网 ──
  r = await RT.handle('get_relations', { name: '魏忠贤' }, ctx);
  assert(/人际关系/.test(r.text) && /崔呈秀/.test(r.text) && /党羽/.test(r.text), 'get_relations:人物人际关系(党羽崔呈秀)');
  r = await RT.handle('get_relations', { name: '阉党' }, ctx);
  assert(/势力邦交/.test(r.text) && /东林/.test(r.text) && /敌对/.test(r.text), 'get_relations:势力邦交(阉党对东林敌对)');

  // ── defs 注册 ──
  const names = RT.defs().map(function (d) { return d.name; });
  assert(names.indexOf('get_dossier') >= 0 && names.indexOf('read_chronicle') >= 0 && names.indexOf('read_records') >= 0 && names.indexOf('get_relations') >= 0, '高阶+关系工具已注册进 defs(agent 可见可调)');
  assert(names.length === 12 && names.includes('read_memory') && names.includes('recall_related'), 'defs 共十二工具，原十项及两项证据工具齐全');

  console.log('[smoke-agent-mode-tools] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
