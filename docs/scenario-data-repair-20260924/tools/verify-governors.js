// 任官数据门禁（离线，不开游戏 VM）：全部副本、姓名、官称、枚举、原文与玩家省道覆盖。
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { positions, provinces, copies, resolve } = require('../patches/governors');
const ROOT = path.resolve(__dirname, '../../..');
const DIR = path.resolve(__dirname, '..');
function plain(text) {
  return String(text).replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
    .replace(/-\{([^}]+)\}-/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/\{\{(?:YL|ul|SK anchor)\|([^}|]+)\}\}/g, '$1')
    .replace(/'{2,}/g, '').replace(/\s/g, '');
}
function liveHits(scenario, title) {
  const op = String(title || '').trim();
  return !op ? [] : scenario.characters.filter((c) => {
    if (c.alive === false || c.dead === true) return false;
    const t = String(c.title || '').trim(), ot = String(c.officialTitle || '').trim();
    return t === op || (ot && (ot === op || ot.split('·')[0].trim() === op || ot.startsWith(op)));
  });
}
function verify(scenario, spec) {
  const all = provinces(scenario);
  const registry = Object.values(scenario.map.circuitRegistry || {});
  const registryIds = new Set(registry.map((r) => r.sourceAdminId || r.key));
  const names = new Set(), ids = new Set(), touched = new Set();
  scenario.characters.forEach((c) => {
    assert(!names.has(c.name), '重名人物 ' + c.name); names.add(c.name);
    // 天启旧人物有未填 id 的记录；此刀不替全库补 id，但有 id 者不得冲突。
    if (c.id) { assert(!ids.has(c.id), '重复人物 id ' + c.id); ids.add(c.id); }
  });
  assert.strictEqual(copies(scenario, spec, 'player').length, spec.playerCopies, '玩家官制副本数漂移');
  const counts = { linked: 0, vacant: 0, enumerated: 0, player: 0 };
  for (const row of spec.bindings) {
    const key = row.owner + '/' + row.nodeId;
    assert(!touched.has(key), '重复节点声明 ' + key); touched.add(key);
    const found = all.filter((r) => r.owner === row.owner && r.node.id === row.nodeId);
    assert.strictEqual(found.length, 1, '找不到行政节点 ' + key);
    const n = found[0].node;
    assert([n.id, n.mapRegionId, n.regionId].some((id) => id && registryIds.has(id)), '省道不是 registry 指向的源节点 ' + n.name);
    if (row.owner === 'player') counts.player++;
    assert.strictEqual(n.governorOffice, row.governorOffice, '引用漂移 ' + n.name);
    assert(!Object.hasOwn(n, 'governorCharId'), '节点不得存人物 id ' + n.name);
    if (n.governorOffice === null) {
      assert(['分镇', '土官袭替', '羁縻', '诸部'].includes(n.governanceNote), '非法枚举 ' + n.name);
      assert(typeof n.governanceDetail === 'string' && n.governanceDetail.trim(), '枚举缺说明 ' + n.name);
      assert.strictEqual(n.governor || '', '', '多主官节点还挂着单人 ' + n.name);
      counts.enumerated++;
      continue;
    }
    assert(!n.governanceNote, '有职位的节点不应带无单主官枚举 ' + n.name);
    let canonical;
    const officeCopies = copies(scenario, spec, row.owner);
    if (spec.sid === 'tang') assert.strictEqual(officeCopies.length, row.owner === 'player' ? 3 : 2, '晚唐官制副本缺失 ' + n.name);
    for (const copy of officeCopies) {
      const foundPost = resolve(copy.tree, n.governorOffice, spec.useIds);
      assert.strictEqual(foundPost.length, 1, copy.name + ' 不能唯一解析 ' + n.governorOffice);
      const p = foundPost[0].position;
      if (canonical) assert.deepStrictEqual(p, canonical, '职位副本不一致 ' + n.name + ' ' + copy.name);
      else canonical = p;
      if (!spec.useIds) {
        const paths = positions(copy.tree).map((r) => r.path);
        assert.strictEqual(new Set(paths).size, paths.length, '部门/职位路径重复 ' + copy.name);
      }
    }
    assert.strictEqual(n.officialPosition, canonical.name, '节点显示官称与职位不一致 ' + n.name);
    assert.strictEqual(n.governor, canonical.holder || '', 'holder 与节点显示不一致 ' + n.name);
    assert.strictEqual(n.governor, row.holder || '', '数据声明 holder 不一致 ' + n.name);
    const hits = liveHits(scenario, canonical.name);
    if (canonical.holder) {
      const chars = scenario.characters.filter((c) => c.name === canonical.holder);
      assert.strictEqual(chars.length, 1, 'holder 不能按姓名唯一命中 ' + canonical.holder);
      assert(chars[0].alive !== false && chars[0].dead !== true, '已殁人物仍居官 ' + canonical.holder);
      assert.strictEqual(hits.length, 1, '官称不能活绑定 ' + canonical.name + '：' + hits.map((c) => c.name));
      assert.strictEqual(hits[0].name, canonical.holder, '官称挂错人 ' + n.name);
      counts.linked++;
    } else {
      assert.strictEqual(hits.length, 0, '出缺职位仍按官称挂到人 ' + n.name);
      counts.vacant++;
    }
  }
  for (const row of all.filter((r) => r.owner === 'player')) {
    assert(touched.has('player/' + row.node.id), '漏了玩家省道 ' + row.node.name);
  }
  for (const mirror of spec.officeMirrors || []) {
    const canonical = resolve(scenario.officeTree, mirror.canonicalRef, spec.useIds);
    assert.strictEqual(canonical.length, 1, '镜像缺原职位 ' + mirror.canonicalRef);
    for (const copy of copies(scenario, spec, mirror.owner)) {
      const found = resolve(copy.tree, mirror.ref, spec.useIds);
      assert.strictEqual(found.length, 1, '镜像缺职位 ' + mirror.ref);
      assert.deepStrictEqual(found[0].position, canonical[0].position, '独立官制中的同一帅职不一致 ' + mirror.ref);
    }
  }
  // 全树而非仅补丁所触节点；与 governor-binding.js 一致的匹配规则。
  Object.values(scenario.adminHierarchy || {}).forEach((tree) => {
    (function walk(nodes) {
      (nodes || []).forEach((n) => { const h = liveHits(scenario, n.officialPosition); assert(h.length <= 1, n.name + ' 官称挂人歧义：' + h.map((c) => c.name)); walk(n.children); });
    })(tree.divisions);
  });
  for (const src of spec.sources || []) {
    assert(src.quote && src.title && src.url && src.file, '引文缺来源 ' + src.id);
    const file = path.resolve(DIR, src.file);
    assert(file.startsWith(DIR + path.sep), '来源路径越界 ' + src.file);
    const raw = fs.readFileSync(file, 'utf8');
    assert(plain(raw).includes(plain(src.quote)), '引文未命中原文库 ' + src.id);
  }
  const sourceIds = new Set((spec.sources || []).map((s) => s.id));
  assert.strictEqual(sourceIds.size, (spec.sources || []).length, '引文 id 重复');
  for (const row of [...spec.bindings, ...(spec.officeUpdates || []), ...(spec.characterUpdates || []), ...(spec.offices || [])]) {
    for (const id of row.sources || []) assert(sourceIds.has(id), '引用了不存在的原文 ' + id);
  }
  for (const c of spec.characters) {
    assert(c.id, '新人物缺稳定 id ' + c.name);
    assert(Array.isArray(c.historicalSources) && c.historicalSources.length, '新人物缺来源 ' + c.name);
    assert(c.portrait && c.bio && c.background && c.description, '新人物档案不完整 ' + c.name);
    assert((c.personalGoals || []).every((g) => g && typeof g === 'object' && typeof g.longTerm === 'string'), '目标不是对象 ' + c.name);
    assert(c.appearance === '', '本委任状不编外貌 ' + c.name);
  }
  return counts;
}
function main() {
  const keys = process.argv.slice(2);
  for (const sid of keys.length ? keys : ['tianqi', 'shaosong', 'tang']) {
    assert(['tianqi', 'shaosong', 'tang'].includes(sid));
    const spec = require('../data/' + sid + '-governors');
    const scenario = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', spec.scenario), 'utf8'));
    console.log(sid + ' PASS ' + JSON.stringify(verify(scenario, spec)));
  }
}
module.exports = { verify, liveHits, plain };
if (require.main === module) main();
