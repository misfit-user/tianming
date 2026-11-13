#!/usr/bin/env node
'use strict';
// smoke-office-vacant-by-rule — 按制不除（11-13 同志「按你推荐来」）
//   剧本给官位写 vacantByRule：此职按当时制度不除人（如南宋初户部「或止除尚书若侍郎一员」，《宋史》卷一六三）。
//   空着时：占员共读口标「按制不除」、不标「出缺」；履职结算不衰减、不报失职（不进征收缺口）；给 AI 的官制摘要不算「缺」。
//   有人坐上即照常结算；没写这一项的官位出缺照旧衰减、照旧报失职。
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 1e-6, m + '（得 ' + a + '，应 ' + b + '）'); }

function env() {
  const c = { console, Math, JSON, setTimeout() {}, clearTimeout() {}, P: { conf: {} }, GM: { turn: 1, chars: [], officeTree: [] } };
  c.window = c; c.globalThis = c; c.getRankLevel = () => 4;
  c.findCharByName = (n) => c.GM.chars.find((x) => x.name === n);
  vm.createContext(c);
  ['tm-office-holder-state.js', 'tm-office-action-evidence.js', 'tm-office-dutystate.js', 'tm-office-authority.js', 'tm-office-powermap.js']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f }));
  const shang = { id: 'c1', name: '尚书甲', administration: 60, military: 0, management: 60, intelligence: 60, wuchang: { ren: 60, yi: 60, li: 60, zhi: 60, xin: 60 } };
  const lang = { id: 'c2', name: '侍郎乙', administration: 60, military: 0, management: 60, intelligence: 60, wuchang: { ren: 60, yi: 60, li: 60, zhi: 60, xin: 60 } };
  c.GM.chars.push(shang, lang);
  c.GM.officeTree = [{ id: 'hubu', name: '户部', positions: [
    { id: 'sh', name: '户部尚书', rank: '从二品', holder: shang.name, holderId: shang.id, establishedCount: 1, vacancyCount: 0, powers: { taxCollect: true } },
    { id: 'sl', name: '户部侍郎', rank: '正四品', holder: '', establishedCount: 2, vacancyCount: 2, vacantByRule: true, powers: { taxCollect: true } },
    { id: 'dz', name: '度支郎中', rank: '从六品', holder: '', establishedCount: 1, vacancyCount: 1, powers: { taxCollect: true } }
  ] }];
  return { c, shang, lang };
}
const posOf = (c, id) => c.GM.officeTree[0].positions.find((p) => p.id === id);

console.log('smoke-office-vacant-by-rule');
{
  const { c } = env();
  const HS = c.TM.OfficeHolderState;
  const sl = HS.read(c.GM, posOf(c, 'sl')), dz = HS.read(c.GM, posOf(c, 'dz'));
  ok(sl.vacantByRule === true && sl.label === '按制不除', '按制不除的侍郎标「按制不除」：' + sl.label);
  ok(sl.status === 'vacant' && sl.occupied === false && sl.vacancyCount === 2, '仍是空着（可任命），员额照记');
  ok(dz.vacantByRule === false && dz.label === '出缺', '没写这一项的度支郎中照旧「出缺」');

  // 三个月：侍郎不衰减、不报；度支郎中照旧衰减、第二月起报失职
  const seen = [];
  for (let m = 1; m <= 3; m++) {
    c.GM.turn = m;
    const agg = c.tickOfficeDutyState(c.GM, { days: 30 });
    seen.push(agg.details.filter((d) => d.lever === 'compliance').map((d) => d.pos + ':' + d.band));
  }
  near(posOf(c, 'sl')._dutyState.fulfillment, 50, '三个月后侍郎履职度仍是中性 50');
  ok(posOf(c, 'dz')._dutyState.fulfillment < 35, '度支郎中出缺照旧衰减到失职带：' + Math.round(posOf(c, 'dz')._dutyState.fulfillment));
  ok(seen.every((rows) => rows.every((r) => r.indexOf('户部侍郎') < 0)), '三个月侍郎都不报征收失职：' + JSON.stringify(seen));
  ok(seen[2].some((r) => r === '度支郎中:low'), '度支郎中第三月报失职');

  // 给 AI 的官制摘要：按制不除不算缺；度支郎中那一缺照算
  const map = c.buildOfficePowerMap(c.GM, { cap: 12 });
  ok(/户部·弱\(1缺\)/.test(map), '官制摘要只记度支郎中一缺：' + (map.split('\n')[0] || '').slice(0, 80));
  ok(map.indexOf('户部侍郎 按制不除') >= 0, '摘要里侍郎写「按制不除」');
}
{
  // 有人坐上即照常结算：侍郎乙坐一员，按其才德漂移，不再锁在 50
  const { c, lang } = env();
  const sl = posOf(c, 'sl');
  Object.assign(sl, { holder: lang.name, holderId: lang.id, vacancyCount: 1 });
  sl._dutyState = { fulfillment: 50, lastTurn: null };
  for (let m = 1; m <= 2; m++) { c.GM.turn = m; c.tickOfficeDutyState(c.GM, { days: 30 }); }
  const st = c.TM.OfficeHolderState.read(c.GM, sl);
  ok(st.occupied && st.label === '侍郎乙', '坐上一员后标在任者：' + st.label);
  ok(Math.abs(sl._dutyState.fulfillment - 50) > 0.5, '有人坐上即照常漂移：' + sl._dutyState.fulfillment.toFixed(2));
}
{
  // 先出缺衰减到失职带、后改成按制不除：回到中性，不再报失职
  const { c } = env();
  const dz = posOf(c, 'dz');
  for (let m = 1; m <= 3; m++) { c.GM.turn = m; c.tickOfficeDutyState(c.GM, { days: 30 }); }
  ok(dz._dutyState.fulfillment < 35, '度支郎中先衰减到失职带');
  dz.vacantByRule = true;
  c.GM.turn = 4;
  const agg = c.tickOfficeDutyState(c.GM, { days: 30 });
  near(dz._dutyState.fulfillment, 50, '改成按制不除后回中性 50');
  ok(!agg.details.some((d) => d.pos === '度支郎中'), '改后不再报失职');
}
console.log('PASS office-vacant-by-rule ' + A + ' assertions');
