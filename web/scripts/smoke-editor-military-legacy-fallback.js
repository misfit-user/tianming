#!/usr/bin/env node
'use strict';
/*
 * smoke-editor-military-legacy-fallback.js — 刀5：剧本编辑器军务面板旧字段兼容（入口层迁移·二审加固版）
 *
 * 病灶：军务面板运行时渲染器 renderMilitaryNew() 只渲染 military.initialTroops / militarySystem。
 *   老剧本（数据在 troops/organization）与「AI 生成军事」的数组回退路径把内容落进旧桶 →
 *   面板显示为空（玩家小新报告的「军务边防模块内容没有了」）。
 *
 * 修复（Codex 两轮复审后定稿）：
 *   1. 迁移在数据入口层 SchemaAdapter.importScenario（会话前一次性 schema 变换），renderMilitaryNew 纯读。
 *   2. importScenario 入口门（editor-fullgen.js）纳入 needsMilitaryMigration——桶化 events/variables
 *      + 旧 military 的剧本也触发迁移（此前只在 events/vars 为数组时才调 adapter → 漏迁移）。
 *   3. 深克隆迁移（隔离 equipment/composition 引用）；旧桶「不删」保留给 runtime(tm-military-ui.js)
 *      读 P.military.troops/organization，且与官方剧本新旧并存的结构一致。
 *   4. 复活环封堵：_legacyMigratedV1 标记「仅确有迁移时落 + 随导出持久化(不剥离)」——玩家删光
 *      initialTroops 后导出再导入，标记在→不重迁→不复活。官方剧本无迁移→无标记→military byte 等价。
 *   5. type→armyType 完整值域映射，未知值保留原串（表单侧补动态选项，不静默变禁军）。
 *   6. AI-gen 用 _rawParsed 处理整个对象（initialTroops/militarySystem/battleConfig 三键全落位，
 *      修既有缺陷：此前只取首个数组 → militarySystem/battleConfig 被丢）；扁平数组回退落新字段。
 *
 * node scripts/smoke-editor-military-legacy-fallback.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; } else { F++; console.log('  ✗ FAIL: ' + m); } }

const SchemaAdapter = require(path.join(ROOT, 'editor-schema-adapter.js'));
const imp = (raw) => SchemaAdapter.importScenario(raw).scriptData;

// ============================================================
// A. 入口层迁移：troops → initialTroops + 深克隆隔离
// ============================================================
(function () {
  const raw = { military: {
    troops: [
      { name: '关宁军', type: '边军', description: '辽东精锐', equipment: [{ name: '红衣炮', count: 10 }], composition: [{ type: '骑兵', count: 5000 }] },
      { name: '京营', type: '中央军', desc: '五军营' }
    ],
    initialTroops: []
  } };
  const sd = imp(raw);
  const it = sd.military.initialTroops;
  ok(Array.isArray(it) && it.length === 2, 'A: 旧 troops(2) 迁入 initialTroops');
  ok(it[0].name === '关宁军' && it[0].description === '辽东精锐', 'A: name/description 保留');
  ok(it[1].description === '五军营', 'A: desc→description 兜底');
  ok(Array.isArray(sd.military.troops) && sd.military.troops.length === 2, 'A: 旧 troops 非破坏保留(runtime 仍可读)');
  ok(sd.military._legacyMigratedV1 === true, 'A: 确有迁移→落幂等标记');

  it[0].equipment.push({ name: 'X' });
  it[0].composition.push({ type: 'Y' });
  ok(sd.military.troops[0].equipment.length === 1, 'A: 深克隆·改 initialTroops.equipment 不影响 troops');
  ok(sd.military.troops[0].composition.length === 1, 'A: 深克隆·改 initialTroops.composition 不影响 troops');
  ok(it[0].equipment !== sd.military.troops[0].equipment, 'A: equipment 非同一引用');
})();

// ============================================================
// B. type→armyType 完整值域映射表（逐值）+ 未知值不静默变禁军
// ============================================================
(function () {
  const cases = [
    ['中央军', '禁军'], ['边军', '边军'], ['海岛边军', '边军'],
    ['地方军', '地方守备'], ['特殊兵', '自定义'], ['后勤', '自定义']
  ];
  cases.forEach(function (c) { ok(SchemaAdapter.ARMY_TYPE_MAP[c[0]] === c[1], 'B: 映射表 ' + c[0] + '→' + c[1]); });
  const raw = { military: { troops: cases.map(function (c, i) { return { name: 't' + i, type: c[0] }; })
    .concat([{ name: 'unk', type: '某未知兵种' }]), initialTroops: [] } };
  const it = imp(raw).military.initialTroops;
  cases.forEach(function (c, i) { ok(it[i].armyType === c[1], 'B: 迁移后 armyType ' + c[0] + '→' + c[1]); });
  ok(it[6].armyType === '某未知兵种', 'B: 未知 type 保留原值·不静默变禁军');
  ok(it[6].type === '某未知兵种', 'B: 原 type 字段保留');
})();

// ============================================================
// C. organization → militarySystem（自由文本·不映射枚举）
// ============================================================
(function () {
  const raw = { military: { organization: [{ name: '卫所制', type: '世袭军户', description: '卫-千户所-百户所' }], militarySystem: [] } };
  const ms = imp(raw).military.militarySystem;
  ok(Array.isArray(ms) && ms.length === 1 && ms[0].name === '卫所制' && ms[0].type === '世袭军户', 'C: organization 迁入 militarySystem·type 原样');
})();

// ============================================================
// D. 幂等：标记生效 / 新字段已有数据不重迁
// ============================================================
(function () {
  const raw1 = { military: { troops: [{ name: 'a', type: '边军' }], initialTroops: [], _legacyMigratedV1: true } };
  ok(imp(raw1).military.initialTroops.length === 0, 'D: _legacyMigratedV1 标记生效→不重迁');

  const raw2 = { military: { troops: [{ name: '摘要', type: '边军' }], initialTroops: [{ name: '详细单位', soldiers: 60000 }] } };
  const it2 = imp(raw2).military.initialTroops;
  ok(it2.length === 1 && it2[0].name === '详细单位', 'D: initialTroops 已有数据→不迁移(官方剧本零触发)');
  ok(imp(raw2).military._legacyMigratedV1 === undefined, 'D: 无迁移发生→不落标记');
})();

// ============================================================
// E. 复活环封堵（#4b）：删光 → export → import 不复活
// ============================================================
(function () {
  const im1 = imp({ military: { troops: [{ name: 'a', type: '边军' }], initialTroops: [] } });
  ok(im1.military.initialTroops.length === 1 && im1.military._legacyMigratedV1 === true, 'E: 首次导入·迁移+落标记');

  // 玩家在编辑器删光 initialTroops
  im1.military.initialTroops.splice(0, im1.military.initialTroops.length);
  const ex = SchemaAdapter.exportScenario(im1);
  ok(ex.military._legacyMigratedV1 === true, 'E: 导出·标记随军事节持久化(不剥离)');
  ok(Array.isArray(ex.military.troops) && ex.military.troops.length === 1, 'E: 导出·旧 troops 仍在(runtime 可读)');

  const im2 = imp(ex); // 再导入
  ok(im2.military.initialTroops.length === 0, 'E: 删光→导出→导入·标记在→不重迁→已删内容不复活');
})();

// ============================================================
// F. 官方剧本 military 节 byte 等价（#4d）：export(import(raw)).military === raw.military
// ============================================================
(function () {
  const off = path.resolve(ROOT, '..', 'scenarios', '天启七年·九月（官方）.json');
  if (!fs.existsSync(off)) { ok(true, 'F: 跳过(官方剧本文件不在)'); return; }
  const raw = JSON.parse(fs.readFileSync(off, 'utf8'));
  const before = JSON.stringify(raw.military);
  const rt = SchemaAdapter.exportScenario(SchemaAdapter.importScenario(raw).scriptData);
  ok(JSON.stringify(rt.military) === before, 'F: 官方 export(import(raw)).military 与原 military 序列化相等');
  ok(!('_legacyMigratedV1' in rt.military), 'F: 官方剧本无迁移→无内部标记泄漏');
  ok(SchemaAdapter.roundtripCheck(raw).ok === true, 'F: 官方剧本 roundtrip 稳定');
})();

// ============================================================
// G. renderMilitaryNew 纯读（撤渲染时迁移）+ 表单未知值——vm 跑真实代码
// ============================================================
(function () {
  const src = fs.readFileSync(path.join(ROOT, 'editor-military.js'), 'utf8');
  ok(!/_migrateLegacyMilitary/.test(src), 'G: editor-military.js 已无渲染时迁移函数');

  function makeCtx(military) {
    const ctx = {
      document: { getElementById: function () { return null; } },
      escHtml: function (s) { return String(s == null ? '' : s); },
      renderSimpleList: function () {}, updateBadge: function () {},
      openGenericModal: function () {}, closeGenericModal: function () {},
      showToast: function () {}, gv: function () { return ''; }, autoSave: function () {},
      scriptData: { characters: [], military: military },
      console: console, Object: Object, Array: Array, String: String, parseInt: parseInt, JSON: JSON
    };
    ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'editor-military.js' });
    return ctx;
  }

  const c1 = makeCtx({ troops: [{ name: '关宁军', type: '边军' }], initialTroops: [] });
  c1.renderMilitaryNew();
  ok(c1.scriptData.military.initialTroops.length === 0, 'G: renderMilitaryNew 纯读·不迁移旧 troops');

  const c2 = makeCtx({ troops: [{ name: '关宁军', type: '边军' }], initialTroops: [{ name: 'x' }] });
  c2.scriptData.military.initialTroops.splice(0, 1);
  c2.renderMilitaryNew();
  ok(c2.scriptData.military.initialTroops.length === 0, 'G: 删最后一条→渲染器不复活');

  let safe = true;
  try { const c3 = makeCtx(undefined); c3.renderMilitaryNew();
    ok(c3.scriptData.military && c3.scriptData.military.initialTroops.length === 0, 'G: military 缺失→建空结构不崩'); }
  catch (e) { safe = false; console.log('  ' + e.message); }
  ok(safe, 'G: military 缺失不抛错');

  const c4 = makeCtx({ troops: [], initialTroops: [] });
  const html = c4._buildTroopForm({ name: 'x', armyType: '海岛边军' });
  ok(html.indexOf('value="海岛边军" selected') >= 0, 'G: 未知 armyType 补 selected 动态选项');
  ok(html.indexOf('（原值·保留）') >= 0, 'G: 动态选项标注原值');
  ok(html.indexOf('value="禁军" selected') < 0, 'G: 未知值不被静默选成禁军');
})();

// ============================================================
// H. 入口门覆盖（#4a）：桶化剧本 + 旧 military 也触发迁移
// ============================================================
(function () {
  const bucketized = {
    events: { historical: [], random: [], conditional: [], story: [], chain: [] },
    variables: { base: [], other: [], formulas: [] },
    military: { troops: [{ name: '关宁军', type: '边军' }], initialTroops: [] }
  };
  const oldGate = Array.isArray(bucketized.events) || Array.isArray(bucketized.relations) ||
    Array.isArray(bucketized.factionRelations) || Array.isArray(bucketized.variables);
  ok(oldGate === false, 'H: 旧入口门对「桶化 events/vars」剧本=false(暴露漏迁移)');
  ok(SchemaAdapter.needsMilitaryMigration(bucketized) === true, 'H: needsMilitaryMigration=true(补进入口门)');
  ok(imp(bucketized).military.initialTroops.length === 1, 'H: 桶化剧本+旧 military·经 adapter 仍迁移');

  // 已迁移(带标记)→needs=false；官方形态(新字段已有)→needs=false
  ok(SchemaAdapter.needsMilitaryMigration({ military: { troops: [{ name: 'a' }], initialTroops: [], _legacyMigratedV1: true } }) === false, 'H: 带标记→needs=false');
  ok(SchemaAdapter.needsMilitaryMigration({ military: { troops: [{ name: 'a' }], initialTroops: [{ name: 'b' }] } }) === false, 'H: initialTroops 非空→needs=false');
})();

// ============================================================
// I. AI-gen 军事分支真跑（#4c）：新格式对象三键全落位 + 扁平数组回退
// ============================================================
(function () {
  const aiSrc = fs.readFileSync(path.join(ROOT, 'editor-ai-gen.js'), 'utf8');
  const milPos = aiSrc.lastIndexOf("target === 'military'"); // 派发处(前面出现在 prompt/校验)
  const bStart = aiSrc.indexOf('{', milPos) + 1;
  const marker = 'renderMilitaryNew();';
  const bEnd = aiSrc.indexOf(marker, bStart) + marker.length;
  ok(milPos >= 0 && bStart > 0 && bEnd > bStart, 'I: 抽取 military 派发分支体');
  const body = aiSrc.slice(bStart, bEnd);
  let run;
  try { run = new Function('scriptData', 'arr', '_rawParsed', 'SchemaAdapter', 'renderMilitaryNew', body); }
  catch (e) { ok(false, 'I: 分支体可编译: ' + e.message); }

  if (run) {
    // 新格式对象：三键全落位（此前只取首数组 initialTroops，militarySystem/battleConfig 被丢）
    const sd = { military: { troops: [], facilities: [], organization: [], campaigns: [], initialTroops: [], militarySystem: [] } };
    const obj = { initialTroops: [{ name: '甲', type: '边军' }], militarySystem: [{ name: '募兵制' }], battleConfig: { unitTypes: [{ n: 'x' }], terrainModifiers: { a: 1 } } };
    run(sd, obj.initialTroops, obj, SchemaAdapter, function () {}); // arr=首数组(模拟上游)
    ok(sd.military.initialTroops.length === 1 && sd.military.initialTroops[0].name === '甲', 'I: 对象·initialTroops 落位');
    ok(sd.military.militarySystem.length === 1 && sd.military.militarySystem[0].name === '募兵制', 'I: 对象·militarySystem 落位(此前被丢)');
    ok(sd.battleConfig && sd.battleConfig.unitTypes && sd.battleConfig.unitTypes.length === 1, 'I: 对象·battleConfig 落位(此前被丢)');
    ok(sd.military.initialTroops[0].armyType === '边军', 'I: 对象·armyType 规范化');

    // 扁平数组回退：落新字段·不写旧桶
    const sd2 = { military: { troops: [], facilities: [], organization: [], campaigns: [], initialTroops: [], militarySystem: [] } };
    run(sd2, [{ name: 'x', type: '中央军' }, { name: 'sys', category: '军制' }], null, SchemaAdapter, function () {});
    ok(sd2.military.initialTroops.length === 1 && sd2.military.initialTroops[0].armyType === '禁军', 'I: 扁平·非军制落 initialTroops+映射');
    ok(sd2.military.militarySystem.length === 1 && sd2.military.militarySystem[0].name === 'sys', 'I: 扁平·军制落 militarySystem');
    ok(sd2.military.troops.length === 0 && sd2.military.facilities.length === 0, 'I: 扁平·不写旧桶(troops/facilities)');
  }
})();

// ============================================================
// 语法有效
// ============================================================
['editor-schema-adapter.js', 'editor-military.js', 'editor-ai-gen.js', 'editor-fullgen.js'].forEach(function (f) {
  let syn = true; try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { syn = false; }
  ok(syn, '语法有效: ' + f);
});

console.log('smoke-editor-military-legacy-fallback: ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F > 0 ? 1 : 0);
