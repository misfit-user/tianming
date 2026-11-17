#!/usr/bin/env node
'use strict';
// smoke-admin-tree-unify — 区划只留游戏里那份（2026-11-15）：读旧档并档、存档不带剧本库那份
//   ① 旧档：剧本库那份（P.adminHierarchy）上 AI 封的藩、挂的状态、建的楼并进游戏那份（GM.adminHierarchy）；
//      完工建筑按 appliedDelta 补到游戏那份的税基；地方主官不并；剧本库独有的区划不并、记名；
//      名字加开工回合相同的楼认作同一座，不重复并、不重复记效果；并过打标记，再调不再并。
//   ② 新档（存档不带剧本库那份）：读档从剧本补回一份深拷贝，不并，游戏那份不动。
//   ③ 存档：游戏那份非空时，存下的 P 不带 adminHierarchy，活的 P 不动；游戏那份为空时照旧带上。
// 跑的是真函数：tm-save-lifecycle.js 里的 _tmUnifyLegacyAdminTrees、_buildSaveState 及其快照助手
// （按名字从语法树里截出来在 vm 里执行），tm-building-works.js 整个 require 进来。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok - ' + msg); } else { fail++; console.error('  FAIL - ' + msg); } }
const clone = (v) => JSON.parse(JSON.stringify(v));

const lifecycle = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const ast = acorn.parse(lifecycle, { ecmaVersion: 'latest', sourceType: 'script' });
function fnSource(name) {
  const node = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id && n.id.name === name);
  if (!node) throw new Error('tm-save-lifecycle.js 里找不到顶层函数 ' + name);
  return lifecycle.slice(node.start, node.end);
}
const BW = require(path.join(ROOT, 'tm-building-works.js'));

function unifyCtx(extra) {
  const ctx = Object.assign({ console: { log() {} }, deepClone: clone, TM: { BuildingWorks: BW } }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(fnSource('_tmUnifyLegacyAdminTrees'), ctx, { filename: 'tm-save-lifecycle.js' });
  return ctx;
}

console.log('=== ① 旧档并档 ===');
{
  const P = { adminHierarchy: { player: { divisions: [
    { id: 'd-a', name: '甲州', governor: '已故者',
      autonomy: { type: 'fanguo', subtype: 'real', holder: '某王', grantedTurn: 5 },
      statusEffects: [{ id: 'st-1', name: '旱', kind: 'disaster', expiresTurn: 30 }] },
    { id: 'd-b', name: '乙州', buildings: [
      { name: '书院', status: 'completed', startTurn: 3, appliedTurn: 6, appliedDelta: { 'economyBase.commerceVolume': 100, _minxin: 2 } },
      { name: '城墙', status: 'completed', startTurn: 4, appliedTurn: 8, appliedDelta: { fortLevel: 1 } }
    ] },
    { id: 'd-c', name: '侨州', buildings: [{ name: '侨楼', status: 'completed', startTurn: 2, appliedTurn: 3, appliedDelta: { fortLevel: 1 } }] }
  ] } } };
  const GM = { turn: 12, adminHierarchy: { player: { divisions: [
    { id: 'd-a', name: '甲州', governor: '在任者', autonomy: { type: 'zhixia', subtype: null, holder: null } },
    { id: 'd-b', name: '乙州', economyBase: { commerceVolume: 1000 }, fortLevel: 2,
      buildings: [{ name: '城墙', status: 'building', startTurn: 4, remainingTurns: 1 }] }
  ] } } };
  const ctx = unifyCtx();
  const mark = ctx._tmUnifyLegacyAdminTrees(GM, P);
  const a = GM.adminHierarchy.player.divisions[0], b = GM.adminHierarchy.player.divisions[1];
  ok(a.autonomy.type === 'fanguo' && a.autonomy.holder === '某王', '剧本库那份上的封藩并进游戏那份（盖过读档时推导出的直辖）');
  ok(a.governor === '在任者', '地方主官不并（剧本库那份上可能挂着已故之人）');
  ok(Array.isArray(a.statusEffects) && a.statusEffects.length === 1 && a.statusEffects[0].id === 'st-1', '地块状态并进来');
  ok(b.buildings.some((x) => x.name === '书院' && x.status === 'completed'), '书院并进来');
  ok(b.economyBase.commerceVolume === 1100, '完工书院的商税基补到游戏那份（1000+100，民心一次性波动不补）实=' + b.economyBase.commerceVolume);
  ok(b.buildings.filter((x) => x.name === '城墙').length === 1 && b.fortLevel === 2, '名字加开工回合相同的城墙认作同一座：不重复并、不重复加城防');
  ok(!GM.adminHierarchy.player.divisions.some((d) => d.name === '侨州'), '剧本库独有的区划不并');
  ok(mark && mark.merged === true && mark.libraryOnly.indexOf('侨州') >= 0, '打并档标记、记下剧本库独有的区划');
  P.adminHierarchy.player.divisions[1].buildings.push({ name: '义仓', status: 'completed', startTurn: 9, appliedTurn: 10, appliedDelta: { 'economyBase.commerceVolume': 50 } });
  ctx._tmUnifyLegacyAdminTrees(GM, P);
  ok(b.buildings.length === 2 && b.economyBase.commerceVolume === 1100, '并过一次不再并');
  ok(P.adminHierarchy.player.divisions.length === 3, '旧档自带的剧本库那份留着，不拿剧本覆盖');
}

console.log('=== ② 新档补回剧本库那份 ===');
{
  const scenarioAH = { player: { divisions: [{ id: 'd-a', name: '甲州' }] } };
  const P = {};
  const GM = { sid: 'sc-x', turn: 3, adminHierarchy: { player: { divisions: [{ id: 'd-a', name: '甲州', minxin: 40 }] } } };
  const ctx = unifyCtx({ findScenarioById: (id) => (id === 'sc-x' ? { id: 'sc-x', adminHierarchy: scenarioAH } : null) });
  const mark = ctx._tmUnifyLegacyAdminTrees(GM, P);
  ok(P.adminHierarchy && P.adminHierarchy.player.divisions[0].name === '甲州', '读档从剧本补回剧本库那份');
  ok(P.adminHierarchy !== scenarioAH && P.adminHierarchy.player !== scenarioAH.player, '补回的是深拷贝，改它不动剧本');
  ok(mark && mark.merged === false, '新档无可并，只打标记');
  ok(GM.adminHierarchy.player.divisions[0].minxin === 40 && !GM.adminHierarchy.player.divisions[0].autonomy, '游戏那份不动');
}

console.log('=== ③ 存档不带剧本库那份 ===');
{
  const libAH = { player: { divisions: [{ name: '甲州' }] } };
  const ctx = {
    GM: { turn: 5, adminHierarchy: { player: { divisions: [{ name: '甲州', minxin: 40 }] } } },
    P: { conf: { a: 1 }, adminHierarchy: libAH },
    deepClone: clone, _tmStripAiKeyInPlace: (p) => p, _prepareGMForSave() {}, window: {}
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('_tmSaveSnapshotSkipKeys'), fnSource('_autoSaveSnapshotGM'), fnSource('_buildSaveState')].join('\n'), ctx, { filename: 'tm-save-lifecycle.js' });
  const idb = ctx._buildSaveState({ format: 'idb', prepare: false });
  ok(!('adminHierarchy' in idb.P) && idb.P.conf.a === 1, '游戏那份非空：存下的 P 不带剧本库那份区划，其余照存');
  ok(idb.GM.adminHierarchy.player.divisions[0].minxin === 40, '游戏那份照存');
  ok(ctx.P.adminHierarchy === libAH, '活的 P 不动');
  const proj = ctx._buildSaveState({ format: 'project', prepare: false });
  ok(!('adminHierarchy' in proj) && proj.gameState.turn === 5, 'project 外壳同样不带');
  ctx.GM.adminHierarchy = {};
  const empty = ctx._buildSaveState({ format: 'idb', prepare: false });
  ok(empty.P.adminHierarchy && empty.P.adminHierarchy.player.divisions[0].name === '甲州', '游戏那份为空时照旧带上，读档还要靠它恢复游戏那份');
}

console.log('[smoke-admin-tree-unify] ' + (fail ? 'FAIL' : 'PASS') + ' — ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
