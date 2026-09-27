#!/usr/bin/env node
// 部门名前缀不能让长官误占属官座；只开一局绍宋，核对开局、旧档自愈与 AI 任免解析。
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SID = 'sc-jianyan1-1127-shaosong';
const DEPT = '东京留守司 (北疆·开封·孤悬)';
const MAIN = '东京留守兼开封尹';
const DEPUTY = '东京留守司判官·参议官';
const TITLE = '东京留守·开封府尹·延康殿学士';
const started = Date.now();
const checks = [];

// 沿用省道 smoke 的完整官方剧本装载方式；不连接真实 AI。
function loadGame() {
  const helperFile = path.join(__dirname, 'smoke-start-game-data-integrity.js');
  const source = fs.readFileSync(helperFile, 'utf8').replace(/^#![^\n]*\n/, '');
  const end = source.indexOf('(async function main()');
  assert(end >= 0, '开局 helper 边界存在');
  const helpers = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
    source.slice(0, end) + '\nreturn { loadGame };')(require, process, __dirname, helperFile, { exports: {} }, {});
  return helpers.loadGame(SID);
}

function check(name, test) {
  test();
  checks.push(name);
  console.log('  ok · ' + name);
}

function seats(context, dynamic) {
  const found = [];
  context._offWalkOfficeTree(context.GM.officeTree, function(node) {
    if (!!node._offDynamic === dynamic) {
      (node.positions || []).forEach(position => found.push({ node, position }));
    }
    return true;
  });
  return found;
}

function hasHolder(context, position, character) {
  return context._offAllHolderEntries(position).some(holder => String(holder.characterId) === String(character.id));
}

(async function main() {
  const context = loadGame();
  check('评分：部门名前缀不参与包含及公共子串匹配，原有正座与完整部门衔不变', () => {
    const score = context._offTitleSlotScore;
    assert(score(TITLE, DEPT, DEPUTY, false) < 40, '长官长衔不能匹配属官座');
    assert.equal(score(TITLE, DEPT, MAIN, false), 76, '正座仍为改前的 76 分');
    assert.equal(score('东京留守司判官', DEPT, DEPUTY, false), 88, '完整部门衔仍为改前的 88 分');
    assert.equal(score('内阁首辅', '内阁', '内阁首辅·建极殿大学士', false), 88, '内阁完整部门衔保持改前评分');
    assert.equal(score(TITLE, DEPT, DEPUTY, true), 0, '不相容的旧 holder 也不能获得 +50');
  });

  const bootStarted = Date.now();
  vm.runInContext(`P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(${JSON.stringify(SID)})`, context, { timeout: 120000 });
  await new Promise(resolve => setTimeout(resolve, 300));
  const bootSeconds = (Date.now() - bootStarted) / 1000;
  assert(context.__entered && context.GM && context.GM.chars.length, '绍宋真实开局已进入游戏');
  const zongze = context.GM.chars.find(character => character.name === '宗泽');
  assert(zongze && zongze.id, '宗泽有稳定 ID');
  const official = seats(context, false);
  const main = official.find(seat => seat.node.name === DEPT && seat.position.name === MAIN);
  const deputy = official.find(seat => seat.node.name === DEPT && seat.position.name === DEPUTY);
  assert(main && deputy, '运行态中有留守正座与判官座');

  check('绍宋开局：宗泽只坐东京留守兼开封尹，判官无人具名，编制外没有宗泽', () => {
    const occupied = official.filter(seat => hasHolder(context, seat.position, zongze));
    assert.equal(occupied.length, 1, '宗泽恰坐一个正式座');
    assert.equal(occupied[0].position.name, MAIN);
    assert.equal(context._offAllHolderEntries(deputy.position).length, 0, '判官座没有具名任职者');
    assert(!seats(context, true).some(seat => hasHolder(context, seat.position, zongze)), '宗泽不在编制外');
  });

  check('旧档自愈：写回具名宗泽与占位后，强制派生撤去判官座上的宗泽并保留正座', () => {
    deputy.position.actualHolders = [
      { characterId: zongze.id, name: zongze.name, generated: true },
      { name: '', generated: false, placeholderId: 'ph_old_seat_smoke' }
    ];
    assert(hasHolder(context, deputy.position, zongze), '旧档确实重现宗泽误坐判官座');
    assert(hasHolder(context, main.position, zongze), '旧档正座也仍由宗泽占据');
    const result = context._offSyncHoldersFromChars({});
    assert.equal(result.ok, true, '派生成功');
    assert(!hasHolder(context, deputy.position, zongze), '旧档判官座不再有宗泽');
    assert.equal(context._offAllHolderEntries(deputy.position).length, 0, '判官座恢复无具名任职者');
    assert(hasHolder(context, main.position, zongze), '正座仍是宗泽');
    assert.equal(seats(context, false).filter(seat => hasHolder(context, seat.position, zongze)).length, 1);
  });

  check('AI 任免：东京留守司 / 东京留守解析到留守正座', () => {
    const resolved = context._offResolveSeat('东京留守司', '东京留守');
    assert(resolved, '简衔解析成功');
    assert.equal(resolved.pos, main.position);
    assert.equal(resolved.pos.name, MAIN);
    assert.notEqual(resolved.pos, deputy.position);
  });

  console.log('[timing] boot=' + bootSeconds.toFixed(3) + 's total=' + ((Date.now() - started) / 1000).toFixed(3) + 's');
  console.log('[smoke-office-seat-dept-prefix] PASS ' + checks.length + ' groups');
  process.exit(0);
})().catch(error => {
  console.error('[smoke-office-seat-dept-prefix] FAIL after ' + ((Date.now() - started) / 1000).toFixed(3) + 's', error && error.stack || error);
  process.exit(1);
});
