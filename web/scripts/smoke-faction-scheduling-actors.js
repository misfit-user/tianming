'use strict';
// ============================================================
// smoke-faction-scheduling-actors.js — 势力调度有真人可绑（11-13）
//   ① 天启三家外藩开局即有职任：播州杨朝栋、郑氏郑芝龙、日本德川家光，只配对外交涉与签约
//   ② 官方剧本清单带外藩职任：不含玩家势力，不含民变
//   ③ 旧档（09-28 前开局，外藩无职任）读档补回整棵职任，补回结果与新开局逐字一致；未迁移的旧档同样
//   ④ 已有职任不动、按名认势力、剧本人物 id 本局没有就按姓名认、已故不挂名、无清单不补、
//      玩家势力不补、议事规程随整棵树补、补两次不变
//   ⑤ 补失败只记警告，不拦迁移
//   ⑥ 势力调度一次问完：按需取数工具已撤
// ============================================================
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { official } = require('./lib-political-official-fixture');

const WEB = path.resolve(__dirname, '..');
let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }
// 夹具里的模块跑在 vm 里，它造的数组、对象原型属另一个 realm；structuredClone 两边归到本 realm 再比（保留 undefined）
function eq(actual, expected, msg) { assert.deepEqual(structuredClone(actual), structuredClone(expected), msg); passed++; }
const clone = (x) => JSON.parse(JSON.stringify(x));

const NEW_OFFICES = {
  fac_mp9rsc3fuezsa: { leader: 'char_tq1627_nonming_yang_chaodong', name: '杨朝栋', title: '播州余裔山寨首领' },
  fac_mp9rsc3funmyu: { leader: 'char_mp3yvbcadbbxj', name: '郑芝龙', title: '海贸大头领' },
  'fac-tokugawa-japan': { leader: 'char_supp_tokugawa_iemitsu', name: '德川家光', title: '征夷大将军' }
};
const DIPLOMATS = ['fac_mp9rsc3f4r9co', 'fac_mp9rsc3fex7fo'].concat(Object.keys(NEW_OFFICES));  // 后金、察哈尔 + 新补三家

const c = official('天启');
const B = c.TM.PoliticalActions;
const H = c.TM.OfficeHolderState;
c.load('bundled-scenarios/manifest.js');
const realManifest = c.TMOfficialScenarioManifest;
const entryOf = (manifest, sid) => manifest.entries.find((e) => e.id === sid);
const offices = JSON.parse(entryOf(realManifest, c.GM.sid).factionOffices);
const freshGM = clone(c.GM);
const fac = (g, id) => g.facs.find((f) => f.id === id);

// ── ② 清单 ──
for (const [sid, player] of [['sc-tianqi7-1627', '明朝廷'], ['sc-tang840-840', '唐朝廷'], ['sc-jianyan1-1127-shaosong', '大宋']]) {
  const entry = entryOf(realManifest, sid);
  ok(entry && typeof entry.factionOffices === 'string', sid + ' 清单带外藩职任（JSON 字串）');
  const rows = Object.values(JSON.parse(entry.factionOffices));
  ok(rows.length > 0 && rows.every((r) => Array.isArray(r.officeTree) || r.politicalRules), sid + ' 每家都有职任或议事规程');
  ok(!rows.some((r) => r.name === player), sid + ' 不含玩家势力 ' + player);
}
eq(Object.keys(offices).length, 13, '天启清单十三家外藩');
ok(Object.keys(NEW_OFFICES).every((id) => offices[id]), '天启清单含新补三家');
ok(!Object.values(offices).some((r) => /饥民/.test(r.name)), '民变不在清单');

// ── ① 新开局：三家首领持职，只能外交与签约 ──
for (const [id, want] of Object.entries(NEW_OFFICES)) {
  const f = fac(c.GM, id);
  const pos = f.officeTree[0].positions[0];
  eq([pos.id, pos.name, pos.holderId, pos.powers], ['political-office:' + id + ':sovereign', want.title, want.leader, { diplomacy: true, treatySign: true }], f.name + ' 职任');
  eq(B.principals(f, 'diplomacy').map((r) => r.actor.id), [want.leader], f.name + ' 外交由 ' + want.name + ' 拿主意');
  eq(B.principals(f, 'treatySign').map((r) => r.actor.id), [want.leader], f.name + ' 签约由 ' + want.name);
  eq(B.principals(f, 'appointment').length, 0, f.name + ' 不能任免');
}
const rebels = c.GM.facs.find((f) => /饥民/.test(f.name));
eq(B.principals(rebels).length, 0, '陕北饥民无职任可绑（民变另线）');
const freshTrees = {};
Object.keys(offices).forEach((id) => { freshTrees[id] = clone(fac(c.GM, id).officeTree); });

// ── 旧档：外藩无职任；默认已迁移过（politicalVersion=1），同志那局就是这样 ──
function oldSave(edit) {
  const g = clone(freshGM);
  for (const f of g.facs) if (offices[f.id]) { delete f.officeTree; delete f.politicalRules; }
  if (edit) edit(g);
  c.GM = g;
  c.TM.FactionIndex.rebuild();
  return g;
}
function withManifest(manifest, fn) {
  c.TMOfficialScenarioManifest = manifest;
  try { return fn(); } finally { c.TMOfficialScenarioManifest = realManifest; }
}
function manifestWith(rows) {
  const m = clone(realManifest);
  const e = entryOf(m, freshGM.sid);
  e.factionOffices = typeof rows === 'string' ? rows : JSON.stringify(Object.assign(JSON.parse(e.factionOffices), rows));
  return m;
}

// ── ③ 补回 = 新开局 ──
{
  const g = oldSave();
  ok(Object.keys(offices).every((id) => B.principals(fac(g, id)).length === 0), '旧档补前：十三家外藩无人可绑');
  const r = B.migrate();
  ok(r.ok, '旧档迁移成功');
  for (const id of Object.keys(offices)) eq(fac(g, id).officeTree, freshTrees[id], fac(g, id).name + ' 补回与新开局一致');
  ok(Object.keys(offices).every((id) => B.principals(fac(g, id)).length === 1), '补后十三家各绑一人');
  eq(DIPLOMATS.map((id) => B.principals(fac(g, id), 'diplomacy').length), [1, 1, 1, 1, 1], '后金、察哈尔与新补三家能对外交涉');
  const before = JSON.stringify(g.facs);
  ok(B.migrate().ok && JSON.stringify(g.facs) === before, '补两次不变');
}
{
  const g = oldSave((s) => { delete s._npcActionState.politicalVersion; });
  const r = B.migrate();
  ok(r.ok && r.changed && g._npcActionState.politicalVersion === 1, '未迁移的旧档：补职任后照常迁移');
  for (const id of Object.keys(offices)) eq(fac(g, id).officeTree, freshTrees[id], fac(g, id).name + ' 未迁移旧档补回亦与新开局一致');
}

// ── ④ 边界 ──
{
  const custom = [{ id: 'custom-dept', name: '自定', positions: [{ id: 'custom-pos', name: '自定汗', holder: '皇太极', holderId: 'char_mp3yvbcaov2vr' }], subs: [] }];
  const g = oldSave((s) => { fac(s, 'fac_mp9rsc3f4r9co').officeTree = clone(custom); });
  B.migrate();
  eq(fac(g, 'fac_mp9rsc3f4r9co').officeTree, custom, '已有职任的势力一概不动');
}
{
  const g = oldSave((s) => { fac(s, 'fac_mp9rsc3funmyu').id = 'fac-zheng-renamed'; });
  B.migrate();
  const z = fac(g, 'fac-zheng-renamed');
  ok(Array.isArray(z.officeTree) && z.officeTree.length === 1, '势力 id 对不上时按唯一名称认：郑氏海商补回');
  eq(B.principals(z, 'diplomacy').map((r) => r.actor.name), ['郑芝龙'], '按名认回的郑氏仍由郑芝龙拿主意');
}
{
  const g = oldSave((s) => { s.chars.find((ch) => ch.id === 'char_tq1627_nonming_yang_chaodong').id = 'char-yang-in-save'; });
  B.migrate();
  eq(fac(g, 'fac_mp9rsc3fuezsa').officeTree[0].positions[0].holderId, 'char-yang-in-save', '剧本里的人物 id 本局没有：按姓名认到本局的杨朝栋');
}
{
  const g = oldSave((s) => { s.chars.find((ch) => ch.id === 'char_supp_tokugawa_iemitsu').alive = false; });
  B.migrate();
  const pos = fac(g, 'fac-tokugawa-japan').officeTree[0].positions[0];
  eq([pos.holder, pos.holderId, pos.vacancyCount, H.read(g, pos).status], ['', undefined, 1, 'vacant'], '剧本开局的任职人本局已故：补回时不挂名、记出缺');
  eq(B.principals(fac(g, 'fac-tokugawa-japan')).length, 0, '已故不再替日本幕府拿主意');
}
{
  const g = oldSave();
  const r = withManifest(undefined, () => B.migrate());
  ok(r.ok && Object.keys(offices).every((id) => !fac(g, id).officeTree), '没有官方清单（自制剧本、清单缺失）：不补');
}
{
  const ming = freshGM.facs.find((f) => f.name === '明朝廷');
  const g = oldSave();
  withManifest(manifestWith({ [ming.id]: { name: ming.name, officeTree: freshTrees.fac_mp9rsc3f4r9co } }), () => B.migrate());
  ok(!fac(g, ming.id).officeTree, '清单里即便混进玩家势力也不补（玩家官制在 GM.officeTree）');
}
{
  const rules = [{ id: 'test-council', kind: 'treaty_council', status: 'active', version: 1, positionIds: ['political-office:fac_mp9rsc3f4r9co:sovereign'], quorum: 1 }];
  const row = { fac_mp9rsc3f4r9co: Object.assign({}, offices.fac_mp9rsc3f4r9co, { politicalRules: rules }) };
  let g = oldSave();
  withManifest(manifestWith(row), () => B.migrate());
  eq(fac(g, 'fac_mp9rsc3f4r9co').politicalRules, rules, '议事规程随整棵职任一起补');
  g = oldSave((s) => { fac(s, 'fac_mp9rsc3f4r9co').officeTree = clone(freshTrees.fac_mp9rsc3f4r9co); });
  withManifest(manifestWith(row), () => B.migrate());
  ok(!fac(g, 'fac_mp9rsc3f4r9co').politicalRules, '职任已在时不单补议事规程（不拼半棵）');
}

// ── ⑤ 补失败不拦迁移 ──
{
  const g = oldSave();
  const warned = [];
  const realConsole = c.console;
  c.console = Object.assign({}, realConsole, { warn: (...args) => warned.push(args) });
  let r;
  try { r = withManifest(manifestWith('{坏'), () => B.migrate()); } finally { c.console = realConsole; }
  ok(r.ok && warned.length === 1 && /补外藩职任失败/.test(String(warned[0][0])), '清单坏了：记一条警告，迁移照常');
  ok(Object.keys(offices).every((id) => !fac(g, id).officeTree), '清单坏了：不补半截');
}

// ── ⑥ 势力调度一次问完 ──
ok(B.tools === undefined, '政治行动不再导出按需取数工具');
ok(!fs.existsSync(path.join(WEB, 'tm-faction-decision-tools.js')), 'tm-faction-decision-tools.js 已删');
const llmSrc = fs.readFileSync(path.join(WEB, 'tm-faction-npc-llm-decision.js'), 'utf8');
ok(/_callLLMDecision\(_buildPrompt\(/.test(llmSrc) && !/_decideViaTools/.test(llmSrc), '势力调度只走一次问完');

console.log('[smoke-faction-scheduling-actors] pass assertions=' + passed);
