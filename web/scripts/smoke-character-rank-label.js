#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'tm-office-system.js'), 'utf8');
const block = src.slice(src.indexOf('var RANK_HIERARCHY'), src.indexOf('function _orderedRankHierarchy('));
const ctx = { P: {}, GM: {}, Number, Math, Array, String };
vm.createContext(ctx);
vm.runInContext(block, ctx);
const label = ch => ctx.getCharacterRankLabel(ch, ctx.GM);
const rankless = [
  {}, { name: '商甲', title: '地方货商', officialTitle: '地方货商', rankLevel: 0 },
  { name: '织甲', title: '织户', officialTitle: '', rankLevel: 12 },
  { name: '乙', rankLevel: 1 }, { rank: null }, { rank: '' }, { rank: '0' }, { rank: 5 }
];
rankless.forEach(ch => assert.strictEqual(label(ch), '', '缺实职与明确官品不能显示品秩: ' + JSON.stringify(ch)));
assert.strictEqual(label({ rank: '从九品' }), '从九品', '最低官品可明确记载，不能当空值屏蔽');
ctx.GM.officeTree = { depts: [{ faction: '朝廷', positions: [
  { name: '节度使', rank: '正三品', holderId: 'a', holder: '卢甲' },
  { name: '录事', rank: '从七品', actualHolders: [{ id: 'b', name: '陈甲' }] }
] }] };
const officer = { id: 'a', name: '卢甲', officialTitle: '节度使', faction: '朝廷', rankLevel: 12 };
assert.strictEqual(label(officer), '正三品');
assert.strictEqual(label(Object.assign({}, officer, { rankLevel: 1 })), '正三品', '不采信被误用为社会地位的更高数值');
assert.strictEqual(label(Object.assign({}, officer, { rank: '从一品' })), '从一品', '明确加衔官品可高于实职');
assert.strictEqual(label({ id: 'b', name: '陈甲', rankLevel: 0 }), '从七品', '多员官实际任职对象可识别');
assert.strictEqual(label({ name: '外臣', faction: '外邦', officialTitle: '节度使', rankLevel: 0 }), '', '不套用他国同名官位');
assert.strictEqual(label({ name: '卸任者', faction: '朝廷', officialTitle: '前节度使', rankLevel: 2 }), '', '不以宽泛子串把前官当现授');
assert.strictEqual(label({ name: '录甲', faction: '朝廷', officialTitle: '录事' }), '从七品', '完整官名可从本朝官制取品');
ctx.GM.officeTree.depts[0].positions[0].rank = '从二品';
assert.strictEqual(label(officer), '从二品', '任职树变更后不残留旧品秩缓存');
ctx.GM = { rankHierarchy: [{ label: '万石', level: 1 }, { label: '二千石', level: 3 }, { label: '比二千石', level: 4 }] };
assert.strictEqual(label({ rank: '比二千石' }), '比二千石', '本朝自定义秩禄文本保留');
const scenarioFile = path.resolve(root, '..', 'scenarios', '晚唐·开成五年（官方）.json');
if (fs.existsSync(scenarioFile)) {
  const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
  ctx.GM = { officeTree: scenario.officeTree };
  ctx.P = { engineConstants: scenario.engineConstants };
  const before = JSON.stringify({ chars: scenario.characters, officeTree: scenario.officeTree });
  assert.strictEqual(label(scenario.characters.find(c => c.name === '卢钧')), '正三品');
  // 无唐官的人（沙州士族、僧人、回鹘特勒）品级是默认值，不能被套上默认官品；原用的批量代表已随剧本修复删去，人不在就报错，免得校验悄悄失效
  ['张议潮','洪辩','嗢没斯'].forEach(name => {
    const ch = scenario.characters.find(c => c.name === name);
    assert(ch, name + ' 应在晚唐剧本里');
    assert.strictEqual(label(ch), '', name + '不能被套上默认官品');
  });
  scenario.characters.forEach(label);
  assert.strictEqual(JSON.stringify({ chars: scenario.characters, officeTree: scenario.officeTree }), before, '显示不修改人物数值或官制');
}
const zhi = fs.readFileSync(path.join(root, 'tm-renwu-tuzhi.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'tm-shell-extras.js'), 'utf8');
const formal = fs.readFileSync(path.join(root, 'phase8-formal-modules.js'), 'utf8');
const player = fs.readFileSync(path.join(root, 'tm-player-core.js'), 'utf8');
assert(zhi.includes('getCharacterRankLabel(c,_g())'));
assert(shell.includes('getCharacterRankLabel(c,GM)'));
assert(!shell.includes("c.rankLevel<=3?'正一品'"));
assert(!formal.includes("['品秩', p.rank || p.role"));
assert(player.includes('getCharacterRankLabel(ch,GM)') && player.includes('getCharacterRankLabel(cc,GM)'));
console.log('[smoke-character-rank-label] PASS: 空值、普通人、外臣、实官、多员官、加衔、本朝秩禄及晚唐样本');
