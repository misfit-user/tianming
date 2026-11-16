#!/usr/bin/env node
// smoke-scenario-editor-reset-preview.js - Preview shell gate for scenario editor reset UI.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'preview', 'scenario-editor-reset-preview.html');
const dataFile = path.join(ROOT, 'preview', 'scenario-editor-reset-data.js');
const appFile = path.join(ROOT, 'preview', 'scenario-editor-reset-app.js');
const bridgeFile = path.join(ROOT, 'preview', 'scenario-editor-sandbox-bridge.js');
const adaptersFile = path.join(ROOT, 'preview', 'scenario-editor-reset-adapters.js');
let passed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

assert(fs.existsSync(file), 'scenario editor reset preview html should exist');
assert(fs.existsSync(dataFile), 'scenario editor reset preview data should exist');
assert(fs.existsSync(appFile), 'scenario editor reset preview app script should exist');
assert(fs.existsSync(bridgeFile), 'scenario editor formal sandbox bridge should exist');
assert(fs.existsSync(adaptersFile), 'scenario editor runtime adapters should exist');

/* R1 架构整备(2026-07-03)：CSS 已外提 scenario-editor-reset-style.css——此 smoke 的
   2000+ 断言历史语义=『整页(内联时代)包含…』·故 html 取 html+css 合体·语义不变。 */
const html = fs.readFileSync(file, 'utf8') + fs.readFileSync(path.join(ROOT, 'preview', 'scenario-editor-reset-style.css'), 'utf8');
const dataJs = fs.readFileSync(dataFile, 'utf8');
const appJs = fs.readFileSync(appFile, 'utf8');

const expectedModules = [
  'scenarioOpening',
  'peopleLineages',
  'factionsSociety',
  'courtInstitutions',
  'adminMap',
  'economyPopulation',
  'militaryFrontier',
  'eventsChronicle',
  'rulesAi'
];

assert((html.match(/class="module-tile/g) || []).length === expectedModules.length,
  'preview should render exactly nine module tiles');
/* 2026-07-03 玄墨案头重做：照片纹理(img/ancient-tabletop-board.png)按设计退役，
   背景改程序化墨底+微噪点；「使用天命自有视觉资产」的守卫改钉随游戏分发的自带字体。 */
assert(!html.includes('<script>\r\n    const modules = {') && !html.includes('<script>\n    const modules = {'),
  'preview should not execute the legacy static prototype script');
assert(dataJs.includes('TM_SCENARIO_EDITOR_RESET_DATA'), 'preview data should publish a global data payload');
assert(dataJs.includes('天启七年'), 'preview data should be generated from the official Tianqi scenario');
// 官制章 folio（清单/树状图）增补入口：玩家反馈树上/详情找不到手动添加按钮
// 批三·驾驶舱三合一：独立面板裁撤·待办清单(id 原样)并入制作流程导航面板·渲染器零改
assert(!appJs.includes('data-panel="production-dashboard"'), 'production dashboard standalone panel must stay removed (三合一)');
assert(!html.includes('tm-patches.js') && !html.includes('tm-endturn-ai-infer.js'),
  'preview should not load formal game runtime scripts');
// 2026-07-04 放宽为语义锚：菜单页文案在迭代（并行会话重做启动页去开发腔）·逐字钉营销文案必然反复断——
// 只验「著卷入口卡存在且宣传剧本工坊」·措辞随文案组自由

// Slice 1: variables polymorphism. The editor must accept both the legacy flat
// array (天启) and the kinded `{base:[...], other:[...], formulas:[...]}` object
// (绍宋) without dropping data.
// Confirm both shapes show up in save logic so saving a kinded scenario never
// rebuilds it as an empty flat array.
// Verify 绍宋官方 scenario does have the kinded shape we are protecting.
const shaosongScenarioPath = path.resolve(ROOT, '..', 'scenarios', '绍宋·建炎元年八月（官方）.json');
if (fs.existsSync(shaosongScenarioPath)) {
  const shaosong = JSON.parse(fs.readFileSync(shaosongScenarioPath, 'utf8'));
  assert(shaosong && typeof shaosong.variables === 'object' && !Array.isArray(shaosong.variables),
    '绍宋 official scenario should keep variables as a kinded object — confirms the polymorphism the editor must handle');
  assert(Object.keys(shaosong.variables).every((k) => Array.isArray(shaosong.variables[k])),
    '绍宋 variables buckets should all be arrays (isKindedVariables predicate matches)');
  // Slice 2: globalRules / rules polymorphism. 绍宋 stores globalRules as an
  // array of short strings; 天启 stores it as one long paragraph string.
  assert(Array.isArray(shaosong.globalRules),
    '绍宋 official scenario should keep globalRules as an array — confirms the polymorphism the editor must handle');
}

// Slice 3: rigidTriggers polymorphism. 天启 stores it as object (keyed by id);
// 绍宋 stores it as an array (currently empty). The editor must accept both
// shapes and save back the same shape.
if (fs.existsSync(shaosongScenarioPath)) {
  const shaosong = JSON.parse(fs.readFileSync(shaosongScenarioPath, 'utf8'));
  assert(Array.isArray(shaosong.rigidTriggers),
    '绍宋 official scenario should store rigidTriggers as an array — confirms the polymorphism the editor must handle');
}
// timeline shape support already existed (collectTimelineWorkbenchRows /
// saveTimelineWorkbench both branch on Array.isArray) but assert it so the
// regression smoke catches accidental regressions.

// Slice 4: one-click load of either official scenario via the starter panel.
// The creator should not have to file-pick the official baseline file.
// Confirm both official scenarios actually exist on disk so the loader has a
// real target. This protects against renames/moves of the scenario files.
const tianqiPath = path.resolve(ROOT, '..', 'scenarios', '天启七年·九月（官方）.json');
assert(fs.existsSync(tianqiPath),
  '天启 official scenario file should be present at scenarios/ root');
assert(fs.existsSync(shaosongScenarioPath),
  '绍宋 official scenario file should be present at scenarios/ root');

// Slice 6: in-memory bundle of official scenarios. The bundle lets the loader
// work without fetch (Electron webSecurity on, file:// scopes) and gives the
// editor a deterministic baseline at boot.
const bundleFile = path.join(ROOT, 'preview', 'official-scenarios-bundle.js');
assert(fs.existsSync(bundleFile),
  'preview should ship a pre-built official scenarios bundle');
// Confirm the build script itself exists so anyone touching the scenario files
// can regenerate the bundle.
const bundleBuilder = path.join(ROOT, 'scripts', 'build-official-scenarios-bundle.js');
assert(fs.existsSync(bundleBuilder),
  'preview should ship the build script that regenerates the bundle');

// Slice 7: eraState dual vocabulary. Both official scenarios diverge sharply
// on this field (only 4 keys shared); the workbench must group the disjoint
// vocabularies so a creator knows which tradition they are filling in.
// Confirm the two official scenarios still match the vocabulary buckets we
// declared, so future scenario edits cannot silently drift the field set.
const tianqiSc = JSON.parse(fs.readFileSync(tianqiPath, 'utf8'));
if (fs.existsSync(shaosongScenarioPath)) {
  const shaosong = JSON.parse(fs.readFileSync(shaosongScenarioPath, 'utf8'));
  const tianqiEra = tianqiSc.eraState || {};
  const shaosongEra = shaosong.eraState || {};
  const tianqiUnique = ['politicalUnity','socialStability','culturalVibrancy','bureaucracyStrength','militaryProfessionalism','legitimacySource','landSystemType'];
  tianqiUnique.forEach((k) => assert(k in tianqiEra,
    '天启 eraState should still include the tianqi-tradition key: ' + k));
  const shaosongUnique = ['stabilityIndex','internalConflict','foreignPressure','militaryStrength','agriculturalYield','culturalDevelopment','technologyLevel','weatherStability'];
  shaosongUnique.forEach((k) => assert(k in shaosongEra,
    '绍宋 eraState should still include the shaosong-tradition key: ' + k));
  ['centralControl','economicProsperity','dynastyPhase','contextDescription'].forEach((k) => {
    assert(k in tianqiEra, '天启 eraState should include shared key ' + k);
    assert(k in shaosongEra, '绍宋 eraState should include shared key ' + k);
  });
}

// Slice 10: dynamic blueprint enrichment. The baked blueprint only assigns
// keys present in 天启 (the source scenario); 绍宋's 21 extra top-level keys
// would be orphaned from module navigation without absorbing.
// 21 named 绍宋-only top-level keys must each have a runtime-audit row so the
// absorber can route them to the right module. RUNTIME_FIELD_SURFACES already
// contains them per the audit table in app.js; assert each individually.

// Slice 11: build-script union for blueprint coverage. The baked
// scenario-editor-reset-data.js must cover both 天启 and 绍宋 keys so the
// editor's module navigation does not need to lean on the runtime orphan
// absorber for the shipped scenarios.
// Confirm the baked data file itself now exposes a union-blueprint with the
// 21 绍宋-only keys assigned.
const vm = require('vm');
const dataSandbox = {};
vm.createContext(dataSandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'preview', 'scenario-editor-reset-data.js'), 'utf8'), dataSandbox);
const bakedBlueprint = dataSandbox.TM_SCENARIO_EDITOR_RESET_DATA && dataSandbox.TM_SCENARIO_EDITOR_RESET_DATA.blueprint;
assert(bakedBlueprint && Array.isArray(bakedBlueprint.assignedTopLevelKeys),
  'baked blueprint should expose assignedTopLevelKeys');
assert(bakedBlueprint.assignedTopLevelKeys.length >= 104,
  'baked blueprint should cover at least the 104-key union of both scenarios; got ' + bakedBlueprint.assignedTopLevelKeys.length);
['engineConstants', '_adaptation', '_buildStatus', 'chronicleConfig', 'startMonth'].forEach((key) => {
  assert(bakedBlueprint.assignedTopLevelKeys.indexOf(key) >= 0,
    'baked blueprint should now route 绍宋-only key after Slice 11: ' + key);
});
assert(bakedBlueprint.keyUniverseSize >= 104,
  'baked blueprint should record keyUniverseSize >= 104');

// Slice 13: context-aware vassalType↔type alias. The pair is too generic for
// global aliasing (events/items also have a `type` field), so we only route
// the rename when the parent field is a vassal container. saveTreeWorkbench
// also pins vassalType ahead of type in its meta chain to keep TQ-shape data.
// Specialist forms should now forward the parent field context so future
// schemas covering vassalSystem entries pick up the alias automatically.

// Slice 17: adminHierarchy shape summary header. The flat-by-faction (天启)
// vs single-faction recursive children-tree (绍宋) paradigm difference is
// invisible in the generic tree workbench. The summary makes it explicit.
// Verify the two official scenarios still match the expected paradigms — if
// they ever change, the summary header would mislabel them.
const tqAdmin = tianqiSc.adminHierarchy;
if (fs.existsSync(shaosongScenarioPath)) {
  const ss = JSON.parse(fs.readFileSync(shaosongScenarioPath, 'utf8'));
  assert(typeof tqAdmin === 'object' && !Array.isArray(tqAdmin) && Object.keys(tqAdmin).length > 5,
    '天启 adminHierarchy should be a flat-by-faction object with many faction containers');
  // 绍宋剧本已扩充为多势力 adminHierarchy(player + 金/西夏/大理/吐蕃/河北义军/外蕃诸势力·见剧本外蕃territories 扩充·设计演进非数据污染)·
  //   原"单一容器(===1)"假设过时→改验多势力容器(此断言本就是金丝雀:剧本换 paradigm 即触发·此处确认是有意演进)。
  assert(typeof ss.adminHierarchy === 'object' && !Array.isArray(ss.adminHierarchy) && Object.keys(ss.adminHierarchy).length > 5,
    '绍宋 adminHierarchy should now be a multi-faction container (剧本外蕃扩充·原 single-faction 假设过时)');
}

// Slice 18: specialist schemas enriched with cross-scenario fields. Without
// this, key fields used by only one tradition (e.g. 绍宋's coreMotivations,
// 天启's haoName) only appear via the auto-append fallback — which is capped
// at 18 keys and order-dependent. Declaring them explicitly guarantees they
// surface and the alias resolver visibly fires for desc/description rows.
// Confirm 绍宋 characters actually carry the enriched fields the schema now
// surfaces; otherwise the schema would be aspirational rather than useful.
if (fs.existsSync(shaosongScenarioPath)) {
  const ss = JSON.parse(fs.readFileSync(shaosongScenarioPath, 'utf8'));
  const sampleChar = (ss.characters || []).find((c) => c && c.coreMotivations);
  assert(sampleChar && Array.isArray(sampleChar.coreMotivations) || sampleChar && typeof sampleChar.coreMotivations === 'string',
    '绍宋 should have at least one character carrying coreMotivations — the enriched schema needs real data to surface');
}

// Slice 19: combo build-all runner. The two scenario-editor artifacts must
// stay in lockstep; the runner refreshes both with a single command.
const combo = path.join(ROOT, 'scripts', 'build-scenario-editor-reset-all.js');
assert(fs.existsSync(combo),
  'combo build runner should exist');
const comboSrc = fs.readFileSync(combo, 'utf8');
assert(!comboSrc.includes("require('./build-scenario-editor-reset-data.js')") &&
  !comboSrc.includes("require('./build-official-scenarios-bundle.js')"),
  'combo runner should not rebuild editor artifacts through partial legacy paths');

// Slice 23: AI prompt template per scenario tradition. buildAiTaskPackage
// now prepends a tradition-specific hint (天启 v48 vs 绍宋 v1.6-D) so the
// generated content stays on-schema and stylistically consistent.
// Sanity-check the detection signals so a future refactor cannot regress them.

// Slice 28: import file validation safety gate. Broken / non-scenario JSON
// used to clobber the working draft instantly; now validation runs first,
// errors go to the status log, and a force-load escape hatch is provided.
// Validation should sanity-check the polymorphic shapes we've been guarding.

// Slice 36: granular AI batch helpers. queueModuleAiTasksFiltered targets a
// subset of the module's fields (missing / present / watched) so creators
// don't have to run the full module batch when only certain gaps need work.
['missing', 'present', 'watched', 'all'].forEach((filterId) => {
  assert(appJs.indexOf("filterId === '" + filterId + "'") >= 0 || filterId === 'all',
    'queueModuleAiTasksFiltered should branch on filter id: ' + filterId);
});

// Slice 51: collaborative share URL.
// 2026-07-21 owner 裁：真剧本 MB 级 URL 装不下·分享钮点了只报「剧本过大」=死重→入口裁撤·装载机留(旧链接照开)
assert(!appJs.includes('data-editor-command="copy-share-url"'),
  '复制分享链接 entry must stay removed (dead weight at real scenario sizes)');

// Slice 55: top-actions icon-btn accessibility labels.
// 工坊案台二稿(owner 批「跳游戏不友好」)：入口首选聚焦编辑器内案台面板·adapters 缺席才兜底跳游戏
// 批二：淘剧本/改编
// 三稿批一：淘剧本橱窗（起本幕全宽·自动取目录·卡片+排序筛选+可开性亮牌+详情展开）
// 三稿批二：出品案台（双轨发布·预检牌先亮·提交台账·作品卡）
// 三稿批三：社区信号（精选位/收藏/即点评分——服务器现成接口·长评圈子仍归游戏内工坊）
// 三稿批六：案台两层制（owner 拍板：登录/注册一层·发布一层）
// 三稿批七：发布健全化（对齐游戏内工坊投稿档次）
// 三稿批八：发布补齐(封面/版本说明)——客户端全线接好·老服务器忽略未知键零害·服务器补丁后点亮

// Slice 73: save indicator pill.
// 治 quota：超大剧本(天启 3.7M)超 localStorage 配额时落 IndexedDB 后备（治本：不再静默丢一整轮编辑），不再 throw。

// Slice 74: top-action group dividers.
// 顶栏收纳(2026-07-21)：十三钮→六钮+「⋯」菜单·预(与出重复)不再直出·重置入危险区二次确认
assert(!/icon-btn" data-editor-command="run-preflight"/.test(appJs),
  '预 must not be a bare top icon-btn anymore (出 already preflights — redundant)');

// Slice 95: de-preview the editor surface.
assert(!html.includes('剧本工坊重构预览'),
  'no surface text should still mention 剧本工坊重构预览');
assert(!html.includes('可制作预览'),
  'no surface text should still mention 可制作预览');
// 五幕重构批一：hero 大标语+统计卡 → 一行状态条(kicker 收作 strip-kicker「总控台」)
assert(!html.includes('Scenario Authoring Desk'),
  'no surface text should still carry the English kicker');
assert(!html.includes('从旧侧栏表单'),
  'hero h2 should drop the 从旧侧栏表单 transition framing');
assert(!appJs.includes("'新版剧本工坊 · 官方基线预览'"),
  'runtime brandSub state should no longer carry 官方基线预览');

// Slice 96: English module + field-group titles translated.
const inventorySource = fs.readFileSync(path.join(ROOT, 'scripts', 'editor-reset-inventory.js'), 'utf8');
assert(!/title:\s*'[A-Z][a-z]+\s/.test(inventorySource),
  'editor-reset-inventory should no longer carry English titles starting with a capitalised word');
const bakedData = fs.readFileSync(dataFile, 'utf8');
assert(bakedData.includes('"剧本总览与玩家开局"'),
  'baked data should carry the regenerated Chinese module title');
assert(bakedData.includes('"AI 人格与行为"'),
  'baked data should carry the regenerated Chinese field-group title');

// Round 13 · Slice 98: runtime field audit rows promote the Chinese title and
// demote the English JSON key to a muted monospace identifier chip.
assert(!/<b>'\s*\+\s*provenanceBadgeHtml\(row\.field\)\s*\+\s*escapeHtml\(row\.field\)/.test(appJs),
  'runtime field audit rows should no longer render the bare English key right after the provenance badge');

// Round 13 · Slice 99: module rail title and sub-tagline should stack
// vertically — .module-name needs flex-column or the .module-sub margin-top
// is silently dropped by its inline-span parent.
const moduleNameBlock = html.match(/\.module-name\s*\{[^}]*\}/);
assert(moduleNameBlock && /display:\s*flex/.test(moduleNameBlock[0]),
  '.module-name should use display:flex so its sub-tagline stacks vertically');
assert(moduleNameBlock && /flex-direction:\s*column/.test(moduleNameBlock[0]),
  '.module-name should set flex-direction:column for stacked title/sub layout');

// Round 14 · Slice 102: sticky section nav strip at the top of .main-stack.
// 批三改写：SECTION_NAV_ENTRIES/滚动spy/jump-section-panel/收展全 随大区胶囊退役——五幕页签为唯一顶导航
assert(!/SECTION_NAV_ENTRIES\s*=\s*\[/.test(appJs),
  'SECTION_NAV_ENTRIES must stay removed (五幕页签取代)');
assert(!appJs.includes("command === 'jump-section-panel'") && !appJs.includes("command === 'collapse-all-stack-panels'"),
  'section pill commands must stay removed');
const navStripBlock = html.match(/\.section-nav-strip\s*\{[^}]*\}/);
assert(navStripBlock && /position:\s*sticky/.test(navStripBlock[0]),
  'section nav strip should be position:sticky');

// Round 16 · Slice 106: 承接旧编辑器 transition copy on API settings panel
// should be deleted.
assert(!appJs.includes('此处承接旧编辑器顶部'),
  'API settings panel should no longer carry the 承接旧编辑器 transition copy');

// Round 16 · Slice 107 → 五幕重构批一(2026-07-21)改写：23 胶囊子导航裁撤·
// 五幕页签(deck-stage-tab)取代两套胶囊·面板按 data-stage 挂幕·一次只渲一幕。
assert(!appJs.includes('<div class="runtime-subnav"'),
  'runtime sub-nav pill strip must stay removed (五幕页签取而代之)');
assert(!appJs.includes('collapse-all-stack-panels" title="收起所有可折叠面板'),
  '全部收起/展开 strip buttons must stay removed (一次一幕后无此需要)');
// 五幕批二·体检一览：勘误幕首位聚合(校验错/提+审计必需缺口/蓝图外)·深入面板直达·随校验刷新

// Round 19 · Slice 111: left rail + right inspector each need their own
// internal scroll so middle column can scroll the page independently. Without
// max-height + overflow-y:auto, content past the viewport in the sticky rails
// was unreachable.
// Match the standalone .inspector / .module-rail base rules (not selectors
// like ".editor-grid[data-inspector-collapsed='true'] .inspector").
const inspectorBlock = html.match(/(^|\n)\s{0,4}\.inspector\s*\{[\s\S]{0,800}?\n\s{0,4}\}/);
assert(inspectorBlock && /max-height:\s*calc\(100vh/.test(inspectorBlock[0]),
  '.inspector base rule should declare max-height: calc(100vh - …) so it scrolls internally');
assert(inspectorBlock && /overflow-y:\s*auto/.test(inspectorBlock[0]),
  '.inspector base rule should set overflow-y:auto for its internal scroll');
const railBlock = html.match(/(^|\n)\s{0,4}\.module-rail\s*\{[\s\S]{0,800}?\n\s{0,4}\}/);
assert(railBlock && /max-height:\s*calc\(100vh/.test(railBlock[0]),
  '.module-rail base rule should also declare max-height for parity with .inspector');
assert(railBlock && /overflow-y:\s*auto/.test(railBlock[0]),
  '.module-rail base rule should set overflow-y:auto');

// ── 保存/导出加固（2026-07-10 玩家反馈「无法保存」「导出无法选文件夹」）──
// 案卷索引 localStorage 配额加固：此前裸 setItem 一炸即断 saveProjectSnapshot·索引丢失成孤儿案卷。
// 导出走桌面原生另存为对话框（可选目录）·无 IPC 回退浏览器下载。

// ── 2026-07-19 剧本工坊 + 国师联合加固回归 ──

// linkedChars/linkedFactions 是多态标签：保留传播能力，但不应制造假断引用占位实体。
assert(!/validateRefs\(sc\.(events|rigidHistoryEvents)/.test(appJs),
  'global validation should not treat event tags as strict entity foreign keys');

// 首屏密度：运行/健康保留展开，低频四区默认折叠(批三：捷径迁grid面板·覆盖矩阵退役——出折叠册)。
// 批三·日志合订+裁撤契约
assert(!/<section class="panel ai-coverage-matrix"/.test(html),
  'AI coverage matrix static section must stay removed (CSS 残留选择器不碍事)');

console.log('smoke-scenario-editor-reset-preview OK: ' + passed + ' assertions');
