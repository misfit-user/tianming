// 在 VM 里真开官方剧本，核对开局后的运行时事实：实体是否丢失、地块人口是否被随机兜底、
// 省道级节点的数是否与下辖府州对得上。用法：node runtime-facts.js <sid> <输出json>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKTREE = process.env.TM_AUDIT_WORKTREE || path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(WORKTREE, 'web/scripts');
const HELPER_FILE = path.join(SCRIPTS_DIR, 'smoke-start-game-data-integrity.js');
const SOURCES = {
  'sc-tianqi7-1627': '天启七年·九月（官方）.json',
  'sc-jianyan1-1127-shaosong': '绍宋·建炎元年八月（官方）.json',
  'sc-tang840-840': '晚唐·开成五年（官方）.json'
};
const sid = process.argv[2];
const out = process.argv[3];

function loadHelpers() {
  const text = fs.readFileSync(HELPER_FILE, 'utf8').replace(/^#![^\n]*\n/, '');
  const end = text.indexOf('(async function main()');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
    text.slice(0, end) + '\nreturn { loadGame };');
  return factory(require, process, SCRIPTS_DIR, HELPER_FILE, { exports: {} }, {});
}

function leavesOf(tree) {
  const out = [];
  (function walk(nodes) {
    (nodes || []).forEach((d) => {
      if (d.children && d.children.length) walk(d.children);
      else out.push(d);
    });
  })(tree && tree.divisions);
  return out;
}

(async function main() {
  const helpers = loadHelpers();
  const context = helpers.loadGame(null);
  const source = JSON.parse(fs.readFileSync(path.join(WORKTREE, 'scenarios', SOURCES[sid]), 'utf8'));
  context.__source = source;
  vm.runInContext('P.scenarios=(P.scenarios||[]).filter(function(s){return s.id!==__source.id;});' +
    'P.scenarios.push(__source); P.ai.key=""; P.ai.url=""; P.ai.model="";', context);
  vm.runInContext('doActualStart(' + JSON.stringify(sid) + ')', context, { timeout: 600000 });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const g = context.GM;

  const facts = { sid };
  facts.entityCounts = {
    characters: [source.characters.length, (g.chars || []).length],
    factions: [source.factions.length, (g.facs || []).length],
    parties: [(source.parties || []).length, (g.parties || []).length],
    classes: [(source.classes || []).length, (g.classes || []).length]
  };
  // 丢失的实体名
  const gCharNames = new Set((g.chars || []).map((c) => c.name));
  facts.lostCharacters = source.characters.filter((c) => !gCharNames.has(c.name)).map((c) => c.name).slice(0, 40);
  const gPartyNames = new Set((g.parties || []).map((c) => c.name));
  facts.lostParties = (source.parties || []).filter((c) => !gPartyNames.has(c.name)).map((c) => c.name).slice(0, 20);
  const gClassNames = new Set((g.classes || []).map((c) => c.name));
  facts.lostClasses = (source.classes || []).filter((c) => !gClassNames.has(c.name)).map((c) => c.name).slice(0, 20);

  // provinceStats 人口与行政叶子人口是否一致（不一致多半是随机兜底）
  const ps = g.provinceStats || {};
  const ah = g.adminHierarchy || {};
  const leafPop = new Map();
  Object.values(ah).forEach((tree) => leavesOf(tree).forEach((d) => {
    const pd = d.populationDetail || (typeof d.population === 'object' ? d.population : {}) || {};
    const mouths = Number(pd.mouths) || Number(d.population) || null;
    if (!leafPop.has(d.name)) leafPop.set(d.name, mouths);
  }));
  let match = 0; let mismatch = 0; const mismatches = [];
  Object.entries(ps).forEach(([name, st]) => {
    const want = leafPop.get(name);
    if (want == null) return;
    if (Math.abs(Number(st.population) - want) <= Math.max(10, want * 0.02)) match++;
    else { mismatch++; if (mismatches.length < 30) mismatches.push(name + '：provinceStats=' + st.population + ' 叶子=' + want); }
  });
  facts.provinceStats = { entries: Object.keys(ps).length, matchLeaf: match, mismatchLeaf: mismatch, mismatches };

  // 省道（一级）节点的人口是否等于下辖叶子之和
  const circuitCheck = [];
  Object.entries(ah).forEach(([key, tree]) => {
    (tree.divisions || []).forEach((d) => {
      if (!d.children || !d.children.length) return;
      const own = Number(d.populationDetail && d.populationDetail.mouths) || (typeof d.population === 'number' ? d.population : Number(d.population && d.population.mouths)) || 0;
      const sum = leavesOf({ divisions: d.children }).reduce((s, x) => {
        const pd = x.populationDetail || (typeof x.population === 'object' ? x.population : {}) || {};
        return s + (Number(pd.mouths) || Number(x.population) || 0);
      }, 0);
      circuitCheck.push({ tree: key, name: d.name, own, sumOfLeaves: sum });
    });
  });
  facts.circuitNodes = circuitCheck.slice(0, 60);
  fs.writeFileSync(out, JSON.stringify(facts, null, 1));
  console.log(JSON.stringify({ entityCounts: facts.entityCounts, lostCharacters: facts.lostCharacters.length, lostParties: facts.lostParties.length, lostClasses: facts.lostClasses.length, provinceStats: { entries: facts.provinceStats.entries, match, mismatch } }));
  process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
