// 省道主官：只从 data/<sid>-governors.js 取人物、职位、节点和引文。
// node docs/scenario-data-repair-20260924/patches/governors.js <tianqi|shaosong|tang> [--report file] [--write]
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '../../..');
const clone = (x) => JSON.parse(JSON.stringify(x));

function positions(tree, prefix = '') {
  return (tree || []).flatMap((d) => [
    ...(d.positions || []).map((p) => ({ position: p, path: prefix + d.name + '/' + p.name })),
    ...positions(d.subs, prefix + d.name + '/')
  ]);
}
function provinces(scenario) {
  const rows = [];
  Object.entries(scenario.adminHierarchy || {}).forEach(([owner, tree]) => {
    (function walk(nodes) {
      (nodes || []).forEach((node) => { if (node.level === 'province') rows.push({ owner, node }); walk(node.children); });
    })(tree.divisions);
  });
  return rows;
}
function copies(scenario, spec, owner, create = false) {
  const fid = owner === 'player' ? spec.playerFaction : owner;
  const faction = (scenario.factions || []).find((f) => f.id === fid);
  assert(faction, '找不到势力 ' + fid);
  const out = [];
  if (owner === 'player') out.push({ name: 'officeTree', tree: scenario.officeTree });
  if (Array.isArray(faction.officeTree)) out.push({ name: 'factions.' + fid + '.officeTree', tree: faction.officeTree });
  else if (create && owner !== 'player') {
    faction.officeTree = [];
    out.push({ name: 'factions.' + fid + '.officeTree', tree: faction.officeTree });
  }
  const registry = scenario.officeRegistryByFaction;
  if (registry && Array.isArray(registry[fid])) out.push({ name: 'officeRegistryByFaction.' + fid, tree: registry[fid] });
  assert(out.length, '没有官制树 ' + fid);
  out.forEach((c) => assert(Array.isArray(c.tree), '官制树不是数组 ' + c.name));
  return out;
}
function resolve(tree, ref, useIds) {
  return positions(tree).filter((r) => useIds ? r.position.id === ref : r.path === ref);
}
function editCharacter(character, change) {
  Object.assign(character, clone(change.set || {}));
  (change.unset || []).forEach((key) => { delete character[key]; });
}
function apply(scenario, spec) {
  const changes = [];
  for (const row of spec.characters || []) {
    const existing = scenario.characters.filter((c) => c.name === row.name || c.id === row.id);
    if (existing.length) assert(existing.length === 1 && JSON.stringify(existing[0]) === JSON.stringify(row), '新人物已存在但内容不一致：' + row.name);
    else { scenario.characters.push(clone(row)); changes.push('新人物 ' + row.name); }
  }
  for (const row of spec.characterUpdates || []) {
    const found = scenario.characters.filter((c) => c.name === row.name);
    assert.strictEqual(found.length, 1, '人物不唯一：' + row.name);
    editCharacter(found[0], row);
  }
  for (const row of spec.officeUpdates || []) {
    for (const copy of copies(scenario, spec, row.owner)) {
      let found = resolve(copy.tree, row.ref, spec.useIds);
      // 改名后的第二次应用仍应找到同一席位；ID 引用不需要此兼容。
      if (!found.length && !spec.useIds && row.set && row.set.name) {
        const nextRef = row.ref.slice(0, row.ref.lastIndexOf('/') + 1) + row.set.name;
        found = resolve(copy.tree, nextRef, false);
      }
      assert.strictEqual(found.length, 1, copy.name + ' 职位不唯一：' + row.ref);
      editCharacter(found[0].position, row);
    }
  }
  for (const row of spec.officeRemovals || []) {
    for (const copy of copies(scenario, spec, row.owner)) {
      (function remove(nodes, prefix) {
        for (const dept of nodes || []) {
          const base = prefix + dept.name + '/';
          dept.positions = (dept.positions || []).filter((p) => (spec.useIds ? p.id : base + p.name) !== row.ref);
          remove(dept.subs, base);
        }
      })(copy.tree, '');
      assert.strictEqual(resolve(copy.tree, row.ref, spec.useIds).length, 0, '应移除的聚合席位仍在 ' + row.ref);
    }
  }
  for (const row of spec.offices || []) {
    for (const copy of copies(scenario, spec, row.owner, true)) {
      let dept = copy.tree.find((d) => d.name === row.department);
      if (!dept) {
        assert(row.departmentId, '新部门缺稳定 id：' + row.department);
        dept = { id: row.departmentId, name: row.department, desc: row.departmentDescription || '', positions: [], subs: [] };
        copy.tree.push(dept);
      }
      const found = (dept.positions || []).filter((p) => p.name === row.position.name);
      assert(found.length <= 1, '重复职位：' + row.department + '/' + row.position.name);
      if (found.length) assert.deepStrictEqual(found[0], row.position, '职位已存在但内容不同：' + row.position.name);
      else dept.positions.push(clone(row.position));
    }
  }
  const all = provinces(scenario);
  for (const row of spec.bindings) {
    const found = all.filter((r) => r.owner === row.owner && r.node.id === row.nodeId);
    assert.strictEqual(found.length, 1, '行政节点不唯一：' + row.nodeId);
    const node = found[0].node;
    assert.strictEqual(node.name, row.name, '行政节点名称漂移：' + row.name);
    node.governorOffice = row.governorOffice;
    delete node.governorCharId;
    if (row.governorOffice === null) {
      assert(['分镇', '土官袭替', '羁縻', '诸部'].includes(row.governanceNote), '非法枚举');
      node.governanceNote = row.governanceNote;
      node.governanceDetail = row.governanceDetail;
      node.governor = '';
    } else {
      const matches = resolve(copies(scenario, spec, row.owner)[0].tree, row.governorOffice, spec.useIds);
      assert.strictEqual(matches.length, 1, '不能解析 ' + row.governorOffice);
      const post = matches[0].position;
      node.governor = post.holder || '';
      node.officialPosition = post.name;
      delete node.governanceNote;
      if (row.governanceDetail) node.governanceDetail = row.governanceDetail;
      else delete node.governanceDetail;
    }
  }
  return changes;
}
function report(spec) {
  const counts = Object.fromEntries(['连上', '新补', '出缺', '枚举'].map((key) => [key, spec.bindings.filter((r) => r.status === key).length]));
  return ['# ' + spec.label + '·省道主官', '',
    spec.scope, '', '状态按行政节点计，互斥；新补表示新增有任官者的职位或人物，出缺仍有可解析职位。', '',
    Object.entries(counts).map(([k, v]) => k + ' ' + v).join('；') + '。', '',
    '| 势力 / 省道 | 主官或枚举 | 职位引用 | 状态 | 依据及边界 |', '| --- | --- | --- | --- | --- |',
    ...spec.bindings.map((r) => '| ' + [r.owner + ' / ' + r.name, r.holder || r.governanceNote || '出缺', r.governorOffice || 'null', r.status, (r.reason || '') + ' ' + (r.sources || []).join('、')].map((v) => String(v).replace(/\|/g, '／').replace(/\n/g, ' ')).join(' | ') + ' |'), '',
    '## 人物依据', '', ...((spec.peopleNotes || []).map((p) => '- **' + p.name + '**：' + p.bioBasis + ' 年龄：' + p.ageBasis + '；数值：' + p.statsBasis + '。')), '',
    '## 原文', '', ...(spec.sources || []).flatMap((s) => ['- **' + s.id + '** ' + s.title + '（' + (s.confidence || 'H') + '）。' + (s.claim || ''), '  > ' + s.quote, '  ' + s.url + '；本地：' + s.file]), '',
    '## 未详与限制', '', ...(spec.uncertain || []).map((x) => '- ' + x), ''].join('\n');
}
function main() {
  const [sid, ...args] = process.argv.slice(2);
  assert(['tianqi', 'shaosong', 'tang'].includes(sid), '参数须为 tianqi|shaosong|tang');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--report') { assert(args[++i] && !args[i].startsWith('--'), '--report 缺路径'); }
    else assert(args[i] === '--write', '未知参数 ' + args[i]);
  }
  const spec = require('../data/' + sid + '-governors');
  const file = path.join(ROOT, 'scenarios', spec.scenario);
  const raw = fs.readFileSync(file, 'utf8');
  const scenario = JSON.parse(raw);
  assert.strictEqual(JSON.stringify(scenario) + '\n', raw, '剧本不是标准 JSON.stringify 输出，拒绝改写');
  apply(scenario, spec);
  require('../tools/verify-governors').verify(scenario, spec);
  const ri = args.indexOf('--report');
  if (ri >= 0) fs.writeFileSync(args[ri + 1], report(spec));
  if (args.includes('--write')) fs.writeFileSync(file, JSON.stringify(scenario) + '\n');
  console.log(spec.label + '：核验通过，省道 ' + spec.bindings.length + '，新人物 ' + spec.characters.length + (args.includes('--write') ? '；已写入真源' : '；只读预演'));
}
module.exports = { positions, provinces, copies, resolve, apply, report };
if (require.main === module) main();
