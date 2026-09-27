// 按游戏的活绑定规则（phase8-formal-map.js 的 liveRegionGovernor）核对每个叶子的官称会挂上谁。
// 规则：人物 title 与官称相同，或 officialTitle 等于官称、以「·」分段的第一段等于官称、以官称开头；全场唯一才挂。
// 用法：node tools/governor-binding.js [剧本文件]    默认读天启
'use strict';
const fs = require('fs');
const path = require('path');

const WORKTREE = process.env.TM_AUDIT_WORKTREE || path.resolve(__dirname, '../../..');
const file = process.argv[2] || path.join(WORKTREE, 'scenarios', '天启七年·九月（官方）.json');
const scenario = JSON.parse(fs.readFileSync(file, 'utf8'));
const chars = (scenario.characters || []).filter((c) => c && c.alive !== false && c.dead !== true);

function liveRegionGovernor(op) {
  op = String(op || '').trim();
  if (!op) return { hit: null, count: 0 };
  const hits = chars.filter((c) => {
    const title = String(c.title || '').trim();
    const ot = String(c.officialTitle || '').trim();
    return title === op || (ot && (ot === op || ot.split('·')[0].trim() === op || ot.indexOf(op) === 0));
  });
  return { hit: hits.length === 1 ? hits[0] : null, count: hits.length };
}

const rows = [];
Object.entries(scenario.adminHierarchy || {}).forEach(([key, tree]) => {
  const owner = key === 'player' ? '明廷' : ((scenario.factions || []).find((f) => f.id === key) || {}).name || key;
  (function walk(nodes, parent) {
    (nodes || []).forEach((d) => {
      if (d.children && d.children.length) { walk(d.children, d.name); return; }
      const { hit, count } = liveRegionGovernor(d.officialPosition);
      if (hit || count > 1) {
        rows.push({ owner, parent, name: d.name, officialPosition: d.officialPosition, bound: hit ? hit.name : '（' + count + ' 人同名，歧义不挂）', staticGovernor: d.governor || '', location: hit ? (hit.location || '') : '' });
      }
    });
  })(tree.divisions, '');
});
rows.forEach((r) => console.log([r.owner, r.parent, r.name, r.officialPosition, '→', r.bound, r.staticGovernor ? '（静态：' + r.staticGovernor + '）' : '', r.location].join(' ')));
console.log('共 ' + rows.length + ' 块官称能挂上人或有歧义');
