// smoke-army-places-prompt.js — 主推演提示词写明诸军驻在哪块、四邻是谁（11-23 同志定：地块编号做根）
//
// 先前【本朝军力·全貌】只列兵数最多的六支的兵数、训练、主帅，不写驻地；AI 调兵不知道军在哪、哪块挨着哪块。
// 现在【诸军驻地】按地块列本方各军（地块〔四邻〕：军名 兵数，落在代表点上的注明原写的驻地文字），
// 【近边别家之军】列本方疆域与驻军所在两程以内地块上的别家之军，末尾一行告诉 AI 调兵只写舆图上的地块名。
// 地块读内核绑定；四邻天启、绍宋记编号，晚唐记地名，两样都要认得。没有地块的剧本不列。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
}

const region = (id, name, x, y, owner, neighbors, aliases) => ({ id, name, center: [x, y], owner, currentOwner: owner, neighbors, aliases: aliases || [] });
function run(GM, P) {
  const ctx = { console, Map, Set, WeakMap, JSON, Math, GM, P, TM: {} };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['tm-map-locations.js', 'tm-endturn-ai-context.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  (GM.armies || []).forEach((a) => { if (ctx.TMMapLocations.enabled(GM.mapData)) ctx.TMMapLocations.sync(a, 'army', GM); });
  return ctx.TM.EndTurnAIContext.appendPromptPolicyContext('', { GM, P });
}
const ming = (neighborsByName) => {
  const nb = (ids, names) => (neighborsByName ? names : ids);
  return {
    turn: 2,
    facs: [{ id: 'f-ming', name: '明朝廷', capital: '北京' }, { id: 'f-jin', name: '后金', capital: '沈阳' }, { id: 'f-cha', name: '察哈尔', capital: '归化城' }],
    chars: [],
    armies: [
      { id: 'a1', name: '关宁军主力', faction: '明朝廷', soldiers: 80000, garrison: '宁远-锦州', location: '宁远-锦州' },
      { id: 'a2', name: '京营·神机营', faction: '明朝廷', soldiers: 20000, garrison: '京师', location: '京师' },
      { id: 'a3', name: '两黄旗', faction: '后金', soldiers: 15000, garrison: '锦州城', location: '锦州城' },
      { id: 'a4', name: '察哈尔主力', faction: '察哈尔', soldiers: 30000, garrison: '归化城', location: '归化城' },
      { id: 'a6', name: '两红旗', faction: '后金', soldiers: 14000, garrison: '辽阳', location: '辽阳' },
      { id: 'a7', name: '正蓝旗', faction: '后金', soldiers: 7000, garrison: '赫图阿拉', location: '赫图阿拉' },
      { id: 'a5', name: '流民', faction: '陕北饥民', soldiers: 5000, garrison: '顺天府', location: '顺天府', _revoltBand: true },
    ],
    mapData: {
      regions: [
        region('r-bj', '顺天府', 0, 0, 'f-ming', nb(['r-ny'], ['宁远城']), ['京师', '北京']),
        region('r-ny', '宁远城', 100, -50, 'f-ming', nb(['r-bj', 'r-jz'], ['顺天府', '锦州城']), ['宁远']),
        region('r-jz', '锦州城', 130, -70, 'f-ming', nb(['r-ny', 'r-sy'], ['宁远城', '沈阳']), ['锦州']),
        region('r-sy', '沈阳', 200, -150, 'f-jin', nb(['r-jz', 'r-ly'], ['锦州城', '辽阳'])),
        region('r-ly', '辽阳', 190, -120, 'f-jin', nb(['r-sy', 'r-hl'], ['沈阳', '赫图阿拉'])),
        region('r-hl', '赫图阿拉', 260, -160, 'f-jin', nb(['r-ly'], ['辽阳'])),
        region('r-gh', '归化城', -300, -200, 'f-cha', []),
      ],
    },
  };
};
const P = { playerInfo: { factionName: '明朝廷' } };

console.log('[1] 本方各军按地块列，带四邻；落在代表点上的注明原写的驻地');
{
  const out = run(ming(false), P);
  assert(out.includes('【诸军驻地】'), '有【诸军驻地】');
  assert(/宁远城〔顺天府、锦州城〕：关宁军主力 80000（约在此，原写「宁远-锦州」）/.test(out), '关宁军主力在宁远城，四邻顺天府、锦州城，注明原写「宁远-锦州」');
  assert(/顺天府〔宁远城〕：京营·神机营 20000/.test(out), '京营在顺天府');
  assert(out.indexOf('宁远城〔') < out.indexOf('顺天府〔'), '兵多的地块排前');
}

console.log('[2] 本方疆域与驻军两程以内的别家之军另列；更远的、民变的不列');
{
  const out = run(ming(false), P);
  assert(/【近边别家之军】[\s\S]*锦州城：后金·两黄旗 15000/.test(out), '入了本方疆域锦州城的后金两黄旗列出');
  assert(/辽阳：后金·两红旗 14000/.test(out), '隔一块（沈阳）的辽阳两红旗也列出');
  assert(!out.includes('正蓝旗'), '三程外赫图阿拉的正蓝旗不列');
  assert(!out.includes('察哈尔主力'), '归化城不挨着本方驻军，不列');
  assert(!/【诸军驻地】[^【]*流民/.test(out) && !/【近边别家之军】[^【]*流民/.test(out), '民变的股不在这两段里（另有【各地民变】）');
  assert(/调兵、移驻写 army_changes：去处 destination、驻地 location 只写舆图上的地块名/.test(out), '末尾告诉 AI 调兵只写地块名');
}

console.log('[3] 四邻记地名的地图（晚唐）也认得');
{
  const out = run(ming(true), P);
  assert(/宁远城〔顺天府、锦州城〕/.test(out), '四邻按地名换回地块，照样列出');
}

console.log('[4] 没有地块的剧本不列');
{
  const GM = ming(false); GM.mapData = { regions: [] };
  const out = run(GM, P);
  assert(!out.includes('【诸军驻地】'), '不列【诸军驻地】');
}

console.log('[5] 在途的军注明往哪（逐块行军，11-23 同志定乙）');
{
  const GM = ming(false);
  GM.marchOrders = [{ id: 'm1', armyId: 'a2', armyName: '京营·神机营', status: 'marching', regionPath: ['r-bj', 'r-ny'], toRegionId: 'r-ny', toName: '宁远城', seg: 0, segKm: 0, segments: [{ toRegionId: 'r-ny', km: 300 }] }];
  const ctx = { console, Map, Set, WeakMap, JSON, Math, GM, P, TM: {} };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['tm-map-locations.js', 'tm-map-route-days.js', 'tm-army-march.js', 'tm-endturn-ai-context.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  GM.armies.forEach((a) => ctx.TMMapLocations.sync(a, 'army', GM));
  const out = ctx.TM.EndTurnAIContext.appendPromptPolicyContext('', { GM, P });
  assert(/顺天府〔宁远城〕：京营·神机营 20000（行军中，往宁远城）/.test(out), '京营在顺天府，注明行军中往宁远城');
  assert(/关宁军主力 80000（约在此，原写「宁远-锦州」）(?!（行军中)/.test(out), '不在途的不注');
}

if (failed) { console.log('FAIL smoke-army-places-prompt: ' + failed + ' 项'); process.exit(1); }
console.log('PASS smoke-army-places-prompt');
