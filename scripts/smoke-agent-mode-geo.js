'use strict';
// ============================================================
// smoke-agent-mode-geo.js — 「模式 b · 舆地变迁:人物所在地 / 迁都 / 地块易主变色」(2026-06-22·owner"agent 能改人物所在地/迁都/地块所有者变迁变色吗")
//   ① move_character → ch.location/_travelTo  ② relocate_capital → GM.capital+_capitalHistory / fac.capital
//   ③ change_region_owner → 复用 canonical setMapRegionOwner(改 owner+颜色+易主史+重绘地图)
//   纯 node·stub setMapRegionOwner·断言落到 canonical 字段/调用。
// ============================================================
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');
const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
const WT = globalThis.TM.Endturn.AgentWriteTools;
assert(WT && WT.isToolName('move_character') && WT.isToolName('relocate_capital') && WT.isToolName('change_region_owner') && WT.isToolName('adjust_region_state'), '舆地四工具已注册');

function makeGM() {
  return {
    turn: 5, capital: '京师',
    chars: [{ name: '袁崇焕', location: '京师', alive: true }, { name: '孙承宗', location: '京师', alive: true }],
    facs: [{ name: '后金', capital: '赫图阿拉' }],
    _turnReport: [], _agentWriteLog: []
  };
}

(async function () {
  // ── ① move_character ──
  var gm = makeGM();
  var r1 = await WT.handle('move_character', { name: '袁崇焕', location: '宁远', reason: '督师赴任' }, { GM: gm });
  assert(r1.ok, 'move_character ok(移驻)');
  var yuan = gm.chars.filter(function (c) { return c.name === '袁崇焕'; })[0];
  assert(yuan.location === '宁远' && (!yuan._travelTo), '① 已抵:ch.location=宁远·_travelTo 清空');
  var r1b = await WT.handle('move_character', { name: '孙承宗', location: '山海关', traveling: true, reason: '驰援' }, { GM: gm });
  assert(r1b.ok, 'move_character ok(在途)');
  var sun = gm.chars.filter(function (c) { return c.name === '孙承宗'; })[0];
  assert(sun._travelTo === '山海关' && sun.location === '京师', '① 在途:_travelTo=山海关·现居不变(京师)');
  var r1c = await WT.handle('move_character', { name: '某虚构', location: '辽东' }, { GM: gm });
  assert(!r1c.ok && /未找到人物/.test(r1c.text), '① 不存在人物→优雅拒');
  var r1d = await WT.handle('move_character', { name: '袁崇焕' }, { GM: gm });
  assert(!r1d.ok, '① 缺 location→拒');
  assert((gm._turnReport || []).some(function (e) { return e._op === 'move_character'; }), '① 落 _turnReport(_op=move_character)');

  // ── ② relocate_capital ──
  var gm2 = makeGM();
  var r2 = await WT.handle('relocate_capital', { capital: '南京', reason: '避虏南迁' }, { GM: gm2 });
  assert(r2.ok && gm2.capital === '南京', '② 朝廷迁都:GM.capital=南京');
  assert(Array.isArray(gm2._capitalHistory) && gm2._capitalHistory[0].from === '京师' && gm2._capitalHistory[0].to === '南京', '② _capitalHistory 记迁都(京师→南京·镜像 apply move_capital)');
  var r2b = await WT.handle('relocate_capital', { capital: '南京' }, { GM: gm2 });
  assert(!r2b.ok && /已是国都/.test(r2b.text), '② 重复迁同都→拒');
  var r2c = await WT.handle('relocate_capital', { capital: '沈阳', faction: '后金', reason: '入据辽沈' }, { GM: gm2 });
  assert(r2c.ok && gm2.facs[0].capital === '沈阳', '② 势力迁都:fac.capital=沈阳');
  var r2d = await WT.handle('relocate_capital', { capital: '某地', faction: '不存在势力' }, { GM: gm2 });
  assert(!r2d.ok && /未找到势力/.test(r2d.text), '② 不存在势力→拒');

  // ── ③ change_region_owner(stub canonical setMapRegionOwner)──
  var gm3 = makeGM();
  var calls = [];
  globalThis.setMapRegionOwner = function (region, newOwner, opts) { calls.push({ region: region, newOwner: newOwner, opts: opts }); return { name: region, owner: newOwner, ownerName: newOwner, color: '#abc' }; };
  var r3 = await WT.handle('change_region_owner', { region: '辽阳', newOwner: '后金', reason: '城破' }, { GM: gm3 });
  assert(r3.ok, 'change_region_owner ok');
  assert(calls.length === 1 && calls[0].region === '辽阳' && calls[0].newOwner === '后金' && /城破/.test(calls[0].opts.reason), '③ 走 canonical setMapRegionOwner(传 region/newOwner/reason)');
  assert((gm3._turnReport || []).some(function (e) { return e._op === 'change_region_owner' && /map\/辽阳/.test(e.path || ''); }), '③ 落 _turnReport(_op=change_region_owner·path=map/辽阳)');
  var r3b = await WT.handle('change_region_owner', { region: '辽阳' }, { GM: gm3 });
  assert(!r3b.ok && /newOwner/.test(r3b.text), '③ 缺 newOwner→拒');
  // 地块未找到(canonical 返 null)→优雅拒
  globalThis.setMapRegionOwner = function () { return null; };
  var r3c = await WT.handle('change_region_owner', { region: '不存在地块', newOwner: '后金' }, { GM: gm3 });
  assert(!r3c.ok && /未找到地块/.test(r3c.text), '③ 地块未找到(canonical 返 null)→优雅拒');
  // 未加载(地图系统未就绪)→优雅拒
  delete globalThis.setMapRegionOwner;
  var r3d = await WT.handle('change_region_owner', { region: '辽阳', newOwner: '后金' }, { GM: gm3 });
  assert(!r3d.ok && /未加载|未就绪/.test(r3d.text), '③ setMapRegionOwner 未加载→优雅拒(不崩)');

  // ── ④ adjust_region_state(地块软状态·民心/繁荣·按名 _walkDiv 定位)──
  var gm4 = { turn: 5, adminHierarchy: { liaodong: { divisions: [{ name: '宁远', minxin: 50, minxinLocal: 50, prosperity: 40 }] } }, _turnReport: [], _agentWriteLog: [] };
  var r4 = await WT.handle('adjust_region_state', { region: '宁远', field: 'minxin', value: 30, reason: '兵燹' }, { GM: gm4 });
  var nx = gm4.adminHierarchy.liaodong.divisions[0];
  assert(r4.ok && nx.minxin === 30 && nx.minxinLocal === 30, '④ 设民心=30(minxin↔minxinLocal 同步)');
  var r4b = await WT.handle('adjust_region_state', { region: '宁远', field: 'prosperity', delta: -15, reason: '凋敝' }, { GM: gm4 });
  assert(r4b.ok && nx.prosperity === 25, '④ 繁荣 delta -15→25');
  var r4c = await WT.handle('adjust_region_state', { region: '宁远', field: 'minxin', value: 200 }, { GM: gm4 });
  assert(r4c.ok && nx.minxin === 100, '④ clamp 上限 100');
  var r4d = await WT.handle('adjust_region_state', { region: '宁远', field: 'population', value: 9 }, { GM: gm4 });
  assert(!r4d.ok && /软状态/.test(r4d.text), '④ 非软状态字段(population 引擎账)→拒');
  var r4e = await WT.handle('adjust_region_state', { region: '不存在', field: 'minxin', value: 50 }, { GM: gm4 });
  assert(!r4e.ok && /未找到地块/.test(r4e.text), '④ 不存在地块→拒');
  assert((gm4._turnReport || []).some(function (e) { return e._op === 'adjust_region_state'; }), '④ 落 _turnReport(_op=adjust_region_state)');

  // ── ⑤ building_project 须优先落 P.adminHierarchy（BuildingWorks.tick 消费的树）──
  // 旧 bug：写工具只搜 GM.adminHierarchy；当 P/GM 双源不同步时，agent 兴工会写不到建筑 tick 读取的树。
  var gm5 = { turn: 8, adminHierarchy: {}, _turnReport: [], _agentWriteLog: [] };
  globalThis.P = { adminHierarchy: { player: { divisions: [{ name: '宁远', buildings: [] }] } } };
  var r5 = await WT.handle('building_project', { action: 'start', region: '宁远', name: '镇边堡', turns: 2, cost: 20000, reason: '固辽西' }, { GM: gm5 });
  var pDiv = globalThis.P.adminHierarchy.player.divisions[0];
  assert(r5.ok && pDiv.buildings.length === 1 && pDiv.buildings[0].name === '镇边堡', '⑤ building_project 双源定位：GM无地块时落 P.adminHierarchy（建筑tick可消费）');
  assert((gm5._turnReport || []).some(function (e) { return e._op === 'building_start'; }), '⑤ building_project 落 _turnReport(_op=building_start)');
  delete globalThis.P;

  console.log('[smoke-agent-mode-geo] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
