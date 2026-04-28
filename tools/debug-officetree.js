// 调试·查 1627 officeTree 实际 holder/rank/established 分布·诊断俸禄计算 bug
'use strict';
const fs = require('fs');
const path = require('path');

global.window = global; global.document = undefined;
global.findScenarioById = id => global.P.scenarios.find(s => s.id === id) || null;
global.setTimeout = fn => { try { fn(); } catch(e){} return 0; };
global.P = {
  scenarios: [], items: [], rigidHistoryEvents: [],
  chars: [], characters: [], facs: [], factions: [], parties: [], classes: [],
  variables: [], events: [], relations: [], officeTree: [], adminHierarchy: {},
  families: [], items_extra: []
};
const scSrc = fs.readFileSync(path.join(__dirname, '..', 'scenarios', 'tianqi7-1627.js'), 'utf8');
eval(scSrc);
const sc = global.findScenarioById('sc-tianqi7-1627');
const tree = sc.officeTree || [];

let stats = { total: 0, withHolder: 0, withRank: 0, withEstab: 0,
  ranks: {}, estab_dist: { '1':0, '2-5':0, '6-20':0, '21-100':0, '100+':0 },
  noRank_noHolder: 0 };
function _walk(nodes, dept) {
  (nodes || []).forEach(n => {
    if (!n) return;
    (n.positions || []).forEach(p => {
      stats.total++;
      const hasHolder = p.holder && p.holder !== '空缺' && p.holder !== '(空缺)' && p.holder !== '';
      if (hasHolder) stats.withHolder++;
      if (p.rank) {
        stats.withRank++;
        stats.ranks[p.rank] = (stats.ranks[p.rank] || 0) + 1;
      }
      if (typeof p.establishedCount === 'number' && p.establishedCount > 0) {
        stats.withEstab++;
        const e = p.establishedCount;
        if (e === 1) stats.estab_dist['1']++;
        else if (e <= 5) stats.estab_dist['2-5']++;
        else if (e <= 20) stats.estab_dist['6-20']++;
        else if (e <= 100) stats.estab_dist['21-100']++;
        else stats.estab_dist['100+']++;
      }
      if (!hasHolder && (!p.establishedCount || p.establishedCount <= 5)) stats.noRank_noHolder++;
    });
    if (n.subs) _walk(n.subs, (dept ? dept + '·' : '') + (n.name || ''));
  });
}
_walk(tree, '');

console.log('=== 1627 officeTree 统计 ===');
console.log('总职位: ' + stats.total);
console.log('有 holder: ' + stats.withHolder + ' (' + (stats.withHolder/stats.total*100).toFixed(0) + '%)');
console.log('有 rank: ' + stats.withRank + ' (' + (stats.withRank/stats.total*100).toFixed(0) + '%)');
console.log('有 establishedCount > 0: ' + stats.withEstab);
console.log('rank 分布:');
Object.keys(stats.ranks).sort().forEach(r => console.log('  ' + r + ': ' + stats.ranks[r] + ' 职'));
console.log('established 分布:');
Object.keys(stats.estab_dist).forEach(k => console.log('  ' + k + ' 人编制: ' + stats.estab_dist[k] + ' 职'));
console.log('无 holder + 编制 ≤ 5: ' + stats.noRank_noHolder + ' (这些走 actualHeads=0·无俸)');

// 抽样 10 个有 holder 的 position 看字段
console.log('\n=== 抽样 10 个有 holder 的职位 ===');
let sampled = 0;
function _sample(nodes, dept) {
  if (sampled >= 10) return;
  (nodes || []).forEach(n => {
    if (sampled >= 10) return;
    if (!n) return;
    (n.positions || []).forEach(p => {
      if (sampled >= 10) return;
      const hasHolder = p.holder && p.holder !== '空缺' && p.holder !== '(空缺)' && p.holder !== '';
      if (hasHolder) {
        console.log('· ' + (dept ? dept + '·' : '') + (n.name||'') + '·' + p.name +
          ' | holder=' + p.holder + ' | rank=' + (p.rank||'(无)') +
          ' | established=' + (p.establishedCount||'?') +
          ' | salary=' + (p.salary != null ? p.salary : '(用 rank 表)'));
        sampled++;
      }
    });
    if (n.subs) _sample(n.subs, (dept ? dept + '·' : '') + (n.name || ''));
  });
}
_sample(tree, '');

// 抽样 10 个 establishedCount 大但无 holder 的 position
console.log('\n=== 抽样 10 个 establishedCount > 5 但无 holder 的职位 (兜底虚拟数 = est × 0.3) ===');
sampled = 0;
function _sample2(nodes, dept) {
  if (sampled >= 10) return;
  (nodes || []).forEach(n => {
    if (sampled >= 10) return;
    if (!n) return;
    (n.positions || []).forEach(p => {
      if (sampled >= 10) return;
      const hasHolder = p.holder && p.holder !== '空缺' && p.holder !== '(空缺)' && p.holder !== '';
      if (!hasHolder && p.establishedCount > 5) {
        console.log('· ' + (dept ? dept + '·' : '') + (n.name||'') + '·' + p.name +
          ' | established=' + p.establishedCount +
          ' | rank=' + (p.rank||'(无)') +
          ' | salary=' + (p.salary != null ? p.salary : '(用 rank 表)'));
        sampled++;
      }
    });
    if (n.subs) _sample2(n.subs, (dept ? dept + '·' : '') + (n.name || ''));
  });
}
_sample2(tree, '');
