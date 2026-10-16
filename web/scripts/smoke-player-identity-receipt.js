#!/usr/bin/env node
'use strict';
// 玩家身份收据（2026-10-16）
//   案：开发群 E.B 自建剧本「所在地和区划名称一致…无论如何第一回合都是一个人都没有」。真档（文泰元年 T2）里
//       playerInfo.characterId === "undefined"：编辑器导出的人物不带 id，_markPlayer 把 String(undefined) 存成收据；
//       TM.Player.getCharacter / _tmFindPlayerCharRaw 只按 id 找→null→玩家所在地退回「京城」→问对/廷议/常朝只认京城别名。
//   根治三层：① 开局 _markPlayer 先补稳定 id 再写收据 ② 迁移期 _tmRepairPlayerIdentityReceipt 按唯一标记/唯一同名找回
//            ③ 两个查找口 id 对不上时落到按名/按标记兜底（不再直接判空）。本 smoke 三层都钉。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const lifecycleSrc = fs.readFileSync(path.join(ROOT, 'tm-save-world-validation.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const indicesSrc = fs.readFileSync(path.join(ROOT, 'tm-indices.js'), 'utf8');
const startSrc = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');
let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
function sliceFn(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('missing helper: ' + marker);
  let cursor = src.indexOf('{', start), depth = 0;
  for (; cursor < src.length; cursor++) {
    if (src[cursor] === '{') depth++;
    else if (src[cursor] === '}' && --depth === 0) return src.slice(start, cursor + 1);
  }
  throw new Error('unterminated helper: ' + marker);
}
function makeContext() {
  const context = {
    console: { warn() {}, log() {}, error() {} }, Math, JSON, Number, Object, Array, String, Error, WeakSet, Set,
    _tmHasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object, key); },
    TM: {}, P: undefined
  };
  context.window = context;
  vm.createContext(context);
  const helpers = [
    'function _tmStableIdMissing(', 'function _tmStableIdHash(', 'function _tmStableIdentityParts(',
    'function _tmCollectAdminDivisionEntries(', 'function _tmRepairDuplicateDivisionIds(', 'function _tmRepairDuplicateEntityIds(',
    'function _tmClearDanglingStableRefs(', 'function _tmAssignMissingStableIds(', 'function _tmUniqueEntityIdByName(',
    'function _tmEntityIdSet(', 'function _tmBackfillStableForeignKeys(', 'function _tmRepairPlayerIdentityReceipt(', 'function _tmMigrateCoreStableIds('
  ].map(marker => sliceFn(lifecycleSrc, marker)).join('\n');
  vm.runInContext(helpers, context, { filename: 'tm-save-lifecycle-player-slice.js' });
  const lookups = ['function _tmCleanCharLookupName(', 'function _tmFindPlayerCharRaw(', 'function getPlayerCharacter('].map(marker => sliceFn(indicesSrc, marker)).join('\n');
  vm.runInContext(lookups, context, { filename: 'tm-indices-player-slice.js' });
  return context;
}
// 形如 E.B 的导出：人物不带 id，_markPlayer 旧写法把 String(undefined) 存成收据
function customWorld(receipt) {
  return {
    sid: 'scenario_custom_chu', _campaignId: 'custom-chu',
    playerInfo: { factionName: '楚', characterName: '周道仁', characterId: receipt },
    chars: [
      { name: '周道仁', gender: '男', faction: '楚', location: '襄州', isPlayer: true, protagonist: true },
      { name: '韩延之', gender: '男', faction: '楚', location: '襄州' },
      { name: '苏文举', gender: '男', faction: '楚', location: '汴州' }
    ],
    facs: [{ name: '楚' }], armies: [], mapData: { regions: [] }, officeTree: []
  };
}

console.log('[smoke-player-identity-receipt]');

{ // ② 迁移期：收据 "undefined" → 补 id 后按唯一 isPlayer 标记找回
  const ctx = makeContext();
  const world = customWorld('undefined');
  const result = ctx._tmMigrateCoreStableIds(world);
  const player = world.chars[0];
  ok(/^tmlegacy_char_/.test(String(player.id)), 'migration assigns the id-less player character a legacy stable id');
  ok(world.playerInfo.characterId === player.id, 'the "undefined" receipt is repaired to the real id of the flagged player :: ' + world.playerInfo.characterId);
  ok(result.playerIdentityRepaired === 1 && world._stableIdMigration && world._stableIdMigration.playerIdentityRepaired === 1,
    'the repair is counted on the migration record');
  const again = ctx._tmMigrateCoreStableIds(world);
  ok(!again.playerIdentityRepaired && world.playerInfo.characterId === player.id, 'second pass is a no-op (idempotent)');
}

{ // ② 迁移期：收据指向已不存在的旧 id、无 isPlayer 标记 → 按唯一同名找回（含带括注的名字）
  const ctx = makeContext();
  const world = customWorld('stale-old-id');
  world.chars.forEach(ch => { ch.isPlayer = false; ch.id = 'c-' + ch.name; });
  world.playerInfo.characterName = '周道仁（文泰帝）';
  const result = ctx._tmMigrateCoreStableIds(world);
  ok(world.playerInfo.characterId === 'c-周道仁' && result.playerIdentityRepaired === 1, 'a stale receipt is recovered through the unique (annotation-stripped) name');
}

{ // ② 迁移期：收据有效 → 不动；收据对不上又找不回 → 清空收据让按名兜底
  const ctx = makeContext();
  const good = customWorld('c-周道仁');
  good.chars.forEach(ch => { ch.id = 'c-' + ch.name; });
  const before = JSON.stringify(good.playerInfo);
  ok(ctx._tmRepairPlayerIdentityReceipt(good) === false && JSON.stringify(good.playerInfo) === before, 'a valid receipt is left untouched');
  const ambiguous = customWorld('ghost');
  ambiguous.chars.forEach(ch => { ch.isPlayer = false; ch.id = 'c-' + ch.name; });
  ambiguous.chars.push({ id: 'c-周道仁-2', name: '周道仁', gender: '男' });
  ok(ctx._tmRepairPlayerIdentityReceipt(ambiguous) === true && !('characterId' in ambiguous.playerInfo),
    'an unresolvable receipt (two namesakes, no flag) is cleared instead of being left pointing at nobody');
  const empty = customWorld('');
  empty.chars.forEach(ch => { ch.isPlayer = false; delete ch.id; });
  ok(ctx._tmRepairPlayerIdentityReceipt(empty) === false, 'an empty receipt with nothing to recover from is reported as no change');
}

{ // ③ 查找口：收据对不上任何人 → 不再判空，按名/按标记兜底；收据对得上 → id 优先
  const ctx = makeContext();
  const world = customWorld('undefined');
  ctx.GM = world;
  ok(ctx._tmFindPlayerCharRaw() === world.chars[0], '_tmFindPlayerCharRaw falls back to the flagged/named player when the receipt id matches nobody');
  ok(ctx.getPlayerCharacter(world) === world.chars[0], 'getPlayerCharacter (TM.Player.getCharacter) falls back the same way');
  world.chars.forEach(ch => { ch.id = 'c-' + ch.name; });
  world.playerInfo.characterId = 'c-苏文举';
  ok(ctx._tmFindPlayerCharRaw() === world.chars[2] && ctx.getPlayerCharacter(world) === world.chars[2], 'a receipt that does match a character still wins over name/flag');
}

{ // ① 开局：_markPlayer 先按稳定 id 规则补 id 再写收据；预分配的 id 与随后整体迁移算出的 id 一致（确定性）
  const ctx = makeContext();
  const markPlayer = sliceFn(startSrc, '(function _markPlayer() {');
  ok(markPlayer.indexOf("_tmAssignMissingStableIds(GM, 'char', [{ item: found") >= 0 && markPlayer.indexOf('characterId: String(found.id),') < 0,
    '_markPlayer assigns a stable id before writing the receipt and never stores String(undefined)');
  const world = customWorld(undefined);
  delete world.playerInfo.characterId;
  const player = world.chars[0];
  ctx._tmAssignMissingStableIds(world, 'char', [{ item: player, path: 'chars/0' }]);
  const preassigned = player.id;
  ok(/^tmlegacy_char_/.test(String(preassigned)), 'pre-assignment at start produces a legacy stable id for the player');
  world.playerInfo.characterId = String(player.id);
  const twin = customWorld(undefined); delete twin.playerInfo.characterId;
  ctx._tmMigrateCoreStableIds(twin);
  ok(twin.chars[0].id === preassigned, 'the pre-assigned player id equals what a full migration would assign (deterministic, index-free)');
  const result = ctx._tmMigrateCoreStableIds(world);
  ok(player.id === preassigned && world.playerInfo.characterId === preassigned && !result.playerIdentityRepaired,
    'after pre-assignment the full migration keeps the id and finds the receipt valid');
}

{ // 2026-10-17 复审（Astra 6）F1：重复人物 id 修复后，带名字的引用与玩家收据按名字 / 唯一玩家标记归到改名后的那一位
  const ctx = makeContext();
  const world = { sid: 'dup-case', chars: [{ id: 'same', name: '甲' }, { id: 'same', name: '乙', isPlayer: true }], facs: [],
    armies: [{ id: 'a1', name: '亲军', commander: '乙', commanderId: 'same' }, { id: 'a2', name: '边军', commander: '甲', commanderId: 'same' }, { id: 'a3', name: '杂军', commanderId: 'same' }],
    playerInfo: { characterId: 'same', characterName: '乙' }, mapData: { regions: [] } };
  const result = ctx._tmMigrateCoreStableIds(world);
  const jia = world.chars[0], yi = world.chars[1];
  ok(jia.id === 'same' && yi.id !== 'same', '重复 id：甲保留、乙改名');
  ok(world.playerInfo.characterId === yi.id, '玩家收据跟着乙改名后的 id（原来仍指向甲）');
  ok(world.armies[0].commanderId === yi.id && world.armies[1].commanderId === 'same', '统帅引用按统帅名分别归乙、甲');
  ok(world.armies[2].commanderId === 'same' && result.duplicateRefsAmbiguous === 1, '没写统帅名的引用分不清，保持原样并计数');
  ok(result.duplicateRefsRebound === 1 && world._stableIdMigration.duplicateRefsRebound === 1, '改绑计入迁移收据');
  ctx.GM = world;
  ok(ctx.getPlayerCharacter(world) === yi && ctx._tmFindPlayerCharRaw() === yi, '两个查找口都找到乙');
  const again = ctx._tmMigrateCoreStableIds(world);
  ok(again.duplicateRepaired === 0 && world.playerInfo.characterId === yi.id && world.armies[0].commanderId === yi.id, '再读一次档不变');
  const flagOnly = { sid: 'dup-flag', chars: [{ id: 'p', name: '同名' }, { id: 'p', name: '同名', isPlayer: true }], facs: [], armies: [], playerInfo: { characterId: 'p' }, mapData: { regions: [] } };
  ctx._tmMigrateCoreStableIds(flagOnly);
  ok(flagOnly.playerInfo.characterId === flagOnly.chars[1].id, '同名重复且收据没写名字时，按组内唯一玩家标记归属');
}

{ // 2026-10-17 二次复审（Astra 6）：重复组查找只认自有键；先按完整名字（含括注）匹配；分不清的收据与数组引用也计数
  const ctx = makeContext();
  ['constructor', 'toString', '__proto__', 'hasOwnProperty'].forEach(key => {
    const world = { sid: 'proto-' + key, chars: [{ id: key, name: '甲' }], facs: [], armies: [{ id: 'a', commanderId: key, commander: '甲' }], playerInfo: { characterId: key }, mapData: { regions: [] } };
    let error = null;
    try { ctx._tmMigrateCoreStableIds(world); } catch (e) { error = e; }
    ok(!error && world.armies[0].commanderId === key && world.playerInfo.characterId === key, '人物 id 叫 ' + key + '、没有任何重复：迁移不抛错、引用原样' + (error ? '（' + error.message + '）' : ''));
  });
  const paren = { sid: 'dup-paren', chars: [{ id: 'dup', name: '甲（父）' }, { id: 'dup', name: '甲（子）' }, { id: 'dup', name: '乙' }], facs: [],
    armies: [{ id: 'a', commanderId: 'dup', commander: '甲（子）' }], playerInfo: { characterId: 'dup', characterName: '甲（父）' }, mapData: { regions: [] } };
  ctx._tmMigrateCoreStableIds(paren);
  ok(paren.armies[0].commanderId === paren.chars[1].id && paren.playerInfo.characterId === paren.chars[0].id, '括注名能精确区分时按完整名字归属：统帅归「甲（子）」，收据归「甲（父）」');
  const loose = { sid: 'dup-loose', chars: [{ id: 'dup', name: '甲' }, { id: 'dup', name: '乙（藩王）' }, { id: 'dup', name: '丙' }], facs: [],
    armies: [{ id: 'a', commanderId: 'dup', commander: '乙（旧称）' }], mapData: { regions: [] } };
  ctx._tmMigrateCoreStableIds(loose);
  ok(loose.armies[0].commanderId === loose.chars[1].id, '完整名字没有命中时仍按去括注的名字兜底');
  const amb = { sid: 'dup-amb', chars: [{ id: 'dup', name: '甲' }, { id: 'dup', name: '乙' }, { id: 'dup', name: '乙' }, { id: 'x', name: '子', childrenIds: ['dup'] }], facs: [], armies: [],
    playerInfo: { characterId: 'dup', characterName: '乙' }, mapData: { regions: [] } };
  const r = ctx._tmMigrateCoreStableIds(amb);
  ok(amb.playerInfo.characterId === 'dup' && amb.chars[3].childrenIds[0] === 'dup' && r.duplicateRefsAmbiguous === 2 && amb._stableIdMigration.duplicateRefsAmbiguous === 2,
    '分不清的玩家收据和数组引用保持原样，都计入 duplicateRefsAmbiguous（' + r.duplicateRefsAmbiguous + '）');
  const snap = JSON.stringify(amb);
  ctx._tmMigrateCoreStableIds(amb);
  ok(JSON.stringify(amb) === snap, '再读一次档不变、不重复计数');
}

console.log('\n[smoke-player-identity-receipt] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
